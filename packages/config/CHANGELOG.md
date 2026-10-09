# @caucejs/config

## 0.5.0

### Patch Changes

- [#15](https://github.com/ldamoredev/caucejs/pull/15) [`27ba1fe`](https://github.com/ldamoredev/caucejs/commit/27ba1fe2033e400ea75ddb698dc64876827224fc) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add the schema package: a `JsonSerializer` in the container that reads input with any Standard Schema into what it produces, or into a `ValidationError` with every issue and its path; writes values as JSON; and describes a schema through Standard JSON Schema. The Standard Schema contracts move to `@caucejs/base`, with Standard JSON Schema next to them; `@caucejs/config` still exports the ones it had.

- Updated dependencies [[`7005913`](https://github.com/ldamoredev/caucejs/commit/70059132e455f88db2340c219118b7744b21874d), [`27ba1fe`](https://github.com/ldamoredev/caucejs/commit/27ba1fe2033e400ea75ddb698dc64876827224fc)]:
  - @caucejs/base@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @caucejs/base@0.4.0

## 0.3.0

### Minor Changes

- [#8](https://github.com/ldamoredev/caucejs/pull/8) [`f969b9f`](https://github.com/ldamoredev/caucejs/commit/f969b9fe71d2cb493ebc942697c4fcc4ccc49135) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add `@caucejs/config`: sources stacked in order (`memory`, `json`, `environment`), and settings classes validated with any Standard Schema while the application is composed, with errors that name the path and the source and never the value. `@caucejs/node` adds `jsonFile` and `dotenvFile`.

- [#9](https://github.com/ldamoredev/caucejs/pull/9) [`cfb2da0`](https://github.com/ldamoredev/caucejs/commit/cfb2da0c48278aff523c30779c6d07493d572121) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add `@caucejs/hosting`: a builder with the environment, the configuration and the container; hosted services that start in the order listed and stop in reverse within a timeout; a container validated in every environment; and a `Lifetime` contract. `@caucejs/node` adds `ProcessLifetime`, on `SIGINT` and `SIGTERM`, and `standardSources`. `Config.add` takes several sources at once.

### Patch Changes

- Updated dependencies [[`3ea0249`](https://github.com/ldamoredev/caucejs/commit/3ea02496bd71b465e0f0f833ea8b2b404c7b109e)]:
  - @caucejs/base@0.3.0
