import { describe, expect, it } from 'vitest'

import {
    ApplicationError,
    CauceError,
    DomainError,
    InvalidArgumentError,
    MissingAsyncLocalError,
    NotFoundError,
} from '../src/index.js'

describe('an error', () => {
    it('is named after the class that was thrown', () => {
        const error = new SoldOutError()

        expect(error.name).toBe('SoldOutError')
        expect(String(error)).toBe('SoldOutError: The talk has no seats left')
    })

    it('is an instance of every class above it', () => {
        const error = new SoldOutError()

        expect(error).toBeInstanceOf(DomainError)
        expect(error).toBeInstanceOf(CauceError)
        expect(error).toBeInstanceOf(Error)
        expect(error).not.toBeInstanceOf(ApplicationError)
    })

    it('carries its cause in the native cause', () => {
        const cause = new Error('connection reset')

        const error = new ApplicationError('Could not save the ticket', { cause })

        expect(error.cause).toBe(cause)
    })
})

describe('the generic errors', () => {
    it('have a default message', () => {
        expect(new NotFoundError().message).toBe('Not found')
        expect(new InvalidArgumentError('email').message).toBe('Invalid argument email')
    })

    it('take a message of their own', () => {
        expect(new NotFoundError('Talk 7 not found').message).toBe('Talk 7 not found')
        expect(new InvalidArgumentError('email', 'The email has no domain').message).toBe('The email has no domain')
    })

    it('are domain errors', () => {
        expect(new NotFoundError()).toBeInstanceOf(DomainError)
        expect(new InvalidArgumentError('email')).toBeInstanceOf(DomainError)
    })

    it('name the argument that failed', () => {
        expect(new InvalidArgumentError('email').argument).toBe('email')
    })

    it('can be extended with a fixed message', () => {
        const error = new TalkNotFoundError(7)

        expect(error.message).toBe('Talk 7 not found')
        expect(error.name).toBe('TalkNotFoundError')
        expect(error).toBeInstanceOf(NotFoundError)
    })
})

describe('reading an async local outside of a run', () => {
    it('names the local that has no value', () => {
        const error = new MissingAsyncLocalError('request')

        expect(error.local).toBe('request')
        expect(error.message).toBe('request has no value here: read it inside a run() that sets it')
    })
})

class SoldOutError extends DomainError {
    constructor(options?: ErrorOptions) {
        super('The talk has no seats left', options)
    }
}

class TalkNotFoundError extends NotFoundError {
    constructor(id: number, options?: ErrorOptions) {
        super(`Talk ${id} not found`, options)
    }
}
