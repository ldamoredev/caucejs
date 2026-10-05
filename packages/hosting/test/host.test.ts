import { describe, expect, it } from 'vitest'

import { CompositionError } from '@caucejs/di'
import { environmentOf, HostBuilder, HostEnvironment, ManualLifetime, StartError, StopTimeoutError } from '../src/index.js'
import { Agenda, Attendee, Badges, BrokenProjector, JammedLights, JammedSound, Journal, Stage, StuckDoor, TicketDesk } from './support/conference.js'

describe('the environment', () => {
    it('is production unless the builder says otherwise', () => {
        expect(new HostBuilder().environment.name).toBe('production')
        expect(new HostBuilder({ environment: 'Development' }).environment.is('development')).toBe(true)
    })

    it('is read from NODE_ENV, and is production when it is not set or blank', () => {
        expect(environmentOf({ NODE_ENV: 'test' })).toBe('test')
        expect(environmentOf({})).toBe('production')
        expect(environmentOf({ NODE_ENV: ' ' })).toBe('production')
    })

    it('can be injected', () => {
        const builder = new HostBuilder({ environment: 'test' })

        expect(builder.build().provider.get(HostEnvironment).name).toBe('test')
    })
})

describe('building', () => {
    it('validates the container in every environment, before anything starts', () => {
        const builder = new HostBuilder({ environment: 'production' })
        builder.services.addSingleton(Agenda, Agenda)

        expect(() => builder.build()).toThrow(CompositionError)
        expect(() => builder.build()).toThrow('Agenda needs Attendee, which was never added')
    })

    it('starts nothing', () => {
        const { builder, journal } = conference()
        builder.start(TicketDesk)

        builder.build()

        expect(journal.entries).toEqual([])
    })

    it('refuses a hosted service that was already added', () => {
        const { builder } = conference()
        builder.services.addSingleton(TicketDesk, TicketDesk)

        expect(() => builder.start(TicketDesk)).toThrow('TicketDesk was already added: use replace to change it')
    })
})

describe('starting and stopping', () => {
    it('starts in the order listed, stops in the reverse one, and then disposes the container', async () => {
        const { builder, journal } = conference()
        builder.services.addSingleton(Badges, Badges)
        builder.start(TicketDesk).start(Stage)
        const host = builder.build()
        host.provider.get(Badges)

        await host.start()
        await host.stop()

        expect(journal.entries).toEqual(['open ticket desk', 'open stage', 'close stage', 'close ticket desk', 'dispose badges'])
    })

    it('does nothing when started or stopped twice', async () => {
        const { builder, journal } = conference()
        const host = builder.start(TicketDesk).build()

        await host.start()
        await host.start()
        await host.stop()
        await host.stop()

        expect(journal.entries).toEqual(['open ticket desk', 'close ticket desk'])
    })

    it('stops what started, in reverse, when one fails to start, and starts nothing after it', async () => {
        const { builder, journal } = conference()
        const host = builder.start(TicketDesk).start(Stage).start(BrokenProjector).start(JammedLights).build()

        const error = await host.start().catch((caught: unknown) => caught)

        expect(error).toBeInstanceOf(StartError)
        expect(error).toMatchObject({ message: 'BrokenProjector failed to start', service: 'BrokenProjector', stopFailures: [] })
        expect((error as StartError).cause).toEqual(new Error('No signal'))
        expect(journal.entries).toEqual(['open ticket desk', 'open stage', 'projector fails', 'close stage', 'close ticket desk'])
    })

    it('stops every service even when one fails, and throws that failure', async () => {
        const { builder, journal } = conference()
        const host = builder.start(TicketDesk).start(JammedLights).build()
        await host.start()

        await expect(host.stop()).rejects.toThrow('The lights are jammed')
        expect(journal.entries).toEqual(['open ticket desk', 'close ticket desk'])
    })

    it('throws every failure together when several fail to stop', async () => {
        const { builder } = conference()
        const host = builder.start(JammedLights).start(JammedSound).build()
        await host.start()

        const error = await host.stop().catch((caught: unknown) => caught)

        expect(error).toBeInstanceOf(AggregateError)
        expect((error as AggregateError).errors).toEqual([new Error('The sound is jammed'), new Error('The lights are jammed')])
    })

    it('moves on when a service does not stop within the shutdown timeout', async () => {
        const { builder, journal } = conference({ shutdownTimeout: 20 })
        const host = builder.start(TicketDesk).start(StuckDoor).build()
        await host.start()

        await expect(host.stop()).rejects.toThrow(new StopTimeoutError('StuckDoor', 20))
        expect(journal.entries).toEqual(['open ticket desk', 'close ticket desk'])
    })

    it('stops when disposed', async () => {
        const { builder, journal } = conference()
        {
            await using host = builder.start(TicketDesk).build()
            await host.start()
        }

        expect(journal.entries).toEqual(['open ticket desk', 'close ticket desk'])
    })
})

describe('running', () => {
    it('starts, waits until the lifetime asks to stop, stops, and closes the lifetime', async () => {
        const { builder, journal } = conference()
        const host = builder.start(TicketDesk).build()
        const lifetime = new RecordingLifetime()

        const running = host.run(lifetime)
        await Promise.resolve()
        await Promise.resolve()
        expect(journal.entries).toEqual(['open ticket desk'])
        lifetime.stop()
        await running

        expect(journal.entries).toEqual(['open ticket desk', 'close ticket desk'])
        expect(lifetime.closed).toBe(true)
    })

    it('closes the lifetime when it fails to start', async () => {
        const { builder } = conference()
        const lifetime = new RecordingLifetime()

        await expect(builder.start(BrokenProjector).build().run(lifetime)).rejects.toThrow(StartError)
        expect(lifetime.closed).toBe(true)
    })
})

function conference(options: { shutdownTimeout?: number } = {}): { builder: HostBuilder; journal: Journal } {
    const journal = new Journal()
    const builder = new HostBuilder({ environment: 'test', ...options })
    builder.services.addInstance(Journal, journal).addSingleton(Attendee, Attendee)
    return { builder, journal }
}

class RecordingLifetime extends ManualLifetime {
    closed = false

    override close(): void {
        this.closed = true
    }
}
