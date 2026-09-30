# Cauce

An extensible application framework for TypeScript. The name means *riverbed*: the channel every
request flows through.

Cauce aims to cover what an application needs around its domain — dependency injection,
configuration, hosting and modules, a use case bus with middlewares, web, data, background jobs and
AI — with a small core that others can extend without touching it.

> **Status: redesign in progress.** Releases `0.1.0` and `0.2.0` of `@caucejs/core` belong to an
> earlier functional design, and nothing from them is kept. There is no usable API yet.

## Principles

- **Object-oriented composition with functional building blocks.**
- **Strict TypeScript, without a single `any`.**
- **ESM only.** Node.js first, Bun later: the core does not import `node:*`, and runtime specifics live
  in adapters.
- **One package per module**, all released with the same version.
- **Wraps proven libraries where a problem is already solved**, and owns the composition and the
  application model.
- **Tests with hand-written test doubles**, not mocking libraries.

## Repository

A pnpm workspace orchestrated with Turborepo.

| Path | Package | Role |
| --- | --- | --- |
| `packages/core` | `@caucejs/core` | The core, being redesigned |
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
