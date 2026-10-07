import { Clock, InvalidArgumentError } from '@caucejs/base'

/**
 * A clock stopped at a moment, for tests. It only moves when the test calls `advance`, which is why it is the one
 * clock with state that changes.
 */
export class FixedClock extends Clock {
    #time: number

    constructor(at: Date) {
        super()
        if (Number.isNaN(at.getTime())) throw new InvalidArgumentError('at', 'A fixed clock needs a valid date')
        this.#time = at.getTime()
    }

    now(): Date {
        return new Date(this.#time)
    }

    /** Moves the clock forward. Time does not go back, so a negative amount fails. */
    advance(milliseconds: number): void {
        if (!Number.isFinite(milliseconds) || milliseconds < 0) {
            throw new InvalidArgumentError('milliseconds', 'A fixed clock only moves forward, by a finite amount')
        }
        this.#time += milliseconds
    }
}
