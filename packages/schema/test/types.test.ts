import type { StandardSchemaV1 } from '@caucejs/base'
import { Services } from '@caucejs/di'
import { describe, expect, it } from 'vitest'
import * as z from 'zod'

import { JsonSerializer, jsonSerializer } from '../src/index.js'

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export async function whatTheCompilerRefuses(validating: StandardSchemaV1<unknown, string>): Promise<void> {
    // @ts-expect-error a class whose schema produces something else than the class
    await serializer.read(Speaker, {})
    // @ts-expect-error a schema that only validates cannot be described
    serializer.schemaOf(validating)
}

export async function whatTheCompilerInfers(): Promise<void> {
    const talk: Talk = await serializer.read(Talk, {})
    const title: string = await serializer.read(z.string(), 'Opening')
    // @ts-expect-error a string schema does not produce a number
    const count: number = await serializer.read(z.string(), 'Opening')
    void [talk, title, count]
}

describe('the types', () => {
    it('let a class whose schema produces it through', async () => {
        expect(await serializer.read(Talk, { title: 'Opening' })).toBeInstanceOf(Talk)
    })
})

class Talk {
    static readonly schema = z.object({ title: z.string() }).transform(({ title }) => new Talk(title))
    readonly #title: string

    constructor(title: string) {
        this.#title = title
    }

    get title(): string {
        return this.#title
    }
}

class Speaker {
    static readonly schema = z.object({ name: z.string() })
    readonly #name = ''

    get name(): string {
        return this.#name
    }
}

const serializer = new Services().add(jsonSerializer()).build({ validate: true }).get(JsonSerializer)
