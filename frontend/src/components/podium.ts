/* The top of a table, and the one number that says how much of it is the top.
 *
 * In one place because it was in three, and because it went missing from two of
 * them at once: on 01.08.2026 the gold came off the standing and the Top 10
 * boards on a misreading of the owner's note, and stayed on the teams, so the
 * portal spent two days marking the podium on some tables and not on others.
 * What he had asked to be rid of was the yellow-edged line of prose above the
 * table (owner, 03.08.2026).
 *
 * The colour itself is in `src/styles/table.css`, which is the only place that
 * knows what gold means on a row.
 */

/** How many places at the top of a table are the podium. */
export const PODIUM = 3

/** The class a row at one of those places carries, and nothing for the rest. */
export function podiumClass(position: number): string | undefined {
  return position <= PODIUM ? 'podium' : undefined
}
