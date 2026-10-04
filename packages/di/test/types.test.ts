import { describe, expect, it } from 'vitest'

import { Services } from '../src/index.js'
import { Clock, FixedClock, SqlClient, SqlTalks, Talks } from './support/conference.js'

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export function whatTheCompilerRefuses(services: Services): void {
    // @ts-expect-error the inject list in another order than the constructor
    services.addSingleton(Talks, WrongOrder)
    // @ts-expect-error a constructor with parameters and no inject list
    services.addSingleton(Talks, NoList)
    // @ts-expect-error an implementation that is not a Talks
    services.addSingleton(Talks, FixedClock)
    // @ts-expect-error a factory that builds something else
    services.addSingleton(Talks, () => new FixedClock())
    // @ts-expect-error a factory that passes the arguments in another order
    services.addSingleton(Talks, resolver => new SqlTalks(resolver.get(Clock), resolver.get(SqlClient)))
}

describe('the types', () => {
    it('let a right registration through', () => {
        const services = new Services().addSingleton(Clock, FixedClock).addSingleton(Talks, SqlTalks)

        expect(services).toBeInstanceOf(Services)
    })
})

class WrongOrder extends Talks {
    static readonly inject = [Clock, SqlClient] as const

    constructor(sql: SqlClient, clock: Clock) {
        super()
        void sql
        void clock
    }

    titles(): string[] {
        return []
    }
}

class NoList extends Talks {
    constructor(sql: SqlClient) {
        super()
        void sql
    }

    titles(): string[] {
        return []
    }
}
