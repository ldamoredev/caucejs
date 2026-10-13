# @caucejs/web

The web of Cauce, on [Hono](https://hono.dev). A route that is a use case names the class of its request, and `web`
reads it from the path, the query and the body, runs it in a scope of its own and as who makes the request, and writes
the result. What goes wrong is answered as a problem (RFC 9457). The application ends up as a `fetch`, which a server
serves and a test calls in memory.

```bash
pnpm add @caucejs/web
```

```ts
class TalksController extends Controller {
    registerRoutes(routes: Routes): void {
        routes.get('/talks/:id', GetTalk)                                                  // a use case, as JSON
        routes.post('/talks/:id/rename', RenameTalk, { redirect: talk => `/talks/${talk.id}` })
        routes.get('/pages/talks/:id', GetTalk, { html: talk => page(talk) })               // a use case, as a page
        routes.get('/healthz', c => c.text('ok'))                                          // written by hand
    }
}

// in a module of a web application on Node, as statements: see WebApplication in @caucejs/node
app.useCases.use(Authorization)
app.useCases.handle(GetTalkHandler)
app.web.use(secureHeaders())
app.web.authenticateWith(SessionCookie)
app.web.controller(TalksController)

const response = await new TestClient(app.fetch).get('/talks/opening')   // in memory
```

The canonical web, to copy: [`examples/conference-web.ts`](examples/conference-web.ts).

## What is in it

| | |
|---|---|
| `web`, `WebBuilder` | The extension, and what `WebApplicationBuilder` exposes as `web`: `use` adds Hono middlewares, `controller` a group of routes, `authenticateWith` who makes each request, `status` the status of an error of the application, `respondToProblemsWith` what answers a problem |
| `Web` | The web of the application: its `fetch`, and `hono` for what `web` does not cover |
| `Controller` | A group of routes, built by the container: `registerRoutes(routes)` |
| `Routes` | `get`, `post`, `put`, `patch`, `delete`: with the class of a request, a route that is a use case, answered as JSON, a redirect or a page; with a function, a route written by hand |
| `Authenticator` | Turns a request into an `Identity`. `AnonymousAuthenticator` is the one without an application's |
| `ProblemResponder` | Answers a problem instead of `application/problem+json`, such as an HTML page or a redirect to the login |
| `UnsupportedMediaTypeError` | A body that is neither JSON nor a form: a 415 |

## Why it is built this way

- **On Hono, and it shows where that helps.** Hono follows the fetch standard, so the application is a `fetch` that
  runs on any runtime and is tested in memory, and it installs two packages. Its middlewares are used as they are
  (`secureHeaders()`, `cors()`), and a route written by hand gets its context. What belongs to Cauce —routes that are
  use cases, reading the request, problems, the identity, the scope— does not name Hono. This package imports no
  `node:*`; the server that serves the `fetch` on Node lives in `@caucejs/node`.
- **A route that is a use case names its request, and the compiler checks them together.** Every parameter of the path
  has to be a field of the request: `routes.get('/talks/:idd', GetTalk)` does not compile, and says *the path names
  idd, which the request does not have*. A redirect gets the result and the request, typed.
- **Every field comes from one place.** The path, the query and the body —JSON, any `+json` type, or a form, by its
  `Content-Type`— are read as one object, and a field that comes from two of them is a 400 that names it, never one
  that wins in silence. A query name given twice is a list. A body that is not valid JSON, or not an object, is a 400;
  one of another type, a 415. A GET has no body: the fetch standard does not let one be sent.
- **The result is written by the `JsonSerializer`**, with 200 or the status the route declares, GET included; a use case
  that answers nothing gives 204. A redirect is 303 unless it says otherwise. **A page is a use case too**: `{ html }`
  writes the HTML from the result and the request, so a page that only shows what a query answers is one line, and
  closed to whoever the query is closed to.
- **A route written by hand is written inline, in `registerRoutes`.** Extracted to a method, Hono no longer knows its
  path and its parameters lose their types. It runs a use case with `run`, which reads the fields with the request's
  schema and runs it as the request does.
- **One scope and one identity per request.** Before any route, `web` opens a scope of the container —through
  `Scopes`, which `@caucejs/di` provides— and asks the `Authenticator` who makes the request, in that scope. The scope
  is disposed when the response is ready. Nothing of HTTP goes into the execution context.
- **Middlewares run in the order they are written**, the first one outermost, around the route and around a problem.
- **Problems are RFC 9457.** `application/problem+json` with `type`, `title`, `status`; a client error adds the message of
  the error as `detail`, and a `ValidationError` its issues as `errors`. A server error says nothing of its cause, and
  is written with `console.error`, because it is the one the client learns nothing about. The statuses:
  `ValidationError` 400, `UnsupportedMediaTypeError` 415, `NotAuthenticatedError` 401, `ForbiddenError` 403,
  `NotFoundError` 404, any other `DomainError` 400, anything else 500. A route that does not exist is a 404. An
  application adds its own with `status`, checked first.
- **An application of pages answers its problems itself** with a `ProblemResponder`: an HTML page for a 404, a redirect to
  the login for a 401. Answer through Hono's context (`c.redirect`): `Response.redirect` builds a response whose headers
  cannot change, and a middleware that adds headers then fails.
- **Not here:** rate limits, the storage of sessions, websockets and server-sent events, OpenAPI, uploads, static files.
