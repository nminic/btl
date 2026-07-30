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

export function formatMemberNumber(value: number): string {
  return String(value).padStart(MEMBER_NUMBER_WIDTH, '0')
}

/**
 * The first free member number, given every one that is spoken for.
 *
 * First free rather than one past the highest, because the sequence has holes in
 * it: deleting a member on request removes the link between the number and the
 * person, which frees the number (PDL P23). A member who is merely pausing keeps
 * theirs, so the hole only ever appears where a record really went away.
 *
 * Whatever is handed in counts as spoken for, which is how the numbers taken by
 * records entered during this visit are skipped: the caller hands in the list it
 * shows, not the file it read.
 */
export function nextMemberNumber(taken: Iterable<string>): string {
  const spokenFor = new Set(taken)
  let candidate = 1

  while (spokenFor.has(formatMemberNumber(candidate))) {
    candidate += 1
  }

  return formatMemberNumber(candidate)
}
