import type { StandardJSONSchemaTarget, StandardJSONSchemaV1, StandardSchemaV1 } from '@caucejs/base'

/** A class that says how it is read: its `static readonly schema` produces an instance of it. */
export type ReadableClass<T> = (abstract new (...args: never[]) => T) & { readonly schema: StandardSchemaV1<unknown, NoInfer<T>> }

/** What can be read: a class with its `schema`, or a schema on its own. */
export type Readable<T> = ReadableClass<T> | StandardSchemaV1<unknown, T>

/** What can be described: a schema that implements Standard JSON Schema, or a class whose `schema` does. */
export type Describable = StandardJSONSchemaV1 | { readonly schema: StandardJSONSchemaV1 }

export type SchemaOptions = {
    /** What the schema takes (`input`, the default) or what it produces (`output`). A tool describes its input. */
    readonly io?: 'input' | 'output'
    /** `draft-2020-12` by default. */
    readonly target?: StandardJSONSchemaTarget
}

/**
 * How an application turns JSON into its values and back, and says what it reads. `web` reads every request with
 * it and writes every response; the tools of a model are described and read with it too. The application adds it
 * with `services.add(jsonSerializer())` and rarely calls it itself.
 */
export abstract class JsonSerializer {
    /**
     * Validates parsed JSON with a schema, or with the `schema` of a class, and returns what it produces. Throws
     * `ValidationError` with every issue the schema found.
     */
    abstract read<T>(type: ReadableClass<T>, input: unknown): Promise<T>
    abstract read<T>(schema: StandardSchemaV1<unknown, T>, input: unknown): Promise<T>

    /** The JSON text of a value. A value of the domain says how it is written with `toJSON`. */
    abstract write(value: unknown): string

    /** The JSON Schema of what a schema, or the `schema` of a class, reads. Throws `JsonSchemaUnavailableError`. */
    abstract schemaOf(described: Describable, options?: SchemaOptions): Record<string, unknown>
}
