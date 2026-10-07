import type { Resolver } from '@caucejs/di'

import type { Example } from './example.js'

type Assembled<T> = { readonly value: T; readonly save: () => Promise<void> }

/**
 * Builds the data a test needs from examples, with the services of a container: in memory for a use case,
 * or the application's own for a test against its storage.
 *
 * It knows no domain. Each example says how it builds and where it saves, so a new aggregate never touches it.
 */
export class Scenario {
    readonly #resolver: Resolver

    constructor(resolver: Resolver) {
        this.#resolver = resolver
    }

    /** Builds the example and saves it with its children, the parent first. Each call saves once. */
    async add<T>(example: Example<T>): Promise<T> {
        const assembled = this.#assemble(example)
        await assembled.save()
        return assembled.value
    }

    /** Builds the example, children included, and saves nothing. */
    make<T>(example: Example<T>): T {
        return this.#assemble(example).value
    }

    #assemble<T>(example: Example<T>): Assembled<T> {
        const children: Assembled<unknown>[] = []
        const value = example.build({
            get: token => this.#resolver.get(token),
            child: child => {
                const assembled = this.#assemble(child)
                children.push(assembled)
                return assembled.value
            },
        })
        return {
            value,
            save: async () => {
                await example.save?.(this.#resolver, value)
                for (const child of children) await child.save()
            },
        }
    }
}
