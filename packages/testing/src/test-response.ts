import { UnexpectedResponseError } from './errors/unexpected-response-error.js'

const shownBody = 500

/**
 * A response with its body already read, so a test reads it as many times as it wants and every assertion is
 * synchronous. The assertions are about HTTP; what the body says is asserted with the test runner.
 */
export class TestResponse {
    readonly method: string
    readonly url: string
    readonly status: number
    readonly headers: Headers
    readonly text: string

    private constructor(method: string, url: string, response: Response, text: string) {
        this.method = method
        this.url = url
        this.status = response.status
        this.headers = response.headers
        this.text = text
    }

    static async of(request: Request, response: Response): Promise<TestResponse> {
        return new TestResponse(request.method, request.url, response, await response.text())
    }

    /** The body parsed as JSON. A body that is not JSON fails, showing what it was. */
    json(): unknown {
        try {
            return JSON.parse(this.text)
        } catch (error) {
            throw new UnexpectedResponseError(this.#describe('to answer JSON'), { cause: error })
        }
    }

    /** Passes when the status is the one given, or any 2xx without one. */
    succeeds(status?: number): this {
        const passes = status === undefined ? this.status >= 200 && this.status < 300 : this.status === status
        if (!passes) throw new UnexpectedResponseError(this.#describe(`to succeed with ${status ?? '2xx'}`))
        return this
    }

    failsWith(status: number): this {
        if (this.status !== status) throw new UnexpectedResponseError(this.#describe(`to fail with ${status}`))
        return this
    }

    /** Passes when the response is a redirection (3xx) to exactly this location. */
    redirectsTo(location: string): this {
        const actual = this.headers.get('location')
        if (this.status < 300 || this.status >= 400 || actual !== location) {
            throw new UnexpectedResponseError(this.#describe(`to redirect to ${location}`, actual))
        }
        return this
    }

    #describe(expectation: string, location?: string | null): string {
        const { pathname, search } = new URL(this.url)
        const redirect = location === undefined ? '' : `, to ${location ?? 'no location'}`
        const body = this.text.length > shownBody ? `${this.text.slice(0, shownBody)}…` : this.text
        return `Expected ${this.method} ${pathname}${search} ${expectation}, but it answered ${this.status}${redirect}${body === '' ? '' : `:\n${body}`}`
    }
}
