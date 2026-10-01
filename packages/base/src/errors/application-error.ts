import { CauceError } from './cauce-error.js'

/** A failure that belongs to the application rather than to its domain, such as authorization. */
export class ApplicationError extends CauceError {}
