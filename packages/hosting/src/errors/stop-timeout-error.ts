import { CauceError } from '@caucejs/base'

/** A hosted service did not stop within the shutdown timeout. The host moved on to the next one. */
export class StopTimeoutError extends CauceError {
    readonly service: string
    readonly timeout: number

    constructor(service: string, timeout: number, options?: ErrorOptions) {
        super(`${service} did not stop within ${timeout} ms`, options)
        this.service = service
        this.timeout = timeout
    }
}
