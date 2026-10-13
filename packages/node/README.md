# @caucejs/node

The Node.js adapter of Cauce: what the other packages leave to the runtime. It is the only package that
imports `node:*`.

```bash
pnpm add @caucejs/node
```

| Export | What it implements |
|---|---|
| `WebApplication` | **Where a web application on Node starts**: `WebApplication.builder()` brings the usual defaults, and `run()` waits for `SIGINT` or `SIGTERM` |
| `NodeAsyncLocal` | `AsyncLocal` of `@caucejs/base`, on `AsyncLocalStorage` from `node:async_hooks` |
| `jsonFile` | A source of `@caucejs/config` read from a JSON file |
| `dotenvFile` | A source of `@caucejs/config` read from a `.env` file with `util.parseEnv`, without writing to `process.env`. Add it before `environment(process.env)`, so a variable that is really set wins |
| `standardSources` | The standard order of the configuration for `@caucejs/hosting`: `settings.json`, `settings.<environment>.json`, `.env` and the variables of the process, the files optional |
| `ProcessLifetime` | The `Lifetime` of `@caucejs/hosting` on `SIGINT` and `SIGTERM`. A second signal ends the process at once, with the code of that signal |
| `HttpServer` | A hosted service that serves the `fetch` of the `Web` of `@caucejs/web` on `node:http`, and stops gracefully |
| `HttpServerSettings` | The section `httpServer`: `port`, 8080 by default and 0 for any free one, and `hostname`. From the environment, `HTTP_SERVER__PORT` |

Examples, in the fictitious domain of a conference: [`examples/current-attendee.ts`](examples/current-attendee.ts) and the
canonical web application, [`examples/conference-server.ts`](examples/conference-server.ts).

## A web application

```ts
const builder = WebApplication.builder({ name: 'conference' })
builder.addModule(Conference)
const app = builder.build()
await app.run()
```

```ts
class Conference extends Module<WebApplicationBuilder> {
    compose(app: WebApplicationBuilder): void {
        app.addSettings(TicketingSettings)
        app.services.addSingleton(Talks, SqlTalks)
        app.useCases.use(Authorization)
        app.useCases.handle(GetTalkHandler)
        app.web.authenticateWith(SessionCookie)
        app.web.controller(TalksController)
        app.start(TicketDesk)
    }
}
```

- **The builder brings what every application wrote by hand**: the environment from `NODE_ENV`, production when it
  is not set; the standard sources, with `PORT` as the port of the server below `HTTP_SERVER__PORT`, as Railway, Render
  and Heroku set it; the `JsonSerializer`; the use cases in `useCases` and the web in `web`; and the `HttpServer`,
  started last, after every hosted service of the application. A plain `HostBuilder` of `@caucejs/hosting` adds none
  of it, for an application that wants to write it.
- **Everything is reached from the builder**: `app.services`, `app.config`, `app.useCases`, `app.web`, `app.addModule`,
  `app.addSettings` and `app.start`. A module writes one statement per line.
- **A test passes its own sources**: `WebApplication.builder({ environment: 'test', sources: [memory(...)] })` reads no
  file and nothing of the environment of the process. It calls `app.fetch` without starting, or `start` and `stop`.
- **`run()` says where it listens**, `conference listening on http://localhost:8080`, and stops on `SIGINT` or `SIGTERM`.
- **Wrong settings fail `build()`**, with every problem and no stack: the mistake is in the environment.

## The server

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
