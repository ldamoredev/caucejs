import { describe, expect, it } from 'vitest'

import { TestClient } from '../src/index.js'

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export async function whatTheCompilerRefuses(client: TestClient): Promise<void> {
    // @ts-expect-error two kinds of body at once
    await client.post('/talks', { json: {}, form: {} })
    // @ts-expect-error a body on a GET
    await client.get('/talks', { json: {} })
    // @ts-expect-error a header that is not a string
    await client.get('/talks', { headers: { 'x-count': 1 } })
}

describe('the types', () => {
    it('let one kind of body through', async () => {
        const response = await new TestClient(() => new Response(null, { status: 204 })).post('/talks', { form: { title: 'Opening' } })

        expect(response.status).toBe(204)
    })
})
