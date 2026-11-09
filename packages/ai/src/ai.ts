import type { ExecutionContext } from '@caucejs/application'
import type { UseCaseTool } from '@caucejs/tools'

import type { AssistantMessage, Message, ToolResultBlock } from './messages.js'
import type { StopReason } from './stop-reason.js'
import type { Usage } from './usage.js'

type RunRequest = {
    /** Which model answers, such as `claude-haiku-5-5`. The application picks it: Cauce keeps no catalog. */
    readonly model: string
    /** The instructions of the application, apart from the conversation. */
    readonly system?: string
    /** The conversation so far, starting with the user. */
    readonly messages: readonly Message[]
    /** The most tokens each answer can take. 1024 when it is not given. */
    readonly maxTokens?: number
    /** The most calls to the model, 10 when it is not given. A whole number, 1 or more. */
    readonly maxSteps?: number
}

/**
 * What a run is asked for. **A run with tools takes the `context` of whoever asks**, and the compiler refuses it
 * without one: the tools run as them, through every middleware.
 */
export type RunOptions = RunRequest &
    (
        | {
              /** The use cases the model may call, described as tools. */
              readonly tools: readonly UseCaseTool[]
              /** Who asks: the context the use case that calls `run` received. */
              readonly context: ExecutionContext
          }
        | { readonly tools?: never; readonly context?: ExecutionContext }
    )

/** One call to the model in a run, and what the tools it asked for answered, in the order it asked. */
export type Step = {
    readonly message: AssistantMessage
    /** What each tool answered, as the model read it. Empty in the last step. */
    readonly results: readonly ToolResultBlock[]
    readonly stopReason: StopReason
    readonly usage: Usage
    readonly model: string
}

/** What a run answered: the text of the last message, why it stopped, each step, and what it all cost in tokens. */
export type RunResult = {
    /** The text of the last message, its blocks joined. */
    readonly text: string
    /** Why the last step stopped. A refusal or `maxTokens` is an answer the application reads. */
    readonly stopReason: StopReason
    readonly steps: readonly Step[]
    /** The usage of every step, added. A field is `null` when one of the steps does not know it. */
    readonly usage: Usage
    /** The model that answered the last step, as the provider names it. */
    readonly model: string
}

/**
 * Runs a model with the tools of the application: calls it, runs the tools it asks for in the scope of the use case
 * that asked, gives it their results, and calls it again until it answers without tools. Added by `ai()`, one for
 * each scope.
 */
export abstract class Ai {
    /**
     * Each step is one call to the model, paid on its own. The tools of a step run one after the other, in the order
     * the model asked, through every middleware and as the `context` given.
     *
     * - **A tool that fails goes back to the model** as a result with `isError`, with the message `ToolRunner` gives,
     *   and so does a tool the model names and the run does not have, with the names of the ones it has.
     * - **`NotAuthenticatedError` ends the run**, as it is: nobody was there to answer for.
     * - **Past `maxSteps`** it throws `MaxStepsExceededError`, and the tools of that last step do not run.
     * - **A call that fails** throws the same `ModelError`, with the usage the provider reported in the whole run.
     *
     * Throws `InvalidArgumentError` before calling anything for tools without a context, two tools with one name, or a
     * `maxSteps` that is not a whole number above 0.
     */
    abstract run(options: RunOptions): Promise<RunResult>
}
