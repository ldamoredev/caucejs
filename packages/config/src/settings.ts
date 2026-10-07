import type { StandardSchemaV1 } from '@caucejs/base'

/**
 * A class for one section of the configuration. The class is the token the container injects; its schema
 * validates the section, and its instances carry what the schema returned.
 */
export interface SettingsClass<T extends object, S extends T = T> {
    /** The path of the section, with dots: `github`, `mail.smtp`. An empty string is the root. */
    readonly section: string
    readonly schema: StandardSchemaV1<unknown, T>
    new (values: T): S
}

/**
 * The base of a settings class:
 *
 * ```ts
 * class GithubSettings extends settings('github', githubSchema) {}
 * services.addInstance(GithubSettings, config.bind(GithubSettings))
 * ```
 */
export function settings<T extends object>(section: string, schema: StandardSchemaV1<unknown, T>): SettingsClass<T> {
    class Settings {
        static readonly section = section
        static readonly schema = schema

        constructor(values: T) {
            Object.assign(this, values)
        }
    }
    // The instance type comes from the schema, which TypeScript cannot attach to a class it declares here.
    return Settings as unknown as SettingsClass<T>
}
