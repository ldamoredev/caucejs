import type { Lifetime } from './lifetimes.js'
import type { Dependencies, Factory, Token } from './token.js'

export type StoredClass = (new (...args: never[]) => unknown) & { readonly inject?: Dependencies }

export type Source =
    | { readonly kind: 'class'; readonly implementation: StoredClass }
    | { readonly kind: 'factory'; readonly factory: Factory<unknown> }
    | { readonly kind: 'instance'; readonly instance: unknown }

export type Registration = { readonly token: Token<unknown>; readonly lifetime: Lifetime; readonly source: Source }

export function dependenciesOf(registration: Registration): Dependencies {
    return registration.source.kind === 'class' ? (registration.source.implementation.inject ?? []) : []
}

// A class always has its own prototype; an arrow function, which is how a factory is written, never does.
export function sourceOf(implementation: StoredClass | Factory<unknown>): Source {
    return Object.hasOwn(implementation, 'prototype')
        ? { kind: 'class', implementation: implementation as StoredClass }
        : { kind: 'factory', factory: implementation as Factory<unknown> }
}
