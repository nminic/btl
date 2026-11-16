import { afterEach, describe, expect, it } from 'vitest'
import { serverThat } from '../../test/serverAnswers'
import { CARD_MARK, markIn, markOf } from './cardMark'

/**
 * THE MARK OF A CARD, AS THE SERVER ANSWERS IT (`CompetitorCardMarkApi`), read and refused.
 *
 * Owner, PDL P11, 16.11.2026, point 15: the address of his own profile carries „kratku oznaku stanja
 * kartice". What is held here is that the browser takes the server's mark as it comes and believes
 * nothing else; where it is written is `cardMarkInTheAddress.test.tsx`'s.
 */

let stop: (() => void) | null = null

afterEach(() => {
  stop?.()
  stop = null
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('the mark of a card', () => {
  it('is named by one letter in the address, as the owner was shown it', () => {
    expect(CARD_MARK).toBe('k')
  })

  it('is believed only in the shape the server gives', () => {
    expect(markIn({ mark: '268f' })).toBe('268f')
    expect(markIn({ mark: '0123456789abcdef' })).toBe('0123456789abcdef')

    for (const wrong of [
      { mark: '' },
      { mark: '268F' },
      { mark: '268g' },
      { mark: '0123456789abcdef0' },
      { mark: 268 },
      { mark: null },
      {},
      null,
      'mark',
    ]) {
      expect(markIn(wrong), JSON.stringify(wrong)).toBeNull()
    }
  })

  it('is asked for by the member and the language, and comes back as the server said it', async () => {
    const server = serverThat((path) => (path.startsWith('/api/cards/marks/') ? json({ mark: 'b7e2' }) : null))

    stop = server.stop

    expect(await markOf('000009', 'en')).toBe('b7e2')
    expect(server.asked.map((one) => one.path)).toEqual(['/api/cards/marks/000009-en'])
  })

  it('is nothing for every way the read can end without one', async () => {
    const answers: (() => Response | Promise<Response>)[] = [
      () => new Response(null, { status: 404 }),
      () => new Response('not json', { status: 200 }),
      () => json({ mark: 'NOPE' }),
      () => Promise.reject(new TypeError('no server')),
    ]

    for (const answer of answers) {
      const server = serverThat((path) => (path.startsWith('/api/cards/marks/') ? answer() : null))

      try {
        expect(await markOf('000009', 'sr')).toBeNull()
        expect(server.asked).toHaveLength(1)
      } finally {
        server.stop()
      }
    }
  })
})
