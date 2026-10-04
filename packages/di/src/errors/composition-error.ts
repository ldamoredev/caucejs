import { CauceError } from '@caucejs/base'

/** The application is composed wrong: a service is missing, repeated, or asked for where it cannot be. */
export class CompositionError extends CauceError {}
