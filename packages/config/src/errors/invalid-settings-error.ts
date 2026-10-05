import { ConfigError } from './config-error.js'

/**
 * A section did not pass its schema. It lists every problem, each with the path and the source that set the
 * value, and never the value itself: it can be a password.
 */
export class InvalidSettingsError extends ConfigError {
    readonly section: string
    readonly problems: readonly string[]

    constructor(section: string, problems: readonly string[], options?: ErrorOptions) {
        super(`The settings of ${section === '' ? 'the root' : section} are wrong:\n- ${problems.join('\n- ')}`, options)
        this.section = section
        this.problems = problems
    }
}
