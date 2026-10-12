import { ValidationError, type ValidationIssue } from '@caucejs/schema'
import type { Context } from 'hono'

import { UnsupportedMediaTypeError } from './errors/unsupported-media-type-error.js'

type Source = 'path' | 'query' | 'body'

/**
 * What a request brings, as one object: the parameters of the path, the query and the body, read as JSON or as a form
 * by its `Content-Type`. A field that comes from two of them is an error, never one that wins in silence. A GET has no
 * body: the fetch standard does not let one be sent.
 */
export async function fieldsOf(c: Context): Promise<Record<string, unknown>> {
    const sources: [Source, Record<string, unknown>][] = [
        ['path', c.req.param() as Record<string, string>],
        ['query', queryOf(c)],
        ['body', await bodyOf(c)],
    ]
    const fields: Record<string, unknown> = {}
    const from = new Map<string, Source>()
    const issues: ValidationIssue[] = []
    for (const [source, values] of sources) {
        for (const [name, value] of Object.entries(values)) {
            const earlier = from.get(name)
            if (earlier) {
                issues.push({ path: name, message: `It comes from both the ${earlier} and the ${source}` })
                continue
            }
            from.set(name, source)
            fields[name] = value
        }
    }
    if (issues.length > 0) throw new ValidationError(issues)
    return fields
}

// A name given once is a string, and one given more than once, a list of them.
function queryOf(c: Context): Record<string, unknown> {
    const query: Record<string, unknown> = {}
    for (const [name, values] of Object.entries(c.req.queries())) query[name] = values.length === 1 ? values[0] : values
    return query
}

async function bodyOf(c: Context): Promise<Record<string, unknown>> {
    const text = await c.req.raw.clone().text()
    if (text === '') return {}
    const mediaType = (c.req.header('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
    if (mediaType === 'application/json' || mediaType.endsWith('+json')) return jsonObject(text)
    if (mediaType === 'application/x-www-form-urlencoded' || mediaType === 'multipart/form-data') {
        return (await c.req.parseBody({ all: true })) as Record<string, unknown>
    }
    throw new UnsupportedMediaTypeError(mediaType === '' ? 'none' : mediaType)
}

function jsonObject(text: string): Record<string, unknown> {
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch (error) {
        throw new ValidationError([{ path: '', message: 'The body is not valid JSON' }], { cause: error })
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new ValidationError([{ path: '', message: 'The body is not a JSON object' }])
    }
    return parsed as Record<string, unknown>
}
