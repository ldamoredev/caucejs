---
"@caucejs/ai": minor
---

The AI of Cauce, its first part: one call to a model. `services.add(anthropic())` adds a `Model` on Anthropic's Messages API, over the `HttpClient` of the application, with `AnthropicSettings` read from `ANTHROPIC__API_KEY`. A call returns the message, the stop reason, the usage in tokens and the model that answered, and what fails is a `ModelError` that never carries the prompt, the answer or the key.
