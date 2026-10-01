import { CauceError } from './cauce-error.js'

/** An {@link AsyncLocal} was read with `get()` outside of a `run()` that set it. */
export class MissingAsyncLocalError extends CauceError {
    readonly local: string

    constructor(local: string, options?: ErrorOptions) {
        super(`${local} has no value here: read it inside a run() that sets it`, options)
        this.local = local
    }
}
