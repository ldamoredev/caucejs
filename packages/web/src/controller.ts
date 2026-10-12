import type { Routes } from './routes.js'

/**
 * A group of routes. The container builds it, so its constructor lists what its pages need in `inject`, and the
 * validation of the container checks it when the application is built. Write each handler inline in `registerRoutes`:
 * extracted to a method, Hono no longer knows its path, and its parameters lose their types.
 */
export abstract class Controller {
    abstract registerRoutes(routes: Routes): void
}
