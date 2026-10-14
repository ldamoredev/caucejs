/** A fetch written by hand: it keeps every request it gets, with its body read, and answers what it is told. */
export class FakeFetch {
    readonly requests: { readonly method: string; readonly url: string; readonly headers: Headers; readonly body: string }[] = []
    #answer: (request: Request) => Response | Promise<Response> = () => new Response('{}', { status: 200 })

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
