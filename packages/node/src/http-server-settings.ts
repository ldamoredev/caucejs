import { settings, type StandardSchemaV1 } from '@caucejs/config'

type HttpServerOptions = { readonly port: number; readonly hostname?: string }

// Written by hand, so this package depends on no validator. A port from the environment arrives as a string.
const schema: StandardSchemaV1<unknown, HttpServerOptions> = {
    '~standard': {
        version: 1,
        vendor: 'cauce',
        validate(input) {
            const { port = 8080, hostname } = (input ?? {}) as Record<string, unknown>
            const number = typeof port === 'string' && port.trim() !== '' ? Number(port) : port
            if (typeof number !== 'number' || !Number.isInteger(number) || number < 0 || number > 65535) {
                return { issues: [{ message: 'Expected a port, a whole number from 0 to 65535', path: ['port'] }] }
            }
            if (hostname !== undefined && typeof hostname !== 'string') {
                return { issues: [{ message: 'Expected a hostname', path: ['hostname'] }] }
            }
            return { value: { port: number, ...(hostname !== undefined && { hostname }) } }
        },
    },
}

/**
 * The section `httpServer`: the `port` to listen on, 8080 when it is not given and 0 for any free one, and the
 * `hostname`, every interface when it is not given. Bound as any settings class:
 * `services.addInstance(HttpServerSettings, config.bind(HttpServerSettings))`.
 */
export class HttpServerSettings extends settings('httpServer', schema) {}
