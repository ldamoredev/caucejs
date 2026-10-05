// The timers belong to the runtime, not to the language, and this package builds without the types of any
// runtime. Every runtime Cauce targets has them, so they are declared here and not in the global scope.
declare const setTimeout: (callback: () => void, milliseconds: number) => unknown
declare const clearTimeout: (timer: unknown) => void

/** Resolves or rejects as `work` does, or rejects with what `onTimeout` builds once `milliseconds` pass. */
export async function within<T>(work: Promise<T>, milliseconds: number, onTimeout: () => Error): Promise<T> {
    let timer: unknown
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), milliseconds)
    })
    try {
        return await Promise.race([work, timeout])
    } finally {
        clearTimeout(timer)
    }
}
