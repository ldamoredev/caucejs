import { CauceError } from '@caucejs/base'

import type { HttpResponse } from '../http-response.js'
import { described } from './described.js'

/** An answer whose status is not a success, thrown by `ensureSuccess()`. The response says what the other system said. */
export class HttpStatusError extends CauceError {
    readonly response: HttpResponse

    constructor(response: HttpResponse) {
        super(`${described(response.request)} answered ${response.status}`)
        this.response = response
    }

    get status(): number {
        return this.response.status
    }
}
