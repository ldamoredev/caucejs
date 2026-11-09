import { Config, memory } from '@caucejs/config'
import { FetchHttpClient, HttpRequestError, HttpResponse } from '@caucejs/http-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    AnthropicModel,
    AnthropicSettings,
    IncompleteResponseError,
    type Message,
    ModelAuthenticationError,
    ModelError,
    ModelRateLimitError,
    type ModelRequest,
    ModelRequestError,
    ModelResponseError,
    ModelTimeoutError,
    ModelUnavailableError,
    StopReasons,
    userMessage,
} from '../src/index.js'
import { apiError, FakeFetch, hanging, message } from './support/fake-fetch.js'

const apiKey = 'sk-ant-a-key-nobody-should-see'
const question = 'Which talk does Ada give, according to my private notes?'

let server: FakeFetch
let model: AnthropicModel

beforeEach(() => {
    server = new FakeFetch()
    model = modelOn(server)
})

afterEach(() => {
    vi.useRealTimers()
})

describe('sending', () => {
    it('posts to the Messages API with the key, the version and JSON', async () => {
        await model.call(asking())

        expect([server.last.method, server.last.url]).toEqual(['POST', 'https://api.anthropic.com/v1/messages'])
        expect(Object.fromEntries(server.last.headers)).toEqual({
            authorization: `Bearer ${apiKey}`,
            'anthropic-version': '2026-10-21',
            'content-type': 'application/json',
        })
    })

    it('sends the version and the workspace of the settings', async () => {
        await modelOn(server, { version: '2027-01-01', workspaceId: 'wrkspc_conference' }).call(asking())

        expect([server.last.headers.get('anthropic-version'), server.last.headers.get('anthropic-workspace-id')]).toEqual(['2027-01-01', 'wrkspc_conference'])
    })

    it('sends only the model, 1024 tokens and the messages when that is all it is asked', async () => {
        await model.call(asking())

        expect(server.sent).toEqual({
            model: 'claude-haiku-5-5',
            max_tokens: 1024,
            messages: [{ role: 'user', content: [{ type: 'text', text: question }] }],
        })
    })

    it('sends the system and the most tokens it is asked for', async () => {
        await model.call(asking({ system: 'You answer about the program of the conference.', maxTokens: 300 }))

        expect([server.sent.system, server.sent.max_tokens]).toEqual(['You answer about the program of the conference.', 300])
    })

    it('never sends a temperature, a tool choice or a cache', async () => {
        await model.call(asking({ tools: [getTalk] }))

        expect(Object.keys(server.sent).sort()).toEqual(['max_tokens', 'messages', 'model', 'tools'])
        expect(server.last.body).not.toMatch(/temperature|top_p|top_k|tool_choice|cache_control|strict/)
    })

    it('sends each tool with its input schema, without $schema and without changing the one it was given', async () => {
        const schema = { ...getTalk.inputSchema }

        await model.call(asking({ tools: [getTalk] }))

        expect(server.sent.tools).toEqual([
            {
                name: 'get_talk',
                description: 'A talk of the conference, by its id',
                input_schema: { type: 'object', properties: { talkId: { type: 'string' } }, required: ['talkId'], additionalProperties: false },
            },
        ])
        expect(getTalk.inputSchema).toEqual(schema)
    })

    it('sends no tools when it is given none', async () => {
        await model.call(asking({ tools: [] }))

        expect(server.sent).not.toHaveProperty('tools')
    })

    it('sends a tool call back as it was, and its result first in the next message', async () => {
        await model.call(
            asking({
                messages: [
                    userMessage('When is the opening?'),
                    {
                        role: 'assistant',
                        content: [
                            { type: 'text', text: 'Let me look.' },
                            { type: 'toolCall', id: 'toolu_01', name: 'get_talk', input: { talkId: 'opening' } },
                        ],
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'And say who gives it.' },
                            { type: 'toolResult', toolCallId: 'toolu_01', content: '{"title":"Opening","at":"09:00"}', isError: false },
                            { type: 'toolResult', toolCallId: 'toolu_02', content: 'No talk with that id', isError: true },
                        ],
                    },
                ],
            }),
        )

        expect((server.sent.messages as unknown[]).slice(1)).toEqual([
            {
                role: 'assistant',
                content: [
                    { type: 'text', text: 'Let me look.' },
                    { type: 'tool_use', id: 'toolu_01', name: 'get_talk', input: { talkId: 'opening' } },
                ],
            },
            {
                role: 'user',
                content: [
                    { type: 'tool_result', tool_use_id: 'toolu_01', content: '{"title":"Opening","at":"09:00"}', is_error: false },
                    { type: 'tool_result', tool_use_id: 'toolu_02', content: 'No talk with that id', is_error: true },
                    { type: 'text', text: 'And say who gives it.' },
                ],
            },
        ])
    })
})

