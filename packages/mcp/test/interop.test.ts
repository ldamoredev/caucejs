import { Web } from '@caucejs/web'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { describe, expect, it } from 'vitest'

import { conference } from './support/conference.js'

// The official client of MCP against the fetch of the application, in memory: what a real client sends and reads.
describe('the official client of MCP', () => {
    it.each([
        ['2025-11-25', {}],
        ['2026-07-28', { versionNegotiation: { mode: { pin: '2026-07-28' } } }],
    ] as const)('speaks the revision %s with the server, and is always answered with JSON', async (revision, options) => {
        const { fetch, answered } = recording(conference().get(Web).fetch)
        const client = new Client({ name: 'box office', version: '1.0.0' }, options)
        await client.connect(
            new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), {
                fetch,
                requestInit: { headers: { authorization: 'Bearer box-office' } },
            }),
        )

        const listed = await client.listTools()
        const sold = await client.callTool({ name: 'sell_ticket', arguments: { talkId: 'opening' } })
        const soldOut = await client.callTool({ name: 'sell_ticket', arguments: { talkId: 'opening' } })
        const missing = client.callTool({ name: 'cancel_talk', arguments: {} })
        await expect(missing).rejects.toMatchObject({ code: -32602 })
        const negotiated = client.getNegotiatedProtocolVersion()
        await client.close()

        expect(negotiated).toBe(revision)
        expect(listed.tools.map(tool => tool.name)).toContain('sell_ticket')
        expect(sold).toMatchObject({ content: [{ type: 'text', text: '0' }], structuredContent: { result: 0 } })
        expect(soldOut).toMatchObject({ content: [{ type: 'text', text: 'The talk has no seats left' }], isError: true })
        expect(answered.length).toBeGreaterThan(0)
        for (const contentType of answered) expect(contentType).toBe('application/json')
    })

    it('is refused without its token', async () => {
        const client = new Client({ name: 'nobody', version: '1.0.0' })

        await expect(
            client.connect(new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), { fetch: recording(conference().get(Web).fetch).fetch })),
        ).rejects.toThrow()
    })
})

// Keeps the content type of every response that has a body, so the test sees that none of them is a stream.
function recording(handler: (request: Request) => Promise<Response>) {
    const answered: string[] = []
    const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const response = await handler(new Request(input, init))
        if (response.status !== 202) answered.push(response.headers.get('content-type') ?? 'none')
        return response
    }
    return { fetch, answered }
}
