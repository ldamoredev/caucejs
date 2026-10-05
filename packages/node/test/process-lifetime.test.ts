import { afterEach, describe, expect, it } from 'vitest'

import { ProcessLifetime } from '../src/index.js'

const opened: ProcessLifetime[] = []
afterEach(() => opened.splice(0).forEach(lifetime => lifetime.close()))

describe('the lifetime of the process', () => {
    it('asks to stop on SIGTERM and on SIGINT', async () => {
        for (const signal of ['SIGTERM', 'SIGINT'] as const) {
            const lifetime = open()

            process.emit(signal, signal)

            await expect(lifetime.stopping()).resolves.toBeUndefined()
            lifetime.close()
        }
    })

    it('ends the process at once on a second signal, with the code of that signal', () => {
        const codes: number[] = []
        open({ exit: code => codes.push(code) })

        process.emit('SIGTERM', 'SIGTERM')
        process.emit('SIGINT', 'SIGINT')

        expect(codes).toEqual([130])
    })

    it('stops listening when closed', () => {
        const before = process.listenerCount('SIGTERM')
        const lifetime = open()
        expect(process.listenerCount('SIGTERM')).toBe(before + 1)

        lifetime.close()

        expect(process.listenerCount('SIGTERM')).toBe(before)
    })
})

function open(options: { exit?: (code: number) => void } = {}): ProcessLifetime {
    const lifetime = new ProcessLifetime(options)
    opened.push(lifetime)
    return lifetime
}
