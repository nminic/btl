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

const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * A stored date as the form shows it, dd/mm/gggg, or empty when there is none.
 *
 * Records keep dates the way a database and a sort order want them, yyyy-mm-dd,
 * and every field on the portal shows them the way the region reads them. The
 * two shapes meet here and nowhere else.
 */
export function fieldDate(iso: string): string {
  if (!ISO.test(iso)) {
    return ''
  }

  const [year, month, day] = iso.split('-')

  return `${day}/${month}/${year}`
}

/** And back again, which is how a date is stored. Empty when it is not a date,
 *  so a half typed value is never written as though it were one. */
export function isoDate(text: string): string {
  const date = parseDate(text)

  return date === null ? '' : date.toISOString().slice(0, 10)
}

/** Keeps the typing on the rails: digits only, slashes put in for the member. */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8)
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]

  return parts.filter((part) => part !== '').join('/')
}
