/* Dates are written and shown as dd/mm/gggg, everywhere on the portal
 * (PDL P8). The native date input cannot be forced into that shape: it follows
 * the browser's locale, so an English browser shows mm/dd/yyyy and a member
 * born on 3 April reads 04/03. A text field with a known shape is the only way
 * to be sure what the digits mean.
 */

const SHAPE = /^(\d{2})\/(\d{2})\/(\d{4})$/

/** The date, or null when the text is not a real date in that shape. */
export function parseDate(text: string): Date | null {
  const match = SHAPE.exec(text.trim())

  if (match === null) {
    return null
  }

  const [, day, month, year] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  // Rejects 31/02/2027, which Date would otherwise roll into March.
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) {
    return null
  }

  return date
}

/** Full years between the date and today. */
export function ageOn(birth: Date, today: Date): number {
  let years = today.getUTCFullYear() - birth.getUTCFullYear()
  const birthdayThisYear = new Date(
    Date.UTC(today.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()),
  )

  if (today < birthdayThisYear) {
    years -= 1
  }

  return years
}

/** Keeps the typing on the rails: digits only, slashes put in for the member. */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8)
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]

  return parts.filter((part) => part !== '').join('/')
}
