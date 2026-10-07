import { describe, expect, it } from 'vitest'

import { readTheBoxOffice } from '../examples/conference-requests.js'

describe('the canonical requests', () => {
    it('read a body into the class, refuse a wrong one field by field, and describe it for a model', async () => {
        expect(await readTheBoxOffice()).toEqual([
            '2 seats of opening at "10.50"',
            'talk: Too small: expected string to have >=1 characters',
            'seats: Too small: expected number to be >0',
            'price: Use a dot for the decimals',
            'the request: Unrecognized key: "vip"',
            'a model is told: Sells seats of a talk, with talk, seats, price',
        ])
    })
})
