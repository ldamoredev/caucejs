// The answers of the endpoint that are not JSON-RPC. They are returned, never thrown, so the ProblemResponder of the
// application, which may turn a 401 or a 404 into a redirect to its login, never sees them.

/** Nobody, or somebody the authenticator does not know. `Bearer` alone: `resource_metadata` would start OAuth. */
export function unauthorized(): Response {
    return problem(401, 'Unauthorized', { 'www-authenticate': 'Bearer' })
}

export function forbidden(): Response {
    return problem(403, 'Forbidden')
}

/** What a client that looks for OAuth asks for, answered so it stops looking. */
export function notFound(): Response {
    return problem(404, 'Not Found')
}

// The same answer the SDK gives without state: there is no session to open with a GET or to close with a DELETE.
export function methodNotAllowed(): Response {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }), {
        status: 405,
        headers: { 'content-type': 'application/json', allow: 'POST' },
    })
}

// subscriptions/listen opens a stream of server-sent events whatever the responseMode, to tell of a list that changed;
// this list never changes, and the endpoint answers with JSON only.
export function methodNotFound(id: unknown): Response {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    })
}

function problem(status: number, title: string, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify({ type: 'about:blank', title, status }), {
        status,
        headers: { 'content-type': 'application/problem+json', ...headers },
    })
}
