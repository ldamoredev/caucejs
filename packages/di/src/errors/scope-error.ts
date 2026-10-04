import { CompositionError } from './composition-error.js'

/** A scoped service was asked for outside of a scope, or a longer-lived service would capture one. */
export class ScopeError extends CompositionError {}
