import { Command, Handler, Identity, Middleware, Query, type ExecutionContext, type Next, type Request } from '@caucejs/application'
import { DomainError, NotFoundError } from '@caucejs/base'
import { ValidationError } from '@caucejs/schema'
import * as z from 'zod'

export type Talk = { readonly id: string; readonly title: string; readonly seats: number }

export class Talks {
    readonly #talks = new Map<string, Talk>([
        ['opening', { id: 'opening', title: 'Opening', seats: 1 }],
        ['closing', { id: 'closing', title: 'Closing', seats: 0 }],
    ])

    get(id: string): Talk {
        const talk = this.#talks.get(id)
        if (!talk) throw new NotFoundError(`There is no talk ${id}`)
        return talk
    }

    update(talk: Talk): void {
        this.#talks.set(talk.id, talk)
    }
}

export class Journal {
    readonly entries: string[] = []
}

export class SoldOutError extends DomainError {
    constructor(options?: ErrorOptions) {
        super('The talk has no seats left', options)
    }
}

export class QuietRefusalError extends DomainError {
    constructor(options?: ErrorOptions) {
        super('', options)
    }
}

export class GetTalk extends Query.returning<Talk>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly anonymous = true
}

export class GetTalkHandler extends Handler.of(GetTalk) {
    static readonly inject = [Talks] as const
    readonly #talks: Talks

    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }

    async execute(request: GetTalk): Promise<Talk> {
        return this.#talks.get(request.talkId)
    }
}

export class SellTickets extends Command.returning<number>().from(z.strictObject({ talkId: z.string().min(1), seats: z.int().positive() })) {
    static readonly permissions = ['tickets']
}

export class SellTicketsHandler extends Handler.of(SellTickets) {
    static readonly inject = [Talks] as const
    readonly #talks: Talks

    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }

    async execute(request: SellTickets): Promise<number> {
        const talk = this.#talks.get(request.talkId)
        if (talk.seats < request.seats) throw new SoldOutError()
        this.#talks.update({ ...talk, seats: talk.seats - request.seats })
        return talk.seats - request.seats
    }
}

// A command that answers nothing.
export class OpenDoors extends Command.from(z.strictObject({ gate: z.string() })) {
    static readonly anonymous = true
}

export class OpenDoorsHandler extends Handler.of(OpenDoors) {
    static readonly inject = [Journal] as const
    readonly #journal: Journal

    constructor(journal: Journal) {
        super()
        this.#journal = journal
    }

    async execute(request: OpenDoors): Promise<void> {
        this.#journal.entries.push(`doors ${request.gate} open`)
    }
}

// Fails with something that is not an error of the domain, such as a bug.
export class DimTheLights extends Command.from(z.strictObject({})) {
    static readonly anonymous = true
}

export class DimTheLightsHandler extends Handler.of(DimTheLights) {
    async execute(): Promise<void> {
        throw new Error('The dimmer at 10.0.0.7 does not answer')
    }
}

export class RefuseQuietly extends Command.from(z.strictObject({})) {
    static readonly anonymous = true
}

export class RefuseQuietlyHandler extends Handler.of(RefuseQuietly) {
    async execute(): Promise<void> {
        throw new QuietRefusalError()
    }
}

// Reads something of its own, and finds it wrong.
export class ImportProgram extends Command.from(z.strictObject({})) {
    static readonly anonymous = true
}

export class ImportProgramHandler extends Handler.of(ImportProgram) {
    async execute(): Promise<void> {
        throw new ValidationError([{ path: 'talks.0.title', message: 'Required' }])
    }
}

// Added to no application.
export class GetVenue extends Query.returning<string>().from(z.strictObject({})) {
    static readonly anonymous = true
}

// Its input cannot be said in JSON Schema.
export class ScheduleTalk extends Command.from(z.strictObject({ at: z.bigint() })) {}

export class BoxOffice extends Identity {
    readonly name = 'box office'
    readonly isAuthenticated = true

    can(permission: string): boolean {
        return permission === 'tickets'
    }
}

export class Attendee extends Identity {
    readonly name = 'attendee'
    readonly isAuthenticated = true

    can(): boolean {
        return false
    }
}

export class Recording extends Middleware {
    static readonly inject = [Journal] as const
    readonly #journal: Journal

    constructor(journal: Journal) {
        super()
        this.#journal = journal
    }

    async execute<R>(request: Request<R>, context: ExecutionContext, next: Next<R>): Promise<R> {
        this.#journal.entries.push(`${context.identity.name} runs ${request.constructor.name}`)
        return next()
    }
}
