import { screen, within } from '@testing-library/react'
import { clearResourceCache } from '../data/client'
import type { BtlEvent, EventKind, Race } from '../data/types'
import sr from '../i18n/sr.json'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'

/**
 * A FEATURED EVENT IS A GOLD TILE IN THE CALENDAR (owner, 12.11.2026).
 *
 * „Kad su istaknuti događaji prikazani u kalendaru, neka cela pločica bude zlatna, a
 * onda prilagodi ostale boje elemenata unutar nje tako da budu vidljivi." Since
 * 11.08.2026 the decision had said a featured event „se izdvaja u kalendaru", and until
 * this day the calendar did not single it out anywhere.
 *
 * **What is measured here and what is not.** The gold itself is a colour, and jsdom
 * applies no sheet (ADL A18): what the gold and everything on it measure is held in
 * `styles/featuredTile.test.ts`. Here is the half that lives in the markup, and it is
 * the half that makes the colour lawful and the colour reach the tile at all:
 *
 * - the tile says it in words, because the gold is the only thing that draws it
 *   (WCAG 2.2 SC 1.4.1);
 * - and the tile carries the one class the sheet paints gold. That class is the joint
 *   between this file and the other one, and it is asserted in both directions here,
 *   because a guard split into two halves that never asserts what binds them reads as
 *   though it works (`CLAUDE.md`, 28.09.2026).
 *
 * **Every path that draws a tile, and never the featured one alone.** A one-day tile
 * and every piece of a bar are drawn by two components, and the page of one day draws
 * the first of them again; each gets its featured and its plain neighbour on the same
 * screen, so „every tile is gold" and „no tile is gold" both fail. The featured events
 * are not the first of their list, so a tile that read the first event's flag instead of
 * its own is told apart as well.
 */

const SAID = sr.calendar.featured

const anEvent = (id: number, name: string, kind: EventKind, featured: boolean): BtlEvent => ({
  id,
  slug: `dogadjaj-${id}`,
  name,
  date: '2027-07-01',
  city: 'Niš',
  country: 'RS',
  kind,
  description: '',
  link: '',
  copiedFrom: null,
  featured,
})

const aRace = (id: number, eventId: number, date: string): Race => ({
  id,
  eventId,
  name: 'Trka',
  renamed: false,
  kind: 'length',
  limitSeconds: 0,
  date,
  distanceKm: 10,
  ascentM: 0,
  descentM: 0,
  category: 'short',
  dots: ['short'],
})

/* Plain first, on purpose: see the note at the head of the file. */
const PLAIN_RACE = anEvent(1, 'Obična trka', 'race', false)
const FEATURED_RACE = anEvent(2, 'Istaknuta trka', 'race', true)
const FEATURED_GATHERING = anEvent(3, 'Istaknut skup', 'gathering', true)
const PLAIN_GATHERING = anEvent(4, 'Običan skup', 'gathering', false)
const FEATURED_BAR = anEvent(5, 'Istaknuta dvodnevna', 'race', true)
const PLAIN_BAR = anEvent(6, 'Obična dvodnevna', 'race', false)
const FEATURED_TRAINING = anEvent(7, 'Istaknut trening', 'training', true)

/* Every one-day event on the 22nd, so the page of that day holds both kinds of tile;
   the two bars over the 17th and the 18th, a Saturday and a Sunday of one row. A
   gathering and a training carry no races, so they stand on the day they are entered
   under, which is the 22nd as well. */
const GATHERINGS = [FEATURED_GATHERING, PLAIN_GATHERING, FEATURED_TRAINING].map((one) => ({
  ...one,
  date: '2027-07-22',
}))
const SHOWN = [PLAIN_RACE, FEATURED_RACE, ...GATHERINGS, FEATURED_BAR, PLAIN_BAR]

const RACES = [
  aRace(1, 1, '2027-07-22'),
  aRace(2, 2, '2027-07-22'),
  aRace(5, 5, '2027-07-17'),
  aRace(6, 5, '2027-07-18'),
  aRace(7, 6, '2027-07-17'),
  aRace(8, 6, '2027-07-18'),
]

