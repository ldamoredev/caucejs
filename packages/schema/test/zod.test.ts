import { Services } from '@caucejs/di'
import { describe, expect, it } from 'vitest'
import * as z from 'zod'

import { JsonSchemaUnavailableError, JsonSerializer, jsonSerializer, ValidationError } from '../src/index.js'

// The library the docs use, read for real: the contract is the standard, and this checks one library keeps it.
describe('with zod', () => {
    it('reads a body into the class its schema produces', async () => {
        const request = await serializer.read(CheckOff, { items: [{ note: 'talks.md', index: 2 }] })

        expect(request).toBeInstanceOf(CheckOff)
        expect(request.items).toEqual([{ note: 'talks.md', index: 2 }])
    })

    it('refuses a body with the path of each field that is wrong', async () => {
        const error = await serializer.read(CheckOff, { items: [{ note: '', index: -1 }] }).catch((thrown: ValidationError) => thrown)

        expect((error as ValidationError).issues.map(issue => issue.path)).toEqual(['items.0.note', 'items.0.index'])
    })

    it('describes the input of the schema of a class, and keeps it strict', () => {
        const schema = serializer.schemaOf(CheckOff)

        expect(schema).toMatchObject({ type: 'object', required: ['items'], additionalProperties: false })
    })

    it('cannot describe the output of a transform', () => {
        expect(() => serializer.schemaOf(CheckOff, { io: 'output' })).toThrow(JsonSchemaUnavailableError)
    })
})

class CheckOff {
    static readonly schema = z
        .strictObject({ items: z.array(z.strictObject({ note: z.string().min(1), index: z.int().nonnegative() })).min(1) })
        .transform(({ items }) => new CheckOff(items))

    readonly items: readonly { readonly note: string; readonly index: number }[]

    constructor(items: readonly { readonly note: string; readonly index: number }[]) {
        this.items = items
    }
}

const serializer = new Services().add(jsonSerializer()).build({ validate: true }).get(JsonSerializer)
