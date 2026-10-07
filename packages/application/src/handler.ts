import type { ExecutionContext } from './execution-context.js'
import type { Request, ResultOf } from './request.js'

/**
 * Executes one kind of request. The container builds a new one for every execution, in its scope, so the
 * constructor can ask for what lives per request.
 */
export abstract class Handler<T extends Request<unknown>> {
    abstract execute(request: T, context: ExecutionContext): Promise<ResultOf<T>>
}
