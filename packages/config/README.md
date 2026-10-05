# @caucejs/config

The configuration of Cauce. Sources are stacked and the last one that sets a key wins, and the application
reads them through settings classes: one per section, validated with any
[Standard Schema](https://standardschema.dev) while the application is composed, and injected like any other
service.

```bash
pnpm add @caucejs/config
```

```ts
class GithubSettings extends settings('github', githubSchema) {}

const config = new Config()
    .add(memory({ github: { branch: 'main' } }))
    .add(jsonFile('settings.json', { optional: true }))   // @caucejs/node
    .add(dotenvFile('.env', { optional: true }))          // @caucejs/node
    .add(environment(process.env))                        // GITHUB__TOKEN is github.token

services.addInstance(GithubSettings, config.bind(GithubSettings))

class Writer {
    static readonly inject = [GithubSettings] as const
    constructor(github: GithubSettings) { ... }
}
```

The canonical settings, to copy: [`examples/ticketing-settings.ts`](examples/ticketing-settings.ts).

## What is in it

| | |
|---|---|
| `Config` | The stack of sources, and `bind`, which validates a section and returns its settings |
| `settings(section, schema)` | The base of a settings class. The class is the token; its instances carry what the schema returned |
| `memory`, `json`, `environment` | Sources: values written by hand, a parsed JSON document, and the environment or anything shaped like it |
| `ConfigError` | The configuration cannot be read. `InvalidSettingsError`, below it, lists every problem of a section |

Reading files is the runtime's job: `jsonFile` and `dotenvFile` are in [`@caucejs/node`](../node/README.md).

## Why it is built this way

- **Settings classes validated with a schema, not a binder.** TypeScript has no reflection to fill a class
  from its types. A schema says the shape and the conversions, and Standard Schema lets the application pick
  the validator: Zod, Valibot, ArkType or one written by hand. Cauce depends on none.
- **Every value is text, and the schema converts it.** If JSON kept `3000` as a number, a schema expecting a
  number would pass in development and fail the day the environment overrides it with `"3000"`. Whether a value
  is valid cannot depend on which source set it.
- **Keys are case-sensitive, and the environment is turned into paths**: `__` separates levels and each word
  joined by `_` becomes camel case. `GITHUB__REPOSITORY_NAME` is `github.repositoryName`, and `PORT` is `port`.
  A schema cannot be asked which keys it expects, so there is no lookup that ignores case. Keys are therefore
  written in camel case without capitals in a row: `apiUrl`, never `apiURL`. Each variable enters once, under
  its path.
- **Every variable of the environment is read**, with an optional prefix. Variables nobody asks for, such as
  `PATH`, sit in the tree unread.
- **Bound while composing.** `bind` runs before the container is built, so a wrong value fails at startup and
  names every problem; the settings are added with `addInstance`, and the validation of `@caucejs/di` sees
  them. A test adds a `memory` source before binding.
- **Errors never show a value.** Each problem has its path and the source that set the value, such as
  `the environment, GITHUB__REPOSITORY`. A value the validator quotes in its message is cut out: it can be a
  password.
- **No references between keys** (`${db.host}`) and **no reload**: the configuration is read once. Arrays in
  JSON are not supported yet.
- **No default sources and no default order.** Which files a deployment reads, and in what order, belongs to
  the host.
- **No `node:*`.** A source receives data; reading a file lives in the runtime adapter.
