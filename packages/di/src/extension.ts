import type { Services } from './services.js'

/**
 * How a package adds what it brings to the container without the container knowing it:
 * `services.add(sql())`.
 *
 * - `id` is what makes two extensions the same one. A `Symbol`, so two packages that both say `sql`
 *   never collide; its description names it in errors.
 * - Adding the same extension again with the same `options` does nothing; with other options it fails.
 * - `requires` names the extensions it needs. It never adds them: the application does, and a missing
 *   one fails when the container is built.
 */
export interface Extension {
    readonly id: symbol
    readonly options: unknown
    readonly requires: readonly symbol[]
    register(services: Services): void
}
