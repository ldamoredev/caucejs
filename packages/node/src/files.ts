import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

import { ConfigError, environment, json, memory, type Source } from '@caucejs/config'

export type FileOptions = {
    /** A missing file is an empty source instead of an error. */
    optional?: boolean
}

/**
 * A JSON file, read when this is called, relative to the working directory. Its root has to be an object; the
 * rules for its values are those of `json` in `@caucejs/config`.
 */
export function jsonFile(path: string, options: FileOptions = {}): Source {
    const text = read(path, options)
    if (text === null) return named(path)
    let document: unknown
    try {
        document = JSON.parse(text)
    } catch (error) {
        throw new ConfigError(`${path} is not valid JSON`, { cause: error })
    }
    return json(document, { name: path })
}

/**
 * A `.env` file, read with `util.parseEnv`, without writing to `process.env`. Its names become paths the way the
 * environment's do. Add it before the environment, so a variable that is really set wins, as Node does with
 * `--env-file`. Values are taken as written: `${OTHER}` is not expanded.
 */
export function dotenvFile(path: string, options: FileOptions & { prefix?: string } = {}): Source {
    const text = read(path, options)
    if (text === null) return named(path)
    return environment(parseEnv(text), { name: path, ...(options.prefix !== undefined && { prefix: options.prefix }) })
}

function read(path: string, options: FileOptions): string | null {
    try {
        return readFileSync(path, 'utf8')
    } catch (error) {
        if (isMissing(error)) {
            if (options.optional) return null
            throw new ConfigError(`${path} does not exist`, { cause: error })
        }
        throw new ConfigError(`${path} cannot be read`, { cause: error })
    }
}

function named(path: string): Source {
    return { ...memory({}), name: path }
}

function isMissing(error: unknown): boolean {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
