import { InvalidArgumentError } from '@caucejs/base'
import { CompositionError } from '@caucejs/di'
import { JsonSchemaUnavailableError } from '@caucejs/schema'
import { TestClient } from '@caucejs/testing'
import { tool } from '@caucejs/tools'
import { Web } from '@caucejs/web'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { McpTools } from '../src/index.js'
import {
    callOf,
    clientOf,
    conference,
    endpoint,
    getTalk,
    GetTalk,
    Journal,
    revisions,
    rpc,
    scheduleTalk,
    type Revision,
    sellTicket,
} from './support/conference.js'

type ToolResult = {
    readonly content: readonly { readonly type: string; readonly text: string }[]
    readonly structuredContent?: unknown
    readonly isError?: boolean
}

describe('a server of MCP', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('with a token', () => {
        it('lists every tool, with the JSON Schema of its input and whether it only reads', async () => {
            const response = await boxOffice().post('/mcp', { json: rpc('tools/list') })

            response.succeeds(200)
            const { tools } = resultOf<{ tools: { name: string; description: string; inputSchema: unknown; annotations: unknown }[] }>(response.json())
            expect(tools.map(listed => listed.name)).toEqual([
                'get_talk',
                'list_titles',
                'sell_ticket',
                'return_ticket',
                'retitle_talk',
                'who_am_i',
                'print_badges',
            ])
            expect(tools[0]).toEqual({
                name: 'get_talk',
                description: 'A talk of the conference, by its id',
                inputSchema: {
                    $schema: 'https://json-schema.org/draft/2020-12/schema',
                    type: 'object',
                    properties: { talkId: { type: 'string', minLength: 1 } },
                    required: ['talkId'],
                    additionalProperties: false,
                },
                annotations: { readOnlyHint: true },
            })
            expect(tools[2]?.annotations).toEqual({ readOnlyHint: false })
        })

        it('answers an object as structured content, and as the JSON text the serializer writes', async () => {
            const result = await call(boxOffice(), 'get_talk', { talkId: 'opening' })

            expect(result).toEqual({
                content: [{ type: 'text', text: '{"id":"opening","title":"Opening","seats":1}' }],
                structuredContent: { id: 'opening', title: 'Opening', seats: 1 },
            })
        })

        it('answers what is not an object under result', async () => {
            const client = boxOffice()

            expect(await call(client, 'sell_ticket', { talkId: 'opening' })).toEqual({
                content: [{ type: 'text', text: '0' }],
                structuredContent: { result: 0 },
            })
            expect(await call(client, 'list_titles', {})).toEqual({
                content: [{ type: 'text', text: '["Opening","Closing"]' }],
                structuredContent: { result: ['Opening', 'Closing'] },
            })
        })

        it('answers "Done." for a use case that answers nothing', async () => {
            expect(await call(boxOffice(), 'return_ticket', { talkId: 'opening' })).toEqual({ content: [{ type: 'text', text: 'Done.' }] })
        })

        it('runs every tool through the middlewares, as the identity of the token', async () => {
            const provider = conference()

            await call(boxOffice(provider), 'sell_ticket', { talkId: 'opening' })

            expect(provider.get(Journal).entries).toEqual(['box office runs SellTicket', 'box office sells opening'])
        })

        it('answers the error of the domain with isError, for the client to read', async () => {
            expect(await call(boxOffice(), 'sell_ticket', { talkId: 'closing' })).toEqual({
                content: [{ type: 'text', text: 'The talk has no seats left' }],
                isError: true,
            })
        })

        it('answers a use case the identity cannot run with isError, not with a 403', async () => {
            const response = await boxOffice().post('/mcp', { json: callOf('retitle_talk', { talkId: 'opening', title: 'Keynote' }) })

            response.succeeds(200)
            expect(resultOf<ToolResult>(response.json())).toEqual({
                content: [{ type: 'text', text: 'Forbidden' }],
                isError: true,
            })
        })

        it('reads the input with the serializer of cauce, and answers every issue in its words', async () => {
            const provider = conference()

            const result = await call(boxOffice(provider), 'sell_ticket', { talkId: '', price: 3 })

            expect(result.isError).toBe(true)
            expect(result.content[0]?.text).toMatch(/^The input is not valid: talkId: Too small.*; Unrecognized key: "price"$/)
            expect(provider.get(Journal).entries).toEqual([])
        })

        it('answers "Tool execution failed" for what web would hide, and writes the error down', async () => {
            const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

            const result = await call(boxOffice(), 'print_badges', {})

            expect(result).toEqual({ content: [{ type: 'text', text: 'Tool execution failed' }], isError: true })
            expect(errors).toHaveBeenCalledWith(new Error('The printer is out of paper'))
        })

        it('answers a tool that does not exist with the error of JSON-RPC for invalid params', async () => {
            const response = await boxOffice().post('/mcp', { json: callOf('cancel_talk', {}) })

            expect(response.json()).toMatchObject({ error: { code: -32602, message: 'Tool cancel_talk not found' } })
        })

        it('answers a GET and a DELETE with 405, since there is no session to open or close', async () => {
            for (const response of [await boxOffice().get('/mcp'), await boxOffice().delete('/mcp')]) {
                response.failsWith(405)
                expect(response.headers.get('allow')).toBe('POST')
            }
        })

        it('answers with JSON, never with a stream', async () => {
            const response = await boxOffice().post('/mcp', { json: rpc('tools/list') })

            expect(response.headers.get('content-type')).toBe('application/json')
        })

        it.each(revisions)('prints nothing of what it receives or answers, in $name', async revision => {
            // the SDK warns once, when the handler is created with responseMode: 'json'; that is not what this is about
            const provider = conference()
            const client = boxOffice(provider)
            provider.get(Web)
            const printed = (['log', 'info', 'warn', 'error', 'debug'] as const).map(level => vi.spyOn(console, level).mockImplementation(() => {}))

            const talk = await callIn(client, revision, 'get_talk', { talkId: 'opening' })
            const wrong = await callIn(client, revision, 'sell_ticket', { talkId: '', secret: 'card 4242' })
            const { headers } = revision.call('get_talk', {})
            const notJson = await client.post('/mcp', { headers, body: '{"jsonrpc": "2.0", "secret": "card 4242"' })

            expect(talk.structuredContent).toMatchObject({ title: 'Opening' })
            expect(wrong.isError).toBe(true)
            notJson.failsWith(400)
            for (const spy of printed) expect(spy).not.toHaveBeenCalled()
        })

        it('refuses a subscription, which would be a stream, with the error of JSON-RPC for a method not found', async () => {
            const response = await boxOffice().post('/mcp', {
                headers: { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'subscriptions/listen' },
                json: { jsonrpc: '2.0', id: 'listen:0', method: 'subscriptions/listen', params: { notifications: { toolsListChanged: true } } },
            })

            response.succeeds(200)
            expect(response.headers.get('content-type')).toBe('application/json')
            expect(response.json()).toEqual({ jsonrpc: '2.0', id: 'listen:0', error: { code: -32601, message: 'Method not found' } })
        })

        it.each(['subscriptions/listen', 'tools/list'])('answers 413 to a body over 4 MiB, %s included', async method => {
            const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { padding: 'x'.repeat(6 * 1024 * 1024) } })

            const response = await boxOffice().post('/mcp', {
                headers: { 'mcp-protocol-version': '2026-07-28', 'mcp-method': method },
                body,
            })

            response.failsWith(413)
            expect(response.json()).toEqual({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Payload Too Large: Request body must not exceed 4194304 bytes' },
                id: null,
            })
        })
    })

    describe('without a token', () => {
        it('answers 401 with Bearer and no resource_metadata, before anything of MCP', async () => {
            const provider = conference()

            const response = await clientOf(provider).post('/mcp', { json: callOf('get_talk', { talkId: 'opening' }) })

            response.failsWith(401)
            expect(response.headers.get('www-authenticate')).toBe('Bearer')
            expect(response.json()).toEqual({ type: 'about:blank', title: 'Unauthorized', status: 401 })
            expect(provider.get(Journal).entries).toEqual([])
        })

        it('answers 404 where a client looks for OAuth', async () => {
            for (const path of wellKnowns('/mcp')) (await clientOf(conference()).get(path)).failsWith(404)
        })

        it('answers its own 401 and 404 behind a ProblemResponder that redirects them to the login', async () => {
            const client = clientOf(conference({ pages: true }))

            ;(await client.get('/pages/who')).redirectsTo('/login')
            ;(await client.post('/mcp', { json: rpc('tools/list') })).failsWith(401)
            for (const path of wellKnowns('/mcp')) (await client.get(path)).failsWith(404)
        })

        it('is not opened by the session of the application, and its token opens no page', async () => {
            const provider = conference({ pages: true })

            ;(await clientOf(provider).with({ headers: { cookie: 'session=organizer' } }).post('/mcp', { json: rpc('tools/list') })).failsWith(401)
            ;(await boxOffice(provider).get('/pages/who')).redirectsTo('/login')
        })

        it('is opened by anonymous, and the tools stay closed to whom their use cases are closed', async () => {
            const client = clientOf(conference({ endpoint: endpoint({ anonymous: true }) }))
            const usher = client.with({ headers: { authorization: 'Bearer usher' } })

            expect(await call(client, 'get_talk', { talkId: 'opening' })).toMatchObject({ structuredContent: { title: 'Opening' } })
            expect(await call(usher, 'sell_ticket', { talkId: 'opening' })).toEqual({ content: [{ type: 'text', text: 'Forbidden' }], isError: true })
        })

        it.each(revisions)('answers 401 when a use case finds nobody behind an endpoint opened by anonymous, in $name', async revision => {
            const { headers, json } = revision.call('who_am_i', {})

            const response = await clientOf(conference({ endpoint: endpoint({ anonymous: true }) })).post('/mcp', { headers, json })

            response.failsWith(401)
            expect(response.headers.get('www-authenticate')).toBe('Bearer')
        })

        it('answers 401 to a token its authenticator refuses by throwing, also behind a ProblemResponder', async () => {
            for (const provider of [conference(), conference({ pages: true })]) {
                const response = await clientOf(provider).with({ headers: { authorization: 'Bearer expired' } }).post('/mcp', { json: rpc('tools/list') })

                response.failsWith(401)
                expect(response.headers.get('www-authenticate')).toBe('Bearer')
            }
        })

        it('lets any other failure of its authenticator through, for the application to answer', async () => {
            const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

            const response = await clientOf(conference()).with({ headers: { authorization: 'Bearer broken' } }).post('/mcp', { json: rpc('tools/list') })

            response.failsWith(500)
            expect(errors).toHaveBeenCalledWith(new Error('The vault of tokens is down'))
        })
    })

    describe('with permissions', () => {
        it('answers 403 to an identity that has none of them, without resource_metadata', async () => {
            const client = clientOf(conference({ endpoint: endpoint({ permissions: ['tickets'] }) }))

            const response = await client.with({ headers: { authorization: 'Bearer usher' } }).post('/mcp', { json: rpc('tools/list') })

            response.failsWith(403)
            expect(response.headers.get('www-authenticate')).toBeNull()
            expect(response.json()).toEqual({ type: 'about:blank', title: 'Forbidden', status: 403 })
        })

        it('lets in an identity that has one of them', async () => {
            const client = boxOffice(conference({ endpoint: endpoint({ permissions: ['program', 'tickets'] }) }))

            ;(await client.post('/mcp', { json: rpc('tools/list') })).succeeds(200)
        })
    })

    describe('on another path', () => {
        it('answers there, and 404 where a client looks for OAuth with that path', async () => {
            const client = boxOffice(conference({ endpoint: endpoint({ path: '/api/conference/mcp' }) }))

            ;(await client.post('/api/conference/mcp', { json: rpc('tools/list') })).succeeds(200)
            ;(await client.post('/mcp', { json: rpc('tools/list') })).failsWith(404)
            for (const path of wellKnowns('/api/conference/mcp')) (await client.get(path)).failsWith(404)
        })

        it('takes the token from the path, when the application reads it there', async () => {
            const client = clientOf(conference({ endpoint: endpoint({ path: '/mcp/:token' }) }))

            ;(await client.post('/mcp/box-office', { json: rpc('tools/list') })).succeeds(200)
            ;(await client.post('/mcp/nobody', { json: rpc('tools/list') })).failsWith(401)
        })
    })

    describe('when the web is built', () => {
        it('fails for a tool without a handler, naming both', () => {
            const provider = conference({ withoutSelling: true })

            expect(() => provider.get(Web)).toThrow(new CompositionError('The tool sell_ticket runs SellTicket, which has no handler'))
        })

        it('fails for a tool whose input cannot be said in JSON Schema', () => {
            const provider = conference({ scheduling: true, endpoint: endpoint({ tools: [getTalk, scheduleTalk] }) })

            expect(() => provider.get(Web)).toThrow(JsonSchemaUnavailableError)
        })
    })

    describe('its options', () => {
        it.each(['mcp', '/mcp/', '/mcp/*'])('refuse the path %s', path => {
            expect(() => conference({ endpoint: endpoint({ path }) }).get(Web)).toThrow(InvalidArgumentError)
        })

        it('refuse anonymous with permissions, and permissions that name none', () => {
            expect(() => conference({ endpoint: endpoint({ anonymous: true, permissions: ['tickets'] }) }).get(Web)).toThrow(InvalidArgumentError)
            expect(() => conference({ endpoint: endpoint({ permissions: [] }) }).get(Web)).toThrow(InvalidArgumentError)
        })
    })
})

