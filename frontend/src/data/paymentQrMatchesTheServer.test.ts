import { describe, expect, it } from 'vitest'
import SLIP from './ipsSlipBothSidesWrite.json'
import {
  ipsPayload,
  paymentPurpose,
  paymentReferenceOrNone,
  PAYPAL_ADDRESS,
  RECIPIENT_ACCOUNT,
  RECIPIENT_ADDRESS,
  RECIPIENT_NAME,
} from './paymentQr'

/**
 * THE SLIP THE SERVER MAILS IS THE SLIP THIS PAGE DRAWS, AND THE TWO MEET ON ONE FILE.
 *
 * The owner, 23.10.2026: a member from Serbia whose address is confirmed is mailed the payment
 * details with the IPS QR code attached. The server writes that code in Java (`IpsSlip`), and this page
 * writes its own with `ipsPayload`; neither can read the other. So `ipsSlipBothSidesWrite.json`
 * holds the payee and a set of slips with the text each must come out as, `IpsSlipTest` requires
 * the server to write exactly that, and this requires the page to. Edited to suit one side, the file
 * fails on the other.
 *
 * The slips are a member with no number, the only one the letter is ever sent to (owner,
 * 24.10.2026: nothing goes to a member who already has a number), so the page's reference is asked
 * for one with none, exactly as `Membership.tsx` asks it.
 */
describe('the slip the server mails', () => {
  it('names the payee and the PayPal address this page names', () => {
    expect({
      recipientName: RECIPIENT_NAME,
      recipientAddress: RECIPIENT_ADDRESS,
      account: RECIPIENT_ACCOUNT,
      paypalAddress: PAYPAL_ADDRESS,
    }).toEqual({
      recipientName: SLIP.recipientName,
      recipientAddress: SLIP.recipientAddress,
      account: SLIP.account,
      paypalAddress: SLIP.paypalAddress,
    })
  })

  it('has slips to compare, so the case below is not a loop over nothing', () => {
    expect(SLIP.slips.length).toBeGreaterThan(1)
  })

  it.each(SLIP.slips)('carries the text this page puts in its code, for $season', (slip) => {
    expect(
      ipsPayload({
        account: RECIPIENT_ACCOUNT,
        recipient: RECIPIENT_NAME,
        amountRsd: slip.amountRsd,
        purpose: paymentPurpose(slip.season),
        reference: paymentReferenceOrNone(slip.season, null),
      }),
    ).toBe(slip.payload)
  })
})