describe('reading the answer', () => {
    it('returns the message, the stop reason, the usage and the model that answered', async () => {
        expect(await model.call(asking())).toEqual({
            message: { role: 'assistant', content: [{ type: 'text', text: 'The opening is at nine.' }] },
            stopReason: StopReasons.EndTurn,
            usage: { inputTokens: 120, outputTokens: 12, cacheReadTokens: 0, cacheWriteTokens: 0 },
            model: 'claude-haiku-5-5',
        })
    })

    it('returns the tools the model asks for', async () => {
        server.answering(() =>
            message({
                content: [
                    { type: 'text', text: 'Let me look.' },
                    { type: 'tool_use', id: 'toolu_01', name: 'get_talk', input: { talkId: 'opening' } },
                ],
                stop_reason: 'tool_use',
            }),
        )

        const response = await model.call(asking({ tools: [getTalk] }))

        expect([response.stopReason, response.message.content]).toEqual([
            StopReasons.ToolUse,
            [
                { type: 'text', text: 'Let me look.' },
                { type: 'toolCall', id: 'toolu_01', name: 'get_talk', input: { talkId: 'opening' } },
            ],
        ])
    })

    it('counts the input as the three kinds of input, with the cache as parts of it', async () => {
        server.answering(() => message({ usage: { input_tokens: 20, cache_creation_input_tokens: 300, cache_read_input_tokens: 4000, output_tokens: 50 } }))

        expect((await model.call(asking())).usage).toEqual({ inputTokens: 4320, outputTokens: 50, cacheReadTokens: 4000, cacheWriteTokens: 300 })
    })

    it('takes what the usage does not say as unknown', async () => {
        server.answering(() => message({ usage: { input_tokens: 20, output_tokens: 50, cache_read_input_tokens: null } }))

        expect((await model.call(asking())).usage).toEqual({ inputTokens: 20, outputTokens: 50, cacheReadTokens: null, cacheWriteTokens: null })
    })

    it.each([
        ['end_turn', StopReasons.EndTurn],
        ['max_tokens', StopReasons.MaxTokens],
        ['stop_sequence', StopReasons.StopSequence],
        ['tool_use', StopReasons.ToolUse],
        ['refusal', StopReasons.Refusal],
        ['model_context_window_exceeded', StopReasons.ContextWindowExceeded],
    ])('returns %s as a stop reason, not as an error', async (reason, stopReason) => {
        server.answering(() => message({ stop_reason: reason }))

        expect((await model.call(asking())).stopReason).toBe(stopReason)
    })

    it('throws when the most tokens cut a tool call, with what it spent', async () => {
        server.answering(() =>
            message({ content: [{ type: 'tool_use', id: 'toolu_01', name: 'get_talk', input: {} }], stop_reason: 'max_tokens' }),
        )

        const error = await rejection(model.call(asking()))

        expect(error).toBeInstanceOf(IncompleteResponseError)
        expect([(error as IncompleteResponseError).reason, (error as IncompleteResponseError).usage.outputTokens]).toEqual(['maxTokens', 12])
        expect(error.message).toBe('The model stopped before its answer was complete: the answer reached its most tokens inside a tool call (request req_01)')
    })

    it('throws when the provider pauses the turn', async () => {
        server.answering(() => message({ stop_reason: 'pause_turn' }))

        const error = await rejection(model.call(asking()))

        expect(error).toBeInstanceOf(IncompleteResponseError)
        expect((error as IncompleteResponseError).reason).toBe('pauseTurn')
    })
})

