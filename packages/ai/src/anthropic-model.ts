import { HttpClient, HttpRequestError, HttpTimeoutError, type HttpResponse } from '@caucejs/http-client'

import { answerOf, failureOf } from './anthropic-answer.js'
import { AnthropicSettings } from './anthropic-settings.js'
import { ModelTimeoutError } from './errors/model-timeout-error.js'
import { ModelUnavailableError } from './errors/model-unavailable-error.js'
import type { Message } from './messages.js'
import { Model, type ModelRequest, type ModelResponse, type ModelTool } from './model.js'
import { unknownUsage } from './usage.js'

/**
 * The `Model` on the Messages API of Anthropic, `POST /v1/messages`, over the `HttpClient` of the application. It sends
 * only what the request says, with 1024 tokens when it does not say how many: no temperature, no tool choice, no cache.
 * Each call has the timeout of the settings, 120 seconds by default, whatever the client's is.
 */
export class AnthropicModel extends Model {
    static readonly inject = [HttpClient, AnthropicSettings] as const
    readonly #http: HttpClient

    constructor(http: HttpClient, settings: AnthropicSettings) {
        super()
        this.#http = http.with({
            baseUrl: 'https://api.anthropic.com',
            timeout: settings.timeout,
            headers: {
                authorization: `Bearer ${settings.apiKey}`,
                'anthropic-version': settings.version,
                ...(settings.workspaceId !== undefined && { 'anthropic-workspace-id': settings.workspaceId }),
            },
        })
    }

    async call(request: ModelRequest): Promise<ModelResponse> {
        const response = await this.#send(bodyOf(request))
        if (!response.ok) throw failureOf(response)
        return answerOf(response)
    }

    // The errors of the client carry the request, with the prompt in its body and the key in its headers, so they never
    // travel as the cause: only what they wrap does.
    async #send(json: unknown): Promise<HttpResponse> {
        try {
            return await this.#http.post('/v1/messages', { json })
        } catch (error) {
            if (error instanceof HttpTimeoutError) throw new ModelTimeoutError({ timeout: error.timeout, usage: unknownUsage }, { cause: error.cause })
            if (error instanceof HttpRequestError) throw new ModelUnavailableError({ status: null, requestId: null, usage: unknownUsage }, { cause: error.cause })
            throw error
        }
    }
}

function bodyOf(request: ModelRequest): unknown {
    return {
        model: request.model,
        max_tokens: request.maxTokens ?? 1024,
        ...(request.system !== undefined && { system: request.system }),
        messages: request.messages.map(messageOf),
        ...(request.tools !== undefined && request.tools.length > 0 && { tools: request.tools.map(toolOf) }),
    }
}

function messageOf(message: Message): unknown {
    if (message.role === 'assistant') {
        return {
            role: 'assistant',
            content: message.content.map(block =>
                block.type === 'text' ? { type: 'text', text: block.text } : { type: 'tool_use', id: block.id, name: block.name, input: block.input },
            ),
        }
    }
    // The API asks for the results of the tools before anything else in the message that answers them.
    const results = message.content.filter(block => block.type === 'toolResult')
    const texts = message.content.filter(block => block.type === 'text')
    return {
        role: 'user',
        content: [
            ...results.map(block => ({ type: 'tool_result', tool_use_id: block.toolCallId, content: block.content, is_error: block.isError })),
            ...texts.map(block => ({ type: 'text', text: block.text })),
        ],
    }
}

// A copy without `$schema`: the schema the caller passed is shared, and stays as it was.
function toolOf(tool: ModelTool): unknown {
    const { $schema: _dialect, ...inputSchema } = tool.inputSchema
    return { name: tool.name, description: tool.description, input_schema: inputSchema }
}
