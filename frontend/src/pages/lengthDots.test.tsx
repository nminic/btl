import { MemoryRouter } from 'react-router'
import { screen } from '@testing-library/react'
import { renderWithI18n } from '../test/render'
import type { BtlEvent, Race, RaceCategory, RaceKind } from '../data/types'
import { EventChip } from './calendar/DayChips'
import { CalendarExtract } from './home/CalendarExtract'

/* The dots a screen draws, asked of every screen that draws them.
 *
 * `derive.test.ts` asks `dotsAt` what an event holds and gets the right answer;
 * this asks the screens whether they draw it. The two are not the same question,
 * and the difference was measured twice on 30.08.2026, once in each screen: with
 * the tile filtering the new dot back out of what `dotsAt` hands it every one of
 * the 2400 tests passed, and with the front page doing the same thing all 2403
 * passed, coverage included, since the mutated line still runs.
 *
 * The plan for this change named that very mutation. It was run against the
 * function, where it falls, and not against a screen, where it did not; and when
 * the tile was answered, the front page was left, because the readers were
 * counted once and the count was not used. Hence one file for both, walked from
 * one list.
 *
 * **And that list is kept by hand, which is what this file does not measure.** A
 * check that swept the portal for the words `dotsAt(` stood here for one round
 * and was removed rather than tightened, because it answered a different question
 * from the one it was titled with. It said „and on no others" while
 * `calendar/LengthLegend.tsx` draws these very dots without calling the function
 * at all, reading `DOTS` straight; a third screen written `import { dotsAt as
 * dots }` was invisible to it, and merely renaming the import in a screen that
 * draws every dot correctly made it fail. False in the tree, silent on the case
 * it existed for, and loud on one that is not a fault (all three measured in
 * review, 30.08.2026). A sweep of text says which files hold a word, never which
 * screens draw a dot, and ADL A33 asks for that to be written down rather than
 * papered over: **a screen added to the portal is added to `SCREENS` by whoever
 * writes it, and nothing here will say so if they forget.**
 *
 * That is a real thing given up and not only a lie removed, which the first
 * telling of this left out. A third screen written the plain way, calling
 * `dotsAt(event, races)` as both of these do, was the one case the sweep did
 * catch, and it is the likeliest of the four; measured in review by adding
 * exactly such a call, where the sweep failed and nothing here does. It was still
 * the wrong trade to keep, because the sweep was false about the tree it stood in
 * and loud on a change that is not a fault, and a guard that cries on the
 * innocent is turned off by the next person rather than read.
 *
 * Rendered directly rather than through a screen, because both take their events
 * and races as arguments while a screen takes what the store holds, and the store
 * holds no race that fixes a time or nothing at all: all 1612 of them are run to a
 * length. The router is here because both draw links (`Markdown.test.tsx` renders
 * the same way).
 */

const event: BtlEvent = {
  id: 'one',
  slug: 'one',
  name: 'Trka kroz šumu',
  date: '2027-05-08',
  city: 'Niš',
  country: 'RS',
  kind: 'race',
  description: '',
  link: '',
  copiedFrom: '',
  featured: 'no',
}

const race = (id: string, kind: RaceKind, category: RaceCategory): Race => ({
  id,
  eventId: 'one',
  name: 'Trka',
  renamed: 'no',
  kind,
  limitSeconds: kind === 'time' ? 86_400 : 0,
  date: '2027-05-08',
  /* A length on the record even where the kind says it fixes none, which is the
     case that matters: that is what a race saved as a length and then changed to
     a time still carries, and reading the category off it is exactly the fault
     this dot exists to end. A record with nothing on it would pass a screen that
     went on reading the category. */
  distanceKm: 42.2,
  ascentM: 0,
  descentM: 0,
  category,
})

/** The two screens that draw these dots, each given the same event and races.
 *  The front page is handed a day before the event, since it draws what is still
 *  to come. */
const SCREENS = [
  { where: 'a calendar tile', draw: (races: Race[]) => <EventChip event={event} races={races} /> },
  {
    where: 'the front page',
    draw: (races: Race[]) => (
      <CalendarExtract events={[event]} races={races} today="2027-05-07" />
    ),
  },
]

function drawn(races: Race[], draw: (races: Race[]) => React.ReactNode) {
  const { container, unmount } = renderWithI18n(<MemoryRouter>{draw(races)}</MemoryRouter>)
  const dots = [...container.querySelectorAll('.length-dot')]

  return {
    dots: dots.map((dot) => dot.className.replace('length-dot length-dot--', '')),
    allHidden: dots.every((dot) => dot.getAttribute('aria-hidden') === 'true'),
    unmount,
  }
}

describe('the dots a screen draws beside an event', () => {
  it('give a race that fixes no length a dot of its own, for either kind', () => {
    /* Both kinds that fix no length, since „a race that fixes none" is two
       things and a screen could be written to catch one of them. */
    for (const { where, draw } of SCREENS) {
      for (const kind of ['time', 'free'] as const) {
        const { dots, unmount } = drawn([race('a', kind, 'marathon')], draw)

        expect(dots, `${kind} on ${where}`).toEqual(['unmeasured'])
        unmount()
      }
    }
  })

  it('still give a race of a length the dot its length says, and no other', () => {
    for (const { where, draw } of SCREENS) {
      const { dots, unmount } = drawn(
        [race('a', 'length', 'marathon'), race('b', 'length', 'short')],
        draw,
      )

      expect(dots, where).toEqual(['short', 'marathon'])
      unmount()
    }
  })

  it('say in words which dots those are, for whoever cannot separate two colours', () => {
    /* WCAG 2.2 SC 1.4.1, and the condition the owner's choice was offered under:
       one new colour **and its name**. The dots themselves are hidden from a
       reader who listens, so the words beside them are the whole of what such a
       reader gets. */
    for (const { where, draw } of SCREENS) {
      const { allHidden, unmount } = drawn(
        [race('a', 'free', 'marathon'), race('b', 'length', 'short')],
        draw,
      )

      expect(screen.getByText('Kraća trka, Bez zadate dužine'), where).toBeInTheDocument()
      expect(allHidden, `every dot on ${where} is hidden from a reader who listens`).toBe(true)
      unmount()
    }
  })
})
