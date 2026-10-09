import type { StandardSchemaIssue, StandardSchemaV1 } from '@caucejs/base'

import { JsonSchemaUnavailableError } from './errors/json-schema-unavailable-error.js'
import { ValidationError, type ValidationIssue } from './errors/validation-error.js'
import { JsonSerializer, type Describable, type Readable, type ReadableClass, type SchemaBuiltClass, type SchemaOptions } from './json-serializer.js'

/**
 * The serializer of Cauce: it reads with any Standard Schema, writes with `JSON.stringify`, and describes with any
 * Standard JSON Schema. It depends on no schema library; the application picks one.
 */
export class DefaultJsonSerializer extends JsonSerializer {
    read<C extends SchemaBuiltClass>(type: C, input: unknown): Promise<InstanceType<C>>
    read<T>(type: ReadableClass<T>, input: unknown): Promise<T>
    read<T>(schema: StandardSchemaV1<unknown, T>, input: unknown): Promise<T>
    async read<T>(readable: Readable<T>, input: unknown): Promise<T> {
        const schema = ('~standard' in readable ? readable : readable.schema) as StandardSchemaV1<unknown, T>
        const result = await schema['~standard'].validate(input)
        if (result.issues) throw new ValidationError(result.issues.map(issueOf))
        return result.value
    }

    /** `undefined`, which JSON has no word for, is written as `null`. */
    write(value: unknown): string {
        return JSON.stringify(value) ?? 'null'
    }

    /**
     * It never guesses: a schema whose library does not implement Standard JSON Schema, or that holds something JSON
     * Schema cannot say, such as the output of a transform, fails. Adapting the result to what a provider of models
     * takes is not done here.
     */
    schemaOf(described: Describable, options: SchemaOptions = {}): Record<string, unknown> {
        const schema = '~standard' in described ? described : described.schema
        const standard = schema['~standard']
        // The compiler asks for Standard JSON Schema; this covers a schema typed loosely, which is how most get here.
        if (typeof standard.jsonSchema !== 'object' || standard.jsonSchema === null) {
            throw new JsonSchemaUnavailableError(standard.vendor, 'its library does not implement Standard JSON Schema')
        }
        const io = options.io ?? 'input'
        try {
            return standard.jsonSchema[io]({ target: options.target ?? 'draft-2020-12' })
        } catch (error) {
            throw new JsonSchemaUnavailableError(standard.vendor, `its ${io} cannot be said in JSON Schema`, { cause: error })
        }
    }
}

function issueOf(issue: StandardSchemaIssue): ValidationIssue {
    const path = (issue.path ?? []).map(segment => keyName(typeof segment === 'object' ? segment.key : segment))
    return { path: path.join('.'), message: issue.message }
}

function keyName(key: PropertyKey): string {
    return typeof key === 'symbol' ? (key.description ?? 'symbol') : String(key)
}
