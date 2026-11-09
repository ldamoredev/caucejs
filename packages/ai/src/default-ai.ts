import type { ExecutionContext } from '@caucejs/application'
import { InvalidArgumentError } from '@caucejs/base'
import type { Resolver } from '@caucejs/di'
import type { ToolRunner, UseCaseTool } from '@caucejs/tools'

import { Ai, type RunOptions, type RunResult, type Step } from './ai.js'
import { MaxStepsExceededError } from './errors/max-steps-exceeded-error.js'
import type { Message, ToolCallBlock, ToolResultBlock } from './messages.js'
import type { Model, ModelRequest, ModelResponse } from './model.js'
import { spentIn } from './spent.js'
import { totalOf } from './usage.js'

/**
 * The `Ai` of Cauce, over a `Model` and the `ToolRunner`. It runs the tools in the scope it was built with: `ai()`
 * builds one in each scope, so the tools see the scoped services of the use case that asked.
 */
export class DefaultAi extends Ai {
    readonly #model: Model
    readonly #runner: ToolRunner
    readonly #scope: Resolver

    constructor(model: Model, runner: ToolRunner, scope: Resolver) {
        super()
        this.#model = model
        this.#runner = runner
        this.#scope = scope
    }

    async run(options: RunOptions): Promise<RunResult> {
        const maxSteps = options.maxSteps ?? 10
        if (!Number.isInteger(maxSteps) || maxSteps < 1) {
            throw new InvalidArgumentError('maxSteps', `The most steps of a run is a whole number above 0, and ${maxSteps} is not`)
        }
        if (options.tools !== undefined && options.context === undefined) {
            throw new InvalidArgumentError('context', 'A run with tools takes the context of whoever asks, so the tools run as them')
        }
        const tools = byName(options.tools ?? [])
        // Described before the first call, so a tool that cannot be described fails before anything is paid.
        const described = [...tools.values()].map(tool => this.#runner.describe(tool))

        let conversation: readonly Message[] = options.messages
        const steps: Step[] = []
        const calledTools: string[] = []
        for (;;) {
            const response = await this.#call({
                model: options.model,
                messages: conversation,
                ...(options.system !== undefined && { system: options.system }),
                ...(described.length > 0 && { tools: described }),
                ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
            }, steps)
            const calls = response.message.content.filter(block => block.type === 'toolCall')
            // Any tool call is answered before the model is called again, as the API asks, whatever the stop reason.
            if (calls.length === 0) {
                steps.push(stepOf(response, []))
                return resultOf(steps)
            }
            if (steps.length + 1 === maxSteps) {
                steps.push(stepOf(response, []))
                throw new MaxStepsExceededError({ maxSteps, calledTools, usage: totalOf(steps.map(step => step.usage)) })
            }
            const results: ToolResultBlock[] = []
            for (const call of calls) {
                const tool = tools.get(call.name)
                if (tool !== undefined) calledTools.push(tool.name)
                results.push(tool === undefined ? missing(call, tools) : await this.#answer(tool, call, options.context))
            }
            steps.push(stepOf(response, results))
            conversation = [...conversation, response.message, { role: 'user', content: results }]
        }
    }

    async #call(request: ModelRequest, steps: readonly Step[]): Promise<ModelResponse> {
        try {
            return await this.#model.call(request)
        } catch (error) {
            throw spentIn(error, steps.map(step => step.usage))
        }
    }

    // NotAuthenticatedError is the only thing the runner throws, and it ends the run as it is.
    async #answer(tool: UseCaseTool, call: ToolCallBlock, context: ExecutionContext | undefined): Promise<ToolResultBlock> {
        const outcome = await this.#runner.call(tool, call.input, { scope: this.#scope, ...(context !== undefined && { context }) })
        return outcome.ok
            ? { type: 'toolResult', toolCallId: call.id, content: outcome.json, isError: false }
            : { type: 'toolResult', toolCallId: call.id, content: outcome.message, isError: true }
    }
}

function byName(tools: readonly UseCaseTool[]): ReadonlyMap<string, UseCaseTool> {
    const named = new Map<string, UseCaseTool>()
    for (const tool of tools) {
        if (named.has(tool.name)) throw new InvalidArgumentError('tools', `Two tools of a run are named ${tool.name}, and the model could not tell them apart`)
        named.set(tool.name, tool)
    }
    return named
}

// The model reads which tools it has, to ask again for one of them.
function missing(call: ToolCallBlock, tools: ReadonlyMap<string, UseCaseTool>): ToolResultBlock {
    const names = [...tools.keys()]
    const content =
        names.length === 0
            ? `There is no tool named "${call.name}", and there are no tools`
            : `There is no tool named "${call.name}". The tools are ${listed(names)}`
    return { type: 'toolResult', toolCallId: call.id, content, isError: true }
}

function listed(names: readonly string[]): string {
    return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`
}

function stepOf(response: ModelResponse, results: readonly ToolResultBlock[]): Step {
    return { message: response.message, results, stopReason: response.stopReason, usage: response.usage, model: response.model }
}

function resultOf(steps: readonly Step[]): RunResult {
    const last = steps.at(-1)!
    const text = last.message.content.map(block => (block.type === 'text' ? block.text : '')).join('')
    return { text, stopReason: last.stopReason, steps, usage: totalOf(steps.map(step => step.usage)), model: last.model }
}