describe('McpTools', () => {
    it('refuses a tool added twice', () => {
        const tools = new McpTools().add(getTalk)

        expect(() => tools.add(getTalk)).toThrow(new CompositionError('The tool get_talk was already added to this server of MCP'))
    })

    it.each(['-get_talk', 'get_talk-'])('refuses %s, which starts or ends with a hyphen', name => {
        expect(() => new McpTools().add(tool(GetTalk, { name, description: 'A talk' }))).toThrow(InvalidArgumentError)
    })

    it('keeps the tools in the order they were added', () => {
        expect(new McpTools().add(sellTicket).add(getTalk).build()).toEqual([sellTicket, getTalk])
    })
})

function boxOffice(provider = conference()): TestClient {
    return clientOf(provider).with({ headers: { authorization: 'Bearer box-office' } })
}

async function call(client: TestClient, name: string, input: unknown): Promise<ToolResult> {
    const response = await client.post('/mcp', { json: callOf(name, input) })
    response.succeeds(200)
    return resultOf<ToolResult>(response.json())
}

async function callIn(client: TestClient, revision: Revision, name: string, input: unknown): Promise<ToolResult> {
    const { headers, json } = revision.call(name, input)
    const response = await client.post('/mcp', { headers, json })
    response.succeeds(200)
    return resultOf<ToolResult>(response.json())
}

function resultOf<T>(body: unknown): T {
    return (body as { result: T }).result
}

function wellKnowns(path: string): string[] {
    return [
        '/.well-known/oauth-protected-resource',
        `/.well-known/oauth-protected-resource${path}`,
        '/.well-known/oauth-authorization-server',
        '/.well-known/openid-configuration',
    ]
}
