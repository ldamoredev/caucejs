import { InvalidArgumentError } from '@caucejs/base'
import { describe, expect, it } from 'vitest'

import { Examples } from '../src/index.js'

describe('examples', () => {
    it('hands out the values in turn and starts over after the last', () => {
        const titles = new Examples('Opening', 'Closing')

        const handed = [titles.one(), titles.one(), titles.one()]

        expect(handed).toEqual(['Opening', 'Closing', 'Opening'])
    })

    it('count on their own, so one list does not move another', () => {
        const titles = new Examples('Opening', 'Closing')
        const rooms = new Examples('A', 'B')
        titles.one()

        expect(rooms.one()).toBe('A')
    })

    it('hand out the same values on every run', () => {
        const first = new Examples(1, 2, 3)
        const second = new Examples(1, 2, 3)

        expect([first.one(), first.one()]).toEqual([second.one(), second.one()])
    })

    it('need at least one value', () => {
        expect(() => new Examples()).toThrow(InvalidArgumentError)
    })
})
