import { CauceError } from '@caucejs/base'

import type { HttpRequest } from '../http-client.js'
import { described } from './described.js'

/** A request that got no answer: the other system could not be reached, or the URL could not be sent. */
export class HttpRequestError extends CauceError {
    readonly request: HttpRequest

    constructor(request: HttpRequest, options?: ErrorOptions, why = 'got no answer') {
        super(`${described(request)} ${why}`, options)
        this.request = request
    }
}
