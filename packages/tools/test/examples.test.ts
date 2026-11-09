import { describe, expect, it } from 'vitest'

import { callTheTools } from '../examples/conference-tools.js'

describe('the canonical tools', () => {
    it('describe the use cases, run them, and answer what failed for the caller to read', async () => {
        expect(await callTheTools()).toEqual([
            'get_talk, read only, takes ["talkId"]',
            'sell_ticket takes ["talkId"]',
            '{"id":"opening","title":"Opening","seats":1}',
            '0',
            'failed: The talk has no seats left',
            'failed: The input is not valid: talkId: Invalid input: expected string, received undefined; Unrecognized key: "talk"',
        ])
    })
})
