# AGENTS.md

Cauce is an application framework for TypeScript: dependency injection, configuration, hosting and modules,
a use case bus with middlewares, web, data, background jobs and AI, around a small core that others extend
without touching it.

## The goals

Three goals decide every design question. When two options are otherwise equal, pick the one that serves them
better.

1. **Nothing happens that the application did not write.** No discovery, no scanning, no patched prototypes,
   no extension that silently brings another one. Reading the composition of an application tells you what it
   runs.
2. **Fail early and say why.** A wrong composition fails when the application is built, not on the first
   request, and the error names what is missing or what conflicts.
3. **The compiler enforces what it can; the runtime enforces the rest.** A rule that is only written down is
   caught only by a reviewer.

## Before you change anything

Read the document that governs the change first. This file is a summary; the rules, with their reasons and
examples, live in the documents it points to.

| If you are going to | Read first |
|---|---|
| Write any code | [docs/conventions.md](docs/conventions.md) |
| Build or change a module | Its design sheet, if `.dev/` exists (see below), then the module's `README.md` |
| Start an application, or run something with it | [`packages/hosting/README.md`](packages/hosting/README.md) and its canonical example |
| Read configuration | [`packages/config/README.md`](packages/config/README.md) and its canonical example |
| Register services or write an extension | [The section below](#services-and-extensions), [`packages/di/README.md`](packages/di/README.md) and its canonical example |
| Write tests | "Tests" in [docs/conventions.md](docs/conventions.md#tests) |
| Open a pull request | [Workflow](#workflow), and the `review` skill |

**The design sheets.** If a `.dev/` folder exists at the root, it holds the design sheet of each module, at
`.dev/hojas/<module>.md`. It is local, not part of the repository, and written in Spanish. **When a sheet and the
public docs disagree, the sheet wins**: build what the sheet says and update the public docs in the same pull
request.

## Services and extensions

This is the part of Cauce most likely to be misread, because it works the opposite way from most containers.
**Copy [`packages/di/examples/ticketing.ts`](packages/di/examples/ticketing.ts)**, the canonical extension, and
read [`packages/di/README.md`](packages/di/README.md) before designing any registration.

```ts
class SqlTalks extends Talks {
    static readonly inject = [SqlClient, Clock] as const
    constructor(sql: SqlClient, clock: Clock) { ... }
}

const services = new Services()
    .add(clock(), ticketing({ capacity: 300 }))
    .addSingleton(Talks, SqlTalks)
    .addSingleton(SqlClient, () => new PoolSqlClient(url))

// a repository is one more service, and its abstract class is the token
const talks = services.build({ validate: true }).get(Talks)
```

- **A class built by the container lists its constructor in `static readonly inject`**, in order. The
  compiler checks the list against the constructor. No decorators, no `reflect-metadata`.
- **A factory, written as an arrow function, is only for what is not a class of the application.** The
  container cannot see inside it, so the validation cannot either.
- **A token is added once.** Adding it again fails; a test changes it with `replace`. Two implementations of
  a contract are two tokens, never keys.

- **The verb is on the registry, the extension is a noun**: `services.add(sql())`, never `addSql(services)` nor
  `services.addSql()`.
- **An extension declares what it needs in `requires`, and never adds it itself.** The application adds every
  extension it runs. `requires` is checked when the container is built, so the order of `add` does not matter,
  and a missing one fails with its name: `sql needs pool, which was never added`.
- **Adding the same extension twice is fail-if-different**: same options, nothing happens; different options,
  it fails and shows both.
- **An extension's identity is a `Symbol`**, so two packages that both say `sql` are two different extensions.
- **A contract is an `abstract class`**, because a token has to exist at runtime.

## Rules that break habit

These are the rules an agent gets wrong by doing what is usual in TypeScript. The full list, with reasons, is in
[docs/conventions.md](docs/conventions.md).

- **Never patch a prototype**, built-ins included. Declaration merging is allowed for types only, when the
  runtime registration is explicit.
- **Options are an object literal**: `run(agent, { maxSteps: 5 })`. Optional options are `url?: string`, without
  `| undefined`.
- **Builders take a callback that receives the builder**: `talk(t => t.keynote().title('Opening'))`. Every step
  returns `this`, and only the code that passed the callback calls `build()`. **No functions with a typed
  `this`.**
- **What is passed as a value is a function that returns an object** (`sql()`, `talk()`); **what has state or
  collaborators is a class** (`Services`, `SqlTalks`). A one-method dependency is still an `abstract class`.
- **Private fields use `#`**, not `private`. Everything is `readonly` unless it has a reason not to be; a change
  of state returns a new object.
- **Errors are thrown, and extend Cauce's base errors.** One file per error. A failure the caller reacts to has
  an error type of its own. Named `*Error`, never `*Exception`.
- **Names**: the noun for the contract and an adjective for the implementation (`Talks`, `SqlTalks`,
  `InMemoryTalks`). `find*` returns `null`, `get*` throws. No `Interface` suffix.
- **No mocking library.** Test doubles are fakes written by hand, and verifying an interaction through a fake is
  fine.

The compiler already rejects enums, parameter properties and namespaces (`erasableSyntaxOnly`). Use an `as const`
object for an enum, and declare fields and assign them in the constructor.

## Always

- **No `any`.** ESM only.
- **No package imports `node:*` except the runtime adapters**, such as `@caucejs/node`. What depends on a
  runtime lives in an adapter, so Bun is one more adapter and not a rewrite. `base` builds without Node types,
  so its build refuses the import.
- **One package per module** (`@caucejs/<module>`), all released with the same version: a new package
  goes into the `fixed` group of `.changeset/config.json`.
- **No new dependency without a reason** written in the pull request.
- **A comment says why, or it is not written.** Public API gets TSDoc: what it is for, what it costs, what it does
  in the surprising case. The reasons behind a design go in the module's `README.md`, not in the code.
- **Examples are code**: they use the fictitious domain of a conference (`Talk`, `Speaker`, `Ticket`), they
  compile in CI, and unlike the code they may carry comments that explain.

## Workflow

Node 24 (`.node-version`) and pnpm 11.

1. **Create a branch from `main`.** Commit on it as you go, one line per commit, in English.
2. **Every change comes with tests** for the behavior it adds or changes.
3. **Before opening the pull request, run what CI runs**, and fix it until it passes:

   ```bash
   pnpm typecheck && pnpm test && pnpm build
   ```

4. **Then review your own change with the `review` skill**, fix what it finds and run step 3 again.
5. **Add a changeset** (`pnpm changeset`) with the bump you propose. The reviewer decides the final one.
6. **Open the pull request.** Say what changed, what you ran and what it printed, and what you did not do.

**Never merge**, neither your pull request nor the *Version Packages* one: merging that one publishes to npm.

**This repository is public.** Nothing from `.dev/` is copied into it beyond what a decision needs, and the
projects and people the sheets mention are never named.
