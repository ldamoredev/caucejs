import { CompositionError } from '@caucejs/di'

/** A request was executed and no handler was added for it. */
export class HandlerNotAddedError extends CompositionError {
    readonly request: string

    constructor(request: string, options?: ErrorOptions) {
        super(`No handler was added for ${request}`, options)
        this.request = request
    }
}
