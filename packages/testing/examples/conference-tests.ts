// The canonical test support, to copy: examples, an example per aggregate next to it, a scenario over the
// container, and a client that calls the application in memory. The application is a few lines of fetch handler so
// the example depends on no web framework; with Hono it would be `app.fetch`.
import { Services } from '@caucejs/di'

import { Examples, Scenario, TestClient, type Example } from '../src/index.js'

// ── the application under test ──

export type Talk = { readonly id: string; readonly title: string; readonly keynote: boolean }
export type Ticket = { readonly id: string; readonly talkId: string; readonly holder: string }

export abstract class Talks {
    abstract add(talk: Talk): void
    abstract find(id: string): Talk | null
}

export abstract class Tickets {
    abstract add(ticket: Ticket): void
    abstract of(talkId: string): readonly Ticket[]
}

export class InMemoryTalks extends Talks {
    readonly #talks = new Map<string, Talk>()
    add(talk: Talk): void {
        this.#talks.set(talk.id, talk)
    }
    find(id: string): Talk | null {
        return this.#talks.get(id) ?? null
    }
}

export class InMemoryTickets extends Tickets {
    static readonly inject = [Talks] as const
    readonly #talks: Talks
    readonly #tickets: Ticket[] = []

    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }

    add(ticket: Ticket): void {
        // like a foreign key: a ticket needs its talk saved first
        if (this.#talks.find(ticket.talkId) === null) throw new Error(`No talk ${ticket.talkId}`)
        this.#tickets.push(ticket)
    }

    of(talkId: string): readonly Ticket[] {
        return this.#tickets.filter(ticket => ticket.talkId === talkId)
    }
}

export function conferenceApp(talks: Talks, tickets: Tickets): (request: Request) => Promise<Response> {
    return async request => {
        const url = new URL(request.url)
        const id = url.pathname.split('/')[2] ?? ''
        if (request.method === 'GET' && url.pathname.startsWith('/talks/')) {
            const talk = talks.find(id)
            if (talk === null) return new Response('No such talk', { status: 404 })
            return Response.json({ ...talk, tickets: tickets.of(id).length })
        }
        if (request.method === 'POST' && url.pathname === '/talks') {
            if (request.headers.get('authorization') !== 'Bearer organizer') return new Response(null, { status: 401 })
            const { title } = (await request.json()) as { title: string }
            const talk = { id: `talk-${title.toLowerCase()}`, title, keynote: false }
            talks.add(talk)
            return Response.json({ id: talk.id }, { status: 201 })
        }
        return new Response(null, { status: 404 })
    }
}

// ── the test support: it lives in the application, next to each aggregate ──

const titles = new Examples('Types at scale', 'Testing in production', 'The last mile')
const holders = new Examples('Valeria', 'Facundo', 'Zoe')
const ids = new Examples(...Array.from({ length: 100 }, (_, index) => index + 1))

class TicketBuilder {
    #holder = holders.one()
    holder(value: string): this {
        this.#holder = value
        return this
    }
    build(talkId: string): Ticket {
        return { id: `ticket-${ids.one()}`, talkId, holder: this.#holder }
    }
}

class TalkBuilder {
    #title = titles.one()
    #keynote = false
    readonly #tickets: ((ticket: TicketBuilder) => void)[] = []
    title(value: string): this {
        this.#title = value
        return this
    }
    keynote(): this {
        this.#keynote = true
        return this
    }
    // a child: built with the talk, saved after it
    ticket(details: (ticket: TicketBuilder) => void = () => {}): this {
        this.#tickets.push(details)
        return this
    }
    build(declareTicket: (example: Example<Ticket>) => Ticket): Talk {
        const talk = { id: `talk-${ids.one()}`, title: this.#title, keynote: this.#keynote }
        for (const details of this.#tickets) declareTicket(ticketOf(talk.id, details))
        return talk
    }
}

function ticketOf(talkId: string, details: (ticket: TicketBuilder) => void): Example<Ticket> {
    return {
        build: () => {
            const builder = new TicketBuilder()
            details(builder)
            return builder.build(talkId)
        },
        save: (resolver, ticket) => resolver.get(Tickets).add(ticket),
    }
}

export function talk(details: (talk: TalkBuilder) => void = () => {}): Example<Talk> {
    return {
        build: context => {
            const builder = new TalkBuilder()
            details(builder)
            return builder.build(example => context.child(example))
        },
        save: (resolver, built) => resolver.get(Talks).add(built),
    }
}

// ── a test, written as a function so that it compiles and runs in CI ──

export async function testTheConference(): Promise<string[]> {
    const provider = new Services().addSingleton(Talks, InMemoryTalks).addSingleton(Tickets, InMemoryTickets).build({ validate: true })
    const scenario = new Scenario(provider)
    const client = new TestClient(conferenceApp(provider.get(Talks), provider.get(Tickets)))
    const organizer = client.with({ headers: { authorization: 'Bearer organizer' } })

    const keynote = await scenario.add(talk(t => t.keynote().title('Opening').ticket(k => k.holder('Ana')).ticket()))
    const draft = scenario.make(talk())

    const shown = await client.get(`/talks/${keynote.id}`)
    const missing = await client.get(`/talks/${draft.id}`)
    const created = await organizer.post('/talks', { json: { title: 'Closing' } })
    const refused = await client.post('/talks', { json: { title: 'Closing' } })

    shown.succeeds()
    missing.failsWith(404)
    created.succeeds(201)
    refused.failsWith(401)
    return [JSON.stringify(shown.json()), JSON.stringify(created.json())]
}
