import type { ExecutionContext } from './execution-context.js'
import type { Request } from './request.js'

/** Runs what comes after a middleware. It may be given another context; never another request. */
export type Next<R> = (context?: ExecutionContext) => Promise<R>

/**
 * Wraps the execution of every use case: it runs before the handler, decides whether to go on, and sees what came
 * back or what was thrown. The container builds one for every execution, like a handler.
 */
export abstract class Middleware {
    abstract execute<R>(request: Request<R>, context: ExecutionContext, next: Next<R>): Promise<R>
}
