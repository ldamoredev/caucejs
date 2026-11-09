import { application, Authorization, ExecutionContext, ForbiddenError, HandlerNotAddedError, NotAuthenticatedError, type Identity } from '@caucejs/application'
import { InvalidArgumentError, NotFoundError } from '@caucejs/base'
import { Services, type Provider } from '@caucejs/di'
import { JsonSchemaUnavailableError, jsonSerializer, ValidationError } from '@caucejs/schema'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tool, ToolRunner, tools, type UseCaseTool } from '../src/index.js'
import {
    Attendee,
    BoxOffice,
    DimTheLights,
    DimTheLightsHandler,
    GetTalk,
    GetTalkHandler,
    GetVenue,
    ImportProgram,
    ImportProgramHandler,
    Journal,
    OpenDoors,
    OpenDoorsHandler,
    QuietRefusalError,
    Recording,
    RefuseQuietly,
    RefuseQuietlyHandler,
    ScheduleTalk,
    SellTickets,
    SellTicketsHandler,
    SoldOutError,
    Talks,
} from './support/conference.js'

describe('a tool', () => {
    it('keeps its request, its name and its description', () => {
        expect(getTalk).toEqual({ request: GetTalk, name: 'get_talk', description: 'A talk of the conference, by its id', readOnly: true })
    })

    it('is read only when its request is a query, and not when it is a command', () => {
        expect(getTalk.readOnly).toBe(true)
        expect(sellTickets.readOnly).toBe(false)
    })

    it('says otherwise when it is told to', () => {
        expect(tool(OpenDoors, { name: 'open_doors', description: 'Opens a gate', readOnly: true }).readOnly).toBe(true)
        expect(tool(GetTalk, { name: 'get_talk', description: 'A talk', readOnly: false }).readOnly).toBe(false)
    })

    it('takes a name of letters, digits, underscores and hyphens, up to 128 of them', () => {
        expect(tool(GetTalk, { name: `Get-talk_2${'a'.repeat(118)}`, description: 'A talk' }).name).toHaveLength(128)
    })

    it.each([
        ['empty', ''],
        ['longer than 128', 'a'.repeat(129)],
        ['with a space', 'get talk'],
        ['with a dot', 'talks.get'],
    ])('refuses a name %s', (_case, name) => {
        expect(() => tool(GetTalk, { name, description: 'A talk' })).toThrow(InvalidArgumentError)
    })

    it('says which argument and why', () => {
        expect(() => tool(GetTalk, { name: 'get talk', description: 'A talk' })).toThrow(
            expect.objectContaining({
                argument: 'name',
                message: 'The name of a tool is 1 to 128 letters, digits, underscores and hyphens, and "get talk" is not',
            }),
        )
    })
})

