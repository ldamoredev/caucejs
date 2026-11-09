import type { Usage } from '../usage.js'
import { ModelError } from './model-error.js'
import { requested } from './requested.js'

/**
 * The provider failed or could not be reached: a 5xx, an overload, or no answer at all, when `status` is `null`.
 * Trying again later can work.
 */
export class ModelUnavailableError extends ModelError {
    readonly status: number | null
    readonly requestId: string | null

    constructor(
        details: { readonly status: number | null; readonly requestId: string | null; readonly usage: Usage },
        options?: ErrorOptions,
        message = details.status === null ? 'The model could not be reached' : `The model is unavailable, with ${details.status}${requested(details.requestId)}`,
    ) {
        super(message, details.usage, options)
        this.status = details.status
        this.requestId = details.requestId
    }
}
