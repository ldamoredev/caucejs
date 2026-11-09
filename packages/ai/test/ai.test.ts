import { application, ExecutionContext, Handler, Query, UseCases } from '@caucejs/application'
import { Config, memory } from '@caucejs/config'
import { CompositionError, ScopeError, Services } from '@caucejs/di'
import { httpClient } from '@caucejs/http-client'
import { jsonSerializer } from '@caucejs/schema'
import { tool, tools } from '@caucejs/tools'
import { describe, expect, it } from 'vitest'
import * as z from 'zod'

import { Ai, AnthropicSettings, ai, anthropic, DefaultAi, Model, ScriptedModel, text, toolCall, userMessage } from '../src/index.js'
import { Attendee, conference, Journal, Journaling } from './support/conference.js'

describe('ai()', () => {
    it('adds an Ai for each scope', async () => {
        const provider = conference(new ScriptedModel([])).build({ validate: true })
        await using one = provider.createScope()
        await using other = provider.createScope()

        expect(one.get(Ai)).toBeInstanceOf(DefaultAi)
        expect(one.get(Ai)).toBe(one.get(Ai))
        expect(one.get(Ai)).not.toBe(other.get(Ai))
    })

    it('runs the tools in the scope of the use case that asked, as whoever asked it', async () => {
        const services = new Services()
        services.add(httpClient())
        services.add(anthropic())
        services.addInstance(AnthropicSettings, new Config().add(memory({ anthropic: { apiKey: 'sk-ant-conference' } })).bind(AnthropicSettings))
        services.add(jsonSerializer())
        services.add(tools())
        services.add(ai())
        services.addSingleton(Talks)
        services.addScoped(Journal)
        services.add(
            application(app => {
                app.use(Journaling)
                app.handle(AskTheProgramHandler)
                app.handle(GetTalkHandler)
            }),
        )
        // in a test: no network
        services.replace(Model, () => new ScriptedModel([toolCall('get_talk', { talkId: 'opening' }), text('The opening is at nine.')]))
        const provider = services.build({ validate: true })
        await using scope = provider.createScope()

        const answer = await provider.get(UseCases).execute(new AskTheProgram({ question: 'When is the opening?' }), { scope, context: ExecutionContext.of(new Attendee()) })

        expect(answer).toBe('The opening is at nine.')
        expect(scope.get(Journal).entries).toEqual(['AskTheProgram as attendee', 'GetTalk as attendee', 'get opening in the scope that asked'])
    })

    it('fails when the container is built without a Model, naming it', () => {
        const services = new Services()
        services.add(jsonSerializer())
        services.add(tools())
        services.add(ai())
        services.add(application(() => {}))

        const error = failure(() => services.build({ validate: true }))

        expect(error).toBeInstanceOf(CompositionError)
        expect(error.message).toContain('AiDependencies needs Model, which was never added')
    })

    it('fails when the container is built without the tools, naming the ToolRunner', () => {
        const services = new Services()
        services.addInstance(Model, new ScriptedModel([]))
        services.add(ai())

        const error = failure(() => services.build({ validate: true }))

        expect(error).toBeInstanceOf(CompositionError)
        expect(error.message).toContain('AiDependencies needs ToolRunner, which was never added')
    })

    it('fails when the Ai is asked for outside a scope', () => {
        const provider = conference(new ScriptedModel([])).build({ validate: true })

        expect(() => provider.get(Ai)).toThrow(ScopeError)
    })

    it('is added once when it is added twice', async () => {
        const services = conference(new ScriptedModel([]))
        services.add(ai())
        await using scope = services.build({ validate: true }).createScope()

        expect(scope.get(Ai)).toBeInstanceOf(DefaultAi)
    })

    // The limit of the factory of Ai: the resolver it keeps carries the path Ai was built on, and the container checks
    // that path before the services the scope already built. So a tool whose handler, or anything it injects, asks for
    // a service on that path finds a cycle that is not there: Ai itself, or anything between the handler that asked
    // and Ai, even built already and even when the tool never asks for Ai. When di forgets that path, these two tests
    // fail and the README changes.
    it('cannot run a tool whose handler asks for Ai itself', async () => {
        const model = new ScriptedModel([toolCall('summarize', {}), text('No summary.')])
        const provider = withSummarize(model).build({ validate: true })
        await using scope = provider.createScope()

        await scope.get(Ai).run({ model: 'claude-haiku-5-5', messages: [userMessage('Summarize.')], tools: [summarize], context: ExecutionContext.of(new Attendee()) })

        expect(scope.get(Journal).entries).toEqual(['Summarize as attendee', 'Summarize failed with CircularDependencyError'])
        expect(model.requests[1]?.messages.at(-1)?.content).toEqual([{ type: 'toolResult', toolCallId: 'call_1', content: 'Tool execution failed', isError: true }])
    })

    it('cannot run a tool whose handler asks for a service on the path Ai was built on, though the scope built it', async () => {
        const model = new ScriptedModel([toolCall('read_notes', {}), text('No notes.')])
        const provider = withConversation(model).build({ validate: true })
        await using scope = provider.createScope()

        const answer = await provider.get(UseCases).execute(new Ask({ question: 'What did I note?' }), { scope, context: ExecutionContext.of(new Attendee()) })

        expect(answer).toBe('No notes.')
        expect(scope.get(Journal).entries).toEqual(['Ask as attendee', 'ReadNotes as attendee', 'ReadNotes failed with CircularDependencyError'])
        expect(model.requests[1]?.messages.at(-1)?.content).toEqual([{ type: 'toolResult', toolCallId: 'call_1', content: 'Tool execution failed', isError: true }])
    })
})

