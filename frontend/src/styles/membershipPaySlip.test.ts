import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor, ruleInMedia } from '../test/stylesheet'

/**
 * The payment slip's two forms, side by side where there is room (owner,
 * 26.09.2026: „Uplatnica treba da ide sa desne strane u nivou detalja za
 * uplatu").
 *
 * jsdom applies no stylesheet at all (ADL A33), so nothing rendered can see
 * whether the written half and the QR code sit in one column or two; the sheet
 * is read as text instead, the way `styles/leagueLayout.test.ts` already does
 * for the identical reason.
 *
 * `minmax(0, 1fr)` and not a bare `1fr`, in both rules. A grid track sized
 * `1fr` alone cannot shrink narrower than its content's own minimum width, and
 * the written half carries a full postal address with nowhere to break
 * (`RECIPIENT_ADDRESS`, data/paymentQr.ts: „Bulevar Arsenija Čarnojevića 77,
 * 11070 Novi Beograd"). A bare `1fr` on that column would push the row wider
 * than the viewport on exactly the width this pair exists to fit into, which
 * is what PDL P24 (no horizontal scroll at any width) forbids.
 */
const MEMBER_CSS = readFileSync(join(process.cwd(), 'src/pages/member/Member.css'), 'utf-8')

describe('the payment slip written out beside its QR code', () => {
  it('stacks in one column by default, narrow enough for a postal address to wrap', () => {
    const rule = ruleFor(MEMBER_CSS, '.pay__slip', 'Member.css')

    expect(rule.getPropertyValue('grid-template-columns')).toBe('minmax(0, 1fr)')
  })

  it('stands beside its code from the width the portal already uses for two columns', () => {
    /* `51.25em` is not a new number chosen for this pair: it is the first
       two-column step `pages/Profile.css` already takes, reused on purpose
       rather than picked afresh, so the portal keeps one answer to „how wide
       is wide enough for two columns" instead of a second one living only
       here. */
    const rule = ruleInMedia(MEMBER_CSS, '(min-width: 51.25em)', '.pay__slip', 'Member.css')

    expect(rule.getPropertyValue('grid-template-columns')).toBe('minmax(0, 1fr) minmax(0, 1fr)')
  })
})
