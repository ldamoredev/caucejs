import type { Extension } from '@caucejs/di'

import { FetchHttpClient } from './fetch-http-client.js'
import { HttpClient } from './http-client.js'

const httpClientId = Symbol('httpClient')

/**
 * The `HttpClient` of the application, one for everybody: `services.add(httpClient({ timeout: 10_000 }))`. A test
 * replaces it: `services.replace(HttpClient, () => new FetchHttpClient({ fetch: fake }))`.
 */
export function httpClient(options: { readonly timeout?: number } = {}): Extension {
    return {
        id: httpClientId,
        options,
        requires: [],
        register: services => {
            services.addSingleton(HttpClient, () => new FetchHttpClient(options))
        },
    }
}
