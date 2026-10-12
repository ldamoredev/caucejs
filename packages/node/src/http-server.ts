import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import { HostedService } from '@caucejs/hosting'
import { Web } from '@caucejs/web'
import { createAdaptorServer } from '@hono/node-server'

import { HttpServerSettings } from './http-server-settings.js'

/**
 * Serves the `fetch` of the web of the application on Node. It starts when the host starts it —list it last, so it
 * never answers before what it serves is ready— and stops in order.
 *
 * Stopping is graceful: it takes no new connection, closes the idle ones, answers each request in flight with
 * `Connection: close`, and waits for them. A connection kept alive would otherwise
 * hold the stop until it times out: seconds with Node's defaults, more than a minute with some servers. The host bounds
 * the wait with its shutdown timeout.
 */
export class HttpServer extends HostedService {
    static readonly inject = [Web, HttpServerSettings] as const
    readonly #web: Web
    readonly #settings: HttpServerSettings
    #server: Server | null = null
    #port: number | null = null
    readonly #inFlight = new Set<ServerResponse>()

    constructor(web: Web, settings: HttpServerSettings) {
        super()
        this.#web = web
        this.#settings = settings
    }

    /** The port it listens on: the one in the settings, or the one the system gave for port 0. `null` until it starts. */
    get port(): number | null {
        return this.#port
    }

    async start(): Promise<void> {
        const server = createAdaptorServer({ fetch: this.#web.fetch }) as Server
        server.on('request', (_request: IncomingMessage, response: ServerResponse) => this.#track(response))
        await new Promise<void>((resolve, reject) => {
            // A port already taken never calls back: without this, the start would wait forever.
            server.once('error', reject)
            server.listen(this.#settings.port, this.#settings.hostname, () => {
                server.off('error', reject)
                resolve()
            })
        })
        this.#server = server
        this.#port = (server.address() as AddressInfo).port
    }

    async stop(): Promise<void> {
        const server = this.#server
        if (server === null) return
        this.#server = null
        // Each response still in flight closes its connection once sent, so none is kept alive behind it. `close`
        // takes no new connection and closes the idle ones; no request can arrive on another.
        for (const response of this.#inFlight) if (!response.headersSent) response.setHeader('connection', 'close')
        await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
    }

    #track(response: ServerResponse): void {
        this.#inFlight.add(response)
        response.once('close', () => this.#inFlight.delete(response))
    }
}
