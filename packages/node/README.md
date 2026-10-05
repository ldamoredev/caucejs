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

Example, in the fictitious domain of a conference: [`examples/current-attendee.ts`](examples/current-attendee.ts).

## Why it is a package of its own

Cauce runs on Node first and Bun later. Keeping every runtime API in one adapter makes Bun one more
adapter instead of a rewrite. `AsyncLocalStorage` is implemented by Bun and Deno too, so this adapter
may serve them; whether it does has not been tested.
