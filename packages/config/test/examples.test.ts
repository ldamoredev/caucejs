import { describe, expect, it } from 'vitest'

import { InvalidSettingsError } from '../src/index.js'
import { openBoxOffice } from '../examples/ticketing-settings.js'

describe('the canonical settings', () => {
    it('take the defaults, overridden by the environment', () => {
        expect(openBoxOffice({}).seatsLeft(50)).toBe(250)
        expect(openBoxOffice({ TICKETING__CAPACITY: '450' }).seatsLeft(50)).toBe(400)
    })

    it('fail while composing when a value is wrong', () => {
        expect(() => openBoxOffice({ TICKETING__CAPACITY: 'lots' })).toThrow(
            new InvalidSettingsError('ticketing', [
                'ticketing.capacity: Expected a number of seats (set by the environment, TICKETING__CAPACITY)',
            ]),
        )
    })
})
