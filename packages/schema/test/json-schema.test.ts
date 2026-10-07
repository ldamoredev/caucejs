import type { StandardJSONSchemaOptions, StandardJSONSchemaV1 } from '@caucejs/base'
import { Services } from '@caucejs/di'
import { describe, expect, it } from 'vitest'

import { JsonSchemaUnavailableError, JsonSerializer, jsonSerializer } from '../src/index.js'

describe('describing a schema', () => {
    it('describes what it takes, in draft 2020-12, by default', () => {
        expect(serializer.schemaOf(describing())).toEqual({ side: 'input', target: 'draft-2020-12' })
    })

    it('describes what it produces when asked', () => {
        expect(serializer.schemaOf(describing(), { io: 'output' })).toEqual({ side: 'output', target: 'draft-2020-12' })
    })

    it('asks for the target given', () => {
        expect(serializer.schemaOf(describing(), { target: 'draft-07' })).toEqual({ side: 'input', target: 'draft-07' })
    })

    it('describes the schema of a class', () => {
        expect(serializer.schemaOf({ schema: describing() })).toEqual({ side: 'input', target: 'draft-2020-12' })
    })

    it('fails, naming the library, when the schema does not implement Standard JSON Schema', () => {
        const validating = { '~standard': { version: 1, vendor: 'valibot', validate: () => ({ value: 1 }) } } as unknown as StandardJSONSchemaV1

        expect(() => serializer.schemaOf(validating)).toThrow(
            new JsonSchemaUnavailableError('valibot', 'its library does not implement Standard JSON Schema'),
        )
    })

    it('fails when the library cannot say that side in JSON Schema, keeping why', () => {
        const cause = new Error('Transforms cannot be represented')

        const error = (() => {
            try {
                return serializer.schemaOf(describing({ throws: cause }), { io: 'output' })
            } catch (thrown) {
                return thrown as JsonSchemaUnavailableError
            }
        })()

        expect(error).toEqual(new JsonSchemaUnavailableError('by hand', 'its output cannot be said in JSON Schema'))
        expect((error as JsonSchemaUnavailableError).cause).toBe(cause)
        expect((error as JsonSchemaUnavailableError).vendor).toBe('by hand')
    })
})

function describing(options: { throws?: Error } = {}): StandardJSONSchemaV1 {
    const side = (name: string) => (converterOptions: StandardJSONSchemaOptions) => {
        if (options.throws) throw options.throws
        return { side: name, target: converterOptions.target }
    }
    return { '~standard': { version: 1, vendor: 'by hand', jsonSchema: { input: side('input'), output: side('output') } } }
}

const serializer = new Services().add(jsonSerializer()).build({ validate: true }).get(JsonSerializer)
