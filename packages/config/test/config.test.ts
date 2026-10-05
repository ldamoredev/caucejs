import { describe, expect, it } from 'vitest'

import { Config, ConfigError, environment, InvalidSettingsError, json, memory, settings } from '../src/index.js'
import { asynchronous, atLeast, integer, object, optional, rejected, text } from './support/schema.js'

describe('the layers', () => {
    it('take each key from the last source that sets it', () => {
        const config = new Config()
            .add(memory({ venue: { city: 'Rosario', capacity: 300 } }))
            .add(environment({ VENUE__CAPACITY: '450' }))

        const venue = config.bind(VenueSettings)

        expect(venue.city).toBe('Rosario')
        expect(venue.capacity).toBe(450)
    })

    it('read every value as text, so a number from JSON passes the same schema as one from the environment', () => {
        const fromJson = new Config().add(json({ venue: { city: 'Rosario', capacity: 300 } }))
        const fromEnvironment = new Config().add(environment({ VENUE__CITY: 'Rosario', VENUE__CAPACITY: '300' }))

        expect(fromJson.bind(VenueSettings).capacity).toBe(300)
        expect(fromEnvironment.bind(VenueSettings).capacity).toBe(300)
    })

    it('can be added several at once, in the order given', () => {
        const config = new Config().add(memory({ venue: { city: 'Rosario' } }), memory({ venue: { city: 'Córdoba' } }))

        expect(config.bind(VenueSettings).city).toBe('Córdoba')
    })

    it('let a later null unset a key', () => {
        const config = new Config().add(memory({ venue: { city: 'Rosario', capacity: 300 } })).add(memory({ venue: { capacity: null } }))

        expect(config.bind(VenueSettings).capacity).toBe(100)
    })

    it('let a later value replace a whole section, and a later section replace a value', () => {
        const replacedBySection = new Config().add(memory({ venue: 'Rosario' })).add(memory({ venue: { city: 'Córdoba' } }))
        const replacedByValue = new Config().add(memory({ venue: { city: 'Córdoba' } })).add(memory({ venue: 'Rosario' }))

        expect(replacedBySection.bind(VenueSettings).city).toBe('Córdoba')
        expect(() => replacedByValue.bind(VenueSettings)).toThrow(InvalidSettingsError)
    })

    it('treat a key named __proto__ as one more key', () => {
        const config = new Config().add(json(JSON.parse('{"venue":{"__proto__":{"city":"Hacked"},"city":"Rosario"}}')))

        expect(config.bind(VenueSettings).city).toBe('Rosario')
        expect(Object.prototype).not.toHaveProperty('city')
    })
})

describe('binding a section', () => {
    it('returns an instance of the settings class with what the schema returned', () => {
        const venue = new Config().add(memory({ venue: { city: 'Rosario' } })).bind(VenueSettings)

        expect(venue).toBeInstanceOf(VenueSettings)
        expect(venue).toEqual(expect.objectContaining({ city: 'Rosario', capacity: 100 }))
    })

    it('reads a section below another one, and the root', () => {
        const config = new Config().add(memory({ port: '3000', conference: { venue: { city: 'Rosario' } } }))

        expect(config.bind(NestedVenueSettings).city).toBe('Rosario')
        expect(config.bind(ServerSettings).port).toBe(3000)
    })

    it('validates a section that is not there as an empty object, so the error says what is missing', () => {
        const bind = () => new Config().bind(VenueSettings)

        expect(bind).toThrow(new InvalidSettingsError('venue', ['venue.city: Expected a text (not set)']))
    })

    it('lists every problem, with the source that set each value', () => {
        const config = new Config()
            .add(json({ venue: { capacity: 'many' } }, { name: 'settings.json' }))
            .add(environment({ VENUE__CAPACITY: 'plenty' }))

        const error = catchError(() => config.bind(VenueSettings))

        expect(error).toBeInstanceOf(InvalidSettingsError)
        expect(error.message).toBe(
            'The settings of venue are wrong:\n' +
                '- venue.city: Expected a text (not set)\n' +
                '- venue.capacity: Expected an integer, received [hidden] (set by the environment, VENUE__CAPACITY)',
        )
    })

    it('never shows the value, which can be a secret', () => {
        const config = new Config().add(environment({ SECRET_KEY: 'correct-horse-battery' }, { name: '.env' }))

        const error = catchError(() => config.bind(SecretSettings))

        expect(error.message).toBe(
            'The settings of the root are wrong:\n' +
                '- secretKey: Expected at least 32 characters, received [hidden] (set by .env, SECRET_KEY)',
        )
        expect(error.message).not.toContain('correct-horse-battery')
    })

    it('cuts the value out of the message even when the validator does not quote it', () => {
        const config = new Config().add(memory({ token: 'ghp-secret-token' }))

        const error = catchError(() => config.bind(TokenSettings))

        expect(error.message).toBe('The settings of the root are wrong:\n- token: Rejected [hidden] (set by memory)')
    })

    it('refuses an asynchronous schema, because composing does not wait', () => {
        class Ready extends settings('ready', asynchronous()) {}

        expect(() => new Config().bind(Ready)).toThrow(
            new ConfigError('The schema of ready is asynchronous, and settings are bound while the application is composed'),
        )
    })
})

describe('a source of objects', () => {
    it('refuses an array, which is not supported yet', () => {
        expect(() => json({ venue: { rooms: ['A', 'B'] } }, { name: 'settings.json' })).toThrow(
            new ConfigError('settings.json has an array at venue.rooms, and arrays are not supported'),
        )
    })

    it('refuses a document that is not an object', () => {
        expect(() => json([1, 2], { name: 'settings.json' })).toThrow(new ConfigError('settings.json has to hold an object, not an array'))
    })
})

class VenueSettings extends settings('venue', object({ city: text(), capacity: optional(integer(), 100) })) {}

class NestedVenueSettings extends settings('conference.venue', object({ city: text() })) {}

class ServerSettings extends settings('', object({ port: integer() })) {}

class TokenSettings extends settings('', object({ token: rejected() })) {}

class SecretSettings extends settings('', object({ secretKey: atLeast(32) })) {}

function catchError(run: () => unknown): Error {
    try {
        run()
    } catch (error) {
        if (error instanceof Error) return error
    }
    throw new Error('It did not throw')
}
