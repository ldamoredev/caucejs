import { ConfigError } from './config-error.js'

/**
 * A section did not pass its schema. It lists every problem, each with the path and the source that set the
 * value, and never the value itself: it can be a password. It has no stack: the mistake is in the environment, not
 * in the code, and a stack would only point inside Cauce, so a process that ends on it prints the problems alone.
 */
export class InvalidSettingsError extends ConfigError {
    readonly section: string
    readonly problems: readonly string[]

    constructor(section: string, problems: readonly string[], options?: ErrorOptions) {
        super(`The settings of ${section === '' ? 'the root' : section} are wrong:\n- ${problems.join('\n- ')}`, options)
        this.section = section
        this.problems = problems
        this.stack = `${this.name}: ${this.message}`
    }
}
