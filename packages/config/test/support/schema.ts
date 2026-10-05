import type { StandardSchemaIssue, StandardSchemaResult, StandardSchemaV1 } from '../../src/index.js'

// A hand-written Standard Schema, just enough for the tests: Cauce depends on no validator.

type Field<T> = (value: unknown) => { value: T } | { message: string }

export function text(): Field<string> {
    return value => (typeof value === 'string' ? { value } : { message: 'Expected a text' })
}

export function integer(): Field<number> {
    return value => {
        const number = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : Number.NaN
        return Number.isInteger(number) ? { value: number } : { message: `Expected an integer, received ${JSON.stringify(value)}` }
    }
}

export function atLeast(length: number): Field<string> {
    return value =>
        typeof value === 'string' && value.length >= length
            ? { value }
            : { message: `Expected at least ${length} characters, received ${JSON.stringify(value)}` }
}

/** Fails always, quoting the value without quotes, as some validators do. */
export function rejected(): Field<string> {
    return value => ({ message: `Rejected ${String(value)}` })
}

export function optional<T>(field: Field<T>, fallback: T): Field<T> {
    return value => (value === undefined ? { value: fallback } : field(value))
}

export function object<Shape extends Record<string, Field<unknown>>>(
    shape: Shape,
): StandardSchemaV1<unknown, { [K in keyof Shape]: Shape[K] extends Field<infer T> ? T : never }> {
    type Output = { [K in keyof Shape]: Shape[K] extends Field<infer T> ? T : never }
    return {
        '~standard': {
            version: 1,
            vendor: 'test',
            validate(input: unknown): StandardSchemaResult<Output> {
                if (typeof input !== 'object' || input === null) return { issues: [{ message: 'Expected an object' }] }
                const issues: StandardSchemaIssue[] = []
                const output: Record<string, unknown> = {}
                for (const [key, field] of Object.entries(shape)) {
                    const result = field((input as Record<string, unknown>)[key])
                    if ('message' in result) issues.push({ message: result.message, path: [key] })
                    else output[key] = result.value
                }
                return issues.length > 0 ? { issues } : { value: output as Output }
            },
        },
    }
}

/** A schema whose validation returns a promise, which binding refuses. */
export function asynchronous(): StandardSchemaV1<unknown, { ready: boolean }> {
    return { '~standard': { version: 1, vendor: 'test', validate: async () => ({ value: { ready: true } }) } }
}
