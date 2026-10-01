import { DomainError } from './domain-error.js'

/** Something that was asked for does not exist. Open to a subclass that names what. */
export class NotFoundError extends DomainError {
    constructor(message = 'Not found', options?: ErrorOptions) {
        super(message, options)
    }
}
