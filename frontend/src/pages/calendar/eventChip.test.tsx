import { MemoryRouter } from 'react-router'
import { screen } from '@testing-library/react'
import { renderWithI18n } from '../../test/render'
import type { BtlEvent, Race, RaceCategory, RaceKind } from '../../data/types'
import { EventChip } from './DayChips'

/* The tile a day carries, and the dots on it.
 *
 * `derive.test.ts` asks `dotsAt` what a day holds and gets the right answer; this
 * asks the tile whether it draws it. The two are not the same question, and the
 * difference was measured on 30.08.2026: with the tile filtering the new dot back
 * out of what `dotsAt` hands it, every one of the 2400 tests still passed. The
 * plan for this change named that very mutation and it was run against the
 * function, where it falls, and not against the screen, where it did not.
 *
 * Rendered on its own rather than through the calendar, because the tile takes
 * its event and its races as arguments while the screen takes what the store
 * holds, and the store holds no race that fixes a time or nothing at all: all
 * 1612 of them are run to a length. The router is here because the tile is a
 * link (`Markdown.test.tsx` renders the same way).
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
     this dot exists to end. A record with nothing on it would pass a tile that
     went on reading the category. */
  distanceKm: 42.2,
  ascentM: 0,
  descentM: 0,
  category,
})

function draw(races: Race[]) {
  return renderWithI18n(
    <MemoryRouter>
      <EventChip event={event} races={races} />
    </MemoryRouter>,
  )
}

/** Which dots the tile drew, by the modifier on each. */
function drawn(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.length-dot')].map(
    (dot) => dot.className.replace('length-dot length-dot--', ''),
  )
}

describe('the tile a calendar day carries', () => {
  it('gives a race that fixes no length the dot of its own, for either kind', () => {
    /* Both kinds that fix no length, since „a race that fixes none" is two
       things and a tile could be written to catch one of them. */
    for (const kind of ['time', 'free'] as const) {
      const { container, unmount } = draw([race('a', kind, 'marathon')])

      expect(drawn(container), kind).toEqual(['unmeasured'])
      unmount()
    }
  })

  it('still gives a race of a length the dot its length says, and no other', () => {
    const { container } = draw([race('a', 'length', 'marathon'), race('b', 'length', 'short')])

    expect(drawn(container)).toEqual(['short', 'marathon'])
  })

  it('says in words which dots those are, for whoever cannot separate two colours', () => {
    /* WCAG 2.2 SC 1.4.1, and the condition the owner's choice was offered under:
       one new colour **and its name**. The dots themselves are hidden from a
       reader who listens, so the words beside them are the whole of what such a
       reader gets. */
    const { container } = draw([race('a', 'free', 'marathon'), race('b', 'length', 'short')])

    expect(screen.getByText('Kraća trka, Bez zadate dužine')).toBeInTheDocument()
    expect(
      [...container.querySelectorAll('.length-dot')].every(
        (dot) => dot.getAttribute('aria-hidden') === 'true',
      ),
    ).toBe(true)
  })
})
