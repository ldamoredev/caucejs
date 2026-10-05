import { HostedService } from '../../src/index.js'

// Hosted services of a small conference, writing what happens to them in a journal the test reads.

export class Journal {
    readonly entries: string[] = []
}

export class TicketDesk extends HostedService {
    static readonly inject = [Journal] as const
    readonly #journal: Journal

    constructor(journal: Journal) {
        super()
        this.#journal = journal
    }

    async start(): Promise<void> {
        this.#journal.entries.push('open ticket desk')
    }

    async stop(): Promise<void> {
        this.#journal.entries.push('close ticket desk')
    }
}

export class Stage extends HostedService {
    static readonly inject = [Journal] as const
    readonly #journal: Journal

    constructor(journal: Journal) {
        super()
        this.#journal = journal
    }

    async start(): Promise<void> {
        this.#journal.entries.push('open stage')
    }

    async stop(): Promise<void> {
        this.#journal.entries.push('close stage')
    }
}

export class BrokenProjector extends HostedService {
    static readonly inject = [Journal] as const
    readonly #journal: Journal

    constructor(journal: Journal) {
        super()
        this.#journal = journal
    }

    async start(): Promise<void> {
        this.#journal.entries.push('projector fails')
        throw new Error('No signal')
    }

    async stop(): Promise<void> {
        this.#journal.entries.push('close projector')
    }
}

export class StuckDoor extends HostedService {
    async start(): Promise<void> {}

    stop(): Promise<void> {
        return new Promise(() => {})
    }
}

export class JammedLights extends HostedService {
    async start(): Promise<void> {}

    async stop(): Promise<void> {
        throw new Error('The lights are jammed')
    }
}

export class JammedSound extends HostedService {
    async start(): Promise<void> {}

    async stop(): Promise<void> {
        throw new Error('The sound is jammed')
    }
}

/** A singleton the container disposes when the host stops, after every hosted service. */
export class Badges implements Disposable {
    static readonly inject = [Journal] as const
    readonly #journal: Journal

    constructor(journal: Journal) {
        this.#journal = journal
    }

    [Symbol.dispose](): void {
        this.#journal.entries.push('dispose badges')
    }
}

export class Attendee {}

export class Agenda {
    static readonly inject = [Attendee] as const
    readonly attendee: Attendee

    constructor(attendee: Attendee) {
        this.attendee = attendee
    }
}
