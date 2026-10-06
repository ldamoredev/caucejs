# @caucejs/node

## 0.3.0

### Minor Changes

- [#5](https://github.com/ldamoredev/caucejs/pull/5) [`3ea0249`](https://github.com/ldamoredev/caucejs/commit/3ea02496bd71b465e0f0f833ea8b2b404c7b109e) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add `@caucejs/base`, with the base errors, the clock and the `AsyncLocal` contract, and `@caucejs/node`, with `NodeAsyncLocal`.

- [#8](https://github.com/ldamoredev/caucejs/pull/8) [`f969b9f`](https://github.com/ldamoredev/caucejs/commit/f969b9fe71d2cb493ebc942697c4fcc4ccc49135) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add `@caucejs/config`: sources stacked in order (`memory`, `json`, `environment`), and settings classes validated with any Standard Schema while the application is composed, with errors that name the path and the source and never the value. `@caucejs/node` adds `jsonFile` and `dotenvFile`.

- [#9](https://github.com/ldamoredev/caucejs/pull/9) [`cfb2da0`](https://github.com/ldamoredev/caucejs/commit/cfb2da0c48278aff523c30779c6d07493d572121) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add `@caucejs/hosting`: a builder with the environment, the configuration and the container; hosted services that start in the order listed and stop in reverse within a timeout; a container validated in every environment; and a `Lifetime` contract. `@caucejs/node` adds `ProcessLifetime`, on `SIGINT` and `SIGTERM`, and `standardSources`. `Config.add` takes several sources at once.

### Patch Changes

- Updated dependencies [[`3ea0249`](https://github.com/ldamoredev/caucejs/commit/3ea02496bd71b465e0f0f833ea8b2b404c7b109e), [`f969b9f`](https://github.com/ldamoredev/caucejs/commit/f969b9fe71d2cb493ebc942697c4fcc4ccc49135), [`cfb2da0`](https://github.com/ldamoredev/caucejs/commit/cfb2da0c48278aff523c30779c6d07493d572121)]:
  - @caucejs/base@0.3.0
  - @caucejs/config@0.3.0
  - @caucejs/hosting@0.3.0
