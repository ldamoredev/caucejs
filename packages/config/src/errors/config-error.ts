import { CauceError } from '@caucejs/base'

/** The configuration cannot be read: a file that is missing or malformed, or a value of a shape it does not take. */
export class ConfigError extends CauceError {}
