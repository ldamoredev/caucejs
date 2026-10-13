import type { HostBuilder } from './host-builder.js'

// Type only: it makes a module of a richer builder refuse a plainer one, which a method alone would accept.
declare const composes: unique symbol

/**
 * A part of an application, written as a class: `compose` adds its settings, its services and what starts with it,
 * one statement per line, and may add other modules. `builder.addModule(Talks)` builds it with no arguments and
 * composes it once per class, so two modules can both ask for a third.
 *
 * ```ts
 * class Conference extends Module {
 *     compose(app: HostBuilder): void {
 *         app.addSettings(TicketingSettings)
 *         app.services.addSingleton(Talks, SqlTalks)
 *         app.start(TicketDesk)
 *     }
 * }
 * ```
 */
export abstract class Module<B extends HostBuilder = HostBuilder> {
    declare readonly [composes]?: (app: B) => void

    abstract compose(app: B): void
}

/** A class of module, for the builder it composes. */
export type ModuleClass<B extends HostBuilder> = new () => Module<B>
