// The classes the tests compose: a small conference, with a fake SQL client that records what happens to it.
export const log: string[] = []

export abstract class Clock {
    abstract now(): Date
}

export class FixedClock extends Clock {
    now(): Date {
        return new Date('2026-10-04T12:00:00Z')
    }
}

export abstract class SqlClient {
    abstract query(sql: string): string[]
}

export class FakeSqlClient extends SqlClient implements AsyncDisposable {
    readonly name: string

    constructor(name = 'fake') {
        super()
        this.name = name
        log.push(`open ${name}`)
    }

    query(): string[] {
        return ['Opening keynote']
    }

    async [Symbol.asyncDispose](): Promise<void> {
        log.push(`close ${this.name}`)
    }
}

export abstract class Talks {
    abstract titles(): string[]
}

export class SqlTalks extends Talks implements Disposable {
    static readonly inject = [SqlClient, Clock] as const
    readonly #sql: SqlClient

    constructor(sql: SqlClient, clock: Clock) {
        super()
        this.#sql = sql
        void clock
        log.push('build talks')
    }

    titles(): string[] {
        return this.#sql.query('select title from talks')
    }

    [Symbol.dispose](): void {
        log.push('dispose talks')
    }
}

export class CurrentAttendee {
    name = 'nobody'
}

export class SellTicket {
    static readonly inject = [Talks, CurrentAttendee] as const
    readonly talks: Talks
    readonly attendee: CurrentAttendee

    constructor(talks: Talks, attendee: CurrentAttendee) {
        this.talks = talks
        this.attendee = attendee
    }
}

export class Badges {
    static readonly inject = [CurrentAttendee] as const
    readonly attendee: CurrentAttendee

    constructor(attendee: CurrentAttendee) {
        this.attendee = attendee
    }
}
