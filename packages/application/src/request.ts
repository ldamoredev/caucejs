import type { BuiltBySchema, InferOutput, StandardJSONSchemaV1, StandardSchemaResult, StandardSchemaV1 } from '@caucejs/base'

// Type only: it carries the result of a request for the compiler, and does not exist at runtime.
declare const result: unique symbol

/**
 * What a use case is asked to do. `R` is what it answers, and the compiler infers it from the class, so
 * `useCases.execute(new GetTalk(id))` is a `Promise<Talk>` without saying so.
 *
 * Two request classes with the same fields are the same type to the compiler. Give each one a field of its own
 * when a handler could be paired with the wrong request.
 */
export abstract class Request<R> {
    declare readonly [result]: R
}

/**
 * A request that changes something. It answers nothing unless it says so: `Command<TalkId>`.
 *
 * Declared from its schema, its fields are written once: `class SellTicket extends Command.from(schema) {}`, or
 * `Command.returning<TicketId>().from(schema)` when it answers something.
 */
export abstract class Command<R = void> extends Request<R> {
    /** A command that answers nothing, whose fields and constructor come from `schema`. See {@link RequestFrom}. */
    static from<S extends StandardSchemaV1<unknown, object>>(schema: S): RequestFrom<Command, S> {
        return requestFrom(Command, schema) as never
    }

    /** The command that answers `R`: `Command.returning<TicketId>().from(schema)`. */
    static returning<R>(): { from<S extends StandardSchemaV1<unknown, object>>(schema: S): RequestFrom<Command<R>, S> } {
        return { from: schema => requestFrom(Command, schema) as never }
    }
}

/**
 * A request that only reads.
 *
 * Declared from its schema, it says what it answers: `class GetTalk extends Query.returning<Talk>().from(schema) {}`.
 */
export abstract class Query<R> extends Request<R> {
    /** The query that answers `R`, whose fields and constructor come from `schema`. See {@link RequestFrom}. */
    static returning<R>(): { from<S extends StandardSchemaV1<unknown, object>>(schema: S): RequestFrom<Query<R>, S> } {
        return { from: schema => requestFrom(Query, schema) as never }
    }
}

/** What a request answers. */
export type ResultOf<T> = T extends Request<infer R> ? R : never

/** The fields a schema gives a request: what it produces, read only. */
export type FieldsOf<S extends StandardSchemaV1<unknown, object>> = { readonly [K in keyof InferOutput<S>]: InferOutput<S>[K] }

/**
 * The base class `from` returns, to extend: its constructor takes the fields the schema produces, and its static
 * `schema` validates with the schema given and builds an instance of the subclass it is read through. It describes
 * itself as JSON Schema when the schema given does. Building one in code does not validate: the schema is for what
 * comes from outside.
 */
export type RequestFrom<Base, S extends StandardSchemaV1<unknown, object>> = (abstract new (fields: FieldsOf<S>) => Base & FieldsOf<S>) & {
    readonly schema: StandardSchemaV1<unknown, Base & FieldsOf<S>> & (S extends StandardJSONSchemaV1 ? StandardJSONSchemaV1 : unknown)
} & BuiltBySchema

type Standard = StandardSchemaV1['~standard'] & { readonly jsonSchema?: StandardJSONSchemaV1['~standard']['jsonSchema'] }

const schemasByClass = new WeakMap<object, StandardSchemaV1>()

function requestFrom<Base extends abstract new () => Request<unknown>, S extends StandardSchemaV1<unknown, object>>(
    base: Base,
    schema: S,
): RequestFrom<InstanceType<Base>, S> {
    abstract class FromSchema extends (base as unknown as abstract new () => Request<unknown>) {
        constructor(fields: object) {
            super()
            Object.assign(this, fields)
        }

        // A getter, so that `this` is the subclass it is read through. Built once per class.
        static get schema(): StandardSchemaV1 {
            let built = schemasByClass.get(this)
            if (!built) {
                built = building(schema, this as unknown as new (fields: object) => object)
                schemasByClass.set(this, built)
            }
            return built
        }
    }
    return FromSchema as unknown as RequestFrom<InstanceType<Base>, S>
}

function building(schema: StandardSchemaV1, requestClass: new (fields: object) => object): StandardSchemaV1 {
    const inner = schema['~standard'] as Standard
    const validate = async (value: unknown): Promise<StandardSchemaResult<object>> => {
        const read = await inner.validate(value)
        return read.issues ? read : { value: new requestClass(read.value as object) }
    }
    const standard: Standard = { version: inner.version, vendor: inner.vendor, validate, ...(inner.jsonSchema && { jsonSchema: inner.jsonSchema }) }
    return { '~standard': standard }
}
