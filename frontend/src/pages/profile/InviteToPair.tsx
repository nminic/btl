import { pairOf, seasonFormedOn } from '../../data/derive'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { useToday } from '../../clock/useClock'
import type { Competitor, RacingPair } from '../../data/types'

/**
 * „Pozovi u trkački par", on somebody else's profile.
 *
 * **The owner chose this door out of three** (07.09.2026: „Poslušaću predlog broj 1, tvoju
 * preporuku"), and the reason he was offered it first is that it introduces no new idea: the portal
 * already asks one named person a question by putting it in their inbox, and a member already knows
 * that shape from teams. `profile/InviteToTeam.tsx` is the same component for the same act, and this
 * is written from it rather than beside it.
 *
 * **Who sees it, and every condition is a decision rather than a guess** (PDL, „Trkački par"):
 *
 * - a signed-in member, because a pair is made of two members;
 * - of the **opposite** sex, because a pair is one man and one woman;
 * - when **neither of them** already has a pair for the season being formed, because a member is in
 *   one pair at a time;
 * - and when no question is already standing between the two of them, which is also the answer to
 *   „did my press register".
 *
 * **What is not a condition, and it looks like one.** „Formiranje mora biti završeno do 31. decembra
 * da bi trkački par važio u novoj sezoni" (PDL P13) reads like a deadline that closes the button at
 * some point in the year. It is not: every day of a year is before the end of that year, so nothing
 * is ever refused. What the sentence really fixes is **which season** a pair holds for.
 *
 * **And it fixes it on the day the pair is finished, not on the day it is asked for** (review,
 * 07.09.2026): forming ends with the other one confirming. So the season worked out here is only
 * for the question the button asks, and `member/PairInviteAnswer.tsx` works it out again on the day
 * the answer comes. Asked on 31 December and answered on 2 January, a pair belongs to the season
 * after next, which is what „mora biti završeno do 31. decembra" says.
 *
 * There is no condition against inviting yourself: the two are of different sexes, so they cannot be
 * the same person. Written down because an absent check is the kind of thing a later reader adds
 * back.
 */
export function InviteToPair({
  competitor,
  competitors,
  pairs,
}: {
  /** Whose profile is being read. */
  competitor: Competitor
  competitors: Competitor[]
  /** The pairs that hold now, the file and this visit together (`data/derive.ts`, `pairsNow`). */
  pairs: RacingPair[]
}) {
  const { t } = useI18n()
  const today = useToday()
  const { memberNumber: reader, pairInvites, invitePair, notify } = useSession()

  const me = competitors.find((one) => one.memberNumber === reader)
  /* The season a pair confirmed today would hold for: the next one. Read off the day rather than
     off the season picker, because the rule is about the calendar and not about what is being
     looked at (PDL P13).
   *
     **Worked out again when the answer comes, and this one is only for the question**: „Formiranje
     mora biti završeno do 31. decembra" puts the deadline on the finishing, and a pair is finished
     when the other one confirms. Asked on 31 December and answered on 2 January, the pair belongs
     to the season after next, and the button here has no way to know that (review, 07.09.2026). */
  const season = seasonFormedOn(today)

  if (
    me === undefined ||
    me.gender === competitor.gender ||
    pairOf(pairs, me.memberNumber, season) !== null ||
    pairOf(pairs, competitor.memberNumber, season) !== null
  ) {
    return null
  }

  /* Asked once, in either direction: a question standing from her to him is the same question as
     one from him to her, and two of them in two inboxes would be two answers to one thing. */
  const between = new Set([me.memberNumber, competitor.memberNumber])
  const standing = pairInvites.some((one) => between.has(one.from) && between.has(one.to))

  if (standing) {
    return <p className="profile__invited">{t('pair.asked')}</p>
  }

  return (
    <button
      type="button"
      className="button button--secondary"
      onClick={() => {
        const id = invitePair({ from: me.memberNumber, to: competitor.memberNumber, date: today })

        /* The invitation and the message that carries it are written together, because neither is
           any use alone: the record is what may be answered, and the inbox is the only place the
           person being asked will see it. */
        notify({
          from: t('app.name'),
          to: competitor.memberNumber,
          subject: t('pair.inviteSubject'),
          body: t('pair.inviteBody', { who: `${me.firstName} ${me.lastName}` }),
          date: today,
          pairInvite: id,
        })
      }}
    >
      {t('pair.invite')}
    </button>
  )
}
