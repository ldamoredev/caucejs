import type { Usage } from '../usage.js'
import { ModelError } from './model-error.js'
import { requested } from './requested.js'

/** The provider refused the key: it is wrong, revoked, or not allowed what was asked. A 401 or a 403. */
export class ModelAuthenticationError extends ModelError {
    readonly status: number
    readonly requestId: string | null

    constructor(details: { readonly status: number; readonly requestId: string | null; readonly usage: Usage }, options?: ErrorOptions) {
        super(`The model refused the API key with ${details.status}${requested(details.requestId)}`, details.usage, options)
        this.status = details.status
        this.requestId = details.requestId
    }
}
