import { CONTACT_ADDRESS } from '../app/routes'
import { PAYPAL_ADDRESS, paypalPaymentLink } from './paymentQr'

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
      note: '20271',
    })

    const built = new URL(link)

    expect(built.origin + built.pathname).toBe('https://www.paypal.com/cgi-bin/webscr')
    expect(built.searchParams.get('cmd')).toBe('_xclick')
    expect(built.searchParams.get('business')).toBe('info@balkanskatrkackaliga.net')
    expect(built.searchParams.get('item_name')).toBe('20271')
    expect(built.searchParams.get('amount')).toBe('43.00')
    expect(built.searchParams.get('currency_code')).toBe('EUR')
  })

  it('always writes two decimals, for a fee that lands on a whole euro', () => {
    /* 38 and not 38.0 or 38: the owner's own example ("prva cena recimo 38 eur 1.
       oktobra") is a whole number once the fee is added to the early price (35 + 3),
       and a PayPal amount field reads "38" as thirty-eight units of whatever currency
       code came with it - which is euro either way here - so the digits are what a
       human reads twice before sending real money. */
    const link = paypalPaymentLink({ address: 'x@example.test', amountEur: 38, note: '20271' })

    expect(new URL(link).searchParams.get('amount')).toBe('38.00')
  })
})
