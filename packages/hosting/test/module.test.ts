import { describe, expect, it } from 'vitest'

import { InvalidSettingsError, memory, settings, type StandardSchemaV1 } from '@caucejs/config'
import { HostBuilder, Module } from '../src/index.js'
import { Journal, TicketDesk } from './support/conference.js'

describe('a module', () => {
    it('adds its services and what starts with it', async () => {
        const builder = new HostBuilder({ environment: 'test' })

        builder.addModule(Ticketing)
        await using host = builder.build()
        await host.start()

        expect(host.provider.get(Journal).entries).toContain('open ticket desk')
    })

    it('is composed once, even when two modules ask for it', () => {
        const builder = new HostBuilder({ environment: 'test' })
        Ticketing.composed = 0

        builder.addModule(Conference)
        builder.addModule(Ticketing)

        expect(Ticketing.composed).toBe(1)
        expect(() => builder.build()).not.toThrow()
    })
})

describe('settings', () => {
    it('are bound when the host is built, so a source added after the module counts', () => {
        const builder = new HostBuilder({ environment: 'test' })

        builder.addSettings(TicketingSettings)
        builder.config.add(memory({ ticketing: { capacity: 300 } }))

        expect(builder.build().provider.get(TicketingSettings).capacity).toBe(300)
    })

    it('fail the build, before anything starts, when a value is wrong', () => {
        const builder = new HostBuilder({ environment: 'test' })
        builder.addSettings(TicketingSettings)
        builder.config.add(memory({ ticketing: { capacity: 'many' } }))

        expect(() => builder.build()).toThrow(InvalidSettingsError)
    })
})

class Ticketing extends Module {
    static composed = 0

    compose(app: HostBuilder): void {
        Ticketing.composed += 1
        app.services.addSingleton(Journal)
        app.start(TicketDesk)
    }
}

class Conference extends Module {
    compose(app: HostBuilder): void {
        app.addModule(Ticketing)
    }
}

const capacity: StandardSchemaV1<unknown, { capacity: number }> = {
    '~standard': {
        version: 1,
        vendor: 'test',
        // configuration values arrive as strings
        validate: input => {
            const value = Number((input as { capacity?: unknown }).capacity)
            return Number.isInteger(value) ? { value: { capacity: value } } : { issues: [{ message: 'Expected a number', path: ['capacity'] }] }
        },
    },
}

class TicketingSettings extends settings('ticketing', capacity) {}
