import { describe, expect, it } from 'vitest'

import { CompositionError, Scopes, Services } from '../src/index.js'

describe('scopes', () => {
    it('are provided by the container, without being added', () => {
        const provider = new Services().build({ validate: true })

        expect(provider.get(Scopes)).toBeInstanceOf(Scopes)
    })

    it('open a scope that holds its own scoped services', () => {
        const scopes = new Services().addScoped(Visit, Visit).build().get(Scopes)
        const [first, second] = [scopes.create(), scopes.create()]

        expect(first.get(Visit)).toBe(first.get(Visit))
        expect(first.get(Visit)).not.toBe(second.get(Visit))
    })

    it('are what a class that opens scopes asks for, and the validation knows they are there', () => {
        const provider = new Services().addSingleton(Door, Door).addScoped(Visit, Visit).build({ validate: true })

        expect(provider.get(Door).enter()).toBeInstanceOf(Visit)
    })

    it('are the same from a scope as from the root', () => {
        const provider = new Services().build()

        expect(provider.createScope().get(Scopes)).toBe(provider.get(Scopes))
    })

    it('cannot be added', () => {
        expect(() => new Services().addSingleton(Scopes, () => new Services().build().get(Scopes))).toThrow(
            new CompositionError('Scopes is provided by the container, so it is never added'),
        )
    })

    it('cannot open a scope once the provider is disposed', async () => {
        const provider = new Services().build()
        const scopes = provider.get(Scopes)

        await provider[Symbol.asyncDispose]()

        expect(() => scopes.create()).toThrow(CompositionError)
    })
})

class Visit {}

class Door {
    static readonly inject = [Scopes] as const
    readonly #scopes: Scopes

    constructor(scopes: Scopes) {
        this.#scopes = scopes
    }

    enter(): Visit {
        return this.#scopes.create().get(Visit)
    }
}
