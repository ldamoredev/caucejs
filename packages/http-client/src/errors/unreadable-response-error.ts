import { CauceError } from '@caucejs/base'

import type { HttpResponse } from '../http-response.js'
import { described } from './described.js'

/** An answer whose body is not what the caller reads: not JSON, or not what its schema says. It never quotes a value. */
export class UnreadableResponseError extends CauceError {
    readonly response: HttpResponse
    readonly problems: readonly string[]

    constructor(response: HttpResponse, problems: readonly string[], options?: ErrorOptions) {
        super(`${described(response.request)} answered something unreadable:\n- ${problems.join('\n- ')}`, options)
        this.response = response
        this.problems = problems
    }
}
