import { ApplicationError } from '@caucejs/base'

/** A use case that needs someone was executed by no one. On HTTP, a 401. */
export class NotAuthenticatedError extends ApplicationError {
    constructor(options?: ErrorOptions) {
        super('Not authenticated', options)
    }
}
