import { beforeEach, describe, expect, it } from 'vitest'

import { CompositionError, Services } from '../src/index.js'
import { Badges, Clock, CurrentAttendee, FakeSqlClient, FixedClock, SellTicket, SqlClient, SqlTalks, Talks, log } from './support/conference.js'

beforeEach(() => {
    log.length = 0
})

describe('validating the graph when it is built', () => {
    it('lists every class that needs something never added, without building anything', () => {
        const services = new Services()
            .addSingleton(SqlClient, () => new FakeSqlClient('pool'))
            .addSingleton(Talks, SqlTalks)
            .addTransient(SellTicket, SellTicket)

        expect(() => services.build({ validate: true })).toThrow(
            new CompositionError(
                'The container is composed wrong:\n' +
                    '- Talks needs Clock, which was never added\n' +
                    '- SellTicket needs CurrentAttendee, which was never added',
            ),
        )
        expect(log).toEqual([])
    })

    it('finds a singleton that would capture a scoped service, also through a transient', () => {
        const services = new Services()
            .addScoped(CurrentAttendee, CurrentAttendee)
            .addTransient(Badges, Badges)
            .addSingleton(Talks, CachedTalks)

        expect(() => services.build({ validate: true })).toThrow(
            'The container is composed wrong:\n- Talks is a singleton and would capture CurrentAttendee, which is scoped',
        )
    })

    it('cannot see inside a factory', () => {
        const services = new Services().addSingleton(Talks, resolver => new SqlTalks(resolver.get(SqlClient), resolver.get(Clock)))

        const provider = services.build({ validate: true })

        expect(() => provider.get(Talks)).toThrow('SqlClient was never added, needed by Talks')
    })

    it('passes a graph that is right, and does not run when it is not asked for', () => {
        const right = new Services()
            .addSingleton(Clock, FixedClock)
            .addSingleton(SqlClient, () => new FakeSqlClient('pool'))
            .addSingleton(Talks, SqlTalks)
            .addScoped(CurrentAttendee, CurrentAttendee)
            .addTransient(SellTicket, SellTicket)
        const wrong = new Services().addSingleton(Talks, SqlTalks)

        expect(() => right.build({ validate: true })).not.toThrow()
        expect(() => wrong.build()).not.toThrow()
        expect(log).toEqual([])
    })
})

class CachedTalks extends Talks {
    static readonly inject = [Badges] as const

    constructor(badges: Badges) {
        super()
        void badges
    }

    titles(): string[] {
        return []
    }
}
