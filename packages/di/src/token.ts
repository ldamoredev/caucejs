/** What a service is asked for by: its class, usually an `abstract class` that names a contract. */
export type Token<T> = abstract new (...args: never[]) => T

/** The tokens a class asks for, in the order of its constructor. */
export type Dependencies = readonly Token<unknown>[]

/** The instances a list of tokens resolves to, in the same order. */
export type InstancesOf<D extends Dependencies> = { -readonly [K in keyof D]: D[K] extends Token<infer T> ? T : never }

/**
 * A class the container can build: its static `inject` lists what its constructor takes, and the
 * compiler checks the list against the constructor. A class whose constructor takes nothing needs no list.
 *
 * ```ts
 * class SqlTalks extends Talks {
 *     static readonly inject = [SqlClient, Clock] as const
 *     constructor(sql: SqlClient, clock: Clock) { ... }
 * }
 * ```
 */
export type Injectable<T, D extends Dependencies = Dependencies> =
    | ((new (...args: InstancesOf<D>) => T) & { readonly inject: D })
    | (new () => T)

/** What a factory can ask for while it builds a service. */
export interface Resolver {
    get<T>(token: Token<T>): T
}

/** Builds a service by hand: for what is not a class of the application, such as a connection pool. */
export type Factory<T> = (resolver: Resolver) => T

export function nameOf(token: Token<unknown>): string {
    return token.name || 'an anonymous class'
}
