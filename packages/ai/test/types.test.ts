import { ExecutionContext } from '@caucejs/application'
import type { ToolDescription, UseCaseTool } from '@caucejs/tools'
import { describe, expect, it } from 'vitest'

import type { Ai, AssistantMessage, Model, ModelRequest, ModelTool, UserMessage } from '../src/index.js'

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export function whatTheCompilerChecks(model: Model, described: readonly ToolDescription[], ai: Ai, tools: readonly UseCaseTool[]): void {
    // a ToolDescription is passed as it is, without translating it
    void model.call({ model: 'claude-haiku-5-5', messages: [], tools: described })
    const asTheModelIsTold: readonly ModelTool[] = described
    void asTheModelIsTold

    const user: UserMessage = { role: 'user', content: [] }
    const assistant: AssistantMessage = { role: 'assistant', content: [] }
    void [user, assistant]

    // @ts-expect-error the user does not call tools
    const calling: UserMessage = { role: 'user', content: [{ type: 'toolCall', id: 'toolu_01', name: 'get_talk', input: {} }] }
    // @ts-expect-error the model does not answer tools
    const answering: AssistantMessage = { role: 'assistant', content: [{ type: 'toolResult', toolCallId: 'toolu_01', content: '', isError: false }] }
    // @ts-expect-error a request names its model
    const anonymous: ModelRequest = { messages: [] }
    void [calling, answering, anonymous]

    const context = ExecutionContext.anonymous()
    // a run without tools needs no context, and may have one
    void ai.run({ model: 'claude-haiku-5-5', messages: [] })
    void ai.run({ model: 'claude-haiku-5-5', messages: [], context })
    // a run with tools runs them as whoever asks, so it takes their context, also from a list of tools in a variable
    void ai.run({ model: 'claude-haiku-5-5', messages: [], tools, context })
    // @ts-expect-error a run with tools takes the context of whoever asks
    void ai.run({ model: 'claude-haiku-5-5', messages: [], tools })
    // @ts-expect-error an empty list of tools is still tools
    void ai.run({ model: 'claude-haiku-5-5', messages: [], tools: [] })
}

describe('the types', () => {
    it('are checked by the typecheck', () => {
        expect(whatTheCompilerChecks).toBeTypeOf('function')
    })
})
