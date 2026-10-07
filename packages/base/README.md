# @caucejs/base

The bottom of Cauce: what every other package uses. It has **no dependencies** and uses **no runtime
API**, so it runs wherever JavaScript runs.

```bash
pnpm add @caucejs/base
```

## What is in it

| Export | What it is for |
|---|---|
| `CauceError` | The base of every error. Its `name` is the class that was thrown, and the cause travels in the native `cause` |
| `DomainError`, `ApplicationError` | The two families: a broken rule of the domain, and a failure that belongs to the application, such as authorization |
| `NotFoundError`, `InvalidArgumentError` | Generic errors with a default message, open to subclasses. `InvalidArgumentError` names the argument |
| `Clock`, `SystemClock` | The time as a service, so a test can fix it |
| `AsyncLocal` | The contract of a value that travels with asynchronous work. The implementation lives in a runtime adapter, such as `NodeAsyncLocal` in `@caucejs/node` |
| `MissingAsyncLocalError` | Reading an `AsyncLocal` outside of a `run()` |
| `StandardSchemaV1`, `StandardJSONSchemaV1` | The contracts of [Standard Schema](https://standardschema.dev): a schema that validates, and one that describes itself as JSON Schema. Copied from the spec, so no package depends on a validator |

Examples, in the fictitious domain of a conference: [`examples/tickets.ts`](examples/tickets.ts).

## Why it is built this way

- **Errors are thrown, and a failure the caller reacts to gets a type of its own.** A caller never
  reads a cause into a generic error's message. Both families live here, and not in the packages that
  raise them, so whoever translates errors —into HTTP statuses, for one— does not depend on those
  packages.
- **Nothing that a runtime or the language already has.** Cancellation is `AbortSignal`; closing what
  was opened is `Symbol.dispose` and `using`. Cauce does not wrap either.
- **A contract enters with a proven implementation.** `AsyncLocal` is here because the dependency
  injection and the request scope need it, and `@caucejs/node` implements it. The contracts of logging,
  events and serialization arrive with the first package that needs them.
- **`AsyncLocal`, not `AsyncContext`.** `AsyncContext` is the name of a TC39 proposal that may become a
  global; the same name here would collide with it.
- **`Clock` returns a `Date`, a new one on every call.** `Temporal` is not available in Node 24 yet.
