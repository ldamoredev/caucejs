import { CompositionError } from './errors/composition-error.js'
import type { Extension } from './extension.js'
import { Lifetimes, type Lifetime } from './lifetimes.js'
import { Provider } from './provider.js'
import { sourceOf, type Registration, type Source, type StoredClass } from './registration.js'
import { describeOptions, sameOptions } from './same-options.js'
import { nameOf, type Dependencies, type Factory, type Injectable, type Token } from './token.js'
import { validate } from './validate.js'

export type BuildOptions = {
    /** Checks the whole graph before returning. `hosting` turns it on in development and in tests. */
    validate?: boolean
}

/**
 * Where an application declares its services. Each token is added once: adding it again fails, and a
 * test that needs to change one uses {@link replace}.
 *
 * A service is a class whose static `inject` lists what it needs, or a factory, written as an arrow
 * function, for what is not a class of the application.
 */
export class Services {
    readonly #registrations = new Map<Token<unknown>, Registration>()
    readonly #extensions = new Map<symbol, Extension>()

    /** Adds extensions. The same one with the same options is added once; with other options it fails. */
    add(...extensions: Extension[]): this {
        for (const extension of extensions) this.#addExtension(extension)
        return this
    }

    // The factory overload goes first in each method: an arrow function only gets the type of its resolver from it.

    /** One instance for the whole application. */
    addSingleton<T>(token: Token<T>, factory: Factory<T>): this
    addSingleton<T, D extends Dependencies>(token: Token<T>, implementation: Injectable<T, D>): this
    addSingleton(token: Token<unknown>, implementation: StoredClass | Factory<unknown>): this {
        return this.#add(token, Lifetimes.Singleton, sourceOf(implementation))
    }

    /** One instance per scope: per request, or per job. */
    addScoped<T>(token: Token<T>, factory: Factory<T>): this
    addScoped<T, D extends Dependencies>(token: Token<T>, implementation: Injectable<T, D>): this
    addScoped(token: Token<unknown>, implementation: StoredClass | Factory<unknown>): this {
        return this.#add(token, Lifetimes.Scoped, sourceOf(implementation))
    }

    /** A new instance every time it is asked for. */
    addTransient<T>(token: Token<T>, factory: Factory<T>): this
    addTransient<T, D extends Dependencies>(token: Token<T>, implementation: Injectable<T, D>): this
    addTransient(token: Token<unknown>, implementation: StoredClass | Factory<unknown>): this {
        return this.#add(token, Lifetimes.Transient, sourceOf(implementation))
    }

    /** An instance built outside. It is a singleton, and the container never disposes it. */
    addInstance<T>(token: Token<T>, instance: T): this {
        return this.#add(token, Lifetimes.Singleton, { kind: 'instance', instance })
    }

    /** Changes how a service that was already added is built, keeping its lifetime. For tests. */
    replace<T>(token: Token<T>, factory: Factory<T>): this
    replace<T, D extends Dependencies>(token: Token<T>, implementation: Injectable<T, D>): this
    replace(token: Token<unknown>, implementation: StoredClass | Factory<unknown>): this {
        const current = this.#registrations.get(token)
        if (!current) throw new CompositionError(`${nameOf(token)} was never added, so there is nothing to replace`)
        this.#registrations.set(token, { token, lifetime: current.lifetime, source: sourceOf(implementation) })
        return this
    }

    /**
     * The provider. Fails if an extension requires one that was never added; with `validate`, also if
     * the graph is wrong. What is added afterwards does not reach this provider.
     */
    build(options: BuildOptions = {}): Provider {
        this.#checkRequirements()
        const registrations = new Map(this.#registrations)
        if (options.validate) validate(registrations)
        return new Provider(registrations)
    }

    #add(token: Token<unknown>, lifetime: Lifetime, source: Source): this {
        if (this.#registrations.has(token)) {
            throw new CompositionError(`${nameOf(token)} was already added: use replace to change it`)
        }
        this.#registrations.set(token, { token, lifetime, source })
        return this
    }

    #addExtension(extension: Extension): void {
        const existing = this.#extensions.get(extension.id)
        if (existing) {
            if (sameOptions(existing.options, extension.options)) return
            throw new CompositionError(
                `${describeId(extension.id)} was added twice with different options: ` +
                    `${describeOptions(existing.options)} and ${describeOptions(extension.options)}`,
            )
        }
        this.#extensions.set(extension.id, extension)
        extension.register(this)
    }

    #checkRequirements(): void {
        const problems: string[] = []
        for (const extension of this.#extensions.values()) {
            for (const required of extension.requires) {
                if (!this.#extensions.has(required)) {
                    problems.push(`${describeId(extension.id)} needs ${describeId(required)}, which was never added`)
                }
            }
        }
        if (problems.length > 0) throw new CompositionError(problems.join('\n'))
    }
}

function describeId(id: symbol): string {
    return id.description ?? 'an extension without a description'
}
