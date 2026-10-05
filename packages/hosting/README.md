# @caucejs/hosting

The host of Cauce. The application puts together its configuration and its container on a builder, lists what
runs with it, and the host starts that in order, waits until it is asked to stop, and stops it in the reverse
order.

```bash
pnpm add @caucejs/hosting
```

```ts
const builder = new HostBuilder({ environment: environmentOf(process.env) })
builder.config.add(...standardSources(builder.environment))   // @caucejs/node
builder.services.add(conference(builder.config))
builder.start(TicketDesk).start(HttpServer)

await using host = builder.build()
await host.run(new ProcessLifetime())                           // @caucejs/node
```

The canonical host, to copy: [`examples/conference-host.ts`](examples/conference-host.ts).

## What is in it

| | |
|---|---|
| `HostBuilder` | The environment, `config`, `services`, and `start`, which lists what runs with the application |
| `Host` | The built application: `start`, `stop`, `run`, and `await using` to stop it |
| `HostEnvironment` | The name of the environment, injectable. `environmentOf(process.env)` reads `NODE_ENV` |
| `HostedService` | What starts and stops with the application: a server, a loader, a worker |
| `Lifetime` | When the application is asked to stop. `ManualLifetime` here; `ProcessLifetime`, on signals, in `@caucejs/node` |
| `StartError`, `StopTimeoutError` | A hosted service that failed to start, or did not stop in time |

## Why it is built this way

- **Nothing implicit.** The builder reads no file and adds no service of its own besides `HostEnvironment`. The
  standard order of the configuration is a function the application calls (`standardSources`), so reading the
  composition says which files it reads.
- **The environment never comes from the configuration**, because it decides which settings file to read. It is
  `production` unless the builder is told otherwise, so a deployment that forgets it runs as production. Test
  runners such as Vitest set `NODE_ENV=test`.
- **A module of the application is an extension of `@caucejs/di`.** There is no second concept: an extension
  already has an identity, `requires` and fail-if-different. What needs the container built is a hosted service.
- **What starts is named, in order.** `start` takes one class per call, so the compiler checks each `inject`
  list, and the order of the calls is the order of startup. There is no collection of every hosted service.
- **What needs an `await` to start goes here.** The container has no async factories: loading a cache or opening
  a server is the `start` of a hosted service.
- **The container is validated in every environment.** The validation builds nothing, so it costs nothing at
  startup, and a wrong composition fails before anything starts instead of on the first request.
- **Stopping always finishes.** Hosted services stop in reverse order, each within the shutdown timeout (30
  seconds by default); every failure is collected, and then the container disposes what it built. A service that
  fails to start stops the ones that started.
- **Signals belong to the runtime.** This package does not import `node:*`: the lifetime is a contract, and
  `@caucejs/node` implements it on `SIGINT` and `SIGTERM`.
- **The host writes nothing to the console.** There is no logging module yet; a hosted service says what it wants
  when it starts.