describe('what fails', () => {
    it.each([401, 403])('throws an authentication error on a %i', async status => {
        server.answering(() => apiError(status, status === 401 ? 'authentication_error' : 'permission_error'))

        const error = await rejection(model.call(asking()))

        expect(error).toBeInstanceOf(ModelAuthenticationError)
        expect(error.message).toBe(`The model refused the API key with ${status} (request req_02)`)
        expect([(error as ModelAuthenticationError).status, (error as ModelAuthenticationError).requestId]).toEqual([status, 'req_02'])
    })

    it('throws a rate limit error with the seconds to wait', async () => {
        server.answering(() => apiError(429, 'rate_limit_error', { 'retry-after': '30' }))

        const error = await rejection(model.call(asking()))

        expect(error).toBeInstanceOf(ModelRateLimitError)
        expect((error as ModelRateLimitError).retryAfter).toBe(30)
        expect(error.message).toBe('The model is rate limited, retry after 30 s (request req_02)')
    })

    it.each([
        ['missing', {}],
        ['a date', { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }],
    ])('takes a retry-after that is %s as unknown', async (_what, headers) => {
        server.answering(() => apiError(429, 'rate_limit_error', headers))

        expect(((await rejection(model.call(asking()))) as ModelRateLimitError).retryAfter).toBeNull()
    })

    it.each([
        [500, 'api_error'],
        [529, 'overloaded_error'],
    ])('throws an unavailable error on a %i', async (status, type) => {
        server.answering(() => apiError(status, type))

        const error = await rejection(model.call(asking()))

        expect(error).toBeInstanceOf(ModelUnavailableError)
        expect((error as ModelUnavailableError).status).toBe(status)
        expect(error.message).toBe(`The model is unavailable, with ${status} (request req_02)`)
    })

    it.each([
        [400, 'invalid_request_error'],
        [404, 'not_found_error'],
        [413, 'request_too_large'],
    ])('throws a request error on a %i, with its kind and without the message of the provider', async (status, type) => {
        server.answering(() => apiError(status, type))

        const error = await rejection(model.call(asking()))

        expect(error).toBeInstanceOf(ModelRequestError)
        expect([(error as ModelRequestError).status, (error as ModelRequestError).type, (error as ModelRequestError).requestId]).toEqual([status, type, 'req_02'])
        expect(error.message).toBe(`The model refused the request with ${status} ${type} (request req_02)`)
    })

    it('throws a request error without a kind when the error is not JSON', async () => {
        server.answering(() => new Response('<html>Bad request</html>', { status: 400 }))

        const error = await rejection(model.call(asking()))

        expect([(error as ModelRequestError).type, error.message]).toEqual([null, 'The model refused the request with 400'])
    })

    it('leaves out a kind of error that is not a name', async () => {
        server.answering(() => Response.json({ type: 'error', error: { type: `invalid: ${question}` } }, { status: 400 }))

        const error = await rejection(model.call(asking()))

        expect([(error as ModelRequestError).type, error.message]).toEqual([null, 'The model refused the request with 400'])
    })

    it('throws a timeout error after 120 seconds, whatever the timeout of the client', async () => {
        vi.useFakeTimers()
        server.answering(hanging)

        const failed = rejection(model.call(asking()))
        await vi.advanceTimersByTimeAsync(120_000)
        const error = await failed

        expect(error).toBeInstanceOf(ModelTimeoutError)
        expect(error).toBeInstanceOf(ModelUnavailableError)
        expect([(error as ModelTimeoutError).timeout, error.message]).toEqual([120_000, 'The model did not answer within 120000 ms'])
    })

    it('throws a timeout error after the timeout of the settings', async () => {
        server.answering(hanging)

        const error = await rejection(modelOn(server, { timeout: '20' }).call(asking()))

        expect([(error as ModelTimeoutError).timeout]).toEqual([20])
    })

    it('throws an unavailable error when the provider cannot be reached, with what fetch threw as the cause', async () => {
        const unreachable = new TypeError('fetch failed')
        server.answering(() => Promise.reject(unreachable))

        const error = await rejection(model.call(asking()))

        expect(error).toBeInstanceOf(ModelUnavailableError)
        expect([(error as ModelUnavailableError).status, error.message, error.cause]).toEqual([null, 'The model could not be reached', unreachable])
    })

    it.each([
        ['a body that is not JSON', () => new Response('<html>The answer of the model</html>', { status: 200 }), 'the body is not a JSON object'],
        ['a block it does not know', () => message({ content: [{ type: 'thinking', thinking: 'The answer of the model' }] }), 'the block 0 is of a type it does not know, thinking'],
        ['a stop reason it does not know', () => message({ stop_reason: 'compaction' }), 'the stop reason is one it does not know, compaction'],
        ['no content', () => message({ content: null }), 'it has no content'],
    ])('throws a response error on %s, naming what without quoting it', async (_what, answer, problem) => {
        server.answering(answer)

        const error = await rejection(model.call(asking()))

        expect(error).toBeInstanceOf(ModelResponseError)
        expect((error as ModelResponseError).problem).toBe(problem)
    })

    it('throws a body that is not JSON without a cause, because the error of JSON.parse quotes it', async () => {
        server.answering(() => new Response('<html>The answer of the model</html>', { status: 200 }))

        expect((await rejection(model.call(asking()))).cause).toBeUndefined()
    })

    it('keeps the usage of an answer it cannot read', async () => {
        server.answering(() => message({ stop_reason: 'compaction' }))

        expect(((await rejection(model.call(asking()))) as ModelError).usage.inputTokens).toBe(120)
    })

    it.each<[string, (request: Request) => Response | Promise<Response>]>([
        ['a 401', () => apiError(401, 'authentication_error')],
        ['a 429', () => apiError(429, 'rate_limit_error', { 'retry-after': '30' })],
        ['a 529', () => apiError(529, 'overloaded_error')],
        ['a 400', () => apiError(400, 'invalid_request_error')],
        ['no answer', () => Promise.reject(new TypeError('fetch failed'))],
        ['a timeout', hanging],
        ['a body that is not JSON', () => new Response(`<html>${question}</html>`)],
        ['a block it does not know', () => message({ content: [{ type: 'thinking', thinking: question }] })],
        ['a cut tool call', () => message({ content: [{ type: 'tool_use', id: 'toolu_01', name: 'get_talk', input: { q: question } }], stop_reason: 'max_tokens' })],
    ])('keeps neither the prompt, the answer, the key, the request nor the response on %s', async (_what, answer) => {
        server.answering(answer)

        const error = await rejection(modelOn(server, { timeout: '20' }).call(asking({ system: question })))

        expect(error).toBeInstanceOf(ModelError)
        const reached = reachableFrom(error)
        expect(reached.objects.filter(value => value instanceof HttpResponse || value instanceof HttpRequestError || isHttpRequest(value))).toEqual([])
        expect(reached.strings.filter(text => text.includes(apiKey) || text.includes(question) || text.includes('which may quote the request'))).toEqual([])
    })
})

