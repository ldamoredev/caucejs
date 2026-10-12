import type { Scope } from './provider.js'

/**
 * Opens scopes, for what needs one per unit of work and cannot be handed the provider: `web` for each request, `jobs`
 * for each job. The container provides it on its own, the way it is the only thing that can open a scope, so it is
 * never added: `static readonly inject = [Scopes] as const`.
 */
export abstract class Scopes {
    abstract create(): Scope
}
