import { describe, expect, it } from 'vitest'

import { sellOneTicket } from '../examples/ticketing.js'

describe('the canonical extension', () => {
    it('composes and sells a ticket', async () => {
        expect(await sellOneTicket()).toBe(1)
    })
})
