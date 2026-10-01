import { AsyncLocalStorage } from 'node:async_hooks'

import { AsyncLocal } from '@caucejs/base'

/** An {@link AsyncLocal} on Node's `AsyncLocalStorage`, which Bun and Deno implement too. */
export class NodeAsyncLocal<T extends NonNullable<unknown>> extends AsyncLocal<T> {
    readonly #storage = new AsyncLocalStorage<T>()

    run<R>(value: T, callback: () => R): R {
        return this.#storage.run(value, callback)
    }

    find(): T | null {
        return this.#storage.getStore() ?? null
    }
}
