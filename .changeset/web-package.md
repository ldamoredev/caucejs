---
"@caucejs/web": minor
"@caucejs/di": minor
---

Add the web package, on Hono: controllers whose routes are use cases, declared with the class of their request and checked against its path; one DI scope and one identity per request through an `Authenticator`; the path, the query and the body read as one object, refusing a field that comes from two of them; problems as RFC 9457; and the `fetch` of the application. `@caucejs/di` now provides `Scopes`, which opens scopes from a class that cannot be handed the provider.
