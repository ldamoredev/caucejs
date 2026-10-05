import { describe, expect, it } from 'vitest'

import { holdConference } from '../examples/conference-host.js'

describe('the canonical host', () => {
    it('binds the configuration, starts, and stops when the lifetime asks', async () => {
        expect(await holdConference()).toEqual(['doors open at 09:00', 'doors closed'])
    })
})
