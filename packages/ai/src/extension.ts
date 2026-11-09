import type { Extension } from '@caucejs/di'

import { AnthropicModel } from './anthropic-model.js'
import { Model } from './model.js'

const anthropicId = Symbol('anthropic')

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
