import { TestClient } from '@caucejs/testing'
import { beforeEach, describe, expect, it } from 'vitest'

import { conference } from './support/conference.js'

describe('the fields of a request', () => {
    it('are refused when one comes from two places, naming it', async () => {
        const response = await organizer.post('/talks/opening/title', { json: { id: 'closing', title: 'Keynote' } })

        expect(response.failsWith(400).json()).toMatchObject({ errors: [{ path: 'id', message: 'It comes from both the path and the body' }] })
    })

    it('are refused when the query and the body both bring one', async () => {
        const response = await organizer.post('/talks/opening/title?title=A', { json: { title: 'B' } })

        expect(response.failsWith(400).json()).toMatchObject({ errors: [{ path: 'title', message: 'It comes from both the query and the body' }] })
    })

    it('take an empty body as no fields', async () => {
        expect((await client.delete('/talks/opening', { body: '', headers: { 'content-type': 'application/json' } })).status).toBe(204)
    })

    it('refuse a body that is not valid JSON', async () => {
        const response = await organizer.post('/talks/opening/title', { body: '{ title', headers: { 'content-type': 'application/json' } })

        expect(response.failsWith(400).json()).toMatchObject({ errors: [{ path: '', message: 'The body is not valid JSON' }] })
    })

    it('refuse JSON that is not an object', async () => {
        const response = await organizer.post('/talks/opening/title', { json: ['Keynote'] })

        expect(response.failsWith(400).json()).toMatchObject({ errors: [{ path: '', message: 'The body is not a JSON object' }] })
    })

    it('read JSON sent with a media type of its family', async () => {
        const response = await organizer.post('/talks/opening/title', { body: '{"title":"Keynote"}', headers: { 'content-type': 'application/vnd.talk+json; charset=utf-8' } })

        expect(response.succeeds(200).json()).toMatchObject({ title: 'Keynote' })
    })

    it('refuse a body of another type with 415, naming it', async () => {
        const response = await organizer.post('/talks/opening/title', { body: 'Keynote', headers: { 'content-type': 'text/plain' } })

        expect(response.failsWith(415).json()).toMatchObject({ detail: 'A body of type text/plain cannot be read: send JSON or a form' })
    })

    it('refuse a body without a type', async () => {
        const response = await organizer.post('/talks/opening/title', { body: new Uint8Array([1, 2]) })

        expect(response.failsWith(415).json()).toMatchObject({ detail: 'A body of type none cannot be read: send JSON or a form' })
    })
})

beforeEach(async () => {
    client = new TestClient((await conference()).fetch)
    organizer = client.with({ headers: { cookie: 'session=organizer' } })
})

let client: TestClient
let organizer: TestClient
