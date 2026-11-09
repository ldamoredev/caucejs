import { Config, environment, InvalidSettingsError, memory } from '@caucejs/config'
import { describe, expect, it } from 'vitest'

import { AnthropicSettings } from '../src/index.js'

describe('the settings of Anthropic', () => {
    it('read the key from ANTHROPIC__API_KEY, with the defaults', () => {
        const settings = new Config().add(environment({ ANTHROPIC__API_KEY: 'sk-ant-conference' })).bind(AnthropicSettings)

        expect({ ...settings }).toEqual({ apiKey: 'sk-ant-conference', version: '2026-10-21', timeout: 120_000 })
    })

    it('read the version, the workspace and a timeout written as text', () => {
        const settings = new Config()
            .add(environment({ ANTHROPIC__API_KEY: 'sk-ant-conference', ANTHROPIC__VERSION: '2027-01-01', ANTHROPIC__WORKSPACE_ID: 'wrkspc_conference', ANTHROPIC__TIMEOUT: '60000' }))
            .bind(AnthropicSettings)

        expect({ ...settings }).toEqual({ apiKey: 'sk-ant-conference', version: '2027-01-01', workspaceId: 'wrkspc_conference', timeout: 60_000 })
    })

    it('fail without a key, naming it', () => {
        const error = failure(() => new Config().add(environment({})).bind(AnthropicSettings))

        expect(error).toBeInstanceOf(InvalidSettingsError)
        expect(error.message).toBe('The settings of anthropic are wrong:\n- anthropic.apiKey: Expected an API key (not set)')
    })

    it('fail with every problem at once, and never show a value', () => {
        const error = failure(() => new Config().add(memory({ anthropic: { apiKey: ' ', version: '', timeout: 'soon' } })).bind(AnthropicSettings))

        expect((error as InvalidSettingsError).problems).toHaveLength(3)
        expect(error.message).not.toContain('soon')
    })
})

function failure(act: () => unknown): Error {
    try {
        act()
    } catch (error) {
        return error as Error
    }
    throw new Error('It did not fail')
}
