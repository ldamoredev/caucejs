import type { UseCases } from '@caucejs/application'
import { InvalidArgumentError } from '@caucejs/base'
import { CompositionError } from '@caucejs/di'
import type { ToolRunner } from '@caucejs/tools'
import { Controller, type Authenticator, type Routes } from '@caucejs/web'

import { Endpoint } from './endpoint.js'
import { McpTools } from './mcp-tools.js'
import { notFound } from './responses.js'

export type McpOptions = {
    /**
     * Where the endpoint is served, such as `/mcp`. It may name parameters, such as `/mcp/:token` for an authenticator
     * that reads the token from the URL; it does not end with a slash nor use `*`.
     */
    readonly path: string
    /** What the server calls itself to its clients. */
    readonly name: string
    /** The version of the server, as its clients read it. */
    readonly version: string
    /**
     * Who calls the endpoint, from the request: usually a token in the `authorization` header. It is the endpoint's
     * own, not the one of the application, so a session cookie does not open the endpoint and its token opens no page.
     */
    readonly authenticator: Authenticator
    /** Lets in a caller the authenticator does not know. Closed by default: such a caller gets a 401. */
    readonly anonymous?: boolean
    /** Lets in only a caller that can do at least one of these; any other gets a 403. Not with `anonymous`. */
    readonly permissions?: readonly string[]
}

/**
 * A server of MCP, as a controller of `web`: the tools of the application over HTTP, on the official SDK, without
 * state and answered with JSON. The application extends it, passes its options to the constructor, declares its tools
 * in `registerTools`, and adds it with `app.web.controller(...)`.
 *
 * Each request runs in the scope `web` opens for it, as the identity the endpoint's authenticator gives, and every tool
 * runs through `ToolRunner`, so through every middleware of the use cases. A caller the endpoint does not let in gets a
 * 401 with `WWW-Authenticate: Bearer`, or a 403, before anything of MCP is read; the endpoint answers them itself, and
 * the 404 of the paths where a client looks for OAuth, so the `ProblemResponder` of the application never sees them.
 *
 * The tools are checked and described when the controller registers its routes, which is when the container builds
 * `Web`: `start()` before it listens, or the first `fetch` in memory. A tool without a handler fails there with
 * `CompositionError`, and one whose input cannot be said in JSON Schema with `JsonSchemaUnavailableError`.
 */
export abstract class McpController extends Controller {
    readonly #runner: ToolRunner
    readonly #useCases: UseCases
    readonly #options: McpOptions

    /** Throws `InvalidArgumentError` for a path that ends with a slash or uses `*`, and for `anonymous` with `permissions`. */
    constructor(runner: ToolRunner, useCases: UseCases, options: McpOptions) {
        super()
        if (!options.path.startsWith('/') || options.path.endsWith('/') || options.path.includes('*')) {
            throw new InvalidArgumentError(
                'path',
                `The path of a server of MCP starts with a slash, does not end with one and does not use *, and "${options.path}" does not`,
            )
        }
        if (options.anonymous === true && options.permissions !== undefined) {
            throw new InvalidArgumentError('permissions', 'A server of MCP that lets in anybody has no permissions to ask for')
        }
        if (options.permissions?.length === 0) {
            throw new InvalidArgumentError('permissions', 'The permissions of a server of MCP name at least one')
        }
        this.#runner = runner
        this.#useCases = useCases
        this.#options = options
    }

    /** The tools the server exposes: `tools.add(getTalk)`. */
    abstract registerTools(tools: McpTools): void

    /** Not overridden: the routes are the endpoint, and the paths where a client looks for OAuth. */
    registerRoutes(routes: Routes): void {
        const tools = new McpTools()
        this.registerTools(tools)
        const added = tools.build()
        for (const tool of added) {
            if (!this.#useCases.handles(tool.request)) {
                throw new CompositionError(`The tool ${tool.name} runs ${tool.request.name}, which has no handler`)
            }
        }
        const { path, name, version, authenticator } = this.#options
        const endpoint = new Endpoint(this.#runner, added, {
            name,
            version,
            authenticator,
            anonymous: this.#options.anonymous ?? false,
            permissions: this.#options.permissions ?? [],
        })
        routes.post(path, c => endpoint.serve(c.req.raw, c.get('cauce')))
        routes.get(path, c => endpoint.serve(c.req.raw, c.get('cauce')))
        routes.delete(path, c => endpoint.serve(c.req.raw, c.get('cauce')))
        for (const wellKnown of wellKnownsOf(path)) routes.get(wellKnown, () => notFound())
    }
}

// Where a client starts OAuth when a server answers 401: the metadata of the protected resource (RFC 9728), at the
// root and with the path of the endpoint, and the metadata of an authorization server (RFC 8414 and OpenID).
function wellKnownsOf(path: string): readonly string[] {
    return [
        '/.well-known/oauth-protected-resource',
        `/.well-known/oauth-protected-resource${path}`,
        '/.well-known/oauth-authorization-server',
        '/.well-known/openid-configuration',
    ]
}
