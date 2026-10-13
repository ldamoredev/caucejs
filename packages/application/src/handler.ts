import type { Token } from '@caucejs/di'

import type { ExecutionContext } from './execution-context.js'
import type { Request, ResultOf } from './request.js'

/**
 * Executes one kind of request. The container builds a new one for every execution, in its scope, so the
 * constructor can ask for what lives per request.
 */
export abstract class Handler<T extends Request<unknown>> {
    abstract execute(request: T, context: ExecutionContext): Promise<ResultOf<T>>

    /**
     * The base of a handler that names its request, so it is added alone: `class GetTalkHandler extends
     * Handler.of(GetTalk)`, and then `app.handle(GetTalkHandler)`. It is as close as TypeScript gets to a handler
     * nested in its request.
     */
    static of<T extends Request<unknown>>(request: Token<T>): HandlerOf<T> {
        abstract class Of extends Handler<T> {
            static readonly request = request
        }
        return Of
    }
}

/** A handler class that names the request it executes. */
export type HandlerOf<T extends Request<unknown>> = (abstract new () => Handler<T>) & { readonly request: Token<T> }
