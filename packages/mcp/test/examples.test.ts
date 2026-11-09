import { describe, expect, it } from 'vitest'

import { callTheConference } from '../examples/conference-mcp.js'

describe('the canonical server of MCP', () => {
    it('closes the endpoint to nobody, lists the tools, runs them, and answers what failed for the client to read', async () => {
        expect(await callTheConference()).toEqual([
            'without a token: 401 Bearer',
            'listed: get_talk, sell_ticket',
            'sold: 0',
            'sold out: failed, The talk has no seats left',
            'looking for OAuth: 404',
        ])
    })
})
