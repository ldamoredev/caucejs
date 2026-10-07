import type { Resolver, Token } from '@caucejs/di'

/** What an example sees while it builds: the services of the scenario, and a way to declare a child. */
export interface ScenarioContext {
    get<T>(token: Token<T>): T

    /**
     * Builds an example that belongs to the one being built. When the scenario saves, the child is saved after
     * its parent, in the order it was declared, so a foreign key finds its row.
     */
    child<C>(example: Example<C>): C
}

/**
 * A value a scenario can build, and save if `save` is given. It is a function's result, like an extension:
 * `scenario.add(talk(t => t.keynote()))`.
 */
export interface Example<T> {
    build(context: ScenarioContext): T
    save?(resolver: Resolver, built: T): void | Promise<void>
}
