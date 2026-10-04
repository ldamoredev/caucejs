import { beforeEach, describe, expect, it } from 'vitest'

import { CompositionError, Services, type Extension } from '../src/index.js'
import { Clock, FakeSqlClient, FixedClock, SqlClient, SqlTalks, Talks, log } from './support/conference.js'

beforeEach(() => {
    log.length = 0
})

describe('adding a service', () => {
    it('takes a class that lists what it needs, a factory, or an instance', () => {
        const clock = new FixedClock()

        const provider = new Services()
            .addInstance(Clock, clock)
            .addSingleton(SqlClient, () => new FakeSqlClient('pool'))
            .addSingleton(Talks, SqlTalks)
            .build()

        expect(provider.get(Talks).titles()).toEqual(['Opening keynote'])
        expect(provider.get(Clock)).toBe(clock)
        expect(log).toEqual(['open pool', 'build talks'])
    })

    it('fails when the same token is added twice', () => {
        const services = new Services().addSingleton(Clock, FixedClock)

        expect(() => services.addSingleton(Clock, FixedClock)).toThrow(
            new CompositionError('Clock was already added: use replace to change it'),
        )
    })
})

describe('replacing a service', () => {
    it('changes how it is built and keeps its lifetime', () => {
        const services = new Services().addSingleton(Clock, FixedClock).addSingleton(SqlClient, () => new FakeSqlClient('real'))

        services.replace(SqlClient, () => new FakeSqlClient('test'))

        const provider = services.build()
        expect(provider.get(SqlClient)).toBe(provider.get(SqlClient))
        expect(log).toEqual(['open test'])
    })

    it('fails when there is nothing to replace', () => {
        expect(() => new Services().replace(Clock, FixedClock)).toThrow(
            new CompositionError('Clock was never added, so there is nothing to replace'),
        )
    })

    it('does not reach a provider that was already built', () => {
        const services = new Services().addSingleton(SqlClient, () => new FakeSqlClient('before'))
        const provider = services.build()

        services.replace(SqlClient, () => new FakeSqlClient('after'))

        expect((provider.get(SqlClient) as FakeSqlClient).name).toBe('before')
    })
})

describe('adding an extension', () => {
    it('registers what it brings', () => {
        const provider = new Services().add(clock()).build()

        expect(provider.get(Clock)).toBeInstanceOf(FixedClock)
    })

    it('does nothing when the same one comes again with the same options', () => {
        const services = new Services()

        services.add(pool({ url: 'postgres://db/conference', size: 5 }), pool({ size: 5, url: 'postgres://db/conference' }))

        expect(services.build().get(SqlClient)).toBeInstanceOf(FakeSqlClient)
    })

    it('fails, showing both, when the same one comes again with other options', () => {
        const services = new Services().add(pool({ url: 'postgres://db/a', size: 5 }))

        expect(() => services.add(pool({ url: 'postgres://db/b', size: 5 }))).toThrow(
            'pool was added twice with different options: {"url":"postgres://db/a","size":5} and {"url":"postgres://db/b","size":5}',
        )
    })

    it('compares functions and instances by identity', () => {
        const onQuery = (): void => {}
        const services = new Services().add(pool({ url: 'u', size: 1, onQuery }))

        services.add(pool({ url: 'u', size: 1, onQuery }))

        expect(() => services.add(pool({ url: 'u', size: 1, onQuery: () => {} }))).toThrow(
            'pool was added twice with different options: {"url":"u","size":1,"onQuery":"[function onQuery]"} and {"url":"u","size":1,"onQuery":"[function onQuery]"}',
        )
    })

    it('fails when it is built without an extension it requires, whatever the order of add', () => {
        const services = new Services().add(talks())

        expect(() => services.build()).toThrow(new CompositionError('talks needs pool, which was never added\ntalks needs clock, which was never added'))
        expect(() => new Services().add(talks(), clock(), pool({ url: 'u', size: 1 })).build()).not.toThrow()
    })

    it('tells apart two extensions that share a description', () => {
        const other: Extension = { id: Symbol('clock'), options: undefined, requires: [], register: () => {} }

        expect(() => new Services().add(clock(), other).build()).not.toThrow()
    })
})

const clockId = Symbol('clock')
const poolId = Symbol('pool')
const talksId = Symbol('talks')

function clock(): Extension {
    return { id: clockId, options: undefined, requires: [], register: services => services.addSingleton(Clock, FixedClock) }
}

function pool(options: { url: string; size: number; onQuery?: () => void }): Extension {
    return {
        id: poolId,
        options,
        requires: [],
        register: services => services.addSingleton(SqlClient, () => new FakeSqlClient(options.url)),
    }
}

function talks(): Extension {
    return { id: talksId, options: undefined, requires: [poolId, clockId], register: services => services.addSingleton(Talks, SqlTalks) }
}
