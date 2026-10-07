import type { Resolver, Token } from '@caucejs/di'

import { HandlerNotAddedError } from './errors/handler-not-added-error.js'
import { ExecutionContext } from './execution-context.js'
import type { Handler } from './handler.js'
import type { Middleware } from './middleware.js'
import type { Request, ResultOf } from './request.js'

export type ExecuteOptions = {
    /**
     * Where the handler and the middlewares are built: the scope of the request or of the job. The provider itself
     * works while nothing asks for a scoped service.
     */
    readonly scope: Resolver
    /** Who executes it, and what travels with it. Anonymous when it is not given. */
    readonly context?: ExecutionContext
}

/**
 * Executes use cases: finds the handler added for the class of the request, and runs it inside the middlewares, the
 * first one written outermost. Added by the `application` extension.
 */
export class UseCases {
    readonly #handlers: ReadonlyMap<Token<Request<unknown>>, Token<Handler<Request<unknown>>>>
    readonly #middlewares: readonly Token<Middleware>[]

    constructor(
        handlers: ReadonlyMap<Token<Request<unknown>>, Token<Handler<Request<unknown>>>>,
        middlewares: readonly Token<Middleware>[],
    ) {
        this.#handlers = handlers
        this.#middlewares = middlewares
    }

    /** Throws {@link HandlerNotAddedError} for a request without a handler, before any middleware runs. */
    execute<T extends Request<unknown>>(request: T, options: ExecuteOptions): Promise<ResultOf<T>> {
        const requestClass = request.constructor as Token<Request<unknown>>
        const handler = this.#handlers.get(requestClass)
        if (!handler) return Promise.reject(new HandlerNotAddedError(requestClass.name))
        const { scope } = options
        const run = (index: number, context: ExecutionContext): Promise<ResultOf<T>> => {
            const middleware = this.#middlewares[index]
            if (middleware === undefined) return scope.get(handler).execute(request, context) as Promise<ResultOf<T>>
            return scope.get(middleware).execute(request, context, next => run(index + 1, next ?? context)) as Promise<ResultOf<T>>
        }
        return run(0, options.context ?? ExecutionContext.anonymous())
    }
}
