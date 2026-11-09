import type { Usage } from '../usage.js'
import { ModelError } from './model-error.js'
import { requested } from './requested.js'

/**
 * The provider answered something this package cannot read: a body that is not JSON, a block or a stop reason it does
 * not know. `problem` names what, and never quotes the body.
 */
export class ModelResponseError extends ModelError {
    readonly problem: string
    readonly requestId: string | null

    constructor(details: { readonly problem: string; readonly requestId: string | null; readonly usage: Usage }, options?: ErrorOptions) {
        super(`The model answered something unreadable: ${details.problem}${requested(details.requestId)}`, details.usage, options)
        this.problem = details.problem
        this.requestId = details.requestId
    }
}
