import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { everyRule, ruleFor, ruleInMedia, unconditionalRules } from '../test/stylesheet'

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
const QR_CSS = readFileSync(join(process.cwd(), 'src/components/QrCode.css'), 'utf-8')

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
     telefonu kod ostaje ispod podataka." The code's track is as wide as the code since its title
     went (same day, „obriši naslov Uplatnica sa QR kodom"), and the code still goes to the END of
     its box, so nothing about the track's width can leave it short of the edge. Measured on the built
     page by `geometry/paySlip.geometry.ts`. */
  it('goes to the end of its track from the same width the two columns start at', () => {
    const code = ruleInMedia(MEMBER_CSS, '(min-width: 51.25em)', '.pay__qr .pay__code', 'Member.css')

    expect(code.getPropertyValue('align-items')).toBe('flex-end')
  })

  it('stays under the details on a telephone, where the slip is one column and nothing is moved', () => {
    expect(ruleFor(MEMBER_CSS, '.pay__slip', 'Member.css').getPropertyValue('grid-template-columns')).toBe(
      'minmax(0, 1fr)',
    )
    expect(ruleFor(MEMBER_CSS, '.pay__code', 'Member.css').getPropertyValue('align-items')).toBe('flex-start')
    /* And at its own size there: the rule that ties the code to the details is written inside the
       query and nowhere outside it. */
    expect(unconditionalRules(MEMBER_CSS, 'Member.css').filter((rule) => rule.selectorText === '.pay__qr .qr')).toEqual(
      [],
    )
  })
})

/**
 * NO TALLER THAN THE DETAILS, AND SQUARE (PDL P8, owner, 18.10.2026: „A QR kod ne treba da pređe
 * vertikalnu visinu stupca teksta sa leve strane u Uplatnici", and „Kod ostaje kvadrat i poravnat po
 * vrhu sa podacima"). The height of the details reaches the sheet as `--slip-details`
 * (`pages/member/PaySlip.tsx`); the width follows it, and the height follows the width
 * (`components/QrCode.css`, `height: auto`). What a browser makes of it is measured by
 * `geometry/paySlip.geometry.ts` at 820 and 1280: 159px with a reference, 130px without.
 */
describe('the size of the code beside the details', () => {
  it('is the height of the details, never over 180 and never under 120, beside them only', () => {
    const code = ruleInMedia(MEMBER_CSS, '(min-width: 51.25em)', '.pay__qr .qr', 'Member.css')

    expect(code.getPropertyValue('width')).toBe('min(180px, max(120px, var(--slip-details, 180px)))')
    expect(code.getPropertyValue('height')).toBe('')
    expect(ruleFor(QR_CSS, '.qr', 'QrCode.css').getPropertyValue('height')).toBe('auto')
  })

  it('is begun where the details are, under the one heading of the slip', () => {
    /* „ne diži gore na mesto naslova": the heading takes the whole first row, so the details and the
       code share the second and begin at one height. 2 and the slip's 16 are the 8 of
       `.profile__section` and the 10 the written half put between its heading and the details. */
    const heading = ruleFor(MEMBER_CSS, '.pay__heading', 'Member.css')

    expect(heading.getPropertyValue('grid-column')).toBe('1 / -1')
    expect(heading.getPropertyValue('margin-bottom')).toBe('var(--space-2)')
    expect(ruleFor(MEMBER_CSS, '.pay__slip', 'Member.css').getPropertyValue('gap')).toBe('var(--space-16)')
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
    const drawsALine = everyRule(MEMBER_CSS, 'Member.css').filter(
      (rule) =>
        rule.selectorText.includes('.pay__qr') &&
        (rule.style.getPropertyValue('border-top') !== '' || rule.style.getPropertyValue('border') !== ''),
    )

    expect(drawsALine.map((rule) => rule.selectorText)).toEqual([])
  })
})
