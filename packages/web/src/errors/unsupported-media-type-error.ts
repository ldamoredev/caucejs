import { ApplicationError } from '@caucejs/base'

/** A body of a type `web` does not read: only JSON and forms are. On HTTP, a 415. */
export class UnsupportedMediaTypeError extends ApplicationError {
    readonly mediaType: string

    constructor(mediaType: string, options?: ErrorOptions) {
        super(`A body of type ${mediaType} cannot be read: send JSON or a form`, options)
        this.mediaType = mediaType
    }
}
