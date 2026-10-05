// The canonical extension: copy its shape when a package adds what it brings to the container.
import { Clock, SystemClock } from '@caucejs/base'

import { Services, type Extension } from '../src/index.js'

// A Symbol is the identity: another package that also says "ticketing" is another extension.
// Its description is what errors print.
const clockId = Symbol('clock')
const ticketingId = Symbol('ticketing')

export type TicketingOptions = { readonly capacity: number }

// The options travel as a service of their own, so the classes that need them list them in inject
// like any other dependency, and the validation sees them.
export class TicketingSettings {
    readonly capacity: number

    constructor(capacity: number) {
        this.capacity = capacity
    }
}

export abstract class Tickets {
    abstract sell(talkId: string): number
}

export class InMemoryTickets extends Tickets {
    static readonly inject = [TicketingSettings, Clock] as const
    readonly #settings: TicketingSettings
    readonly #clock: Clock
    readonly #sold = new Map<string, number>()

    constructor(settings: TicketingSettings, clock: Clock) {
        super()
        this.#settings = settings
        this.#clock = clock
    }

    sell(talkId: string): number {
        const sold = (this.#sold.get(talkId) ?? 0) + 1
        if (sold > this.#settings.capacity) throw new Error(`Talk ${talkId} is sold out at ${this.#clock.now().toISOString()}`)
        this.#sold.set(talkId, sold)
        return sold
    }
}

// An extension is a function that returns an object, so it is passed as a value: services.add(clock()).
export function clock(): Extension {
    return {
        id: clockId,
        options: undefined,
        requires: [],
        register: services => services.addSingleton(Clock, SystemClock),
    }
}

export function ticketing(options: TicketingOptions): Extension {
    return {
        id: ticketingId,
        // Compared when the extension comes twice: the same options do nothing, other options fail.
        options,
        // It needs a clock and never adds one: the application adds it, so it sees everything it runs.
        requires: [clockId],
        register: services =>
            services.addInstance(TicketingSettings, new TicketingSettings(options.capacity)).addSingleton(Tickets, InMemoryTickets),
    }
}

// The application, where the order of add does not matter: requires is checked when it is built.
export async function sellOneTicket(): Promise<number> {
    await using provider = new Services().add(ticketing({ capacity: 300 }), clock()).build({ validate: true })
    return provider.get(Tickets).sell('opening-keynote')
}
