import { describe, expect, it } from 'vitest'

import type { Routes } from '../src/index.js'
import { GetTalk, RenameTalk } from './support/conference.js'

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export function whatTheCompilerRefuses(routes: Routes): void {
    // @ts-expect-error the path names `idd`, which the request does not have
    routes.get('/talks/:idd', GetTalk)
    // @ts-expect-error a redirect that reads a field the request does not have
    routes.post('/talks/:id/rename', RenameTalk, { redirect: (_talk, request) => `/talks/${request.speaker}` })
    // @ts-expect-error a redirect that reads a field the result does not have
    routes.post('/talks/:id/rename', RenameTalk, { redirect: talk => `/talks/${talk.room}` })
    // @ts-expect-error a status that is not a success
    routes.put('/talks/:id/title', RenameTalk, { status: 404 })
    // @ts-expect-error a redirect with a status that does not redirect
    routes.post('/talks/:id/rename', RenameTalk, { redirect: talk => talk.id, status: 200 })
    routes.get('/pages/:id', c => {
        const id: string = c.req.param('id')
        // @ts-expect-error a param the path does not have is not a string for sure
        const other: string = c.req.param('idd')
        return c.text(id + other)
    })
}

export function whatTheCompilerTakes(routes: Routes): void {
    routes.get('/talks/:id', GetTalk)
    routes.post('/talks/:id/rename', RenameTalk, { redirect: (talk, request) => `/talks/${talk.id}?from=${request.title}`, status: 302 })
}

describe('the types', () => {
    it('are checked by the typecheck, above', () => {
        expect(typeof whatTheCompilerRefuses).toBe('function')
    })
})
