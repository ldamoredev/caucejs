import { Services } from '@caucejs/di'
import { describe, expect, it } from 'vitest'
import * as z from 'zod'

import { application, Command, Handler, Query, UseCases, type ApplicationBuilder, type ResultOf } from '../src/index.js'
import { GetVenue, GetVenueHandler, Journal, OpenDoors, OpenDoorsHandler } from './support/conference.js'

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export function whatTheCompilerRefuses(app: ApplicationBuilder): void {
    // @ts-expect-error a handler of another request, whose result differs
    app.handle(GetVenue, OpenDoorsHandler)
    // @ts-expect-error a handler whose inject list does not match its constructor
    app.handle(GetVenue, WrongList)
    // @ts-expect-error a class that is not a middleware
    app.use(Journal)
}

export async function whatTheCompilerInfers(useCases: UseCases): Promise<void> {
    const venue: string = await useCases.execute(new GetVenue(), { scope: new Services().build() })
    const opened: void = await useCases.execute(new OpenDoors('north'), { scope: new Services().build() })
    // @ts-expect-error a query of string does not answer a number
    const wrong: number = await useCases.execute(new GetVenue(), { scope: new Services().build() })
    void [venue, opened, wrong]
}

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
export const results: [Equal<ResultOf<GetVenue>, string>, Equal<ResultOf<OpenDoors>, void>, Equal<ResultOf<Numbered>, number>] = [true, true, true]

describe('the types', () => {
    it('let a handler of the request through', async () => {
        const provider = new Services().addSingleton(Journal, Journal).add(application(app => app.handle(OpenDoors, OpenDoorsHandler))).build()

        await expect(provider.get(UseCases).execute(new OpenDoors('north'), { scope: provider })).resolves.toBeUndefined()
    })
})

class Numbered extends Command<number> {}

class WrongList extends Handler<GetVenue> {
    static readonly inject = [Journal] as const

    constructor(journal: Journal, extra: string) {
        super()
        void [journal, extra]
    }

    async execute(): Promise<string> {
        return ''
    }
}

void GetVenueHandler
void Query

export function whatFromChecks(rename: FromRename): void {
    // @ts-expect-error the fields of a request from its schema are read only
    rename.title = 'Closing'
    // @ts-expect-error a field the schema does not have
    void rename.speaker
    // @ts-expect-error the constructor takes every field the schema produces
    new FromRename({ id: 't1' })
}

class FromRename extends Command.from(z.object({ id: z.string(), title: z.string() })) {}
class FromSell extends Command.returning<number>().from(z.object({ talk: z.string() })) {}
class FromGet extends Query.returning<string>().from(z.object({ id: z.string() })) {}
export const fromResults: [Equal<ResultOf<FromRename>, void>, Equal<ResultOf<FromSell>, number>, Equal<ResultOf<FromGet>, string>] = [true, true, true]

export function whatFromPairs(app: ApplicationBuilder): void {
    // @ts-expect-error a handler of a request from another schema, whose result differs
    app.handle(FromRename, FromSellHandler)
    app.handle(FromSell, FromSellHandler)
}

class FromSellHandler extends Handler<FromSell> {
    async execute(request: FromSell): Promise<number> {
        return request.talk.length
    }
}
