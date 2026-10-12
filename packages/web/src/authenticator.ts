import { AnonymousIdentity, type Identity } from '@caucejs/application'

/**
 * Turns an HTTP request into who makes it: a cookie, a header, a token. `web` asks it once per request, in the scope
 * of that request, before any route runs, and every use case of the request runs as that identity. It never fails
 * for a request that says nothing: that one is anonymous, and `Authorization` decides.
 */
export abstract class Authenticator {
    abstract authenticate(request: Request): Promise<Identity>
}

/** The one `web` uses when the application names none: everybody is anonymous. */
export class AnonymousAuthenticator extends Authenticator {
    async authenticate(): Promise<Identity> {
        return new AnonymousIdentity()
    }
}
