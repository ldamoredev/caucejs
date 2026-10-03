import { NodeAsyncLocal } from '../src/index.js'

type Attendee = { readonly id: string; readonly name: string }

// One instance for the whole application; each request runs with its own value.
const currentAttendee = new NodeAsyncLocal<Attendee>('current attendee')

export function handleCheckIn(attendee: Attendee): Promise<string> {
    return currentAttendee.run(attendee, () => checkIn())
}

// Deep below the handler, the attendee is read without being passed down by hand.
async function checkIn(): Promise<string> {
    await Promise.resolve()
    return `${currentAttendee.get().name} checked in`
}
