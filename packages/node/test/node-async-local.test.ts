import { setTimeout as sleep } from 'node:timers/promises'

import { describe, expect, it } from 'vitest'

import { AsyncLocal, MissingAsyncLocalError } from '@caucejs/base'
import { NodeAsyncLocal } from '../src/index.js'

describe('a value that travels with async work', () => {
    it('is seen across awaits inside its run', async () => {
        const attendee = new NodeAsyncLocal<string>('attendee')

        const seen = await attendee.run('ada', async () => {
            await sleep(1)
            return attendee.get()
        })

        expect(seen).toBe('ada')
    })

    it('is not seen outside of a run', () => {
        const attendee = new NodeAsyncLocal<string>('attendee')

        expect(attendee.find()).toBeNull()
        expect(() => attendee.get()).toThrow(MissingAsyncLocalError)
    })

    it('keeps two concurrent runs apart', async () => {
        const attendee = new NodeAsyncLocal<string>('attendee')

        const seen = await Promise.all([
            attendee.run('ada', () => readAfter(attendee, 5)),
            attendee.run('grace', () => readAfter(attendee, 1)),
        ])

        expect(seen).toEqual(['ada', 'grace'])
    })

    it('is shadowed by a nested run until it ends', () => {
        const attendee = new NodeAsyncLocal<string>('attendee')

        const seen = attendee.run('ada', () => [attendee.run('grace', () => attendee.get()), attendee.get()])

        expect(seen).toEqual(['grace', 'ada'])
    })

    it('reaches work that started inside the run and ends after it', async () => {
        const attendee = new NodeAsyncLocal<string>('attendee')

        const later = attendee.run('ada', () => readAfter(attendee, 5))

        expect(attendee.find()).toBeNull()
        expect(await later).toBe('ada')
    })

    it('is an async local', () => {
        expect(new NodeAsyncLocal<string>('attendee')).toBeInstanceOf(AsyncLocal)
    })
})

async function readAfter(local: AsyncLocal<string>, ms: number): Promise<string> {
    await sleep(ms)
    return local.get()
}
