// The run by hand against the API of Anthropic, before a merge and out of CI. It spends tokens of the key it is given:
//
//     pnpm build
//     ANTHROPIC__API_KEY=sk-ant-… pnpm --filter @caucejs/ai test:manual
//
// It prints each call: how long it took, why it stopped, the tools it asked for and what it spent, and a cost estimated
// with the prices below. Nothing here checks how long an answer without streaming can take at most: one run is a
// sample, not a bound.
import { application, Authorization, Command, ExecutionContext, Handler, Identity } from '@caucejs/application'
import { Config, environment } from '@caucejs/config'
import { Services } from '@caucejs/di'
import { HttpClient, httpClient } from '@caucejs/http-client'
import { jsonSerializer } from '@caucejs/schema'
import { tool, ToolRunner, tools } from '@caucejs/tools'
import { afterAll, describe, expect, it } from 'vitest'
import * as z from 'zod'

import { findTalks, FindTalksHandler, getTalk, GetTalkHandler, Talks } from '../examples/conference-ai.js'
import {
    Ai,
    ai,
    anthropic,
    AnthropicModel,
    AnthropicSettings,
    MaxStepsExceededError,
    Model,
    userMessage,
    type ModelRequest,
    type ModelResponse,
    type RunOptions,
    type RunResult,
    type Usage,
} from '../src/index.js'

const model = 'claude-haiku-5-5'
// Haiku 5.5 with a prompt of up to 100k tokens, in USD for a million tokens, as the pricing page said on 26/10.
const price = { input: 0.1, output: 0.5 }

// This run is for Node only, and the package is built without its types.
const variables = (globalThis as unknown as { process: { env: Readonly<Record<string, string | undefined>> } }).process.env

class SellTicket extends Command.returning<number>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly permissions = ['tickets']
}

class SellTicketHandler extends Handler.of(SellTicket) {
    async execute(): Promise<number> {
        return 41
    }
}

const sellTicket = tool(SellTicket, { name: 'sell_ticket', description: 'Sells one seat of a talk, by its id, and answers the seats left' })

class Attendee extends Identity {
    readonly name = 'attendee'
    readonly isAuthenticated = true

    can(_permission: string): boolean {
        return false
    }
}

type Call = { readonly ms: number; readonly response: ModelResponse | null; readonly failure: string | null }

// The model of the application, timed: each call is written down as it comes back.
class TimedModel extends Model {
    readonly calls: Call[] = []
    readonly #model: Model

    constructor(model: Model) {
        super()
        this.#model = model
    }

    async call(request: ModelRequest): Promise<ModelResponse> {
        const start = performance.now()
        try {
            const response = await this.#model.call(request)
            this.calls.push({ ms: Math.round(performance.now() - start), response, failure: null })
            return response
        } catch (error) {
            this.calls.push({ ms: Math.round(performance.now() - start), response: null, failure: (error as Error).name })
            throw error
        }
    }
}

const services = new Services()
services.add(httpClient())
services.add(anthropic())
services.addInstance(AnthropicSettings, new Config().add(environment(variables)).bind(AnthropicSettings))
services.addSingleton(Talks)
services.add(jsonSerializer())
services.add(tools())
services.add(ai())
services.add(
    application(app => {
        app.use(Authorization)
        app.handle(GetTalkHandler)
        app.handle(FindTalksHandler)
        app.handle(SellTicketHandler)
    }),
)
services.replace(Model, resolver => new TimedModel(new AnthropicModel(resolver.get(HttpClient), resolver.get(AnthropicSettings))))
const provider = services.build({ validate: true })
const timed = provider.get(Model) as TimedModel
// The call that goes straight through the HttpClient, which TimedModel does not see.
const direct: { readonly ms: number; readonly usage: Usage }[] = []
const system = 'You answer questions about the program of the conference with the tools you have, and name the talk of each answer.'

