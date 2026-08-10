/* Dates are written and shown as dd/mm/gggg, everywhere on the portal
 * (PDL P8). The native date input cannot be forced into that shape: it follows
 * the browser's locale, so an English browser shows mm/dd/yyyy and a member
 * born on 3 April reads 04/03. A text field with a known shape is the only way
 * to be sure what the digits mean.
 */

const SHAPE = /^\d{2}\/\d{2}\/\d{4}$/

/** The date, or null when the text is not a real date in that shape. */
export function parseDate(text: string): Date | null {
  const written = text.trim()

  if (!SHAPE.test(written)) {
    return null
  }

  /* The shape is fixed width, so the three numbers are slices of it. Reading
     them out of capture groups instead hands back three values that might not
     be there, and a date field then has to say what it means by a day with no
     month, which is a case the shape has already ruled out. */
  const day = Number(written.slice(0, 2))
  const month = Number(written.slice(3, 5))
  const year = Number(written.slice(6))
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

  // Fixed width on both sides of the move, so the three pieces are slices, the
  // same way round as they are read out of what a member types.
  return `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
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

/**
 * How many days lie between two stored dates, or nought where either is not one.
 *
 * Both ends are built in UTC, which has no change of clocks, so the difference
 * between them is whole days and the division is exact. Built from local dates
 * instead, a week across the last Sunday in March is six days and twenty three
 * hours, which rounds to six: an event put off a week would take its races six
 * days along and the Sunday race would land on the Saturday.
 */
export function daysBetween(from: string, to: string): number {
  if (!ISO.test(from) || !ISO.test(to)) {
    return 0
  }

  const start = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8)))
  const end = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8)))

  return Math.round((end - start) / 86400000)
}

/** The same date moved by that many days, or unchanged where it is not a date. */
export function shiftDate(iso: string, days: number): string {
  if (!ISO.test(iso)) {
    return iso
  }

  const at = new Date(
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8)) + days),
  )

  return at.toISOString().slice(0, 10)
}
