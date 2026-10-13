import { Config, type SettingsClass } from '@caucejs/config'
import { Services, type Dependencies, type Injectable, type Provider, type Token } from '@caucejs/di'

import { Host } from './host.js'
import type { HostedService } from './hosted-service.js'
import { HostEnvironment } from './host-environment.js'
import type { ModuleClass } from './module.js'

export type HostBuilderOptions = {
    /** The environment: `production` when it is not given. `environmentOf(process.env)` reads `NODE_ENV`. */
    environment?: string
    /** How long each hosted service has to stop, in milliseconds. 30 seconds by default. */
    shutdownTimeout?: number
}

/**
 * Where an application is put together. It adds nothing on its own: the application adds its configuration
 * sources to `config`, its modules, settings and services, and lists in `start` what runs with it. An application
 * that wants the usual defaults starts from the builder of its runtime instead, such as `WebApplication.builder()` in
 * `@caucejs/node`.
 *
 * ```ts
 * const builder = new HostBuilder({ environment: environmentOf(process.env) })
 * builder.config.add(...standardSources(builder.environment))   // @caucejs/node
 * builder.addModule(Conference)
 * const host = builder.build()
 * await host.run(new ProcessLifetime())                           // @caucejs/node
 * ```
 */
export class HostBuilder {
    readonly environment: HostEnvironment
    readonly config = new Config()
    readonly services = new Services()
    readonly #hosted: Token<HostedService>[] = []
    readonly #modules = new Set<object>()
    readonly #settings: SettingsClass<object>[] = []
    readonly #shutdownTimeout: number

    constructor(options: HostBuilderOptions = {}) {
        this.environment = new HostEnvironment(options.environment ?? 'production')
        this.#shutdownTimeout = options.shutdownTimeout ?? 30_000
        this.services.addInstance(HostEnvironment, this.environment)
    }

    /**
     * Composes a module, once per class: a module asked for again, by the application or by another module, is not
     * composed twice.
     */
    addModule(module: ModuleClass<this>): this {
        if (this.#modules.has(module)) return this
        this.#modules.add(module)
        new module().compose(this)
        return this
    }

    /**
     * Adds settings, bound when the host is built: by then every source is added, whatever the order of the modules,
     * and a wrong value fails before anything starts. The section comes from the class.
     */
    addSettings<T extends object, S extends T>(type: SettingsClass<T, S>): this {
        this.#settings.push(type as unknown as SettingsClass<object>)
        return this
    }

    /**
     * Adds a hosted service as a singleton and lists it to start after the ones listed before. One per call, so the
     * compiler checks each `inject` list against its own constructor, and the order of the calls is the order of
     * startup. A class listed here cannot be added again elsewhere: the container fails, as with any token added twice.
     */
    // A class is both what is asked for and how it is built; the intersection says so to the compiler, which cannot
    // see that an Injectable is also a Token while its inject list is still a type parameter.
    start<S extends HostedService, D extends Dependencies>(hosted: Injectable<S, D> & Token<S>): this {
        this.services.addSingleton(hosted, hosted)
        this.#hosted.push(hosted)
        return this
    }

    /**
     * The host, with its settings bound and its container built and validated, always: the validation builds nothing,
     * so a missing service or a singleton that would capture a scoped one fails here, in every environment, before
     * anything starts.
     */
    build(): Host {
        for (const type of this.#settings.splice(0)) this.services.addInstance(type, this.config.bind(type))
        const provider = this.services.build({ validate: true })
        return this.createHost(provider, [...this.#hosted], this.#shutdownTimeout)
    }

    /** The host `build` returns. The builder of a richer application, such as a web one, returns its own. */
    protected createHost(provider: Provider, hosted: readonly Token<HostedService>[], shutdownTimeout: number): Host {
        return new Host(this.environment, provider, hosted, shutdownTimeout)
    }
}
