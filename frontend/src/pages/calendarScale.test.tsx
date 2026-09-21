import { screen, within } from '@testing-library/react'
import { clearResourceCache } from '../data/client'
import type { BtlEvent, Race } from '../data/types'
import sr from '../i18n/sr.json'
import { at, first } from '../test/at'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'

/**
 * A MULTI-DAY EVENT IS ONE MARK ACROSS ITS DAYS (PDL P35, 21.09.2026).
 *
 * Owner: „napravi skale u Kalendar view koje mogu zauzimati vise dana ako se radi o
 * takvom dogadjaju", and „Raspon se IZVODI, ne upisuje: `race.date` je `not null`, pa
 * su granice najranija i najkasnija trka."
 *
 * **THE TWO SOURCES ARE PULLED APART HERE, AND WITHOUT THAT NONE OF THIS MEASURES
 * ANYTHING.** Measured over `public/mock/events.json` on 21.09.2026: all 1167 events
 * carry the day of their own first race, so on the served data „the range comes from
 * the races" and „the range comes from the event" give the same two strings and no
 * case can tell them apart. Every event below is therefore entered under a day **no
 * race of it is run on**, so a portal reading the wrong source draws the wrong days.
 *
 * **What is measured here and what is not.** Everything about a bar that lives in the
 * markup: how many marks there are, which of them a reader with their ears meets, what
 * it says, and which days carry a piece. Whether the pieces LOOK like one bar is a
 * question about the stylesheet, and jsdom lays nothing out and applies no sheet
 * (ADL A18, A33); the declarations that do it are held in `calendarStyle.test.ts` and
 * the geometry was measured in a browser.
 */

/**
 * What every tile here says after its name, and it is not this change's doing.
 *
 * A tile has named the lengths it holds since 31.07.2026, beside the coloured dots and
 * for whoever cannot separate two of them, so the accessible name of any tile ends with
 * them. Every race below is a ten kilometre one, so that word is the same on all of
 * them; read out of the dictionary rather than written here, so a change to the word
 * moves these cases with it instead of leaving them to be found.
 *
 * It is spelled out rather than matched loosely because WHERE the range sits is part of
 * what is being held: the name, then the range, then the lengths. Asked as „contains",
 * a range appended after the lengths would pass.
 */
const LENGTH = sr.category.short

const anEvent = (id: number, name: string, entered: string): BtlEvent => ({
  id,
  slug: `dogadjaj-${id}`,
  name,
  date: entered,
  city: 'Niš',
  country: 'RS',
  kind: 'race',
  description: '',
  link: '',
  copiedFrom: null,
  featured: false,
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
})

/**
 * The calendar reading exactly these events and these races.
 *
 * Everything else the shell asks for while a screen is mounted goes on to the disc
 * reader, which is what `serverThat` is for: replacing it outright leaves every screen
 * inside the shell empty, which is a different fault reported as this one.
 */
