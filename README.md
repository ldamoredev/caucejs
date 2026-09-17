# Cauce

Framework de aplicación en TypeScript, extensible. El cauce es el lecho por donde corre el agua; acá, el pipeline por donde fluye cada request.

El estado y el plan están en [STATUS.md](./STATUS.md).

## Monorepo

pnpm workspaces + Turborepo. El primer paquete público es [`@caucejs/core`](./packages/core).

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```
