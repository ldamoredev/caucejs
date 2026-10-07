import type { ContextKey } from './context-key.js'
import { ContextValueMissingError } from './errors/context-value-missing-error.js'
import { AnonymousIdentity, type Identity } from './identity.js'

/**
 * What travels with the execution of a use case: who executes it, and values under typed keys. It never changes;
 * `with` and `withIdentity` return a new one.
 *
 * It carries nothing of HTTP. What a request brings is turned into an identity or a value by the code that receives
 * it, before it executes the use case, so the same use case runs from a job.
 */
export class ExecutionContext {
    readonly identity: Identity
    readonly #values: ReadonlyMap<ContextKey<unknown>, unknown>

    private constructor(identity: Identity, values: ReadonlyMap<ContextKey<unknown>, unknown>) {
        this.identity = identity
        this.#values = values
    }

    static of(identity: Identity): ExecutionContext {
        return new ExecutionContext(identity, new Map())
    }

    static anonymous(): ExecutionContext {
        return ExecutionContext.of(new AnonymousIdentity())
    }

    withIdentity(identity: Identity): ExecutionContext {
        return new ExecutionContext(identity, this.#values)
    }

    with<T>(key: ContextKey<T>, value: T): ExecutionContext {
        return new ExecutionContext(this.identity, new Map(this.#values).set(key, value))
    }

    /** The value under `key`, or `null` when there is none. */
    find<T>(key: ContextKey<T>): T | null {
        return this.#values.has(key) ? (this.#values.get(key) as T) : null
    }

    /** The value under `key`. Throws {@link ContextValueMissingError} when there is none. */
    get<T>(key: ContextKey<T>): T {
        if (!this.#values.has(key)) throw new ContextValueMissingError(key.name)
        return this.#values.get(key) as T
    }
}
