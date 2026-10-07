import { CauceError } from '@caucejs/base'

/** An execution context was asked for a value it does not have. */
export class ContextValueMissingError extends CauceError {
    readonly key: string

    constructor(key: string, options?: ErrorOptions) {
        super(`The execution context has no ${key}`, options)
        this.key = key
    }
}
