import { application } from '@caucejs/application'
import { Config, memory, type ConfigTree } from '@caucejs/config'
import { Services } from '@caucejs/di'
import { HostBuilder } from '@caucejs/hosting'
import { jsonSerializer } from '@caucejs/schema'
import { Controller, web, Web, type Routes } from '@caucejs/web'
import { afterEach, describe, expect, it } from 'vitest'

import { HttpServer, HttpServerSettings } from '../src/index.js'

describe('the http server', () => {
    it('serves the fetch of the web of the application', async () => {
        const server = await started()

        const response = await fetch(`http://127.0.0.1:${server.port}/hello`)

        expect([response.status, await response.text()]).toEqual([200, 'hello'])
    })

    it('says the port the system gave for port 0, and nothing before it starts', async () => {
        const server = serverWith({ port: 0 })
        expect(server.port).toBeNull()

        await server.start()
        running.push(server)

        expect(server.port).toBeGreaterThan(0)
    })

    it('fails to start on a port that is taken, instead of waiting forever', async () => {
        const first = await started()

        await expect(serverWith({ port: first.port ?? 0 }).start()).rejects.toThrow(/EADDRINUSE/)
    })

    describe('stopping', () => {
        it('waits for a request in flight, which closes its connection, and does not wait for it to time out', async () => {
            const server = await started()
            const slow = fetch(`http://127.0.0.1:${server.port}/slow`)
            await wait(50)

            const took = await timed(() => server.stop())
            const response = await slow

            expect([response.status, await response.text(), response.headers.get('connection')]).toEqual([200, 'slow done', 'close'])
            expect(took).toBeGreaterThanOrEqual(150)
            expect(took).toBeLessThan(1500)
        })

        it('closes a connection kept alive and idle at once', async () => {
            const server = await started()
            await (await fetch(`http://127.0.0.1:${server.port}/hello`)).text()

            expect(await timed(() => server.stop())).toBeLessThan(500)
        })

        it('takes no new connection', async () => {
            const server = await started()
            const port = server.port

            await server.stop()

            await expect(fetch(`http://127.0.0.1:${port}/hello`)).rejects.toThrow()
        })

        it('does nothing when it never started, or already stopped', async () => {
            const server = await started()
            await server.stop()

            await expect(server.stop()).resolves.toBeUndefined()
            await expect(serverWith({ port: 0 }).stop()).resolves.toBeUndefined()
        })
    })

    it('starts and stops with the host, built by the container', async () => {
        const builder = new HostBuilder({ environment: 'test' })
        builder.config.add(memory({ httpServer: { port: 0 } }))
        builder.services
            .addInstance(HttpServerSettings, builder.config.bind(HttpServerSettings))
            .add(jsonSerializer(), application(app => app), web(w => w.controller(Hello)))
        builder.start(HttpServer)
        const host = builder.build()

        await host.start()
        const port = host.provider.get(HttpServer).port
        const response = await fetch(`http://127.0.0.1:${port}/hello`)
        await host.stop()

        expect(await response.text()).toBe('hello')
        await expect(fetch(`http://127.0.0.1:${port}/hello`)).rejects.toThrow()
    })
})

describe('the settings of the http server', () => {
    it('listen on 8080 when they say nothing', () => {
        expect(bind({}).port).toBe(8080)
    })

    it('read a port from the environment, where it is a string', () => {
        expect(bind({ httpServer: { port: '3000' } }).port).toBe(3000)
    })

    it('take port 0, for any free one, and a hostname', () => {
        const settings = bind({ httpServer: { port: 0, hostname: '127.0.0.1' } })

        expect([settings.port, settings.hostname]).toEqual([0, '127.0.0.1'])
    })

    it('refuse what is not a port, saying what a port is', () => {
        for (const port of ['abc', '70000', '-1', '80.5', ' ']) {
            expect(() => bind({ httpServer: { port } })).toThrow(/Expected a port, a whole number from 0 to 65535/)
        }
    })

    it('refuse a hostname that is not a string', () => {
        expect(() => bind({ httpServer: { hostname: { name: 'localhost' } } })).toThrow(/Expected a hostname/)
    })

    function bind(values: ConfigTree): HttpServerSettings {
        return new Config().add(memory(values)).bind(HttpServerSettings)
    }
})

class Hello extends Controller {
    registerRoutes(routes: Routes): void {
        routes
            .get('/hello', c => c.text('hello'))
            .get('/slow', async c => {
                await wait(300)
                return c.text('slow done')
            })
    }
}

const running: HttpServer[] = []

afterEach(async () => {
    for (const server of running.splice(0)) await server.stop()
})

function serverWith(values: { port: number }): HttpServer {
    const provider = new Services().add(jsonSerializer(), application(app => app), web(w => w.controller(Hello))).build({ validate: true })
    const settings = new Config().add(memory({ httpServer: values })).bind(HttpServerSettings)
    return new HttpServer(provider.get(Web), settings)
}

async function started(): Promise<HttpServer> {
    const server = serverWith({ port: 0 })
    await server.start()
    running.push(server)
    return server
}

async function timed(work: () => Promise<void>): Promise<number> {
    const start = performance.now()
    await work()
    return performance.now() - start
}

function wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}
