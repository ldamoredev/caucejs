/**
 * Why the model stopped. None of them is an error: a refusal or a full context window is an answer the application
 * reads. An answer that cannot be used as it is throws `IncompleteResponseError` instead.
 */
export const StopReasons = {
    /** The model finished its turn. */
    EndTurn: 'endTurn',
    /** The answer reached `maxTokens`, and its text is cut. */
    MaxTokens: 'maxTokens',
    /** The model wrote one of the stop sequences. */
    StopSequence: 'stopSequence',
    /** The model asks for tools to run, and waits for their results. */
    ToolUse: 'toolUse',
    /** The model declined to answer. */
    Refusal: 'refusal',
    /** The conversation filled the context window of the model. */
    ContextWindowExceeded: 'contextWindowExceeded',
} as const

export type StopReason = (typeof StopReasons)[keyof typeof StopReasons]
