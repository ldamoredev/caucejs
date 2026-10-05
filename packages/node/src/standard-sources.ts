import { join } from 'node:path'

import { environment, type Source } from '@caucejs/config'
import type { HostEnvironment } from '@caucejs/hosting'

import { dotenvFile, jsonFile } from './files.js'

export type StandardSourcesOptions = {
    /** Where the files are. The working directory by default. */
    directory?: string
}

/**
 * The standard order of the configuration, for an application to add by hand:
 * `builder.config.add(...standardSources(builder.environment))`. From the lowest to the highest priority:
 *
 * 1. `settings.json`
 * 2. `settings.<environment>.json`, such as `settings.production.json`
 * 3. `.env`
 * 4. the variables of the process
 *
 * The three files are optional. The files are read now, when this is called.
 */
export function standardSources(host: HostEnvironment, options: StandardSourcesOptions = {}): Source[] {
    const file = (name: string) => (options.directory === undefined ? name : join(options.directory, name))
    return [
        jsonFile(file('settings.json'), { optional: true }),
        jsonFile(file(`settings.${host.name}.json`), { optional: true }),
        dotenvFile(file('.env'), { optional: true }),
        environment(process.env),
    ]
}
