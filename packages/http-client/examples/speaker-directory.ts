// The canonical client of another system, to copy: a class that talks to one API builds its client once, with `with`,
// reads what comes back with a schema, and decides what each status means. A test replaces the HttpClient of the
// application with one on a fake fetch, as here, and touches nothing of the process.
import { Services } from '@caucejs/di'
import * as z from 'zod'

import { FetchHttpClient, HttpClient, httpClient } from '../src/index.js'

export type Speaker = { readonly name: string; readonly talks: number }

const speakerSchema = z.object({ name: z.string(), talks: z.number().int() })

export class SpeakerDirectory {
    static readonly inject = [HttpClient] as const
    readonly #http: HttpClient

    constructor(http: HttpClient) {
        this.#http = http.with({ baseUrl: 'https://speakers.example/v1', headers: { authorization: 'Bearer conference' }, timeout: 5_000 })
    }

    // A 404 is an answer here, not a failure: the status is data, and ensureSuccess throws the rest.
    async find(id: string): Promise<Speaker | null> {
        const response = await this.#http.get(`/speakers/${encodeURIComponent(id)}`)
        if (response.status === 404) return null
        return response.ensureSuccess().read(speakerSchema)
    }
}

export async function lookUpSpeakers(): Promise<(Speaker | null)[]> {
    // the fake other system: any function from Request to Response, or the fetch of an application of Cauce
    const speakers = async (request: Request): Promise<Response> =>
        request.url.endsWith('/speakers/ada') ? Response.json({ name: 'Ada', talks: 2 }) : new Response(null, { status: 404 })

    const services = new Services()
    services.add(httpClient())
    services.addSingleton(SpeakerDirectory)
    // in a test, the client of the application sends to the fake
    services.replace(HttpClient, () => new FetchHttpClient({ fetch: speakers }))
    const directory = services.build({ validate: true }).get(SpeakerDirectory)

    return [await directory.find('ada'), await directory.find('grace')]
}
