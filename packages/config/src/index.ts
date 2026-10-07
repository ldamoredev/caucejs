export { Config } from './config.js'
export { environment, type EnvironmentOptions } from './environment.js'
export { ConfigError } from './errors/config-error.js'
export { InvalidSettingsError } from './errors/invalid-settings-error.js'
export { json, memory } from './objects.js'
export { settings, type SettingsClass } from './settings.js'
export type { Entry, Source } from './source.js'
// Kept from before the contracts moved to @caucejs/base, so code that imports them from here still compiles.
export type {
    InferOutput,
    StandardSchemaIssue,
    StandardSchemaProps,
    StandardSchemaResult,
    StandardSchemaV1,
} from '@caucejs/base'
export type { ConfigTree, ConfigValue } from './tree.js'
