import { Services } from '@caucejs/di'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod'

import {
    FetchHttpClient,
    HttpClient,
    httpClient,
    HttpRequestError,
    HttpStatusError,
    HttpTimeoutError,
    UnreadableResponseError,
} from '../src/index.js'
import { FakeFetch, hanging } from './support/fake-fetch.js'

let server: FakeFetch
let client: HttpClient

beforeEach(() => {
    server = new FakeFetch()
    client = new FetchHttpClient({ fetch: server.fetch })
})

afterEach(() => {
    vi.useRealTimers()
})

describe('sending', () => {
    it('sends a GET with its headers', async () => {
        await client.get('https://talks.example/talks/opening', { headers: { Accept: 'application/json' } })

        expect([server.last.method, server.last.url, server.last.headers.get('accept')]).toEqual(['GET', 'https://talks.example/talks/opening', 'application/json'])
    })

    it('sends JSON with its content type', async () => {
        await client.post('https://talks.example/talks', { json: { title: 'Opening' } })

        expect([server.last.body, server.last.headers.get('content-type')]).toEqual(['{"title":"Opening"}', 'application/json'])
    })

    it('sends a form with its content type', async () => {
        await client.put('https://talks.example/talks/opening', { form: { title: 'Opening' } })

        expect([server.last.body, server.last.headers.get('content-type')]).toEqual(['title=Opening', 'application/x-www-form-urlencoded'])
    })

    it('keeps a content type the caller set', async () => {
        await client.patch('https://talks.example/talks/opening', { json: {}, headers: { 'Content-Type': 'application/merge-patch+json' } })

        expect(server.last.headers.get('content-type')).toBe('application/merge-patch+json')
    })

    it('sends a body as it is, with any method', async () => {
        await client.request('REPORT', 'https://talks.example/talks', { body: 'raw' })
        await client.delete('https://talks.example/talks/opening')

        expect(server.requests.map(request => `${request.method} ${request.body}`)).toEqual(['REPORT raw', 'DELETE '])
    })
})

describe('the response', () => {
    it('has its status, its headers and its body read', async () => {
        server.answering(() => new Response('{"id":"opening"}', { status: 201, headers: { etag: 'v1' } }))

        const response = await client.post('https://talks.example/talks')

        expect([response.status, response.ok, response.headers.get('etag'), response.json()]).toEqual([201, true, 'v1', { id: 'opening' }])
    })

    it('is returned when its status is not a success, and thrown only when asked', async () => {
        server.answering(() => new Response('{"message":"Conflict"}', { status: 409 }))

        const response = await client.post('https://talks.example/talks?token=secret', { headers: { authorization: 'Bearer secret' } })

        expect([response.status, response.ok]).toEqual([409, false])
        const error = failure(() => response.ensureSuccess())
        expect(error).toBeInstanceOf(HttpStatusError)
        expect((error as HttpStatusError).status).toBe(409)
        expect(error.message).toBe('POST https://talks.example/talks answered 409')
    })

    it('is not a success when it redirects', async () => {
        server.answering(() => new Response(null, { status: 304 }))

        expect((await client.get('https://talks.example/talks')).ok).toBe(false)
    })

    it('returns itself from ensureSuccess when it is a success', async () => {
        const response = await client.get('https://talks.example/talks')

        expect(response.ensureSuccess()).toBe(response)
    })

    it('reads its body with a schema', async () => {
        server.answering(() => new Response('{"id":"opening","seats":"many"}'))
        const response = await client.get('https://talks.example/talks/opening')

        await expect(response.read(z.object({ id: z.string() }))).resolves.toEqual({ id: 'opening' })
        await expect(response.read(z.object({ seats: z.number() }))).rejects.toThrow(
            new UnreadableResponseError(response, ['seats: Invalid input: expected number, received string']),
        )
    })

    it('says so when its body is not JSON, without quoting it', async () => {
        server.answering(() => new Response('<html>secret</html>'))
        const response = await client.get('https://talks.example/talks')

        const error = failure(() => response.json())

        expect(error).toBeInstanceOf(UnreadableResponseError)
        expect(error.message).toBe('GET https://talks.example/talks answered something unreadable:\n- the body is not JSON')
    })
})

