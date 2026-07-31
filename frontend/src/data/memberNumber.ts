/* The member number, and the one rule for handing one out.
 *
 * Six digits, unique, mixed for both genders, and the same through every season
 * (PDL P8). Six because a numbering scheme outlives the league that started it
 * and changing the width later is expensive.
 *
 * It is handed out at the moment somebody records that the fee arrived, first
 * free in order, and an administrator never types it (PDL P8, 30.07.2026). The
 * consequence worth knowing is the one this module exists for: a registered
 * member who has not paid has no number at all.
 */

/** Six digits, so 1 reads as 000001. */
export const MEMBER_NUMBER_WIDTH = 6

/** The last number six digits can hold. Past it the width is not six any more,
 *  and the width is the one thing about a member number that cannot change
 *  quietly: it is the key of every row, address and result on the portal. */
const HIGHEST = 10 ** MEMBER_NUMBER_WIDTH - 1

export function formatMemberNumber(value: number): string {
  return String(value).padStart(MEMBER_NUMBER_WIDTH, '0')
}

/**
 * The next member number: one past the highest ever handed out.
 *
 * Never the first free one (owner, 31.07.2026). Deleting a member on request
 * takes the link between the number and the person away (PDL P23), and it used
 * to take the number back into circulation with it, so the next person to join
 * inherited a number that appears in old results, old tables and somebody's
 * printed card. Two people, one number, and nothing on the portal able to say
 * which of them a row from 2029 belongs to.
 *
 * A number therefore only ever counts up. In the prototype "ever handed out" is
 * the highest number in the list handed in; when the members live in a database
 * it is a sequence, which is the only form that survives the row being deleted
 * (recorded in PDL P8).
 *
 * With 999999 handed out there is no next one, and it says so. It used to return
 * '1000000': seven digits out of a function whose whole subject is that the
 * number has six, handed on to a key, an address and a printed card without a
 * word. Six digits were chosen to outlive the league (PDL P8), so this is a line
 * nobody is expected to reach; running past it in silence is what must not
 * happen.
 */
export function nextMemberNumber(taken: Iterable<string>): string {
  let highest = 0

  for (const one of taken) {
    highest = Math.max(highest, Number(one))
  }

  if (highest >= HIGHEST) {
    throw new Error(`No member number left: all ${HIGHEST} of them are spoken for`)
  }

  return formatMemberNumber(highest + 1)
}
