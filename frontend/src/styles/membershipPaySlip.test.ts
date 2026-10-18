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

    /* The code's track is `auto`, the width of the code, so the code ends at the right edge of the
       panel and the empty space is between it and the details (PDL P8, 18.10.2026: „QR kod stoji
       uz DESNU IVICU strane, ne odmah pored podataka"). Two equal tracks put it at the left of the
       right half, which is „odmah pored podataka". */
    expect(rule.getPropertyValue('grid-template-columns')).toBe('minmax(0, 1fr) auto')
  })
})

/**
 * The dashed line over the slip is the slip's, and spans both halves (owner, 18.10.2026: „Horizontalna
 * linija na vrhu treba da ide celom sirinom strane, a QR kod treba da bude alignovan desno u odnosu na
 * tekstualne podatke za uplatu"; PDL P8, „Blok „Uplatnica sa QR kodom”").
 *
 * It was `.pay`'s own line on the code's half, so inside the two columns it covered the right one
 * only. Nothing rendered can see it (ADL A33), so the sheet is read as text, as above: the line is on
 * the wrapper that holds both halves, and the code's half draws none of its own.
 */
describe('the code at the right edge of the panel', () => {
  /* PDL P8, 18.10.2026, chosen between offered outcomes against the recommendation: „QR kod stoji uz
     DESNU IVICU strane, ne odmah pored podataka; između podataka i koda ostaje prazan prostor. Na
     telefonu kod ostaje ispod podataka." Measured on the built page at 1280: the code ends at x 1167,
     which is where the panel and the dashed line end, and the details end at 962. The track is as wide
     as the title over the code, which is wider than the code, so the code must go to the END of the
     track or it stops short by the difference. */
  it('goes to the end of its track from the same width the two columns start at', () => {
    const half = ruleInMedia(MEMBER_CSS, '(min-width: 51.25em)', '.pay__qr', 'Member.css')
    const code = ruleInMedia(MEMBER_CSS, '(min-width: 51.25em)', '.pay__qr .pay__code', 'Member.css')
    const title = ruleInMedia(MEMBER_CSS, '(min-width: 51.25em)', '.pay__qr h4', 'Member.css')

    expect(half.getPropertyValue('align-items')).toBe('flex-end')
    expect(code.getPropertyValue('align-items')).toBe('flex-end')
    expect(title.getPropertyValue('text-align')).toBe('end')
  })

  it('stays under the details on a telephone, where the slip is one column and nothing is moved', () => {
    expect(ruleFor(MEMBER_CSS, '.pay__slip', 'Member.css').getPropertyValue('grid-template-columns')).toBe(
      'minmax(0, 1fr)',
    )
    expect(ruleFor(MEMBER_CSS, '.pay__qr', 'Member.css').getPropertyValue('align-items')).toBe('')
    expect(ruleFor(MEMBER_CSS, '.pay__code', 'Member.css').getPropertyValue('align-items')).toBe('flex-start')
  })
})

describe('the line over the payment slip', () => {
  it('is on the wrapper of both halves, dashed, as the PayPal block draws its own', () => {
    const slip = ruleFor(MEMBER_CSS, '.pay__slip', 'Member.css')
    const paypal = ruleFor(MEMBER_CSS, '.pay', 'Member.css')

    expect(slip.getPropertyValue('border-top')).toBe(paypal.getPropertyValue('border-top'))
    expect(slip.getPropertyValue('border-top')).toContain('dashed')
    expect(slip.getPropertyValue('padding-top')).toBe(paypal.getPropertyValue('padding-top'))
  })

  it("is not drawn a second time by the code's half, which would put it over one column again", () => {
    const code = ruleFor(MEMBER_CSS, '.pay__qr', 'Member.css')

    expect(code.getPropertyValue('border-top')).toBe('')
    expect(code.getPropertyValue('border')).toBe('')
    expect(code.getPropertyValue('display')).toBe('flex')
    expect(code.getPropertyValue('flex-direction')).toBe('column')
    /* The same gap as the written half, so the code starts at the height of the first detail. */
    expect(code.getPropertyValue('gap')).toBe(
      ruleFor(MEMBER_CSS, '.pay__slipText', 'Member.css').getPropertyValue('gap'),
    )
  })
})
