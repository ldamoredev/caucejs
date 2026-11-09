import { CauceError } from '@caucejs/base'

/**
 * A `ScriptedModel` was asked for more answers than its script has. It is not a `ModelError`, so it is never taken for
 * a failure of a provider: the test that wrote the script is wrong.
 */
export class ScriptExhaustedError extends CauceError {
    readonly asked: number
    readonly answers: number

    constructor(details: { readonly asked: number; readonly answers: number }, options?: ErrorOptions) {
        const times = details.asked === 1 ? '1 time' : `${details.asked} times`
        super(`The scripted model has no answer left: it was asked ${times} and has ${details.answers}`, options)
        this.asked = details.asked
        this.answers = details.answers
    }
}
