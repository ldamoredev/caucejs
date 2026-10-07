/**
 * Who executes a use case. The application writes its own, such as a user or an agent, and decides what each
 * permission means for it in `can`.
 */
export abstract class Identity {
    abstract readonly name: string
    abstract readonly isAuthenticated: boolean
    abstract can(permission: string): boolean
}

/** Nobody: what a use case runs as when no one said who. It can do nothing. */
export class AnonymousIdentity extends Identity {
    readonly name = 'anonymous'
    readonly isAuthenticated = false

    can(_permission: string): boolean {
        return false
    }
}

/** The application itself, for a job or a scheduled task with no one behind it. It can do everything. */
export class SystemIdentity extends Identity {
    readonly name = 'system'
    readonly isAuthenticated = true

    can(_permission: string): boolean {
        return true
    }
}
