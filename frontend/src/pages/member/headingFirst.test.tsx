import { cleanup, screen, within } from '@testing-library/react'
import { first } from '../../test/at'
import { beginsWith, metSaid } from '../../test/met'
import { renderAt } from '../../test/render'

/* Read as a member with no team of their own, on a day inside the transfer window.
 * Both are conditions of one of these three screens: a team is founded from 1 October
 * to 31 December and only by a member who has none (PDL, increment 133), and outside
 * either the address is not a page at all but a redirect to the front. The other two
 * screens do not care about the day; one fixed day for all three keeps this file
 * from asking a different question of each. */
const DAY = '2026-10-15'

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

describe('the screens a member writes on', () => {
  it('begin with their own heading, before anything the reader can meet', async () => {
    for (const [route, name] of SCREENS) {
      cleanup()
      renderAt(route, 'competitor', '000002', undefined, DAY)

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
      renderAt(route, 'competitor', '000002', undefined, DAY)

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
