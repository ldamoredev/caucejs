import { TestClient } from '@caucejs/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ProblemResponder, type Problem } from '../src/index.js'
import { conference, SoldOutError } from './support/conference.js'

describe('a problem', () => {
    it('is written as application/problem+json, by RFC 9457', async () => {
        const response = await client.get('/talks/nowhere')

        expect(response.headers.get('content-type')).toBe('application/problem+json')
        expect(response.json()).toEqual({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'There is no such talk' })
    })

    it('carries every issue of a validation error', async () => {
        const response = await organizer.post('/talks/opening/title', { json: { title: '' } })

        expect(response.failsWith(400).json()).toEqual({
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: 'The input is not valid: title: Too small: expected string to have >=1 characters',
            errors: [{ path: 'title', message: 'Too small: expected string to have >=1 characters' }],
        })
    })

    it('is a 401 for nobody and a 403 for who cannot', async () => {
        expect((await client.post('/talks/opening/title', { json: { title: 'Keynote' } })).status).toBe(401)
        expect((await client.with({ headers: { cookie: 'session=speaker' } }).post('/talks/opening/title', { json: { title: 'Keynote' } })).status).toBe(403)
    })

    it('is a 400 for a rule of the domain that was broken', async () => {
        expect((await client.post('/talks/opening/tickets')).failsWith(400).json()).toMatchObject({ title: 'Bad Request', detail: 'The talk is sold out' })
    })

    it('is a 404 for a route that does not exist, naming it', async () => {
        const response = await client.get('/nowhere')

        expect(response.failsWith(404).json()).toMatchObject({ title: 'Not Found', detail: 'No route for GET /nowhere' })
    })

    it('is a 500 that says nothing of its cause, which is written down instead', async () => {
        const response = await client.post('/explode')

        expect(response.failsWith(500).json()).toEqual({ type: 'about:blank', title: 'Internal Server Error', status: 500 })
        expect(logged.map(error => (error as Error).message)).toEqual(['The database is on fire'])
    })

    it('takes the status the application gives an error of its own, before the defaults', async () => {
        const mapped = new TestClient((await conference(w => w.status(SoldOutError, 409))).fetch)

        expect((await mapped.post('/talks/opening/tickets')).failsWith(409).json()).toMatchObject({ title: 'Conflict', detail: 'The talk is sold out' })
    })

    describe('with a responder of the application', () => {
        it('is answered by it', async () => {
            const response = await answered.get('/nowhere')

            expect(response.failsWith(404).text).toBe('<h1>Not here</h1>')
        })

        it('keeps the default when the responder returns nothing', async () => {
            const response = await answered.post('/talks/opening/tickets')

            expect(response.headers.get('content-type')).toBe('application/problem+json')
        })

        it('is the only one an application names', async () => {
            await expect(conference(w => w.respondToProblemsWith(Pages).respondToProblemsWith(Pages))).rejects.toThrow(
                'web already responds to problems with one ProblemResponder',
            )
        })

        beforeEach(async () => {
            answered = new TestClient((await conference(w => w.respondToProblemsWith(Pages))).fetch)
        })

        let answered: TestClient
    })
})

class Pages extends ProblemResponder {
    respond(problem: Problem): Response | undefined {
        return problem.status === 404 ? new Response('<h1>Not here</h1>', { status: 404, headers: { 'content-type': 'text/html' } }) : undefined
    }
}

const original = console.error
let logged: unknown[] = []

beforeEach(async () => {
    logged = []
    console.error = (error: unknown) => logged.push(error)
    client = new TestClient((await conference()).fetch)
    organizer = client.with({ headers: { cookie: 'session=organizer' } })
})

afterEach(() => {
    console.error = original
})

let client: TestClient
let organizer: TestClient
