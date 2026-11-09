import type { Extension } from '@caucejs/di'
import { ToolRunner } from '@caucejs/tools'

import { Ai } from './ai.js'
import { AnthropicModel } from './anthropic-model.js'
import { DefaultAi } from './default-ai.js'
import { Model } from './model.js'

const anthropicId = Symbol('anthropic')
const aiId = Symbol('ai')

/**
 * The `Model` of the application on Anthropic: `services.add(anthropic())`. It needs an `HttpClient` and the
 * `AnthropicSettings`, which the application adds: `httpClient()` and `app.addSettings(AnthropicSettings)`. It does not
 * name them in `requires`: `AnthropicModel` lists them in `inject`, so a validated container names the one missing.
 */
export function anthropic(): Extension {
    return {
        id: anthropicId,
        options: {},
        requires: [],
        register: services => {
            services.addSingleton(Model, AnthropicModel)
        },
    }
}

// What the factory of Ai takes, in a class the container builds: a factory is opaque to the validation, and this list
// is what makes a validated container name a missing Model or ToolRunner when it is built.
class AiDependencies {
    static readonly inject = [Model, ToolRunner] as const
    readonly model: Model
    readonly runner: ToolRunner

    constructor(model: Model, runner: ToolRunner) {
        this.model = model
        this.runner = runner
    }
}

/**
 * The `Ai` of the application: `services.add(ai())`. One for each scope, built with that scope, so the tools it runs
 * see the scoped services of the use case that asked. It needs a `Model`, as `anthropic()` adds, and the `ToolRunner`
 * of `tools()`, even when no run has tools. It does not name them in `requires`: a validated container names the one
 * missing, as `AiDependencies needs Model, which was never added`.
 */
export function ai(): Extension {
    return {
        id: aiId,
        options: {},
        requires: [],
        register: services => {
            services.addSingleton(AiDependencies)
            services.addScoped(Ai, scope => {
                const { model, runner } = scope.get(AiDependencies)
                return new DefaultAi(model, runner, scope)
            })
        },
    }
}