class Talks {
    startOf(talkId: string): string {
        return talkId === 'opening' ? '09:00' : '18:00'
    }
}

class GetTalk extends Query.returning<string>().from(z.strictObject({ talkId: z.string().min(1) })) {}

class GetTalkHandler extends Handler.of(GetTalk) {
    static readonly inject = [Talks, Journal] as const
    readonly #talks: Talks
    readonly #journal: Journal

    constructor(talks: Talks, journal: Journal) {
        super()
        this.#talks = talks
        this.#journal = journal
    }

    async execute(request: GetTalk): Promise<string> {
        this.#journal.entries.push(`get ${request.talkId} in the scope that asked`)
        return this.#talks.startOf(request.talkId)
    }
}

const getStart = tool(GetTalk, { name: 'get_talk', description: 'When a talk starts, by its id' })

class AskTheProgram extends Query.returning<string>().from(z.strictObject({ question: z.string().min(1) })) {}

class AskTheProgramHandler extends Handler.of(AskTheProgram) {
    static readonly inject = [Ai] as const
    readonly #ai: Ai

    constructor(ai: Ai) {
        super()
        this.#ai = ai
    }

    async execute(request: AskTheProgram, context: ExecutionContext): Promise<string> {
        const result = await this.#ai.run({ model: 'claude-haiku-5-5', messages: [userMessage(request.question)], tools: [getStart], context })
        return result.text
    }
}

class Summarize extends Query.returning<string>().from(z.strictObject({})) {
    static readonly anonymous = true
}

class SummarizeHandler extends Handler.of(Summarize) {
    static readonly inject = [Ai] as const

    constructor(_ai: Ai) {
        super()
    }

    async execute(): Promise<string> {
        return 'A summary.'
    }
}

const summarize = tool(Summarize, { name: 'summarize', description: 'A summary of the program' })

function withSummarize(model: Model): Services {
    const services = new Services()
    services.addScoped(Journal)
    services.addInstance(Model, model)
    services.add(jsonSerializer())
    services.add(tools())
    services.add(ai())
    services.add(
        application(app => {
            app.use(Journaling)
            app.handle(SummarizeHandler)
        }),
    )
    return services
}

// One for each scope, on the path from the handler that asks to Ai: AskHandler -> Conversation -> Ai.
class Conversation {
    static readonly inject = [Ai] as const
    readonly #ai: Ai

    constructor(ai: Ai) {
        this.#ai = ai
    }

    async ask(question: string, context: ExecutionContext): Promise<string> {
        const result = await this.#ai.run({ model: 'claude-haiku-5-5', messages: [userMessage(question)], tools: [readNotes], context })
        return result.text
    }
}

class Ask extends Query.returning<string>().from(z.strictObject({ question: z.string().min(1) })) {}

class AskHandler extends Handler.of(Ask) {
    static readonly inject = [Conversation] as const
    readonly #conversation: Conversation

    constructor(conversation: Conversation) {
        super()
        this.#conversation = conversation
    }

    async execute(request: Ask, context: ExecutionContext): Promise<string> {
        return this.#conversation.ask(request.question, context)
    }
}

class ReadNotes extends Query.returning<string>().from(z.strictObject({})) {}

// It never asks for Ai: only for the Conversation the scope already built.
class ReadNotesHandler extends Handler.of(ReadNotes) {
    static readonly inject = [Conversation] as const

    constructor(_conversation: Conversation) {
        super()
    }

    async execute(): Promise<string> {
        return 'The notes.'
    }
}

const readNotes = tool(ReadNotes, { name: 'read_notes', description: 'The notes of whoever asks' })

function withConversation(model: Model): Services {
    const services = new Services()
    services.addScoped(Journal)
    services.addScoped(Conversation)
    services.addInstance(Model, model)
    services.add(jsonSerializer())
    services.add(tools())
    services.add(ai())
    services.add(
        application(app => {
            app.use(Journaling)
            app.handle(AskHandler)
            app.handle(ReadNotesHandler)
        }),
    )
    return services
}

function failure(act: () => unknown): Error {
    try {
        act()
    } catch (error) {
        return error as Error
    }
    throw new Error('It did not fail')
}
