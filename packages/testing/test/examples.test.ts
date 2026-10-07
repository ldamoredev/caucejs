import { describe, expect, it } from 'vitest'

import { testTheConference } from '../examples/conference-tests.js'

describe('the canonical test support', () => {
    it('builds the scenario, saves the children after their talk, and calls the application in memory', async () => {
        const [shown, created] = await testTheConference()

        expect(JSON.parse(shown ?? '')).toMatchObject({ title: 'Opening', keynote: true, tickets: 2 })
        expect(created).toBe('{"id":"talk-closing"}')
    })
})
