import { Services } from '@caucejs/di'
import { describe, expect, it } from 'vitest'

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
