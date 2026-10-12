import { ExecutionContext, UseCases } from '@caucejs/application'
import { NotFoundError } from '@caucejs/base'
import { CompositionError, Scopes, type Dependencies, type Extension, type Injectable, type Resolver, type Services, type Token } from '@caucejs/di'
import { JsonSerializer } from '@caucejs/schema'
import { Hono, type MiddlewareHandler } from 'hono'

import { AnonymousAuthenticator, Authenticator } from './authenticator.js'
import type { Controller } from './controller.js'
import { problemOf, problemResponse, ProblemResponder, type ErrorClass } from './problem.js'
import { Routes, type WebEnv } from './routes.js'

// The runtime's console: this package builds without the types of any runtime, and every runtime has one.
declare const console: { error(...values: unknown[]): void }

type Definition = {
    readonly middlewares: readonly MiddlewareHandler<WebEnv>[]
    readonly controllers: readonly Token<Controller>[]
    readonly statuses: readonly (readonly [ErrorClass, number])[]
    readonly responder: Token<ProblemResponder> | null
}

/**
 * The web of an application: its `fetch`, which a server serves and a test calls in memory. For each request it opens a
 * scope of the container, asks the `Authenticator` who makes it, runs the middlewares in the order they were written and
 * then the route, and answers what goes wrong as a problem. Added by the `web` extension.
 */
export class Web {
    /** Hono, for what `web` does not cover. Prefer what `web` does: it is what the rest of cauce knows. */
    readonly hono = new Hono<WebEnv>()
    readonly fetch: (request: Request) => Promise<Response>

    constructor(resolver: Resolver, definition: Definition) {
        const scopes = resolver.get(Scopes)
        const responder = definition.responder ? resolver.get(definition.responder) : null
        for (const middleware of definition.middlewares) this.hono.use('*', middleware)
        this.hono.use('*', async (c, next) => {
            await using scope = scopes.create()
            const identity = await scope.get(Authenticator).authenticate(c.req.raw)
            c.set('cauce', { scope, context: ExecutionContext.of(identity) })
            await next()
        })
        const routes = new Routes(this.hono, resolver.get(JsonSerializer), resolver.get(UseCases))
        for (const controller of definition.controllers) resolver.get(controller).registerRoutes(routes)
        this.hono.notFound(c => {
            throw new NotFoundError(`No route for ${c.req.method} ${c.req.path}`)
        })
        this.hono.onError(async (error, c) => {
            const problem = problemOf(error, definition.statuses)
            // a server error is the one the client learns nothing about, so it is the one written down
            if (problem.status >= 500) console.error(error)
            return (await responder?.respond(problem, c)) ?? problemResponse(problem)
        })
        this.fetch = async request => this.hono.fetch(request)
    }
}

/** What an application serves over HTTP, in the order it is written. */
export class WebBuilder {
    readonly #services: Services
    readonly #middlewares: MiddlewareHandler<WebEnv>[] = []
    readonly #controllers: Token<Controller>[] = []
    readonly #statuses: (readonly [ErrorClass, number])[] = []
    #authenticator: Token<Authenticator> | null = null
    #responder: Token<ProblemResponder> | null = null

    constructor(services: Services) {
        this.#services = services
    }

    /** Hono middlewares that run for every request, the first one written outermost: `secureHeaders()`, `cors()`. */
    use(...middlewares: MiddlewareHandler<WebEnv>[]): this {
        this.#middlewares.push(...middlewares)
        return this
    }

    /** A group of routes, built by the container, so the validation checks what it needs. */
    controller<D extends Dependencies>(controller: Injectable<Controller, D>): this {
        const token = controller as unknown as Token<Controller>
        this.#services.addSingleton(token, controller)
        this.#controllers.push(token)
        return this
    }

    /** Who makes each request. Without one, everybody is anonymous. Once. */
    authenticateWith<D extends Dependencies>(authenticator: Injectable<Authenticator, D>): this {
        if (this.#authenticator) throw new CompositionError('web already authenticates with one Authenticator')
        this.#services.addScoped(Authenticator, authenticator)
        this.#authenticator = Authenticator
        return this
    }

    /** The status of an error of the application, such as a 409 for a conflict. It is checked before the defaults. */
    status(error: ErrorClass, status: number): this {
        this.#statuses.push([error, status])
        return this
    }

    /** What answers a problem instead of `application/problem+json`, such as the pages of an application of HTML. Once. */
    respondToProblemsWith<D extends Dependencies>(responder: Injectable<ProblemResponder, D>): this {
        if (this.#responder) throw new CompositionError('web already responds to problems with one ProblemResponder')
        this.#services.addSingleton(ProblemResponder, responder)
        this.#responder = ProblemResponder
        return this
    }

    build(): Definition {
        if (!this.#authenticator) this.#services.addScoped(Authenticator, AnonymousAuthenticator)
        return {
            middlewares: [...this.#middlewares],
            controllers: [...this.#controllers],
            statuses: [...this.#statuses],
            responder: this.#responder,
        }
    }
}

const webId = Symbol('web')

/**
 * The web of an application, as an extension: `services.add(web(w => w.use(secureHeaders()).controller(Inbox)))`. It
 * adds `Web`, each controller and the authenticator. It needs `UseCases` and the `JsonSerializer`, from
 * `@caucejs/application` and `@caucejs/schema`.
 */
export function web(configure: (web: WebBuilder) => void): Extension {
    return {
        id: webId,
        options: configure,
        requires: [],
        register: services => {
            const builder = new WebBuilder(services)
            configure(builder)
            const definition = builder.build()
            services.addSingleton(Web, resolver => new Web(resolver, definition))
        },
    }
}
