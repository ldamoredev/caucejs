import { NotAuthenticatedError, type ExecutionContext } from '@caucejs/application'
import { CauceError } from '@caucejs/base'
import type { Resolver } from '@caucejs/di'
import type { ToolDescription, ToolOutcome, ToolRunner, UseCaseTool } from '@caucejs/tools'
import type { Authenticator, RequestState } from '@caucejs/web'
import {
    createMcpHandler,
    fromJsonSchema,
    isLegacyRequest,
    McpServer,
    WebStandardStreamableHTTPServerTransport,
    type CallToolResult,
    type JsonSchemaValidator,
    type jsonSchemaValidator,
    type McpHttpHandler,
    type StandardSchemaWithJSON,
} from '@modelcontextprotocol/server'

import { forbidden, methodNotAllowed, methodNotFound, unauthorized } from './responses.js'

// The runtime's console: this package builds without the types of any runtime, and every runtime has one.
declare const console: { error(...values: unknown[]): void }

export type EndpointOptions = {
    readonly name: string
    readonly version: string
    readonly authenticator: Authenticator
    readonly anonymous: boolean
    readonly permissions: readonly string[]
}

type Described = {
    readonly tool: UseCaseTool
    readonly description: ToolDescription
    readonly inputSchema: StandardSchemaWithJSON<unknown, unknown>
}

/** One call to the endpoint: where it runs, as whom, and whether a use case found nobody there. */
type Call = { readonly scope: Resolver; readonly context: ExecutionContext; unauthenticated: boolean }

// The SDK would validate the input with Ajv before cauce reads it, and answer in Ajv's words. Cauce reads it once,
// with the JsonSerializer, inside ToolRunner.call, the way web reads a request.
const readByCauce: jsonSchemaValidator = {
    getValidator<T>(): JsonSchemaValidator<T> {
        return input => ({ valid: true, data: input as T, errorMessage: undefined })
    },
}

const failed = 'Tool execution failed'
const listen = 'subscriptions/listen'

/** A server of MCP over HTTP: who calls it, and the SDK for what they say, one server of the SDK per request. */
export class Endpoint {
    readonly #runner: ToolRunner
    readonly #options: EndpointOptions
    readonly #described: readonly Described[]
    readonly #modern: McpHttpHandler
    // The modern handler builds its server from the request it is given, so each request finds its own call here.
    readonly #calls = new WeakMap<Request, Call>()

    constructor(runner: ToolRunner, tools: readonly UseCaseTool[], options: EndpointOptions) {
        this.#runner = runner
        this.#options = options
        this.#described = tools.map(tool => {
            const description = runner.describe(tool)
            return { tool, description, inputSchema: fromJsonSchema(description.inputSchema, readByCauce) }
        })
        // Created once: it prints a warning about responseMode every time it is created.
        this.#modern = createMcpHandler(
            context => {
                const call = context.requestInfo ? this.#calls.get(context.requestInfo) : undefined
                if (!call) throw new CauceError('A server of MCP was asked for a request it did not receive')
                return this.#server(call)
            },
            { legacy: 'reject', responseMode: 'json' },
        )
    }

    async serve(request: Request, state: RequestState): Promise<Response> {
        const identity = await this.#options.authenticator.authenticate(request)
        if (!this.#options.anonymous && !identity.isAuthenticated) return unauthorized()
        const { permissions } = this.#options
        if (permissions.length > 0 && !permissions.some(permission => identity.can(permission))) return forbidden()
        if (request.method !== 'POST') return methodNotAllowed()

        const call: Call = { scope: state.scope, context: state.context.withIdentity(identity), unauthenticated: false }
        const response = (await isLegacyRequest(request)) ? await this.#legacy(request, call) : await this.#modernOf(request, call)
        return call.unauthenticated ? unauthorized() : response
    }

    async #modernOf(request: Request, call: Call): Promise<Response> {
        // the revision 2026-07-28 names the method in Mcp-Method, and the SDK refuses a body that names another one
        if (request.headers.get('mcp-method')?.trim() === listen) return methodNotFound(await idOf(request))
        this.#calls.set(request, call)
        return this.#modern.fetch(request)
    }

    // The revisions of 2025, without state and answered with JSON: what the SDK does with legacy: 'stateless', except
    // that it answers those with a stream of server-sent events.
    async #legacy(request: Request, call: Call): Promise<Response> {
        const server = this.#server(call)
        const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
        await server.connect(transport)
        // the exchange is over, or the client left: there is nothing to tell anybody if closing fails
        const teardown = (): void => {
            transport.close().catch(() => {})
            server.close().catch(() => {})
        }
        request.signal.addEventListener('abort', teardown, { once: true })
        try {
            return await transport.handleRequest(request)
        } finally {
            teardown()
        }
    }

    #server(call: Call): McpServer {
        // listChanged: false, because the list never changes while the application runs.
        const server = new McpServer(
            { name: this.#options.name, version: this.#options.version },
            { capabilities: { tools: { listChanged: false } } },
        )
        for (const { tool, description, inputSchema } of this.#described) {
            server.registerTool(
                description.name,
                { description: description.description, inputSchema, annotations: { readOnlyHint: description.readOnly } },
                async input => resultOf(await this.#call(tool, input, call)),
            )
        }
        return server
    }

    async #call(tool: UseCaseTool, input: unknown, call: Call): Promise<ToolOutcome> {
        try {
            const outcome = await this.#runner.call(tool, input, { scope: call.scope, context: call.context })
            // what web would hide behind a 500 is the one the application learns nothing about, so it is written down
            if (!outcome.ok && outcome.message === failed) console.error(outcome.error)
            return outcome
        } catch (error) {
            if (!(error instanceof NotAuthenticatedError)) throw error
            call.unauthenticated = true
            return { ok: false, message: error.message, error }
        }
    }
}

function resultOf(outcome: ToolOutcome): CallToolResult {
    if (!outcome.ok) return { content: [{ type: 'text', text: outcome.message }], isError: true }
    if (outcome.value === undefined) return { content: [{ type: 'text', text: 'Done.' }] }
    // What the serializer wrote, so a date or a value object reads the same as text and as structured content.
    const written: unknown = JSON.parse(outcome.json)
    return { content: [{ type: 'text', text: outcome.json }], structuredContent: isObject(written) ? written : { result: written } }
}

async function idOf(request: Request): Promise<unknown> {
    try {
        const body: unknown = await request.json()
        return isObject(body) && (typeof body['id'] === 'string' || typeof body['id'] === 'number') ? body['id'] : null
    } catch {
        return null
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
