// The canonical web, to copy: a controller whose routes are use cases, declared with the class of their request,
// a page that is one too, and a route written by hand; an authenticator; the middlewares of Hono; and the fetch of the
// application, which a server serves and a test calls in memory, as here. On Node, an application composes the same
// with WebApplication.builder(), in @caucejs/node.
import { AnonymousIdentity, application, Authorization, Command, Handler, Identity, Query } from '@caucejs/application'
import { NotFoundError } from '@caucejs/base'
import { Services } from '@caucejs/di'
import { jsonSerializer } from '@caucejs/schema'
import { TestClient } from '@caucejs/testing'
import type { Context } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import * as z from 'zod'

import { Authenticator, Controller, ProblemResponder, Web, web, type Problem, type Routes, type WebEnv } from '../src/index.js'

export type Talk = { readonly id: string; readonly title: string }

export class Talks {
    readonly #talks = new Map<string, Talk>([['opening', { id: 'opening', title: 'Opening' }]])
    get(id: string): Talk {
        const talk = this.#talks.get(id)
        if (!talk) throw new NotFoundError('There is no such talk')
        return talk
    }
    save(talk: Talk): void {
        this.#talks.set(talk.id, talk)
    }
}

// The requests: their fields come from their schema, which is also how web reads them.
export class GetTalk extends Query.returning<Talk>().from(z.strictObject({ id: z.string() })) {
    static readonly anonymous = true
}
export class RenameTalk extends Command.returning<Talk>().from(z.strictObject({ id: z.string(), title: z.string().trim().min(1) })) {
    static readonly permissions = ['talks']
}

export class GetTalkHandler extends Handler.of(GetTalk) {
    static readonly inject = [Talks] as const
    readonly #talks: Talks
    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }
    async execute(request: GetTalk): Promise<Talk> {
        return this.#talks.get(request.id)
    }
}

export class RenameTalkHandler extends Handler.of(RenameTalk) {
    static readonly inject = [Talks] as const
    readonly #talks: Talks
    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }
    async execute(request: RenameTalk): Promise<Talk> {
        const talk = { ...this.#talks.get(request.id), title: request.title }
        this.#talks.save(talk)
        return talk
    }
}

// A controller: routes that are use cases name their request, and a page is one that writes HTML. A route that is not
// a use case is written by hand, inline, never as a method.
export class TalksController extends Controller {
    registerRoutes(routes: Routes): void {
        routes.get('/talks/:id', GetTalk)
        routes.post('/talks/:id/title', RenameTalk)
        routes.post('/talks/:id/rename', RenameTalk, { redirect: talk => `/pages/talks/${talk.id}` })
        routes.get('/pages/talks/:id', GetTalk, { html: talk => `<h1>${talk.title}</h1>` })
        routes.get('/healthz', c => c.text('ok'))
    }
}

// Who makes each request. Here a cookie names the organizer; a real one checks a signed session.
export class Organizer extends Identity {
    readonly name = 'organizer'
    readonly isAuthenticated = true
    can(permission: string): boolean {
        return permission === 'talks'
    }
}

export class SessionCookie extends Authenticator {
    async authenticate(request: Request): Promise<Identity> {
        return (request.headers.get('cookie') ?? '').includes('session=organizer') ? new Organizer() : new AnonymousIdentity()
    }
}

// An application of pages answers some problems itself: nobody goes to the login, instead of a 401. It answers
// through Hono's context: `Response.redirect` builds a response whose headers cannot change, and a middleware that
// adds headers, such as secureHeaders, would then fail.
export class LoginRedirect extends ProblemResponder {
    respond(problem: Problem, c: Context<WebEnv>): Response | undefined {
        return problem.status === 401 ? c.redirect('/login', 302) : undefined
    }
}

export async function visitTheConference(): Promise<string[]> {
    const services = new Services()
    services.addSingleton(Talks)
    services.add(jsonSerializer())
    services.add(
        application(app => {
            app.use(Authorization)
            app.handle(GetTalkHandler)
            app.handle(RenameTalkHandler)
        }),
    )
    services.add(
        web(w => {
            w.use(secureHeaders())
            w.authenticateWith(SessionCookie)
            w.respondToProblemsWith(LoginRedirect)
            w.controller(TalksController)
        }),
    )
    const provider = services.build({ validate: true })

    // a server serves this fetch; a test calls it in memory
    const client = new TestClient(provider.get(Web).fetch)
    const organizer = client.with({ headers: { cookie: 'session=organizer' } })

    const talk = await client.get('/talks/opening')
    const refused = await client.post('/talks/opening/title', { json: { title: 'Keynote' } })
    const renamed = await organizer.post('/talks/opening/rename', { form: { title: 'Keynote' } })
    const page = await client.get('/pages/talks/opening')
    const missing = await client.get('/talks/closing')

    return [
        `GET /talks/opening: ${talk.status} ${talk.text}`,
        `anonymous rename: ${refused.status} to ${refused.headers.get('location')}`,
        `organizer rename: ${renamed.status} to ${renamed.headers.get('location')}`,
        `the page: ${page.text}, with ${page.headers.get('x-frame-options')}`,
        `a missing talk: ${missing.status} ${missing.headers.get('content-type')}`,
    ]
}
