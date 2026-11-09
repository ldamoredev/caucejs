# @caucejs/mcp

The server of MCP of Cauce. It serves the tools of an application, the use cases that `@caucejs/tools` describes, over
HTTP to a client of the [Model Context Protocol](https://modelcontextprotocol.io), such as an agent that operates the
application. It is a controller of `web`, on the official SDK, without state and answered with JSON only. It has an
authenticator of its own, and every tool runs through the middlewares of the use cases, as whoever the token says.

```bash
pnpm add @caucejs/mcp
```

```ts
class ConferenceMcp extends McpController {
    static readonly inject = [ToolRunner, UseCases, BoxOfficeTokens] as const

    constructor(runner: ToolRunner, useCases: UseCases, tokens: BoxOfficeTokens) {
        super(runner, useCases, { path: '/mcp', name: 'conference', version: '1.0.0', authenticator: tokens })
    }

    registerTools(tools: McpTools): void {
        tools.add(getTalk)
        tools.add(sellTicket)
    }
}

// in a module of a web application, as statements
app.services.add(tools())
app.services.addSingleton(BoxOfficeTokens)
app.useCases.use(Authorization)
app.useCases.handle(GetTalkHandler)
app.useCases.handle(SellTicketHandler)
app.web.controller(ConferenceMcp)
```

The canonical server, to copy: [`examples/conference-mcp.ts`](examples/conference-mcp.ts).

## What is in it

| | |
|---|---|
| `McpController` | The server, as a `Controller` of `web`: the application extends it, passes its options to the constructor and declares its tools in `registerTools` |
| `McpOptions` | `path`, `name`, `version`, `authenticator`, and `anonymous?` or `permissions?` |
| `McpTools` | Where the tools are declared: `tools.add(getTalk)`. A name added twice is a `CompositionError` |

## Why it is built this way

- **On the official SDK, version 2: `@modelcontextprotocol/server`.** The protocol is the SDK's, and `mcp` does not
  write it again. It brings `@modelcontextprotocol/core` and `zod`, nothing else, and Zod reaches the runtime of an
  application that uses `mcp`.
- **The code of `mcp` imports nothing of Node; the SDK does, through its shim.** Its entry imports
  `@modelcontextprotocol/server/_shims`. With the `node` and `default` conditions that resolves to `shimsNode.mjs`,
  which imports `node:process` (for stdio, which `mcp` does not use) and the Ajv validator. With `browser` and
  `workerd` it resolves to shims without Node. That is why it is a package of its own, and not part of
  `@caucejs/node`: it builds without the types of any runtime, as `web` does.
- **A controller of `web`.** It is added with `app.web.controller(...)` like any other. Each request runs in the
  scope `web` opens for it, and `ToolRunner` runs every tool through the middlewares: authorization and logging see
  a call to a tool the way they see a web request.
- **`UseCases` goes in the constructor**, next to the runner. `mcp` uses `UseCases.handles` to check that every tool
  has a handler, so a tool without one fails with `CompositionError`, naming the tool and its request, and not on
  the first call.
- **It fails when `Web` is built, not when the container is built.** The validation of the container builds nothing,
  and a controller is built with `Web`. In a web application that is `start()`, before the server listens, or the
  first `fetch` in memory. That is when the tools are checked and described, once: a tool without a handler fails
  there, and so does one whose input cannot be said in JSON Schema, with `JsonSchemaUnavailableError`.
- **The endpoint authenticates on its own**, with the `Authenticator` in its options, not with the application's.
  A session cookie does not open the endpoint, and its token does not open a page. `web` still asks the application's
  authenticator about every request, `/mcp` included. Whatever it answers is ignored here, so it should keep its
  contract and answer anonymous for what it does not know.
- **The application compares the token, not `mcp`.** `mcp` only reads whether the identity is authenticated. Compare
  the token in constant time: an early return on the first different character tells a caller, by how long it took,
  how much of the token was right.
- **Closed by default.** A caller the authenticator does not authenticate gets a **401 with `WWW-Authenticate: Bearer`**,
  before anything of MCP is read. With `permissions`, one that can do none of them gets a **403**.
  `anonymous: true` lets anybody in, and then the use cases decide; a use case that still finds nobody there,
  `NotAuthenticatedError`, makes the request a 401. An authenticator that refuses a token by throwing
  `NotAuthenticatedError` is a 401 too, answered by the endpoint; any other error it throws goes on to `web`, which
  answers it as a problem. `anonymous` with `permissions` is refused, because it has no
  meaning.
- **No `resource_metadata`, and 404 where a client looks for OAuth.** A 401 that names the metadata of a protected
  resource starts OAuth in the client, and a server with a token of its own has no OAuth to offer. So `mcp` answers 404
  on `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource<path>` (RFC 9728 puts the path of
  the resource after it: `/api/mcp` gives `/.well-known/oauth-protected-resource/api/mcp`),
  `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration`. Three of them are at the root: an
  application that serves its own OpenID metadata does not add a server of MCP. Without that metadata, the endpoint
  is outside the letter of the authorization of MCP, which is optional, on purpose. **A `POST /register`, the dynamic
  registration of a client, is the application's**: `mcp` does not answer it.
- **Its 401, 403 and 404 are returned, never thrown.** They are `application/problem+json` that `mcp` writes itself,
  so a `ProblemResponder` that turns a 401 or a 404 into a redirect to the login never sees them, and a client of MCP
  never gets a login page.
- **The token can come in the path.** Reading it from the URL is the application's decision: mount the endpoint on
  `/mcp/:token` and read it in the authenticator. A path does not end with a slash and does not use `*`. Whether a
  path with a token reaches the logs of a proxy depends on the proxy.
- **Without state, and JSON only.** A server of the SDK is built for every request, and nothing is kept between them.
  The revision 2026-07-28 goes through `createMcpHandler` with `legacy: 'reject'` and `responseMode: 'json'`. The
  revisions of 2025 go through a `WebStandardStreamableHTTPServerTransport` with `enableJsonResponse`, a new one for
  each request: the fallback of the SDK for them, `legacy: 'stateless'`, answers with a stream of server-sent events.
  There is no session, so a GET or a DELETE of the endpoint is a 405 with `Allow: POST`, as the SDK answers it. A
  `subscriptions/listen` of the revision 2026-07-28 is `-32601`, method not found, answered by `mcp` before the SDK:
  the SDK would open a stream of server-sent events for it whatever the `responseMode`, to tell of a list that never
  changes. Its body is read for its id under the same limit of 4 MiB as any other, and a body over it is the same 413
  the SDK answers.
- **The SDK warns once.** Creating the handler with `responseMode: 'json'` writes a `console.warn` about the
  notifications it drops, once per server of MCP, when `Web` is built. Nothing else is written about what a request
  brings or what it is answered: neither the body, nor the arguments, nor the result.
- **The input is read once, by Cauce.** The schema reaches the SDK with `fromJsonSchema`, which would validate with
  Ajv and answer in Ajv's words before the use case is read. `mcp` gives it a validator that lets everything through,
  and `ToolRunner` reads the input with the `JsonSerializer`, as `web` reads a request: the issues a client reads are
  Cauce's.
- **What a call answers**:

  | The use case | The result |
  |---|---|
  | Answers an object | `structuredContent` with that object, and the JSON text the serializer writes |
  | Answers anything else: a number, a string, a list, `null` | `structuredContent: { result }`, and the JSON text |
  | Answers nothing | The text `Done.` |
  | Fails, as `ToolRunner` says | The message, with `isError: true`: an input that does not pass, a `DomainError` and a `ForbiddenError` say why; anything else says `Tool execution failed`, and its error is written with `console.error`, as `web` does with a 500 |

  `structuredContent` is what the serializer wrote, so a date reads the same in it as in the text. A tool that does
  not exist is the error of the SDK, `-32602`. **A `ForbiddenError` from a use case is a result with `isError`, not a
  403**: the 403 is only for the `permissions` of the endpoint.
- **Every tool, for every caller let in.** The list does not change while the application runs, so the server says
  `listChanged: false`. Hiding a tool would not close it: what a caller may run is decided by the use case.
- **The name of a tool** follows `@caucejs/tools`, which is narrower than the rule of MCP (`A-Z a-z 0-9 _ - .`, 1 to
  128). `McpTools.add` also refuses a name that starts or ends with a hyphen: the SDK takes it, but warns every time
  it registers it, which is every request.
- **The body is read by the SDK.** `mcp` passes the request as it comes, not a `parsedBody`, so the SDK applies its
  limit of 4 MiB and answers a body that is not JSON itself. A middleware of the application that reads the body of
  the endpoint leaves nothing to read: keep body parsers off the path of the endpoint.
- **Host and Origin are not checked**, by `mcp` nor by the SDK. An application that serves the endpoint on localhost,
  or with `anonymous`, checks them in a middleware in front of it.
- **Not here:** the client, resources and prompts, server-sent events, OAuth, `outputSchema`, the notice that the list
  changed, and traces.
