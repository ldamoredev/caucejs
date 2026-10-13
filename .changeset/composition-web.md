---
"@caucejs/web": minor
---

A route that is a use case can answer a page: `routes.get('/talks/:id', GetTalk, { html: talk => page(talk) })` writes the HTML from the result and the request.
