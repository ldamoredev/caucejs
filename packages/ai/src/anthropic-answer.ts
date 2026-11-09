import type { HttpResponse } from '@caucejs/http-client'

import { IncompleteResponseError } from './errors/incomplete-response-error.js'
import { ModelAuthenticationError } from './errors/model-authentication-error.js'
import type { ModelError } from './errors/model-error.js'
import { ModelRateLimitError } from './errors/model-rate-limit-error.js'
import { ModelRequestError } from './errors/model-request-error.js'
import { ModelResponseError } from './errors/model-response-error.js'
import { ModelUnavailableError } from './errors/model-unavailable-error.js'
import type { TextBlock, ToolCallBlock } from './messages.js'
import type { ModelResponse } from './model.js'
import { StopReasons, type StopReason } from './stop-reason.js'
import { unknownUsage, type Usage } from './usage.js'

const stopReasons: Readonly<Record<string, StopReason>> = {
    end_turn: StopReasons.EndTurn,
    max_tokens: StopReasons.MaxTokens,
    stop_sequence: StopReasons.StopSequence,
    tool_use: StopReasons.ToolUse,
    refusal: StopReasons.Refusal,
    model_context_window_exceeded: StopReasons.ContextWindowExceeded,
}

/** The error for an answer whose status is not a success. Nothing of the body goes in it but the kind of error. */
export function failureOf(response: HttpResponse): ModelError {
    const { status } = response
    const requestId = response.headers.get('request-id')
    const usage = unknownUsage
    if (status === 401 || status === 403) return new ModelAuthenticationError({ status, requestId, usage })
    if (status === 429) return new ModelRateLimitError({ retryAfter: secondsOf(response.headers.get('retry-after')), requestId, usage })
    if (status >= 500) return new ModelUnavailableError({ status, requestId, usage })
    if (status >= 400) return new ModelRequestError({ status, type: errorTypeOf(response.text), requestId, usage })
    return new ModelResponseError({ problem: `the status ${status} is not an answer`, requestId, usage })
}

/** The answer of a call that succeeded, read by hand: this package depends on no validator. */
export function answerOf(response: HttpResponse): ModelResponse {
    const requestId = response.headers.get('request-id')
    const body = parsed(response.text)
    // No cause: the error of JSON.parse quotes the start of the body.
    if (!isRecord(body)) throw new ModelResponseError({ problem: 'the body is not a JSON object', requestId, usage: unknownUsage })
    const usage = usageOf(body.usage)
    const unreadable = (problem: string) => new ModelResponseError({ problem, requestId, usage })

    if (!Array.isArray(body.content)) throw unreadable('it has no content')
    const content = body.content.map((block: unknown, index): TextBlock | ToolCallBlock => {
        if (!isRecord(block) || typeof block.type !== 'string') throw unreadable(`the block ${index} has no type`)
        if (block.type === 'text') {
            if (typeof block.text !== 'string') throw unreadable(`the text block ${index} has no text`)
            return { type: 'text', text: block.text }
        }
        if (block.type === 'tool_use') {
            if (typeof block.id !== 'string' || typeof block.name !== 'string') throw unreadable(`the tool_use block ${index} has no id or no name`)
            return { type: 'toolCall', id: block.id, name: block.name, input: block.input }
        }
        // Nothing this package sends asks for other blocks, and dropping one would hand back a turn that is not whole.
        throw unreadable(`the block ${index} is of a type it does not know, ${quoted(block.type)}`)
    })

    if (typeof body.stop_reason !== 'string') throw unreadable('it has no stop reason')
    if (body.stop_reason === 'pause_turn') throw new IncompleteResponseError({ reason: 'pauseTurn', requestId, usage })
    const stopReason = stopReasons[body.stop_reason]
    if (stopReason === undefined) throw unreadable(`the stop reason is one it does not know, ${quoted(body.stop_reason)}`)
    if (stopReason === StopReasons.MaxTokens && content.at(-1)?.type === 'toolCall') {
        throw new IncompleteResponseError({ reason: 'maxTokens', requestId, usage })
    }
    if (typeof body.model !== 'string') throw unreadable('it does not name its model')

    return { message: { role: 'assistant', content }, stopReason, usage, model: body.model }
}

// The input is the three of them: what was read from the cache and what was written to it are parts of the total.
function usageOf(usage: unknown): Usage {
    if (!isRecord(usage)) return unknownUsage
    const input = tokens(usage.input_tokens)
    const cacheRead = tokens(usage.cache_read_input_tokens)
    const cacheWrite = tokens(usage.cache_creation_input_tokens)
    return {
        inputTokens: input === null ? null : input + (cacheRead ?? 0) + (cacheWrite ?? 0),
        outputTokens: tokens(usage.output_tokens),
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
    }
}

function tokens(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

// Only seconds: an HTTP date would need a clock, and the reset headers of each limit are dates too.
function secondsOf(header: string | null): number | null {
    return header !== null && /^\d+$/.test(header.trim()) ? Number(header.trim()) : null
}

function errorTypeOf(text: string): string | null {
    const body = parsed(text)
    if (!isRecord(body) || !isRecord(body.error)) return null
    // a kind of error is a name; anything else in that field could be text, and is not carried
    return typeof body.error.type === 'string' && isName(body.error.type) ? body.error.type : null
}

function parsed(text: string): unknown {
    try {
        return JSON.parse(text) as unknown
    } catch {
        return undefined
    }
}

// The type of a block is a name the API gives, not content, but it is still cut short and kept to a name.
function quoted(type: string): string {
    return isName(type) ? type : 'a type that is not a name'
}

function isName(text: string): boolean {
    return /^[a-z0-9_]{1,64}$/i.test(text)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
