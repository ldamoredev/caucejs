import { constants } from 'node:os'

import { Lifetime } from '@caucejs/hosting'

export type ProcessLifetimeOptions = {
    /** How the process ends on a second signal. `process.exit` by default; a test passes its own. */
    exit?: (code: number) => void
}

const signals = ['SIGINT', 'SIGTERM'] as const

/**
 * The lifetime of the process: `SIGINT` (Ctrl+C) and `SIGTERM` (what a container platform sends before replacing
 * it) ask the application to stop. A second signal while it is stopping ends the process at once, with the exit
 * code of that signal, so a stuck shutdown never makes Ctrl+C useless.
 *
 * Listening also matters when Node is the first process of a container: there, a signal without a listener is
 * ignored, and the platform has to kill the process instead.
 */
export class ProcessLifetime extends Lifetime {
    readonly #stopping: Promise<void>
    readonly #exit: (code: number) => void
    readonly #listener = (signal: NodeJS.Signals): void => this.#received(signal)
    #resolve: () => void = () => {}
    #asked = false

    constructor(options: ProcessLifetimeOptions = {}) {
        super()
        this.#exit = options.exit ?? (code => process.exit(code))
        this.#stopping = new Promise(resolve => {
            this.#resolve = resolve
        })
        for (const signal of signals) process.on(signal, this.#listener)
    }

    stopping(): Promise<void> {
        return this.#stopping
    }

    close(): void {
        for (const signal of signals) process.off(signal, this.#listener)
    }

    #received(signal: NodeJS.Signals): void {
        if (this.#asked) {
            this.close()
            this.#exit(128 + constants.signals[signal])
            return
        }
        this.#asked = true
        this.#resolve()
    }
}
