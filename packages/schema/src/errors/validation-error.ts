import { ApplicationError } from '@caucejs/base'

/** One thing that is wrong with the input: where, with the fields joined by dots (`items.1.index`), and why. */
export type ValidationIssue = { readonly path: string; readonly message: string }

/**
 * The input does not follow its schema. It carries every issue the schema found, with the message of the schema's
 * library, so a caller can point at each field. On HTTP, a 400.
 */
export class ValidationError extends ApplicationError {
    readonly issues: readonly ValidationIssue[]

    constructor(issues: readonly ValidationIssue[], options?: ErrorOptions) {
        super(`The input is not valid: ${issues.map(issue => (issue.path === '' ? issue.message : `${issue.path}: ${issue.message}`)).join('; ')}`, options)
        this.issues = issues
    }
}
