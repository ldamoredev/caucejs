/**
 * The current time, as a service. Code that depends on the time asks for a `Clock` instead of calling
 * `new Date()`, so a test can fix the time it runs at.
 */
export abstract class Clock {
    /** A new `Date` on every call: changing it does not change the clock. */
    abstract now(): Date
}

/** The clock of the machine. */
export class SystemClock extends Clock {
    now(): Date {
        return new Date()
    }
}
