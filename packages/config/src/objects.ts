import { ConfigError } from './errors/config-error.js'
import type { Entry, Source } from './source.js'
import type { ConfigTree } from './tree.js'

/** Values written by hand: what a test sets, or what an application fixes in code. */
export function memory(tree: ConfigTree): Source {
    return { name: 'memory', entries: entriesOf(tree, 'memory') }
}

/**
 * A parsed JSON document. The root has to be an object. Numbers and booleans become strings, because a value has
 * to read the same whichever source set it; arrays are not supported yet.
 */
export function json(document: unknown, options: { name?: string } = {}): Source {
    const name = options.name ?? 'JSON'
    if (!isTree(document)) throw new ConfigError(`${name} has to hold an object, not ${describe(document)}`)
    return { name, entries: entriesOf(document, name) }
}

function entriesOf(tree: unknown, name: string): Entry[] {
    const entries: Entry[] = []
    const walk = (value: unknown, path: readonly string[]): void => {
        if (value === null) entries.push({ path, value: null })
        else if (typeof value === 'string') entries.push({ path, value })
        else if (typeof value === 'number' || typeof value === 'boolean') entries.push({ path, value: String(value) })
        else if (Array.isArray(value)) throw new ConfigError(`${name} has an array at ${path.join('.')}, and arrays are not supported`)
        else if (isTree(value)) for (const [key, child] of Object.entries(value)) walk(child, [...path, key])
        else throw new ConfigError(`${name} has ${describe(value)} at ${path.join('.')}, which is not a value of configuration`)
    }
    walk(tree, [])
    return entries
}

function isTree(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describe(value: unknown): string {
    if (Array.isArray(value)) return 'an array'
    if (value === null) return 'null'
    return `a ${typeof value}`
}
