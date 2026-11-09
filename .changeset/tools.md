---
"@caucejs/tools": minor
"@caucejs/application": minor
---

Add `@caucejs/tools`: a use case described once as a tool with `tool(GetTalk, { name, description })`, and a `ToolRunner` that describes it with the JSON Schema of its input and calls it through every middleware, answering what failed for the caller to read. Add `UseCases.handles(request)` to `@caucejs/application`, to know whether a class of request has a handler.