describe('the tool runner', () => {
    describe('describes a tool', () => {
        it('with its name, its description, the JSON Schema of its input and whether it is read only', () => {
            expect(runner().describe(sellTickets)).toEqual({
                name: 'sell_tickets',
                description: 'Sells seats of a talk, and answers the seats left',
                inputSchema: {
                    $schema: 'https://json-schema.org/draft/2020-12/schema',
                    type: 'object',
                    properties: {
                        talkId: { type: 'string', minLength: 1 },
                        seats: { type: 'integer', exclusiveMinimum: 0, maximum: Number.MAX_SAFE_INTEGER },
                    },
                    required: ['talkId', 'seats'],
                    additionalProperties: false,
                },
                readOnly: false,
            })
        })

        it('anew every time, so changing one changes no other', () => {
            const first = runner().describe(getTalk)
            delete first.inputSchema['$schema']

            expect(runner().describe(getTalk).inputSchema).toHaveProperty('$schema')
        })

        it('fails for a request whose input cannot be said in JSON Schema', () => {
            const scheduleTalk = tool(ScheduleTalk, { name: 'schedule_talk', description: 'Schedules a talk' })

            expect(() => runner().describe(scheduleTalk)).toThrow(JsonSchemaUnavailableError)
        })
    })

    describe('calls a tool', () => {
        it('and answers the result of its use case, as a value and as JSON', async () => {
            expect(await call(getTalk, { talkId: 'opening' })).toEqual({
                ok: true,
                value: { id: 'opening', title: 'Opening', seats: 1 },
                json: '{"id":"opening","title":"Opening","seats":1}',
            })
        })

        it('through every middleware, as the identity it was given', async () => {
            await call(sellTickets, { talkId: 'opening', seats: 1 }, new BoxOffice())

            expect(journal.entries).toEqual(['box office runs SellTickets'])
        })

        it('and answers undefined, written as null, for a command that answers nothing', async () => {
            expect(await call(openDoors, { gate: 'north' })).toEqual({ ok: true, value: undefined, json: 'null' })
            expect(journal.entries).toContain('doors north open')
        })
    })

    describe('answers what failed', () => {
        it('with every issue of an input that does not pass, before any middleware runs', async () => {
            const outcome = await call(sellTickets, { talkId: '', seats: -1, price: 10 }, new BoxOffice())

            expect(outcome).toEqual({
                ok: false,
                message:
                    'The input is not valid: talkId: Too small: expected string to have >=1 characters; seats: Too small: expected number to be >0; Unrecognized key: "price"',
                error: expect.any(ValidationError),
            })
            expect(outcome.ok === false && (outcome.error as ValidationError).issues.map(issue => issue.path)).toEqual(['talkId', 'seats', ''])
            expect(journal.entries).toEqual([])
        })

        it('with every issue of what the use case read and found wrong, as web answers it with a 400', async () => {
            const importProgram = tool(ImportProgram, { name: 'import_program', description: 'Imports the program' })

            expect(await call(importProgram, {})).toEqual({
                ok: false,
                message: 'The input is not valid: talks.0.title: Required',
                error: expect.any(ValidationError),
            })
        })

        it('with the message of an error of the domain', async () => {
            expect(await call(sellTickets, { talkId: 'closing', seats: 1 }, new BoxOffice())).toEqual({
                ok: false,
                message: 'The talk has no seats left',
                error: expect.any(SoldOutError),
            })
        })

        it('with the message of something that was not found, which is an error of the domain', async () => {
            expect(await call(getTalk, { talkId: 'keynote' })).toEqual({
                ok: false,
                message: 'There is no talk keynote',
                error: expect.any(NotFoundError),
            })
        })

        it('with the name of an error of the domain that has no message', async () => {
            const refuseQuietly = tool(RefuseQuietly, { name: 'refuse_quietly', description: 'Refuses' })

            expect(await call(refuseQuietly, {})).toEqual({ ok: false, message: 'QuietRefusalError', error: expect.any(QuietRefusalError) })
        })

        it('with the message of a refusal to someone who cannot', async () => {
            expect(await call(sellTickets, { talkId: 'opening', seats: 1 }, new Attendee())).toEqual({
                ok: false,
                message: 'Forbidden',
                error: expect.any(ForbiddenError),
            })
        })

        it('with nothing of the cause of any other error, which it keeps for the application', async () => {
            const dimTheLights = tool(DimTheLights, { name: 'dim_the_lights', description: 'Dims the lights of the hall' })

            const outcome = await call(dimTheLights, {})

            expect(outcome).toEqual({ ok: false, message: 'Tool execution failed', error: new Error('The dimmer at 10.0.0.7 does not answer') })
        })

        it('with nothing of the cause for a request without a handler', async () => {
            const getVenue = tool(GetVenue, { name: 'get_venue', description: 'The venue' })

            expect(await call(getVenue, {})).toEqual({ ok: false, message: 'Tool execution failed', error: new HandlerNotAddedError('GetVenue') })
        })
    })

    it('throws when nobody calls a tool that needs someone', async () => {
        await expect(call(sellTickets, { talkId: 'opening', seats: 1 })).rejects.toThrow(NotAuthenticatedError)
        expect(journal.entries).toEqual(['anonymous runs SellTickets'])
    })

    describe('is added by tools()', () => {
        it('which fails when the application has no use cases, and says so', () => {
            const services = new Services()
            services.add(jsonSerializer())
            services.add(tools())

            expect(() => services.build({ validate: true })).toThrow('ToolRunner needs UseCases, which was never added')
        })

        it('which fails when the application has no JSON serializer, and says so', () => {
            const services = new Services()
            services.add(application(() => {}))
            services.add(tools())

            expect(() => services.build({ validate: true })).toThrow('ToolRunner needs JsonSerializer, which was never added')
        })

        it('which does nothing when it is added twice', () => {
            const services = new Services()
            services.add(application(() => {}))
            services.add(jsonSerializer())
            services.add(tools())
            services.add(tools())

            expect(services.build({ validate: true }).get(ToolRunner)).toBeInstanceOf(ToolRunner)
        })
    })

    beforeEach(() => {
        journal = new Journal()
        const services = new Services()
        services.addSingleton(Talks)
        services.addInstance(Journal, journal)
        services.add(jsonSerializer())
        services.add(tools())
        services.add(
            application(app => {
                app.use(Recording)
                app.use(Authorization)
                app.handle(GetTalkHandler)
                app.handle(SellTicketsHandler)
                app.handle(OpenDoorsHandler)
                app.handle(DimTheLightsHandler)
                app.handle(RefuseQuietlyHandler)
                app.handle(ImportProgramHandler)
            }),
        )
        provider = services.build({ validate: true })
    })

    afterEach(async () => {
        await provider[Symbol.asyncDispose]()
    })

    function runner(): ToolRunner {
        return provider.get(ToolRunner)
    }

    async function call(tool: UseCaseTool, input: unknown, identity?: Identity) {
        await using scope = provider.createScope()
        return await runner().call(tool, input, { scope, ...(identity && { context: ExecutionContext.of(identity) }) })
    }

    let provider: Provider
    let journal: Journal
})

const getTalk = tool(GetTalk, { name: 'get_talk', description: 'A talk of the conference, by its id' })
const sellTickets = tool(SellTickets, { name: 'sell_tickets', description: 'Sells seats of a talk, and answers the seats left' })
const openDoors = tool(OpenDoors, { name: 'open_doors', description: 'Opens a gate of the venue' })
