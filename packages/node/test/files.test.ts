import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { Config, ConfigError, environment, InvalidSettingsError, settings, type StandardSchemaV1 } from '@caucejs/config'
import { dotenvFile, jsonFile } from '../src/index.js'

const folder = mkdtempSync(join(tmpdir(), 'cauce-config-'))
afterAll(() => rmSync(folder, { recursive: true, force: true }))

describe('a JSON file', () => {
    it('is read as a source named by its path', () => {
        const path = file('settings.json', '{ "venue": { "city": "Rosario" } }')

        const venue = new Config().add(jsonFile(path)).bind(VenueSettings)

        expect(venue.city).toBe('Rosario')
    })

    it('that is missing is an error, unless it is optional', () => {
        const path = join(folder, 'missing.json')

        expect(() => jsonFile(path)).toThrow(new ConfigError(`${path} does not exist`))
        expect(jsonFile(path, { optional: true }).entries).toEqual([])
    })

    it('that is not JSON is an error that names it', () => {
        const path = file('broken.json', '{ "venue": ')

        expect(() => jsonFile(path)).toThrow(new ConfigError(`${path} is not valid JSON`))
    })
})

describe('a .env file', () => {
    it('is read like the environment, and the environment that is really set wins', () => {
        const path = file('.env', 'VENUE__CITY=Rosario\n# a comment\nVENUE__ROOM="Main hall"\n')

        const config = new Config().add(dotenvFile(path)).add(environment({ VENUE__CITY: 'Córdoba' }))

        expect(config.bind(VenueSettings)).toEqual(expect.objectContaining({ city: 'Córdoba', room: 'Main hall' }))
    })

    it('does not touch process.env', () => {
        const path = file('untouched.env', 'CAUCE_TEST_UNTOUCHED=yes\n')

        dotenvFile(path)

        expect(process.env.CAUCE_TEST_UNTOUCHED).toBeUndefined()
    })

    it('is named in the errors by its path and the variable', () => {
        const path = file('empty-city.env', 'VENUE__CITY=\n')

        expect(() => new Config().add(dotenvFile(path)).bind(VenueSettings)).toThrow(
            new InvalidSettingsError('venue', [`venue.city: Expected a city (set by ${path}, VENUE__CITY)`]),
        )
    })

    it('that is missing is an error, unless it is optional', () => {
        const path = join(folder, 'missing.env')

        expect(() => dotenvFile(path)).toThrow(ConfigError)
        expect(dotenvFile(path, { optional: true }).entries).toEqual([])
    })
})

function file(name: string, content: string): string {
    const path = join(folder, name)
    writeFileSync(path, content)
    return path
}

// A hand-written Standard Schema: the venue needs a city that is not empty, and may name a room.
const venueSchema: StandardSchemaV1<unknown, { city: string; room?: string }> = {
    '~standard': {
        version: 1,
        vendor: 'test',
        validate(input) {
            const { city, room } = (input ?? {}) as { city?: unknown; room?: unknown }
            if (typeof city !== 'string' || city === '') return { issues: [{ message: 'Expected a city', path: ['city'] }] }
            return { value: typeof room === 'string' ? { city, room } : { city } }
        },
    },
}

class VenueSettings extends settings('venue', venueSchema) {}
