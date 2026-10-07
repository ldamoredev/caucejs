import { ApplicationError, type StandardSchemaIssue, type StandardSchemaV1 } from '@caucejs/base'
import { Services } from '@caucejs/di'
import { describe, expect, it } from 'vitest'

import { DefaultJsonSerializer, JsonSerializer, jsonSerializer, ValidationError } from '../src/index.js'

describe('writing', () => {
    it('writes a value as JSON', () => {
        expect(serializer.write({ title: 'Opening', seats: [1, 2] })).toBe('{"title":"Opening","seats":[1,2]}')
    })

    it('lets a value of the domain say how it is written', () => {
        expect(serializer.write({ price: new Price(1050) })).toBe('{"price":"10.50"}')
    })

    it('writes nothing as null', () => {
        expect(serializer.write(undefined)).toBe('null')
    })
})

describe('the serializer of the container', () => {
    it('is the default one, added by the extension', () => {
        expect(serializer).toBeInstanceOf(DefaultJsonSerializer)
    })
})

describe('reading', () => {
    it('returns what the schema produces', async () => {
        expect(await serializer.read(schemaThat({ value: 'opening' }), 'anything')).toBe('opening')
    })

    it('gives the schema the input as it came', async () => {
        const schema = recording()

        await serializer.read(schema, { talk: 'opening' })

        expect(schema.inputs).toEqual([{ talk: 'opening' }])
    })

    it('waits for a schema that validates asynchronously', async () => {
        expect(await serializer.read(schemaThat({ value: 'opening' }, { later: true }), 'anything')).toBe('opening')
    })

    it('reads with the schema of a class, and returns the instance it produces', async () => {
        const talk = await serializer.read(Talk, { title: 'Opening' })

        expect(talk).toBeInstanceOf(Talk)
        expect(talk.title).toBe('Opening')
    })

    describe('input the schema refuses', () => {
        it('fails with a validation error, which belongs to the application', async () => {
            const failing = serializer.read(schemaThat({ issues: [{ message: 'Required', path: ['title'] }] }), {})

            await expect(failing).rejects.toThrow(ValidationError)
            await expect(failing).rejects.toBeInstanceOf(ApplicationError)
        })

        it('carries every issue, in order, with its path joined by dots', async () => {
            const error = await refusal([
                { message: 'Too small', path: ['items', 1, 'index'] },
                { message: 'Required', path: ['title'] },
            ])

            expect(error.issues).toEqual([
                { path: 'items.1.index', message: 'Too small' },
                { path: 'title', message: 'Required' },
            ])
        })

        it('reads a path written with segments as one written with keys', async () => {
            const error = await refusal([{ message: 'Too small', path: [{ key: 'items' }, { key: 0 }, 'nota'] }])

            expect(error.issues[0]?.path).toBe('items.0.nota')
        })

        it('names a symbol key by its description', async () => {
            const error = await refusal([{ message: 'Required', path: [Symbol('secret'), Symbol()] }])

            expect(error.issues[0]?.path).toBe('secret.symbol')
        })

        it('leaves the path empty for an issue about the whole input', async () => {
            const error = await refusal([{ message: 'Expected an object' }])

            expect(error.issues).toEqual([{ path: '', message: 'Expected an object' }])
        })

        it('says every issue in its message, the path first when there is one', async () => {
            const error = await refusal([
                { message: 'Expected an object' },
                { message: 'Required', path: ['title'] },
            ])

            expect(error.message).toBe('The input is not valid: Expected an object; title: Required')
        })
    })

    function refusal(issues: StandardSchemaIssue[]): Promise<ValidationError> {
        return serializer.read(schemaThat({ issues }), {}).then(
            () => {
                throw new Error('It was read')
            },
            (error: ValidationError) => error,
        )
    }
})

type Outcome = { readonly value: string } | { readonly issues: readonly StandardSchemaIssue[] }

function schemaThat(outcome: Outcome, options: { later?: boolean } = {}): StandardSchemaV1<unknown, string> {
    return {
        '~standard': {
            version: 1,
            vendor: 'by hand',
            validate: () => (options.later ? Promise.resolve(outcome) : outcome),
        },
    }
}

function recording(): StandardSchemaV1<unknown, string> & { inputs: unknown[] } {
    const inputs: unknown[] = []
    return {
        inputs,
        '~standard': {
            version: 1,
            vendor: 'by hand',
            validate: value => {
                inputs.push(value)
                return { value: 'read' }
            },
        },
    }
}

class Talk {
    static readonly schema: StandardSchemaV1<unknown, Talk> = {
        '~standard': {
            version: 1,
            vendor: 'by hand',
            validate: value => ({ value: new Talk((value as { title: string }).title) }),
        },
    }

    readonly title: string

    constructor(title: string) {
        this.title = title
    }
}

class Price {
    readonly #cents: number

    constructor(cents: number) {
        this.#cents = cents
    }

    toJSON(): string {
        return (this.#cents / 100).toFixed(2)
    }
}

const serializer = new Services().add(jsonSerializer()).build({ validate: true }).get(JsonSerializer)
