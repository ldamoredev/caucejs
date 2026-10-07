import { ApplicationError } from '@caucejs/base'

/** Who executed the use case cannot do it. On HTTP, a 403. */
export class ForbiddenError extends ApplicationError {
    constructor(options?: ErrorOptions) {
        super('Forbidden', options)
    }
}