describe('a run against Anthropic', () => {
    afterAll(() => {
        const spent = [...timed.calls.flatMap(call => (call.response === null ? [] : [call.response.usage])), ...direct.map(call => call.usage)]
        const input = spent.reduce((total, usage) => total + (usage.inputTokens ?? 0), 0)
        const output = spent.reduce((total, usage) => total + (usage.outputTokens ?? 0), 0)
        const cost = (input * price.input + output * price.output) / 1_000_000
        const calls = timed.calls.length + direct.length
        // a call that failed reports nothing, and a timeout may still have been charged
        console.log(`\n${calls} calls, ${input} tokens in and ${output} out, about ${cost.toFixed(5)} USD at the prices of this file, the direct call included`)
        console.log(`the slowest call took ${Math.max(...timed.calls.map(call => call.ms), ...direct.map(call => call.ms))} ms`)
    })

    it('answers with the tools it needs', async () => {
        const result = await run({ ...asked('When does Ada speak first?'), tools: [getTalk, findTalks], context: ExecutionContext.anonymous() })

        expect(result.steps.length).toBeGreaterThan(1)
    })

    it('reads a tool that fails, and goes on', async () => {
        const result = await run({ ...asked('When is the talk with the id keynote?'), tools: [getTalk], context: ExecutionContext.anonymous() })

        expect(result.steps.flatMap(step => step.results).some(block => block.isError)).toBe(true)
    })

    it('reads a tool out of the permissions of whoever asks', async () => {
        const result = await run({ ...asked('Sell me a ticket for the talk opening.'), tools: [sellTicket], context: ExecutionContext.of(new Attendee()) })

        expect(result.steps.flatMap(step => step.results).map(block => block.content)).toContain('Forbidden')
    })

    it('stops at its most steps, with what it spent', async () => {
        const error = await run({ ...asked('When does Ada speak first?'), tools: [getTalk, findTalks], context: ExecutionContext.anonymous(), maxSteps: 1 }).then(
            () => null,
            (thrown: unknown) => thrown,
        )

        console.log(error instanceof MaxStepsExceededError ? `${error.message}, with ${JSON.stringify(error.usage)}` : `it answered without tools: ${String(error)}`)
        if (error !== null) expect(error).toBeInstanceOf(MaxStepsExceededError)
    })

    // Not verified by the sheet: whether the API takes `$schema` in an input schema. AnthropicModel always leaves it
    // out; this call sends it, with the description of a tool as the runner gives it, to know whether it has to.
    it('says whether the API takes $schema in an input schema', async () => {
        const settings = provider.get(AnthropicSettings)
        const inputSchema = provider.get(ToolRunner).describe(getTalk).inputSchema
        const http = provider.get(HttpClient).with({
            baseUrl: 'https://api.anthropic.com',
            timeout: settings.timeout,
            headers: { authorization: `Bearer ${settings.apiKey}`, 'anthropic-version': settings.version },
        })
        const start = performance.now()
        try {
            const response = await http.post('/v1/messages', {
                json: {
                    model,
                    max_tokens: 64,
                    messages: [{ role: 'user', content: 'Say hello.' }],
                    tools: [{ name: 'get_talk', description: 'A talk of the conference, by its id', input_schema: inputSchema }],
                },
            })
            const ms = Math.round(performance.now() - start)
            const body = parsed(response.text)
            if (response.ok) direct.push({ ms, usage: usageOf(body['usage']) })
            const type = response.ok ? '' : ` ${String(record(body['error'])['type'] ?? '')}`
            const requestId = response.headers.get('request-id')
            console.log(`with $schema ${String(inputSchema['$schema'])}: ${response.status}${type}${requestId === null ? '' : ` (request ${requestId})`} in ${ms} ms`)
        } catch (error) {
            // Only its name: an error of the client with no answer keeps the request, with the key in its headers.
            console.log(`with $schema ${String(inputSchema['$schema'])}: no answer, ${(error as Error).name}`)
        }
    })
})

function asked(question: string): Pick<RunOptions, 'model' | 'system' | 'messages'> {
    return { model, system, messages: [userMessage(question)] }
}

async function run(options: RunOptions): Promise<RunResult> {
    const before = timed.calls.length
    await using scope = provider.createScope()
    try {
        const result = await scope.get(Ai).run(options)
        console.log(`\n${options.messages.map(message => message.content.map(block => (block.type === 'text' ? block.text : '')).join('')).join()}\n→ ${result.text}`)
        return result
    } finally {
        for (const call of timed.calls.slice(before)) console.log(described(call))
    }
}

function described(call: Call): string {
    if (call.response === null) return `  ${call.ms} ms, failed with ${call.failure}`
    const asked = call.response.message.content.flatMap(block => (block.type === 'toolCall' ? [`${block.name} ${JSON.stringify(block.input)}`] : []))
    return `  ${call.ms} ms, ${call.response.stopReason}${asked.length > 0 ? `, asks for ${asked.join(' and ')}` : ''}, ${tokens(call.response.usage)}, on ${call.response.model}`
}

function tokens(usage: Usage): string {
    return `${usage.inputTokens} in (${usage.cacheReadTokens} read from the cache, ${usage.cacheWriteTokens} written), ${usage.outputTokens} out`
}

// What the answer said it spent, read as AnthropicModel reads it: the input is the three of them.
function usageOf(value: unknown): Usage {
    const usage = record(value)
    const tokens = (field: string) => (typeof usage[field] === 'number' ? usage[field] : null)
    const input = tokens('input_tokens')
    const read = tokens('cache_read_input_tokens')
    const written = tokens('cache_creation_input_tokens')
    return {
        inputTokens: input === null ? null : input + (read ?? 0) + (written ?? 0),
        outputTokens: tokens('output_tokens'),
        cacheReadTokens: read,
        cacheWriteTokens: written,
    }
}

function parsed(text: string): Record<string, unknown> {
    try {
        return record(JSON.parse(text) as unknown)
    } catch {
        return {}
    }
}

function record(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
