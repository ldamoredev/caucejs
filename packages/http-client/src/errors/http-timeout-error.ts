import type { HttpRequest } from '../http-client.js'
import { HttpRequestError } from './http-request-error.js'

/** A request whose answer did not arrive, body included, within its timeout. */
export class HttpTimeoutError extends HttpRequestError {
    readonly timeout: number

    constructor(request: HttpRequest, timeout: number, options?: ErrorOptions) {
        super(request, options, `got no answer within ${timeout} ms`)
        this.timeout = timeout
    }
}
