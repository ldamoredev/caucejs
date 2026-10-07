import { ForbiddenError } from './errors/forbidden-error.js'
import { NotAuthenticatedError } from './errors/not-authenticated-error.js'
import type { ExecutionContext } from './execution-context.js'
import { Middleware, type Next } from './middleware.js'
import type { Request } from './request.js'

/** What a request class may declare about who executes it. */
export type AuthorizationRules = {
    /** Anyone executes it, authenticated or not. */
    readonly anonymous?: boolean
    /** Who executes it can do at least one of these. */
    readonly permissions?: readonly string[]
}

/**
 * Closed by default: a request runs only for an authenticated identity, unless its class says
 * `static readonly anonymous = true`. A class that says `static readonly permissions = ['talks']` also needs an
 * identity that can do one of them.
 *
 * Fails with {@link NotAuthenticatedError} for nobody, and with {@link ForbiddenError} for someone who cannot.
 */
export class Authorization extends Middleware {
    execute<R>(request: Request<R>, context: ExecutionContext, next: Next<R>): Promise<R> {
        const rules = request.constructor as AuthorizationRules
        if (rules.anonymous === true) return next()
        const { identity } = context
        if (!identity.isAuthenticated) return Promise.reject(new NotAuthenticatedError())
        const permissions = rules.permissions ?? []
        if (permissions.length > 0 && !permissions.some(permission => identity.can(permission))) {
            return Promise.reject(new ForbiddenError())
        }
        return next()
    }
}
