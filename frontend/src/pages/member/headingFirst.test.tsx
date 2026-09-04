import { cleanup, screen, within } from '@testing-library/react'
import { first } from '../../test/at'
import { beginsWith, metSaid } from '../../test/met'
import { sep } from 'node:path'
import { renderAt } from '../../test/render'
import { sources } from '../../test/sources'

/**
 * A page begins with its own heading, and the screens a member writes on did not.
 *
 * They drew what explains the form **above** the form, and the heading belongs to the
 * form, so the heading arrived after it: after a note and a field for choosing a file,
 * or after a note alone. A reader working by ear who lists the headings of a page
 * found the first one only after meeting a control, so the page had no heading at its
 * start at all (WCAG 2.2, 1.3.1 and 2.4.6). Measured 31.08.2026, decided by the owner
 * 01.09.2026: the heading goes first.
 *
 * **How many screens is not written down here.** The first version of this line said
 * „both", and a third screen of the same shape was found the next round while the
 * word „both" stood over a list of three (review, 04.09.2026). The list below is the
 * count; the rule is that every screen a member writes on is in it.
 *
 * **And it is not the only place this is held.** Every address outside administration
 * is swept for the same thing in `pages/publicData.test.tsx`, which already opens all
 * of them twice and so costs nothing more. This file stays for what that sweep cannot
 * say: that what explains a form stands between the heading and the first field.
 */
const SCREENS = [
  ['/sr/novi-tim', 'Predlog tima', /Tim postoji tek kad ga odobri/],
  ['/sr/rezultat/novi', 'Unos rezultata', /Rezultat ulazi u rang liste tek kad/],
  /* The third screen of the same shape, and the one this file first claimed did not
     exist. Found in review 04.09.2026, after the other two were closed: the note
     naming the race stood over the heading „Prijava rezultata" exactly as the other
     two had. Counting the screens by reading them, rather than by remembering which
     ones were reported, is what this row costs. */
  [
    '/sr/kalendar/maraton-maratona-2015/prijava?trka=evt-maraton-maratona-2015-03-14-4400',
    'Prijava rezultata',
    /Prijavljuješ rezultat sa trke/,
  ],
] as const

/**
 * The pages that carry a way back, held as they stand.
 *
 * The mark `page__back` says which link is the way out of a screen, and that is a
 * fact nothing else in the portal knows: a link to the list a record came from is
 * not an ancestor of its address (`/sr/tim/dunavski-trkaci` goes back to
 * `/sr/timovi`), so it cannot be recognised by reading the address. The mark is the
 * only home of that fact.
 *
 * A fact with one home and no reader is a fact that can be deleted quietly: with the
 * mark taken off, the guard over its placement asks about nothing and passes, which
 * is how the way back on a message could be put under the whole letter again with
 * the gate green (review, 04.09.2026). So the pages that carry it are held here, and
 * a mark that goes away has to be taken off this list as well.
 */
const CARRIES_A_WAY_BACK = [
  'src/pages/CalendarDay.tsx',
  'src/pages/LeagueDetail.tsx',
  'src/pages/TeamDetail.tsx',
  'src/pages/member/MessageDetail.tsx',
]

describe('the way out of a screen', () => {
  it('is marked on every page that has one, and nowhere else', () => {
    const marked = sources()
      .filter((one) => one.code.includes('page__back'))
      .map((one) => one.path.slice(process.cwd().length + 1).split(sep).join('/'))
      .sort()

    expect(marked).toEqual([...CARRIES_A_WAY_BACK].sort())
  })
})

describe('the screens a member writes on', () => {
  it('begin with their own heading, before anything the reader can meet', async () => {
    for (const [route, name] of SCREENS) {
      cleanup()
      renderAt(route, 'competitor', '000007')

      const heading = await screen.findByRole('heading', { level: 1, name })
      expect(beginsWith(heading), `${route} begins with its heading, met ${metSaid(heading)}`).toBe(
        true,
      )
    }
  })

  it('say what they explain between that heading and the first field', async () => {
    /* Under the heading **and over the fields**, which is two edges and not one.

       Measured against the first draft of this file, which asked only for the first
       edge: the note taken off the screen entirely passed, because a page that says
       nothing begins with its heading too (04.09.2026); and the note moved into
       `beneath` passed as well, though it then stood at the very bottom, over the
       button and under every field, so a member read what happens to their result
       only after filling the whole form in (review, 04.09.2026). */
    for (const [route, name, note] of SCREENS) {
      cleanup()
      renderAt(route, 'competitor', '000007')

      const main = screen.getByRole('main')
      const said = await within(main).findByText(note)
      const heading = screen.getByRole('heading', { level: 1, name })
      const field = first([...main.querySelectorAll('input, textarea, select')])

      expect(
        heading.compareDocumentPosition(said) & Node.DOCUMENT_POSITION_FOLLOWING,
        `${route} says what it explains under its heading`,
      ).toBeGreaterThan(0)
      expect(
        said.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING,
        `${route} says it before the first field, not after the last`,
      ).toBeGreaterThan(0)
    }
  })
})
