import { describe, expect, it } from 'vitest'

import { environment } from '../src/index.js'

describe('the environment as a source', () => {
    it('turns __ into levels and each word into camel case', () => {
        const source = environment({ GITHUB__REPOSITORY_NAME: 'ada/talks', PORT: '3000', GITHUB_TOKEN: 't' })

        expect(source.entries).toEqual([
            { path: ['github', 'repositoryName'], value: 'ada/talks', key: 'GITHUB__REPOSITORY_NAME' },
            { path: ['port'], value: '3000', key: 'PORT' },
            { path: ['githubToken'], value: 't', key: 'GITHUB_TOKEN' },
        ])
    })

    it('reads only the variables with the prefix, and cuts it', () => {
        const source = environment({ CAUCE_VENUE__CITY: 'Rosario', VENUE__CITY: 'Córdoba' }, { prefix: 'CAUCE_' })

        expect(source.entries).toEqual([{ path: ['venue', 'city'], value: 'Rosario', key: 'CAUCE_VENUE__CITY' }])
    })

    it('skips a name with an empty level, and a variable without a value', () => {
        const source = environment({ __CF_USER_TEXT_ENCODING: '0x1F5', VENUE____CITY: 'Rosario', HOME: undefined })

        expect(source.entries).toEqual([])
    })

    it('is named the environment, unless it says otherwise', () => {
        expect(environment({}).name).toBe('the environment')
        expect(environment({}, { name: '.env' }).name).toBe('.env')
    })
})
