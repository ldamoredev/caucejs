/**
 * The Standard Schema contract (https://standardschema.dev), version 1, copied as the spec suggests so that
 * Cauce depends on no validator. Zod, Valibot and ArkType implement it, and so can a hand-written object.
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
