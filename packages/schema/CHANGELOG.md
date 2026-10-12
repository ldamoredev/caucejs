# @caucejs/schema

## 0.5.0

### Minor Changes

- [#17](https://github.com/ldamoredev/caucejs/pull/17) [`7005913`](https://github.com/ldamoredev/caucejs/commit/70059132e455f88db2340c219118b7744b21874d) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Declare a request from its schema: `Command.from(schema)`, `Command.returning<R>().from(schema)` and `Query.returning<R>().from(schema)` give a request its read-only fields and constructor from what the schema produces, and a static `schema` that builds the subclass it is read through. `JsonSerializer.read` returns that subclass, through the new `BuiltBySchema` mark of `@caucejs/base`.

- [#15](https://github.com/ldamoredev/caucejs/pull/15) [`27ba1fe`](https://github.com/ldamoredev/caucejs/commit/27ba1fe2033e400ea75ddb698dc64876827224fc) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add the schema package: a `JsonSerializer` in the container that reads input with any Standard Schema into what it produces, or into a `ValidationError` with every issue and its path; writes values as JSON; and describes a schema through Standard JSON Schema. The Standard Schema contracts move to `@caucejs/base`, with Standard JSON Schema next to them; `@caucejs/config` still exports the ones it had.

### Patch Changes

- Updated dependencies [[`7005913`](https://github.com/ldamoredev/caucejs/commit/70059132e455f88db2340c219118b7744b21874d), [`27ba1fe`](https://github.com/ldamoredev/caucejs/commit/27ba1fe2033e400ea75ddb698dc64876827224fc)]:
  - @caucejs/base@0.5.0
  - @caucejs/di@0.5.0