const getTalk = {
    name: 'get_talk',
    description: 'A talk of the conference, by its id',
    inputSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: { talkId: { type: 'string' } },
        required: ['talkId'],
        additionalProperties: false,
    },
    readOnly: true,
}

function modelOn(server: FakeFetch, anthropic: Record<string, string> = {}): AnthropicModel {
    const settings = new Config().add(memory({ anthropic: { apiKey, ...anthropic } })).bind(AnthropicSettings)
    return new AnthropicModel(new FetchHttpClient({ fetch: server.fetch }), settings)
}

function asking(request: Partial<ModelRequest> & { readonly messages?: readonly Message[] } = {}): ModelRequest {
    return { model: 'claude-haiku-5-5', messages: [userMessage(question)], ...request }
}

function isHttpRequest(value: object): boolean {
    return 'method' in value && 'url' in value && 'headers' in value
}

// Every object and every string an error holds, its cause and its stack included, as something that prints it would.
function reachableFrom(root: unknown): { readonly objects: object[]; readonly strings: string[] } {
    const objects: object[] = []
    const strings: string[] = []
    const seen = new Set<unknown>()
    const visit = (value: unknown): void => {
        if (typeof value === 'string') strings.push(value)
        if (typeof value !== 'object' || value === null || seen.has(value)) return
        seen.add(value)
        objects.push(value)
        if (value instanceof Headers) for (const [name, header] of value) strings.push(`${name}: ${header}`)
        for (const key of Reflect.ownKeys(value)) visit((value as Record<PropertyKey, unknown>)[key])
    }
    visit(root)
    return { objects, strings }
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise
    } catch (error) {
        return error as Error
    }
    throw new Error('It did not fail')
}
