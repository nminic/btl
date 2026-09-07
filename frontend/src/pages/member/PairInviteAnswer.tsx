import { pairOf } from '../../data/derive'
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

  const mine = pairOf(pairs, memberNumber, invite.season)

  if (mine !== null) {
    /* The reader has paired since being asked. Their own pair is named, because „you are already
       in a pair" without saying with whom is a sentence that sends somebody looking. */
    return (
      <p className="messages__answered">
        {t('pair.inviteOvertaken', {
          who: named(mine.memberNumbers.filter((one) => one !== memberNumber).join('')),
        })}
      </p>
    )
  }

  /* Whatever the one who asked has paired into since. Accepting takes them out of it, which is the
     owner's own sentence („muškarac zatraži novi par, nova žena prihvati, dotadašnja žena istog
     trenutka dobija poruku"), so the person they leave has to be told at that moment. */
  const theirs = pairOf(pairs, invite.from, invite.season)

  return (
    <p className="messages__answer">
      <button
        type="button"
        className="button"
        onClick={() => {
          if (theirs !== null) {
            const left = theirs.memberNumbers.filter((one) => one !== invite.from).join('')

            breakPair(theirs.id)
            /* To that one member and to nobody else. Written to the league it would tell everybody
               that somebody's pair had ended, which is that member's business and not the
               league's. */
            notify({
              from: t('app.name'),
              to: left,
              subject: t('pair.brokenSubject'),
              body: t('pair.brokenBody', { who: named(invite.from), season: invite.season }),
              date: today,
            })
          }

          /* Written without a check that somebody is signed in, and that is not an omission: this
             is a member's own inbox and a visitor never reaches it (`SignedOut`). A check nothing
             can reach is a check nobody can be sure still works, which is the argument
             `profile/InviteToTeam.tsx` makes about inviting yourself. */
          makePair({
            season: invite.season,
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
