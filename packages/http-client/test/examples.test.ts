import { describe, expect, it } from 'vitest'

import { lookUpSpeakers } from '../examples/speaker-directory.js'

describe('the canonical client', () => {
    it('reads what another system answers, and takes a 404 as nobody', async () => {
        expect(await lookUpSpeakers()).toEqual([{ name: 'Ada', talks: 2 }, null])
    })
})
