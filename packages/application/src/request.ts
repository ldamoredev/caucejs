// Type only: it carries the result of a request for the compiler, and does not exist at runtime.
declare const result: unique symbol

/**
 * What a use case is asked to do. `R` is what it answers, and the compiler infers it from the class, so
 * `useCases.execute(new GetTalk(id))` is a `Promise<Talk>` without saying so.
 *
 * Two request classes with the same fields are the same type to the compiler. Give each one a field of its own
 * when a handler could be paired with the wrong request.
 */
export abstract class Request<R> {
    declare readonly [result]: R
}

/** A request that changes something. It answers nothing unless it says so: `Command<TalkId>`. */
export abstract class Command<R = void> extends Request<R> {}

/** A request that only reads. */
export abstract class Query<R> extends Request<R> {}

/** What a request answers. */
export type ResultOf<T> = T extends Request<infer R> ? R : never
