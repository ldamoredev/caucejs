// The canonical way to read a request, to copy: the class says how it is read with a `static readonly schema` that
// produces the class itself. The JsonSerializer of the container reads a body into it or into a ValidationError,
// writes values back, and describes what a request takes, for a model. In an application `web` and the tools of a
// model call it; here it is called by hand. Any Standard Schema library works; this one uses Zod.
import { Services } from '@caucejs/di'
import * as z from 'zod'

import { JsonSerializer, jsonSerializer, ValidationError } from '../src/index.js'

// A value of the domain writes itself: JSON.stringify calls toJSON, so writing needs no schema.
export class Money {
    readonly cents: number

    constructor(cents: number) {
        this.cents = cents
    }

    static parse(text: string): Money {
        const [whole = '0', decimals = ''] = text.split('.')
        return new Money(Number(whole) * 100 + Number(decimals.padEnd(2, '0')))
    }

    toJSON(): string {
        return (this.cents / 100).toFixed(2)
    }
}

export class SellTickets {
    // Strict, so a field the request does not have is refused instead of ignored.
    static readonly schema = z
        .strictObject({
            talk: z.string().min(1).describe('The id of the talk'),
            seats: z.int().positive(),
            price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Use a dot for the decimals').describe('The price of each seat, like 10.50'),
        })
        .describe('Sells seats of a talk')
        .transform(({ talk, seats, price }) => new SellTickets(talk, seats, Money.parse(price)))

    readonly talk: string
    readonly seats: number
    readonly price: Money

    constructor(talk: string, seats: number, price: Money) {
        this.talk = talk
        this.seats = seats
        this.price = price
    }
}

export async function readTheBoxOffice(): Promise<string[]> {
    const serializer = new Services().add(jsonSerializer()).build({ validate: true }).get(JsonSerializer)

    const sold = await serializer.read(SellTickets, { talk: 'opening', seats: 2, price: '10.50' })
    const refused = await serializer.read(SellTickets, { talk: '', seats: 0, price: '10,50', vip: true }).catch((error: ValidationError) => error)
    const tool = serializer.schemaOf(SellTickets)

    return [
        `${sold.seats} seats of ${sold.talk} at ${serializer.write(sold.price)}`,
        ...(refused instanceof ValidationError ? refused.issues.map(issue => `${issue.path || 'the request'}: ${issue.message}`) : []),
        `a model is told: ${String(tool.description)}, with ${Object.keys(tool.properties as object).join(', ')}`,
    ]
}
