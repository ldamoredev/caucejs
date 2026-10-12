import { describe, expect, it } from 'vitest'

import { visitTheConference } from '../examples/conference-web.js'

describe('the canonical web', () => {
    it('serves the use cases, the page and the problems, through the middlewares and the authenticator', async () => {
        expect(await visitTheConference()).toEqual([
            'GET /talks/opening: 200 {"id":"opening","title":"Opening"}',
            'anonymous rename: 302 to /login',
            'organizer rename: 303 to /pages/talks/opening',
            'the page: <h1>Keynote</h1>, with SAMEORIGIN',
            'a missing talk: 404 application/problem+json',
        ])
    })
})
