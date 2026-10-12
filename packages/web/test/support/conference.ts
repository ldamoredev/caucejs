import { Command, Handler, Identity, Query } from '@caucejs/application'
import { DomainError, NotFoundError } from '@caucejs/base'
import * as z from 'zod'

import { Authenticator, Controller, type Routes } from '../../src/index.js'

export type Talk = { readonly id: string; readonly title: string; readonly track?: string }

export class Talks {
    readonly #talks = new Map<string, Talk>([['opening', { id: 'opening', title: 'Opening' }]])
    find(id: string): Talk | null {
        return this.#talks.get(id) ?? null
    }
    save(talk: Talk): void {
        this.#talks.set(talk.id, talk)
    }
}

export class TalkNotFoundError extends NotFoundError {
    constructor() {
        super('There is no such talk')
    }
}

export class SoldOutError extends DomainError {
    constructor() {
        super('The talk is sold out')
    }
}

export class GetTalk extends Query.returning<Talk>().from(z.strictObject({ id: z.string(), track: z.string().optional() })) {
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
        const talk = this.#talks.find(request.id)
        if (!talk) throw new TalkNotFoundError()
        return { ...talk, ...(request.track !== undefined && { track: request.track }) }
    }
}

export class RenameTalk extends Command.returning<Talk>().from(z.strictObject({ id: z.string(), title: z.string().trim().min(1) })) {
    static readonly permissions = ['talks']
}
export class RenameTalkHandler extends Handler<RenameTalk> {
    static readonly inject = [Talks] as const
    readonly #talks: Talks
    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }
    async execute(request: RenameTalk): Promise<Talk> {
        const talk = this.#talks.find(request.id)
        if (!talk) throw new TalkNotFoundError()
        const renamed = { ...talk, title: request.title }
        this.#talks.save(renamed)
        return renamed
    }
}

export class ArchiveTalk extends Command.from(z.strictObject({ id: z.string() })) {
    static readonly anonymous = true
}
export class ArchiveTalkHandler extends Handler<ArchiveTalk> {
    async execute(): Promise<void> {}
}

export class TagTalk extends Command.returning<readonly string[]>().from(z.strictObject({ id: z.string(), tags: z.array(z.string()) })) {
    static readonly anonymous = true
}
export class TagTalkHandler extends Handler<TagTalk> {
    async execute(request: TagTalk): Promise<readonly string[]> {
        return request.tags
    }
}

export class SellTicket extends Command.from(z.strictObject({ id: z.string() })) {
    static readonly anonymous = true
}
export class SellTicketHandler extends Handler<SellTicket> {
    async execute(): Promise<void> {
        throw new SoldOutError()
    }
}

export class Explode extends Command.from(z.strictObject({})) {
    static readonly anonymous = true
}
export class ExplodeHandler extends Handler<Explode> {
    async execute(): Promise<void> {
        throw new Error('The database is on fire')
    }
}

export class Organizer extends Identity {
    readonly name = 'organizer'
    readonly isAuthenticated = true
    can(permission: string): boolean {
        return permission === 'talks'
    }
}

export class Speaker extends Identity {
    readonly name = 'speaker'
    readonly isAuthenticated = true
    can(): boolean {
        return false
    }
}

/** Who makes a request: the organizer when the cookie says so. */
export class CookieAuthenticator extends Authenticator {
    async authenticate(request: Request): Promise<Identity> {
        const { AnonymousIdentity } = await import('@caucejs/application')
        const cookie = request.headers.get('cookie') ?? ''
        if (cookie.includes('session=organizer')) return new Organizer()
        if (cookie.includes('session=speaker')) return new Speaker()
        return new AnonymousIdentity()
    }
}

export class Journal {
    readonly entries: string[] = []
}

export class TalksController extends Controller {
    static readonly inject = [Journal] as const
    readonly #journal: Journal

    constructor(journal: Journal) {
        super()
        this.#journal = journal
    }

    registerRoutes(routes: Routes): void {
        routes
            .get('/talks/:id', GetTalk)
            .post('/talks/:id/title', RenameTalk)
            .post('/talks/:id/rename', RenameTalk, { redirect: talk => `/talks/${talk.id}` })
            .post('/talks/:id/tagged', TagTalk, { redirect: (_tags, request) => `/talks/${request.id}?tagged`, status: 302 })
            .put('/talks/:id/title', RenameTalk, { status: 202 })
            .patch('/talks/:id/title', RenameTalk)
            .delete('/talks/:id', ArchiveTalk)
            .post('/talks/:id/tags', TagTalk)
            .post('/talks/:id/tickets', SellTicket)
            .post('/explode', Explode)
            .get('/pages/talks/:id', async (c, run) => {
                const talk = await run(GetTalk, { id: c.req.param('id') })
                this.#journal.entries.push(`page of ${talk.id}`)
                return c.html(`<h1>${talk.title}</h1>`)
            })
            .post('/pages/talks/:id/rename', async (c, run) => {
                const form = await c.req.parseBody()
                await run(RenameTalk, { id: c.req.param('id'), title: form.title })
                return c.redirect(`/pages/talks/${c.req.param('id')}`, 303)
            })
    }
}

/** The whole conference over web: every route of the talks, the cookie authenticator and authorization. */
export async function conference(
    configure: (w: import('../../src/index.js').WebBuilder) => void = () => {},
): Promise<{ readonly fetch: (request: Request) => Promise<Response>; readonly journal: Journal }> {
    const { Services } = await import('@caucejs/di')
    const { application, Authorization } = await import('@caucejs/application')
    const { jsonSerializer } = await import('@caucejs/schema')
    const { Web, web } = await import('../../src/index.js')
    const provider = new Services()
        .addSingleton(Talks, Talks)
        .addSingleton(Journal, Journal)
        .add(
            jsonSerializer(),
            application(app =>
                app
                    .use(Authorization)
                    .handle(GetTalk, GetTalkHandler)
                    .handle(RenameTalk, RenameTalkHandler)
                    .handle(ArchiveTalk, ArchiveTalkHandler)
                    .handle(TagTalk, TagTalkHandler)
                    .handle(SellTicket, SellTicketHandler)
                    .handle(Explode, ExplodeHandler),
            ),
            web(w => {
                w.authenticateWith(CookieAuthenticator).controller(TalksController)
                configure(w)
            }),
        )
        .build({ validate: true })
    return { fetch: provider.get(Web).fetch, journal: provider.get(Journal) }
}
