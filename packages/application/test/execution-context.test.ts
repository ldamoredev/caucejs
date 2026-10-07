import { describe, expect, it } from 'vitest'

import { AnonymousIdentity, ContextKey, ContextValueMissingError, ExecutionContext, SystemIdentity } from '../src/index.js'

describe('an execution context', () => {
    it('is anonymous unless it is made with an identity', () => {
        expect(ExecutionContext.anonymous().identity).toBeInstanceOf(AnonymousIdentity)
        expect(ExecutionContext.of(new SystemIdentity()).identity).toBeInstanceOf(SystemIdentity)
    })

    it('carries a value under its key', () => {
        expect(ExecutionContext.anonymous().with(track, 'web').get(track)).toBe('web')
    })

    it('does not change when a value is added: it returns another one', () => {
        const context = ExecutionContext.anonymous()

        context.with(track, 'web')

        expect(context.find(track)).toBeNull()
    })

    it('keeps its values when the identity changes', () => {
        const context = ExecutionContext.anonymous().with(track, 'web').withIdentity(new SystemIdentity())

        expect(context.get(track)).toBe('web')
        expect(context.identity).toBeInstanceOf(SystemIdentity)
    })

    it('keeps its identity when a value is added', () => {
        expect(ExecutionContext.of(new SystemIdentity()).with(track, 'web').identity).toBeInstanceOf(SystemIdentity)
    })

    it('finds nothing for a key it does not have, and fails to get it, naming it', () => {
        const context = ExecutionContext.anonymous()

        expect(context.find(track)).toBeNull()
        expect(() => context.get(track)).toThrow(new ContextValueMissingError('track'))
    })

    it('tells two keys apart even with the same name', () => {
        const other = new ContextKey<string>('track')

        expect(ExecutionContext.anonymous().with(track, 'web').find(other)).toBeNull()
    })

    it('keeps a value that is falsy', () => {
        const count = new ContextKey<number>('count')

        const context = ExecutionContext.anonymous().with(count, 0)

        expect(context.get(count)).toBe(0)
        expect(context.find(count)).toBe(0)
    })
})

describe('the identities of the package', () => {
    it('anonymous is not authenticated and can do nothing', () => {
        const anonymous = new AnonymousIdentity()

        expect([anonymous.name, anonymous.isAuthenticated, anonymous.can('tickets')]).toEqual(['anonymous', false, false])
    })

    it('system is authenticated and can do everything', () => {
        const system = new SystemIdentity()

        expect([system.name, system.isAuthenticated, system.can('tickets')]).toEqual(['system', true, true])
    })
})

const track = new ContextKey<string>('track')
