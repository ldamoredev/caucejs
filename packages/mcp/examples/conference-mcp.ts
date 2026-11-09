// The canonical server of MCP, to copy: two use cases of the conference described as tools, a controller that serves
// them over HTTP, and an authenticator of its own that turns a token into the box office. A client of MCP calls it in
// memory, as here, through the fetch of the application. On Node, a module composes the same with
// WebApplication.builder(), in @caucejs/node:
//
//     app.services.add(tools())
//     app.addSettings(BoxOfficeSettings)
//     app.services.addSingleton(BoxOfficeTokens)
//     app.useCases.use(Authorization)
//     app.useCases.handle(GetTalkHandler)
//     app.useCases.handle(SellTicketHandler)
//     app.web.controller(ConferenceMcp)
import { AnonymousIdentity, application, Authorization, Command, Handler, Identity, Query, UseCases } from '@caucejs/application'
import { DomainError, NotFoundError } from '@caucejs/base'
import { Services } from '@caucejs/di'
import { jsonSerializer } from '@caucejs/schema'
import { TestClient } from '@caucejs/testing'
import { tool, ToolRunner, tools } from '@caucejs/tools'
import { Authenticator, Web, web } from '@caucejs/web'
import * as z from 'zod'

import { McpController, type McpTools } from '../src/index.js'

export type Talk = { readonly id: string; readonly title: string; readonly seats: number }

export class Talks {
    readonly #talks = new Map<string, Talk>([['opening', { id: 'opening', title: 'Opening', seats: 1 }]])

    get(id: string): Talk {
        const talk = this.#talks.get(id)
        // an error of the domain, so the client reads it: a plain Error would read as "Tool execution failed"
        if (!talk) throw new NotFoundError(`There is no talk ${id}`)
        return talk
    }

    update(talk: Talk): void {
        this.#talks.set(talk.id, talk)
    }
}

export class SoldOutError extends DomainError {
    constructor(options?: ErrorOptions) {
        super('The talk has no seats left', options)
    }
}

export class GetTalk extends Query.returning<Talk>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly anonymous = true
}

export class SellTicket extends Command.returning<number>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly permissions = ['tickets']
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

export class SellTicketHandler extends Handler.of(SellTicket) {
    static readonly inject = [Talks] as const
    readonly #talks: Talks

    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }

    async execute(request: SellTicket): Promise<number> {
        const talk = this.#talks.get(request.talkId)
        if (talk.seats === 0) throw new SoldOutError()
        this.#talks.update({ ...talk, seats: talk.seats - 1 })
        return talk.seats - 1
    }
}

// The tools are the same values @caucejs/tools describes, and @caucejs/ai gives to a model.
export const getTalk = tool(GetTalk, { name: 'get_talk', description: 'A talk of the conference, by its id' })
export const sellTicket = tool(SellTicket, { name: 'sell_ticket', description: 'Sells one seat of a talk, and answers the seats left' })

export class BoxOffice extends Identity {
    readonly name = 'box office'
    readonly isAuthenticated = true

    can(permission: string): boolean {
        return permission === 'tickets'
    }
}

// Where the token comes from: in an application, a settings class bound from the configuration.
export class BoxOfficeSettings {
    readonly token: string = 'box-office-secret'
}

// The endpoint's own authenticator: the token opens the endpoint, and nothing else. The application compares it, not
// mcp; a real one compares in constant time, so the time it takes says nothing of how much of the token was right.
export class BoxOfficeTokens extends Authenticator {
    static readonly inject = [BoxOfficeSettings] as const
    readonly #settings: BoxOfficeSettings

    constructor(settings: BoxOfficeSettings) {
        super()
        this.#settings = settings
    }

    async authenticate(request: Request): Promise<Identity> {
        return bearerTokenOf(request) === this.#settings.token ? new BoxOffice() : new AnonymousIdentity()
    }
}

function bearerTokenOf(request: Request): string | null {
    const [scheme, token] = (request.headers.get('authorization') ?? '').split(' ')
    return scheme?.toLowerCase() === 'bearer' && token ? token : null
}

// The server: its options in the constructor, its tools in registerTools. UseCases is there so a tool without a
// handler fails when the web is built, not when a client first calls it.
export class ConferenceMcp extends McpController {
    static readonly inject = [ToolRunner, UseCases, BoxOfficeTokens] as const

    constructor(runner: ToolRunner, useCases: UseCases, tokens: BoxOfficeTokens) {
        super(runner, useCases, { path: '/mcp', name: 'conference', version: '1.0.0', authenticator: tokens })
    }

    registerTools(tools: McpTools): void {
        tools.add(getTalk)
        tools.add(sellTicket)
    }
}

export async function callTheConference(): Promise<string[]> {
    const services = new Services()
    services.addSingleton(Talks)
    services.addSingleton(BoxOfficeSettings)
    services.addSingleton(BoxOfficeTokens)
    services.add(jsonSerializer())
    services.add(tools())
    services.add(
        application(app => {
            app.use(Authorization)
            app.handle(GetTalkHandler)
            app.handle(SellTicketHandler)
        }),
    )
    services.add(web(w => w.controller(ConferenceMcp)))
    await using provider = services.build({ validate: true })

    // a client of MCP sends JSON-RPC over POST; without state, a request of the revisions of 2025 needs no handshake
    const client = new TestClient(provider.get(Web).fetch, {
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-11-25' },
    })
    const boxOffice = client.with({ headers: { authorization: 'Bearer box-office-secret' } })
    const call = (id: number, name: string, input: unknown) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: input } })

    const nobody = await client.post('/mcp', { json: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })
    const listed = await boxOffice.post('/mcp', { json: { jsonrpc: '2.0', id: 2, method: 'tools/list' } })
    const sold = await boxOffice.post('/mcp', { json: call(3, 'sell_ticket', { talkId: 'opening' }) })
    const soldOut = await boxOffice.post('/mcp', { json: call(4, 'sell_ticket', { talkId: 'opening' }) })
    const oauth = await client.get('/.well-known/oauth-protected-resource/mcp')

    return [
        `without a token: ${nobody.status} ${nobody.headers.get('www-authenticate')}`,
        `listed: ${namesOf(listed.json())}`,
        `sold: ${textOf(sold.json())}`,
        `sold out: ${textOf(soldOut.json())}`,
        `looking for OAuth: ${oauth.status}`,
    ]
}

type ToolsList = { readonly result: { readonly tools: readonly { readonly name: string }[] } }
type ToolCall = { readonly result: { readonly content: readonly { readonly text: string }[]; readonly isError?: boolean } }

function namesOf(body: unknown): string {
    return (body as ToolsList).result.tools.map(tool => tool.name).join(', ')
}

function textOf(body: unknown): string {
    const { result } = body as ToolCall
    return `${result.isError ? 'failed, ' : ''}${result.content.map(content => content.text).join('')}`
}
