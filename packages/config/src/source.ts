/** One value of a source, at its path. */
export type Entry = {
    readonly path: readonly string[]
    /** `null` unsets what an earlier source set at the same path. */
    readonly value: string | null
    /** The name the value had where it came from, such as `GITHUB__TOKEN`. Errors print it. */
    readonly key?: string
}

/**
 * Where values come from: an object in memory, a JSON document, the environment. A source reads everything when
 * it is created, and in a {@link Config} the sources added later win.
 */
export interface Source {
    /** Names the source in errors: `memory`, `settings.json`, `the environment`. */
    readonly name: string
    readonly entries: readonly Entry[]
}
