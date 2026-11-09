---
"@caucejs/ai": minor
---

Add the loop that runs the tools of the application for a model: `Ai.run`, with `ai()` to add it one for each scope, and `ScriptedModel` to answer it in a test. The tools of `@caucejs/tools` run in the scope of the use case that asks, through every middleware and as its `context`, which a run with tools requires. A tool that fails goes back to the model with `isError`, `NotAuthenticatedError` ends the run, and past `maxSteps`, 10 by default, it throws `MaxStepsExceededError`. A run answers the usage of each step and all of them added, and a call that fails in the middle throws the same error with the usage of the whole run.
