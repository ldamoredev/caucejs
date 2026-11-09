# @caucejs/tools

The tools of Cauce. A tool is a use case of `@caucejs/application`, described once with a name and a description,
and the same tool is exposed by a server of MCP and given to a model. `ToolRunner` describes it with the JSON Schema
of its input, and calls it the way `web` calls a route: reads the input with the `JsonSerializer` and executes the
request through every middleware, as whoever called it. What fails comes back as a message for the caller to read.

```bash
pnpm add @caucejs/tools
```

```ts
class SellTicket extends Command.returning<number>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly permissions = ['tickets']
}

export const sellTicket = tool(SellTicket, { name: 'sell_ticket', description: 'Sells one seat of a talk, and answers the seats left' })

// in a module, as statements
app.services.add(tools())
app.useCases.use(Authorization)
app.useCases.handle(SellTicketHandler)

// what a server of MCP or a model does with it
const runner = provider.get(ToolRunner)
runner.describe(sellTicket)        // { name, description, inputSchema, readOnly: false }
await runner.call(sellTicket, { talkId: 'opening' }, { scope, context })
// { ok: true, value: 0, json: '0' }, or { ok: false, message: 'The talk has no seats left', error }
```

**An application rarely calls the runner.** It declares its tools and adds `tools()`; `@caucejs/mcp` and
`@caucejs/ai` describe and call them.

The canonical tools, to copy: [`examples/conference-tools.ts`](examples/conference-tools.ts).

## What is in it

| | |
|---|---|
| `tool` | Describes a use case as a tool: `tool(GetTalk, { name, description, readOnly? })`. Throws `InvalidArgumentError` for a name that is not 1 to 128 letters, digits, underscores and hyphens |
| `UseCaseTool` | What `tool` returns: the class of the request, the name, the description and `readOnly` |
| `ToolRequestClass` | A class of request that can be a tool: its `schema` reads it and says what it takes as JSON Schema |
| `ToolRunner` | `describe(tool)` says what the tool takes; `call(tool, input, { scope, context })` runs it and answers a `ToolOutcome` |
| `DefaultToolRunner` | The runner, on `UseCases` and the `JsonSerializer` |
| `ToolDescription` | What the caller is told: `name`, `description`, `inputSchema` and `readOnly` |
| `ToolOutcome` | `{ ok: true, value, json }`, or `{ ok: false, message, error }` |
| `tools()` | The extension that adds the `ToolRunner`: `services.add(tools())` |

## Why it is built this way

- **A tool is always a use case.** It is described by the request the application already has, so it runs through
  the same middlewares as a web request, authorization and logging included, and a use case is written once for
  `web`, for MCP and for a model. There are no tools written by hand: what needs no use case needs no tool yet.
- **One package for both.** `@caucejs/mcp` and `@caucejs/ai` depend on this one, so a server of MCP does not bring
  the client of a model, and a model does not bring Hono.
- **The compiler refuses a request that cannot be described.** `tool` takes a request whose `schema` implements
  Standard JSON Schema, as `Command.from` with Zod does. What the compiler cannot see, such as a `bigint`, fails in
  `describe` with `JsonSchemaUnavailableError`.
- **The name is checked when the tool is made**, with the rule of the API of Anthropic: 1 to 128 letters, digits,
  underscores and hyphens. A tool with a bad name fails when the module that declares it loads, not when a model
  first sees it.
- **`readOnly` comes from the request.** A `Query` only reads and a `Command` changes something; the tool says
  otherwise when it is told to. A server of MCP passes it to its clients as a hint.
- **`inputSchema` is what `JsonSerializer.schemaOf` returns, `$schema` included.** Adapting it to what a provider
  takes belongs to the module that talks to that provider.
- **`describe` keeps nothing.** It works the description out on every call, which costs one `schemaOf`, nothing
  next to a call to a model; whoever lists the tools often keeps them, as a server of MCP does when it is built. A
  description kept by the runner would be one object shared by every caller, and changing it would change it for all.
- **`call` returns what failed instead of throwing it**, because a model or a client of MCP has to read why a call
  failed to try again. What it reads follows `web`: what `web` answers with a 4xx and its message, the caller reads;
  what `web` hides behind a 500, it does not.

  | Thrown | `message` |
  |---|---|
  | `ValidationError`, from the input or from inside the use case | Its message, with every issue: `The input is not valid: talkId: Too small: …; Unrecognized key: "price"` |
  | A `DomainError`, `NotFoundError` included, or a `ForbiddenError` | Its message, or its name when the message is empty |
  | Anything else, a use case without a handler included | `Tool execution failed` |
  | `NotAuthenticatedError` | Thrown: nobody was there to read the answer, and whoever exposes the tool answers it, as a 401 |

  `error` keeps what was thrown, for the application to log; it never reaches the caller. **A status the application
  gives an error with `app.web.status(...)` does not reach here**: an error that is not a `DomainError` reads as
  `Tool execution failed` from a tool even when `web` answers it with a 4xx. Make it a `DomainError` when the caller
  of a tool has to read it.
- **A use case that answers nothing answers `undefined`, written as `null`.** `json` is always the JSON text the
  serializer writes; whoever wants to say "Done." looks at `value`.
- **`tools()` declares no `requires`.** The runner asks for `UseCases` and the `JsonSerializer` in `inject`, and a
  container built with `validate`, as a web application always is, names whichever is missing:
  `ToolRunner needs UseCases, which was never added`. A web application adds both without the extensions that add
  them elsewhere, so requiring those extensions would fail where nothing is missing.
- **The scope and the context come from whoever calls**, as with `UseCases.execute`: a server of MCP passes the scope
  of the request and the identity of its token, and a model passes the ones of the use case that asked it.
