# @caucejs/web

## 0.7.0

### Minor Changes

- [#22](https://github.com/ldamoredev/caucejs/pull/22) [`4f9a9f7`](https://github.com/ldamoredev/caucejs/commit/4f9a9f7f5aaeaa645dce5c306862e37a5177c461) Thanks [@ldamoredev](https://github.com/ldamoredev)! - A route that is a use case can answer a page: `routes.get('/talks/:id', GetTalk, { html: talk => page(talk) })` writes the HTML from the result and the request.

### Patch Changes

- Updated dependencies [[`83d1c3c`](https://github.com/ldamoredev/caucejs/commit/83d1c3c7328136bb1e3a63cf234279e69dafde33), [`d76b129`](https://github.com/ldamoredev/caucejs/commit/d76b129e807391d26bf8f83d2335871f5e38e1ec)]:
  - @caucejs/application@0.7.0
  - @caucejs/di@0.7.0
  - @caucejs/schema@0.7.0
  - @caucejs/base@0.7.0

## 0.6.0

### Minor Changes

- [#18](https://github.com/ldamoredev/caucejs/pull/18) [`a032f1b`](https://github.com/ldamoredev/caucejs/commit/a032f1baf304bbb2e2b0dd0abfeab44f12a9b4ee) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add the web package, on Hono: controllers whose routes are use cases, declared with the class of their request and checked against its path; one DI scope and one identity per request through an `Authenticator`; the path, the query and the body read as one object, refusing a field that comes from two of them; problems as RFC 9457; and the `fetch` of the application. `@caucejs/di` now provides `Scopes`, which opens scopes from a class that cannot be handed the provider.

### Patch Changes

- Updated dependencies [[`a032f1b`](https://github.com/ldamoredev/caucejs/commit/a032f1baf304bbb2e2b0dd0abfeab44f12a9b4ee)]:
  - @caucejs/di@0.6.0
  - @caucejs/application@0.6.0
  - @caucejs/schema@0.6.0
  - @caucejs/base@0.6.0
