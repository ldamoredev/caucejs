---
"@caucejs/application": minor
"@caucejs/schema": minor
"@caucejs/base": minor
---

Declare a request from its schema: `Command.from(schema)`, `Command.returning<R>().from(schema)` and `Query.returning<R>().from(schema)` give a request its read-only fields and constructor from what the schema produces, and a static `schema` that builds the subclass it is read through. `JsonSerializer.read` returns that subclass, through the new `BuiltBySchema` mark of `@caucejs/base`.
