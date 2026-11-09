import type { AssistantMessage, Message } from './messages.js'
import type { StopReason } from './stop-reason.js'
import type { Usage } from './usage.js'

/**
 * A tool, as the model is told about it. These are the first three fields of the `ToolDescription` of
 * `@caucejs/tools`, with the same names and types, so one is passed as it is. `inputSchema` is a JSON Schema of an
 * object, `$schema` included or not.
 */
export type ModelTool = { readonly name: string; readonly description: string; readonly inputSchema: Record<string, unknown> }

export type ModelRequest = {
    /** Which model answers, such as `claude-haiku-5-5`. The application picks it: Cauce keeps no catalog. */
    readonly model: string
    readonly system?: string
    readonly messages: readonly Message[]
    readonly tools?: readonly ModelTool[]
    /** The most tokens the answer can take. 1024 when it is not given. */
    readonly maxTokens?: number
}

export type ModelResponse = {
    readonly message: AssistantMessage
    readonly stopReason: StopReason
    readonly usage: Usage
    /** The model that answered, as the provider names it. */
    readonly model: string
}

/**
 * One call to a model: the conversation so far in, the next message out. It runs no tools and keeps no state, so each
 * call is paid once and can be read on its own. `AnthropicModel` is the one that calls.
 *
 * It throws a `ModelError` when there is no answer to use, and never retries: a retry is paid again.
 */
export abstract class Model {
    abstract call(request: ModelRequest): Promise<ModelResponse>
}
