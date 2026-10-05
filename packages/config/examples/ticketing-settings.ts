// The canonical settings: copy its shape when a module reads its configuration.
import { Services } from '@caucejs/di'

import { Config, environment, memory, settings, type StandardSchemaV1 } from '../src/index.js'

type Ticketing = { readonly capacity: number; readonly currency: string }

// Any Standard Schema works: Zod, Valibot or ArkType write this in one line. It is written by hand here so the
// example depends on no validator. Every value arrives as text, whichever source set it, so the schema converts
// the capacity.
const ticketing: StandardSchemaV1<unknown, Ticketing> = {
    '~standard': {
        version: 1,
        vendor: 'conference',
        validate(input) {
            const { capacity, currency } = (input ?? {}) as Record<string, unknown>
            const seats = typeof capacity === 'string' && /^\d+$/.test(capacity) ? Number(capacity) : null
            if (seats === null) return { issues: [{ message: 'Expected a number of seats', path: ['capacity'] }] }
            if (typeof currency !== 'string') return { issues: [{ message: 'Expected a currency', path: ['currency'] }] }
            return { value: { capacity: seats, currency } }
        },
    },
}

// The class is the token: a service lists it in inject like any other dependency.
export class TicketingSettings extends settings('ticketing', ticketing) {}

export class BoxOffice {
    static readonly inject = [TicketingSettings] as const
    readonly #settings: TicketingSettings

    constructor(settings: TicketingSettings) {
        this.#settings = settings
    }

    seatsLeft(sold: number): number {
        return this.#settings.capacity - sold
    }
}

export function openBoxOffice(variables: Readonly<Record<string, string | undefined>>): BoxOffice {
    // The defaults first and the environment last, because the last source that sets a key wins:
    // TICKETING__CAPACITY=450 overrides the 300.
    const config = new Config()
        .add(memory({ ticketing: { capacity: 300, currency: 'ARS' } }))
        .add(environment(variables))

    // Bound while composing, so a wrong value fails here, before the container is built.
    return new Services()
        .addInstance(TicketingSettings, config.bind(TicketingSettings))
        .addSingleton(BoxOffice, BoxOffice)
        .build({ validate: true })
        .get(BoxOffice)
}
