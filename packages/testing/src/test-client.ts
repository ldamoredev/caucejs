import { TestResponse } from './test-response.js'

/**
 * What answers a request: `app.fetch` of an application that follows the fetch standard, called in memory, or
 * `fetch` itself against a running server.
 */
export type FetchHandler = (request: Request) => Response | Promise<Response>

export type HeaderValues = Readonly<Record<string, string>>

export type ClientOptions = {
    /** Where relative paths are resolved. `http://localhost` by default. */
    readonly baseUrl?: string
    /** Sent with every request; a request's own headers win. */
    readonly headers?: HeaderValues
}

/** The body of a request, at most one kind. The client sets the `content-type` of `json` and `form`. */
export type RequestBody =
    | { readonly json: unknown; readonly form?: never; readonly body?: never }
    | { readonly form: Readonly<Record<string, string>>; readonly json?: never; readonly body?: never }
    | { readonly body: string | Uint8Array<ArrayBuffer> | URLSearchParams | FormData; readonly json?: never; readonly form?: never }
    | { readonly json?: never; readonly form?: never; readonly body?: never }

export type RequestOptions = { readonly headers?: HeaderValues } & RequestBody

/**
 * Calls an application the way a client does and returns what it answered. The verb is the last step, so no
 * request is left built and never sent.
 *
 * Redirections are not followed: a test asserts them with `redirectsTo`. Cookies are not kept: a session is a
 * header, set with `with`.
 */
export class TestClient {
    readonly #handler: FetchHandler
    readonly #baseUrl: string
    readonly #headers: HeaderValues

    constructor(handler: FetchHandler, options: ClientOptions = {}) {
        this.#handler = handler
        this.#baseUrl = options.baseUrl ?? 'http://localhost'
        this.#headers = options.headers ?? {}
    }

    /** Another client that also sends these headers, such as a session. This one does not change. */
    with(options: { readonly headers: HeaderValues }): TestClient {
        return new TestClient(this.#handler, { baseUrl: this.#baseUrl, headers: { ...this.#headers, ...options.headers } })
    }

    get(path: string, options: { readonly headers?: HeaderValues } = {}): Promise<TestResponse> {
        return this.send('GET', path, options)
    }

    post(path: string, options: RequestOptions = {}): Promise<TestResponse> {
        return this.send('POST', path, options)
    }

    put(path: string, options: RequestOptions = {}): Promise<TestResponse> {
        return this.send('PUT', path, options)
    }

    patch(path: string, options: RequestOptions = {}): Promise<TestResponse> {
        return this.send('PATCH', path, options)
    }

    delete(path: string, options: RequestOptions = {}): Promise<TestResponse> {
        return this.send('DELETE', path, options)
    }

    /** Any other method, such as `HEAD` or `OPTIONS`. */
    async send(method: string, path: string, options: RequestOptions = {}): Promise<TestResponse> {
        const headers = new Headers({ ...this.#headers, ...options.headers })
        const body = bodyOf(options, headers)
        const request = new Request(new URL(path, this.#baseUrl), {
            method,
            headers,
            redirect: 'manual',
            ...(body !== undefined && { body }),
        })
        return TestResponse.of(request, await this.#handler(request))
    }
}

function bodyOf(options: RequestOptions, headers: Headers): BodyInit | undefined {
    if (options.json !== undefined) {
        if (!headers.has('content-type')) headers.set('content-type', 'application/json')
        return JSON.stringify(options.json)
    }
    if (options.form !== undefined) return new URLSearchParams(options.form)
    return options.body
}
