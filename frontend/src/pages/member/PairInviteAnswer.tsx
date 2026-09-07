import { pairOf, seasonFormedOn } from '../../data/derive'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { useToday } from '../../clock/useClock'
import type { Competitor, RacingPair } from '../../data/types'

/**
 * „Prihvati" and „Odbij", under the message that asks somebody into a racing pair.
 *
 * The other half of `profile/InviteToPair.tsx`, and written from `InvitationAnswer.tsx`, which
 * answers the same question about a team. A pair is made by both of them confirming (PDL P13), so
 * the invitation is a question and this is where it is answered.
 *
 * **Nothing here is remembered, and that is deliberate**, exactly as for a team: an accepted
 * invitation is one whose pair the member is now in, a refused one is one that is closed while they
 * are in none. Two people asking the same person on the same day therefore need not know about each
 * other, and a message never says „you refused" about a question that ended some other way.
 */
export function PairInviteAnswer({
  pairInvite: id,
  competitors,
  pairs,
}: {
  pairInvite: string
  competitors: Competitor[]
  /** The pairs that hold now, the file and this visit together (`data/derive.ts`, `pairsNow`). */
  pairs: RacingPair[]
}) {
  const { t } = useI18n()
  const today = useToday()
  const { memberNumber, pairInvites, closePairInvite, makePair, breakPair, notify } = useSession()

  const invite = pairInvites.find((one) => one.id === id)
  const between = new Set([String(memberNumber), invite?.from])
  const named = (who: string) =>
    competitors
      .filter((one) => one.memberNumber === who)
      .map((one) => `${one.firstName} ${one.lastName}`)
      .join('')

  if (invite === undefined) {
    /* What can be said about a question that is over, and nothing more: whether it was refused,
       accepted, or overtaken by the reader pairing elsewhere is not written down anywhere, and
       should not be. */
    return <p className="messages__answered">{t('pair.inviteClosed')}</p>
  }

  /* **The season is worked out here and not read off the question** (review, 07.09.2026):
     „Formiranje mora biti završeno do 31. decembra", and forming ends with this press. A question
     asked on 31 December and answered on 2 January makes a pair for the season after next. */
  const season = seasonFormedOn(today)
  const mine = pairOf(pairs, memberNumber, season)
  /* Whatever the one who asked has paired into since. */
  const theirs = pairOf(pairs, invite.from, season)

  /* **Both sides are treated alike, and that is a decision** (07.09.2026, after a review found the
     two halves answered differently). PDL says „Prihvatanje novog poziva dok već postoji par
     raskida stari i istog trenutka obaveštava dotadašnjeg partnera", written of nobody in
     particular; the owner's example beside it happens to describe the one who asked. Written to
     refuse the reader and break the asker, the same sentence had two answers depending on which
     side the pair stood, and the reader had a quieter way round it anyway: end their own pair with
     no word to anybody and then accept.
   *
     So accepting ends whatever either of them is in for that season, and whoever is left is told.
     The boundary in the other direction: **a pair of a season that is over is never touched**, and
     nothing here reaches one, because both are read for the season being formed. */
  const takeOutOf = (pair: RacingPair | null) => {
    if (pair === null) {
      return
    }

    const left = pair.memberNumbers.filter((one) => !between.has(one)).join('')

    breakPair(pair.id)
    /* To that one member and to nobody else. Written to the league it would tell everybody that
       somebody's pair had ended, which is that member's business and not the league's. */
    notify({
      from: t('app.name'),
      to: left,
      subject: t('pair.brokenSubject'),
      body: t('pair.brokenBody', { who: named(other(pair, left)), season }),
      date: today,
    })
  }

  return (
    <p className="messages__answer">
      <button
        type="button"
        className="button"
        onClick={() => {
          takeOutOf(theirs)
          takeOutOf(mine)

          /* Written without a check that somebody is signed in, and that is not an omission: this
             is a member's own inbox and a visitor never reaches it (`SignedOut`). A check nothing
             can reach is a check nobody can be sure still works, which is the argument
             `profile/InviteToTeam.tsx` makes about inviting yourself. */
          makePair({
            season,
            memberNumbers: [invite.from, String(memberNumber)],
            since: today,
          })
          closePairInvite(id)
        }}
      >
        {t('pair.accept')}
      </button>{' '}
      <button
        type="button"
        className="button button--secondary"
        onClick={() => {
          closePairInvite(id)
        }}
      >
        {t('pair.refuse')}
      </button>
    </p>
  )
}

/** The half of a pair that is not the one named. */
function other(pair: RacingPair, than: string): string {
  return pair.memberNumbers.filter((one) => one !== than).join('')
}
