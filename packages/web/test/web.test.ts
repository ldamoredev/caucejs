import { application, Authorization, ExecutionContext } from '@caucejs/application'
import { CompositionError, Services, type Provider } from '@caucejs/di'
import { jsonSerializer } from '@caucejs/schema'
import { TestClient } from '@caucejs/testing'
import { beforeEach, describe, expect, it } from 'vitest'

import { Controller, Web, web, type Routes, type WebBuilder } from '../src/index.js'
import { CookieAuthenticator, GetTalk, GetTalkHandler, Journal, RenameTalk, RenameTalkHandler, Talks, TalksController } from './support/conference.js'

describe('web', () => {
    it('answers a request through the routes of its controllers', async () => {
        const response = await client.get('/talks/opening')

        expect(response.succeeds(200).json()).toEqual({ id: 'opening', title: 'Opening' })
    })

    it('runs the middlewares in the order they were written, around the route and around a problem', async () => {
        await client.get('/talks/opening')
        await client.get('/nowhere')

        expect(order).toEqual(['first in', 'second in', 'second out', 'first out', 'first in', 'second in', 'second out', 'first out'])
    })

    describe('each request', () => {
        it('gets a scope of its own, disposed when it is answered', async () => {
            await client.get('/visits')
            await client.get('/visits')

            expect(visits.map(visit => visit.id)).toEqual([1, 2])
            expect(visits.every(visit => visit.disposed)).toBe(true)
        })

        it('is anonymous when the application names no authenticator', async () => {
            const anonymous = compose(w => w.controller(TalksController))

            await expect(new TestClient(anonymous.get(Web).fetch).post('/talks/opening/title', { json: { title: 'Keynote' } }).then(r => r.status)).resolves.toBe(401)
        })

        it('runs as who the authenticator says', async () => {
            const response = await client.post('/talks/opening/title', { json: { title: 'Keynote' }, headers: { cookie: 'session=organizer' } })

            expect(response.succeeds(200).json()).toEqual({ id: 'opening', title: 'Keynote' })
        })
    })

    describe('its composition', () => {
        it('lets the validation of the container find what a controller is missing', () => {
            const services = new Services().add(jsonSerializer(), application(app => app), web(w => w.controller(TalksController)))

            expect(() => services.build({ validate: true })).toThrow(/TalksController needs Journal, which was never added/)
        })

        it('takes one authenticator', () => {
            expect(() => new Services().add(web(w => w.authenticateWith(CookieAuthenticator).authenticateWith(CookieAuthenticator)))).toThrow(
                new CompositionError('web already authenticates with one Authenticator'),
            )
        })

        it('is added once when it is the same, and fails when it is another', () => {
            const configure = (w: WebBuilder) => w.controller(TalksController)
            const services = new Services().add(web(configure), web(configure))

            expect(() => services.add(web(w => w))).toThrow(/web was added twice/)
        })
    })

    function compose(configure: (w: WebBuilder) => void): Provider {
        return new Services()
            .addSingleton(Talks, Talks)
            .addSingleton(Journal, Journal)
            .addScoped(Visit, Visit)
            .add(jsonSerializer(), application(app => app.use(Authorization).handle(GetTalk, GetTalkHandler).handle(RenameTalk, RenameTalkHandler)), web(configure))
            .build({ validate: true })
    }

    beforeEach(() => {
        order = []
        visits = []
        Visit.next = 1
        client = new TestClient(
            compose(w =>
                w
                    .use(recording('first'), recording('second'))
                    .authenticateWith(CookieAuthenticator)
                    .controller(TalksController)
                    .controller(VisitsController),
            ).get(Web).fetch,
        )
    })

    let client: TestClient
})

let order: string[] = []
let visits: Visit[] = []

function recording(name: string) {
    return async (_c: unknown, next: () => Promise<void>) => {
        order.push(`${name} in`)
        await next()
        order.push(`${name} out`)
    }
}

class Visit implements AsyncDisposable {
    static next = 1
    readonly id = Visit.next++
    disposed = false

    async [Symbol.asyncDispose](): Promise<void> {
        this.disposed = true
    }
}

class VisitsController extends Controller {
    registerRoutes(routes: Routes): void {
        routes.get('/visits', c => {
            visits.push(c.get('cauce').scope.get(Visit))
            return c.text('ok')
        })
    }
}

void ExecutionContext
