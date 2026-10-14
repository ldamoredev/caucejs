import type { HttpResponse } from './http-response.js'

export type HttpHeaders = Readonly<Record<string, string>>

export type HttpBody = string | Uint8Array<ArrayBuffer> | URLSearchParams | FormData

/**
 * A request ready to send: its body encoded, and its headers with lowercase names. A client that wraps another, such
 * as one that traces, reads and changes this.
 */
export type HttpRequest = {
    readonly method: string
    readonly url: string
    readonly headers: HttpHeaders
    readonly body?: HttpBody
    /** Milliseconds. Without it, the timeout of the client. */
    readonly timeout?: number
}

/** The body of a request, at most one kind. The client sets the `content-type` of `json` and `form`. */
export type RequestBody =
    | { readonly json: unknown; readonly form?: never; readonly body?: never }
    | { readonly form: Readonly<Record<string, string>>; readonly json?: never; readonly body?: never }
    | { readonly body: HttpBody; readonly json?: never; readonly form?: never }
    | { readonly json?: never; readonly form?: never; readonly body?: never }

export type RequestOptions = { readonly headers?: HttpHeaders; readonly timeout?: number } & RequestBody

export type ClientOptions = {
    /** Where a relative URL is joined: `with({ baseUrl: 'https://api.github.com/repos/conference/site' }).get('/git/refs')`. */
    readonly baseUrl?: string
    /** Sent with every request; the request's own headers win. */
    readonly headers?: HttpHeaders
    /** Milliseconds, for every request that does not say its own. */
    readonly timeout?: number
}

/**
 * Calls another system over HTTP and returns what it answered, with the body read. **A status that is not a success is
 * returned, not thrown**: a 404 or a 409 is often what the caller asks about. `ensureSuccess()` throws it when it is not.
 *
 * `send` is the one method to implement, so a client that wraps another —one that traces, one that retries— overrides
 * that and nothing else. `FetchHttpClient` is the one that sends.
 */
export abstract class HttpClient {
    abstract send(request: HttpRequest): Promise<HttpResponse>

    get(url: string, options: { readonly headers?: HttpHeaders; readonly timeout?: number } = {}): Promise<HttpResponse> {
        return this.request('GET', url, options)
    }

    post(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
        return this.request('POST', url, options)
    }

    put(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
        return this.request('PUT', url, options)
    }

    patch(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
        return this.request('PATCH', url, options)
    }

    delete(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
        return this.request('DELETE', url, options)
    }

    /** Any other method, such as `HEAD`. */
    request(method: string, url: string, options: RequestOptions = {}): Promise<HttpResponse> {
        const { body, type } = encoded(options)
        const headers = { ...(type !== undefined && { 'content-type': type }), ...lowercased(options.headers ?? {}) }
        return this.send({
            method,
            url,
            headers,
            ...(body !== undefined && { body }),
            ...(options.timeout !== undefined && { timeout: options.timeout }),
        })
    }

    /**
     * Another client that joins relative URLs to a base, and adds headers and a timeout to what it sends, over this
     * one. A class that talks to one system builds it once: it is what .NET calls a typed client. This one does not
     * change.
     */
    with(options: ClientOptions): HttpClient {
        return new ConfiguredHttpClient(this, options)
    }
}

class ConfiguredHttpClient extends HttpClient {
    readonly #inner: HttpClient
    readonly #options: ClientOptions

    constructor(inner: HttpClient, options: ClientOptions) {
        super()
        this.#inner = inner
        this.#options = options
    }

    send(request: HttpRequest): Promise<HttpResponse> {
        const { baseUrl, headers = {}, timeout } = this.#options
        const own = timeout === undefined || request.timeout !== undefined ? {} : { timeout }
        return this.#inner.send({
            ...request,
            ...own,
            url: baseUrl === undefined ? request.url : joined(baseUrl, request.url),
            headers: { ...lowercased(headers), ...request.headers },
        })
    }
}

// An absolute URL is kept, so one client can still call another system; a relative one is joined with one slash, as
// `new URL` would not: it drops the path of the base when the relative one starts with a slash.
function joined(base: string, url: string): string {
    if (/^[a-z][a-z\d+.-]*:/i.test(url)) return url
    if (url === '') return base
    return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
}

function lowercased(headers: HttpHeaders): HttpHeaders {
    return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
}

function encoded(options: RequestOptions): { readonly body?: HttpBody; readonly type?: string } {
    if (options.json !== undefined) return { body: JSON.stringify(options.json), type: 'application/json' }
    if (options.form !== undefined) return { body: new URLSearchParams(options.form), type: 'application/x-www-form-urlencoded' }
    return options.body === undefined ? {} : { body: options.body }
}
