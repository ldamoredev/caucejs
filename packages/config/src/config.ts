import { ConfigError } from './errors/config-error.js'
import { InvalidSettingsError } from './errors/invalid-settings-error.js'
import type { SettingsClass } from './settings.js'
import type { Source } from './source.js'
import type { StandardSchemaIssue } from '@caucejs/base'

type Node = { [key: string]: Node | string }
type Origin = { readonly source: string; readonly key?: string }

/**
 * The configuration of an application: sources stacked in the order they are added, where the last one that sets
 * a key wins. It is read through settings classes only, bound while the application is composed:
 *
 * ```ts
 * const config = new Config().add(memory({ github: { branch: 'main' } })).add(environment(process.env))
 * services.addInstance(GithubSettings, config.bind(GithubSettings))
 * ```
 *
 * It has no default sources and no default order: the host decides them.
 */
export class Config {
    readonly #sources: Source[] = []

    /** Stacks sources on top of the ones already added, in the order given. */
    add(...sources: Source[]): this {
        this.#sources.push(...sources)
        return this
    }

    /**
     * Validates the section of a settings class against its schema, and returns an instance with what the schema
     * returned. A section that is not there is validated as `{}`, so the error says what is missing. Throws
     * {@link InvalidSettingsError} with every problem of the section, and {@link ConfigError} if the schema is
     * asynchronous: binding happens while the application is composed, and composing does not wait.
     */
    bind<T extends object, S extends T>(type: SettingsClass<T, S>): S {
        const { tree, origins } = this.#layer()
        const sectionPath = type.section === '' ? [] : type.section.split('.')
        const raw = valueAt(tree, sectionPath) ?? {}
        const result = type.schema['~standard'].validate(plain(raw))
        if (result instanceof Promise) {
            throw new ConfigError(`The schema of ${describeSection(type.section)} is asynchronous, and settings are bound while the application is composed`)
        }
        if (result.issues) {
            throw new InvalidSettingsError(type.section, result.issues.map(issue => describeIssue(issue, sectionPath, tree, origins)))
        }
        return new type(result.value)
    }

    #layer(): { tree: Node; origins: Map<string, Origin> } {
        const tree: Node = Object.create(null) as Node
        const origins = new Map<string, Origin>()
        for (const source of this.#sources) {
            for (const entry of source.entries) {
                set(tree, entry.path, entry.value)
                forget(origins, entry.path)
                if (entry.value !== null) {
                    origins.set(keyOf(entry.path), entry.key === undefined ? { source: source.name } : { source: source.name, key: entry.key })
                }
            }
        }
        return { tree, origins }
    }
}

// A later value replaces whatever was at its path, a whole section included; a later section replaces a value.
function set(tree: Node, path: readonly string[], value: string | null): void {
    if (path.length === 0) return
    let node = tree
    for (const level of path.slice(0, -1)) {
        const next = node[level]
        if (typeof next === 'object') {
            node = next
        } else {
            const created = Object.create(null) as Node
            node[level] = created
            node = created
        }
    }
    const last = path.at(-1)!
    if (value === null) delete node[last]
    else node[last] = value
}

function forget(origins: Map<string, Origin>, path: readonly string[]): void {
    const key = keyOf(path)
    for (const known of [...origins.keys()]) {
        if (known === key || known.startsWith(`${key}.`) || key.startsWith(`${known}.`)) origins.delete(known)
    }
}

function valueAt(tree: Node, path: readonly string[]): Node | string | undefined {
    let value: Node | string | undefined = tree
    for (const level of path) {
        if (typeof value !== 'object') return undefined
        value = value[level]
    }
    return value
}

// The tree is built without prototypes, so a key such as __proto__ is only a key; the schema gets plain objects,
// and Object.fromEntries defines each key instead of assigning it.
function plain(value: Node | string): unknown {
    if (typeof value === 'string') return value
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plain(child)]))
}

function describeIssue(issue: StandardSchemaIssue, sectionPath: readonly string[], tree: Node, origins: Map<string, Origin>): string {
    const path = [...sectionPath, ...(issue.path ?? []).map(level => String(typeof level === 'object' ? level.key : level))]
    const where = path.length === 0 ? 'the root' : keyOf(path)
    const value = valueAt(tree, path)
    const message = typeof value === 'string' ? hide(issue.message, value) : issue.message
    const origin = origins.get(keyOf(path))
    if (origin) return `${where}: ${message} (set by ${origin.source}${origin.key === undefined ? '' : `, ${origin.key}`})`
    return `${where}: ${message}${value === undefined ? ' (not set)' : ''}`
}

// A validator may quote the value in its message, and the value can be a secret. A value shorter than four
// characters is cut only when quoted: cut everywhere, it would eat letters of the message itself.
function hide(message: string, value: string): string {
    if (value === '') return message
    let hidden = message.replaceAll(JSON.stringify(value), '[hidden]').replaceAll(`'${value}'`, '[hidden]')
    if (value.length >= 4) hidden = hidden.replaceAll(value, '[hidden]')
    return hidden
}

function keyOf(path: readonly string[]): string {
    return path.join('.')
}

function describeSection(section: string): string {
    return section === '' ? 'the root' : section
}
