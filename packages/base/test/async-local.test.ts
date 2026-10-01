import { describe, expect, it } from 'vitest'

import { AsyncLocal, MissingAsyncLocalError } from '../src/index.js'

describe('getting the value of an async local', () => {
    it('returns the value of the run around it', () => {
        const local = new StackAsyncLocal<string>('attendee')

        const value = local.run('ada', () => local.get())

        expect(value).toBe('ada')
    })

    it('throws outside of a run, naming the local', () => {
        const local = new StackAsyncLocal<string>('attendee')

        expect(() => local.get()).toThrow(MissingAsyncLocalError)
        expect(() => local.get()).toThrow('attendee has no value here: read it inside a run() that sets it')
    })
})

/** Synchronous only: enough to test what AsyncLocal does on top of run and find. */
class StackAsyncLocal<T extends NonNullable<unknown>> extends AsyncLocal<T> {
    readonly #values: T[] = []

    run<R>(value: T, callback: () => R): R {
        this.#values.push(value)
        try {
            return callback()
        } finally {
            this.#values.pop()
        }
    }

    find(): T | null {
        return this.#values.at(-1) ?? null
    }
}
