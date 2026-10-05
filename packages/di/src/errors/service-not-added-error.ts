import { CompositionError } from './composition-error.js'

/** A service was asked for and never added. */
export class ServiceNotAddedError extends CompositionError {
    readonly service: string

    constructor(service: string, neededBy: readonly string[] = [], options?: ErrorOptions) {
        const chain = neededBy.length === 0 ? '' : `, needed by ${neededBy.join(' <- ')}`
        super(`${service} was never added${chain}`, options)
        this.service = service
    }
}
