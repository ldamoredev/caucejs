// The canonical host: copy its shape when an application starts without a runtime builder. A web application on Node
// starts from WebApplication.builder(), in @caucejs/node, which brings the usual defaults. This one stops by hand so
// that it can run in a test.
import { memory, settings, type StandardSchemaV1 } from '@caucejs/config'

import { HostBuilder, HostedService, ManualLifetime, Module } from '../src/index.js'

type DoorsOptions = { readonly opensAt: string }

// Any Standard Schema works; this one is written by hand so the example depends on no validator.
const doorsSchema: StandardSchemaV1<unknown, DoorsOptions> = {
    '~standard': {
        version: 1,
        vendor: 'conference',
        validate(input) {
            const { opensAt } = (input ?? {}) as Record<string, unknown>
            return typeof opensAt === 'string' ? { value: { opensAt } } : { issues: [{ message: 'Expected a time', path: ['opensAt'] }] }
        },
    },
}

export class DoorsSettings extends settings('doors', doorsSchema) {}

export class Journal {
    readonly entries: string[] = []
}

// What starts with the application: here, the doors. A web server would be one more, listed after it.
export class Doors extends HostedService {
    static readonly inject = [DoorsSettings, Journal] as const
    readonly #settings: DoorsSettings
    readonly #journal: Journal

    constructor(settings: DoorsSettings, journal: Journal) {
        super()
        this.#settings = settings
        this.#journal = journal
    }

    async start(): Promise<void> {
        this.#journal.entries.push(`doors open at ${this.#settings.opensAt}`)
    }

    async stop(): Promise<void> {
        this.#journal.entries.push('doors closed')
    }
}

// A module of the application is a class: compose adds its settings, its services and what starts with it, one
// statement per line.
export class Conference extends Module {
    compose(app: HostBuilder): void {
        app.addSettings(DoorsSettings)
        app.services.addSingleton(Journal)
        app.start(Doors)
    }
}

export async function holdConference(): Promise<string[]> {
    const builder = new HostBuilder({ environment: 'test' })
    // A plain builder reads nothing the application does not add: in production, ...standardSources(builder.environment).
    builder.config.add(memory({ doors: { opensAt: '09:00' } }))
    builder.addModule(Conference)

    const lifetime = new ManualLifetime()
    await using host = builder.build()
    const journal = host.provider.get(Journal)
    const running = host.run(lifetime)
    lifetime.stop()
    // run stops the host and disposes its container; await using covers a failure before that.
    await running
    return journal.entries
}
