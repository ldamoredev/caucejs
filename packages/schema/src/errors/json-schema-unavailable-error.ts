import { CauceError } from '@caucejs/base'

/** A schema that cannot describe itself as JSON Schema: its library does not implement it, or it holds a transform. */
export class JsonSchemaUnavailableError extends CauceError {
    readonly vendor: string

    constructor(vendor: string, reason: string, options?: ErrorOptions) {
        super(`A ${vendor} schema cannot be described as JSON Schema: ${reason}`, options)
        this.vendor = vendor
    }
}
