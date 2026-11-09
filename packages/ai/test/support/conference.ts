import { application, Authorization, Command, Handler, Identity, Middleware, Query, type ExecutionContext, type Next, type Request } from '@caucejs/application'
import { NotFoundError } from '@caucejs/base'
import { Services } from '@caucejs/di'
import { jsonSerializer } from '@caucejs/schema'
import { tool, tools } from '@caucejs/tools'
import * as z from 'zod'

import { ai, Model } from '../../src/index.js'

export type Talk = { readonly id: string; readonly title: string; readonly startsAt: string }

export class Talks {
    readonly #talks = new Map<string, Talk>([
        ['opening', { id: 'opening', title: 'Opening', startsAt: '09:00' }],
        ['closing', { id: 'closing', title: 'Closing', startsAt: '18:00' }],
    ])

    get(id: string): Talk {
        const talk = this.#talks.get(id)
        if (!talk) throw new NotFoundError(`There is no talk ${id}`)
        return talk
    }
}

// One for each scope: what the middleware and the handlers of one use case wrote, in order.
export class Journal {
    readonly entries: string[] = []
}

export class Journaling extends Middleware {
    static readonly inject = [Journal] as const
    readonly #journal: Journal

    constructor(journal: Journal) {
        super()
        this.#journal = journal
    }

    async execute<R>(request: Request<R>, context: ExecutionContext, next: Next<R>): Promise<R> {
        this.#journal.entries.push(`${request.constructor.name} as ${context.identity.name}`)
        try {
            return await next()
        } catch (error) {
            this.#journal.entries.push(`${request.constructor.name} failed with ${(error as Error).name}`)
            throw error
        }
    }
}

export class GetTalk extends Query.returning<Talk>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly anonymous = true
}

export class GetTalkHandler extends Handler.of(GetTalk) {
    static readonly inject = [Talks, Journal] as const
    readonly #talks: Talks
    readonly #journal: Journal

    constructor(talks: Talks, journal: Journal) {
        super()
        this.#talks = talks
        this.#journal = journal
    }

    async execute(request: GetTalk): Promise<Talk> {
        this.#journal.entries.push(`get ${request.talkId}`)
        return this.#talks.get(request.talkId)
    }
}

export class SellTicket extends Command.returning<number>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly permissions = ['tickets']
}

export class SellTicketHandler extends Handler.of(SellTicket) {
    async execute(): Promise<number> {
        return 41
    }
}

// A request that answers nothing.
export class StarTalk extends Command.from(z.strictObject({ talkId: z.string().min(1) })) {}

export class StarTalkHandler extends Handler.of(StarTalk) {
    async execute(): Promise<void> {}
}

export const getTalk = tool(GetTalk, { name: 'get_talk', description: 'A talk of the conference, by its id' })
export const sellTicket = tool(SellTicket, { name: 'sell_ticket', description: 'Sells one seat of a talk' })
export const starTalk = tool(StarTalk, { name: 'star_talk', description: 'Stars a talk for whoever asks' })

export class Attendee extends Identity {
    readonly name = 'attendee'
    readonly isAuthenticated = true

    can(_permission: string): boolean {
        return false
    }
}

export class BoxOffice extends Identity {
    readonly name = 'box office'
    readonly isAuthenticated = true

    can(permission: string): boolean {
        return permission === 'tickets'
    }
}

/** The services of a conference that asks a model, with the model given. Built through `Services`, as an app does. */
export function conference(model: Model): Services {
    const services = new Services()
    services.addSingleton(Talks)
    services.addScoped(Journal)
    services.addInstance(Model, model)
    services.add(jsonSerializer())
    services.add(tools())
    services.add(ai())
    services.add(
        application(app => {
            app.use(Journaling)
            app.use(Authorization)
            app.handle(GetTalkHandler)
            app.handle(SellTicketHandler)
            app.handle(StarTalkHandler)
        }),
    )
    return services
}

