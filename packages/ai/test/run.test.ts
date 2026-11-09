import { ExecutionContext, NotAuthenticatedError } from '@caucejs/application'
import { InvalidArgumentError } from '@caucejs/base'
import type { UseCaseTool } from '@caucejs/tools'
import { describe, expect, it } from 'vitest'

import {
    Ai,
    IncompleteResponseError,
    MaxStepsExceededError,
    ModelError,
    ModelRateLimitError,
    ScriptedModel,
    StopReasons,
    text,
    toolCall,
    toolCalls,
    userMessage,
    type RunOptions,
    type RunResult,
    type ScriptedAnswer,
    type ToolResultBlock,
    type Usage,
} from '../src/index.js'
import { unknownUsage } from '../src/usage.js'
import { Attendee, conference, getTalk, Journal, sellTicket, starTalk } from './support/conference.js'

describe('a run', () => {
    it('answers in one step when the model asks for no tool', async () => {
        const model = new ScriptedModel([text('The opening is at nine.')])

        const { result } = await asking(model, { model: 'claude-haiku-5-5', system: 'You know the program.', messages: [userMessage('When is the opening?')] })

        expect(result).toMatchObject({ text: 'The opening is at nine.', stopReason: StopReasons.EndTurn, model: 'claude-haiku-5-5' })
        expect(result.steps).toHaveLength(1)
        expect(model.requests).toEqual([{ model: 'claude-haiku-5-5', system: 'You know the program.', messages: [userMessage('When is the opening?')] }])
    })

    it('tells the model what each tool takes, as the runner describes it', async () => {
        const model = new ScriptedModel([text('Done.')])

        await asking(model, withTools([getTalk, sellTicket]))

        expect(model.requests[0]?.tools?.map(({ name, description, inputSchema }) => [name, description, inputSchema['required']])).toEqual([
            ['get_talk', 'A talk of the conference, by its id', ['talkId']],
            ['sell_ticket', 'Sells one seat of a talk', ['talkId']],
        ])
    })

    it('runs the tool the model asks for, as whoever asked and through every middleware, and gives it its result', async () => {
        const model = new ScriptedModel([toolCall('get_talk', { talkId: 'opening' }), text('The opening is at nine.')])

        const { result, journal } = await asking(model, withTools([getTalk]))

        expect(journal).toEqual(['GetTalk as attendee', 'get opening'])
        expect(lastResults(model)).toEqual([
            { type: 'toolResult', toolCallId: 'call_1', content: '{"id":"opening","title":"Opening","startsAt":"09:00"}', isError: false },
        ])
        expect(result.text).toBe('The opening is at nine.')
        expect(result.steps.map(step => step.results.length)).toEqual([1, 0])
    })

    it('gives the model the whole conversation on each step', async () => {
        const model = new ScriptedModel([toolCall('get_talk', { talkId: 'opening' }), text('At nine.')])

        const { result } = await asking(model, withTools([getTalk]))

        expect(model.requests[1]?.messages).toEqual([
            userMessage('When is the opening?'),
            result.steps[0]?.message,
            { role: 'user', content: result.steps[0]?.results },
        ])
    })

    it('gives back a tool that fails as an error for the model to read, and goes on', async () => {
        const model = new ScriptedModel([toolCall('get_talk', { talkId: 'keynote' }), text('There is no keynote.')])

        const { result } = await asking(model, withTools([getTalk]))

        expect(lastResults(model)).toEqual([{ type: 'toolResult', toolCallId: 'call_1', content: 'There is no talk keynote', isError: true }])
        expect(result.text).toBe('There is no keynote.')
    })

    it('gives back an input that does not pass with every issue', async () => {
        const model = new ScriptedModel([toolCall('get_talk', { talk: 'opening' }), text('Sorry.')])

        await asking(model, withTools([getTalk]))

        expect(lastResults(model)[0]).toMatchObject({ isError: true, content: expect.stringContaining('Unrecognized key: "talk"') })
    })

    it('gives back a tool out of the permissions of whoever asked, and goes on', async () => {
        const model = new ScriptedModel([toolCall('sell_ticket', { talkId: 'opening' }), text('You cannot sell tickets.')])

        const { result, journal } = await asking(model, withTools([sellTicket]))

        expect(lastResults(model)).toEqual([{ type: 'toolResult', toolCallId: 'call_1', content: 'Forbidden', isError: true }])
        expect(journal).toEqual(['SellTicket as attendee', 'SellTicket failed with ForbiddenError'])
        expect(result.text).toBe('You cannot sell tickets.')
    })

    it('ends the run when nobody asked and the tool needs someone', async () => {
        const model = new ScriptedModel([toolCall('sell_ticket', { talkId: 'opening' }), text('Sold.')])

        const error = await failing(asking(model, withTools([sellTicket], ExecutionContext.anonymous())))

        expect(error).toBeInstanceOf(NotAuthenticatedError)
        expect(model.requests).toHaveLength(1)
    })

    it('tells the model the tools it has when it names one the run does not have', async () => {
        const model = new ScriptedModel([toolCall('find_talks', { day: 1 }), text('Sorry.')])

        await asking(model, withTools([getTalk, sellTicket, starTalk]))

        expect(lastResults(model)).toEqual([
            { type: 'toolResult', toolCallId: 'call_1', content: 'There is no tool named "find_talks". The tools are get_talk, sell_ticket and star_talk', isError: true },
        ])
    })

    it('tells the model there are no tools when it asks for one in a run without them', async () => {
        const model = new ScriptedModel([toolCall('get_talk', { talkId: 'opening' }), text('Sorry.')])

        await asking(model, { ...question })

        expect(lastResults(model)[0]?.content).toBe('There is no tool named "get_talk", and there are no tools')
    })

    it('runs the tools of a step one after the other, in the order the model asked, and answers them in that order', async () => {
        const model = new ScriptedModel([
            toolCalls([
                { name: 'get_talk', input: { talkId: 'closing' } },
                { name: 'find_talks', input: {} },
                { name: 'get_talk', input: { talkId: 'opening' } },
            ]),
            text('Both.'),
        ])

        const { journal } = await asking(model, withTools([getTalk]))

        expect(journal).toEqual(['GetTalk as attendee', 'get closing', 'GetTalk as attendee', 'get opening'])
        expect(lastResults(model).map(result => [result.toolCallId, result.isError])).toEqual([
            ['call_1', false],
            ['call_2', true],
            ['call_3', false],
        ])
    })

    it('writes what a tool that answers nothing answered as null', async () => {
        const model = new ScriptedModel([toolCall('star_talk', { talkId: 'opening' }), text('Starred.')])

        await asking(model, withTools([starTalk]))

        expect(lastResults(model)[0]).toMatchObject({ content: 'null', isError: false })
    })

    it('fails before calling the model for tools without a context', async () => {
        const model = new ScriptedModel([text('Done.')])
        // what the compiler refuses, from a caller it cannot check
        const options = { ...question, tools: [getTalk] } as unknown as RunOptions

        const error = await failing(asking(model, options))

        expect(error).toBeInstanceOf(InvalidArgumentError)
        expect(error).toMatchObject({ argument: 'context' })
        expect(model.requests).toEqual([])
    })

    it('fails before calling the model for two tools with one name', async () => {
        const model = new ScriptedModel([text('Done.')])

        const error = await failing(asking(model, withTools([getTalk, { ...sellTicket, name: 'get_talk' }])))

        expect(error).toMatchObject({ argument: 'tools', message: 'Two tools of a run are named get_talk, and the model could not tell them apart' })
        expect(model.requests).toEqual([])
    })
})

