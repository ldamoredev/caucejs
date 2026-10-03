import { MissingAsyncLocalError } from './errors/missing-async-local-error.js'

/**
 * A value that travels with asynchronous work: set by `run()`, and read anywhere below it, across
 * every `await`, without being passed by hand. It holds what belongs to one request, such as its
 * scope, its transaction or its identity.
 *
 * The value cannot be `null` or `undefined`: `null` is how {@link find} says there is none.
 *
 * This is the contract only. How a value travels depends on the runtime, so the implementation lives
 * in an adapter: `NodeAsyncLocal`, in `@caucejs/node`.
 */
export abstract class AsyncLocal<T extends NonNullable<unknown>> {
    /** Names the value in error messages. */
    readonly name: string

    constructor(name: string) {
        this.name = name
    }

    /**
     * Runs `callback` with `value` set, and returns what it returns. Work started inside sees the
     * value even after `run()` returned; a nested `run()` shadows it until it ends.
     */
    abstract run<R>(value: T, callback: () => R): R

    /** The value set by the closest `run()`, or `null` outside of one. */
    abstract find(): T | null

    /** The value set by the closest `run()`. Throws {@link MissingAsyncLocalError} outside of one. */
    get(): T {
        const value = this.find()
        if (value === null) throw new MissingAsyncLocalError(this.name)
        return value
    }
}
