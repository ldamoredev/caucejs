import { Services, type Provider, type Resolver } from '@caucejs/di'
import { beforeEach, describe, expect, it } from 'vitest'

import { Scenario, type Example } from '../src/index.js'

describe('a scenario', () => {
    describe('adding', () => {
        it('builds the example and returns what it built', async () => {
            const talk = await scenario.add(note('opening'))

            expect(talk).toBe('opening')
        })

        it('saves what it built', async () => {
            await scenario.add(note('opening'))

            expect(saved()).toEqual(['opening'])
        })

        it('waits for a save that is asynchronous', async () => {
            await scenario.add(note('opening', { later: true }))

            expect(saved()).toEqual(['opening'])
        })

        it('saves the parent first and then its children, in the order they were declared', async () => {
            await scenario.add(note('talk', { children: [note('ticket 1'), note('ticket 2', { children: [note('seat')] })] }))

            expect(saved()).toEqual(['talk', 'ticket 1', 'ticket 2', 'seat'])
        })

        it('saves the children only once the parent finished saving', async () => {
            await scenario.add(note('talk', { later: true, children: [note('ticket')] }))

            expect(saved()).toEqual(['talk', 'ticket'])
        })

        it('saves each example once', async () => {
            await scenario.add(note('talk', { children: [note('ticket')] }))
            await scenario.add(note('closing'))

            expect(saved()).toEqual(['talk', 'ticket', 'closing'])
        })

        it('builds an example that saves nothing', async () => {
            const built = await scenario.add({ build: () => 'unsaved' })

            expect(built).toBe('unsaved')
            expect(saved()).toEqual([])
        })

        it('gives the example the services of the container', async () => {
            const built = await scenario.add({ build: context => context.get(Venue).name })

            expect(built).toBe('Main hall')
        })
    })

    describe('making', () => {
        it('builds the example and its children without saving any', () => {
            const built = scenario.make(note('talk', { children: [note('ticket')] }))

            expect(built).toBe('talk')
            expect(saved()).toEqual([])
        })
    })

    function note(value: string, options: { later?: boolean; children?: Example<string>[] } = {}): Example<string> {
        return {
            build: context => {
                for (const child of options.children ?? []) context.child(child)
                return value
            },
            save: async (resolver: Resolver, built) => {
                if (options.later) await Promise.resolve()
                resolver.get(Journal).saved.push(built)
            },
        }
    }

    function saved(): string[] {
        return provider.get(Journal).saved
    }

    beforeEach(() => {
        provider = new Services().addSingleton(Journal, Journal).addSingleton(Venue, Venue).build({ validate: true })
        scenario = new Scenario(provider)
    })

    let provider: Provider
    let scenario: Scenario
})

class Journal {
    readonly saved: string[] = []
}

class Venue {
    readonly name = 'Main hall'
}
