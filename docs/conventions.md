# Conventions

How Cauce is written. [AGENTS.md](../AGENTS.md) has the summary and the goals; this is the full reference, with
the reason behind each rule. The examples use the fictitious domain of a conference: `Talk`, `Speaker`, `Ticket`.

## Extensions

A module adds what it brings to the container through an extension, without the container knowing it.

```ts
const services = new Services()
    .add(pool({ url: 'postgres://localhost/conference' }), sql(), jsonSerializer())
```

- **The extension is passed to the registry**: `services.add(sql())`. A free function, `addSql(services)`, reads
  inside out. A method added to `Services` needs a patched prototype.
- **No patched prototypes**, built-ins included. A file that forgets to import the patch still compiles and fails
  at runtime, and two packages that pick the same name both compile while the last import wins.
- **Declaration merging is allowed for types only**, when the runtime registration is explicit and its error names
  what is missing:

  ```ts
  declare module '@caucejs/config' {
      interface Sections {
          sql: SqlOptions
      }
  }
  ```

- **An extension declares what it needs in `requires`** and does not add it. The application sees everything it
  runs, and two extensions cannot each bring their own copy of a third one with different options.
- **Adding an extension twice is fail-if-different.** The same options do nothing; different ones fail and show
  both. Ignoring the second one would let an extension run against a pool it did not ask for, without a word.
- **The identity of an extension is a `Symbol`.** Its description is still used in messages.
- **A contract is an `abstract class`**, because a token has to exist at runtime. A repository is one more service:
  `provider.get(Talks)` is already typed, so there are no per-aggregate accessors.

## Builders and options

| Use | How |
|---|---|
| Configure options | **An object literal**: `run(agent, { maxSteps: 5 })` |
| Build a value with a vocabulary | **A callback that receives the builder**: `talk(t => t.keynote())` |
| A DSL of verbs | **The same**: `ensure(e => e.notBlank(title).positive(price))` |

- **Optional options are `url?: string`, without `| undefined`.** With `exactOptionalPropertyTypes`, a caller
  holding a `string | undefined` passes it as `...(url !== undefined && { url })`.
- **No function with a typed `this`.** Inside a class with a method of the same name it compiles and configures
  the class instead.
- **A builder step returns `this`, and only the code that received the callback calls `build()`**, so no builder
  is left unfinished.
- **A test scenario takes values the same way the container takes extensions**:

  ```ts
  const keynote = scenario.add(talk(t => t.keynote().title('Opening')))
  ```

  A step with logic or a collaborator is a method of the builder, which gets the collaborator from the container.

## Syntax

`erasableSyntaxOnly` stays on, so the compiler rejects enums, parameter properties and namespaces. Cauce is
published compiled and does not need to run without a build; the option stays because it is the only thing that
enforces those rules, with no linter in CI.

```ts
class SqlTalks implements Talks {
    readonly #sql: SqlClient
    readonly #clock: Clock

    constructor(sql: SqlClient, clock: Clock) {
        this.#sql = sql
        this.#clock = clock
    }
}

export const TicketTypes = { Regular: 'regular', Student: 'student' } as const
export type TicketType = (typeof TicketTypes)[keyof typeof TicketTypes]
```

Decorators compile with the option and do not run without a build. Whether Cauce uses them is decided by `di`.

## Classes and functions

- **What is passed as a value is a function that returns an object**: `sql()`, `pool()`, `talk()`.
- **What has state or collaborators is a class**: `Services`, `SqlTalks`, `TalkBuilder`.
- **A one-method dependency is still an `abstract class`**, not a function type, because it has to be a token.
- **Private fields use `#`**, which is private at runtime and not only for the compiler.
- **Everything is `readonly` by default.** A change of state returns a new object.

## Errors

- **Errors are thrown**, and every error extends one of Cauce's base errors: `DomainError` for the rules of a
  domain, `ApplicationError` for what belongs to the application, such as authorization.
- **Generic errors are open and have a default message**, and are extended when a caller needs more:
  `NotFoundError`, `InvalidArgumentError` with the name of the argument.
- **A failure the caller reacts to has an error type of its own**, with a fixed message. The caller never reads a
  cause into a generic error.
- **The cause travels in the native `cause`**, never in a field of its own.
- **One file per error**, even when it is three lines long.
- **Named `*Error`, never `*Exception`.**
- **What a method can throw is said by its tests**: one test for each error a caller needs to tell apart.

```ts
export class SoldOutError extends DomainError {
    constructor(options?: ErrorOptions) {
        super('The talk has no seats left', options)
    }
}
```

## Naming

- **The noun for the contract, an adjective for the implementation**: `Talks`, `SqlTalks`, `InMemoryTalks`.
- `Default*` for the main implementation, `Null*` for a production no-op.
- **`find*` returns `null`; `get*` throws.**
- **No `Interface` suffix.**

## Comments and docs

- **A comment says why, or it is not written.** It never restates the code.
- **Public API gets TSDoc**: what it is for, what it costs, what it does in the surprising case. Not
  `/** Gets the name. */`.
- **The reasons behind a design go in the module's `README.md`**, which is written for a person and for an agent.
- **Examples may carry comments that explain**, because they exist to teach.

## Tests

- **Every change comes with tests** for the behavior it adds or changes.
- **No mocking library.** Test doubles are fakes written by hand. Verifying an interaction through a fake is fine:
  a fake factory that keeps the URLs it was given, and `expect(factory.urls).toEqual([...])`.
- **The tests come first in the file, and the scaffolding at the bottom.**
- **Every new extension or service is built through `Services` by at least one test**, not by hand. A test that
  builds the object directly cannot see that it was never registered.
- **Examples compile in CI.**
