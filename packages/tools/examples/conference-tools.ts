// The canonical tools, to copy: two use cases of the conference described as tools, once, and called the way a
// server of MCP or a model calls them, with what the caller reads when a call fails. Nothing here talks to a model:
// `@caucejs/mcp` and `@caucejs/ai` take these same tools.
import { application, Authorization, Command, ExecutionContext, Handler, Identity, Query } from '@caucejs/application'
import { DomainError, NotFoundError } from '@caucejs/base'
import { Services } from '@caucejs/di'
import { jsonSerializer } from '@caucejs/schema'
import * as z from 'zod'

import { tool, ToolRunner, tools } from '../src/index.js'

export type Talk = { readonly id: string; readonly title: string; readonly seats: number }

export class Talks {
    readonly #talks = new Map<string, Talk>([['opening', { id: 'opening', title: 'Opening', seats: 1 }]])

    get(id: string): Talk {
        const talk = this.#talks.get(id)
        // an error of the domain, so the caller of a tool reads it: a plain Error would read as "Tool execution failed"
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

// The requests are the ones the application already has: the schema that reads a web request reads the input of a
// tool, and says what it takes as JSON Schema.
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

// A tool is a value, next to its request. GetTalk is a query, so the tool is read only; SellTicket is not.
export const getTalk = tool(GetTalk, { name: 'get_talk', description: 'A talk of the conference, by its id' })
export const sellTicket = tool(SellTicket, { name: 'sell_ticket', description: 'Sells one seat of a talk, and answers the seats left' })

export class BoxOffice extends Identity {
    readonly name = 'box office'
    readonly isAuthenticated = true

    can(permission: string): boolean {
        return permission === 'tickets'
    }
}

export async function callTheTools(): Promise<string[]> {
    const services = new Services()
    services.addSingleton(Talks)
    services.add(jsonSerializer())
    services.add(tools())
    services.add(
        application(app => {
            app.use(Authorization)
            app.handle(GetTalkHandler)
            app.handle(SellTicketHandler)
        }),
    )
    await using provider = services.build({ validate: true })
    const runner = provider.get(ToolRunner)

    // what a model or a client of MCP is told
    const described = [getTalk, sellTicket].map(tool => runner.describe(tool))

    // whoever exposes the tools opens the scope and says who calls them, as web does for a request
    await using scope = provider.createScope()
    const boxOffice = { scope, context: ExecutionContext.of(new BoxOffice()) }
    const talk = await runner.call(getTalk, { talkId: 'opening' }, { scope })
    const sold = await runner.call(sellTicket, { talkId: 'opening' }, boxOffice)
    // what fails comes back, for the caller to read: the domain says why, and so does an input that does not pass
    const soldOut = await runner.call(sellTicket, { talkId: 'opening' }, boxOffice)
    const wrong = await runner.call(sellTicket, { talk: 'opening' }, boxOffice)
    const missing = await runner.call(getTalk, { talkId: 'keynote' }, { scope })

    return [
        ...described.map(({ name, readOnly, inputSchema }) => `${name}${readOnly ? ', read only,' : ''} takes ${JSON.stringify(inputSchema['required'])}`),
        ...[talk, sold, soldOut, wrong, missing].map(outcome => (outcome.ok ? outcome.json : `failed: ${outcome.message}`)),
    ]
}
