/** Which day of the week, and the how-many-th of its kind in that month. */
type Place = { weekday: number; nth: number }

/** The shape a stored day has, and nothing else is read here. */
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Two digits, so a day and a month go back the width they came. */
function padded(number: number): string {
  return String(number).padStart(2, '0')
}

/** The day that stands in that place in that month, or the last one of its
 *  weekday where the month does not reach that far. */
function dayAt(year: number, month: number, { weekday, nth }: Place): Date {
  const first = new Date(year, month, 1)
  const start = 1 + ((weekday - first.getDay() + 7) % 7)
  const asked = start + (nth - 1) * 7
  /* Day nought of the month after is the last day of this one. */
  const days = new Date(year, month + 1, 0).getDate()

  /* A month with four Saturdays cannot hold a fifth. The last one of that
     weekday is what „the fifth Saturday" means to whoever entered it: an event
     at the end of its month stays at the end of its month. */
  return new Date(year, month, asked > days ? asked - 7 : asked)
}

/**
 * The same place in next year's calendar, for a copy of last season's event.
 *
 * A race is not held on a date, it is held on a Saturday of a month (owner,
 * 23.08.2026): „ukoliko se kopirani događaj održao 3. subote u oktobru 2026,
 * predlog datuma novog događaja treba da bude 3. subota u oktobru 2027 (koji god
 * to datum bio)". Copying last season's calendar is otherwise a year of dates
 * that are each wrong by a day or two, and correcting every one of them by hand
 * is the work this takes away.
 *
 * A proposal and nothing more: it is what the date field opens holding, and
 * whoever is copying may type over it.
 *
 * The year is the one after the day handed in, not the one after today. A
 * calendar filled in during September 2026 for the 2027 season is copied from
 * 2026, and an event copied from an older season lands one year on from where it
 * stood rather than in a year nobody asked about; the date is a proposal, so
 * moving it further is one edit either way.
 *
 * **Built and read in local time from beginning to end.** `Date` is only ever
 * asked which weekday a day is and how long a month is, and the answer goes back
 * as the three numbers it was made of. `toISOString` is not used: it is UTC, and
 * a day built at local midnight in Belgrade is the evening before in UTC, so the
 * proposal would land a day early half the year.
 */
export function nextSeason(iso: string): string {
  const read = ISO.exec(iso)

  if (read === null) {
    return ''
  }

  const [, year, month, day] = read
  const was = new Date(Number(year), Number(month) - 1, Number(day))

  /* And the shape alone is not the day: „2026-13-45" is written like one and is
     not one, and `Date` rolls it forward into some other month rather than
     refusing. Asked back, so only a day that survives the journey is used. */
  if (
    was.getFullYear() !== Number(year) ||
    was.getMonth() !== Number(month) - 1 ||
    was.getDate() !== Number(day)
  ) {
    return ''
  }

  const place: Place = { weekday: was.getDay(), nth: Math.floor((was.getDate() - 1) / 7) + 1 }
  const then = dayAt(was.getFullYear() + 1, was.getMonth(), place)

  return `${then.getFullYear()}-${padded(then.getMonth() + 1)}-${padded(then.getDate())}`
}
