# @caucejs/application

The use case bus of Cauce. A request says what it answers, a handler executes it, and middlewares wrap every
execution in the order they are written. The container builds each handler and middleware for every execution, in
the scope of that execution, so a missing dependency fails when the application is built.

```bash
pnpm add @caucejs/application
```

```ts
class SellTicket extends Command.returning<number>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly permissions = ['tickets']
}

class SellTicketHandler extends Handler<SellTicket> {
    static readonly inject = [Talks] as const
    constructor(talks: Talks) { ... }
    async execute(request: SellTicket, context: ExecutionContext): Promise<number> { ... }
}

services.add(application(app => app.use(Authorization).handle(SellTicket, SellTicketHandler)))

await using scope = provider.createScope()
const left = await provider.get(UseCases).execute(new SellTicket({ talkId: 'opening' }), { scope, context: ExecutionContext.of(boxOffice) })
```

The canonical use cases, to copy: [`examples/conference-use-cases.ts`](examples/conference-use-cases.ts).

## What is in it

| | |
|---|---|
| `Command`, `Query`, `Request` | What a use case is asked to do. `Command<R = void>` changes something, `Query<R>` only reads |
| `Command.from`, `Command.returning<R>().from`, `Query.returning<R>().from` | A request declared from its schema: its fields and its constructor come from what the schema produces |
| `Handler` | Executes one kind of request, with the context of the execution |
| `Middleware` | Wraps every execution: `execute(request, context, next)` |
| `application` | The extension: `use` adds middlewares, in order; `handle` pairs a request with its handler |
| `UseCases` | Executes a request: `execute(request, { scope, context })` |
| `ExecutionContext`, `ContextKey` | Who executes, and values under typed keys. It never changes |
| `Identity`, `AnonymousIdentity`, `SystemIdentity` | Who executes. The application writes its own |
| `Authorization` | The middleware that refuses nobody (401) and who cannot (403), closed by default |
| `NotAuthenticatedError`, `ForbiddenError` | What `Authorization` throws, for `web` to turn into a status |
| `HandlerNotAddedError`, `ContextValueMissingError` | A request without a handler, a context without a value |

## Why it is built this way

- **The compiler knows what a request answers.** `Request<R>` declares a field that only exists for the compiler,
  so `execute(new GetTalk(id))` is a `Promise<Talk>` and `handle` refuses a handler that answers something else.
  Two request classes with the same fields are the same type to the compiler, though: give each request a field of
  its own when a handler could be paired with the wrong one.
- **A request is declared once, from its schema**, the way a data class is: `Command.from(schema)` gives the class
  its read-only fields and a constructor that takes them, and a static `schema` that validates with the schema
  given and builds the subclass it is read through, so the JSON serializer of `@caucejs/schema` reads it and returns
  that class, methods of its own included. It describes itself as JSON Schema when the schema given does. The
  result goes first: `Command.returning<TicketId>().from(schema)`. A request built in code with `new` is not
  validated: the schema is for what comes from outside. Any Standard Schema works; the examples use Zod. A request
  can still be written by hand, extending `Command<R>`.
- **A handler is paired by hand, and once.** TypeScript cannot read at runtime which request a handler takes, and
  discovering handlers is what Cauce does not do. A second handler for the same request fails; a test changes a
  handler with `services.replace`.
- **The container builds handlers and middlewares, for every execution.** `handle` and `use` add them as transient
  services, so `build({ validate: true })` checks their constructors before the first request, and they can ask for
  what lives per request.
- **The order written is the order they run.** The first middleware is the outermost one and the last runs right
  before the handler. There are no priorities.
- **`next()` never takes another request.** It may take another context: that is how a middleware that
  authenticates says who executes what comes after it.
- **The scope comes from whoever executes.** A web request, a job or a test opens one and passes it; the bus never
  opens its own, so a use case that executes another stays in the same scope. The provider itself works as the
  scope while no handler asks for a scoped service, and if one does, the container says so.
- **The context carries nothing of HTTP.** The code that receives a request turns a cookie or a header into an
  identity before it executes the use case, so the same use case runs from a job.
- **Authorization is closed by default.** With `Authorization` in the pipeline, a request runs only for an
  authenticated identity unless its class says `static readonly anonymous = true`, and `static readonly
  permissions = [...]` needs an identity that can do one of them. A request whose author forgot to say anything is
  closed, not open. `SystemIdentity` can do everything.
- **No logging, validation or transaction middleware yet.** They come with the modules they belong to. A logging
  middleware that writes the whole request also writes its secrets: name the fields it logs.
