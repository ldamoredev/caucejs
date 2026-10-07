import { Clock, InvalidArgumentError } from '@caucejs/base'
import { Services } from '@caucejs/di'
import { describe, expect, it } from 'vitest'

import { FixedClock } from '../src/index.js'

describe('a fixed clock', () => {
    it('stays at the moment it was given', () => {
        const clock = new FixedClock(new Date('2026-10-06T10:00:00Z'))

        expect([clock.now(), clock.now()]).toEqual([new Date('2026-10-06T10:00:00Z'), new Date('2026-10-06T10:00:00Z')])
    })

    it('does not change when the date it was given changes, nor when the date it returns does', () => {
        const at = new Date('2026-10-06T10:00:00Z')
        const clock = new FixedClock(at)
        at.setFullYear(2030)

        clock.now().setFullYear(2031)

        expect(clock.now()).toEqual(new Date('2026-10-06T10:00:00Z'))
    })

    it('moves forward when the test advances it', () => {
        const clock = new FixedClock(new Date('2026-10-06T10:00:00Z'))

        clock.advance(90_000)

        expect(clock.now()).toEqual(new Date('2026-10-06T10:01:30Z'))
    })

    it('does not go back', () => {
        const clock = new FixedClock(new Date('2026-10-06T10:00:00Z'))

        expect(() => clock.advance(-1)).toThrow(InvalidArgumentError)
        expect(() => clock.advance(Number.POSITIVE_INFINITY)).toThrow(InvalidArgumentError)
    })

    it('stays still when advanced by nothing', () => {
        const clock = new FixedClock(new Date('2026-10-06T10:00:00Z'))

        clock.advance(0)

        expect(clock.now()).toEqual(new Date('2026-10-06T10:00:00Z'))
    })

    it('needs a valid date', () => {
        expect(() => new FixedClock(new Date('not a date'))).toThrow(InvalidArgumentError)
    })

    it('replaces the clock of an application', () => {
        const fixed = new FixedClock(new Date('2026-10-06T10:00:00Z'))
        const services = new Services().addSingleton(Clock, () => fixed)

        expect(services.build({ validate: true }).get(Clock).now()).toEqual(new Date('2026-10-06T10:00:00Z'))
    })
})
