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
