---
"@caucejs/mcp": minor
---

Add `@caucejs/mcp`: a server of MCP as a controller of `web`, `McpController`, that serves the tools of `@caucejs/tools` over HTTP on the official SDK, without state and with JSON only. It authenticates with an authenticator of its own, answers 401 without `resource_metadata`, 403 for the permissions of the endpoint and 404 where a client looks for OAuth, and fails when the web is built for a tool without a handler.
