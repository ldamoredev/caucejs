import type { Provider, Token } from '@caucejs/di'

import { StartError } from './errors/start-error.js'
import { StopTimeoutError } from './errors/stop-timeout-error.js'
import type { HostedService } from './hosted-service.js'
import type { HostEnvironment } from './host-environment.js'
import type { Lifetime } from './lifetime.js'
import { within } from './timeout.js'

/**
 * A built application: the container is ready and nothing has started. `run` starts it, waits until the lifetime
 * asks it to stop, and stops it; a test calls `start` and disposes it with `await using`.
 */
export class Host implements AsyncDisposable {
    readonly environment: HostEnvironment
    readonly provider: Provider
    readonly #hosted: readonly Token<HostedService>[]
    readonly #shutdownTimeout: number
    #running: { readonly name: string; readonly service: HostedService }[] = []
    #state: 'built' | 'started' | 'stopped' = 'built'

    constructor(environment: HostEnvironment, provider: Provider, hosted: readonly Token<HostedService>[], shutdownTimeout: number) {
        this.environment = environment
        this.provider = provider
        this.#hosted = hosted
        this.#shutdownTimeout = shutdownTimeout
    }

    /**
     * Starts the hosted services in order, each after the previous one finished starting. If one fails, the ones
     * already started are stopped in reverse order, the container is disposed, and it throws {@link StartError}.
     * Calling it again does nothing.
     */
    async start(): Promise<void> {
        if (this.#state !== 'built') return
        this.#state = 'started'
        for (const token of this.#hosted) {
            const name = token.name
            try {
                const service = this.provider.get(token)
                await service.start()
                this.#running.push({ name, service })
            } catch (error) {
                const stopFailures = await this.#shutDown()
                throw new StartError(name, stopFailures, { cause: error })
            }
        }
    }

    /**
     * Stops the hosted services in reverse order, each within the shutdown timeout, and then disposes the
     * container. Every service is stopped even if one fails: one failure is thrown as it is, and several as an
     * `AggregateError`. Calling it again does nothing.
     */
    async stop(): Promise<void> {
        if (this.#state === 'stopped') return
        const failures = await this.#shutDown()
        if (failures.length === 1) throw failures[0]
        if (failures.length > 1) throw new AggregateError(failures, 'Some services failed to stop')
    }

    /** Starts, waits until the lifetime asks to stop, and stops. The lifetime is closed in every case. */
    async run(lifetime: Lifetime): Promise<void> {
        try {
            await this.start()
            await lifetime.stopping()
            await this.stop()
        } finally {
            lifetime.close()
        }
    }

    async [Symbol.asyncDispose](): Promise<void> {
        await this.stop()
    }

    async #shutDown(): Promise<unknown[]> {
        this.#state = 'stopped'
        const failures: unknown[] = []
        for (const { name, service } of this.#running.reverse()) {
            try {
                await within(service.stop(), this.#shutdownTimeout, () => new StopTimeoutError(name, this.#shutdownTimeout))
            } catch (error) {
                failures.push(error)
            }
        }
        this.#running = []
        try {
            await this.provider[Symbol.asyncDispose]()
        } catch (error) {
            failures.push(error)
        }
        return failures
    }
}
