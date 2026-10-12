// The canonical server, to copy: the web of the application served on Node, started last and stopped in order. In
// production it runs with ProcessLifetime and the standard sources; this one starts and stops by hand, so it runs in a
// test.
import { application } from '@caucejs/application'
import { memory } from '@caucejs/config'
import { HostBuilder } from '@caucejs/hosting'
import { jsonSerializer } from '@caucejs/schema'
import { Controller, web, type Routes } from '@caucejs/web'

import { HttpServer, HttpServerSettings } from '../src/index.js'

export class Hello extends Controller {
    registerRoutes(routes: Routes): void {
        routes.get('/hello', c => c.text('hello from the conference'))
    }
}

export async function serveTheConference(): Promise<string> {
    const builder = new HostBuilder({ environment: 'production' })
    // in production: builder.config.add(...standardSources(builder.environment)), and HTTP_SERVER__PORT in the environment
    builder.config.add(memory({ httpServer: { port: 0, hostname: '127.0.0.1' } }))
    builder.services
        .addInstance(HttpServerSettings, builder.config.bind(HttpServerSettings))
        .add(jsonSerializer(), application(app => app), web(w => w.controller(Hello)))
    // what serves the application starts last, so it never answers before the rest is ready
    builder.start(HttpServer)

    // in production: await host.run(new ProcessLifetime()), which stops on SIGTERM, with the in-flight requests answered
    await using host = builder.build()
    await host.start()
    const answer = await (await fetch(`http://127.0.0.1:${host.provider.get(HttpServer).port}/hello`)).text()
    await host.stop()
    return answer
}