describe('the most steps of a run', () => {
    it('are 10, and past them it fails without running the tools of the last step', async () => {
        const model = new ScriptedModel(Array.from({ length: 11 }, () => toolCall('get_talk', { talkId: 'opening' }, { usage: spent(100, 10) })))
        const scope = conference(model).build({ validate: true }).createScope()

        const error = await failing(scope.get(Ai).run(withTools([getTalk])))

        expect(error).toBeInstanceOf(MaxStepsExceededError)
        expect(error).toMatchObject({
            message: 'The run reached its most steps, 10 steps, and the model still asked for tools',
            maxSteps: 10,
            calledTools: Array.from({ length: 9 }, () => 'get_talk'),
            usage: spent(1000, 100),
        })
        expect(model.requests).toHaveLength(10)
        expect(scope.get(Journal).entries.filter(entry => entry === 'get opening')).toHaveLength(9)
    })

    it('are what the run says', async () => {
        const model = new ScriptedModel([toolCall('get_talk', { talkId: 'opening' }), toolCall('get_talk', { talkId: 'closing' })])

        const error = await failing(asking(model, { ...withTools([getTalk]), maxSteps: 2 }))

        expect(error).toMatchObject({ maxSteps: 2, calledTools: ['get_talk'] })
    })

    it('let the last step answer without tools', async () => {
        const model = new ScriptedModel([text('The opening is at nine.')])

        const { result } = await asking(model, { ...withTools([getTalk]), maxSteps: 1 })

        expect(result.text).toBe('The opening is at nine.')
    })

    it('carry what was done without its content', async () => {
        const model = new ScriptedModel([toolCall('get_talk', { talkId: 'opening' }), toolCall('get_talk', { talkId: 'closing' })])

        const error = await failing(asking(model, { ...withTools([getTalk]), maxSteps: 2 }))

        expect(Object.keys(error).sort()).toEqual(['calledTools', 'maxSteps', 'name', 'usage'])
        expect(JSON.stringify(error)).not.toContain('Opening')
    })

    it.each([0, -1, 1.5, Number.NaN])('are a whole number above 0, and %s is not', async maxSteps => {
        const model = new ScriptedModel([text('Done.')])

        const error = await failing(asking(model, { ...question, maxSteps }))

        expect(error).toMatchObject({ argument: 'maxSteps' })
        expect(model.requests).toEqual([])
    })
})

