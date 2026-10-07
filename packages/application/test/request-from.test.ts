import type { StandardJSONSchemaV1, StandardSchemaResult, StandardSchemaV1 } from '@caucejs/base'
import { Services } from '@caucejs/di'
import { describe, expect, it } from 'vitest'
import * as z from 'zod'

import { application, Command, Handler, Query, UseCases } from '../src/index.js'

describe('a request declared from its schema', () => {
    it('takes its fields from what the schema produces', () => {
        const rename = new RenameTalk({ id: 't1', title: 'Opening' })

        expect([rename.id, rename.title]).toEqual(['t1', 'Opening'])
    })

    it('is an instance of its class and of the kind of request it extends', () => {
        const rename = new RenameTalk({ id: 't1', title: 'Opening' })

        expect(rename).toBeInstanceOf(RenameTalk)
        expect(rename).toBeInstanceOf(Command)
        expect(new GetTalk({ id: 't1' })).toBeInstanceOf(Query)
    })

    it('does not validate when it is built in code', () => {
        expect(new RenameTalk({ id: '', title: '' }).title).toBe('')
    })

    describe('its schema', () => {
        it('validates with the schema given and builds the class it is read through', async () => {
            const rename = await valueOf(RenameTalk.schema, { id: 't1', title: '  Opening  ' })

            expect(rename).toBeInstanceOf(RenameTalk)
            expect((rename as RenameTalk).summary).toBe('t1: Opening')
        })

        it('builds the subclass of a subclass', async () => {
            expect(await valueOf(RenameKeynote.schema, { id: 't1', title: 'Opening' })).toBeInstanceOf(RenameKeynote)
        })

        it('returns the issues of the schema given, untouched', async () => {
            const outcome = await RenameTalk.schema['~standard'].validate({ id: 't1', title: '' })

            expect(outcome.issues?.map(issue => [issue.path, issue.message])).toEqual([[['title'], 'Too small: expected string to have >=1 characters']])
        })

        it('waits for a schema that validates asynchronously', async () => {
            const read = await valueOf(Later.schema, {})

            expect(read).toBeInstanceOf(Later)
            expect((read as Later).when).toBe('later')
        })

        it('keeps the vendor and the version of the schema given', () => {
            expect([RenameTalk.schema['~standard'].vendor, RenameTalk.schema['~standard'].version]).toEqual(['zod', 1])
        })

        it('is built once for each class', () => {
            expect(RenameTalk.schema).toBe(RenameTalk.schema)
            expect(RenameKeynote.schema).not.toBe(RenameTalk.schema)
        })

        it('describes itself as JSON Schema as the schema given does', () => {
            expect(RenameTalk.schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toEqual(
                z.toJSONSchema(renameTalk, { io: 'input' }),
            )
        })

        it('does not describe itself when the schema given cannot', () => {
            expect('jsonSchema' in Later.schema['~standard']).toBe(false)
        })
    })

    it('runs through the use cases, answering what its command says', async () => {
        const provider = new Services().add(application(app => app.handle(SellTicket, SellTicketHandler))).build({ validate: true })

        const left = await provider.get(UseCases).execute(new SellTicket({ talk: 'opening' }), { scope: provider })

        expect(left).toBe(7)
    })
})

async function valueOf(schema: StandardSchemaV1, input: unknown): Promise<unknown> {
    const outcome = await schema['~standard'].validate(input)
    if (outcome.issues) throw new Error('It did not validate')
    return outcome.value
}

const renameTalk = z.strictObject({ id: z.string(), title: z.string().trim().min(1) })

class RenameTalk extends Command.from(renameTalk) {
    get summary(): string {
        return `${this.id}: ${this.title}`
    }
}

class RenameKeynote extends RenameTalk {}

class GetTalk extends Query.returning<string>().from(z.object({ id: z.string() })) {}

class SellTicket extends Command.returning<number>().from(z.object({ talk: z.string() })) {
    static readonly anonymous = true
}

class SellTicketHandler extends Handler<SellTicket> {
    async execute(request: SellTicket): Promise<number> {
        return request.talk.length
    }
}

const later: StandardSchemaV1<unknown, { when: string }> = {
    '~standard': { version: 1, vendor: 'by hand', validate: async (): Promise<StandardSchemaResult<{ when: string }>> => ({ value: { when: 'later' } }) },
}

class Later extends Command.from(later) {}

export type DescribesItself = typeof RenameTalk.schema extends StandardJSONSchemaV1 ? true : false
