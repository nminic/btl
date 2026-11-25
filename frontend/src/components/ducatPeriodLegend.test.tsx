import { screen } from '@testing-library/react'
import type { DucatFamily } from '../data/ducatRule'
import { renderAt } from '../test/render'

/**
 * THE LEGEND OF THE PERIOD ON A COIN IS STRUCK IN THE LANGUAGE OF THE READER
 * (owner, 25.11.2026, PDL P18: no part of the portal a visitor can see may lack its English).
 *
 * `ducatRule.periodLegend` used to write "JUL 2027" and "SEZONA 2027" itself, in Serbian, so a visitor on
 * `/en` read the one legend of a coin that the hand translation of the ducats (V115) does not reach, the
 * one that is built in code. Both screens that draw a coin are read here in both languages: the rulebook
 * (`firstOf`, the first instance of a family) and the awards of a member (`instanceAt`, the instance he
 * holds).
 *
 * The expected words are written out here, in this file, and not read from the dictionary: a case that
 * read the words from the same dictionary the screen reads would pass for any dictionary at all.
 */

const SLOW = 20_000

const monthly = (id: string): DucatFamily => ({
  id,
  name: 'Mesečni kilometri',
  kind: 'totalKm',
  value: 20,
  period: 'month',
  top: 'ISTRČANIH',
  topFemale: '',
  bottom: '',
  periodAt: 'bottom',
  mark: 'distance',
  art: 'none',
  tier: 1,
  step: 0,
  last: 0,
  tierUpFrom: 0,
  counted: '',
})

const seasonal = (id: string): DucatFamily => ({
  ...monthly(id),
  name: 'Sezonski kilometri',
  period: 'season',
  periodAt: 'top',
  top: '',
  bottom: 'KILOMETARA',
})

/** The server, answering the two addresses a coin is drawn from and nothing else. */
function serving(families: DucatFamily[], held: unknown[]): () => void {
  const real = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const asked = String(input)

    if (asked === '/api/ducat-awards/000001') {
      return new Response(JSON.stringify(held), { status: 200 })
    }

    return asked.replace(/\?lang=[a-z]+$/, '').endsWith('/api/ducats')
      ? new Response(JSON.stringify(families), { status: 200 })
      : real(input)
  }) as typeof fetch

  return () => {
    globalThis.fetch = real
  }
}

describe('the period on the coins of the rulebook', () => {
  it.each([
    ['/en/pravilnik', 'SEASON 2027', 'JANUARY 2027', 'SEZONA 2027', 'JANUAR 2027'],
    ['/sr/pravilnik', 'SEZONA 2027', 'JANUAR 2027', 'SEASON 2027', 'JANUARY 2027'],
  ])('%s strikes %s and %s, and never %s or %s', async (path, season, month, notSeason, notMonth) => {
    const restore = serving([seasonal('duk-sezonski'), monthly('duk-mesecni')], [])

    try {
      renderAt(path, 'visitor', null)

      /* Waited for by what stands under the coin in either language, so that a coin struck in the wrong
         language ends the case on its own sentence and not on the clock of the wait. */
      await screen.findByText('Sezonski kilometri')
      expect(screen.getByText(season)).toBeInTheDocument()
      expect(screen.getByText(month)).toBeInTheDocument()
      expect(screen.queryByText(notSeason)).toBeNull()
      expect(screen.queryByText(notMonth)).toBeNull()
    } finally {
      restore()
    }
  }, SLOW)
})

describe('the period on the coin of a member who holds one', () => {
  const held = [{ ducat: 'duk-mesecni', value: 20, tier: 1, season: 2027, month: 7 }]

  it.each([
    ['/en/takmicar/000001/priznanja', 'JULY 2027', 'JUL 2027'],
    ['/sr/takmicar/000001/priznanja', 'JUL 2027', 'JULY 2027'],
  ])('%s strikes %s and never %s', async (path, struck, notStruck) => {
    const restore = serving([monthly('duk-mesecni')], held)

    try {
      renderAt(`${path}?sezona=2010`, 'visitor', null, undefined, '2027-08-01')

      await screen.findByRole('img', { name: /^Mesečni kilometri/ })
      expect(screen.getByText(struck)).toBeInTheDocument()
      expect(screen.queryByText(notStruck)).toBeNull()
    } finally {
      restore()
    }
  }, SLOW)
})
