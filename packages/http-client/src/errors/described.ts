import type { HttpRequest } from '../http-client.js'

/**
 * How an error names a request: its method and its URL without the query, which can carry a token. Never a header:
 * the authorization goes there.
 */
export function described(request: HttpRequest): string {
    const end = request.url.search(/[?#]/)
    return `${request.method} ${end === -1 ? request.url : request.url.slice(0, end)}`
}
