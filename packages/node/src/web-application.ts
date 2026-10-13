import { ApplicationBuilder, UseCases } from '@caucejs/application'
import { json, type Source } from '@caucejs/config'
import type { Provider, Token } from '@caucejs/di'
import { environmentOf, Host, HostBuilder, type HostedService, type HostEnvironment, type Lifetime } from '@caucejs/hosting'
import { jsonSerializer } from '@caucejs/schema'
import { Web, WebBuilder } from '@caucejs/web'

import { HttpServer } from './http-server.js'
import { HttpServerSettings } from './http-server-settings.js'
import { ProcessLifetime } from './process-lifetime.js'
import { standardSources } from './standard-sources.js'

export type WebApplicationOptions = {
    /** How the application calls itself in what it writes, such as where it listens. `app` when it is not given. */
    name?: string
    /** The environment. By default `NODE_ENV`, and production when it is not set. */
    environment?: string
    /**
     * The configuration, instead of the standard sources. A test passes its own, so it reads no file and nothing of
     * the environment of the process.
     */
    sources?: Source[]
    /** How long each hosted service has to stop, in milliseconds. 30 seconds by default. */
    shutdownTimeout?: number
}

/**
 * Where a web application on Node is put together. It starts from the usual defaults, which a plain `HostBuilder`
 * leaves to the application:
 *
 * - the environment from `NODE_ENV`, production when it is not set;
 * - the standard sources: `settings.json`, `settings.<environment>.json`, `.env` and the environment, with `PORT`
 *   as the port of the server, as Railway, Render and Heroku set it, below `HTTP_SERVER__PORT`;
 * - the `JsonSerializer`, the use cases in `useCases` and the web in `web`;
 * - the `HttpServer`, which starts last, after every hosted service of the application.
 *
 * The application adds its modules, settings and services, as statements.
 */
export class WebApplicationBuilder extends HostBuilder {
    /** The use cases: `app.useCases.use(Authorization)`, `app.useCases.handle(GetTalkHandler)`. */
    readonly useCases: ApplicationBuilder
    /** The web: `app.web.authenticateWith(SessionCookie)`, `app.web.controller(TalksController)`. */
    readonly web: WebBuilder
    readonly #name: string

    constructor(options: WebApplicationOptions = {}) {
        super({
            environment: options.environment ?? environmentOf(process.env),
            ...(options.shutdownTimeout !== undefined && { shutdownTimeout: options.shutdownTimeout }),
        })
        this.#name = options.name ?? 'app'
        this.config.add(...(options.sources ?? platformSources(this.environment)))
        this.services.add(jsonSerializer())
        this.useCases = new ApplicationBuilder(this.services)
        this.web = new WebBuilder(this.services)
        this.addSettings(HttpServerSettings)
    }

    /** The application, with the server listed last and its container built and validated. */
    override build(): WebApplication {
        this.services.addInstance(UseCases, this.useCases.build())
        const definition = this.web.build()
        this.services.addSingleton(Web, resolver => new Web(resolver, definition))
        this.start(HttpServer)
        return super.build() as WebApplication
    }

    protected override createHost(provider: Provider, hosted: readonly Token<HostedService>[], shutdownTimeout: number): Host {
        return new WebApplication(this.#name, this.environment, provider, hosted, shutdownTimeout)
    }
}

/**
 * A web application on Node, built: `run` starts it, says where it listens, waits for `SIGINT` or `SIGTERM`, and
 * stops it. A test calls `start` and `fetch`, or uses `fetch` without starting it.
 */
export class WebApplication extends Host {
    readonly name: string
    #announced = false

    constructor(name: string, environment: HostEnvironment, provider: Provider, hosted: readonly Token<HostedService>[], shutdownTimeout: number) {
        super(environment, provider, hosted, shutdownTimeout)
        this.name = name
    }

    /** Starts a builder with the usual defaults. */
    static builder(options: WebApplicationOptions = {}): WebApplicationBuilder {
        return new WebApplicationBuilder(options)
    }

    /** The `fetch` of its web, which the server serves and a test calls in memory. */
    get fetch(): (request: Request) => Promise<Response> {
        return this.provider.get(Web).fetch
    }

    override async start(): Promise<void> {
        await super.start()
        if (this.#announced) return
        this.#announced = true
        const settings = this.provider.get(HttpServerSettings)
        console.log(`${this.name} listening on http://${settings.hostname ?? 'localhost'}:${this.provider.get(HttpServer).port}`)
    }

    /** Runs until the process is asked to stop: `SIGINT` or `SIGTERM`, unless another lifetime is given. */
    override run(lifetime: Lifetime = new ProcessLifetime()): Promise<void> {
        return super.run(lifetime)
    }
}

// The standard sources, with PORT below the environment, so HTTP_SERVER__PORT still wins over it.
function platformSources(environment: HostEnvironment): Source[] {
    const sources = standardSources(environment)
    const port = process.env.PORT
    if (port === undefined || port.trim() === '') return sources
    return [...sources.slice(0, -1), json({ httpServer: { port } }, { name: 'PORT' }), ...sources.slice(-1)]
}
