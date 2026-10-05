import { describe, expect, it } from 'vitest'

import { Services } from '@caucejs/di'
import { Config, InvalidSettingsError, memory, settings } from '../src/index.js'
import { integer, object, text } from './support/schema.js'

describe('settings in the container', () => {
    it('are injected like any other service', () => {
        const config = new Config().add(memory({ venue: { city: 'Rosario', capacity: 300 } }))

        const provider = new Services()
            .addInstance(VenueSettings, config.bind(VenueSettings))
            .addSingleton(Seats, Seats)
            .build({ validate: true })

        expect(provider.get(Seats).left(120)).toBe(180)
    })

    it('fail before the container is built when a value is wrong', () => {
        const config = new Config().add(memory({ venue: { city: 'Rosario', capacity: 'many' } }))

        expect(() => new Services().addInstance(VenueSettings, config.bind(VenueSettings))).toThrow(InvalidSettingsError)
    })
})

class VenueSettings extends settings('venue', object({ city: text(), capacity: integer() })) {}

class Seats {
    static readonly inject = [VenueSettings] as const
    readonly #venue: VenueSettings

    constructor(venue: VenueSettings) {
        this.#venue = venue
    }

    left(sold: number): number {
        return this.#venue.capacity - sold
    }
}
