import { TestClient } from '@caucejs/testing'
import { beforeEach, describe, expect, it } from 'vitest'

import { conference, type Journal } from './support/conference.js'

describe('a route that is a use case', () => {
    it('reads the request from the path and the query', async () => {
        const response = await client.get('/talks/opening?track=web')

        expect(response.succeeds(200).json()).toEqual({ id: 'opening', title: 'Opening', track: 'web' })
    })

    it('reads the body as JSON', async () => {
        const response = await organizer.post('/talks/opening/title', { json: { title: '  Keynote  ' } })

        expect(response.succeeds(200).json()).toEqual({ id: 'opening', title: 'Keynote' })
    })

    it('reads the body as a form', async () => {
        const response = await organizer.post('/talks/opening/title', { form: { title: 'Keynote' } })

        expect(response.succeeds(200).json()).toEqual({ id: 'opening', title: 'Keynote' })
    })

    it('writes its result as JSON, with the serializer', async () => {
        const response = await client.get('/talks/opening')

        expect(response.headers.get('content-type')).toBe('application/json')
        expect(response.text).toBe('{"id":"opening","title":"Opening"}')
    })

    it('answers 204 with no body when the use case answers nothing', async () => {
        const response = await client.delete('/talks/opening')

        expect(response.status).toBe(204)
        expect(response.text).toBe('')
    })

    it('answers with the status it declares', async () => {
        expect((await organizer.put('/talks/opening/title', { json: { title: 'Keynote' } })).status).toBe(202)
    })

    it('reads PATCH as the other verbs with a body', async () => {
        expect((await organizer.patch('/talks/opening/title', { json: { title: 'Keynote' } })).succeeds(200).json()).toMatchObject({ title: 'Keynote' })
    })

    it('redirects with 303 when it declares a redirect, built from the result', async () => {
        const response = await organizer.post('/talks/opening/rename', { form: { title: 'Keynote' } })

        response.redirectsTo('/talks/opening')
        expect(response.status).toBe(303)
    })

    it('redirects with the status it declares, built from the request', async () => {
        const response = await client.post('/talks/opening/tagged', { json: { tags: ['web'] } })

        expect(response.status).toBe(302)
        response.redirectsTo('/talks/opening?tagged')
    })

    it('writes a page with what the use case answered, when it declares html', async () => {
        const response = await client.get('/talks/opening/page')

        expect(response.succeeds(200).headers.get('content-type')).toMatch(/^text\/html/)
        expect(response.text).toBe('<h1>Opening</h1>')
    })

    it('waits for a page that is written asynchronously, and gives it the request', async () => {
        expect((await client.get('/talks/opening/card')).succeeds(200).text).toBe('<p>opening: Opening</p>')
    })

    it('takes a name given twice in the query as a list', async () => {
        const response = await client.post('/talks/opening/tags?tags=web&tags=ai')

        expect(response.succeeds(200).json()).toEqual(['web', 'ai'])
    })

    it('runs through the middlewares of the application, authorization included', async () => {
        expect((await client.post('/talks/opening/title', { json: { title: 'Keynote' } })).status).toBe(401)
    })
})

describe('a route written by hand', () => {
    it('gets the context of Hono, typed with its path, and runs a use case as the request', async () => {
        const response = await client.get('/pages/talks/opening')

        expect(response.succeeds(200).text).toBe('<h1>Opening</h1>')
        expect(journal.entries).toEqual(['page of opening'])
    })

    it('runs a use case as who makes the request', async () => {
        const response = await organizer.post('/pages/talks/opening/rename', { form: { title: 'Keynote' } })

        response.redirectsTo('/pages/talks/opening')
        expect((await client.get('/talks/opening')).json()).toMatchObject({ title: 'Keynote' })
    })

    it('reads what it runs with the schema of the request', async () => {
        const response = await organizer.post('/pages/talks/opening/rename', { form: { title: '' } })

        expect(response.status).toBe(400)
    })
})

beforeEach(async () => {
    const app = await conference()
    journal = app.journal
    client = new TestClient(app.fetch)
    organizer = client.with({ headers: { cookie: 'session=organizer' } })
})

let client: TestClient
let organizer: TestClient
let journal: Journal
