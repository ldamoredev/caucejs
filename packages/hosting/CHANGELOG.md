# @caucejs/hosting

## 0.7.0

### Minor Changes

- [#22](https://github.com/ldamoredev/caucejs/pull/22) [`eb3fee3`](https://github.com/ldamoredev/caucejs/commit/eb3fee3dc58e732ea23bbd305b6e06429e21502c) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Modules: `class Conference extends Module` composes with statements in `compose(app)`, and `builder.addModule(Conference)` composes it once per class. `builder.addSettings(DoorsSettings)` binds settings when the host is built, with every source added.

### Patch Changes

- Updated dependencies [[`ddb92f3`](https://github.com/ldamoredev/caucejs/commit/ddb92f3b1e92b6326a13368bed71e4567328ba84), [`d76b129`](https://github.com/ldamoredev/caucejs/commit/d76b129e807391d26bf8f83d2335871f5e38e1ec)]:
  - @caucejs/config@0.7.0
  - @caucejs/di@0.7.0
  - @caucejs/base@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [[`a032f1b`](https://github.com/ldamoredev/caucejs/commit/a032f1baf304bbb2e2b0dd0abfeab44f12a9b4ee)]:
  - @caucejs/di@0.6.0
  - @caucejs/config@0.6.0
  - @caucejs/base@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [[`7005913`](https://github.com/ldamoredev/caucejs/commit/70059132e455f88db2340c219118b7744b21874d), [`27ba1fe`](https://github.com/ldamoredev/caucejs/commit/27ba1fe2033e400ea75ddb698dc64876827224fc)]:
  - @caucejs/base@0.5.0
  - @caucejs/config@0.5.0
  - @caucejs/di@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies []:
  - @caucejs/base@0.4.0
  - @caucejs/di@0.4.0
  - @caucejs/config@0.4.0

## 0.3.0

### Minor Changes

- [#9](https://github.com/ldamoredev/caucejs/pull/9) [`cfb2da0`](https://github.com/ldamoredev/caucejs/commit/cfb2da0c48278aff523c30779c6d07493d572121) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add `@caucejs/hosting`: a builder with the environment, the configuration and the container; hosted services that start in the order listed and stop in reverse within a timeout; a container validated in every environment; and a `Lifetime` contract. `@caucejs/node` adds `ProcessLifetime`, on `SIGINT` and `SIGTERM`, and `standardSources`. `Config.add` takes several sources at once.

### Patch Changes

- Updated dependencies [[`3ea0249`](https://github.com/ldamoredev/caucejs/commit/3ea02496bd71b465e0f0f833ea8b2b404c7b109e), [`f969b9f`](https://github.com/ldamoredev/caucejs/commit/f969b9fe71d2cb493ebc942697c4fcc4ccc49135), [`d057c30`](https://github.com/ldamoredev/caucejs/commit/d057c306873303f1efd8442aaf501b3783019f23), [`cfb2da0`](https://github.com/ldamoredev/caucejs/commit/cfb2da0c48278aff523c30779c6d07493d572121)]:
  - @caucejs/base@0.3.0
  - @caucejs/config@0.3.0
  - @caucejs/di@0.3.0
