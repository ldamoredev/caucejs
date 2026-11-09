import { CauceError } from '@caucejs/base'

import type { Usage } from '../usage.js'

/**
 * A call to a model, or a run of `Ai`, that has no answer to use. It carries what was spent, and never the prompt, the
 * answer, a header or the request: a server error is printed whole, and those can hold the notes of a user or the API
 * key. What a run throws carries the usage of the whole run.
 */
export class ModelError extends CauceError {
    readonly usage: Usage

    constructor(message: string, usage: Usage, options?: ErrorOptions) {
        super(message, options)
        this.usage = usage
    }
}
