import { ForbiddenError, NotAuthenticatedError, UseCases, type ExecuteOptions } from '@caucejs/application'
import { DomainError } from '@caucejs/base'
import { JsonSerializer, ValidationError } from '@caucejs/schema'

import type { UseCaseTool } from './tool.js'
import { ToolRunner, type ToolDescription, type ToolOutcome } from './tool-runner.js'

/** The runner of Cauce: it reads, executes and writes the way `web` does with a route that is a use case. */
export class DefaultToolRunner extends ToolRunner {
    static readonly inject = [UseCases, JsonSerializer] as const
    readonly #useCases: UseCases
    readonly #serializer: JsonSerializer

    constructor(useCases: UseCases, serializer: JsonSerializer) {
        super()
        this.#useCases = useCases
        this.#serializer = serializer
    }

    describe(tool: UseCaseTool): ToolDescription {
        return {
            name: tool.name,
            description: tool.description,
            inputSchema: this.#serializer.schemaOf(tool.request, { io: 'input' }),
            readOnly: tool.readOnly,
        }
    }

    async call(tool: UseCaseTool, input: unknown, options: ExecuteOptions): Promise<ToolOutcome> {
        try {
            const request = await this.#serializer.read(tool.request.schema, input)
            const value = await this.#useCases.execute(request, options)
            return { ok: true, value, json: this.#serializer.write(value) }
        } catch (error) {
            if (error instanceof NotAuthenticatedError) throw error
            return { ok: false, message: messageOf(error), error }
        }
    }
}

// What web answers with a 4xx and its message, whoever called the tool reads; what web hides behind a 500, it does not.
function messageOf(error: unknown): string {
    if (error instanceof ValidationError || error instanceof DomainError || error instanceof ForbiddenError) {
        return error.message === '' ? error.name : error.message
    }
    return 'Tool execution failed'
}
