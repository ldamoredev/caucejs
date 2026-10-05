/**
 * Whether an extension added twice was added with the same options: deep equality for plain objects,
 * arrays and primitives, and identity for anything else, such as a function or an instance, which
 * cannot be compared by value.
 */
export function sameOptions(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((value, index) => sameOptions(value, b[index]))
    }
    if (isPlain(a) && isPlain(b)) {
        const keys = Object.keys(a)
        return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameOptions(a[key], b[key]))
    }
    return false
}

export function describeOptions(options: unknown): string {
    return JSON.stringify(options, (_key, value: unknown) => {
        if (typeof value === 'function') return `[function ${value.name || 'anonymous'}]`
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && !isPlain(value)) {
            return `[${value.constructor.name}]`
        }
        return value
    }) ?? String(options)
}

function isPlain(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) return false
    const prototype: unknown = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}
