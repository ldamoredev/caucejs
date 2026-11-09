# @caucejs/ai

The AI of Cauce. A `Model` is one call: the conversation in, the next message out, with the tokens it spent and why it
stopped. `Ai` runs a model with the tools of the application: the use cases of `@caucejs/tools`, run in the scope of the
use case that asked, through every middleware and as whoever asked, until the model answers without them. It runs on
Anthropic's Messages API, over the `HttpClient` of the application, and a test answers it with a `ScriptedModel`.

```bash
pnpm add @caucejs/ai
```

```ts
// in a module, as statements
app.addSettings(AnthropicSettings)          // ANTHROPIC__API_KEY
app.services.add(httpClient())
app.services.add(tools())
app.services.add(anthropic())               // Model, on the HttpClient
app.services.add(ai())                      // Ai, one for each scope, with the scope it is built in
app.useCases.handle(AskTheProgramHandler)

class AskTheProgramHandler extends Handler.of(AskTheProgram) {
    static readonly inject = [Ai] as const
    readonly #ai: Ai

    constructor(ai: Ai) {
        super()
        this.#ai = ai
    }

    async execute(request: AskTheProgram, context: ExecutionContext): Promise<Answer> {
        const result = await this.#ai.run({
            model: 'claude-haiku-5-5',
            system: 'You answer questions about the program of the conference, and name the talk of each answer.',
            messages: [userMessage(request.question)],
            tools: [getTalk, findTalks],
            context,                        // the tools run as whoever asked, in this scope
            maxSteps: 6,
        })
        return { text: result.text, usage: result.usage, model: result.model }
    }
}

// in a test: no network
services.replace(Model, () => new ScriptedModel([toolCall('get_talk', { talkId: 'opening' }), text('The opening is at nine.')]))
```

The canonical use, to copy: [`examples/conference-ai.ts`](examples/conference-ai.ts).

## What is in it

| | |
|---|---|
| `Model` | One call: `call({ model, system, messages, tools, maxTokens })` returns the `message`, the `stopReason`, the `usage` and the `model` that answered |
| `AnthropicModel` | The `Model` on `POST /v1/messages`, over the `HttpClient` |
| `AnthropicSettings` | The section `anthropic`: `apiKey`, `version`, `workspaceId` and `timeout` |
| `anthropic` | The extension: `Model` as an `AnthropicModel`, one for the application |
| `Ai` | `run({ model, system, messages, tools, context, maxTokens, maxSteps })` calls the model, runs the tools it asks for, and answers a `RunResult` |
| `DefaultAi` | The `Ai`, over a `Model`, the `ToolRunner` and the scope it runs the tools in |
| `ai` | The extension: `Ai` as a `DefaultAi`, one for each scope |
| `RunOptions` | What a run is asked for. With `tools`, the `context` of whoever asks is required |
| `RunResult`, `Step` | The `text` of the last message, its `stopReason`, each `Step` with what the tools answered, the `usage` of all of them added and the `model` |
| `ScriptedModel` | A `Model` for tests that answers a script: `text(...)`, `toolCall(...)`, `toolCalls([...])` or an `Error`. It keeps each request |
| `Message`, `userMessage` | The conversation: `TextBlock`, `ToolCallBlock` and `ToolResultBlock`, in a `UserMessage` or an `AssistantMessage` |
| `ModelTool` | A tool as the model is told about it: `name`, `description` and `inputSchema` |
| `StopReasons` | `endTurn`, `maxTokens`, `stopSequence`, `toolUse`, `refusal` and `contextWindowExceeded` |
| `Usage` | `inputTokens`, the whole input, with `cacheReadTokens` and `cacheWriteTokens` as parts of it, and `outputTokens`. `null` is unknown |
| `ModelError` | The base of what a call or a run throws, with the `usage` spent |
| `ModelAuthenticationError` | A 401 or a 403: the key was refused |
| `ModelRateLimitError` | A 429, with `retryAfter` in seconds, or `null` |
| `ModelUnavailableError`, `ModelTimeoutError` | A 5xx, an overload, no answer, or no answer in time |
| `ModelRequestError` | Any other 4xx, with its `status`, its `type` and its `requestId` |
| `ModelResponseError` | An answer that cannot be read |
| `IncompleteResponseError` | A tool call cut by `maxTokens`, or a turn the provider paused |
| `MaxStepsExceededError` | A run that reached `maxSteps` while the model still asked for tools, with `maxSteps`, the `calledTools` and the `usage` |
| `ScriptExhaustedError` | A `ScriptedModel` asked past the end of its script |

## Why it is built this way

- **Its own, over `@caucejs/http-client`, and no SDK.** A call is one `POST`, so the key, the timeout and a test go
  through the client the application already has, and the package has no dependency outside Cauce.
- **Two layers.** `Model` is one call: it runs no tools and keeps no state, so each call is paid once and read on its
  own. The loop that runs the tools the model asks for sits over it, and a test answers it with a model written by hand.
- **A small form of messages of its own**: text, a tool call and its result. It is the same for any model, and the
  provider's names stay inside `AnthropicModel`. A `ModelTool` has the first three fields of the `ToolDescription` of
  `@caucejs/tools`, with the same names and types, so a described use case is passed as it is.
- **It sends only what the request says.** The model, 1024 tokens unless it says otherwise, the system, the messages
  and the tools. No `temperature`, `top_p` or `top_k`, which the version `2026-10-21` refuses, and no tool choice, no
  cache and no strict tools, which nothing asks for yet. `$schema` is left out of each input schema, on a copy: the schema it was
  given is shared. The results of the tools go first in the message that answers them, as the API asks.
