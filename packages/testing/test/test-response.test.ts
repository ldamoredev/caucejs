import { describe, expect, it } from 'vitest'

import { TestClient, UnexpectedResponseError } from '../src/index.js'

describe('a test response', () => {
    describe('succeeds', () => {
        it('with any 2xx when no status is given', async () => {
            expect((await answer(204)).succeeds().status).toBe(204)
        })

        it('with exactly the status given', async () => {
            expect((await answer(201)).succeeds(201).status).toBe(201)
        })

        it('fails with a status out of 2xx, showing the request, the status and the body', async () => {
            const response = await answer(500, 'TypeError: talk is undefined')

            expect(() => response.succeeds()).toThrow(
                new UnexpectedResponseError('Expected GET /talks/1?day=2 to succeed with 2xx, but it answered 500:\nTypeError: talk is undefined'),
            )
        })

        it('fails with another 2xx than the one given', async () => {
            const response = await answer(200)

            expect(() => response.succeeds(201)).toThrow('Expected GET /talks/1?day=2 to succeed with 201, but it answered 200')
        })

        it('passes the edges of 2xx and fails right outside them', async () => {
            const [first, last, after] = [await answer(200), await answer(299), await answer(300, 'moved')]

            expect(first.succeeds().status).toBe(200)
            expect(last.succeeds().status).toBe(299)
            expect(() => after.succeeds()).toThrow(UnexpectedResponseError)
        })
    })

    describe('fails with', () => {
        it('passes with the status given', async () => {
            expect((await answer(404)).failsWith(404).status).toBe(404)
        })

        it('fails with another one', async () => {
            const response = await answer(200, '{"id":1}')

            expect(() => response.failsWith(404)).toThrow('Expected GET /talks/1?day=2 to fail with 404, but it answered 200:\n{"id":1}')
        })
    })

    describe('redirects to', () => {
        it('passes with a redirection to the location given', async () => {
            const response = await answer(303, '', { location: '/login' })

            expect(response.redirectsTo('/login').status).toBe(303)
        })

        it('fails with a redirection elsewhere, naming where', async () => {
            const response = await answer(302, '', { location: '/' })

            expect(() => response.redirectsTo('/login')).toThrow('Expected GET /talks/1?day=2 to redirect to /login, but it answered 302, to /')
        })

        it('fails when the response is not a redirection, even with a location', async () => {
            const response = await answer(201, '', { location: '/login' })

            expect(() => response.redirectsTo('/login')).toThrow('but it answered 201, to /login')
        })

        it('fails when there is no location', async () => {
            const response = await answer(302)

            expect(() => response.redirectsTo('/login')).toThrow('but it answered 302, to no location')
        })

        it('passes the edges of 3xx', async () => {
            expect((await answer(300, '', { location: '/a' })).redirectsTo('/a').status).toBe(300)
            expect((await answer(399, '', { location: '/a' })).redirectsTo('/a').status).toBe(399)
            const clientError = await answer(400, '', { location: '/a' })

            expect(() => clientError.redirectsTo('/a')).toThrow(UnexpectedResponseError)
        })
    })

    describe('the body', () => {
        it('is read once and kept as text', async () => {
            const response = await answer(200, 'hello')

            expect([response.text, response.text]).toEqual(['hello', 'hello'])
        })

        it('is parsed as json', async () => {
            expect((await answer(200, '{"title":"Opening"}')).json()).toEqual({ title: 'Opening' })
        })

        it('fails to parse when it is not json, showing what it was', async () => {
            const response = await answer(200, '<html>')

            expect(() => response.json()).toThrow('Expected GET /talks/1?day=2 to answer JSON, but it answered 200:\n<html>')
        })

        it('is cut in a failure message when it is long', async () => {
            const response = await answer(500, 'x'.repeat(600))

            expect(() => response.succeeds()).toThrow(`answered 500:\n${'x'.repeat(500)}…`)
        })
    })

    function answer(status: number, body = '', headers: Record<string, string> = {}) {
        const nullBody = status === 204 || (status >= 300 && status < 400 && body === '')
        return new TestClient(() => new Response(nullBody ? null : body, { status, headers })).get('/talks/1?day=2')
    }
})
