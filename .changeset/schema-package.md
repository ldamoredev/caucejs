---
"@caucejs/schema": minor
"@caucejs/base": minor
"@caucejs/config": patch
---

Add the schema package: a `JsonSerializer` in the container that reads input with any Standard Schema into what it produces, or into a `ValidationError` with every issue and its path; writes values as JSON; and describes a schema through Standard JSON Schema. The Standard Schema contracts move to `@caucejs/base`, with Standard JSON Schema next to them; `@caucejs/config` still exports the ones it had.