describe('failing to get an answer', () => {
    it('throws a request error with the cause, naming the URL without its query', async () => {
        server.answering(() => {
            throw new TypeError('fetch failed')
        })

        const error = await rejection(client.get('https://talks.example/talks?token=secret#top'))

        expect(error).toBeInstanceOf(HttpRequestError)
        expect(error.message).toBe('GET https://talks.example/talks got no answer')
        expect(error.cause).toEqual(new TypeError('fetch failed'))
    })

    it('throws a timeout error when the answer does not arrive in time', async () => {
        server.answering(hanging)
        const quick = new FetchHttpClient({ fetch: server.fetch, timeout: 20 })

        const error = await rejection(quick.get('https://talks.example/talks'))

        expect(error).toBeInstanceOf(HttpTimeoutError)
        expect(error.message).toBe('GET https://talks.example/talks got no answer within 20 ms')
    })

    it('lets a request say its own timeout', async () => {
        server.answering(hanging)

        await expect(client.get('https://talks.example/talks', { timeout: 20 })).rejects.toBeInstanceOf(HttpTimeoutError)
    })

    it('leaves no timer behind once the answer is read', async () => {
        vi.useFakeTimers()

        await client.get('https://talks.example/talks')

        expect(vi.getTimerCount()).toBe(0)
    })

    it('cannot send a URL that is not absolute', async () => {
        await expect(client.get('/talks')).rejects.toThrow(new HttpRequestError({ method: 'GET', url: '/talks', headers: {} }))
    })
})

describe('a client with a base', () => {
    it('joins relative URLs to its base with one slash, and keeps an absolute one', async () => {
        const talks = client.with({ baseUrl: 'https://api.example/conferences/rosario/' })

        await talks.get('/talks/opening')
        await talks.get('speakers')
        await talks.get('')
        await talks.get('https://other.example/status')

        expect(server.requests.map(request => request.url)).toEqual([
            'https://api.example/conferences/rosario/talks/opening',
            'https://api.example/conferences/rosario/speakers',
            'https://api.example/conferences/rosario/',
            'https://other.example/status',
        ])
    })

    it('takes an empty URL as its base as it is', async () => {
        await client.with({ baseUrl: 'https://api.example/v1' }).get('')

        expect(server.last.url).toBe('https://api.example/v1')
    })

    it('adds its headers under the ones of each request, and of a client built on it', async () => {
        const talks = client.with({ baseUrl: 'https://api.example', headers: { Authorization: 'Bearer conference', Accept: 'text/plain' } })
        const json = talks.with({ headers: { Accept: 'application/json', 'X-Track': 'web' } })

        await json.get('/talks', { headers: { 'x-track': 'ai' } })

        expect([...server.last.headers.entries()].sort()).toEqual([
            ['accept', 'application/json'],
            ['authorization', 'Bearer conference'],
            ['x-track', 'ai'],
        ])
    })

    it('gives its timeout to a request that does not say its own', async () => {
        server.answering(hanging)

        const error = await rejection(client.with({ timeout: 20 }).get('https://talks.example/talks'))

        expect((error as HttpTimeoutError).timeout).toBe(20)
    })

    it('lets a request keep its own timeout', async () => {
        server.answering(hanging)

        const error = await rejection(client.with({ timeout: 10_000 }).get('https://talks.example/talks', { timeout: 20 }))

        expect((error as HttpTimeoutError).timeout).toBe(20)
    })

    it('does not change the client it is built on', async () => {
        client.with({ baseUrl: 'https://api.example', headers: { authorization: 'Bearer conference' } })

        await client.get('https://talks.example/talks')

        expect(server.last.headers.get('authorization')).toBeNull()
    })
})

describe('the extension', () => {
    it('adds one client for the application, which a test replaces', async () => {
        const services = new Services()
        services.add(httpClient({ timeout: 5_000 }))
        services.replace(HttpClient, () => new FetchHttpClient({ fetch: server.fetch }))
        const provider = services.build({ validate: true })

        await provider.get(HttpClient).get('https://talks.example/talks')

        expect(provider.get(HttpClient)).toBe(provider.get(HttpClient))
        expect(server.requests).toHaveLength(1)
    })

    it('adds a client on fetch', () => {
        const services = new Services()
        services.add(httpClient())

        expect(services.build().get(HttpClient)).toBeInstanceOf(FetchHttpClient)
    })
})

function failure(act: () => unknown): Error {
    try {
        act()
    } catch (error) {
        return error as Error
    }
    throw new Error('It did not fail')
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise
    } catch (error) {
        return error as Error
    }
    throw new Error('It did not fail')
}
