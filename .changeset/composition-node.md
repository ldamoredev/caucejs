---
"@caucejs/node": minor
---

`WebApplication.builder()` starts a web application with the usual defaults: the environment from `NODE_ENV`, the standard sources with `PORT`, the serializer, the use cases, the web and the server, started last. `run()` says where it listens and stops on `SIGINT` or `SIGTERM`.
