import { beforeEach, describe, expect, it } from 'vitest'

import { CircularDependencyError, CompositionError, ScopeError, ServiceNotAddedError, Services } from '../src/index.js'
import { Badges, Clock, CurrentAttendee, FakeSqlClient, FixedClock, SellTicket, SqlClient, SqlTalks, Talks, log } from './support/conference.js'

beforeEach(() => {
    log.length = 0
})

describe('the lifetimes', () => {
    it('give one singleton for the whole application, even across scopes', () => {
        const provider = conference().build()

        const fromRoot = provider.get(Talks)

        expect(provider.createScope().get(Talks)).toBe(fromRoot)
    })

    it('give one scoped instance per scope', () => {
        const provider = conference().build()
        const first = provider.createScope()
        const second = provider.createScope()

        expect(first.get(CurrentAttendee)).toBe(first.get(CurrentAttendee))
        expect(first.get(CurrentAttendee)).not.toBe(second.get(CurrentAttendee))
    })

    it('give a new transient every time, with the scoped services of its scope', () => {
        const scope = conference().build().createScope()

        const sale = scope.get(SellTicket)

        expect(scope.get(SellTicket)).not.toBe(sale)
        expect(sale.attendee).toBe(scope.get(CurrentAttendee))
    })
})

describe('a scoped service', () => {
    it('cannot be asked for outside of a scope', () => {
        expect(() => conference().build().get(CurrentAttendee)).toThrow(
            new ScopeError('CurrentAttendee is scoped, and was asked for outside of a scope'),
        )
    })

    it('cannot reach a singleton built by a factory, even from inside a scope', () => {
        const provider = conference()
            .addSingleton(Badges, resolver => new Badges(resolver.get(CurrentAttendee)))
            .build()

        expect(() => provider.createScope().get(Badges)).toThrow(
            new ScopeError('CurrentAttendee is scoped, and was asked for from Badges, which is not scoped'),
        )
    })
})

describe('a missing service', () => {
    it('is named, with what needed it', () => {
        const provider = new Services().addSingleton(Talks, SqlTalks).addSingleton(Clock, FixedClock).build()

        expect(() => provider.get(Talks)).toThrow(new ServiceNotAddedError('SqlClient', ['Talks']))
        expect(() => provider.get(Talks)).toThrow('SqlClient was never added, needed by Talks')
    })
})

describe('a cycle through factories', () => {
    it('fails when it is resolved, showing the path', () => {
        const provider = new Services()
            .addSingleton(Ping, resolver => new Ping(resolver.get(Pong)))
            .addSingleton(Pong, resolver => new Pong(resolver.get(Ping)))
            .build()

        expect(() => provider.get(Ping)).toThrow(new CircularDependencyError(['Ping', 'Pong', 'Ping']))
    })
})

describe('creating a class that was not added', () => {
    it('resolves what it lists, inside the scope, and is new every time', () => {
        const scope = conference().build().createScope()

        const badges = scope.create(Badges)

        expect(badges.attendee).toBe(scope.get(CurrentAttendee))
        expect(scope.create(Badges)).not.toBe(badges)
    })
})

describe('disposing', () => {
    it('disposes what a scope built, and leaves the singletons alive', async () => {
        const provider = conference().build()
        const scope = provider.createScope()
        scope.get(SellTicket)

        await scope[Symbol.asyncDispose]()

        expect(log).toEqual(['open pool', 'build talks'])
    })

    it('disposes the singletons in reverse order of creation when the provider is disposed', async () => {
        const provider = conference().build()
        provider.get(Talks)

        await provider[Symbol.asyncDispose]()

        expect(log).toEqual(['open pool', 'build talks', 'dispose talks', 'close pool'])
    })

    it('works with await using', async () => {
        {
            await using provider = conference().build()
            provider.get(SqlClient)
        }

        expect(log).toEqual(['open pool', 'close pool'])
    })

    it('never disposes an instance it did not build', async () => {
        const provider = new Services().addInstance(SqlClient, new FakeSqlClient('outside')).build()
        provider.get(SqlClient)

        await provider[Symbol.asyncDispose]()

        expect(log).toEqual(['open outside'])
    })

    it('refuses to resolve after being disposed', async () => {
        const provider = conference().build()
        const scope = provider.createScope()

        await scope[Symbol.asyncDispose]()
        await provider[Symbol.asyncDispose]()

        expect(() => scope.get(CurrentAttendee)).toThrow(new CompositionError('The scope was disposed'))
        expect(() => provider.get(Talks)).toThrow(new CompositionError('The provider was disposed'))
    })

    it('disposes everything even when one fails, and then throws', async () => {
        const provider = new Services()
            .addSingleton(SqlClient, () => new FakeSqlClient('pool'))
            .addSingleton(Clock, () => new BrokenClock())
            .build()
        provider.get(SqlClient)
        provider.get(Clock)

        await expect(provider[Symbol.asyncDispose]()).rejects.toThrow('the clock broke')
        expect(log).toEqual(['open pool', 'close pool'])
    })
})

function conference(): Services {
    return new Services()
        .addSingleton(Clock, FixedClock)
        .addSingleton(SqlClient, () => new FakeSqlClient('pool'))
        .addSingleton(Talks, SqlTalks)
        .addScoped(CurrentAttendee, CurrentAttendee)
        .addTransient(SellTicket, SellTicket)
}

class Ping {
    constructor(pong: unknown) {
        void pong
    }
}

class Pong {
    constructor(ping: Ping) {
        void ping
    }
}

class BrokenClock extends FixedClock implements Disposable {
    [Symbol.dispose](): void {
        throw new Error('the clock broke')
    }
}
