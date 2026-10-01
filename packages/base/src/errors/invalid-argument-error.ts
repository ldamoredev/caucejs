import { DomainError } from './domain-error.js'

/** An argument failed a rule. It carries the argument's name, so a caller can point at the field. */
export class InvalidArgumentError extends DomainError {
    readonly argument: string

    constructor(argument: string, message = `Invalid argument ${argument}`, options?: ErrorOptions) {
        super(message, options)
        this.argument = argument
    }
}
