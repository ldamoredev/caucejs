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

/** The usage of several calls, field by field. A field is `null` when any of them does not know it. */
export function totalOf(usages: readonly Usage[]): Usage {
    const sum = (field: keyof Usage) =>
        usages.reduce<number | null>((total, usage) => (total === null || usage[field] === null ? null : total + usage[field]), 0)
    return { inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens'), cacheReadTokens: sum('cacheReadTokens'), cacheWriteTokens: sum('cacheWriteTokens') }
}

/** Whether a call said anything of what it spent. */
export function isReported(usage: Usage): boolean {
    return Object.values(usage).some(tokens => tokens !== null)
}
