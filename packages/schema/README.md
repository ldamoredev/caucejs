# @caucejs/schema

The JSON serializer of Cauce. It reads what comes from outside —a body, a form, the arguments of a tool— with a
schema from any library that implements [Standard Schema](https://standardschema.dev), into a typed value or a
`ValidationError` that says what is wrong with each field. It writes values back as JSON, and describes a schema as
JSON Schema, which is what a model gets for a tool.

```bash
pnpm add @caucejs/schema
```

```ts
class SellTickets {
    static readonly schema = z
        .strictObject({ talk: z.string().min(1), seats: z.int().positive() })
        .transform(({ talk, seats }) => new SellTickets(talk, seats))
    ...
}

services.add(jsonSerializer())

// what web does with every request, and the tools of a model with their arguments
const serializer = provider.get(JsonSerializer)
const request = await serializer.read(SellTickets, body)   // a SellTickets, or a ValidationError
serializer.write(response)                                  // JSON text
serializer.schemaOf(SellTickets)                            // the JSON Schema of what it takes
```

**An application rarely calls it.** It declares the `schema` of each request and adds the serializer; the module
that receives the input —`web` for a request, the tools of a model for their arguments— reads with it.

The canonical requests, to copy: [`examples/conference-requests.ts`](examples/conference-requests.ts).

## What is in it

| | |
|---|---|
| `JsonSerializer` | The contract: `read`, `write` and `schemaOf`. A test replaces it like any service |
| `DefaultJsonSerializer` | Reads with any Standard Schema, writes with `JSON.stringify`, describes with any Standard JSON Schema |
| `jsonSerializer()` | The extension that adds it: `services.add(jsonSerializer())` |
| `ValidationError` | What `read` throws: every issue, with its `path` joined by dots (`items.1.index`) and its `message`. On HTTP, a 400 |
| `JsonSchemaUnavailableError` | A schema that cannot describe itself: its library does not implement Standard JSON Schema, or it holds a transform |

The contracts themselves, `StandardSchemaV1` and `StandardJSONSchemaV1`, are in `@caucejs/base`.

## Why it is built this way

- **No schema language of its own.** Zod, Valibot and ArkType implement Standard Schema, so Cauce reads any of
  them and depends on none. The docs and the examples use Zod: it is the one that implements Standard JSON Schema
  out of the box and drops keys a schema does not have by default. Valibot describes itself through
  `toStandardJsonSchema` of `@valibot/to-json-schema`; ArkType keeps unknown keys unless the schema says
  `'+': 'reject'`.
- **A request of `@caucejs/application` declared with `Command.from(schema)` is read as the subclass it is**, methods
  of its own included: its class is marked for the compiler, so `read` returns the subclass instead of what the
  schema says it produces.
- **A class says how it is read.** Its `static readonly schema` produces an instance of it, usually with a
  `transform` that calls the constructor, so `read(SellTickets, body)` returns a `SellTickets`. The compiler checks
  that the schema produces that class, and the same serializer reads a web request and the arguments of a tool.
- **Every issue, with the library's message.** `ValidationError` keeps them in order, so a form can mark each field.
  An issue about the whole input has an empty path.
- **Reading is asynchronous**, because Standard Schema lets a schema validate asynchronously.
- **Writing needs no schema.** `write` is `JSON.stringify`, which calls `toJSON`, so a value of the domain writes itself: a `Money`
  returns `"10.50"`. Only one of the libraries can write back through its schema, and writing should not depend on
  which one an application picked.
- **A service, like the rest.** It is a `JsonSerializer` in the container, so `web` and the tools of a model get the
  same one, and a test can replace it.
- **A JSON Schema is never guessed.** `schemaOf` asks the library through Standard JSON Schema; a schema that
  does not implement it does not compile, and one that cannot say a side, such as the output of a transform, fails
  naming its library. Describe the input: that is what a model sends.
- **What a provider of models takes is not decided here.** Some refuse `oneOf`, which Zod writes for a
  discriminated union; adapting the schema to one belongs to the module that talks to it.
- **No coercion and no partial updates here.** A form or a query string arrives as strings, and the schema says
  how to convert them (`z.coerce.number()`). The three libraries tell a field that is missing from one sent as
  `null`, which is what a partial update needs.
- **Prefer strict objects for requests.** A field a request does not have is better refused than ignored.
