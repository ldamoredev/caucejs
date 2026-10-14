import { HttpRequestError } from './errors/http-request-error.js'
import { HttpTimeoutError } from './errors/http-timeout-error.js'
import { HttpClient, type HttpRequest } from './http-client.js'
import { HttpResponse } from './http-response.js'

/** What sends a request: `fetch` itself, the `fetch` of an application of Cauce, or a function a test writes. */
export type FetchHandler = (request: Request) => Response | Promise<Response>

export type FetchHttpClientOptions = {
    /** `globalThis.fetch` when it is not given. A test passes a fake, so nothing of the process is touched. */
    readonly fetch?: FetchHandler
    /** Milliseconds for each request, reading the body included. 30 seconds when it is not given. */
    readonly timeout?: number
}

/**
 * The `HttpClient` on the fetch standard, which Node, Bun and Deno implement. It follows redirections, as `fetch` does,
 * and reads the whole body as text before it answers.
 */
export class FetchHttpClient extends HttpClient {
    readonly #fetch: FetchHandler
    readonly #timeout: number

    constructor(options: FetchHttpClientOptions = {}) {
        super()
        this.#fetch = options.fetch ?? (request => fetch(request))
        this.#timeout = options.timeout ?? 30_000
    }

    async send(request: HttpRequest): Promise<HttpResponse> {
        const timeout = request.timeout ?? this.#timeout
        // A timer of its own, cleared as soon as the answer is read, so nothing waits on it afterwards.
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(new DOMException(`No answer within ${timeout} ms`, 'TimeoutError')), timeout)
        try {
            const response = await this.#fetch(
                new Request(request.url, {
                    method: request.method,
                    headers: request.headers,
                    signal: controller.signal,
                    ...(request.body !== undefined && { body: request.body }),
                }),
            )
            return new HttpResponse(request, response.status, response.headers, await response.text())
        } catch (error) {
            if (error instanceof DOMException && error.name === 'TimeoutError') throw new HttpTimeoutError(request, timeout, { cause: error })
            throw new HttpRequestError(request, { cause: error })
        } finally {
            clearTimeout(timer)
        }
    }
}
