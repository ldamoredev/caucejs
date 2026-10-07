// The Standard Schema contracts (https://standardschema.dev), copied from @standard-schema/spec 1.1.0 as the spec
// suggests, so that no Cauce package depends on a validator. Flattened: the spec writes them as namespaces.

/**
 * A schema that validates: version 1 of Standard Schema. Zod, Valibot and ArkType implement it, and so can a
 * hand-written object.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': StandardSchemaProps<Input, Output>
}

export interface StandardSchemaProps<Input = unknown, Output = Input> {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>
    // `| undefined` as the spec writes it: without it, a validator compiled without exactOptionalPropertyTypes
    // would not match this type.
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
}

export type StandardSchemaResult<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: readonly StandardSchemaIssue[] }

export interface StandardSchemaIssue {
    readonly message: string
    readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined
}

/** What a schema returns when the value is valid. */
export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['output']

/** What a schema takes when the value is valid. */
export type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['input']

/**
 * A schema that describes itself as JSON Schema: Standard JSON Schema, version 1. Zod and ArkType implement it;
 * Valibot does through `toStandardJsonSchema` of `@valibot/to-json-schema`.
 */
export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': StandardJSONSchemaProps<Input, Output>
}

export interface StandardJSONSchemaProps<Input = unknown, Output = Input> {
    readonly version: 1
    readonly vendor: string
    readonly jsonSchema: StandardJSONSchemaConverter
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
}

/** Each method may throw when the schema holds something JSON Schema cannot say, such as a transform. */
export interface StandardJSONSchemaConverter {
    readonly input: (options: StandardJSONSchemaOptions) => Record<string, unknown>
    readonly output: (options: StandardJSONSchemaOptions) => Record<string, unknown>
}

export interface StandardJSONSchemaOptions {
    readonly target: StandardJSONSchemaTarget
    readonly libraryOptions?: Record<string, unknown> | undefined
}

/** The spec asks every library for the first two; the rest is best effort, and a library throws for one it lacks. */
export type StandardJSONSchemaTarget = 'draft-2020-12' | 'draft-07' | 'openapi-3.0' | (string & {})

// Type only, like the contracts above: it marks a class for the compiler and does not exist at runtime.
declare const builtBySchema: unique symbol

/**
 * Marks a class whose static `schema` builds an instance of whichever subclass it is read through, as
 * `Command.from(schema)` of `@caucejs/application` makes them. A reader that sees it returns the instance of the
 * subclass, methods of its own included, instead of what the schema says it produces.
 */
export type BuiltBySchema = { readonly [builtBySchema]: true }
