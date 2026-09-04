import { cleanup, screen, within } from '@testing-library/react'
import { first } from '../../test/at'
import { renderAt } from '../../test/render'

/**
 * A page begins with its own heading, and the screens a member writes on did not.
 *
 * Both drew what explains the form **above** the form, and the heading belongs to
 * the form, so the heading arrived after it: on the proposal of a team, after a
 * note and a field for choosing a file; on the reporting of a result, after a
 * note. A reader working by ear who lists the headings of a page found the first
 * one only after meeting a control, so the page had no heading at its start at all
 * (WCAG 2.2, 1.3.1 and 2.4.6). Measured 31.08.2026, decided by the owner
 * 01.09.2026: the heading goes first.
 *
 * Held here for both screens rather than for the one it was found on, because the
 * shape is the same on both and closing one of two leaves the other open.
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
 * Everything on the page a reader meets, in the order they meet it.
 *
 * Headings and controls and prose together, because what went wrong was their
 * order relative to each other: asking only for headings would pass a page whose
 * heading is first among headings and third among things.
 */
function metInOrder(): Element[] {
  const main = screen.getByRole('main')

  /* Links among them, and images, and list items. The first draft asked only for
     headings, prose and form controls, so a link drawn over the heading passed:
     „Nazad na timove" put above the form left the page beginning with a link and
     the guard said nothing, which is the very fault this file exists for
     (review, 04.09.2026). */
  return [
    ...main.querySelectorAll('h1, h2, h3, h4, p, a, img, li, table, input, textarea, select, button'),
  ]
}

describe('the screens a member writes on', () => {
  it('begin with their own heading, before anything the reader can meet', async () => {
    for (const [route, name] of SCREENS) {
      cleanup()
      renderAt(route, 'competitor', '000007')

      const heading = await screen.findByRole('heading', { level: 1, name })
      const met = metInOrder()

      expect(met.length, `${route} draws something`).toBeGreaterThan(1)
      expect(first(met), `${route} begins with its heading`).toBe(heading)
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
