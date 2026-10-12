import { describe, expect, it } from 'vitest'

import { serveTheConference } from '../examples/conference-server.js'

describe('the canonical server', () => {
    it('serves the web of the application with the host, and stops with it', async () => {
        expect(await serveTheConference()).toBe('hello from the conference')
    })
})
