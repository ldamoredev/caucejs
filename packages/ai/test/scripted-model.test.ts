import { describe, expect, it } from 'vitest'

import { ModelUnavailableError, ScriptedModel, ScriptExhaustedError, StopReasons, text, toolCall, toolCalls, userMessage } from '../src/index.js'
import { unknownUsage } from '../src/usage.js'

const request = { model: 'claude-haiku-5-5', messages: [userMessage('When is the opening?')] }

describe('a scripted model', () => {
    it('answers its script in order, with the model it was asked for', async () => {
        const model = new ScriptedModel([toolCall('get_talk', { talkId: 'opening' }), text('The opening is at nine.')])

        const first = await model.call(request)
        const second = await model.call(request)

        expect(first).toEqual({
            message: { role: 'assistant', content: [{ type: 'toolCall', id: 'call_1', name: 'get_talk', input: { talkId: 'opening' } }] },
            stopReason: StopReasons.ToolUse,
            usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
            model: 'claude-haiku-5-5',
        })
        expect(second).toMatchObject({ message: { content: [{ type: 'text', text: 'The opening is at nine.' }] }, stopReason: StopReasons.EndTurn })
    })

    it('gives each tool call an id of its own across the script', async () => {
        const model = new ScriptedModel([
            toolCalls([
                { name: 'get_talk', input: { talkId: 'opening' } },
                { name: 'get_talk', input: { talkId: 'closing' } },
            ]),
            toolCall('get_talk', { talkId: 'keynote' }),
        ])

        const ids = [await model.call(request), await model.call(request)].flatMap(response =>
            response.message.content.map(block => (block.type === 'toolCall' ? block.id : null)),
        )

        expect(ids).toEqual(['call_1', 'call_2', 'call_3'])
    })

    it('answers the usage and the stop reason it was given', async () => {
        const usage = { inputTokens: 500, outputTokens: 1024, cacheReadTokens: null, cacheWriteTokens: null }
        const model = new ScriptedModel([text('The opening is at', { usage, stopReason: StopReasons.MaxTokens })])

        expect(await model.call(request)).toMatchObject({ usage, stopReason: StopReasons.MaxTokens })
    })

    it('throws an error of its script on that call', async () => {
        const unavailable = new ModelUnavailableError({ status: 529, requestId: null, usage: unknownUsage })
        const model = new ScriptedModel([unavailable])

        await expect(model.call(request)).rejects.toBe(unavailable)
    })

    it('keeps what it was asked', async () => {
        const model = new ScriptedModel([text('Nine.')])

        await model.call(request)

        expect(model.requests).toEqual([request])
    })

    it('fails past the end of its script, and never repeats its last answer', async () => {
        const model = new ScriptedModel([text('Nine.'), text('Nine again.')])
        await model.call(request)
        await model.call(request)

        const error = await model.call(request).then(
            () => null,
            (thrown: unknown) => thrown,
        )

        expect(error).toBeInstanceOf(ScriptExhaustedError)
        expect(error).toMatchObject({ message: 'The scripted model has no answer left: it was asked 3 times and has 2', asked: 3, answers: 2 })
    })

    it('says so with an empty script', async () => {
        await expect(new ScriptedModel([]).call(request)).rejects.toThrow('The scripted model has no answer left: it was asked 1 time and has 0')
    })
})
