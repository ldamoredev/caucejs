import { Config, memory } from '@caucejs/config'
import { CompositionError, Services } from '@caucejs/di'
import { FetchHttpClient, HttpClient, httpClient } from '@caucejs/http-client'
import { describe, expect, it } from 'vitest'

import { AnthropicModel, AnthropicSettings, anthropic, Model, userMessage } from '../src/index.js'
import { FakeFetch } from './support/fake-fetch.js'

describe('the extension', () => {
    it('adds a model on Anthropic, over the client of the application', async () => {
        const server = new FakeFetch()
        const services = new Services()
        services.add(httpClient())
        services.add(anthropic())
        services.addInstance(AnthropicSettings, settings())
        services.replace(HttpClient, () => new FetchHttpClient({ fetch: server.fetch }))
        const provider = services.build({ validate: true })

        const response = await provider.get(Model).call({ model: 'claude-haiku-5-5', messages: [userMessage('When is the opening?')] })

        expect(provider.get(Model)).toBeInstanceOf(AnthropicModel)
        expect(provider.get(Model)).toBe(provider.get(Model))
        expect([response.message.content, server.last.url]).toEqual([[{ type: 'text', text: 'The opening is at nine.' }], 'https://api.anthropic.com/v1/messages'])
    })

    it('fails when the container is built without an HttpClient, naming it', () => {
        const services = new Services()
        services.add(anthropic())
        services.addInstance(AnthropicSettings, settings())

        const error = failure(() => services.build({ validate: true }))

        expect(error).toBeInstanceOf(CompositionError)
        expect(error.message).toContain('Model needs HttpClient, which was never added')
    })

    it('fails when the container is built without the settings, naming them', () => {
        const services = new Services()
        services.add(httpClient())
        services.add(anthropic())

        const error = failure(() => services.build({ validate: true }))

        expect(error).toBeInstanceOf(CompositionError)
        expect(error.message).toContain('Model needs AnthropicSettings, which was never added')
    })

    it('is added once when it is added twice', () => {
        const services = new Services()
        services.add(httpClient())
        services.add(anthropic())
        services.add(anthropic())
        services.addInstance(AnthropicSettings, settings())

        expect(services.build({ validate: true }).get(Model)).toBeInstanceOf(AnthropicModel)
    })
})

function settings(): AnthropicSettings {
    return new Config().add(memory({ anthropic: { apiKey: 'sk-ant-conference' } })).bind(AnthropicSettings)
}

function failure(act: () => unknown): Error {
    try {
        act()
    } catch (error) {
        return error as Error
    }
    throw new Error('It did not fail')
}
