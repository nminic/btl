import type { Competitor, RacingPair, Team } from '../../data/types'
import { InviteToPair } from './InviteToPair'
import { InviteToTeam } from './InviteToTeam'

/**
 * „POZOVI U TIM" AND „POZOVI U TRKAČKI PAR", AS ONE THING THE PARTS OF A PROFILE HAND THEIR HEAD.
 *
 * <p>Owner, 06.11.2026 (PDL „Profil: forma „Podaci" po obliku forme za prijavu"): „Opcije za pozivanje u
 * tim ili par ne treba da budu vidljive kao ogromno siroko dugme na nivou reda, vec malo normalno dugme
 * alignovano desno, istog formata i reda gde se nalaze i Pregled, Priznanja i nagrade, i podaci." And, the
 * same day, choosing between the offered places: they stand in the row of the parts on „Rezultati" and
 * „Priznanja", not on „Podaci".
 *
 * <p>One component for the two parts that carry them, so the two cannot come to offer different acts, and
 * <b>who sees each button is the button's own</b>: nothing is asked here that `InviteToTeam` and
 * `InviteToPair` do not already ask, and each draws nothing when it has nothing to offer.
 */
export function InvitesToHim({
  competitor,
  competitors,
  teams,
  pairs,
}: {
  /** Whose profile is being read. */
  competitor: Competitor
  competitors: Competitor[]
  /** Read through the overlay on both parts, so a team founded during this visit is the same on each. */
  teams: Team[]
  /** The pairs that hold now (`data/derive.ts`, `pairsNow`). */
  pairs: RacingPair[]
}) {
  return (
    <>
      <InviteToTeam competitor={competitor} competitors={competitors} teams={teams} />
      <InviteToPair competitor={competitor} competitors={competitors} pairs={pairs} />
    </>
  )
}
