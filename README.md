# Cauce

An extensible application framework for TypeScript. The name means *riverbed*: the channel every
request flows through.

Cauce aims to cover what an application needs around its domain — dependency injection,
configuration, hosting and modules, a use case bus with middlewares, web, data, background jobs and
AI — with a small core that others can extend without touching it.

> **Status: redesign in progress.** The first package of the new design is `@caucejs/base`. Releases
> `0.1.0` and `0.2.0` of `@caucejs/core` belong to an earlier functional design, and nothing from them
> is kept.

## Principles

- **Object-oriented composition with functional building blocks.**
- **Strict TypeScript, without a single `any`.**
- **ESM only.** Node.js first, Bun later: no package imports `node:*` except the runtime adapters, so
  runtime specifics live in one place.
- **One package per module**, all released with the same version.
- **Wraps proven libraries where a problem is already solved**, and owns the composition and the
  application model.
- **Tests with hand-written test doubles**, not mocking libraries.

## Repository

A pnpm workspace orchestrated with Turborepo.

| Path | Package | Role |
| --- | --- | --- |
| `packages/base` | `@caucejs/base` | The errors, the clock and the `AsyncLocal` contract. No dependencies |
| `packages/node` | `@caucejs/node` | The Node.js adapter: what the other packages leave to the runtime |
| `packages/di` | `@caucejs/di` | The dependency injection: a registry checked by the compiler, lifetimes, scopes and extensions |
| `packages/config` | `@caucejs/config` | The configuration: layered sources, and settings classes validated with any Standard Schema |
| `packages/hosting` | `@caucejs/hosting` | The host: the builder, what starts and stops with the application, and its environment |
| `packages/application` | `@caucejs/application` | The use case bus: requests with a typed result, handlers and middlewares built per execution, and authorization |
| `packages/schema` | `@caucejs/schema` | The JSON serializer: reads input with any Standard Schema into a typed value or a `ValidationError`, writes JSON, and describes a schema for a model |
| `packages/testing` | `@caucejs/testing` | What a test needs: examples without randomness, a scenario that builds and saves, a client that calls the application in memory |
| `packages/typescript-config` | `@caucejs/typescript-config` | Shared TypeScript configuration. Private, not published |

## Development

Requires Node.js 24 (see `.node-version`) and pnpm 11.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## License

[MIT](./LICENSE)
