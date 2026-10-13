import { type ExecutionContext, type Request, type ResultOf, UseCases } from '@caucejs/application'
import type { StandardSchemaV1 } from '@caucejs/base'
import type { Scope } from '@caucejs/di'
import { JsonSerializer } from '@caucejs/schema'
import type { Context, Hono } from 'hono'
import type { ParamKeys } from 'hono/types'

import { fieldsOf } from './fields.js'

/** What `web` keeps for each request: its scope, and who makes it. */
export type RequestState = { readonly scope: Scope; readonly context: ExecutionContext }

/** The Hono environment of a cauce application: every handler can read the state of its request. */
export type WebEnv = { Variables: { cauce: RequestState } }

/** A class of request with the `schema` it is read with: what a route that is a use case names. */
export type RequestClass = (abstract new (...args: never[]) => Request<unknown>) & { readonly schema: StandardSchemaV1 }

/**
 * Every parameter of the path has to be a field of the request, so `/talks/:idd` with a request that has `id` does not
 * compile, and says why.
 */
export type PathFits<Path extends string, C extends RequestClass> =
    Exclude<ParamKeys<Path>, keyof InstanceType<C>> extends never
        ? C
        : `the path names ${Exclude<ParamKeys<Path>, keyof InstanceType<C>> & string}, which the request does not have`

/**
 * How a route that is a use case answers: its result as JSON, with this status; a redirect, 303 by default; or a page,
 * the HTML that `html` writes with the result.
 */
export type Respond<C extends RequestClass> =
    | { readonly status?: 200 | 201 | 202 }
    | {
          readonly redirect: (result: ResultOf<InstanceType<C>>, request: InstanceType<C>) => string
          readonly status?: 301 | 302 | 303 | 307 | 308
      }
    | { readonly html: (result: ResultOf<InstanceType<C>>, request: InstanceType<C>) => string | Promise<string> }

/**
 * Runs a use case from a route written by hand: the fields are read with the schema of the class, in the scope and as
 * the identity of the request, through every middleware of the application.
 */
export type Run = <C extends RequestClass>(request: C, fields: Record<string, unknown>) => Promise<ResultOf<InstanceType<C>>>

/** A route written by hand: Hono's context, typed with its path, and `run`. */
export type Handler<Path extends string> = (c: Context<WebEnv, Path>, run: Run) => Response | Promise<Response>

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

/**
 * Where a controller declares its routes. A route that is a use case names the class of its request, and `web` reads
 * it from the path, the query and the body, executes it, and writes the result. A route that is not, such as a page,
 * is written by hand, inline, and gets `run` to execute one.
 */
export class Routes {
    readonly #hono: Hono<WebEnv>
    readonly #serializer: JsonSerializer
    readonly #useCases: UseCases

    constructor(hono: Hono<WebEnv>, serializer: JsonSerializer, useCases: UseCases) {
        this.#hono = hono
        this.#serializer = serializer
        this.#useCases = useCases
    }

    get<Path extends string, C extends RequestClass>(path: Path, request: PathFits<Path, C> & C, respond?: Respond<C>): this
    get<Path extends string>(path: Path, handler: Handler<Path>): this
    get(path: string, target: RequestClass | Handler<string>, respond?: Respond<RequestClass>): this {
        return this.#add('get', path, target, respond)
    }

    post<Path extends string, C extends RequestClass>(path: Path, request: PathFits<Path, C> & C, respond?: Respond<C>): this
    post<Path extends string>(path: Path, handler: Handler<Path>): this
    post(path: string, target: RequestClass | Handler<string>, respond?: Respond<RequestClass>): this {
        return this.#add('post', path, target, respond)
    }

    put<Path extends string, C extends RequestClass>(path: Path, request: PathFits<Path, C> & C, respond?: Respond<C>): this
    put<Path extends string>(path: Path, handler: Handler<Path>): this
    put(path: string, target: RequestClass | Handler<string>, respond?: Respond<RequestClass>): this {
        return this.#add('put', path, target, respond)
    }

    patch<Path extends string, C extends RequestClass>(path: Path, request: PathFits<Path, C> & C, respond?: Respond<C>): this
    patch<Path extends string>(path: Path, handler: Handler<Path>): this
    patch(path: string, target: RequestClass | Handler<string>, respond?: Respond<RequestClass>): this {
        return this.#add('patch', path, target, respond)
    }

    delete<Path extends string, C extends RequestClass>(path: Path, request: PathFits<Path, C> & C, respond?: Respond<C>): this
    delete<Path extends string>(path: Path, handler: Handler<Path>): this
    delete(path: string, target: RequestClass | Handler<string>, respond?: Respond<RequestClass>): this {
        return this.#add('delete', path, target, respond)
    }

    #add(method: Method, path: string, target: RequestClass | Handler<string>, respond?: Respond<RequestClass>): this {
        if (!('schema' in target)) {
            this.#hono[method](path, c => target(c as Context<WebEnv, string>, this.#run(c)))
            return this
        }
        this.#hono[method](path, async c => {
            const fields = await fieldsOf(c)
            const request = await this.#read(target, fields)
            const result = await this.#execute(c, request)
            if (respond && 'redirect' in respond) return c.redirect(respond.redirect(result, request), respond.status ?? 303)
            if (respond && 'html' in respond) return c.html(await respond.html(result, request))
            if (result === undefined) return c.body(null, 204)
            return c.body(this.#serializer.write(result), respond?.status ?? 200, { 'content-type': 'application/json' })
        })
        return this
    }

    #run(c: Context<WebEnv>): Run {
        return async (type, fields) => (await this.#execute(c, await this.#read(type, fields))) as never
    }

    #read(type: RequestClass, fields: Record<string, unknown>): Promise<Request<unknown>> {
        return this.#serializer.read(type.schema as StandardSchemaV1<unknown, Request<unknown>>, fields)
    }

    #execute(c: Context<WebEnv>, request: Request<unknown>): Promise<unknown> {
        const { scope, context } = c.get('cauce')
        return this.#useCases.execute(request, { scope, context })
    }
}
