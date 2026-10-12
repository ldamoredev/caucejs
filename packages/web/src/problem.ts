import { DomainError, NotFoundError } from '@caucejs/base'
import { ForbiddenError, NotAuthenticatedError } from '@caucejs/application'
import { ValidationError, type ValidationIssue } from '@caucejs/schema'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { UnsupportedMediaTypeError } from './errors/unsupported-media-type-error.js'
import type { WebEnv } from './routes.js'

/**
 * What went wrong with a request, as RFC 9457 says it: the status, its title, and for a client error the message of the
 * error, plus the issues of a `ValidationError`. A server error says nothing of its cause. `error` is what was thrown;
 * it never reaches the client.
 */
export type Problem = {
    readonly status: number
    readonly title: string
    readonly detail?: string
    readonly errors?: readonly ValidationIssue[]
    readonly error: unknown
}

/**
 * Answers a problem when the default, `application/problem+json`, is not what the application wants: an HTML page for
 * a 404, a redirect to the login for a 401. It returns `undefined` to keep the default.
 */
export abstract class ProblemResponder {
    abstract respond(problem: Problem, c: Context<WebEnv>): Response | undefined | Promise<Response | undefined>
}

export type ErrorClass = abstract new (...args: never[]) => Error

// The order matters: a subclass goes before the class it extends.
const defaults: readonly (readonly [ErrorClass, number])[] = [
    [ValidationError, 400],
    [UnsupportedMediaTypeError, 415],
    [NotAuthenticatedError, 401],
    [ForbiddenError, 403],
    [NotFoundError, 404],
    [DomainError, 400],
]

const titles: Readonly<Record<number, string>> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    415: 'Unsupported Media Type',
    422: 'Unprocessable Content',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
}

export function problemOf(error: unknown, statuses: readonly (readonly [ErrorClass, number])[]): Problem {
    const status = statusOf(error, statuses)
    const title = titles[status] ?? (status >= 500 ? 'Server Error' : 'Client Error')
    if (status >= 500) return { status, title, error }
    const detail = error instanceof Error && error.message !== '' ? error.message : undefined
    return {
        status,
        title,
        ...(detail !== undefined && { detail }),
        ...(error instanceof ValidationError && { errors: error.issues }),
        error,
    }
}

function statusOf(error: unknown, statuses: readonly (readonly [ErrorClass, number])[]): number {
    for (const [type, status] of [...statuses, ...defaults]) if (error instanceof type) return status
    if (error instanceof HTTPException) return error.status
    return 500
}

export function problemResponse(problem: Problem): Response {
    const { error: _error, ...body } = problem
    return new Response(JSON.stringify({ type: 'about:blank', ...body }), {
        status: problem.status,
        headers: { 'content-type': 'application/problem+json' },
    })
}
