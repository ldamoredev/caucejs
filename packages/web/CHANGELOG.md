# @caucejs/web

## 0.6.0

### Minor Changes

- [#18](https://github.com/ldamoredev/caucejs/pull/18) [`a032f1b`](https://github.com/ldamoredev/caucejs/commit/a032f1baf304bbb2e2b0dd0abfeab44f12a9b4ee) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add the web package, on Hono: controllers whose routes are use cases, declared with the class of their request and checked against its path; one DI scope and one identity per request through an `Authenticator`; the path, the query and the body read as one object, refusing a field that comes from two of them; problems as RFC 9457; and the `fetch` of the application. `@caucejs/di` now provides `Scopes`, which opens scopes from a class that cannot be handed the provider.

### Patch Changes

- Updated dependencies [[`a032f1b`](https://github.com/ldamoredev/caucejs/commit/a032f1baf304bbb2e2b0dd0abfeab44f12a9b4ee)]:
  - @caucejs/di@0.6.0
  - @caucejs/application@0.6.0
  - @caucejs/schema@0.6.0
  - @caucejs/base@0.6.0
