import { describe, expect, it } from 'vitest'

import { FetchHttpClient, type HttpClient } from '../src/index.js'

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export function whatTheCompilerRefuses(client: HttpClient): void {
    // @ts-expect-error two kinds of body at once
    void client.post('/talks', { json: {}, form: {} })
    // @ts-expect-error a GET with a body
    void client.get('/talks', { json: {} })
    // @ts-expect-error a header that is not a string
    void client.get('/talks', { headers: { 'x-seats': 3 } })
}

describe('the types', () => {
    it('let a right request through', () => {
        expect(new FetchHttpClient().with({ baseUrl: 'https://talks.example' })).toBeDefined()
    })
})
