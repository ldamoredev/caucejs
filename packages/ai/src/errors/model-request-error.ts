import type { Usage } from '../usage.js'
import { ModelError } from './model-error.js'
import { requested } from './requested.js'

/**
 * The provider refused the request: any other 4xx, such as a 400, a 404 or a 413. `type` is the kind of error the
 * provider named, such as `invalid_request_error`. Its message is left out: nothing says it never quotes the request.
 */
export class ModelRequestError extends ModelError {
    readonly status: number
    readonly type: string | null
    readonly requestId: string | null

    constructor(
        details: { readonly status: number; readonly type: string | null; readonly requestId: string | null; readonly usage: Usage },
        options?: ErrorOptions,
    ) {
        const type = details.type === null ? '' : ` ${details.type}`
        super(`The model refused the request with ${details.status}${type}${requested(details.requestId)}`, details.usage, options)
        this.status = details.status
        this.type = details.type
        this.requestId = details.requestId
    }
}
