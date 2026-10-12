# @caucejs/application

## 0.5.0

### Minor Changes

- [#17](https://github.com/ldamoredev/caucejs/pull/17) [`7005913`](https://github.com/ldamoredev/caucejs/commit/70059132e455f88db2340c219118b7744b21874d) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Declare a request from its schema: `Command.from(schema)`, `Command.returning<R>().from(schema)` and `Query.returning<R>().from(schema)` give a request its read-only fields and constructor from what the schema produces, and a static `schema` that builds the subclass it is read through. `JsonSerializer.read` returns that subclass, through the new `BuiltBySchema` mark of `@caucejs/base`.

### Patch Changes

- Updated dependencies [[`7005913`](https://github.com/ldamoredev/caucejs/commit/70059132e455f88db2340c219118b7744b21874d), [`27ba1fe`](https://github.com/ldamoredev/caucejs/commit/27ba1fe2033e400ea75ddb698dc64876827224fc)]:
  - @caucejs/base@0.5.0
  - @caucejs/di@0.5.0

## 0.4.0

### Minor Changes

- [#14](https://github.com/ldamoredev/caucejs/pull/14) [`d9bce31`](https://github.com/ldamoredev/caucejs/commit/d9bce3115fc1b40c3b65b295b193f040c1779a36) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add the application package: requests with a typed result, handlers paired by hand and built by the container for every execution, middlewares that run in the order they are written, an immutable execution context, identities, and an authorization middleware closed by default.

### Patch Changes

- Updated dependencies []:
  - @caucejs/base@0.4.0
  - @caucejs/di@0.4.0
