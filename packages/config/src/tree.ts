/** A value written by hand or read from JSON: every leaf becomes a string, and `null` unsets a key. */
export type ConfigValue = string | number | boolean | null | ConfigTree

export type ConfigTree = { readonly [key: string]: ConfigValue }
