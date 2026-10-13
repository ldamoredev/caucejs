# @caucejs/node

## 0.7.0

### Minor Changes

- [#22](https://github.com/ldamoredev/caucejs/pull/22) [`878e9f5`](https://github.com/ldamoredev/caucejs/commit/878e9f5f0f9288ad2f05d76230e94bb3b5d74192) Thanks [@ldamoredev](https://github.com/ldamoredev)! - `WebApplication.builder()` starts a web application with the usual defaults: the environment from `NODE_ENV`, the standard sources with `PORT`, the serializer, the use cases, the web and the server, started last. `run()` says where it listens and stops on `SIGINT` or `SIGTERM`.

### Patch Changes

- Updated dependencies [[`83d1c3c`](https://github.com/ldamoredev/caucejs/commit/83d1c3c7328136bb1e3a63cf234279e69dafde33), [`ddb92f3`](https://github.com/ldamoredev/caucejs/commit/ddb92f3b1e92b6326a13368bed71e4567328ba84), [`d76b129`](https://github.com/ldamoredev/caucejs/commit/d76b129e807391d26bf8f83d2335871f5e38e1ec), [`eb3fee3`](https://github.com/ldamoredev/caucejs/commit/eb3fee3dc58e732ea23bbd305b6e06429e21502c), [`4f9a9f7`](https://github.com/ldamoredev/caucejs/commit/4f9a9f7f5aaeaa645dce5c306862e37a5177c461)]:
  - @caucejs/application@0.7.0
  - @caucejs/config@0.7.0
  - @caucejs/di@0.7.0
  - @caucejs/hosting@0.7.0
  - @caucejs/web@0.7.0
  - @caucejs/schema@0.7.0
  - @caucejs/base@0.7.0

## 0.6.0

### Minor Changes

- [#19](https://github.com/ldamoredev/caucejs/pull/19) [`49fac2d`](https://github.com/ldamoredev/caucejs/commit/49fac2d544f4749d9ae55f5d2875b21937ee8c72) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add `HttpServer` and `HttpServerSettings`: a hosted service that serves the `fetch` of the web of the application on Node, fails to start on a port that is taken, and stops gracefully, answering each request in flight with `Connection: close` so no connection kept alive holds the stop.

### Patch Changes

- Updated dependencies [[`a032f1b`](https://github.com/ldamoredev/caucejs/commit/a032f1baf304bbb2e2b0dd0abfeab44f12a9b4ee)]:
  - @caucejs/web@0.6.0
  - @caucejs/di@0.6.0
  - @caucejs/config@0.6.0
  - @caucejs/hosting@0.6.0
  - @caucejs/base@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [[`7005913`](https://github.com/ldamoredev/caucejs/commit/70059132e455f88db2340c219118b7744b21874d), [`27ba1fe`](https://github.com/ldamoredev/caucejs/commit/27ba1fe2033e400ea75ddb698dc64876827224fc)]:
  - @caucejs/base@0.5.0
  - @caucejs/config@0.5.0
  - @caucejs/hosting@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @caucejs/base@0.4.0
  - @caucejs/config@0.4.0
  - @caucejs/hosting@0.4.0

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
