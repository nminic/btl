import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { sources } from '../test/sources'
import { bodyOf } from '../test/stylesheet'

/**
 * The one rule that says how loudly a link out of this portal announces where it
 * leads.
 *
 * It lived in `pages/member/Member.css` as `.review__host` while the moderator's
 * queue was the only screen that drew such a link. On 27.08.2026 the event's page
 * drew a second one, and the choice was between writing the rule twice and moving
 * it once. It was moved, and this file is what a move costs: a rule two screens
 * import from a third place is a rule either of them can be left without, and
 * neither jsdom nor the suite would notice, because what would be lost is a size
 * and jsdom measures none (ADL A18).
 *
 * So two things are asked here, both about source and neither about layout: that
 * the rule exists and still says what it is for, and that nothing is left on the
 * name it used to have.
 */
const SHEET = readFileSync(join(process.cwd(), 'src/styles/outsideLink.css'), 'utf-8')
const WAS = readFileSync(join(process.cwd(), 'src/pages/member/Member.css'), 'utf-8')

/** Where a file sits, written the way this repository writes a path. */
const named = (path: string) => relative(process.cwd(), path).split('\\').join('/')

describe('the host beside a link that leaves the portal', () => {
  it('is quieter than the words, and breaks rather than widening its row', () => {
    /* The three declarations the stylesheet argues for. A host is one long word,
       and on a telephone a word that will not break is a page that scrolls
       sideways, which is the one thing the portal never does. */
    const rule = bodyOf(SHEET, '.outside-host')

    expect(rule, 'the shared rule is gone').not.toBe('')
    expect(rule).toContain('overflow-wrap: anywhere')
    expect(rule).toContain('var(--text-muted)')
    /* On a line of its own, so the words stay what is read first. */
    expect(rule).toContain('display: block')
  })

  it('is asked for by both screens that draw such a link, and by that name', () => {
    /* Counted rather than trusted. The rule was renamed while it moved, and a
       screen left on the old name draws its host in the size of whatever stands
       around it: still in the page, still read aloud, and no longer quiet or
       breakable. */
    const drawing = sources().filter((one) => one.code.includes('outside-host'))

    expect(drawing.map((one) => named(one.path)).sort()).toEqual([
      'src/pages/EventDetail.tsx',
      'src/pages/admin/ReviewQueue.tsx',
    ])
  })

  it('leaves nothing behind on the name it had before the move', () => {
    /* Both halves, because each is dead in its own way: a stylesheet rule nobody
       names draws nothing, and markup naming a rule nobody wrote is unstyled.
       Both read as working code.

       The stylesheet it was moved out of is read by name rather than swept for,
       because that is the one file it was ever in and a sweep that finds no files
       answers „nothing is wrong" in the same words as a sweep that finds none
       broken. */
    expect(WAS).not.toContain('review__host')
    expect(sources().filter((one) => one.code.includes('review__host'))).toEqual([])
  })
})
