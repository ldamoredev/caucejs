import { InvalidArgumentError } from '@caucejs/base'

/**
 * Realistic values for a builder's defaults, handed out in turn: `one()` gives the next one and starts over
 * after the last. There is no randomness, so two runs build the same data.
 *
 * Each instance counts on its own. Which value a test gets still depends on how many were asked for before
 * it, so a test never asserts on a value it did not choose: it passes the one it is about.
 */
export class Examples<T> {
    readonly #values: readonly T[]
    #next = 0

    constructor(...values: T[]) {
        if (values.length === 0) throw new InvalidArgumentError('values', 'Examples need at least one value')
        this.#values = values
    }

    one(): T {
        const value = this.#values[this.#next % this.#values.length] as T
        this.#next++
        return value
    }
}