function calendarOf(events: BtlEvent[], races: Race[]) {
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

/* Two days in the middle of a week, the shape the owner named: „Dogadjaj od 17. do 18.
   jula mora da bude prepoznatljiv kao jedan dogadjaj preko dva dana, a ne dve oznake."
   17 July 2027 is a Saturday and the 18th a Sunday, so the bar stays inside one row.

   Entered under the 15th, which is neither of its race days. */
const TWO_DAY = anEvent(7, 'Dvodnevna trka', '2027-07-15')
/* And a second event, of one day, in the same month and not the one being measured.
   „Never the only record of its kind": with the two-day event alone on the screen,
   „one link carries the range" is also satisfied by every link carrying it. */
const ONE_DAY = anEvent(9, 'Jednodnevna trka', '2027-07-15')

const RACES = [
  aRace(1, 7, '2027-07-17'),
  aRace(2, 7, '2027-07-18'),
  /* The one-day event's race is not on either of the other's days, so the two bars
     cannot be told apart by accident. */
  aRace(3, 9, '2027-07-22'),
]

async function july(events: BtlEvent[] = [TWO_DAY, ONE_DAY], races: Race[] = RACES) {
  const { stop } = calendarOf(events, races)
  const { container } = renderAt('/sr/kalendar?mesec=2027-07')

  await screen.findByRole('heading', { level: 2, name: 'jul 2027.' })

  return { container, stop }
}

/** The day box of one day of the month, by the number written in it. */
function dayBox(container: HTMLElement, day: number): HTMLElement {
  return at(
    [...container.querySelectorAll<HTMLElement>('.day')].filter(
      (one) => one.querySelector('.day__number')?.textContent?.startsWith(String(day)) === true,
    ),
    0,
  )
}

describe('an event that runs over several days', () => {
  it('is one link with its range in words, however many days it covers', async () => {
    const { container, stop } = await july()

    try {
      /* ONE mark and not two, which is the whole of the owner's sentence. Asked by the
         name a reader hears rather than by a class, so a second tile that merely looks
         different still fails this. */
      const marks = screen.getAllByRole('link', { name: /Dvodnevna trka/ })

      expect(marks).toHaveLength(1)
      /* And it says the range out loud, in the case the two prepositions govern: a bar
         says „two days" with its shape, and shape is the one thing somebody reading
         with their ears never gets. */
      expect(first(marks)).toHaveAccessibleName(
        'Dvodnevna trka, od 17. jula 2027. do 18. jula 2027.' + LENGTH,
      )

      /* Both days carry a piece of it all the same, so „one link" is not „drawn on one
         day". The second piece is not a link and is not spoken. */
      expect(within(dayBox(container, 17)).getAllByRole('link', { name: /Dvodnevna/ })).toHaveLength(1)
      expect(within(dayBox(container, 18)).queryAllByRole('link', { name: /Dvodnevna/ })).toHaveLength(0)
      expect(dayBox(container, 18).querySelectorAll('.chip--scale')).toHaveLength(1)
      expect(at([...dayBox(container, 18).querySelectorAll('.chip--scale')], 0)).toHaveAttribute(
        'aria-hidden',
        'true',
      )
    } finally {
      stop()
    }
  })

  it('takes its days from the races and not from the day it was entered under', async () => {
    /* The event says the 15th. Read off the event there would be one tile on the 15th
       and nothing on the 17th or the 18th; read off the races there is a bar over the
       two and nothing at all on the 15th. Neither end of the two answers agrees, so
       this cannot pass on the wrong source. */
    const { container, stop } = await july()

    try {
      expect(within(dayBox(container, 15)).queryByText('Dvodnevna trka')).toBeNull()
      expect(within(dayBox(container, 17)).getByText('Dvodnevna trka')).toBeVisible()
      expect(within(dayBox(container, 18)).getByText('Dvodnevna trka')).toBeVisible()
    } finally {
      stop()
    }
  })

  it('becomes a plain tile again the moment it is left with one day', async () => {
    /* The same event with its second race taken away. A bar that stays a bar here is a
       bar that was never about the range. */
    const { container, stop } = await july([TWO_DAY, ONE_DAY], [at(RACES, 0), at(RACES, 2)])

    try {
      const mark = screen.getByRole('link', { name: /Dvodnevna trka/ })

      /* No range said, because there is no range: what a one-day event says is what it
         said before any of this existed. */
      expect(mark).toHaveAccessibleName('Dvodnevna trka' + LENGTH)
      expect(mark.className).toBe('chip')
      expect(within(dayBox(container, 18)).queryByText('Dvodnevna trka')).toBeNull()
    } finally {
      stop()
    }
  })

  it('grows by a day when a race is added a day later', async () => {
    const { container, stop } = await july(
      [TWO_DAY, ONE_DAY],
      [...RACES, aRace(4, 7, '2027-07-19')],
    )

    try {
      expect(screen.getByRole('link', { name: /Dvodnevna trka/ })).toHaveAccessibleName(
        'Dvodnevna trka, od 17. jula 2027. do 19. jula 2027.' + LENGTH,
      )
      expect(within(dayBox(container, 19)).getByText('Dvodnevna trka')).toBeVisible()
      /* Still one mark, three days on. */
      expect(screen.getAllByRole('link', { name: /Dvodnevna trka/ })).toHaveLength(1)
    } finally {
      stop()
    }
  })

  it('leaves a one-day event exactly as it was', async () => {
    /* „Jednodnevni ostaju kako jesu; skala ne sme da ih promeni." The class is read
       here and nowhere else in this file, because this is the one claim that is about
       a tile carrying no new mark at all. */
    const { container, stop } = await july()

    try {
      const one = screen.getByRole('link', { name: 'Jednodnevna trka' + LENGTH })

      expect(one.className).toBe('chip')
      expect(within(dayBox(container, 22)).getAllByRole('link')).toHaveLength(1)
    } finally {
      stop()
    }
  })

  it('reaches over a day no race of it is run on', async () => {
    /* Rajac trek 2020 is the one in the served file: races on the 27th and on the 30th
       and nothing between. The owner wrote „najranija i najkasnija trka", so the bar
       covers the days between as well.

       It also crosses the break between two rows: the 27th is a Sunday and the 28th a
       Monday. Still one mark and still one range. */
    const rajac = anEvent(7, 'Trka sa razmakom', '2020-09-20')
    const { container, stop } = await july()

    stop()

    const second = calendarOf([rajac], [aRace(1, 7, '2020-09-27'), aRace(2, 7, '2020-09-30')])

    try {
      const { container: shown } = renderAt('/sr/kalendar?mesec=2020-09')

      await screen.findByRole('heading', { level: 2, name: 'septembar 2020.' })

      expect(screen.getAllByRole('link', { name: /Trka sa razmakom/ })).toHaveLength(1)
      expect(screen.getByRole('link', { name: /Trka sa razmakom/ })).toHaveAccessibleName(
        'Trka sa razmakom, od 27. septembra 2020. do 30. septembra 2020.' + LENGTH,
      )

      for (const day of [27, 28, 29, 30]) {
        expect(dayBox(shown, day).querySelectorAll('.chip--scale')).toHaveLength(1)
      }

      /* The piece that starts the new row opens the bar rather than reaching back into
         the day before it, which at that point is at the other end of the row above.
         Read off the class, because what it buys is a measurement in a browser: the
         reach is a negative margin and jsdom draws nothing. */
      expect(dayBox(shown, 28).querySelector('.chip--continues')).toBeNull()
      expect(dayBox(shown, 29).querySelector('.chip--continues')).not.toBeNull()
      expect(container).toBeDefined()
    } finally {
      second.stop()
    }
  })

  it('is drawn in both months it touches, and speaks in each of them', async () => {
    /* Ultra-trail Stara planina ran 31 May to 1 June 2019 and is the one event in the
       served file that crosses a month. June holds no first day of it, so read the
       obvious way June would carry a bar nobody can reach and nobody is told about. */
    const across = anEvent(7, 'Trka preko meseca', '2019-05-20')
    const races = [aRace(1, 7, '2019-05-31'), aRace(2, 7, '2019-06-01')]
    const { stop } = calendarOf([across], races)

    try {
      const { container } = renderAt('/sr/kalendar?mesec=2019-06')

      await screen.findByRole('heading', { level: 2, name: 'jun 2019.' })

      const june = screen.getAllByRole('link', { name: /Trka preko meseca/ })

      expect(june).toHaveLength(1)
      /* And what it says is the WHOLE range and not the part of it June holds, because
         the range is what the event is. */
      expect(first(june)).toHaveAccessibleName(
        'Trka preko meseca, od 31. maja 2019. do 1. juna 2019.' + LENGTH,
      )
      expect(dayBox(container, 1).querySelectorAll('.chip--scale')).toHaveLength(1)
    } finally {
      stop()
    }
  })

  it('holds the bar under an ended one in the line it had the day before', async () => {
    /* 2 June 2019 is the one day in the served file where this matters: Stara planina
       runs 31 May to 1 June and Palić 1 to 2 June, so on the 2nd the lane above Palić
       is empty. Without a line held open there, Palić climbs a row between the 1st and
       the 2nd and its bar breaks in the middle of itself. */
    const above = anEvent(7, 'Gornja trka', '2019-05-20')
    const below = anEvent(9, 'Donja trka', '2019-05-20')
    const { stop } = calendarOf(
      [above, below],
      [
        aRace(1, 7, '2019-05-31'),
        aRace(2, 7, '2019-06-01'),
        aRace(3, 9, '2019-06-01'),
        aRace(4, 9, '2019-06-02'),
      ],
    )

    try {
      const { container } = renderAt('/sr/kalendar?mesec=2019-06')

      await screen.findByRole('heading', { level: 2, name: 'jun 2019.' })

      /* Both on the 1st, in the order they start. */
      expect(
        [...dayBox(container, 1).querySelectorAll('.chip')].map((one) => one.textContent),
      ).toEqual([
        'Gornja trka, od 31. maja 2019. do 1. juna 2019.' + LENGTH,
        'Donja trka, od 1. juna 2019. do 2. juna 2019.' + LENGTH,
      ])

      /* And on the 2nd the lower one is still second, with an empty line over it. The
         line is not spoken and is not a link. */
      const second = [...dayBox(container, 2).querySelectorAll('.chip')]

      expect(second.map((one) => one.className)).toEqual([
        'chip chip--hollow',
        expect.stringContaining('chip--scale'),
      ])
      expect(first(second)).toHaveAttribute('aria-hidden', 'true')

      /* **AND THE DAY HOLDS NO LINK AT ALL, WHICH IS THE COST OF THE OWNER'S RULE
         WRITTEN DOWN RATHER THAN LEFT TO BE FOUND.** „Prepoznatljiv kao jedan dogadjaj
         preko dva dana, a ne dve oznake" means one mark per event per month, so a
         reader with their ears meets Donja trka on the 1st, where the whole range is
         said, and meets nothing on the 2nd. The other reading - a link on every day it
         covers - is exactly the two marks the rule refuses. This is a boundary and not
         an oversight, and it is the line to move if the owner ever wants the other. */
      expect(within(dayBox(container, 2)).queryAllByRole('link')).toHaveLength(0)
    } finally {
      stop()
    }
  })

  it('keeps the colour its kind always wore, and goes on saying which kind it is', async () => {
    /* A training and a gathering take a tile of their own (owner, 23.08.2026), and a
       training still has races under it (PDL, 22.08.2026), so it can run over days like
       anything else. **Nothing about a bar is told apart by colour** (ADL A7, WCAG 2.2
       SC 1.4.1): what says „several days" is the shape and the range in words, and what
       says „training" is the same tile and the same word it said on a single day.

       Held because it would otherwise be free to go: the kind is written into the class
       on one line, and a bar that forgot it would be a race-coloured tile calling itself
       a training only to a screen reader. */
    const training = { ...anEvent(7, 'Višednevni trening', '2027-07-15'), kind: 'training' as const }
    const { stop } = calendarOf([training, ONE_DAY], RACES)

    try {
      const { container } = renderAt('/sr/kalendar?mesec=2027-07')

      await screen.findByRole('heading', { level: 2, name: 'jul 2027.' })

      const mark = screen.getByRole('link', { name: /Višednevni trening/ })

      /* It opens on the Saturday and runs on into the Sunday, so it draws a start and
         no end. The whole class is read and not a piece of it: asked as „contains
         chip--training", a bar that also forgot to open or to run on would pass. */
      expect(mark.className).toBe('chip chip--training chip--scale chip--runs-on')
      expect(mark).toHaveAccessibleName(
        `Višednevni trening${sr.event.kind.training}, od 17. jula 2027. do 18. jula 2027.${LENGTH}`,
      )
      /* And the piece that only continues it wears the same tile, or the bar changes
         colour halfway along itself. */
      expect(at([...dayBox(container, 18).querySelectorAll('.chip--scale')], 0).className).toBe(
        'chip chip--training chip--scale chip--continues',
      )
    } finally {
      stop()
    }
  })

  it('stacks two bars of the very same days one under the other, the same way every time', async () => {
    /* Two events over the same two days have nothing to order them by but themselves.
       Left to the order they arrived in, the two would swap places between one reading
       and the next and the grid would look different on every refresh; and if both took
       the same lane, one bar would be drawn over the other and one event would vanish
       from the month. */
    const first = anEvent(7, 'Prva dvodnevna', '2027-07-15')
    const second = anEvent(9, 'Druga dvodnevna', '2027-07-15')
    const races = [
      aRace(1, 7, '2027-07-17'),
      aRace(2, 7, '2027-07-18'),
      aRace(3, 9, '2027-07-17'),
      aRace(4, 9, '2027-07-18'),
    ]
    /* Handed over in the order that would put the wrong one first if nothing ordered
       them: the one with the higher number is served first. */
    const { stop } = calendarOf([second, first], races)

    try {
      const { container } = renderAt('/sr/kalendar?mesec=2027-07')

      await screen.findByRole('heading', { level: 2, name: 'jul 2027.' })

      for (const day of [17, 18]) {
        expect(
          [...dayBox(container, day).querySelectorAll('.chip__name')].map((one) => one.textContent),
          `the two bars on the ${day}th`,
        ).toEqual(['Prva dvodnevna', 'Druga dvodnevna'])
      }
    } finally {
      stop()
    }
  })

  it('is on the page of every day it covers, not only of the one it was entered under', async () => {
    /* The grid sends a day with more on it than fits to a page of its own, so the two
       screens have to agree about what is on a day: read by the day it was entered
       under, the page would be empty on exactly the days a bar exists for. */
    const { stop } = calendarOf([TWO_DAY, ONE_DAY], RACES)

    try {
      renderAt('/sr/kalendar/dan/2027-07-18')

      expect(
        await screen.findByRole('heading', { level: 1, name: /18\. jul 2027/ }),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: /Dvodnevna trka/ })).toBeVisible()
      /* And the one-day event of that month is not on it, so this is not „the page
         shows everything". */
      expect(screen.queryByRole('link', { name: /Jednodnevna trka/ })).toBeNull()
    } finally {
      stop()
    }
  })
})
