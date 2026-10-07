import { Command, Handler, Identity, Middleware, Query, type ExecutionContext, type Next, type Request } from '../../src/index.js'

export class Journal {
    readonly entries: string[] = []
}

export class Venue {
    readonly name = 'Main hall'
}

export class GetVenue extends Query<string> {
    static readonly anonymous = true
}

export class GetVenueHandler extends Handler<GetVenue> {
    static readonly inject = [Venue, Journal] as const
    readonly #venue: Venue
    readonly #journal: Journal

    constructor(venue: Venue, journal: Journal) {
        super()
        this.#venue = venue
        this.#journal = journal
    }

    async execute(_request: GetVenue, context: ExecutionContext): Promise<string> {
        this.#journal.entries.push(`handler as ${context.identity.name}`)
        return this.#venue.name
    }
}

export class OpenDoors extends Command {
    static readonly permissions = ['doors']
    readonly gate: string

    constructor(gate: string) {
        super()
        this.gate = gate
    }
}

export class OpenDoorsHandler extends Handler<OpenDoors> {
    static readonly inject = [Journal] as const
    readonly #journal: Journal

    constructor(journal: Journal) {
        super()
        this.#journal = journal
    }

    async execute(request: OpenDoors): Promise<void> {
        this.#journal.entries.push(`doors open at ${request.gate}`)
    }
}

export class Staff extends Identity {
    readonly name: string
    readonly isAuthenticated = true
    readonly #permissions: readonly string[]

    constructor(name: string, ...permissions: string[]) {
        super()
        this.name = name
        this.#permissions = permissions
    }

    can(permission: string): boolean {
        return this.#permissions.includes(permission)
    }
}

abstract class Recorder extends Middleware {
    readonly #journal: Journal
    readonly #label: string

    constructor(journal: Journal, label: string) {
        super()
        this.#journal = journal
        this.#label = label
    }

    async execute<R>(_request: Request<R>, _context: ExecutionContext, next: Next<R>): Promise<R> {
        this.#journal.entries.push(`${this.#label} before`)
        try {
            return await next()
        } finally {
            this.#journal.entries.push(`${this.#label} after`)
        }
    }
}

export class Outer extends Recorder {
    static readonly inject = [Journal] as const

    constructor(journal: Journal) {
        super(journal, 'outer')
    }
}

export class Inner extends Recorder {
    static readonly inject = [Journal] as const

    constructor(journal: Journal) {
        super(journal, 'inner')
    }
}
