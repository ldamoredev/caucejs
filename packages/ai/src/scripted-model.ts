import { ScriptExhaustedError } from './errors/script-exhausted-error.js'
import type { TextBlock, ToolCallBlock } from './messages.js'
import { Model, type ModelRequest, type ModelResponse } from './model.js'
import { StopReasons, type StopReason } from './stop-reason.js'
import type { Usage } from './usage.js'

/** One answer of a script. The ids of the tool calls are given by the model, when it answers. */
export type ScriptedAnswer = {
    readonly content: readonly (TextBlock | Omit<ToolCallBlock, 'id'>)[]
    readonly stopReason: StopReason
    readonly usage: Usage
}

export type ScriptedAnswerOptions = {
    /** What the answer spent. Nothing when it is not given: a script costs no tokens. */
    readonly usage?: Usage
}

const nothing: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

/** An answer with one text, which ends the turn: `text('The opening is at nine.')`. */
export function text(text: string, options: ScriptedAnswerOptions & { readonly stopReason?: StopReason } = {}): ScriptedAnswer {
    return { content: [{ type: 'text', text }], stopReason: options.stopReason ?? StopReasons.EndTurn, usage: options.usage ?? nothing }
}

/** An answer that asks for one tool: `toolCall('get_talk', { talkId: 'opening' })`. */
export function toolCall(name: string, input: unknown, options: ScriptedAnswerOptions = {}): ScriptedAnswer {
    return toolCalls([{ name, input }], options)
}

/** An answer that asks for several tools in one step, in this order. */
export function toolCalls(calls: readonly { readonly name: string; readonly input: unknown }[], options: ScriptedAnswerOptions = {}): ScriptedAnswer {
    return {
        content: calls.map(call => ({ type: 'toolCall', name: call.name, input: call.input })),
        stopReason: StopReasons.ToolUse,
        usage: options.usage ?? nothing,
    }
}

/**
 * A `Model` that answers a script, in order, for a test that does not go to the network:
 * `new ScriptedModel([toolCall('get_talk', { talkId: 'opening' }), text('The opening is at nine.')])`.
 *
 * An `Error` in the script is thrown on that call. It answers with the model it was asked for, gives the tool calls the
 * ids `call_1`, `call_2` and so on, and keeps each request in `requests`. **Past the end of its script it throws
 * `ScriptExhaustedError`**, and never repeats the last answer: a run that kept asking would pass unseen.
 */
export class ScriptedModel extends Model {
    readonly #script: readonly (ScriptedAnswer | Error)[]
    readonly #requests: ModelRequest[] = []
    #calls = 0

    constructor(script: readonly (ScriptedAnswer | Error)[]) {
        super()
        this.#script = script
    }

    /** What it was asked, in order. */
    get requests(): readonly ModelRequest[] {
        return [...this.#requests]
    }

    async call(request: ModelRequest): Promise<ModelResponse> {
        this.#requests.push(request)
        const answer = this.#script[this.#requests.length - 1]
        if (answer === undefined) throw new ScriptExhaustedError({ asked: this.#requests.length, answers: this.#script.length })
        if (answer instanceof Error) throw answer
        const content = answer.content.map(block => (block.type === 'text' ? block : { ...block, id: `call_${++this.#calls}` }))
        return { message: { role: 'assistant', content }, stopReason: answer.stopReason, usage: answer.usage, model: request.model }
    }
}
