import type { ExecuteOptions } from '@caucejs/application'

import type { UseCaseTool } from './tool.js'

/**
 * What a model, or a client of MCP, is told about a tool. `inputSchema` is what `JsonSerializer.schemaOf` returns for
 * the input of the request, `$schema` included: whoever talks to a provider that refuses it takes it out.
 */
export type ToolDescription = {
    readonly name: string
    readonly description: string
    readonly inputSchema: Record<string, unknown>
    readonly readOnly: boolean
}

/**
 * What a call to a tool answers. It succeeds with the result of the use case, as a value and as the JSON text the
 * serializer writes, `'null'` for a use case that answers nothing. It fails with the message whoever called it reads,
 * and the error that was thrown, for the application to log.
 */
export type ToolOutcome =
    | { readonly ok: true; readonly value: unknown; readonly json: string }
    | { readonly ok: false; readonly message: string; readonly error: unknown }

/**
 * Describes tools and calls them, for the module that exposes them. Added by `tools()`. A test replaces it like any
 * service.
 */
export abstract class ToolRunner {
    /**
     * What the tool is described as. It is worked out on every call and kept nowhere: whoever lists the tools often
     * keeps the descriptions. Throws `JsonSchemaUnavailableError` for a request whose input cannot be said in JSON
     * Schema.
     */
    abstract describe(tool: UseCaseTool): ToolDescription

    /**
     * Reads the input with the `JsonSerializer` and executes the request through every middleware, in the scope and
     * as the context given. **It returns what failed instead of throwing it**, because whoever called the tool has to
     * read why:
     *
     * - an input that does not pass: the message of the `ValidationError`, with every issue;
     * - a `DomainError` or a `ForbiddenError`: its message, or its name when the message is empty;
     * - anything else: `Tool execution failed`, which says nothing of the cause.
     *
     * Throws only `NotAuthenticatedError`: nobody was there to read the answer.
     */
    abstract call(tool: UseCaseTool, input: unknown, options: ExecuteOptions): Promise<ToolOutcome>
}
