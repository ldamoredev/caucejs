import { Clock, DomainError, NotFoundError } from '../src/index.js'

// A failure the caller reacts to gets a type of its own, with a fixed message.
export class SalesClosedError extends DomainError {
    constructor(options?: ErrorOptions) {
        super('Ticket sales are closed', options)
    }
}

// Extending a generic error keeps it translatable as a "not found" by whoever handles it.
export class TalkNotFoundError extends NotFoundError {
    readonly talkId: string

    constructor(talkId: string, options?: ErrorOptions) {
        super(`Talk ${talkId} not found`, options)
        this.talkId = talkId
    }
}

// The time comes from a Clock, so a test can sell a ticket the day before sales close.
export class TicketSales {
    readonly #clock: Clock
    readonly #closesAt: Date

    constructor(clock: Clock, closesAt: Date) {
        this.#clock = clock
        this.#closesAt = closesAt
    }

    ensureOpen(): void {
        if (this.#clock.now() >= this.#closesAt) throw new SalesClosedError()
    }
}
