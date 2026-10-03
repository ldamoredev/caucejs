import { describe, expect, it } from 'vitest'

import { Clock, SystemClock } from '../src/index.js'

describe('the system clock', () => {
    it('tells the time of the machine', () => {
        const before = Date.now()

        const now = new SystemClock().now()

        expect(now.getTime()).toBeGreaterThanOrEqual(before)
        expect(now.getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('returns a new date every time, so changing one does not change the clock', () => {
        const clock = new SystemClock()
        const first = clock.now()

        first.setFullYear(1999)

        expect(clock.now().getFullYear()).not.toBe(1999)
    })

    it('is a clock', () => {
        expect(new SystemClock()).toBeInstanceOf(Clock)
    })
})
