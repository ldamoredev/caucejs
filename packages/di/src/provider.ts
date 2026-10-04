import { CircularDependencyError } from './errors/circular-dependency-error.js'
import { CompositionError } from './errors/composition-error.js'
import { ScopeError } from './errors/scope-error.js'
import { ServiceNotAddedError } from './errors/service-not-added-error.js'
import { Lifetimes } from './lifetimes.js'
import type { Registration, StoredClass } from './registration.js'
import { nameOf, type Dependencies, type Injectable, type Resolver, type Token } from './token.js'

type Owner = { readonly owned: unknown[]; disposed: boolean }
type ScopeState = Owner & { readonly instances: Map<Token<unknown>, unknown> }

/**
 * Resolves what was added to {@link Services}. It owns the singletons and the transients it built, and
 * disposes them, in reverse order, when it is disposed itself: `await using provider = services.build()`.
 *
 * A scoped service is never resolved here: it comes from a {@link Scope}.
 */
export class Provider implements Resolver, AsyncDisposable {
    readonly #registrations: ReadonlyMap<Token<unknown>, Registration>
    readonly #singletons = new Map<Token<unknown>, unknown>()
    readonly #root: Owner = { owned: [], disposed: false }

    constructor(registrations: ReadonlyMap<Token<unknown>, Registration>) {
        this.#registrations = registrations
    }

    /** The service added for `token`. Throws {@link ServiceNotAddedError} if it never was. */
    get<T>(token: Token<T>): T {
        return this.#resolve(token, null, []) as T
    }

    /**
     * Builds a class that was not added, resolving what its `inject` lists. A new instance on every call,
     * owned by whoever called: the provider does not dispose it.
     */
    create<T, D extends Dependencies>(implementation: Injectable<T, D>): T {
        return this.#construct(implementation as StoredClass, null, []) as T
    }

    /** A scope: one per request, or per job. It holds the scoped services and disposes what it built. */
    createScope(): Scope {
        this.#ensureOpen(this.#root)
        const state: ScopeState = { instances: new Map(), owned: [], disposed: false }
        return new Scope(
            token => this.#resolve(token, state, []),
            implementation => this.#construct(implementation, state, []),
            () => disposeAll(state),
        )
    }

    async [Symbol.asyncDispose](): Promise<void> {
        await disposeAll(this.#root)
    }

    #resolve(token: Token<unknown>, scope: ScopeState | null, path: readonly Token<unknown>[]): unknown {
        this.#ensureOpen(scope ?? this.#root)
        if (path.includes(token)) throw new CircularDependencyError([...path, token].map(nameOf))
        const registration = this.#registrations.get(token)
        if (!registration) throw new ServiceNotAddedError(nameOf(token), [...path].reverse().map(nameOf))
        const next = [...path, token]

        switch (registration.lifetime) {
            case Lifetimes.Singleton: {
                if (this.#singletons.has(token)) return this.#singletons.get(token)
                // Built without the scope, so a singleton can never capture a scoped service.
                const instance = this.#build(registration, null, next)
                this.#singletons.set(token, instance)
                if (registration.source.kind !== 'instance') this.#root.owned.push(instance)
                return instance
            }
            case Lifetimes.Scoped: {
                if (scope === null) {
                    const from = path.length === 0 ? 'outside of a scope' : `from ${nameOf(path.at(-1)!)}, which is not scoped`
                    throw new ScopeError(`${nameOf(token)} is scoped, and was asked for ${from}`)
                }
                if (scope.instances.has(token)) return scope.instances.get(token)
                const instance = this.#build(registration, scope, next)
                scope.instances.set(token, instance)
                scope.owned.push(instance)
                return instance
            }
            case Lifetimes.Transient: {
                const instance = this.#build(registration, scope, next)
                ;(scope ?? this.#root).owned.push(instance)
                return instance
            }
        }
    }

    #build(registration: Registration, scope: ScopeState | null, path: readonly Token<unknown>[]): unknown {
        const { source } = registration
        switch (source.kind) {
            case 'class':
                return this.#construct(source.implementation, scope, path)
            case 'factory':
                return source.factory({ get: <T>(token: Token<T>) => this.#resolve(token, scope, path) as T })
            case 'instance':
                return source.instance
        }
    }

    #construct(implementation: StoredClass, scope: ScopeState | null, path: readonly Token<unknown>[]): unknown {
        const dependencies = (implementation.inject ?? []).map(dependency => this.#resolve(dependency, scope, path))
        return new implementation(...(dependencies as never[]))
    }

    #ensureOpen(owner: Owner): void {
        if (owner.disposed) throw new CompositionError(owner === this.#root ? 'The provider was disposed' : 'The scope was disposed')
    }
}

/** The services of one request or one job. Created by {@link Provider.createScope}. */
export class Scope implements Resolver, AsyncDisposable {
    readonly #get: (token: Token<unknown>) => unknown
    readonly #create: (implementation: StoredClass) => unknown
    readonly #dispose: () => Promise<void>

    constructor(
        get: (token: Token<unknown>) => unknown,
        create: (implementation: StoredClass) => unknown,
        dispose: () => Promise<void>,
    ) {
        this.#get = get
        this.#create = create
        this.#dispose = dispose
    }

    /** The service added for `token`: scoped ones are built once per scope. */
    get<T>(token: Token<T>): T {
        return this.#get(token) as T
    }

    /** Like {@link Provider.create}, inside this scope. */
    create<T, D extends Dependencies>(implementation: Injectable<T, D>): T {
        return this.#create(implementation as StoredClass) as T
    }

    /** Disposes the scoped and transient services this scope built, in reverse order. */
    async [Symbol.asyncDispose](): Promise<void> {
        await this.#dispose()
    }
}

async function disposeAll(owner: Owner): Promise<void> {
    if (owner.disposed) return
    owner.disposed = true
    const failures: unknown[] = []
    for (const instance of owner.owned.reverse()) {
        try {
            if (hasAsyncDispose(instance)) await instance[Symbol.asyncDispose]()
            else if (hasDispose(instance)) instance[Symbol.dispose]()
        } catch (error) {
            failures.push(error)
        }
    }
    owner.owned.length = 0
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'Some services failed to dispose')
}

function hasAsyncDispose(value: unknown): value is AsyncDisposable {
    return typeof value === 'object' && value !== null && Symbol.asyncDispose in value
}

function hasDispose(value: unknown): value is Disposable {
    return typeof value === 'object' && value !== null && Symbol.dispose in value
}
