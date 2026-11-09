// The canonical use of ai, to copy: a use case that answers questions about the program of the conference, and gives
// the model two queries of the application as its tools. The model asks; Ai runs the tools in the scope of the request,
// through every middleware and as whoever asked; and the answer comes back with the tokens it spent. In production the
// application adds `anthropic()`; here a ScriptedModel answers, so nothing goes to the network.
import { application, Authorization, Handler, Query, UseCases, type ExecutionContext } from '@caucejs/application'
import { NotFoundError } from '@caucejs/base'
import { Services } from '@caucejs/di'
import { jsonSerializer } from '@caucejs/schema'
import { tool, tools } from '@caucejs/tools'
import * as z from 'zod'

import { Ai, ai, MaxStepsExceededError, Model, ScriptedModel, text, toolCall, userMessage, type Usage } from '../src/index.js'

export type Talk = { readonly id: string; readonly title: string; readonly speaker: string; readonly startsAt: string }

export class Talks {
    readonly #talks: readonly Talk[] = [
        { id: 'opening', title: 'Opening', speaker: 'Ada', startsAt: '09:00' },
        { id: 'types', title: 'The state of types', speaker: 'Ada', startsAt: '11:00' },
        { id: 'closing', title: 'Closing', speaker: 'Grace', startsAt: '18:00' },
    ]

    get(id: string): Talk {
        const talk = this.#talks.find(talk => talk.id === id)
        // an error of the domain, so the model reads why and can ask again: a plain Error reads "Tool execution failed"
        if (!talk) throw new NotFoundError(`There is no talk ${id}`)
        return talk
    }

    by(speaker: string): readonly Talk[] {
        return this.#talks.filter(talk => talk.speaker === speaker)
    }
}

// The tools are queries the application already has: the schema that reads a web request reads what the model sends.
export class GetTalk extends Query.returning<Talk>().from(z.strictObject({ talkId: z.string().min(1) })) {
    static readonly anonymous = true
}

export class FindTalks extends Query.returning<readonly Talk[]>().from(z.strictObject({ speaker: z.string().min(1) })) {
    static readonly anonymous = true
}

export class GetTalkHandler extends Handler.of(GetTalk) {
    static readonly inject = [Talks] as const
    readonly #talks: Talks

    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }

    async execute(request: GetTalk): Promise<Talk> {
        return this.#talks.get(request.talkId)
    }
}

export class FindTalksHandler extends Handler.of(FindTalks) {
    static readonly inject = [Talks] as const
    readonly #talks: Talks

    constructor(talks: Talks) {
        super()
        this.#talks = talks
    }

    async execute(request: FindTalks): Promise<readonly Talk[]> {
        return this.#talks.by(request.speaker)
    }
}

export const getTalk = tool(GetTalk, { name: 'get_talk', description: 'A talk of the conference, by its id, with its speaker and when it starts' })
export const findTalks = tool(FindTalks, { name: 'find_talks', description: 'The talks of a speaker, by the name of the speaker' })

export type Answer = { readonly text: string; readonly usage: Usage; readonly model: string }

export class AskTheProgram extends Query.returning<Answer>().from(z.strictObject({ question: z.string().min(1).max(500) })) {
    static readonly anonymous = true
}

// Ai is scoped: the handler is built in the scope of the request, and so is the Ai it receives.
export class AskTheProgramHandler extends Handler.of(AskTheProgram) {
    static readonly inject = [Ai] as const
    readonly #ai: Ai

    constructor(ai: Ai) {
        super()
        this.#ai = ai
    }

    async execute(request: AskTheProgram, context: ExecutionContext): Promise<Answer> {
        const result = await this.#ai.run({
            model: 'claude-haiku-5-5', // the application picks it: ai keeps no catalog
            system: 'You answer questions about the program of the conference, and name the talk of each answer.',
            messages: [userMessage(request.question)],
            tools: [getTalk, findTalks],
            context, // the tools run as whoever asked, in this scope
            maxSteps: 6,
        })
        // the usage is in tokens, with the model: the price and the budget are the application's
        return { text: result.text, usage: result.usage, model: result.model }
    }
}

/**
 * The program, composed as statements, without its model: the application adds `anthropic()` with its settings, and a
 * test a `ScriptedModel`.
 */
export function theProgram(services: Services): void {
    services.addSingleton(Talks)
    services.add(jsonSerializer())
    services.add(tools())
    services.add(ai())
    services.add(
        application(app => {
            app.use(Authorization)
            app.handle(AskTheProgramHandler)
            app.handle(GetTalkHandler)
            app.handle(FindTalksHandler)
        }),
    )
}

export async function askTheProgram(): Promise<string[]> {
    const model = new ScriptedModel([
        toolCall('find_talks', { speaker: 'Ada' }, { usage: spent(600, 40) }),
        // the model asks for a talk that is not there, reads why, and asks again
        toolCall('get_talk', { talkId: 'keynote' }, { usage: spent(700, 30) }),
        toolCall('get_talk', { talkId: 'opening' }, { usage: spent(800, 30) }),
        text('Ada opens the conference at nine, with the Opening.', { usage: spent(900, 20) }),
    ])
    const answer = await ask(model, 'When does Ada speak first?')

    // what each tool answered went back to the model, in the message after the step that asked for it
    const read = model.requests.slice(1).flatMap(request => {
        const results = request.messages.at(-1)
        if (results?.role !== 'user') return []
        return results.content.map(block => (block.type === 'toolResult' ? `${block.isError ? 'failed: ' : ''}${block.content}` : block.text))
    })

    // a run that does not end within its most steps fails, with the tools that ran and what it spent
    const looping = new ScriptedModel(Array.from({ length: 6 }, () => toolCall('find_talks', { speaker: 'Grace' }, { usage: spent(500, 10) })))
    const stopped = await ask(looping, 'Which talks does Grace give?').then(
        () => 'answered',
        (error: unknown) => {
            if (!(error instanceof MaxStepsExceededError)) throw error
            return `${error.message}, after ${error.calledTools.length} calls to ${error.calledTools[0]}, with ${error.usage.inputTokens} tokens in`
        },
    )

    return [...read, answer.text, `${answer.usage.inputTokens} tokens in and ${answer.usage.outputTokens} out, on ${answer.model}`, stopped]
}

async function ask(model: Model, question: string): Promise<Answer> {
    const services = new Services()
    theProgram(services)
    services.addInstance(Model, model)
    await using provider = services.build({ validate: true })
    // whoever runs the use case opens the scope and says who asks, as web does for a request
    await using scope = provider.createScope()
    return await provider.get(UseCases).execute(new AskTheProgram({ question }), { scope })
}

function spent(input: number, output: number): Usage {
    return { inputTokens: input, outputTokens: output, cacheReadTokens: 0, cacheWriteTokens: 0 }
}
