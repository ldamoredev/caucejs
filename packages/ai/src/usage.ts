/**
 * The tokens one call spent. `inputTokens` is the whole input; `cacheReadTokens` and `cacheWriteTokens` are parts of
 * it, not more on top. `null` means unknown: a call that got no answer may still have been charged.
 */
export type Usage = {
    readonly inputTokens: number | null
    readonly outputTokens: number | null
    readonly cacheReadTokens: number | null
    readonly cacheWriteTokens: number | null
}

/** The usage of a call that got no readable answer. */
export const unknownUsage: Usage = { inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null }
