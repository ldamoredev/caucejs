# @caucejs/node

The Node.js adapter of Cauce: the implementations of what `@caucejs/base` leaves to the runtime. It is
the only package that imports `node:*`.

```bash
pnpm add @caucejs/node
```

| Export | What it implements |
|---|---|
| `NodeAsyncLocal` | `AsyncLocal`, on `AsyncLocalStorage` from `node:async_hooks` |

Example, in the fictitious domain of a conference: [`examples/current-attendee.ts`](examples/current-attendee.ts).

## Why it is a package of its own

Cauce runs on Node first and Bun later. Keeping every runtime API in one adapter makes Bun one more
adapter instead of a rewrite. `AsyncLocalStorage` is implemented by Bun and Deno too, so this adapter
may serve them; whether it does has not been tested.
