import { Command, Query } from '@caucejs/application'
import type { StandardSchemaV1 } from '@caucejs/base'
import { describe, expect, it } from 'vitest'
import * as z from 'zod'

import { tool } from '../src/index.js'

class GetSpeaker extends Query.returning<string>().from(z.strictObject({ speakerId: z.string() })) {}

// A request written by hand, without a schema.
class CloseSales extends Command {}

// Its schema reads it, and cannot say what it takes as JSON Schema.
class CancelTalk extends Command {
    static readonly schema: StandardSchemaV1<unknown, CancelTalk> = {
        '~standard': { version: 1, vendor: 'by hand', validate: () => ({ value: new CancelTalk() }) },
    }
}

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export function whatTheCompilerRefuses(): void {
    // @ts-expect-error a request without a schema cannot be read from what the model sends
    tool(CloseSales, { name: 'close_sales', description: 'Closes the sales' })
    // @ts-expect-error a schema that cannot say what it takes as JSON Schema
    tool(CancelTalk, { name: 'cancel_talk', description: 'Cancels a talk' })
    // @ts-expect-error something that is not a request
    tool(Date, { name: 'today', description: 'Today' })
    // @ts-expect-error a tool needs a description
    tool(GetSpeaker, { name: 'get_speaker' })
    // @ts-expect-error readOnly is said with a boolean
    tool(GetSpeaker, { name: 'get_speaker', description: 'A speaker', readOnly: 'yes' })
}

describe('the types', () => {
    it('let a request declared from its schema through', () => {
        expect(tool(GetSpeaker, { name: 'get_speaker', description: 'A speaker' }).request).toBe(GetSpeaker)
    })
})
