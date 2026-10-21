import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONTACT_ADDRESS } from '../app/routes'
import {
  ipsPayload,
  methodFor,
  methodsFor,
  paymentPurpose,
  paymentReference,
  paymentReferenceOrNone,
  paysInDinars,
  PAYPAL_ADDRESS,
  paypalPaymentLink,
  RECIPIENT_ACCOUNT,
  RECIPIENT_NAME,
} from './paymentQr'

/**
 * The two additions PR 385's second round made to this file, each covered directly
 * because neither is reached through a rendered screen: `PAYPAL_ADDRESS` is a
 * constant with nothing to branch on, and `paypalPaymentLink` (Layer 2, owner
 * 27.09.2026) is prepared and not called from `Membership.tsx` yet, so no walk of
 * that screen could ever exercise it.
 */
describe('PAYPAL_ADDRESS', () => {
  it('is the one mailbox the site already reads, not a second copy of the string', () => {
    /* The owner wrote „lige" and confirmed „liga" when asked directly, on the exact
       string CONTACT_ADDRESS already carries checked. Read from that constant rather
       than written out again here, so a second „lige" typed by hand could not pass
       this file while still sending a member's money to an address nobody reads. */
    expect(PAYPAL_ADDRESS).toBe(CONTACT_ADDRESS)
    expect(PAYPAL_ADDRESS).toBe('info@balkanskatrkackaliga.net')
  })
})

describe('the PayPal link Layer 2 would press, prepared and not drawn', () => {
  it('carries the address, the fee-inclusive amount and the note a payer would see', () => {
    const link = paypalPaymentLink({
      address: 'info@balkanskatrkackaliga.net',
      amountEur: 43,
      note: '2027000001',
    })

    const built = new URL(link)

    expect(built.origin + built.pathname).toBe('https://www.paypal.com/cgi-bin/webscr')
    expect(built.searchParams.get('cmd')).toBe('_xclick')
    expect(built.searchParams.get('business')).toBe('info@balkanskatrkackaliga.net')
    expect(built.searchParams.get('item_name')).toBe('2027000001')
    expect(built.searchParams.get('amount')).toBe('43.00')
    expect(built.searchParams.get('currency_code')).toBe('EUR')
  })

  it('always writes two decimals, for a fee that lands on a whole euro', () => {
    /* 38 and not 38.0 or 38: the owner's own example ("prva cena recimo 38 eur 1.
       oktobra") is a whole number once the fee is added to the early price (35 + 3),
       and a PayPal amount field reads "38" as thirty-eight units of whatever currency
       code came with it - which is euro either way here - so the digits are what a
       human reads twice before sending real money. */
    const link = paypalPaymentLink({ address: 'x@example.test', amountEur: 38, note: '2027000001' })

    expect(new URL(link).searchParams.get('amount')).toBe('38.00')
  })
})

/**
 * THE WAY TO PAY, ASKED BY THE MONEY, AND WHY IT IS NOT A SECOND RULE.
 *
 * <p><b>Every case here is written against {@link methodsFor} rather than against the two words,
 * which is the whole point of the file it lives in.</b> The portal already answers „how does this
 * man pay" from his country; {@link methodFor} answers it from his money because one screen is
 * served the money and not the country (`data/types.ts#MembershipDue`). Held against the two
 * literals alone, the two functions could drift apart and both would pass. Held against each
 * other, a change to either one alone fails.
 */
describe('the way to pay, asked by the money instead of by the country', () => {
  /** Where the server's own words live, the same place `pages/account/refusals.test.ts` reads. */
  const CURRENCY = join(
    process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'domain',
    'pricing', 'Currency.java',
  )

  /**
   * EVERY MONEY THE SERVER HAS, READ OUT OF THE ENUM RATHER THAN REMEMBERED.
   *
   * <p><b>This is the floor under the two branches below and it is the reason this file reads
   * Java at all.</b> A hand-written pair would be exactly as wrong as the sentences this whole
   * branch exists to correct: `admin/activation.ts` carried two paragraphs about
   * `POST /api/payments` that were true when written and were left standing after the route
   * changed, because nothing on this side of the repo reads that side. So the day `Currency`
   * gains a third member, this goes red and somebody decides how it is paid - rather than
   * `methodFor` quietly answering nothing for money the portal really bills in.
   */
  function everyCurrency(): string[] {
    const java = readFileSync(CURRENCY, 'utf-8')
    const body = java.slice(java.indexOf('public enum Currency {'))

    return [...body.matchAll(/^\t([A-Z]{3})[,;]$/gm)].map((one) => one[1] ?? '')
  }

  it('knows one way to pay for every money the server bills in, and no more', () => {
    const every = everyCurrency()

    /* That the reading read something: an expression that stopped matching would make every
       expectation below a walk over nothing. */
    expect(every, 'Currency names no money at all, so this file measures nothing').toEqual([
      'EUR',
      'RSD',
    ])

    expect(every.filter((money) => methodFor(money) === null)).toEqual([])
  })

  /**
   * <p><b>The two countries are chosen and then CHECKED to be on opposite sides</b>, so a pair
   * that happened to behave the same way could not make the two expectations below agree by
   * accident.
   */
  it('answers exactly what the country would have answered, both ways round', () => {
    expect(paysInDinars('RS')).toBe(true)
    expect(paysInDinars('SI')).toBe(false)

    expect(methodFor('RSD')).toBe(methodsFor('RS')[0])
    expect(methodFor('EUR')).toBe(methodsFor('SI')[0])

    /* And the two are really different, so neither line above could be satisfied by one answer
       standing for both. */
    expect(methodFor('RSD')).not.toBe(methodFor('EUR'))
  })

  /**
   * <p><b>NOT „ANYTHING THAT IS NOT DINARS IS PAYPAL", AND THIS IS THE CASE THAT DIVIDES THE
   * TWO.</b> `currency` is served as a plain string on purpose, so a third money is something
   * that arrives at runtime. Written as a single comparison, `methodFor` would answer `paypal`
   * for it and the row would book somebody's money into the euro account on the strength of not
   * recognising it. The mutation this exists for is exactly that one line.
   */
  it('answers nothing at all for money it does not know', () => {
    expect(methodFor('CHF')).toBeNull()
    expect(methodFor('')).toBeNull()
    /* And not by prefix or by case either, which is what a comparison written loosely would let
       through. */
    expect(methodFor('RSDX')).toBeNull()
    expect(methodFor('eur')).toBeNull()
  })
})

