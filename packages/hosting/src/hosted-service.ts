/**
 * Something that runs with the application: a server, a loader that fills a cache at startup, a worker. The host
 * starts the hosted services in the order the builder lists them, and stops them in the reverse order.
 *
 * It is built by the container, so it lists what it needs in `inject` like any other class.
 */
export abstract class HostedService {
    /** Starts it. The host waits for it before starting the next one. */
    abstract start(): Promise<void>

    /** Stops it. The host waits for it up to its shutdown timeout, and then moves on to the next one. */
    abstract stop(): Promise<void>
}
