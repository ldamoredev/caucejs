import { Services, type Extension, type Provider } from '@caucejs/di'
import { beforeEach, describe, expect, it } from 'vitest'

import {
    application,
    Command,
    ContextKey,
    ExecutionContext,
    Handler,
    HandlerNotAddedError,
    Middleware,
    Query,
    UseCases,
    type Next,
    type Request,
} from '../src/index.js'
import { GetVenue, GetVenueHandler, Inner, Journal, OpenDoors, OpenDoorsHandler, Outer, Staff, Venue } from './support/conference.js'

describe('use cases', () => {
    it('execute the handler added for the request and answer what it answered', async () => {
        expect(await execute(new GetVenue())).toBe('Main hall')
    })

    it('run as anonymous when no context is given', async () => {
        await execute(new GetVenue())

        expect(journal.entries).toContain('handler as anonymous')
    })

    it('give the handler the context they were given', async () => {
        await execute(new GetVenue(), ExecutionContext.of(new Staff('Ana')))

        expect(journal.entries).toContain('handler as Ana')
    })

    it('build a new handler for every execution, in the scope given', async () => {
        const [first, second] = [provider.createScope(), provider.createScope()]

        for (const scope of [first, first, second]) await provider.get(UseCases).execute(new Count(), { scope })

        expect(counted).toHaveLength(2)
    })

    it('fail for a request without a handler, before any middleware runs', async () => {
        await expect(execute(new Unhandled())).rejects.toThrow(new HandlerNotAddedError('Unhandled'))
        expect(journal.entries).toEqual([])
    })

    it('do not take a subclass of a request for the request', async () => {
        await expect(execute(new BackDoors('south'))).rejects.toThrow(HandlerNotAddedError)
    })

    describe('middlewares', () => {
        it('run in the order they were written, the first one outermost', async () => {
            await execute(new GetVenue())

            expect(journal.entries).toEqual(['outer before', 'inner before', 'handler as anonymous', 'inner after', 'outer after'])
        })

        it('see what the handler threw', async () => {
            await expect(execute(new Jam())).rejects.toThrow('The doors are stuck')
            expect(journal.entries).toEqual(['outer before', 'inner before', 'inner after', 'outer after'])
        })

        it('pass the context on when they call next without one', async () => {
            await execute(new ReadTrack(), ExecutionContext.anonymous().with(track, 'web'))

            expect(journal.entries).toContain('track web')
        })

        it('are built for every execution', async () => {
            await execute(new GetVenue())
            await execute(new GetVenue())

            expect(CountsItself.built).toBe(2)
        })
    })

    describe('a middleware that does not call next', () => {
        it('stops the execution', async () => {
            await expect(execute(new GetVenue())).rejects.toThrow('closed')
            expect(journal.entries).toEqual([])
        })

        beforeEach(() => {
            provider = compose(application(app => app.use(Refusing).handle(GetVenue, GetVenueHandler)))
        })
    })

    describe('a middleware that calls next with another context', () => {
        it('gives it to what comes after it', async () => {
            await execute(new GetVenue())

            expect(journal.entries).toEqual(['handler as Ana'])
        })

        beforeEach(() => {
            provider = compose(application(app => app.use(SignInAna).handle(GetVenue, GetVenueHandler)))
        })
    })

    beforeEach(() => {
        counted = []
        CountsItself.built = 0
        provider = compose(
            application(app =>
                app
                    .use(Outer)
                    .use(Inner)
                    .use(CountsItself)
                    .handle(GetVenue, GetVenueHandler)
                    .handle(OpenDoors, OpenDoorsHandler)
                    .handle(Jam, JamHandler)
                    .handle(ReadTrack, ReadTrackHandler)
                    .handle(Count, CountHandler),
            ),
        )
    })

    function execute<T extends Request<unknown>>(request: T, context?: ExecutionContext) {
        return provider.get(UseCases).execute(request, { scope: provider, ...(context && { context }) })
    }

    function compose(useCases: Extension): Provider {
        journal = new Journal()
        return new Services()
            .addInstance(Journal, journal)
            .addSingleton(Venue, Venue)
            .addScoped(Counted, () => new Counted(counted))
            .add(useCases)
            .build({ validate: true })
    }

    let provider: Provider
    let journal: Journal
    let counted: Counted[]
})

const track = new ContextKey<string>('track')

class Unhandled extends Command {}

class BackDoors extends OpenDoors {}

class Jam extends Command {}

class JamHandler extends Handler<Jam> {
    async execute(): Promise<void> {
        throw new Error('The doors are stuck')
    }
}

class ReadTrack extends Query<void> {}

class ReadTrackHandler extends Handler<ReadTrack> {
    static readonly inject = [Journal] as const
    readonly #journal: Journal

    constructor(journal: Journal) {
        super()
        this.#journal = journal
    }

    async execute(_request: ReadTrack, context: ExecutionContext): Promise<void> {
        this.#journal.entries.push(`track ${context.find(track)}`)
    }
}

class Counted {
    constructor(built: Counted[]) {
        built.push(this)
    }
}

class Count extends Command {}

class CountHandler extends Handler<Count> {
    static readonly inject = [Counted] as const

    constructor(counted: Counted) {
        super()
        void counted
    }

    async execute(): Promise<void> {}
}

class Refusing extends Middleware {
    execute<R>(): Promise<R> {
        return Promise.reject(new Error('closed'))
    }
}

class SignInAna extends Middleware {
    execute<R>(_request: Request<R>, context: ExecutionContext, next: Next<R>): Promise<R> {
        return next(context.withIdentity(new Staff('Ana')))
    }
}

class CountsItself extends Middleware {
    static built = 0

    constructor() {
        super()
        CountsItself.built++
    }

    execute<R>(_request: Request<R>, _context: ExecutionContext, next: Next<R>): Promise<R> {
        return next()
    }
}
