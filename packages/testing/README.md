# @caucejs/testing

What an application's tests need from Cauce: values for defaults without randomness, a scenario that builds and
saves the data a test asks for, and a client that calls the application in memory and says what it answered when
it is not what the test expected.

```bash
pnpm add -D @caucejs/testing
```

```ts
const scenario = new Scenario(provider)
const keynote = await scenario.add(talk(t => t.keynote().title('Opening')))

const organizer = new TestClient(app.fetch).with({ headers: { authorization: 'Bearer organizer' } })
const response = await organizer.post('/talks', { json: { title: 'Closing' } })

response.succeeds(201)
```

The canonical test support, to copy: [`examples/conference-tests.ts`](examples/conference-tests.ts).

## What is in it

| | |
|---|---|
| `Examples` | Realistic values handed out in turn: `new Examples('Opening', 'Closing').one()` |
| `Example` | A value a scenario can build, and save: what `talk(...)` returns |
| `Scenario` | Builds examples with the services of a container. `add` saves, `make` does not |
| `TestClient` | Calls a fetch handler, such as `app.fetch`, and returns a `TestResponse`. `with` adds headers, such as a session |
| `TestResponse` | The response with its body read: `succeeds`, `failsWith`, `redirectsTo`, `json()` and `text` |
| `UnexpectedResponseError` | What those assertions throw, with the request, the status and the start of the body |
| `FixedClock` | A `Clock` stopped at a moment, which moves only when the test calls `advance` |

## How the application writes its test support

**One example per aggregate, next to it**, as a function that returns an `Example`. It builds with a builder whose
steps say the role, not the field (`keynote()`), takes its defaults from `Examples`, and saves through the
repository it gets from the container:

```ts
const titles = new Examples('Types at scale', 'Testing in production')

export function talk(details: (talk: TalkBuilder) => void = () => {}): Example<Talk> {
    return {
        build: context => {
            const builder = new TalkBuilder(titles.one())
            details(builder)
            return builder.build(ticket => context.child(ticket))
        },
        save: (resolver, built) => resolver.get(Talks).add(built),
    }
}
```

- **A child** is built inside its parent's `build` with `context.child(example)`, and saved after the parent, in the
  order it was declared, so a foreign key finds its row.
- **The scenario knows no aggregate.** A new aggregate adds an example; the scenario never changes.
- **Known characters**, such as the organizer every test logs in as, are fields or functions of the application's
  tests. The scenario does not create anything a test did not ask for.
- **To change a collaborator**, replace it in the container the test builds (`services.replace`), not in the
  scenario.

## Why it is built this way

- **No test runner.** The assertions throw `UnexpectedResponseError`, which every runner takes as a failure, so the
  package works with Vitest, `node:test` or a script that fills a development database with the same examples.
  What a body says is asserted with the runner.
- **No randomness.** Two runs build the same data, so a failure repeats. Each `Examples` counts on its own, but the
  value a test gets still depends on how many were asked for before it: **a test never asserts on a value it did not
  choose**. It passes the one it is about.
- **`add` is asynchronous**, because saving to a database or a file is. `make` is synchronous: it saves nothing.
  Each `add` saves once.
- **In memory, through the fetch standard.** `TestClient` takes any `(request: Request) => Response` function: the
  `fetch` of an application, in the same process, with no port; or `fetch` itself with a `baseUrl`, against a server
  that runs. It never follows redirections, so a test asserts them, and it keeps no cookies, so a session is a header
  the test sets with `with`.
- **The verb is the last step.** `client.get(path, options)` sends the request, so none is left built and never
  sent.
- **One kind of body**: `json`, `form` or `body`, and the compiler refuses two at once or a body on a `GET`. The client
  sets the content type of `json` unless the request sets its own; a `form` is URL encoded.
- **Few assertions, about HTTP.** `succeeds()` accepts any 2xx, `succeeds(201)` exactly that one; `failsWith(404)`;
  `redirectsTo('/login')` needs a 3xx and that exact location. A failure shows the method, the path, the status and up
  to 500 characters of the body, which is usually the error.
- **A fake proves itself against the real one.** An in-memory repository is only as good as its likeness to the real
  one. Write its tests once, as a function that receives the repository, and run them against both. That function
  belongs to the application, because it is written with the runner.
- **`Request` and `Response` are the fetch standard.** Node, Bun and Deno have them; the package imports no
  `node:*`, and its types come from TypeScript's `DOM` library. An application compiles against them with `DOM` in
  its `lib` or with `@types/node`.
