import type { StandardSchemaV1 } from '@caucejs/base'

import { HttpStatusError } from './errors/http-status-error.js'
import { UnreadableResponseError } from './errors/unreadable-response-error.js'
import type { HttpRequest } from './http-client.js'

/** What another system answered, with its body already read as text. */
export class HttpResponse {
    readonly request: HttpRequest
    readonly status: number
    readonly headers: Headers
    readonly text: string

    constructor(request: HttpRequest, status: number, headers: Headers, text: string) {
        this.request = request
        this.status = status
        this.headers = headers
        this.text = text
    }

    /** Whether the status is a success, from 200 to 299. */
    get ok(): boolean {
        return this.status >= 200 && this.status <= 299
    }

    /** This response, when its status is a success; otherwise it throws {@link HttpStatusError}. */
    ensureSuccess(): this {
        if (!this.ok) throw new HttpStatusError(this)
        return this
    }

    /** The body as JSON, unchecked. A body that is not JSON throws {@link UnreadableResponseError}. */
    json(): unknown {
        try {
            return JSON.parse(this.text) as unknown
        } catch (error) {
            throw new UnreadableResponseError(this, ['the body is not JSON'], { cause: error })
        }
    }

    /**
     * The body as JSON, read with any Standard Schema. A body that does not pass it throws {@link UnreadableResponseError}
     * with every problem, and never a `ValidationError`: the mistake is in the other system, not in whoever asked.
     */
    async read<T>(schema: StandardSchemaV1<unknown, T>): Promise<T> {
        const result = await schema['~standard'].validate(this.json())
        if (!result.issues) return result.value
        throw new UnreadableResponseError(
            this,
            result.issues.map(issue => {
                const path = (issue.path ?? []).map(segment => String(typeof segment === 'object' ? segment.key : segment)).join('.')
                return path === '' ? issue.message : `${path}: ${issue.message}`
            }),
        )
    }
}
