import type { Usage } from '../usage.js'
import { ModelUnavailableError } from './model-unavailable-error.js'

/** The provider did not answer within the timeout, in milliseconds. The call may still have been charged. */
export class ModelTimeoutError extends ModelUnavailableError {
    readonly timeout: number

    constructor(details: { readonly timeout: number; readonly usage: Usage }, options?: ErrorOptions) {
        super({ status: null, requestId: null, usage: details.usage }, options, `The model did not answer within ${details.timeout} ms`)
        this.timeout = details.timeout
    }
}
