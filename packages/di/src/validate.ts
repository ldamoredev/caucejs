import { CompositionError } from './errors/composition-error.js'
import { Lifetimes } from './lifetimes.js'
import { dependenciesOf, type Registration } from './registration.js'
import { nameOf, type Token } from './token.js'

/**
 * Checks the whole graph without building anything: every dependency a class lists is added, and no
 * singleton captures a scoped service. A factory is opaque, so what it asks for is only checked when it
 * runs. Cycles between classes cannot be written: an `inject` list that names a class declared later
 * does not compile, and one across an import cycle fails when the module loads.
 */
export function validate(registrations: ReadonlyMap<Token<unknown>, Registration>): void {
    const problems = [...missing(registrations), ...captives(registrations)]
    if (problems.length > 0) throw new CompositionError(`The container is composed wrong:\n- ${problems.join('\n- ')}`)
}

function* missing(registrations: ReadonlyMap<Token<unknown>, Registration>): Generator<string> {
    for (const registration of registrations.values()) {
        for (const dependency of dependenciesOf(registration)) {
            if (!registrations.has(dependency)) {
                yield `${nameOf(registration.token)} needs ${nameOf(dependency)}, which was never added`
            }
        }
    }
}

function* captives(registrations: ReadonlyMap<Token<unknown>, Registration>): Generator<string> {
    for (const registration of registrations.values()) {
        if (registration.lifetime !== Lifetimes.Singleton) continue
        const captured = scopedReachedFrom(registration, registrations, new Set())
        if (captured) {
            yield `${nameOf(registration.token)} is a singleton and would capture ${nameOf(captured)}, which is scoped`
        }
    }
}

// A transient in between is built once with the singleton and lives as long, so the walk goes through it.
function scopedReachedFrom(
    registration: Registration,
    registrations: ReadonlyMap<Token<unknown>, Registration>,
    seen: Set<Token<unknown>>,
): Token<unknown> | null {
    for (const dependency of dependenciesOf(registration)) {
        if (seen.has(dependency)) continue
        seen.add(dependency)
        const next = registrations.get(dependency)
        if (!next) continue
        if (next.lifetime === Lifetimes.Scoped) return dependency
        if (next.lifetime === Lifetimes.Transient) {
            const captured = scopedReachedFrom(next, registrations, seen)
            if (captured) return captured
        }
    }
    return null
}
