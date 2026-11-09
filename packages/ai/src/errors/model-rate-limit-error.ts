import type { Usage } from '../usage.js'
import { ModelError } from './model-error.js'
import { requested } from './requested.js'

/** The provider is limiting the key: a 429. `retryAfter` is in seconds, and `null` when the provider did not say. */
export class ModelRateLimitError extends ModelError {
    readonly retryAfter: number | null
    readonly requestId: string | null

    constructor(details: { readonly retryAfter: number | null; readonly requestId: string | null; readonly usage: Usage }, options?: ErrorOptions) {
        const after = details.retryAfter === null ? '' : `, retry after ${details.retryAfter} s`
        super(`The model is rate limited${after}${requested(details.requestId)}`, details.usage, options)
        this.retryAfter = details.retryAfter
        this.requestId = details.requestId
    }
}
