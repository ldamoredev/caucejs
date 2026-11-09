/** A fetch written by hand: it keeps every request it gets, with its body read, and answers what it is told. */
export class FakeFetch {
    readonly requests: { readonly method: string; readonly url: string; readonly headers: Headers; readonly body: string }[] = []
    #answer: (request: Request) => Response | Promise<Response> = () => message()

    answering(answer: (request: Request) => Response | Promise<Response>): this {
        this.#answer = answer
        return this
    }

    readonly fetch = async (request: Request): Promise<Response> => {
        this.requests.push({ method: request.method, url: request.url, headers: request.headers, body: await request.text() })
        return this.#answer(request)
    }

    get last(): FakeFetch['requests'][number] {
        const request = this.requests.at(-1)
        if (!request) throw new Error('No request was sent')
        return request
    }

    /** The body of the last request, as JSON. */
    get sent(): Record<string, unknown> {
        return JSON.parse(this.last.body) as Record<string, unknown>
    }
}

// The requests that are waiting. A request's signal follows the one it was built with only weakly, so a request nothing
// holds can be collected with its listener, and its abort never arrives; a real fetch holds it with its socket.
const waiting = new Set<Request>()

/** An answer that never comes: it waits until the request is aborted, as a server that hangs. */
export function hanging(request: Request): Promise<Response> {
    waiting.add(request)
    return new Promise((_resolve, reject) => {
        const abort = () => {
            waiting.delete(request)
            reject(request.signal.reason)
        }
        // the timeout can run out before this listens
        if (request.signal.aborted) abort()
        request.signal.addEventListener('abort', abort)
    })
}

/** A message of the Messages API, as it answers one, with the fields of the test over the usual ones. */
export function message(fields: Record<string, unknown> = {}): Response {
    return Response.json(
        {
            id: 'msg_01',
            type: 'message',
            role: 'assistant',
            model: 'claude-haiku-5-5',
            content: [{ type: 'text', text: 'The opening is at nine.' }],
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 120, output_tokens: 12, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
            ...fields,
        },
        { headers: { 'request-id': 'req_01' } },
    )
}

/** An error of the Messages API, as it answers one. */
export function apiError(status: number, type: string, headers: Record<string, string> = {}): Response {
    return Response.json(
        { type: 'error', error: { type, message: 'The answer of the provider, which may quote the request' } },
        { status, headers: { 'request-id': 'req_02', ...headers } },
    )
}
