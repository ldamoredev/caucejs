// The canonical web application on Node, to copy: a module that composes it with statements, and the four lines that
// start it. In production `run()` stops on SIGTERM, with the in-flight requests answered; this one starts and stops by
// hand, so it runs in a test.
import { memory } from '@caucejs/config'
import { Module } from '@caucejs/hosting'
import { Controller, type Routes } from '@caucejs/web'

import { HttpServer, WebApplication, type WebApplicationBuilder } from '../src/index.js'

export class Hello extends Controller {
    registerRoutes(routes: Routes): void {
        routes.get('/hello', c => c.text('hello from the conference'))
    }
}

// The module receives the builder of a web application: services, settings, use cases, web, and what starts with it.
export class Conference extends Module<WebApplicationBuilder> {
    compose(app: WebApplicationBuilder): void {
        app.web.controller(Hello)
    }
}

export async function serveTheConference(): Promise<string> {
    // in production: WebApplication.builder({ name: 'conference' }), which reads settings.json, .env, the environment
    // and PORT
    const builder = WebApplication.builder({ name: 'conference', sources: [memory({ httpServer: { port: 0, hostname: '127.0.0.1' } })] })
    builder.addModule(Conference)

    // in production: await app.run()
    await using app = builder.build()
    await app.start()
    const answer = await (await fetch(`http://127.0.0.1:${app.provider.get(HttpServer).port}/hello`)).text()
    await app.stop()
    return answer
}
