/* The payloads behind the payment QR codes.
 *
 * Two standards, not one, and they are not interchangeable:
 *
 *   NBS IPS  for a member paying from Serbia, in dinars, to a Serbian account.
 *   EPC 069  for a member paying from a SEPA country, in euros, by IBAN.
 *
 * Only the text is built here. Turning it into an image is a separate step and
 * a separate decision; the string is the part that has to be exactly right, and
 * it is the part worth testing.
 *
 * Bosnia is in neither: it is not in SEPA, so a member there pays by PayPal
 * (PDL P8).
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
 * The season and the member number without its leading noughts: 2027-37. The
 * season is in it because the same person pays every year and the number alone
 * would not say which year was paid; the noughts are out because nobody copying
 * a reference from a screen into a banking application types four of them
 * correctly.
 */
export function paymentReference(season: number, memberNumber: string): string {
  return `${season}-${Number(memberNumber)}`
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

export type EpcPayment = {
  iban: string
  bic: string
  recipient: string
  amountEur: number
  purpose: string
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
 * RO begins with two digits naming the model, and `00` is what a reference with
 * no model uses. The reference itself is handed in, so this is the one place
 * that says which model the association's slips use. **Confirm with the bank
 * before the first real payment**: a wrong model is a payment that arrives and
 * cannot be reconciled.
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
    parts.push(`RO:00${payment.reference}`)
  }

  return parts.join('|')
}

/**
 * The EPC payload, which is line based rather than tag based. Every line counts,
 * including the empty ones: readers go by position, so a missing blank line
 * shifts everything after it.
 */
export function epcPayload(payment: EpcPayment): string {
  return [
    'BCD',
    '002',
    '1',
    'SCT',
    payment.bic,
    payment.recipient,
    payment.iban,
    `EUR${payment.amountEur.toFixed(2)}`,
    '',
    '',
    payment.purpose,
  ].join('\n')
}

/** SEPA covers these; Bosnia is deliberately not among them. */
export const SEPA_COUNTRIES = ['HR', 'ME', 'MK', 'SI']

export type PaymentMethod = 'ips' | 'epc' | 'paypal' | 'card'

/**
 * What a member is offered, by the country on their profile.
 *
 * PayPal must never appear for a member in Serbia. Payments through it between
 * residents of Serbia are not allowed under the foreign exchange act, so this
 * is a legal boundary and not a preference (PDL P8).
 */
export function methodsFor(country: string): PaymentMethod[] {
  if (country === 'RS') {
    return ['ips', 'card']
  }

  if (SEPA_COUNTRIES.includes(country)) {
    return ['epc', 'paypal']
  }

  return ['paypal']
}
