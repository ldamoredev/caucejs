import { CauceError } from './cauce-error.js'

/** A rule of the domain was broken. Extend it with a type of its own when a caller reacts to the case. */
export class DomainError extends CauceError {}
