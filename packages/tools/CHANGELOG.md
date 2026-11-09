# @caucejs/tools

## 0.9.0

### Minor Changes

- [#26](https://github.com/ldamoredev/caucejs/pull/26) [`765c1fc`](https://github.com/ldamoredev/caucejs/commit/765c1fc6fd3babfdf16cecfbff69256026839b80) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add `@caucejs/tools`: a use case described once as a tool with `tool(GetTalk, { name, description })`, and a `ToolRunner` that describes it with the JSON Schema of its input and calls it through every middleware, answering what failed for the caller to read. Add `UseCases.handles(request)` to `@caucejs/application`, to know whether a class of request has a handler.

### Patch Changes

- Updated dependencies [[`765c1fc`](https://github.com/ldamoredev/caucejs/commit/765c1fc6fd3babfdf16cecfbff69256026839b80)]:
  - @caucejs/application@0.9.0
  - @caucejs/base@0.9.0
  - @caucejs/di@0.9.0
  - @caucejs/schema@0.9.0