- **The version is a setting**, `2026-10-21` by default, so moving to the next one is a change of configuration that
  the tests of the application see.
- **120 seconds per call**, whatever the client's timeout: an answer without streaming takes longer than most calls.
  It is a setting too.
- **A stop reason is an answer, not an error.** A refusal or a full context window is something the application reads.
  What cannot be used as it is throws `IncompleteResponseError`: a tool call cut in the middle, or a paused turn.
- **The errors never carry the prompt, the answer, the key or the request.** A server error is printed whole, and those
  can hold the notes of a user. The errors of the client carry the request, with the body and the headers, so they are
  never the cause: what fetch threw is. A body that is not JSON has no cause, because the error of `JSON.parse` quotes
  it, and a `ModelRequestError` leaves out the message of the provider, which nothing says never quotes the request.
- **An answer it does not know is an error.** The version is fixed and nothing the package sends asks for other
  blocks, so a block or a stop reason it does not know means something changed, and dropping a block would hand back a
  turn that is not whole. The error names the type, never the content.
- **The usage is in tokens, with the model that answered**, and no price: the price and the budget belong to the
  application. Each error carries the usage spent: a call with no readable answer is unknown, because a timeout may
  still have been charged.
- **`retry-after` is read in seconds.** An HTTP date, or the reset headers of each limit, would need a clock.
- **No retries.** A retry is paid again, and whether to wait is the application's decision.
- **`anthropic()` names nothing in `requires`.** `AnthropicModel` lists `HttpClient` and `AnthropicSettings` in
  `inject`, so a validated container names the one that is missing.
### The loop

- **The tools run in the scope of the use case that calls `run`, and as its `context`.** `ai()` adds `Ai` as scoped,
  with a factory that hands it the scope it is built in, so a handler that asks for `Ai` gets one that runs the tools
  where the handler runs: the same scoped services, through every middleware, with the identity of whoever asked.
  **The compiler refuses a run with tools and no `context`**, even with an empty list; a caller it cannot check gets an
  `InvalidArgumentError` before anything is called.
- **`ai()` names nothing in `requires`, and its factory takes the `Model` and the `ToolRunner` from a class with
  `inject`.** A factory is opaque to the validation of the container; the class is not, so a validated container
  without a model fails when it is built with `AiDependencies needs Model, which was never added`. It needs `tools()`
  even when no run has tools.
- **A tool that fails goes back to the model**, as a result with `isError` and the message of `ToolRunner`, and the run
  goes on: the model reads why, and can ask again. A tool the model names and the run does not have goes back the same
  way, with the names of the ones it has. What the tool threw stays with its middlewares, which log it.
- **`NotAuthenticatedError` ends the run**, as it is: nobody was there to answer for, and whoever exposes the use case
  answers it with a 401. It carries no usage.
- **The tools of a step run one after the other, in the order the model asked**, even when they only read. A step with
  five slow searches is the first sign that this has to change.
- **`maxSteps` is 10.** Each step is one call to the model. When the last one still asks for tools, they do not run, and
  the run throws `MaxStepsExceededError` with the names of the tools that ran and the usage of every step. **Not their
  content**: what the tools answered can hold the notes of a user, and an error is printed whole.
- **The usage is that of each step, and all of them added**, field by field: a field is `null` when one step does not
  know it.
- **A call that fails in the middle throws the same error**, a copy with the class, the own fields, the cause and the
  stack of the one thrown, and the usage the provider reported in the whole run: the steps that answered, added as in
  the result, and the call that failed when it says what it spent, as an `IncompleteResponseError` does. A step that
  answered without a field of its usage leaves that field unknown in the error too, as in the result: **only the call
  that failed adds nothing when all of its usage is `null`.** A run where nothing reported any usage is unknown, as the
  error of one call: a call that got no answer may still have been charged. Anything that is not a `ModelError` is
  thrown as it is.
- **The copy has limits.** A field a subclass writes with `#` is not on the object, so the copy loses it, and its getter
  throws a `TypeError`. The copy is not a native error either, since no constructor built it: `Error.isError` answers
  `false` for it, and `structuredClone` turns it into a plain object. A test fixes both.
- **`ScriptedModel` never repeats its last answer.** Past the end of its script it throws `ScriptExhaustedError`, so a
  run that keeps asking fails the test instead of passing unseen.
- **A tool cannot ask for a service on the path `Ai` was built on.** The scope `Ai` keeps is the resolver of its
  factory, which carries that path, and the container checks the path before the services the scope already built. So
  a tool whose handler, or anything it injects, asks for a service on it finds a cycle that is not there: `Ai` itself,
  the handler that asked for it, or anything in between, such as a scoped `Conversation` in
  `AskHandler -> Conversation -> Ai`, **even when the scope built it already and the tool never asks for `Ai`**. The
  model reads `Tool execution failed`. Two tests fix this limit, and fail the day the container forgets that path.

### What is not here

The run by hand with a key, out of CI, is [`manual/ask-the-program.manual.ts`](manual/ask-the-program.manual.ts):
`pnpm build`, then `ANTHROPIC__API_KEY=… pnpm --filter @caucejs/ai test:manual`. It spends tokens.

Streaming, agents, sessions, compaction, approvals, structured output, the cache, thinking, cancelling a call, retries,
the cost in a currency and other providers wait for an application that asks for them.
