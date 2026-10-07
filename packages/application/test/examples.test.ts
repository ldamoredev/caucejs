import { describe, expect, it } from 'vitest'

import { runTheBoxOffice } from '../examples/conference-use-cases.js'

describe('the canonical use cases', () => {
    it('run each request through the middlewares, in the order they were written', async () => {
        expect(await runTheBoxOffice()).toEqual([
            'anonymous runs GetTalk',
            'box office runs SellTicket',
            'anonymous runs SellTicket',
            'SellTicket failed: NotAuthenticatedError',
            'Opening: 1 seat left',
        ])
    })
})
