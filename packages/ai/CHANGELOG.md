# @caucejs/ai

## 0.10.0

### Minor Changes

- [#29](https://github.com/ldamoredev/caucejs/pull/29) [`e9986b8`](https://github.com/ldamoredev/caucejs/commit/e9986b8fd1a48cc42c8f1f5d23884e614fdefd37) Thanks [@ldamoredev](https://github.com/ldamoredev)! - Add the loop that runs the tools of the application for a model: `Ai.run`, with `ai()` to add it one for each scope, and `ScriptedModel` to answer it in a test. The tools of `@caucejs/tools` run in the scope of the use case that asks, through every middleware and as its `context`, which a run with tools requires. A tool that fails goes back to the model with `isError`, `NotAuthenticatedError` ends the run, and past `maxSteps`, 10 by default, it throws `MaxStepsExceededError`. A run answers the usage of each step and all of them added, and a call that fails in the middle throws the same error with the usage of the whole run.

### Patch Changes

- Updated dependencies []:
  - @caucejs/base@0.10.0
  - @caucejs/di@0.10.0
  - @caucejs/config@0.10.0
  - @caucejs/application@0.10.0
  - @caucejs/http-client@0.10.0
  - @caucejs/tools@0.10.0

## 0.9.0

### Minor Changes

- [#27](https://github.com/ldamoredev/caucejs/pull/27) [`589ff02`](https://github.com/ldamoredev/caucejs/commit/589ff028e3f85760b93a21fd3b9f52297e325005) Thanks [@ldamoredev](https://github.com/ldamoredev)! - The AI of Cauce, its first part: one call to a model. `services.add(anthropic())` adds a `Model` on Anthropic's Messages API, over the `HttpClient` of the application, with `AnthropicSettings` read from `ANTHROPIC__API_KEY`. A call returns the message, the stop reason, the usage in tokens and the model that answered, and what fails is a `ModelError` that never carries the prompt, the answer or the key.

### Patch Changes

- Updated dependencies []:
  - @caucejs/base@0.9.0
  - @caucejs/di@0.9.0
  - @caucejs/config@0.9.0
  - @caucejs/http-client@0.9.0
