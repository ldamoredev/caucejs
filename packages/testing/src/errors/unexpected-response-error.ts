import { CauceError } from '@caucejs/base'

/** A response that is not what the test expected. The message carries the start of the body, to read a failure without a debugger. */
export class UnexpectedResponseError extends CauceError {}
