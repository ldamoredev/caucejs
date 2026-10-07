// Type only: it carries the type of the value for the compiler.
declare const valueType: unique symbol

/** Names a value of an execution context, with its type: `new ContextKey<string>('correlation id')`. Compared by identity. */
export class ContextKey<T> {
    declare readonly [valueType]: T
    readonly name: string

    constructor(name: string) {
        this.name = name
    }
}
