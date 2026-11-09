# @caucejs/ai

The AI of Cauce. This first part is one call to a model: the conversation in, the next message out, with the tokens it
spent and why it stopped. It runs on Anthropic's Messages API, over the `HttpClient` of the application, and a test
answers it with a fake `fetch`. The tools and the loop that runs them come next.

```bash
pnpm add @caucejs/ai
```

```ts
// in a module, as statements
app.addSettings(AnthropicSettings)          // ANTHROPIC__API_KEY
app.services.add(httpClient())
app.services.add(anthropic())               // Model, on the HttpClient

class ProgramGuide {
    static readonly inject = [Model] as const
    readonly #model: Model
    constructor(model: Model) {
        this.#model = model
    }
    async opening(): Promise<string> {
        const response = await this.#model.call({
            model: 'claude-haiku-5-5',
            system: 'You answer questions about the program of the conference.',
            messages: [userMessage('When is the opening?')],
        })
        return response.message.content.map(block => (block.type === 'text' ? block.text : '')).join('')
    }
}

// in a test: no network
services.replace(HttpClient, () => new FetchHttpClient({ fetch: fakeAnthropic }))
```

## What is in it

| | |
|---|---|
| `Model` | One call: `call({ model, system, messages, tools, maxTokens })` returns the `message`, the `stopReason`, the `usage` and the `model` that answered |
| `AnthropicModel` | The `Model` on `POST /v1/messages`, over the `HttpClient` |
| `AnthropicSettings` | The section `anthropic`: `apiKey`, `version`, `workspaceId` and `timeout` |
| `anthropic` | The extension: `Model` as an `AnthropicModel`, one for the application |
| `Message`, `userMessage` | The conversation: `TextBlock`, `ToolCallBlock` and `ToolResultBlock`, in a `UserMessage` or an `AssistantMessage` |
| `ModelTool` | A tool as the model is told about it: `name`, `description` and `inputSchema` |
| `StopReasons` | `endTurn`, `maxTokens`, `stopSequence`, `toolUse`, `refusal` and `contextWindowExceeded` |
| `Usage` | `inputTokens`, the whole input, with `cacheReadTokens` and `cacheWriteTokens` as parts of it, and `outputTokens`. `null` is unknown |
| `ModelError` | The base of what a call throws, with the `usage` spent |
| `ModelAuthenticationError` | A 401 or a 403: the key was refused |
| `ModelRateLimitError` | A 429, with `retryAfter` in seconds, or `null` |
| `ModelUnavailableError`, `ModelTimeoutError` | A 5xx, an overload, no answer, or no answer in time |
| `ModelRequestError` | Any other 4xx, with its `status`, its `type` and its `requestId` |
| `ModelResponseError` | An answer that cannot be read |
| `IncompleteResponseError` | A tool call cut by `maxTokens`, or a turn the provider paused |

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
- **Not here yet:** the tools and the loop, which come next. Streaming, agents, sessions, compaction, structured output,
  the cache, thinking, cancelling a call and other providers wait for an application that asks for them.
