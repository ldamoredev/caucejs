/**
 * The base of every error Cauce throws, and of the errors an application builds on it.
 *
 * Its `name` is the name of the class that was thrown, so a log says `SoldOutError` without each
 * subclass repeating it. The cause travels in the native `cause`.
 */
export class CauceError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
        this.name = new.target.name
    }
}
