import { describe, expect, it } from 'vitest'

import { askTheProgram } from '../examples/conference-ai.js'

describe('the canonical use of ai', () => {
    it('runs the tools the model asks for, gives it what they answered, and answers with what it spent', async () => {
        expect(await askTheProgram()).toEqual([
            '[{"id":"opening","title":"Opening","speaker":"Ada","startsAt":"09:00"},{"id":"types","title":"The state of types","speaker":"Ada","startsAt":"11:00"}]',
            'failed: There is no talk keynote',
            '{"id":"opening","title":"Opening","speaker":"Ada","startsAt":"09:00"}',
            'Ada opens the conference at nine, with the Opening.',
            '3000 tokens in and 120 out, on claude-haiku-5-5',
            'The run reached its most steps, 6 steps, and the model still asked for tools, after 5 calls to find_talks, with 3000 tokens in',
        ])
    })
})
