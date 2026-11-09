import { describe, expect, it } from 'vitest'

import type { AssistantMessage, Model, ModelRequest, UserMessage } from '../src/index.js'

// The ToolDescription of @caucejs/tools, as its sheet fixes it, copied so this package does not depend on it.
type ToolDescription = {
    readonly name: string
    readonly description: string
    readonly inputSchema: Record<string, unknown>
    readonly readOnly: boolean
}

// These lines are checked by the typecheck: each @ts-expect-error fails it if the line compiles.
export function whatTheCompilerChecks(model: Model, tools: readonly ToolDescription[]): void {
    // a ToolDescription is passed as it is, without translating it
    void model.call({ model: 'claude-haiku-5-5', messages: [], tools })

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
}

describe('the types', () => {
    it('take a ToolDescription as a tool', () => {
        expect(whatTheCompilerChecks).toBeDefined()
    })
})
