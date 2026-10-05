import { describe, expect, it } from 'vitest'

import type { Token } from '@caucejs/di'
import { Config, memory, settings } from '../src/index.js'
import { integer, object, text } from './support/schema.js'

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export function whatTheCompilerRefuses(config: Config): void {
    const venue = config.bind(VenueSettings)
    // @ts-expect-error a key the schema does not return
    void venue.rooms
    // @ts-expect-error the capacity is a number, as the schema returns it
    const city: string = venue.capacity
    void city
    // @ts-expect-error a class that is not a settings class
    config.bind(Date)
}

describe('the types', () => {
    it('give the bound instance the type the schema returns, and make the class a token', () => {
        const venue = new Config().add(memory({ venue: { city: 'Rosario', capacity: 300 } })).bind(VenueSettings)
        const capacity: number = venue.capacity
        const token: Token<VenueSettings> = VenueSettings

        expect(capacity).toBe(300)
        expect(token).toBe(VenueSettings)
    })
})

class VenueSettings extends settings('venue', object({ city: text(), capacity: integer() })) {}
