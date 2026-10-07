// The canonical use cases, to copy: a request with its handler, a middleware, the identity of the application, and
// the extension that names all of them. A web module would open the scope and build the context for each request.
import { Services } from '@caucejs/di'
import * as z from 'zod'

import {
    application,
    Authorization,
    Command,
    ExecutionContext,
    Handler,
    Identity,
    Middleware,
    Query,
    UseCases,
    type Next,
    type Request,
} from '../src/index.js'

export type Talk = { readonly id: string; readonly title: string; readonly seats: number }

export class Talks {
    readonly #talks = new Map<string, Talk>([['opening', { id: 'opening', title: 'Opening', seats: 2 }]])

    get(id: string): Talk {
        const talk = this.#talks.get(id)
        if (!talk) throw new Error(`No talk ${id}`)
        return talk
    }

    update(talk: Talk): void {
        this.#talks.set(talk.id, talk)
    }
}

// A query anyone can run: the class says so, because authorization is closed by default. Its fields come from its
// schema, which is also how a web request or a tool reads it.
export class GetTalk extends Query.returning<Talk>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly anonymous = true
}

export class GetTalkHandler extends Handler<GetTalk> {
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

// A command that needs a permission, and answers the seats left.
export class SellTicket extends Command.returning<number>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly permissions = ['tickets']
}

export class SellTicketHandler extends Handler<SellTicket> {
    static readonly inject = [Talks] as const
    readonly #talks: Talks

    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }

    async execute(request: SellTicket): Promise<number> {
        const talk = this.#talks.get(request.talkId)
        this.#talks.update({ ...talk, seats: talk.seats - 1 })
        return talk.seats - 1
    }
}

// The identity of this application: someone at the box office can sell tickets.
export class BoxOffice extends Identity {
    readonly name = 'box office'
    readonly isAuthenticated = true

    can(permission: string): boolean {
        return permission === 'tickets'
    }
}

// A middleware the application writes. Logging the whole request would also log its secrets: name what is logged.
export class Journal {
    readonly entries: string[] = []
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
        try {
            return await next()
        } catch (error) {
            this.#journal.entries.push(`${request.constructor.name} failed: ${(error as Error).name}`)
            throw error
        }
    }
}

export async function runTheBoxOffice(): Promise<string[]> {
    const services = new Services()
        .addSingleton(Talks, Talks)
        .addSingleton(Journal, Journal)
        // the order written is the order they run: recording sees what authorization refuses
        .add(application(app => app.use(Recording).use(Authorization).handle(GetTalk, GetTalkHandler).handle(SellTicket, SellTicketHandler)))
    await using provider = services.build({ validate: true })
    const useCases = provider.get(UseCases)

    await using scope = provider.createScope()
    const talk = await useCases.execute(new GetTalk({ talkId: 'opening' }), { scope })
    const left = await useCases.execute(new SellTicket({ talkId: 'opening' }), { scope, context: ExecutionContext.of(new BoxOffice()) })
    await useCases.execute(new SellTicket({ talkId: 'opening' }), { scope }).catch(() => undefined)

    return [...provider.get(Journal).entries, `${talk.title}: ${left} seat left`]
}
