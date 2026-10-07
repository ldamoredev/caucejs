import type { Extension } from '@caucejs/di'

import { DefaultJsonSerializer } from './default-json-serializer.js'
import { JsonSerializer } from './json-serializer.js'

const jsonSerializerId = Symbol('json serializer')

/** Adds the `JsonSerializer` of the application: `services.add(jsonSerializer())`. */
export function jsonSerializer(): Extension {
    return {
        id: jsonSerializerId,
        options: undefined,
        requires: [],
        register: services => services.addSingleton(JsonSerializer, DefaultJsonSerializer),
    }
}
