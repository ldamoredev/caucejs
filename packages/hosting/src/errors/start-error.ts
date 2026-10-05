import { CauceError } from '@caucejs/base'

/**
 * A hosted service failed to start. The ones that had started were stopped, in reverse order; what failed while
 * stopping them is in `stopFailures`, and the failure itself in `cause`.
 */
export class StartError extends CauceError {
    readonly service: string
    readonly stopFailures: readonly unknown[]

    constructor(service: string, stopFailures: readonly unknown[], options?: ErrorOptions) {
        super(`${service} failed to start`, options)
        this.service = service
        this.stopFailures = stopFailures
    }
}
