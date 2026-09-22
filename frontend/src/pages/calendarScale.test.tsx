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

/* Two days in the middle of a week: 17 July 2027 is a Saturday and the 18th a Sunday,
   so the bar stays inside one row and the week break is measured on its own below.

   Entered under the 15th, which is neither of its race days. */
const TWO_DAY = anEvent(7, 'Dvodnevna trka', '2027-07-15')
/* And a second event, of one day, in the same month and not the one being measured.
   „Never the only record of its kind": with the two-day event alone on the screen, a
   claim about what a bar says is also satisfied by every tile saying it. */
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
  it('gives every day it covers a link of its own, each saying the whole range', async () => {
    /* **THE CLAIM THAT ANSWERS THE FAULT OF 22.09.2026, and it holds at every width
       because it is about the markup and nothing else.** The first draft made one
       piece a month the link and hid the rest from the accessibility tree; above 780px
       those were mute stumps and it read well, and below it, where the days stack and
       nothing hides anything, they were whole tiles nobody could tap and no screen
       reader could find. 26 of them in the served calendar, measured in a browser.

       `ADL.md` A7 (31.07.2026) is the decision that forbids it in so many words:
       „Kontrola koja menja natpis po širini ekrana mora zadržati oba natpisa u
       pristupačnom stablu … Skrivanje se radi pomeranjem van vidnog polja …, nikad
       uklanjanjem." So nothing here may depend on a stylesheet, and `jsdom` applies
       none, which is exactly why this case can hold it. */
    const { container, stop } = await july()

    try {
      const marks = screen.getAllByRole('link', { name: /Dvodnevna trka/ })

      expect(marks).toHaveLength(2)
      /* Both say the same thing, and it is the WHOLE range, in the case the two
         prepositions govern. The same name on two links is right rather than the
         „identical labels" fault: that one is about links leading to different places,
         and both of these lead to the one event. */
      for (const mark of marks) {
        expect(mark).toHaveAccessibleName(
          'Dvodnevna trka, od 17. jula 2027. do 18. jula 2027.' + LENGTH,
        )
        expect(mark).toHaveAttribute('href', '/sr/kalendar/dogadjaj-7')
      }

      /* One in each of the two days, so „two links" is not „two in the same day". */
      expect(within(dayBox(container, 17)).getAllByRole('link', { name: /Dvodnevna/ })).toHaveLength(1)
      expect(within(dayBox(container, 18)).getAllByRole('link', { name: /Dvodnevna/ })).toHaveLength(1)

      /* And nothing that carries a word is taken out of the accessibility tree. The
         only `aria-hidden` inside a bar is what says nothing: the coloured dots and the
         space that holds the stump's line. */
      const spoken = [...container.querySelectorAll('.chip--scale [aria-hidden="true"]')]

      expect(spoken).not.toHaveLength(0)
      expect(
        spoken.every((one) => one.className === 'chip__hold' || one.className.startsWith('length-dot')),
        'something with a word in it is hidden from a screen reader',
      ).toBe(true)
      expect(container.querySelectorAll('.chip--scale[aria-hidden]')).toHaveLength(0)
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
      const marks = screen.getAllByRole('link', { name: /Dvodnevna trka/ })

      /* A third day, a third link, and all three say the longer range. */
      expect(marks).toHaveLength(3)
      for (const mark of marks) {
        expect(mark).toHaveAccessibleName(
          'Dvodnevna trka, od 17. jula 2027. do 19. jula 2027.' + LENGTH,
        )
      }
      expect(within(dayBox(container, 19)).getByText('Dvodnevna trka')).toBeVisible()
    } finally {
      stop()
    }
  })

  it('leaves a one-day event exactly as it was', async () => {
    /* A one-day event is not a bar and takes no mark a bar takes. Derived from the
       owner's own sentence rather than quoted as it: he asked for a scale „ako se radi
       o takvom dogadjaju" (`PDL.md:7060-7063`), which says nothing about an event that
       is not one, so nothing about it changes. The class is read here and nowhere else
       in this file, because this is the one claim that is about a tile carrying no new
       mark at all. */
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
       Monday. Four days, four links, one range. */
    const rajac = anEvent(7, 'Trka sa razmakom', '2020-09-20')
    const { container, stop } = await july()

    stop()

    const second = calendarOf([rajac], [aRace(1, 7, '2020-09-27'), aRace(2, 7, '2020-09-30')])

    try {
      const { container: shown } = renderAt('/sr/kalendar?mesec=2020-09')

      await screen.findByRole('heading', { level: 2, name: 'septembar 2020.' })

      const marks = screen.getAllByRole('link', { name: /Trka sa razmakom/ })

      expect(marks).toHaveLength(4)
      for (const mark of marks) {
        expect(mark).toHaveAccessibleName(
          'Trka sa razmakom, od 27. septembra 2020. do 30. septembra 2020.' + LENGTH,
        )
      }

      /* And one on each of the four days, the two in the middle included, which are
         the days no race of it is run on. */
      for (const day of [27, 28, 29, 30]) {
        expect(
          within(dayBox(shown, day)).getAllByRole('link', { name: /Trka sa razmakom/ }),
          `the ${day}th`,
        ).toHaveLength(1)
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

  it('tells the sheet how many days of ITS OWN ROW the bar still covers', async () => {
    /* **The one number the stylesheet cannot work out for itself** (owner, 22.09.2026):
       „Ime pocinje na levom kraju trake i sme da tece preko narednih dana, ali se
       zaustavlja tamo gde pocinju tacke, sa trotackom ako je predugo." The name is drawn
       by the piece that opens the run and let out of its own day across the pieces that
       follow it, so how much room it has is how long the RUN is, and a day knows only
       its own piece. Without this the rule computes to nothing and the name goes back to
       running as far as the letters take it: measured at 1024px, 282,67px past the end
       of its own bar and over the tile of an unrelated event.

       **It is days of a ROW and never days of the event, and the two are pulled apart
       here**, because on most bars they are the same number and a case on one of those
       measures nothing. 25 September 2020 is a Friday and the event runs to the 30th:
       six days of event, **three** of row, and the Sunday closes the run whether the
       event ends or not.

       The second event is the one already measured above, 27 to 30 September, whose run
       begins again on the Monday. Between them every answer the count can give is here:
       a run closed by the row, one closed by the event, one closed by both on its first
       day, and the days in the middle counting down. */
    const long = anEvent(7, 'Trka preko dve nedelje', '2020-09-20')
    const { stop } = calendarOf(
      [long],
      [aRace(1, 7, '2020-09-25'), aRace(2, 7, '2020-09-30')],
    )

    /** What the piece in one day hands the stylesheet. */
    const across = (container: HTMLElement, day: number) =>
      at([...dayBox(container, day).querySelectorAll<HTMLElement>('.chip--scale')], 0).style
        .getPropertyValue('--run-days')

    try {
      const { container } = renderAt('/sr/kalendar?mesec=2020-09')

      await screen.findByRole('heading', { level: 2, name: 'septembar 2020.' })

      /* Friday, Saturday, Sunday: the run is three days long and the Sunday ends it,
         although the event has three more days to run. */
      expect(across(container, 25), 'Friday the 25th').toBe('3')
      expect(across(container, 26), 'Saturday the 26th').toBe('2')
      expect(across(container, 27), 'Sunday the 27th').toBe('1')
      /* And it starts over on the Monday, where the event's own last day closes it. */
      expect(across(container, 28), 'Monday the 28th').toBe('3')
      expect(across(container, 29), 'Tuesday the 29th').toBe('2')
      expect(across(container, 30), 'Wednesday the 30th').toBe('1')
    } finally {
      stop()
    }
  })

  it('is drawn in both months it touches, and says the whole range in each', async () => {
    /* Ultra-trail Stara planina ran 31 May to 1 June 2019 and is the one event in the
       served file that crosses a month. June holds no first day of it, so what is held
       here is that June draws it and that what it says is the range of the EVENT and
       not the part of it June happens to hold. */
    const across = anEvent(7, 'Trka preko meseca', '2019-05-20')
    const races = [aRace(1, 7, '2019-05-31'), aRace(2, 7, '2019-06-01')]
    const { stop } = calendarOf([across], races)

    try {
      const { container } = renderAt('/sr/kalendar?mesec=2019-06')

      await screen.findByRole('heading', { level: 2, name: 'jun 2019.' })

      const june = screen.getAllByRole('link', { name: /Trka preko meseca/ })

      expect(june).toHaveLength(1)
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
         line carries no word, which is what lets the sheet take it away on a telephone
         where there are no lanes to line up with. */
      const second = [...dayBox(container, 2).querySelectorAll('.chip')]

      expect(second.map((one) => one.className)).toEqual([
        'chip chip--hollow',
        expect.stringContaining('chip--scale'),
      ])
      expect(first(second)).toHaveAttribute('aria-hidden', 'true')

      /* **And the day still holds its link**, which is the half the first draft got
         wrong: a reader reaching the 2nd of June finds the event that is run on it,
         named and with its range, rather than a held lane and a tile nobody can
         reach (`ADL.md` A7). */
      expect(within(dayBox(container, 2)).getAllByRole('link')).toHaveLength(1)
      expect(within(dayBox(container, 2)).getByRole('link')).toHaveAccessibleName(
        'Donja trka, od 1. juna 2019. do 2. juna 2019.' + LENGTH,
      )
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

      const marks = screen.getAllByRole('link', { name: /Višednevni trening/ })

      /* The Saturday opens the bar and runs on into the Sunday, so it draws a start and
         no end; the Sunday continues it and closes. The whole class is read and not a
         piece of it: asked as „contains chip--training", a bar that also forgot to open
         or to run on would pass. */
      expect(marks.map((one) => one.className)).toEqual([
        'chip chip--training chip--scale chip--runs-on',
        'chip chip--training chip--scale chip--continues',
      ])
      /* And both say which kind they are, so the word does not stop halfway along the
         bar either. */
      for (const mark of marks) {
        expect(mark).toHaveAccessibleName(
          `Višednevni trening${sr.event.kind.training}, od 17. jula 2027. do 18. jula 2027.${LENGTH}`,
        )
      }
      expect(dayBox(container, 18).querySelectorAll('.chip--scale')).toHaveLength(1)
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
