import type { Entry, Source } from './source.js'

export type EnvironmentOptions = {
    /** Only the variables that start with it are read, and it is cut from their name. */
    prefix?: string
    /** Names the source in errors. `the environment` by default. */
    name?: string
}

/**
 * Variables of the environment, or anything shaped like them, such as a parsed `.env`:
 * `environment(process.env)`.
 *
 * A name becomes a path: `__` separates levels and each word joined by `_` becomes camel case, so
 * `GITHUB__REPOSITORY_NAME` is `github.repositoryName` and `PORT` is `port`. That is why keys are written in
 * camel case without capitals in a row (`apiUrl`, not `apiURL`): no variable can produce them. A name with an
 * empty level, such as `__CF_USER_TEXT_ENCODING`, is skipped.
 */
export function environment(variables: Readonly<Record<string, string | undefined>>, options: EnvironmentOptions = {}): Source {
    const prefix = options.prefix ?? ''
    const entries: Entry[] = []
    for (const [key, value] of Object.entries(variables)) {
        if (value === undefined || !key.startsWith(prefix)) continue
        const path = key.slice(prefix.length).split('__').map(camelCase)
        if (path.some(level => level === '')) continue
        entries.push({ path, value, key })
    }
    return { name: options.name ?? 'the environment', entries }
}

function camelCase(level: string): string {
    const words = level.split('_').filter(word => word !== '').map(word => word.toLowerCase())
    return words.map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))).join('')
}
