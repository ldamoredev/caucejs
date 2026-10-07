import { Services, type Provider } from '@caucejs/di'
import { beforeEach, describe, expect, it } from 'vitest'

import {
    AnonymousIdentity,
    application,
    Authorization,
    Command,
    ExecutionContext,
    ForbiddenError,
    Handler,
    NotAuthenticatedError,
    SystemIdentity,
    UseCases,
    type Identity,
    type Request,
} from '../src/index.js'
import { GetVenue, GetVenueHandler, Journal, OpenDoors, OpenDoorsHandler, Staff, Venue } from './support/conference.js'

describe('authorization', () => {
    it('refuses anyone who is not authenticated', async () => {
        await expect(execute(new Plain(), new AnonymousIdentity())).rejects.toThrow(NotAuthenticatedError)
    })

    it('lets anyone authenticated run a request that names no permission', async () => {
        await expect(execute(new Plain(), new Staff('Ana'))).resolves.toBe('done')
    })

    it('lets anyone, even nobody, run a request that says it is anonymous', async () => {
        await expect(execute(new GetVenue(), new AnonymousIdentity())).resolves.toBe('Main hall')
    })

    it('needs one of the permissions a request names', async () => {
        await expect(execute(new OpenDoors('north'), new Staff('Ana', 'tickets', 'doors'))).resolves.toBeUndefined()
    })

    it('needs only one of them, not all', async () => {
        await expect(execute(new Seat(), new Staff('Ana', 'tickets'))).resolves.toBe('seated')
    })

    it('refuses someone authenticated who cannot do any of them', async () => {
        await expect(execute(new OpenDoors('north'), new Staff('Ana', 'tickets'))).rejects.toThrow(ForbiddenError)
    })

    it('refuses nobody as not authenticated, even with permissions named', async () => {
        await expect(execute(new OpenDoors('north'), new AnonymousIdentity())).rejects.toThrow(NotAuthenticatedError)
    })

    it('lets the system run anything', async () => {
        await expect(execute(new OpenDoors('north'), new SystemIdentity())).resolves.toBeUndefined()
    })

    it('stops before the handler', async () => {
        await execute(new OpenDoors('north'), new Staff('Ana')).catch(() => undefined)

        expect(provider.get(Journal).entries).toEqual([])
    })

    beforeEach(() => {
        provider = new Services()
            .addSingleton(Journal, Journal)
            .addSingleton(Venue, Venue)
            .add(
                application(app =>
                    app
                        .use(Authorization)
                        .handle(Plain, PlainHandler)
                        .handle(Seat, SeatHandler)
                        .handle(GetVenue, GetVenueHandler)
                        .handle(OpenDoors, OpenDoorsHandler),
                ),
            )
            .build({ validate: true })
    })

    function execute<T extends Request<unknown>>(request: T, identity: Identity) {
        return provider.get(UseCases).execute(request, { scope: provider, context: ExecutionContext.of(identity) })
    }

    let provider: Provider
})

class Plain extends Command<string> {}

class PlainHandler extends Handler<Plain> {
    async execute(): Promise<string> {
        return 'done'
    }
}

class Seat extends Command<string> {
    static readonly permissions = ['doors', 'tickets']
}

class SeatHandler extends Handler<Seat> {
    async execute(): Promise<string> {
        return 'seated'
    }
}