/**
 * THE FORM OF THE REFERENCE, `YYYYNNNNNN` (owner, 20.10.2026, PDL P8, „Poziv na broj je
 * YYYYNNNNNN": „neka sifra uplate bude formata YYYYNNNNNN gde ne YYYY godina, a NNNNNN clanski
 * broj"). It overturns the 31.07.2026 form `[season][number without noughts]` (`202737`).
 *
 * Every row is a LITERAL, written out here and not computed by `paymentReference`, so a change to
 * the function cannot move its own expectation. The two sources of the value are swapped in the
 * rows: the season (the next one and the running one differ for a payment in the renewal window)
 * and the member (another number, and a number whose leading figures are not noughts).
 */
describe('the reference is the season and the six digit member number, ten digits always', () => {
  it.each([
    [2027, '000027', '2027000027'],
    [2027, '123456', '2027123456'],
    [2027, '000001', '2027000001'],
    [2027, '001234', '2027001234'],
    [2028, '000027', '2028000027'],
    [2027, '000028', '2027000028'],
  ])('is %i and %s run together: %s', (season, number, expected) => {
    expect(paymentReference(season, number)).toBe(expected)
  })

  it('is ten digits and nothing else, for a member with noughts and for one without', () => {
    for (const number of ['000001', '000027', '001234', '099999', '123456']) {
      expect(paymentReference(2027, number), number).toMatch(/^[0-9]{10}$/)
    }
  })

  it('is not changed by the member number being read as a figure and written back', () => {
    /* The 31.07.2026 form was `${season}${Number(number)}`; this pair is the one the two forms
       disagree on, so the function cannot return the old one and pass. */
    expect(paymentReference(2027, '000027')).not.toBe('202727')
    expect(paymentReference(2027, '000027').slice(4)).toBe('000027')
  })

  it('is the very string the code carries as RO, which the screens also write out', () => {
    const paying = {
      account: RECIPIENT_ACCOUNT,
      recipient: RECIPIENT_NAME,
      amountRsd: 4800,
      purpose: paymentPurpose(2027),
    }

    expect(ipsPayload({ ...paying, reference: paymentReference(2027, '000027') })).toMatch(
      /\|RO:2027000027$/,
    )
    expect(ipsPayload({ ...paying, reference: paymentReference(2027, '123456') })).toMatch(
      /\|RO:2027123456$/,
    )
  })
})

/**
 * THE REFERENCE OF SOMEBODY WHO MAY HAVE NO NUMBER YET.
 *
 * <p>PDL P8, the entry „Prvu članarinu nov član plaća bez poziva na broj" (10.10.2026, chosen by the
 * owner between offered outcomes; the sentence is the record's): a member has no number when he
 * registers (30.07.2026), so the slip and the code „nose sve podatke osim poziva na broj". That is
 * not a reference with a gap in it. The season alone would still be a reference a bank statement
 * carries, and a moderator looking for a payment would read it as somebody's; so the answer for
 * somebody with no number is the empty string `IpsPayment.reference` already means „none" by, and
 * the code leaves its `RO` tag out for it.
 */
describe('the reference of somebody who may have no number yet', () => {
  it('is the very reference a member with a number is given, for every member', () => {
    for (const number of ['000001', '000037', '001234', '000032']) {
      expect(paymentReferenceOrNone(2027, number), number).toBe(paymentReference(2027, number))
    }

    expect(paymentReferenceOrNone(2027, '000037')).toBe('2027000037')
  })

  it('is nothing at all for somebody with no number, and not the season on its own', () => {
    expect(paymentReferenceOrNone(2027, null)).toBe('')
    expect(paymentReferenceOrNone(2027, null)).not.toContain('2027')
  })

  it('leaves the reference tag out of the code when there is none, and nothing else', () => {
    const paying = {
      account: RECIPIENT_ACCOUNT,
      recipient: RECIPIENT_NAME,
      amountRsd: 4800,
      purpose: paymentPurpose(2027),
    }

    expect(ipsPayload({ ...paying, reference: paymentReferenceOrNone(2027, null) })).toBe(
      'K:PR|V:01|C:1|R:105000000000328471|N:Sportsko udruženje BTL|I:RSD4800,00|SF:289' +
        '|S:Članarina za 2027. godinu',
    )
    /* And the same code for somebody who has one is this one with the tag added, which is what
       makes the pair a measurement of the reference alone. */
    expect(ipsPayload({ ...paying, reference: paymentReferenceOrNone(2027, '000037') })).toBe(
      'K:PR|V:01|C:1|R:105000000000328471|N:Sportsko udruženje BTL|I:RSD4800,00|SF:289' +
        '|S:Članarina za 2027. godinu|RO:2027000037',
    )
  })
})
