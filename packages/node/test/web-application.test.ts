import { Authorization, Handler, Query } from '@caucejs/application'
import { InvalidSettingsError, memory, type StandardSchemaV1 } from '@caucejs/config'
import { HostedService, Module } from '@caucejs/hosting'
import { Controller, type Routes } from '@caucejs/web'
import { TestClient } from '@caucejs/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { HttpServer, HttpServerSettings, WebApplication, type WebApplicationBuilder } from '../src/index.js'

let logged: string[]
const log = console.log

beforeEach(() => {
    logged = []
    console.log = (line: string) => void logged.push(line)
})

afterEach(() => {
    console.log = log
})

describe('a web application', () => {
    it('is composed by its modules, with statements, and answers through its fetch without starting', async () => {
        const builder = WebApplication.builder({ sources: [] })

        builder.addModule(Conference)
        const app = builder.build()

        expect((await new TestClient(app.fetch).get('/talks/opening')).succeeds(200).text).toBe('<h1>Opening</h1>')
    })

    it('starts the server last, after every hosted service of the application, and says once where it listens', async () => {
        const builder = WebApplication.builder({ name: 'conference', sources: [memory({ httpServer: { port: 0 } })] })
        builder.addModule(Conference)
        await using app = builder.build()

        await app.start()
        await app.start()
        const port = app.provider.get(HttpServer).port

        expect(app.provider.get(Doors).openedBeforeTheServer).toBe(true)
        expect(logged).toEqual([`conference listening on http://localhost:${port}`])
        expect((await fetch(`http://localhost:${port}/talks/opening`)).status).toBe(200)
    })

    it('takes the environment from NODE_ENV', () => {
        expect(WebApplication.builder({ sources: [] }).environment.name).toBe(process.env.NODE_ENV)
    })

    it('fails to build when its settings are wrong, without a stack that points inside Cauce', () => {
        const builder = WebApplication.builder({ sources: [memory({ httpServer: { port: 'eighty' } })] })

        const error = failure(() => builder.build())

        expect(error).toBeInstanceOf(InvalidSettingsError)
        expect(error.stack).toMatch(/^InvalidSettingsError: The settings of httpServer are wrong/)
        expect(error.stack).not.toMatch(/\n\s+at /)
    })
})

describe('the port', () => {
    const environment = { ...process.env }

    afterEach(() => {
        process.env = { ...environment }
    })

    it('comes from PORT, as a platform sets it', () => {
        process.env.PORT = '4321'

        expect(WebApplication.builder().build().provider.get(HttpServerSettings).port).toBe(4321)
    })

    it('comes from HTTP_SERVER__PORT before PORT', () => {
        process.env.PORT = '4321'
        process.env.HTTP_SERVER__PORT = '4322'

        expect(WebApplication.builder().build().provider.get(HttpServerSettings).port).toBe(4322)
    })
})

class GetTalk extends Query<{ title: string }> {
    static readonly anonymous = true
    static readonly schema: StandardSchemaV1<unknown, GetTalk> = {
        '~standard': { version: 1, vendor: 'test', validate: () => ({ value: new GetTalk() }) },
    }
}

class GetTalkHandler extends Handler.of(GetTalk) {
    async execute(): Promise<{ title: string }> {
        return { title: 'Opening' }
    }
}

class TalksController extends Controller {
    registerRoutes(routes: Routes): void {
        routes.get('/talks/opening', GetTalk, { html: talk => `<h1>${talk.title}</h1>` })
    }
}

class Doors extends HostedService {
    static readonly inject = [HttpServer] as const
    readonly #server: HttpServer
    openedBeforeTheServer = false

    constructor(server: HttpServer) {
        super()
        this.#server = server
    }

    async start(): Promise<void> {
        this.openedBeforeTheServer = this.#server.port === null
    }

    async stop(): Promise<void> {}
}

class Conference extends Module<WebApplicationBuilder> {
    compose(app: WebApplicationBuilder): void {
        app.useCases.use(Authorization)
        app.useCases.handle(GetTalkHandler)
        app.web.controller(TalksController)
        app.start(Doors)
    }
}

function failure(act: () => unknown): Error {
    try {
        act()
    } catch (error) {
        return error as Error
    }
    throw new Error('It did not fail')
}