describe('the usage of a run', () => {
    it('is the usage of each step, and all of them added, with the model that answered', async () => {
        const model = new ScriptedModel([
            toolCall('get_talk', { talkId: 'opening' }, { usage: { inputTokens: 500, outputTokens: 40, cacheReadTokens: 100, cacheWriteTokens: 0 } }),
            text('At nine.', { usage: { inputTokens: 700, outputTokens: 20, cacheReadTokens: 300, cacheWriteTokens: 50 } }),
        ])

        const { result } = await asking(model, withTools([getTalk]))

        expect(result.steps.map(step => step.usage.inputTokens)).toEqual([500, 700])
        expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 60, cacheReadTokens: 400, cacheWriteTokens: 50 })
        expect(result.steps.map(step => step.model)).toEqual(['claude-haiku-5-5', 'claude-haiku-5-5'])
    })

    it('does not know a field one of the steps does not know', async () => {
        const model = new ScriptedModel([
            toolCall('get_talk', { talkId: 'opening' }, { usage: spent(500, 40) }),
            text('At nine.', { usage: { ...spent(700, 20), cacheReadTokens: null } }),
        ])

        const { result } = await asking(model, withTools([getTalk]))

        expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 60, cacheReadTokens: null, cacheWriteTokens: 0 })
    })

    it('of a call that fails in the third step is what the first two spent, in the same error', async () => {
        const limited = new ModelRateLimitError({ retryAfter: 30, requestId: 'req_3', usage: unknownUsage })
        const model = new ScriptedModel([tooling(spent(500, 40)), tooling(spent(700, 30)), limited])

        const error = await failing(asking(model, withTools([getTalk])))

        expect(error).toBeInstanceOf(ModelRateLimitError)
        expect(error).toMatchObject({ retryAfter: 30, requestId: 'req_3', usage: spent(1200, 70), message: limited.message })
        expect(limited.usage).toEqual(unknownUsage)
    })

    it('adds the call that fails when it says what it spent', async () => {
        const cut = new IncompleteResponseError({ reason: 'maxTokens', requestId: 'req_3', usage: spent(900, 1024) })
        const model = new ScriptedModel([tooling(spent(500, 40)), tooling(spent(700, 30)), cut])

        const error = await failing(asking(model, withTools([getTalk])))

        expect(error).toBeInstanceOf(IncompleteResponseError)
        expect(error).toMatchObject({ reason: 'maxTokens', usage: spent(2100, 1094) })
    })

    it('is unknown when the first call fails', async () => {
        const model = new ScriptedModel([new ModelRateLimitError({ retryAfter: null, requestId: null, usage: unknownUsage })])

        const error = await failing(asking(model, withTools([getTalk])))

        expect(error).toMatchObject({ usage: unknownUsage })
    })

    it('keeps the class, the fields and the cause of an error this package does not know', async () => {
        const quota = new QuotaError('monthly', spent(10, 0), { cause: new Error('the quota') })
        const model = new ScriptedModel([tooling(spent(500, 40)), quota])

        const error = await failing(asking(model, withTools([getTalk])))

        expect(error).toBeInstanceOf(QuotaError)
        expect(error).toMatchObject({ name: 'QuotaError', period: 'monthly', message: 'The quota of monthly is spent', usage: spent(510, 40) })
        expect((error as Error).cause).toBe(quota.cause)
        expect((error as Error).stack).toBe(quota.stack)
    })

    it('leaves out what is not an error of a model, which is thrown as it is', async () => {
        const broken = new TypeError('the model is broken')
        const model = new ScriptedModel([tooling(spent(500, 40)), broken])

        expect(await failing(asking(model, withTools([getTalk])))).toBe(broken)
    })
})

const question = { model: 'claude-haiku-5-5', messages: [userMessage('When is the opening?')] } as const

function withTools(tools: readonly UseCaseTool[], context = ExecutionContext.of(new Attendee())): RunOptions {
    return { ...question, tools, context }
}

async function asking(model: ScriptedModel, options: RunOptions): Promise<{ result: RunResult; journal: readonly string[] }> {
    await using scope = conference(model).build({ validate: true }).createScope()
    const result = await scope.get(Ai).run(options)
    return { result, journal: scope.get(Journal).entries }
}

function lastResults(model: ScriptedModel): readonly ToolResultBlock[] {
    const last = model.requests.at(-1)?.messages.at(-1)
    if (last?.role !== 'user') throw new Error('The last message is not the results of the tools')
    return last.content.filter(block => block.type === 'toolResult')
}

function tooling(usage: Usage): ScriptedAnswer {
    return toolCall('get_talk', { talkId: 'opening' }, { usage })
}

function spent(input: number, output: number): Usage {
    return { inputTokens: input, outputTokens: output, cacheReadTokens: 0, cacheWriteTokens: 0 }
}

async function failing(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise
    } catch (error) {
        return error as Error
    }
    throw new Error('It did not fail')
}

// An error of a model that this package does not know, with a field of its own.
class QuotaError extends ModelError {
    readonly period: string

    constructor(period: string, usage: Usage, options?: ErrorOptions) {
        super(`The quota of ${period} is spent`, usage, options)
        this.period = period
    }
}

