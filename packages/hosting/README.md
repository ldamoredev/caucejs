# @caucejs/hosting

The host of Cauce. The application puts together its configuration and its container on a builder, lists what
runs with it, and the host starts that in order, waits until it is asked to stop, and stops it in the reverse
order.

```bash
pnpm add @caucejs/hosting
```

```ts
class Conference extends Module {
    compose(app: HostBuilder): void {
        app.addSettings(DoorsSettings)
        app.services.addSingleton(Journal)
        app.start(Doors)
    }
}

const builder = new HostBuilder({ environment: environmentOf(process.env) })
builder.config.add(...standardSources(builder.environment))   // @caucejs/node
builder.addModule(Conference)
const host = builder.build()
await host.run(new ProcessLifetime())                           // @caucejs/node
```

**A web application on Node starts from `WebApplication.builder()`**, in `@caucejs/node`, which brings these defaults
and the server; this builder is the one without any. The canonical host, to copy:
[`examples/conference-host.ts`](examples/conference-host.ts).

## What is in it

| | |
|---|---|
| `HostBuilder` | The environment, `config`, `services`, `addModule`, `addSettings`, and `start`, which lists what runs with the application |
| `Module` | A part of the application, as a class: `compose(app)` adds its settings, services and what starts with it |
| `Host` | The built application: `start`, `stop`, `run`, and `await using` to stop it |
| `HostEnvironment` | The name of the environment, injectable. `environmentOf(process.env)` reads `NODE_ENV` |
| `HostedService` | What starts and stops with the application: a server, a loader, a worker |
| `Lifetime` | When the application is asked to stop. `ManualLifetime` here; `ProcessLifetime`, on signals, in `@caucejs/node` |
| `StartError`, `StopTimeoutError` | A hosted service that failed to start, or did not stop in time |

## Why it is built this way

- **This builder brings nothing.** It reads no file and adds no service of its own besides `HostEnvironment`. The
  defaults live in the builder of a runtime, `WebApplication.builder()` in `@caucejs/node`, which documents them: until
  12 October every application wrote them by hand, and the plumbing hid what the application was.
- **The environment never comes from the configuration**, because it decides which settings file to read. It is
  `production` unless the builder is told otherwise, so a deployment that forgets it runs as production. Test
  runners such as Vitest set `NODE_ENV=test`.
- **A module of the application is a class**, and an extension is what a package adds to the container. A module
  composes with statements, one per line, may add other modules, and is composed once per class, so two modules can
  ask for a third. A module of a richer builder, `Module<WebApplicationBuilder>`, does not compile on a plain one.
- **Settings are bound when the host is built**, with every source added whatever the order of the modules, and a
  wrong value fails `build()`, before anything starts. What needs the container built is a hosted service.
- **What starts is named, in order.** `start` takes one class per call, so the compiler checks each `inject`
  list, and the order of the statements is the order of startup. There is no collection of every hosted service.
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
