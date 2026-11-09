import { settings, type StandardSchemaIssue, type StandardSchemaV1 } from '@caucejs/config'

type AnthropicOptions = {
    readonly apiKey: string
    readonly version: string
    readonly workspaceId?: string
    readonly timeout: number
}

// Written by hand, so this package depends on no validator. A timeout from the environment arrives as a string.
const schema: StandardSchemaV1<unknown, AnthropicOptions> = {
    '~standard': {
        version: 1,
        vendor: 'cauce',
        validate(input) {
            const { apiKey, version = '2026-10-21', workspaceId, timeout = 120_000 } = (input ?? {}) as Record<string, unknown>
            const issues: StandardSchemaIssue[] = []
            if (!filled(apiKey)) issues.push({ message: 'Expected an API key', path: ['apiKey'] })
            if (!filled(version)) issues.push({ message: 'Expected a version of the API, such as 2026-10-21', path: ['version'] })
            if (workspaceId !== undefined && !filled(workspaceId)) issues.push({ message: 'Expected the id of a workspace', path: ['workspaceId'] })
            const milliseconds = typeof timeout === 'string' && timeout.trim() !== '' ? Number(timeout) : timeout
            if (typeof milliseconds !== 'number' || !Number.isInteger(milliseconds) || milliseconds <= 0) {
                issues.push({ message: 'Expected a timeout, a whole number of milliseconds above 0', path: ['timeout'] })
            }
            if (issues.length > 0) return { issues }
            return {
                value: {
                    apiKey: apiKey as string,
                    version: version as string,
                    timeout: milliseconds as number,
                    ...(workspaceId !== undefined && { workspaceId: workspaceId as string }),
                },
            }
        },
    },
}

function filled(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== ''
}

/**
 * The section `anthropic`, read from `ANTHROPIC__API_KEY` and the rest of `ANTHROPIC__*`:
 *
 * - `apiKey`, required;
 * - `version`, the `anthropic-version` header, `2026-10-21` when it is not given;
 * - `workspaceId`, sent as `anthropic-workspace-id` when the key is not tied to a workspace;
 * - `timeout`, in milliseconds for each call, 120 seconds when it is not given.
 *
 * Bound while the application is composed, so a missing key fails at startup and never shows its value:
 * `app.addSettings(AnthropicSettings)`.
 */
export class AnthropicSettings extends settings('anthropic', schema) {}
