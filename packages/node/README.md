# @caucejs/node

The Node.js adapter of Cauce: what the other packages leave to the runtime. It is the only package that
imports `node:*`.

```bash
pnpm add @caucejs/node
```

| Export | What it implements |
|---|---|
| `NodeAsyncLocal` | `AsyncLocal` of `@caucejs/base`, on `AsyncLocalStorage` from `node:async_hooks` |
| `jsonFile` | A source of `@caucejs/config` read from a JSON file |
| `dotenvFile` | A source of `@caucejs/config` read from a `.env` file with `util.parseEnv`, without writing to `process.env`. Add it before `environment(process.env)`, so a variable that is really set wins |
| `standardSources` | The standard order of the configuration for `@caucejs/hosting`: `settings.json`, `settings.<environment>.json`, `.env` and the variables of the process, the files optional |
| `ProcessLifetime` | The `Lifetime` of `@caucejs/hosting` on `SIGINT` and `SIGTERM`. A second signal ends the process at once, with the code of that signal |
| `HttpServer` | A hosted service that serves the `fetch` of the `Web` of `@caucejs/web` on `node:http`, and stops gracefully |
| `HttpServerSettings` | The section `httpServer`: `port`, 8080 by default and 0 for any free one, and `hostname`. From the environment, `HTTP_SERVER__PORT` |

Examples, in the fictitious domain of a conference: [`examples/current-attendee.ts`](examples/current-attendee.ts) and the
canonical server, [`examples/conference-server.ts`](examples/conference-server.ts).

## The server

```ts
builder.services
    .addInstance(HttpServerSettings, builder.config.bind(HttpServerSettings))
    .add(jsonSerializer(), application(...), web(...))
builder.start(HttpServer)                        // last: it never answers before the rest is ready
await builder.build().run(new ProcessLifetime())
```

- **It serves the `fetch` of the application**, through `@hono/node-server`; `@caucejs/web` itself imports no `node:*`.
- **A port that is taken fails the start**, instead of waiting forever. With port 0, `port` says which one it got.
- **Stopping is graceful, and does not wait for keep-alive.** It takes no new connection and closes the idle ones, and
  each request still in flight is answered with `Connection: close` and waited for. Without that, the connection of a
  request in flight stays open after its answer until its keep-alive runs out: about three seconds with the defaults
  of Node, and seventy-two with some servers. The host bounds the wait with its shutdown timeout.

## Why it is a package of its own

Cauce runs on Node first and Bun later. Keeping every runtime API in one adapter makes Bun one more
adapter instead of a rewrite. `AsyncLocalStorage` is implemented by Bun and Deno too, so this adapter
may serve them; whether it does has not been tested.
