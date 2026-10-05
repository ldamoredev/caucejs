import { CompositionError } from './composition-error.js'

/** Services that need each other, so none can be built first. */
export class CircularDependencyError extends CompositionError {
    readonly path: readonly string[]

    constructor(path: readonly string[], options?: ErrorOptions) {
        super(`Circular dependency: ${path.join(' -> ')}`, options)
        this.path = path
    }
}
