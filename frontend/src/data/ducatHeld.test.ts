import { renderHook, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { serverThat } from '../test/serverAnswers'
import { heldDucats, heldDucatsIn, useHeldDucats, type HeldDucat } from './ducatHeld'
import type { DucatFamily } from './ducatRule'

/**
 * WHAT THE PAGE OF AWARDS READS THE DUCATS A MEMBER HOLDS WITH: the answer of
 * `GET /api/ducat-awards/{memberNumber}` (`DucatAwardApi`) read into types, and drawn from the families.
 */

const SERVED: unknown = JSON.parse(readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'ducat-awards.json'), 'utf-8'))

const family = (id: string, tier: 1 | 2 | 3 | 4 | 5, over: Partial<DucatFamily> = {}): DucatFamily => ({
  id,
  name: `Ime ${id}`,
  kind: 'raceCount',
  value: 100,
  period: 'always',
  top: 'ISTRČANIH',
  topFemale: 'ISTRČALA',
  bottom: 'TRKA',
  periodAt: 'none',
  mark: 'races',
  art: 'none',
  tier,
  step: 0,
  last: 0,
  tierUpFrom: 0,
  counted: '',
  ...over,
})

const one: HeldDucat = { ducat: 'duk-a', value: 100, tier: 3, season: null, month: null }

describe('the answer, read into types', () => {
  it('reads the file the server is held to, every record of it', () => {
    const read = heldDucatsIn(SERVED)

    expect(read).toEqual(SERVED)
    expect(read).toHaveLength(6)
  })

  it('reads a member who holds nothing as nothing, and not as a failure', () => {
    expect(heldDucatsIn([])).toEqual([])
  })

  it.each([
    ['not a list', { ...one }],
    ['a code that is not text', [{ ...one, ducat: 7 }]],
    ['a threshold that is not a number', [{ ...one, value: '100' }]],
    ['a tier below the scale', [{ ...one, tier: 0 }]],
    ['a tier above the scale', [{ ...one, tier: 6 }]],
    ['a tier between two', [{ ...one, tier: 2.5 }]],
    ['a season that is not a year', [{ ...one, season: 27 }]],
    ['a season that is not whole', [{ ...one, season: 2027.5 }]],
    ['a month past December', [{ ...one, season: 2027, month: 13 }]],
    ['a month before January', [{ ...one, season: 2027, month: 0 }]],
    ['a month without its season', [{ ...one, month: 7 }]],
    ['a record that is missing its season', [{ ducat: 'duk-a', value: 100, tier: 3, month: null }]],
    ['one good record and one that is not', [one, { ...one, tier: 9 }]],
  ])('refuses %s, rather than drawing half of it', (_, body) => {
    expect(heldDucatsIn(body)).toBeNull()
  })
})

describe('the ducats drawn from their families', () => {
  it('keeps the order the server answered in, which is not the catalogue nor the tier', () => {
    /* Newest race first is decided on the server (`DucatAwardApi`), and the date never reaches this side,
       so nothing here may sort: the families are listed a, b, c and the tiers rise the other way. */
    const families = [family('duk-a', 1), family('duk-b', 2), family('duk-c', 5)]
    const held: HeldDucat[] = [
      { ...one, ducat: 'duk-b', tier: 2 },
      { ...one, ducat: 'duk-c', tier: 5 },
      { ...one, ducat: 'duk-a', tier: 1 },
    ]

    expect(heldDucats(held, families, 'M').map((each) => each.id)).toEqual(['duk-b', 'duk-c', 'duk-a'])
  })

  it('draws each from its own family, with the threshold and tier of the record', () => {
    const drawn = heldDucats(
      [{ ducat: 'duk-b', value: 300, tier: 4, season: 2027, month: 7 }],
      [family('duk-a', 1), family('duk-b', 2, { period: 'month', periodAt: 'bottom', step: 100, last: 1000 })],
      'F',
    )

    expect(drawn).toEqual([
      {
        id: 'duk-b-2027-07-300',
        name: 'Ime duk-b',
        kind: 'raceCount',
        value: 300,
        from: '2027-07-01',
        to: '2027-07-31',
        tier: 4,
        mark: 'races',
        art: 'none',
        top: 'ISTRČALA',
        bottom: 'JUL 2027',
      },
    ])
  })

  it('leaves off a ducat whose family the portal does not serve', () => {
    expect(heldDucats([{ ...one, ducat: 'duk-nema' }, one], [family('duk-a', 3)], 'M').map((each) => each.id))
      .toEqual(['duk-a'])
  })
})

describe('the read of one member', () => {
  const answering = (answer: () => Response | Promise<Response>) =>
    serverThat((path) => (path.startsWith('/api/ducat-awards/') ? answer() : null))

  it('asks the address of the member it is given, and hands back what came', async () => {
    const server = answering(() => new Response(JSON.stringify([one]), { status: 200 }))

    try {
      const { result } = renderHook(() => useHeldDucats('000007'))

      await waitFor(() => {
        expect(result.current).toEqual({ status: 'ready', data: [one] })
      })
      expect(server.asked.map((each) => each.path)).toEqual(['/api/ducat-awards/000007'])
    } finally {
      server.stop()
    }
  })

  it('asks nothing for an address with no member on it, and holds nothing', async () => {
    const server = answering(() => new Response('[]', { status: 200 }))

    try {
      const { result } = renderHook(() => useHeldDucats(undefined))

      await waitFor(() => {
        expect(result.current).toEqual({ status: 'ready', data: [] })
      })
      expect(server.asked).toEqual([])
    } finally {
      server.stop()
    }
  })

  it.each([
    ['refused', () => new Response(null, { status: 500 })],
    ['not JSON', () => new Response('<html>', { status: 200 })],
    ['not the shape', () => new Response(JSON.stringify({ ducats: [] }), { status: 200 })],
    ['not answered at all', () => Promise.reject(new TypeError('offline'))],
  ])('says it failed where the answer is %s, and never passes it for a member with nothing', async (_, answer) => {
    const server = answering(answer)

    try {
      const { result } = renderHook(() => useHeldDucats('000007'))

      await waitFor(() => {
        expect(result.current.status).toBe('error')
      })
    } finally {
      server.stop()
    }
  })
})
