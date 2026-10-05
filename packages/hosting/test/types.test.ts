import { describe, expect, it } from 'vitest'

import { HostBuilder, HostedService } from '../src/index.js'
import { Journal, TicketDesk } from './support/conference.js'

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export function whatTheCompilerRefuses(builder: HostBuilder): void {
    // @ts-expect-error a class that is not a hosted service
    builder.start(Journal)
    // @ts-expect-error a hosted service whose inject list does not match its constructor
    builder.start(WrongList)
}

describe('the types', () => {
    it('let a hosted service with a right inject list through', () => {
        expect(new HostBuilder().start(TicketDesk)).toBeInstanceOf(HostBuilder)
    })
})

class WrongList extends HostedService {
    static readonly inject = [Journal] as const

    constructor(journal: Journal, extra: string) {
        super()
        void journal
        void extra
    }

    async start(): Promise<void> {}

    async stop(): Promise<void> {}
}
