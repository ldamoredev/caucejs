# @caucejs/http-client

The HTTP client of Cauce, on the fetch standard. The container injects it, a class that talks to one system builds
its own with a base and headers, and a test replaces it with one on a fake `fetch`, without touching `globalThis`.

```bash
pnpm add @caucejs/http-client
```

```ts
services.add(httpClient())

class SpeakerDirectory {
    static readonly inject = [HttpClient] as const
    readonly #http: HttpClient
    constructor(http: HttpClient) {
        this.#http = http.with({ baseUrl: 'https://speakers.example/v1', headers: { authorization: `Bearer ${token}` } })
    }
    async find(id: string): Promise<Speaker | null> {
        const response = await this.#http.get(`/speakers/${id}`)
        if (response.status === 404) return null
        return response.ensureSuccess().read(speakerSchema)
    }
}

// in a test
services.replace(HttpClient, () => new FetchHttpClient({ fetch: fakeSpeakers }))
```

The canonical client, to copy: [`examples/speaker-directory.ts`](examples/speaker-directory.ts).

## What is in it

| | |
|---|---|
| `HttpClient` | `get`, `post`, `put`, `patch`, `delete` and `request`, with `json`, `form` or `body`, `headers` and `timeout`. `with` builds a client with a base, headers and a timeout. `send` is the one method a client implements |
| `FetchHttpClient` | The client on `fetch`, or on the `fetch` it is given |
| `HttpResponse` | `status`, `ok`, `headers` and `text`, read; `json()`, `read(schema)` and `ensureSuccess()` |
| `httpClient` | The extension: one `FetchHttpClient` for the application, with its timeout |
| `HttpRequestError`, `HttpTimeoutError` | No answer, or no answer in time |
| `HttpStatusError` | An answer that is not a success, thrown by `ensureSuccess()` |
| `UnreadableResponseError` | An answer that is not JSON, or not what its schema says |

## Why it is built this way

- **On the fetch standard, with no dependency.** Node, Bun and Deno implement it, so this package imports no `node:*`.
  Libraries such as ky or ofetch add retries and hooks over it; nothing asks for those yet.
- **A status that is not a success is returned, not thrown.** A 404 or a 409 is often the answer the caller asks
  about, so the status is data and `ensureSuccess()` throws when the caller wants it to. The body is already read.
- **The same request as the test client**: `json`, `form` or `body`, one at a time, and the client sets the content
  type of the first two. Calling another system and calling the application in a test read the same.
- **`read(schema)` takes any Standard Schema**, and what does not pass is an `UnreadableResponseError`, never a
  `ValidationError`: in `@caucejs/web` that one is a 400, and an answer that is wrong is the other system's mistake,
  not the caller's.
- **A client per system, with `with`.** A class that talks to one API builds its client once, with the base, the
  headers and the timeout; a relative URL is joined to the base with one slash, and an absolute one is kept. It is
  the typed client of other frameworks, without a factory and without named clients in the configuration.
- **30 seconds by default.** `fetch` waits forever. The timeout covers reading the body, a request can say its own,
  and running out is an `HttpTimeoutError`.
- **Errors name the method and the URL without the query, and never a header**: the authorization goes in a header,
  and a token sometimes in the query. A body is never quoted.
- **`send` is the one method to implement**, so a client that wraps another —one that traces, one that retries—
  overrides it and nothing else.
- **A test replaces the client, not `fetch`.** `new FetchHttpClient({ fetch })` takes any function from `Request` to
  `Response`, such as the `fetch` of an application of Cauce.
- **Not here:** retries, which could send a write twice; streaming and server-sent events, which arrive with the AI;
  tracing and a correlation id, which arrive with telemetry; and a binary body, which is read as text.
