import type { Usage } from '../usage.js'
import { ModelError } from './model-error.js'
import { requested } from './requested.js'

/**
 * The model stopped in the middle of something that cannot be used half done: `maxTokens` cut a tool call, or the
 * provider paused a long turn (`pauseTurn`). The usage is known: the answer was paid.
 */
export class IncompleteResponseError extends ModelError {
    readonly reason: 'maxTokens' | 'pauseTurn'
    readonly requestId: string | null

    constructor(details: { readonly reason: 'maxTokens' | 'pauseTurn'; readonly requestId: string | null; readonly usage: Usage }, options?: ErrorOptions) {
        const why = details.reason === 'maxTokens' ? 'the answer reached its most tokens inside a tool call' : 'the provider paused the turn'
        super(`The model stopped before its answer was complete: ${why}${requested(details.requestId)}`, details.usage, options)
        this.reason = details.reason
        this.requestId = details.requestId
    }
}
