# @caucejs/di

The dependency injection of Cauce. A class lists what its constructor needs, the compiler checks the
list, and the container builds the graph, scopes it per request or per job, and disposes what it built.

```bash
pnpm add @caucejs/di
```

```ts
class SqlTalks extends Talks {
    static readonly inject = [SqlClient, Clock] as const
    constructor(sql: SqlClient, clock: Clock) { ... }
}

const services = new Services()
    .add(clock(), ticketing({ capacity: 300 }))
    .addSingleton(Talks, SqlTalks)
    .addSingleton(SqlClient, () => new PoolSqlClient(url))
    .addScoped(CurrentAttendee, CurrentAttendee)
    .addTransient(SellTicket, SellTicket)

await using provider = services.build({ validate: true })
await using scope = provider.createScope()
scope.get(SellTicket)
```

The canonical extension, to copy: [`examples/ticketing.ts`](examples/ticketing.ts).

## What is in it

| | |
|---|---|
| `Services` | Where services are added: a class with `inject`, a factory, or an instance. Each token once; `replace` changes one, for tests |
| Lifetimes | `addSingleton`, `addScoped`, `addTransient` |
| `Provider` | Resolves, creates classes that were not added, opens scopes, and disposes its singletons |
| `Scope` | The services of one request or one job, disposed when it ends |
| `Extension` | How a package adds what it brings: `services.add(sql())` |
| `CompositionError` | The family of errors that say the application is composed wrong |

## Why it is built this way

- **A static `inject` list, not decorators.** TypeScript erases the types of a constructor. Decorators
  with metadata need `reflect-metadata`, which patches a built-in, record a `type` or a `string` as
  `Object` and `String`, and let the compiler check nothing. A list typed against the constructor makes
  the compiler refuse a wrong order, a missing argument or an implementation of another contract.
- **A factory, as an arrow function, for what is not a class of the application**, such as a connection
  pool. The container cannot see inside it.
- **Validation without building anything.** `build({ validate: true })` reads every `inject` list: a
  dependency never added, or a singleton that would capture a scoped service, fails before the first
  request, and no factory runs. It is meant for development and tests.
- **A token is added once.** A second `add` fails instead of letting the last one win, and `replace`
  says in the test what changes. Two implementations of a contract are two tokens: `abstract class
  SessionCache extends Cache {}`. There are no keys and no `getAll`: what is collected is named.
- **Scopes are explicit.** A scoped service is asked for to a scope, never to the root, and a singleton
  is always built outside of any scope, so it cannot capture one.
- **The container disposes what it built**, with `Symbol.dispose` and `Symbol.asyncDispose`, in reverse
  order of creation. An instance added with `addInstance` belongs to whoever built it.
- **Extensions declare what they need and never add it.** The application sees everything it runs, and
  the same extension added with other options fails, showing both.
- **No async factories.** What needs an `await` to start belongs to the host, not to the container.
- **Cycles between classes cannot be written**: an `inject` list that names a class declared later does
  not compile, and one across an import cycle fails when the module loads. A cycle through factories
  fails when it is resolved, with its path.
