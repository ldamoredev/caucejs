import { CompositionError, Services } from '@caucejs/di'
import { describe, expect, it } from 'vitest'

import { application, Handler, Query, UseCases } from '../src/index.js'
import { GetVenue, GetVenueHandler, Journal, OpenDoors, OpenDoorsHandler, Outer, Venue } from './support/conference.js'

describe('the application extension', () => {
    it('adds the use cases', () => {
        const provider = new Services().add(application(app => app.handle(OpenDoors, OpenDoorsHandler))).addSingleton(Journal, Journal).build()

        expect(provider.get(UseCases)).toBeInstanceOf(UseCases)
    })

    it('lets the validation of the container find a dependency a handler is missing, before any request', () => {
        const services = new Services().addSingleton(Journal, Journal).add(application(app => app.handle(GetVenue, GetVenueHandler)))

        expect(() => services.build({ validate: true })).toThrow(/GetVenueHandler needs Venue, which was never added/)
    })

    it('lets the validation find a dependency a middleware is missing', () => {
        const services = new Services().addSingleton(Venue, Venue).add(application(app => app.use(Outer)))

        expect(() => services.build({ validate: true })).toThrow(/Outer needs Journal, which was never added/)
    })

    it('refuses a second handler for the same request, naming the first', () => {
        const adding = () => new Services().add(application(app => app.handle(OpenDoors, OpenDoorsHandler).handle(OpenDoors, OtherDoorsHandler)))

        expect(adding).toThrow(new CompositionError('OpenDoors already has a handler: OpenDoorsHandler'))
    })

    it('refuses the same middleware twice', () => {
        expect(() => new Services().add(application(app => app.use(Outer).use(Outer)))).toThrow(CompositionError)
    })

    it('is added once when it is the same, and fails when it is another', () => {
        const configure = (app: Parameters<Parameters<typeof application>[0]>[0]) => app.handle(OpenDoors, OpenDoorsHandler)
        const services = new Services().add(application(configure), application(configure))

        expect(() => services.add(application(app => app.handle(GetVenue, GetVenueHandler)))).toThrow(/application was added twice/)
    })

    it('lets a test replace a handler', async () => {
        const services = new Services().addSingleton(Journal, Journal).addSingleton(Venue, Venue).add(application(app => app.handle(Named, NamedHandler)))

        services.replace(NamedHandler, () => new FixedNameHandler())

        const provider = services.build({ validate: true })
        expect(await provider.get(UseCases).execute(new Named(), { scope: provider })).toBe('fixed')
    })
})

class OtherDoorsHandler extends Handler<OpenDoors> {
    async execute(): Promise<void> {}
}

class Named extends Query<string> {
    static readonly anonymous = true
}

class NamedHandler extends Handler<Named> {
    async execute(): Promise<string> {
        return 'real'
    }
}

class FixedNameHandler extends NamedHandler {
    override async execute(): Promise<string> {
        return 'fixed'
    }
}
