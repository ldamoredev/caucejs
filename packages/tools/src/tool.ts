import { Query, type Request } from '@caucejs/application'
import { InvalidArgumentError, type StandardJSONSchemaV1, type StandardSchemaV1 } from '@caucejs/base'

/**
 * A class of request that can be a tool: its `schema` reads it and says what it takes as JSON Schema, as the
 * requests declared with `Command.from` or `Query.returning<R>().from` do with Zod.
 */
export type ToolRequestClass = (abstract new (...args: never[]) => Request<unknown>) & {
    readonly schema: StandardSchemaV1<unknown, Request<unknown>> & StandardJSONSchemaV1
}

export type ToolOptions = {
    /** What the tool is called: 1 to 128 letters, digits, underscores and hyphens, such as `get_talk`. */
    readonly name: string
    /** What the model, or whoever lists the tools, reads to decide when to call it. */
    readonly description: string
    /** Whether calling it changes nothing. A `Query` is read only and a `Command` is not, unless this says otherwise. */
    readonly readOnly?: boolean
}

/** A use case described as a tool, once, for whoever exposes it: a server of MCP, or a model of `ai`. */
export type UseCaseTool = {
    readonly request: ToolRequestClass
    readonly name: string
    readonly description: string
    readonly readOnly: boolean
}

const names = /^[a-zA-Z0-9_-]{1,128}$/

/**
 * Describes a use case as a tool: `tool(GetTalk, { name: 'get_talk', description: 'A talk of the conference, by its
 * id' })`. The tool is a value, usually a constant next to its request; it runs through `ToolRunner`.
 *
 * Throws `InvalidArgumentError` for a name that is not 1 to 128 letters, digits, underscores and hyphens, which is
 * what the API of Anthropic takes.
 */
export function tool(request: ToolRequestClass, options: ToolOptions): UseCaseTool {
    if (!names.test(options.name)) {
        throw new InvalidArgumentError(
            'name',
            `The name of a tool is 1 to 128 letters, digits, underscores and hyphens, and "${options.name}" is not`,
        )
    }
    return {
        request,
        name: options.name,
        description: options.description,
        readOnly: options.readOnly ?? request.prototype instanceof Query,
    }
}
