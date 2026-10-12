# @caucejs/di

## 0.6.0

### Minor Changes

- [#18](https://github.com/ldamoredev/caucejs/pull/18) [`a032f1b`](https://github.com/ldamoredev/caucejs/commit/a032f1baf304bbb2e2b0dd0abfeab44f12a9b4ee) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add the web package, on Hono: controllers whose routes are use cases, declared with the class of their request and checked against its path; one DI scope and one identity per request through an `Authenticator`; the path, the query and the body read as one object, refusing a field that comes from two of them; problems as RFC 9457; and the `fetch` of the application. `@caucejs/di` now provides `Scopes`, which opens scopes from a class that cannot be handed the provider.

### Patch Changes

- Updated dependencies []:
  - @caucejs/base@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [[`7005913`](https://github.com/ldamoredev/caucejs/commit/70059132e455f88db2340c219118b7744b21874d), [`27ba1fe`](https://github.com/ldamoredev/caucejs/commit/27ba1fe2033e400ea75ddb698dc64876827224fc)]:
  - @caucejs/base@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @caucejs/base@0.4.0

## 0.3.0

### Minor Changes

- [#7](https://github.com/ldamoredev/caucejs/pull/7) [`d057c30`](https://github.com/ldamoredev/caucejs/commit/d057c306873303f1efd8442aaf501b3783019f23) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add `@caucejs/di`: services declared with a typed `inject` list or a factory, three lifetimes, scopes that dispose what they built, extensions with `requires` and fail-if-different, `replace` for tests, and validation of the graph without building it.

### Patch Changes

- Updated dependencies [[`3ea0249`](https://github.com/ldamoredev/caucejs/commit/3ea02496bd71b465e0f0f833ea8b2b404c7b109e)]:
  - @caucejs/base@0.3.0
