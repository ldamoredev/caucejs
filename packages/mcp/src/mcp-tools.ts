import { InvalidArgumentError } from '@caucejs/base'
import { CompositionError } from '@caucejs/di'
import type { UseCaseTool } from '@caucejs/tools'

/**
 * The tools a server of MCP exposes, in the order they are added: `tools.add(getTalk)`. Every tool is listed to
 * every caller that the endpoint lets in; what a caller may run is still decided by the middlewares of the use case.
 */
export class McpTools {
    readonly #tools: UseCaseTool[] = []

    /**
     * Adds a tool. Throws `CompositionError` for a name already added, and `InvalidArgumentError` for one that starts
     * or ends with a hyphen: the SDK accepts it, but warns on the console every time it registers it, which a server
     * without state does on every request.
     */
    add(tool: UseCaseTool): this {
        if (tool.name.startsWith('-') || tool.name.endsWith('-')) {
            throw new InvalidArgumentError(
                'name',
                `The name of a tool of MCP does not start or end with a hyphen, and "${tool.name}" does`,
            )
        }
        if (this.#tools.some(added => added.name === tool.name)) {
            throw new CompositionError(`The tool ${tool.name} was already added to this server of MCP`)
        }
        this.#tools.push(tool)
        return this
    }

    /** The tools added, for the controller that serves them. A copy: adding more changes nothing it was given. */
    build(): readonly UseCaseTool[] {
        return [...this.#tools]
    }
}
