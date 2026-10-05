// The canonical host: copy its shape when an application starts. In production it runs with ProcessLifetime and
// standardSources, from @caucejs/node; this one stops by hand so that it can run in a test.
import { memory, settings, type Config, type StandardSchemaV1 } from '@caucejs/config'
import type { Extension, Services } from '@caucejs/di'

import { HostBuilder, HostedService, ManualLifetime } from '../src/index.js'

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

// A module of the application is an extension of di: it receives the configuration it binds.
const conferenceId = Symbol('conference')

function conference(config: Config): Extension {
    return {
        id: conferenceId,
        options: undefined,
        requires: [],
        register: (services: Services) => services.addInstance(DoorsSettings, config.bind(DoorsSettings)).addInstance(Journal, new Journal()),
    }
}

export async function holdConference(): Promise<string[]> {
    const builder = new HostBuilder({ environment: 'test' })
    // Nothing is read that the application does not add: in production, ...standardSources(builder.environment).
    builder.config.add(memory({ doors: { opensAt: '09:00' } }))
    builder.services.add(conference(builder.config))
    builder.start(Doors)

    const lifetime = new ManualLifetime()
    await using host = builder.build()
    const journal = host.provider.get(Journal)
    const running = host.run(lifetime)
    lifetime.stop()
    // run stops the host and disposes its container; await using covers a failure before that.
    await running
    return journal.entries
}
