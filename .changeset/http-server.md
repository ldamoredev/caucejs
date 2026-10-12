---
"@caucejs/node": minor
---

Add `HttpServer` and `HttpServerSettings`: a hosted service that serves the `fetch` of the web of the application on Node, fails to start on a port that is taken, and stops gracefully, answering each request in flight with `Connection: close` so no connection kept alive holds the stop.
