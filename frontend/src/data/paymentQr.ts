/* The payload behind the payment QR code.
 *
 * One standard, and only inside one country: NBS IPS, for a member paying from
 * Serbia, in dinars, to the association's dinar account.
 *
 * There is no code for anybody else (owner, 31.07.2026). A member abroad pays by
 * PayPal or by card, and never sees a code at all: the association has no
 * foreign currency account yet, and a European code would be a second account
 * number to keep right, a second standard to get wrong, and a second thing to
 * explain, for a way of paying that two other ways already cover.
 *
 * Only the text is built here. Turning it into an image is a separate step and a
 * separate decision; the string is the part that has to be exactly right, and it
 * is the part worth testing.
 */

/* Who the money goes to. One place, because the same four facts appear on the
 * slip, in the QR code and in the sentence telling somebody what to type into
 * their bank, and three copies of an account number is two too many.
 *
 * The account and the address are the association's own (owner, 31.07.2026). */
export const RECIPIENT_NAME = 'Sportsko udruženje BTL'
export const RECIPIENT_ADDRESS = 'Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd'
export const RECIPIENT_ACCOUNT = '105000000000328471'

/**
 * What the member writes in the reference field, and what the administrator
 * reads off the statement to know whose money this is (owner, 31.07.2026).
 *
 * The season and then the member number without its leading noughts, run
 * together: 202737. Digits and nothing else, because the field is read by a
 * machine off a bank statement and a separator is one more thing that can be
 * dropped, doubled or turned into a different character on the way.
 *
 * The season is in it because the same person pays every year and the number
 * alone would not say which year was paid; the noughts are out because nobody
 * copying a reference from a screen into a banking application types four of
 * them correctly.
 */
export function paymentReference(season: number, memberNumber: string): string {
  return `${season}${Number(memberNumber)}`
}

/** What the money is for, in the words the statement will carry. */
export function paymentPurpose(season: number): string {
  return `Članarina za ${season}. godinu`
}

export type IpsPayment = {
  /** Account in the Serbian 18 digit form, without dashes. */
  account: string
  recipient: string
  amountRsd: number
  purpose: string
  /** Model and reference number, or an empty string. */
  reference: string
}

/** Dinars in the IPS form: "RSD" then the amount with a comma. */
export function ipsAmount(amountRsd: number): string {
  return `RSD${amountRsd.toFixed(2).replace('.', ',')}`
}

/**
 * The NBS IPS payload. The order of the tags is part of the standard, and the
 * separator is a vertical bar.
 *
 * K identifies the standard, V the version, C the character set, R the account,
 * N the recipient, I the amount, SF the payment code and S the purpose. RO
 * carries the reference and is left out when there is none, rather than sent
 * empty, which some readers reject.
 *
 * N takes the name and then the address, one per line, which is how the
 * standard carries a recipient with a seat.
 *
 * RO carries the reference exactly as it is handed in. The association's slips
 * use no model (owner, 31.07.2026), so nothing is prefixed to it; where a model
 * is used, its two digits come first.
 */
export function ipsPayload(payment: IpsPayment): string {
  const parts = [
    'K:PR',
    'V:01',
    'C:1',
    `R:${payment.account}`,
    `N:${payment.recipient}`,
    `I:${ipsAmount(payment.amountRsd)}`,
    'SF:289',
    `S:${payment.purpose}`,
  ]

  if (payment.reference !== '') {
    parts.push(`RO:${payment.reference}`)
  }

  return parts.join('|')
}

export type PaymentMethod = 'ips' | 'paypal' | 'card'

/**
 * What a member is offered, by the country on their profile.
 *
 * Two rules, and both of them are boundaries rather than preferences.
 *
 * PayPal must never appear for a member in Serbia: payments through it between
 * residents of Serbia are not allowed under the foreign exchange act (PDL P8).
 *
 * The slip with the code must never appear for anybody else (owner,
 * 31.07.2026): it pays into a dinar account at a Serbian bank, and from abroad
 * that is the slowest and dearest way there is. Abroad it is PayPal or a card,
 * and nothing else.
 */
export function methodsFor(country: string): PaymentMethod[] {
  return country === 'RS' ? ['ips', 'card'] : ['paypal', 'card']
}
