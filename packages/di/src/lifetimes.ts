/** How long an instance lives: one for the application, one per scope, or a new one every time. */
export const Lifetimes = { Singleton: 'singleton', Scoped: 'scoped', Transient: 'transient' } as const

export type Lifetime = (typeof Lifetimes)[keyof typeof Lifetimes]
