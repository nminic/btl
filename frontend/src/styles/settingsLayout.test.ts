import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ruleFor, ruleInMedia } from '../test/stylesheet'

/**
 * THE SETTINGS PAGE IN TWO COLUMNS, AND WITHOUT THE GAPS (PDL P11, owner, 18.10.2026, „Strana
 * Podešavanja, sa snimaka").
 *
 * <p>jsdom applies no stylesheet at all (ADL A33), so nothing rendered can see whether two panels
 * stand beside each other or whether a field is 224 pixels tall; the sheet is read as text instead, the
 * way `styles/membershipPaySlip.test.ts` does for the pair next door in the same file. What the sheet
 * SAYS is held here, and where the panels then LAND is asked of Chrome in `geometry/settings.geometry.ts`.
 *
 * <p>Three things, each of which was a thing the owner pointed at and each of which has the mutation
 * that puts it back: the pair is one column on a telephone and two from 51.25em; a panel with no
 * neighbour takes the whole row; and the field that takes what is left of a ROW is not told to do it in
 * a COLUMN.
 */
const MEMBER_CSS = readFileSync(join(process.cwd(), 'src/pages/member/Member.css'), 'utf-8')
const RANKINGS_CSS = readFileSync(join(process.cwd(), 'src/pages/Rankings.css'), 'utf-8')

describe('two panels of the settings, side by side', () => {
  it('stand in one column by default, narrow enough for a long word to wrap', () => {
    const rule = ruleFor(MEMBER_CSS, '.member__pair', 'Member.css')

    expect(rule.getPropertyValue('display')).toBe('grid')
    expect(rule.getPropertyValue('grid-template-columns')).toBe('minmax(0, 1fr)')
    /* The two panels are not the same height, and one stretched to its neighbour's would carry its
       border-top at the top of a box that is not its content's. */
    expect(rule.getPropertyValue('align-items')).toBe('start')
  })

  it('stand in two equal columns from the width the portal already uses for two columns', () => {
    /* `51.25em` is not a number chosen for this pair: it is the width at which the navigation unfolds
       (`app/Shell.css`) and the form takes its columns (`forms/FormRenderer.css`), so the portal
       keeps one answer to „how wide is wide enough for two columns". */
    const rule = ruleInMedia(MEMBER_CSS, '(min-width: 51.25em)', '.member__pair', 'Member.css')

    expect(rule.getPropertyValue('grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))')
  })

  /* THE THREE ROWS OF THE SETTINGS ARE THE EXCEPTION, since 23.10.2026: the owner asked for the words
     about oneself „u njenoj visini", the height of the picture beside them (PDL, „Strana Podešavanja u
     tri visoka reda sa dve kolone"), so in a row the two boxes stretch to each other. A pair that is not
     a row keeps `start`, above. */
  it('stretch the two boxes of a row of the settings to each other', () => {
    expect(ruleFor(MEMBER_CSS, '.member__row', 'Member.css').getPropertyValue('align-items')).toBe('stretch')
  })

  it('leaves a panel with no neighbour the whole row', () => {
    const rule = ruleInMedia(
      MEMBER_CSS,
      '(min-width: 51.25em)',
      '.member__pair > :only-child',
      'Member.css',
    )

    expect(rule.getPropertyValue('grid-column')).toBe('1 / -1')
  })
})

describe('the field that takes what is left of a row, inside a panel that is a column', () => {
  /* THE CAUSE, ASKED AT ITS SOURCE. `.rankings__field--wide` says `flex: 1 1 14rem` for the screens
     where its parent is a row, and the owner's „veliki prazan prostor" was that rule meeting a panel
     that is a column, where the 14rem is a height. It is answered where the parent is, and the rule
     itself is not touched: the screens that put it in a row are exactly as they were. */
  it('is not told to be 14rem tall by the panel, and the rule for a row is as it was', () => {
    for (const column of ['.member__panel', '.member__form']) {
      expect(
        ruleFor(MEMBER_CSS, `${column} .rankings__field--wide`, 'Member.css').getPropertyValue('flex'),
        column,
      ).toBe('0 0 auto')
    }

    expect(ruleFor(RANKINGS_CSS, '.rankings__field--wide', 'Rankings.css').getPropertyValue('flex')).toBe(
      '1 1 14rem',
    )
  })

  it('is overridden for a panel and for a form, which are the two columns this field stands in', () => {
    const selectors = [...MEMBER_CSS.matchAll(/([^{}]*\.rankings__field--wide[^{}]*)\{/g)].map((one) => one[1] ?? '')

    expect(selectors.join(' ')).toContain('.member__panel')
    expect(selectors.join(' ')).toContain('.member__form')
  })
})
