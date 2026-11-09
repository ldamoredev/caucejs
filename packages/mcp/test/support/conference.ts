import {
    AnonymousIdentity,
    application,
    Authorization,
    Command,
    Handler,
    Identity,
    Middleware,
    NotAuthenticatedError,
    Query,
    UseCases,
    type ExecutionContext,
    type Next,
    type Request as UseCaseRequest,
} from '@caucejs/application'
import { DomainError, NotFoundError } from '@caucejs/base'
import { Services, type Injectable, type Provider } from '@caucejs/di'
import { jsonSerializer } from '@caucejs/schema'
import { TestClient } from '@caucejs/testing'
import { tool, ToolRunner, tools, type UseCaseTool } from '@caucejs/tools'
import { Authenticator, Controller, ProblemResponder, Web, web, type Problem, type Routes } from '@caucejs/web'
import * as z from 'zod'

import { McpController, type McpOptions, type McpTools } from '../../src/index.js'

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

    all(): readonly Talk[] {
        return [...this.#talks.values()]
    }

    update(talk: Talk): void {
        this.#talks.set(talk.id, talk)
    }
}

/** What the middleware saw, and what the handlers were given. */
export class Journal {
    readonly entries: string[] = []
}

export class SoldOutError extends DomainError {
    constructor(options?: ErrorOptions) {
        super('The talk has no seats left', options)
    }
}

export class GetTalk extends Query.returning<Talk>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly anonymous = true
}
export class ListTitles extends Query.returning<string[]>().from(z.strictObject({})) {
    static readonly anonymous = true
}
export class SellTicket extends Command.returning<number>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly permissions = ['tickets']
}
export class ReturnTicket extends Command.from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly permissions = ['tickets']
}
export class RetitleTalk extends Command.returning<Talk>().from(z.strictObject({ talkId: z.string(), title: z.string() })) {
    static readonly permissions = ['program']
}
export class WhoAmI extends Query.returning<string>().from(z.strictObject({})) {}
export class PrintBadges extends Command.from(z.strictObject({})) {
    static readonly anonymous = true
}
export class ScheduleTalk extends Command.from(z.strictObject({ at: z.bigint() })) {
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

export class ListTitlesHandler extends Handler.of(ListTitles) {
    static readonly inject = [Talks] as const
    readonly #talks: Talks
    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }
    async execute(): Promise<string[]> {
        return this.#talks.all().map(talk => talk.title)
    }
}

export class SellTicketHandler extends Handler.of(SellTicket) {
    static readonly inject = [Talks, Journal] as const
    readonly #talks: Talks
    readonly #journal: Journal
    constructor(talks: Talks, journal: Journal) {
        super()
        this.#talks = talks
        this.#journal = journal
    }
    async execute(request: SellTicket, context: ExecutionContext): Promise<number> {
        this.#journal.entries.push(`${context.identity.name} sells ${request.talkId}`)
        const talk = this.#talks.get(request.talkId)
        if (talk.seats === 0) throw new SoldOutError()
        this.#talks.update({ ...talk, seats: talk.seats - 1 })
        return talk.seats - 1
    }
}

export class ReturnTicketHandler extends Handler.of(ReturnTicket) {
    static readonly inject = [Talks] as const
    readonly #talks: Talks
    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }
    async execute(request: ReturnTicket): Promise<void> {
        const talk = this.#talks.get(request.talkId)
        this.#talks.update({ ...talk, seats: talk.seats + 1 })
    }
}

export class RetitleTalkHandler extends Handler.of(RetitleTalk) {
    static readonly inject = [Talks] as const
    readonly #talks: Talks
    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }
    async execute(request: RetitleTalk): Promise<Talk> {
        const talk = { ...this.#talks.get(request.talkId), title: request.title }
        this.#talks.update(talk)
        return talk
    }
}

export class WhoAmIHandler extends Handler.of(WhoAmI) {
    async execute(_request: WhoAmI, context: ExecutionContext): Promise<string> {
        return context.identity.name
    }
}

export class PrintBadgesHandler extends Handler.of(PrintBadges) {
    async execute(): Promise<void> {
        throw new Error('The printer is out of paper')
    }
}

export class ScheduleTalkHandler extends Handler.of(ScheduleTalk) {
    async execute(): Promise<void> {}
}

export class Recording extends Middleware {
    static readonly inject = [Journal] as const
    readonly #journal: Journal
    constructor(journal: Journal) {
        super()
        this.#journal = journal
    }
    async execute<R>(request: UseCaseRequest<R>, context: ExecutionContext, next: Next<R>): Promise<R> {
        this.#journal.entries.push(`${context.identity.name} runs ${request.constructor.name}`)
        return next()
    }
}

export const getTalk = tool(GetTalk, { name: 'get_talk', description: 'A talk of the conference, by its id' })
export const listTitles = tool(ListTitles, { name: 'list_titles', description: 'The titles of every talk' })
export const sellTicket = tool(SellTicket, { name: 'sell_ticket', description: 'Sells one seat of a talk, and answers the seats left' })
export const returnTicket = tool(ReturnTicket, { name: 'return_ticket', description: 'Gives one seat of a talk back' })
export const retitleTalk = tool(RetitleTalk, { name: 'retitle_talk', description: 'Changes the title of a talk' })
export const whoAmI = tool(WhoAmI, { name: 'who_am_i', description: 'Who calls' })
export const printBadges = tool(PrintBadges, { name: 'print_badges', description: 'Prints the badges of the speakers' })
export const scheduleTalk = tool(ScheduleTalk, { name: 'schedule_talk', description: 'Schedules a talk' })

export const everyTool: readonly UseCaseTool[] = [getTalk, listTitles, sellTicket, returnTicket, retitleTalk, whoAmI, printBadges]

