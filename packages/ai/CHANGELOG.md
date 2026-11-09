# @caucejs/ai

## 0.9.0

### Minor Changes

- [#27](https://github.com/ldamoredev/caucejs/pull/27) [`589ff02`](https://github.com/ldamoredev/caucejs/commit/589ff028e3f85760b93a21fd3b9f52297e325005) Thanks [@ldamoredev](https://github.com/ldamoredev)! - The AI of Cauce, its first part: one call to a model. `services.add(anthropic())` adds a `Model` on Anthropic's Messages API, over the `HttpClient` of the application, with `AnthropicSettings` read from `ANTHROPIC__API_KEY`. A call returns the message, the stop reason, the usage in tokens and the model that answered, and what fails is a `ModelError` that never carries the prompt, the answer or the key.

### Patch Changes

- Updated dependencies []:
  - @caucejs/base@0.9.0
  - @caucejs/di@0.9.0
  - @caucejs/config@0.9.0
  - @caucejs/http-client@0.9.0
