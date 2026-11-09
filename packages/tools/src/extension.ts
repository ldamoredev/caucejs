import type { Extension } from '@caucejs/di'

import { DefaultToolRunner } from './default-tool-runner.js'
import { ToolRunner } from './tool-runner.js'

const toolsId = Symbol('tools')

/**
 * Adds the `ToolRunner` of the application: `services.add(tools())`. It needs `UseCases` and a `JsonSerializer`,
 * and does not name the extensions that add them: a web application adds both itself. The validation of the
 * container names whichever is missing.
 */
export function tools(): Extension {
    return {
        id: toolsId,
        options: undefined,
        requires: [],
        register: services => {
            services.addSingleton(ToolRunner, DefaultToolRunner)
        },
    }
}
