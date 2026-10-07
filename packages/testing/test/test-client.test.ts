import { beforeEach, describe, expect, it } from 'vitest'

import { TestClient } from '../src/index.js'

describe('a test client', () => {
    it('sends the method and the path to the handler, resolved against localhost', async () => {
        await client.send('OPTIONS', '/talks?day=1')

        expect(sent()).toMatchObject({ method: 'OPTIONS', url: 'http://localhost/talks?day=1' })
    })

    it('has a method for each verb with a body', async () => {
        for (const verb of ['post', 'put', 'patch', 'delete'] as const) await client[verb]('/talks/1')

        expect(requests.map(request => request.method)).toEqual(['POST', 'PUT', 'PATCH', 'DELETE'])
    })

    it('resolves the path against the base url', async () => {
        await new TestClient(recording, { baseUrl: 'http://conference.test:8080' }).get('/talks')

        expect(sent().url).toBe('http://conference.test:8080/talks')
    })

    it('does not follow redirections, so a real fetch answers them as they are', async () => {
        await client.get('/talks')

        expect(sent().redirect).toBe('manual')
    })

    describe('headers', () => {
        it('sends the headers of the request', async () => {
            await client.get('/talks', { headers: { 'x-track': 'web' } })

            expect(sent().headers.get('x-track')).toBe('web')
        })

        it('sends the headers of a client made with them on every request', async () => {
            await client.with({ headers: { cookie: 'session=organizer' } }).get('/talks')

            expect(sent().headers.get('cookie')).toBe('session=organizer')
        })

        it('leaves the original client without them', async () => {
            client.with({ headers: { cookie: 'session=organizer' } })

            await client.get('/talks')

            expect(sent().headers.get('cookie')).toBeNull()
        })

        it('let the headers of a request win over the client ones', async () => {
            await client.with({ headers: { cookie: 'session=organizer' } }).get('/talks', { headers: { cookie: 'session=speaker' } })

            expect(sent().headers.get('cookie')).toBe('session=speaker')
        })

        it('let the headers of a newer client win over the ones it was made from', async () => {
            await client.with({ headers: { cookie: 'session=organizer' } }).with({ headers: { cookie: 'session=speaker' } }).get('/talks')

            expect(sent().headers.get('cookie')).toBe('session=speaker')
        })

        it('add up when a client is made from another', async () => {
            await client.with({ headers: { cookie: 'session=organizer' } }).with({ headers: { 'x-track': 'web' } }).get('/talks')

            expect(sent().headers.get('cookie')).toBe('session=organizer')
            expect(sent().headers.get('x-track')).toBe('web')
        })
    })

    describe('the body', () => {
        it('sends json with its content type', async () => {
            await client.post('/talks', { json: { title: 'Opening' } })

            expect(sent().headers.get('content-type')).toBe('application/json')
            expect(await sent().text()).toBe('{"title":"Opening"}')
        })

        it('keeps a content type the request gives for json', async () => {
            await client.post('/talks', { json: {}, headers: { 'content-type': 'application/vnd.talk+json' } })

            expect(sent().headers.get('content-type')).toBe('application/vnd.talk+json')
        })

        it('sends a form url encoded', async () => {
            await client.post('/login', { form: { password: 'a b&c' } })

            expect(sent().headers.get('content-type')).toContain('application/x-www-form-urlencoded')
            expect(await sent().text()).toBe('password=a+b%26c')
        })

        it('sends a body as it is', async () => {
            await client.post('/talks', { body: 'plain', headers: { 'content-type': 'text/plain' } })

            expect(await sent().text()).toBe('plain')
        })

        it('sends none when there is none', async () => {
            await client.post('/talks')

            expect(sent().body).toBeNull()
        })
    })

    it('returns what the handler answered', async () => {
        const response = await new TestClient(() => new Response('created', { status: 201, headers: { 'x-id': '7' } })).post('/talks')

        expect(response.status).toBe(201)
        expect(response.text).toBe('created')
        expect(response.headers.get('x-id')).toBe('7')
    })

    function sent(): Request {
        const last = requests.at(-1)
        if (!last) throw new Error('No request was sent')
        return last
    }

    function recording(request: Request): Response {
        requests.push(request)
        return new Response(null, { status: 204 })
    }

    beforeEach(() => {
        requests = []
        client = new TestClient(recording)
    })

    let requests: Request[]
    let client: TestClient
})
