import type { Usage } from '../usage.js'
import { ModelError } from './model-error.js'

/**
 * A run reached its most steps and the model still asked for tools, which were not run. It carries what was done
 * without its content: the names of the tools that ran, in order, and the usage of every step. The answers and what
 * the tools returned stay out, as in every `ModelError`.
 */
export class MaxStepsExceededError extends ModelError {
    readonly maxSteps: number
    readonly calledTools: readonly string[]

    constructor(details: { readonly maxSteps: number; readonly calledTools: readonly string[]; readonly usage: Usage }, options?: ErrorOptions) {
        const steps = details.maxSteps === 1 ? '1 step' : `${details.maxSteps} steps`
        super(`The run reached its most steps, ${steps}, and the model still asked for tools`, details.usage, options)
        this.maxSteps = details.maxSteps
        this.calledTools = details.calledTools
    }
}
