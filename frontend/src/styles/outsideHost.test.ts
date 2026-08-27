import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { sources } from '../test/sources'
import { ruleFor, sheetsOf } from '../test/stylesheet'

/**
 * The one rule that says how loudly a link out of this portal announces where it
 * leads.
 *
 * It lived in `pages/member/Member.css` as `.review__host` while the moderator's
 * queue was the only screen that drew such a link. On 27.08.2026 the event's page
 * drew a second one, and the choice was between writing the rule twice and moving
 * it once. It was moved, and this file is what a move costs: a rule two screens
 * import from a third place is a rule either of them can be left without, and
 * without the last case below nothing would notice, because what would be lost is
 * a size and jsdom measures none (ADL A18).
 *
 * Nothing here is about layout. What is asked is that the rule exists and applies,
 * that both screens that write its name really reach the sheet that defines it,
 * and that nothing is left on the name it used to have.
 */
const SRC = join(process.cwd(), 'src')
const SHEET = join(SRC, 'styles/outsideLink.css')
const WAS = readFileSync(join(SRC, 'pages/member/Member.css'), 'utf-8')

/** Where a file sits, written the way this repository writes a path. */
const named = (path: string) => relative(process.cwd(), path).split('\\').join('/')

/** Every file that writes the class, by that exact name and not as a prefix of a
 *  longer one: a span moved to `outside-host--event` wears a name no sheet
 *  defines, and the portal has already been bitten by exactly that
 *  (`test/stylesheet.ts` records `.section-body__signoff-wide`). */
const drawing = () =>
  sources()
    .filter((one) => /\boutside-host\b(?!-)/.test(one.code))
    .map((one) => named(one.path))
    .sort()

describe('the host beside a link that leaves the portal', () => {
  it('is quieter than the words, and breaks rather than widening its row', () => {
    /* Read through the browser's own parser rather than off the text, because the
       question is whether the rule applies and not whether it is written down:
       wrapped in `@media print` it is still there to be found and no longer draws
       anything on a screen (ADL A18, and `unconditionalRules`). */
    const rule = ruleFor(readFileSync(SHEET, 'utf-8'), '.outside-host', 'outsideLink.css')

    /* A host is one long word, and on a telephone a word that will not break is a
       page that scrolls sideways, which is the one thing the portal never does. */
    expect(rule.getPropertyValue('overflow-wrap')).toBe('anywhere')
    expect(rule.getPropertyValue('color')).toBe('var(--text-muted)')
    /* On a line of its own, so the words stay what is read first. */
    expect(rule.getPropertyValue('display')).toBe('block')
  })

  it('reaches every screen that writes its name, through that screen’s own sheets', () => {
    /* The case the move exists to fail on, and the one the first version of this
       file was missing: with both `import '../styles/outsideLink.css'` lines
       deleted, the class leaves the built stylesheet entirely while the markup
       goes on writing it, and every other question here still answers yes.
       Measured by a review on 27.08.2026: 46 tests green, `npm run build` green,
       and `outside-host` nowhere in `dist/assets/*.css`.

       Asked of the closure and not of the file itself, because a screen may reach
       the sheet through another sheet it already asks for. The same reader holds
       the sheet of tables to the same rule (`tableScroll.test.ts`). */
    const written = drawing()

    expect(written, 'nobody draws a host any more').not.toEqual([])

    for (const path of written) {
      const at = join(process.cwd(), path)

      expect(
        [...sheetsOf(at, readFileSync(at, 'utf-8'))],
        `${path} writes outside-host and no sheet of its own asks for styles/outsideLink.css`,
      ).toContain(SHEET)
    }
  })

  it('is written by both screens that draw such a link, and by no other name', () => {
    expect(drawing()).toEqual(['src/pages/EventDetail.tsx', 'src/pages/admin/ReviewQueue.tsx'])
  })

  it('leaves nothing behind on the name it had before the move', () => {
    /* Both halves, because each is dead in its own way: a stylesheet rule nobody
       names draws nothing, and markup naming a rule nobody wrote is unstyled.
       Both read as working code.

       The stylesheet it was moved out of is read by name rather than swept for,
       because that is the one file it was ever in and a sweep that finds no files
       answers „nothing is wrong" in the same words as one that finds none
       broken. */
    expect(WAS).not.toContain('review__host')
    expect(sources().filter((one) => one.code.includes('review__host'))).toEqual([])
  })
})
