/**
 * The environment the application runs in: `production`, `development`, `test`, or any other name. It is fixed
 * when the host is built and never read from the configuration, because it decides which settings to read.
 */
export class HostEnvironment {
    /** Lowercase, so `settings.${name}.json` names one file whatever the variable said. */
    readonly name: string

    constructor(name: string) {
        this.name = name.toLowerCase()
    }

    /** Whether it is the environment named, ignoring case: `environment.is('development')`. */
    is(name: string): boolean {
        return this.name === name.toLowerCase()
    }
}

/**
 * The name of the environment from variables shaped like the environment of the process: `NODE_ENV`, or
 * `production` when it is not set, so a deployment that forgets it runs as production.
 */
export function environmentOf(variables: Readonly<Record<string, string | undefined>>): string {
    const name = variables['NODE_ENV']
    return name === undefined || name.trim() === '' ? 'production' : name
}
