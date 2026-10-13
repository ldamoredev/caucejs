import { CompositionError, type Dependencies, type Extension, type Injectable, type Services, type Token } from '@caucejs/di'

import type { Handler } from './handler.js'
import type { Middleware } from './middleware.js'
import type { Request } from './request.js'
import { UseCases } from './use-cases.js'

/** What an application executes: its middlewares, in order, and a handler for each request. */
export class ApplicationBuilder {
    readonly #services: Services
    readonly #handlers = new Map<Token<Request<unknown>>, Token<Handler<Request<unknown>>>>()
    readonly #middlewares: Token<Middleware>[] = []

    constructor(services: Services) {
        this.#services = services
    }

    /**
     * Adds a middleware. **The first one written runs first**, outermost, and the last one runs right before the
     * handler. The container builds it for every execution.
     */
    use<D extends Dependencies>(middleware: Injectable<Middleware, D>): this {
        // the class is its own token: a handler or a middleware is asked for by nothing else
        const token = middleware as unknown as Token<Middleware>
        this.#services.addTransient(token, middleware)
        this.#middlewares.push(token)
        return this
    }

    /**
     * Adds the handler of a request. A handler built on `Handler.of(GetTalk)` names its request and is added alone:
     * `handle(GetTalkHandler)`; any other is paired with it: `handle(GetTalk, GetTalkHandler)`. The compiler checks
     * that the handler takes that request and answers its result, and the validation of the container checks its
     * constructor. A request takes one handler.
     */
    handle<T extends Request<unknown>, D extends Dependencies>(handler: Injectable<Handler<T>, D> & { readonly request: Token<T> }): this
    handle<T extends Request<unknown>, D extends Dependencies>(request: Token<T>, handler: Injectable<Handler<T>, D>): this
    handle(first: unknown, second?: unknown): this {
        const handler = (second ?? first) as HandlerClass
        const request = second === undefined ? handler.request : (first as Token<Request<unknown>>)
        const current = this.#handlers.get(request)
        if (current) throw new CompositionError(`${request.name} already has a handler: ${current.name}`)
        const token = handler as unknown as Token<Handler<Request<unknown>>>
        this.#services.addTransient(token, handler)
        this.#handlers.set(request, token)
        return this
    }

    build(): UseCases {
        return new UseCases(new Map(this.#handlers), [...this.#middlewares])
    }
}

// What `handle` stores: a class of handler, and the request it names when it was built on `Handler.of`.
type HandlerClass = Injectable<Handler<Request<unknown>>> & { readonly request: Token<Request<unknown>> }

const applicationId = Symbol('application')

/**
 * The use cases of an application, as an extension: `services.add(application(app => app.use(Authorization)
 * .handle(SellTicket, SellTicketHandler)))`. It adds `UseCases`, and each middleware and handler as a transient
 * service.
 */
export function application(configure: (application: ApplicationBuilder) => void): Extension {
    return {
        id: applicationId,
        options: configure,
        requires: [],
        register: services => {
            const builder = new ApplicationBuilder(services)
            configure(builder)
            services.addInstance(UseCases, builder.build())
        },
    }
}
