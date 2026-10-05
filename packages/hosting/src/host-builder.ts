import { Config } from '@caucejs/config'
import { Services, type Dependencies, type Injectable, type Token } from '@caucejs/di'

import { Host } from './host.js'
import type { HostedService } from './hosted-service.js'
import { HostEnvironment } from './host-environment.js'

export type HostBuilderOptions = {
    /** The environment: `production` when it is not given. `environmentOf(process.env)` reads `NODE_ENV`. */
    environment?: string
    /** How long each hosted service has to stop, in milliseconds. 30 seconds by default. */
    shutdownTimeout?: number
}

/**
 * Where an application is put together. It adds nothing on its own: the application adds its configuration
 * sources to `config`, its extensions and services to `services`, and lists in `start` what runs with it.
 *
 * ```ts
 * const builder = new HostBuilder({ environment: environmentOf(process.env) })
 * builder.config.add(...standardSources(builder.environment))   // @caucejs/node
 * builder.services.add(conference(builder.config))
 * builder.start(TicketDesk).start(HttpServer)
 * await using host = builder.build()
 * await host.run(new ProcessLifetime())                           // @caucejs/node
 * ```
 */
export class HostBuilder {
    readonly environment: HostEnvironment
    readonly config = new Config()
    readonly services = new Services()
    readonly #hosted: Token<HostedService>[] = []
    readonly #shutdownTimeout: number

    constructor(options: HostBuilderOptions = {}) {
        this.environment = new HostEnvironment(options.environment ?? 'production')
        this.#shutdownTimeout = options.shutdownTimeout ?? 30_000
        this.services.addInstance(HostEnvironment, this.environment)
    }

    /**
     * Adds a hosted service as a singleton and lists it to start after the ones listed before:
     * `builder.start(TicketDesk).start(HttpServer)`. One per call, so the compiler checks each `inject` list
     * against its own constructor. A class listed here cannot be added again elsewhere: the container fails, as
     * with any token added twice.
     */
    // A class is both what is asked for and how it is built; the intersection says so to the compiler, which cannot
    // see that an Injectable is also a Token while its inject list is still a type parameter.
    start<S extends HostedService, D extends Dependencies>(hosted: Injectable<S, D> & Token<S>): this {
        this.services.addSingleton(hosted, hosted)
        this.#hosted.push(hosted)
        return this
    }

    /**
     * The host, with its container built and validated, always: the validation builds nothing, so a missing service
     * or a singleton that would capture a scoped one fails here, in every environment, before anything starts.
     */
    build(): Host {
        const provider = this.services.build({ validate: true })
        return new Host(this.environment, provider, [...this.#hosted], this.#shutdownTimeout)
    }
}
