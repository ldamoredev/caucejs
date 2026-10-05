/**
 * When the application is asked to stop. The host waits on it in `run`: the runtime adapter listens to the signals
 * of the process (`ProcessLifetime`, in `@caucejs/node`), and a test or the code itself uses a {@link ManualLifetime}.
 */
export abstract class Lifetime {
    /** Resolves when something asks the application to stop. */
    abstract stopping(): Promise<void>

    /** Stops listening. The host calls it once it has stopped, or when it failed to start. */
    abstract close(): void
}

/** A lifetime stopped by calling {@link stop}: for tests, and for code that decides when the application ends. */
export class ManualLifetime extends Lifetime {
    readonly #stopping: Promise<void>
    #resolve: () => void = () => {}

    constructor() {
        super()
        this.#stopping = new Promise(resolve => {
            this.#resolve = resolve
        })
    }

    /** Asks the application to stop. Calling it again does nothing. */
    stop(): void {
        this.#resolve()
    }

    stopping(): Promise<void> {
        return this.#stopping
    }

    close(): void {}
}