export class BoxOffice extends Identity {
    readonly name = 'box office'
    readonly isAuthenticated = true
    can(permission: string): boolean {
        return permission === 'tickets'
    }
}

export class Usher extends Identity {
    readonly name = 'usher'
    readonly isAuthenticated = true
    can(): boolean {
        return false
    }
}

export class Organizer extends Identity {
    readonly name = 'organizer'
    readonly isAuthenticated = true
    can(permission: string): boolean {
        return permission === 'program'
    }
}

/** The endpoint's own: a token in the header, or in the path when the endpoint is mounted with `:token`. */
export class BoxOfficeTokens extends Authenticator {
    async authenticate(request: Request): Promise<Identity> {
        const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? new URL(request.url).pathname.split('/').at(-1)
        if (token === 'box-office') return new BoxOffice()
        if (token === 'usher') return new Usher()
        // a token that says something can be refused by throwing, and the vault behind it can fail
        if (token === 'expired') throw new NotAuthenticatedError()
        if (token === 'broken') throw new Error('The vault of tokens is down')
        return new AnonymousIdentity()
    }
}

/** The application's own: a session cookie, for its pages. */
export class SessionCookie extends Authenticator {
    async authenticate(request: Request): Promise<Identity> {
        return (request.headers.get('cookie') ?? '').includes('session=organizer') ? new Organizer() : new AnonymousIdentity()
    }
}

/** What an application of pages does with its problems: nobody, and what is not found, go to the login. */
export class LoginRedirect extends ProblemResponder {
    respond(problem: Problem, c: Parameters<ProblemResponder['respond']>[1]): Response | undefined {
        return problem.status === 401 || problem.status === 404 ? c.redirect('/login', 302) : undefined
    }
}

export class Pages extends Controller {
    registerRoutes(routes: Routes): void {
        routes.get('/pages/who', WhoAmI, { html: name => `<p>${name}</p>` })
    }
}

export type EndpointOptions = Partial<Omit<McpOptions, 'authenticator'>> & { readonly tools?: readonly UseCaseTool[] }

export type EndpointClass = Injectable<McpController, readonly [typeof ToolRunner, typeof UseCases, typeof BoxOfficeTokens]>

/** A server of MCP with the options given: the conference on `/mcp`, with every tool, by default. */
export function endpoint(options: EndpointOptions = {}): EndpointClass {
    const { tools: added = everyTool, ...rest } = options
    return class ConferenceMcp extends McpController {
        static readonly inject = [ToolRunner, UseCases, BoxOfficeTokens] as const
        constructor(runner: ToolRunner, useCases: UseCases, tokens: BoxOfficeTokens) {
            super(runner, useCases, { path: '/mcp', name: 'conference', version: '1.0.0', ...rest, authenticator: tokens })
        }
        registerTools(tools: McpTools): void {
            for (const tool of added) tools.add(tool)
        }
    }
}

export type ConferenceOptions = {
    readonly endpoint?: EndpointClass
    /** The application's pages, its session and its problems answered as redirects. */
    readonly pages?: boolean
    /** Leaves the handler of SellTicket out. */
    readonly withoutSelling?: boolean
    readonly scheduling?: boolean
}

/** The application, built through the container the way a web application is. */
export function conference(options: ConferenceOptions = {}): Provider {
    const services = new Services()
    services.addSingleton(Talks)
    services.addSingleton(Journal)
    services.addSingleton(BoxOfficeTokens)
    services.add(jsonSerializer())
    services.add(tools())
    services.add(
        application(app => {
            app.use(Recording)
            app.use(Authorization)
            app.handle(GetTalkHandler)
            app.handle(ListTitlesHandler)
            if (!options.withoutSelling) app.handle(SellTicketHandler)
            app.handle(ReturnTicketHandler)
            app.handle(RetitleTalkHandler)
            app.handle(WhoAmIHandler)
            app.handle(PrintBadgesHandler)
            if (options.scheduling) app.handle(ScheduleTalkHandler)
        }),
    )
    services.add(
        web(w => {
            if (options.pages) {
                w.authenticateWith(SessionCookie)
                w.respondToProblemsWith(LoginRedirect)
                w.controller(Pages)
            }
            w.controller(options.endpoint ?? endpoint())
        }),
    )
    return services.build({ validate: true })
}

/** A client of the revisions of 2025, which need no handshake without state. */
export function clientOf(provider: Provider): TestClient {
    return new TestClient(provider.get(Web).fetch, {
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25' },
    })
}

/** What a client of one revision sends for a call to a tool: the headers and the body. */
export type Revision = {
    readonly name: string
    readonly call: (name: string, input: unknown) => { readonly headers: Record<string, string>; readonly json: unknown }
}

const meta = {
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientInfo': { name: 'box office', version: '1.0.0' },
    'io.modelcontextprotocol/clientCapabilities': {},
}

/** Both revisions the endpoint speaks. 2026-07-28 names the method and the tool in headers, and its version in _meta. */
export const revisions: readonly Revision[] = [
    { name: '2025-11-25', call: (name, input) => ({ headers: {}, json: callOf(name, input) }) },
    {
        name: '2026-07-28',
        call: (name, input) => ({
            headers: { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/call', 'mcp-name': name },
            json: rpc('tools/call', { name, arguments: input, _meta: meta }),
        }),
    },
]

let ids = 0

export function rpc(method: string, params?: Record<string, unknown>): Record<string, unknown> {
    ids += 1
    return { jsonrpc: '2.0', id: ids, method, ...(params !== undefined && { params }) }
}

export function callOf(name: string, input: unknown): Record<string, unknown> {
    return rpc('tools/call', { name, arguments: input })
}
