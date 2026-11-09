import { ModelError } from './errors/model-error.js'
import { isReported, totalOf, unknownUsage, type Usage } from './usage.js'

/**
 * What a run throws when a call fails in the middle: the same error, with the usage of the whole run. The usage is
 * what the provider reported: the steps that answered, and the call that failed when it says what it spent, as an
 * `IncompleteResponseError` does. A call that knows nothing adds nothing, and a run that knows nothing is unknown.
 *
 * Anything that is not a `ModelError` is thrown as it is.
 */
export function spentIn(error: unknown, answered: readonly Usage[]): unknown {
    if (!(error instanceof ModelError)) return error
    const reported = isReported(error.usage) ? [...answered, error.usage] : answered
    const usage = reported.length === 0 ? unknownUsage : totalOf(reported)
    return withUsage(error, usage)
}

// A copy of the same class with every own field, its message, its cause and its stack, so a subclass this package does
// not know keeps what it carries. The error that was thrown is left as it was. The stack is copied as a value: V8 reads
// it through an accessor tied to the error it was captured on.
//
// What a copy cannot keep: a field written with `#` is not on the object, so a subclass that keeps one loses it, and
// its getter throws a TypeError on the copy. Nor is the copy a native error, as it was not built by a constructor:
// `Error.isError` answers false for it, and `structuredClone` turns it into a plain object.
function withUsage<E extends ModelError>(error: E, usage: Usage): E {
    return Object.create(Object.getPrototypeOf(error) as object, {
        ...Object.getOwnPropertyDescriptors(error),
        stack: { value: error.stack, enumerable: false, writable: true, configurable: true },
        usage: { value: usage, enumerable: true, writable: false, configurable: true },
    }) as E
}
