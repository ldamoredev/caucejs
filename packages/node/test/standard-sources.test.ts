import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { Config, settings, type StandardSchemaV1 } from '@caucejs/config'
import { HostEnvironment } from '@caucejs/hosting'
import { standardSources } from '../src/index.js'

const folder = mkdtempSync(join(tmpdir(), 'cauce-standard-'))
afterAll(() => rmSync(folder, { recursive: true, force: true }))

describe('the standard sources', () => {
    it('stack settings.json, the one of the environment, .env and the process, in that order', () => {
        writeFileSync(join(folder, 'settings.json'), '{ "venue": { "city": "Rosario", "room": "A", "hall": "1" } }')
        writeFileSync(join(folder, 'settings.staging.json'), '{ "venue": { "room": "B", "hall": "2" } }')
        writeFileSync(join(folder, '.env'), 'VENUE__HALL=3\n')

        const sources = standardSources(new HostEnvironment('Staging'), { directory: folder })
        const venue = new Config().add(...sources).bind(VenueSettings)

        expect(sources.map(source => source.name)).toEqual([
            join(folder, 'settings.json'),
            join(folder, 'settings.staging.json'),
            join(folder, '.env'),
            'the environment',
        ])
        expect(venue).toEqual(expect.objectContaining({ city: 'Rosario', room: 'B', hall: '3' }))
    })

    it('take the three files as optional', () => {
        const empty = mkdtempSync(join(folder, 'empty-'))

        const sources = standardSources(new HostEnvironment('production'), { directory: empty })

        expect(sources.slice(0, 3).map(source => source.entries)).toEqual([[], [], []])
    })
})

// A hand-written Standard Schema: three texts of a venue.
const venueSchema: StandardSchemaV1<unknown, { city: string; room: string; hall: string }> = {
    '~standard': {
        version: 1,
        vendor: 'test',
        validate(input) {
            const { city, room, hall } = (input ?? {}) as Record<string, unknown>
            if (typeof city !== 'string' || typeof room !== 'string' || typeof hall !== 'string') {
                return { issues: [{ message: 'Expected a city, a room and a hall' }] }
            }
            return { value: { city, room, hall } }
        },
    },
}

class VenueSettings extends settings('venue', venueSchema) {}
