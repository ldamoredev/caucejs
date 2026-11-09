# @caucejs/mcp

## 0.10.0

### Minor Changes

- [#30](https://github.com/ldamoredev/caucejs/pull/30) [`c3866ff`](https://github.com/ldamoredev/caucejs/commit/c3866ff50bbd095e07fc663256a2d3bc4fee485c) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add `@caucejs/mcp`: a server of MCP as a controller of `web`, `McpController`, that serves the tools of `@caucejs/tools` over HTTP on the official SDK, without state and with JSON only. It authenticates with an authenticator of its own, answers 401 without `resource_metadata`, 403 for the permissions of the endpoint and 404 where a client looks for OAuth, and fails when the web is built for a tool without a handler.

### Patch Changes

- Updated dependencies []:
  - @caucejs/base@0.10.0
  - @caucejs/di@0.10.0
  - @caucejs/application@0.10.0
  - @caucejs/web@0.10.0
  - @caucejs/tools@0.10.0