function serving(events: BtlEvent[], races: Race[]) {
  const answers: Record<string, unknown[]> = { '/api/events': events, '/api/races': races }

  clearResourceCache()

  return serverThat((path) =>
    path in answers
      ? new Response(JSON.stringify(answers[path]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      : null,
  )
}

/** Every link drawn for one event, by the accessible name the tile begins with. By
 *  the name and not by the text: a piece that continues a bar opens with a held space
 *  that is not part of what it says. */
const tilesOf = (name: string) =>
  screen.getAllByRole('link', { name: (said: string) => said.startsWith(name) })

function isGold(link: HTMLElement): boolean {
  return link.classList.contains('chip--featured')
}

function saysItIsFeatured(link: HTMLElement): boolean {
  return within(link).queryByText(new RegExp(SAID)) !== null
}

describe('a featured event in the month', () => {
  it('draws its tile gold and says so, and the plain one beside it neither', async () => {
    const { stop } = serving(SHOWN, RACES)
    renderAt('/sr/kalendar?mesec=2027-07')

    await screen.findByRole('heading', { level: 2, name: 'jul 2027.' })

    try {
      for (const name of [FEATURED_RACE.name, FEATURED_GATHERING.name]) {
        const tiles = tilesOf(name)

        expect(tiles, `no tile for ${name}`).toHaveLength(1)
        for (const tile of tiles) {
          expect(isGold(tile), `${name} is not gold`).toBe(true)
          expect(saysItIsFeatured(tile), `${name} does not say it is featured`).toBe(true)
        }
      }

      for (const name of [PLAIN_RACE.name, PLAIN_GATHERING.name]) {
        const tiles = tilesOf(name)

        expect(tiles, `no tile for ${name}`).toHaveLength(1)
        for (const tile of tiles) {
          expect(isGold(tile), `${name} is gold and is not featured`).toBe(false)
          expect(saysItIsFeatured(tile), `${name} says it is featured`).toBe(false)
        }
      }
    } finally {
      stop()
    }
  })

  it('keeps the kind under the gold, so the edge still says which it is', async () => {
    const { stop } = serving(SHOWN, RACES)
    renderAt('/sr/kalendar?mesec=2027-07')

    await screen.findByRole('heading', { level: 2, name: 'jul 2027.' })

    try {
      /* Gold over the kind and not instead of it: the edge of a featured tile keeps the
         colour and the width of its kind (owner, 12.11.2026, the same evening), and the
         sheet can only draw that if the tile still says which kind it is. Which colour
         each kind's edge is on the gold is held in `styles/featuredTile.test.ts`; this
         is the markup half, one featured tile of each of the three kinds. The word for
         the kind is spoken as well. */
      const [gathering] = tilesOf(FEATURED_GATHERING.name)

      expect(gathering?.className).toBe('chip chip--gathering chip--featured')
      expect(gathering?.textContent).toContain(sr.event.kind.gathering)

      const [training] = tilesOf(FEATURED_TRAINING.name)

      expect(training?.className).toBe('chip chip--training chip--featured')
      expect(training?.textContent).toContain(sr.event.kind.training)

      const [race] = tilesOf(FEATURED_RACE.name)

      expect(race?.className).toBe('chip chip--featured')
    } finally {
      stop()
    }
  })

  it('names the tile in words in the order it is read: the name, then that it is featured', async () => {
    const { stop } = serving(SHOWN, RACES)
    renderAt('/sr/kalendar?mesec=2027-07')

    await screen.findByRole('heading', { level: 2, name: 'jul 2027.' })

    try {
      expect(
        screen.getByRole('link', { name: `${FEATURED_RACE.name}, ${SAID}${sr.category.short}` }),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: `${PLAIN_RACE.name}${sr.category.short}` })).toBeVisible()
    } finally {
      stop()
    }
  })

  it('draws every piece of a featured bar gold, and no piece of a plain one', async () => {
    const { stop } = serving(SHOWN, RACES)
    renderAt('/sr/kalendar?mesec=2027-07')

    await screen.findByRole('heading', { level: 2, name: 'jul 2027.' })

    try {
      const featured = tilesOf(FEATURED_BAR.name)
      const plain = tilesOf(PLAIN_BAR.name)

      /* Two days, one piece each: a bar and not a tile of one day. */
      expect(featured).toHaveLength(2)
      expect(plain).toHaveLength(2)
      for (const piece of featured) {
        expect(piece.classList.contains('chip--scale')).toBe(true)
        expect(isGold(piece)).toBe(true)
        expect(saysItIsFeatured(piece)).toBe(true)
      }
      for (const piece of plain) {
        expect(piece.classList.contains('chip--scale')).toBe(true)
        expect(isGold(piece)).toBe(false)
        expect(saysItIsFeatured(piece)).toBe(false)
      }
    } finally {
      stop()
    }
  })
})

describe('a featured event on the page of its day', () => {
  it('is gold there too, and the plain one beside it is not', async () => {
    const { stop } = serving(SHOWN, RACES)
    renderAt('/sr/kalendar/dan/2027-07-22')

    await screen.findByRole('link', { name: new RegExp(FEATURED_RACE.name) })

    try {
      const [featured] = tilesOf(FEATURED_RACE.name)
      const [plain] = tilesOf(PLAIN_RACE.name)

      expect(featured && isGold(featured)).toBe(true)
      expect(featured && saysItIsFeatured(featured)).toBe(true)
      expect(plain && isGold(plain)).toBe(false)
      expect(plain && saysItIsFeatured(plain)).toBe(false)
    } finally {
      stop()
    }
  })
})

describe('the featured events the portal serves', () => {
  it('are gold in the month they are in', async () => {
    /* Read off the served file rather than made up here, so the screen and this case
       show what the data holds: the mock carries featured races, among them one on
       30 January 2027, the day the first of the two featured events on production is
       run. And the month holds plain races as well, which is what makes it a test. */
    renderAt('/sr/kalendar?mesec=2027-01')

    await screen.findByRole('heading', { level: 2, name: 'januar 2027.' })

    const tiles = screen.getAllByRole('link').filter((link) => link.classList.contains('chip'))
    const gold = tiles.filter(isGold)

    expect(gold.length).toBeGreaterThan(0)
    expect(gold.length).toBeLessThan(tiles.length)
    for (const tile of tiles) {
      expect(isGold(tile)).toBe(saysItIsFeatured(tile))
    }
  })
})
