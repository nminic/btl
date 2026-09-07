import { Link } from 'react-router'
import { formatShortDate } from '../../i18n/format'
import { useToday } from '../../clock/useClock'
import { latestPairOf } from '../../data/derive'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import type { Competitor, RacingPair } from '../../data/types'

/**
 * „Trkački par" on a profile: who they are paired with, and, on your own profile, how to end it.
 *
 * PDL says a profile shows „tim i par sa linkovima", and until 07.09.2026 it showed only the team,
 * because nothing made a pair. This is the other half of the two the owner asked for that day.
 *
 * **Ending it is only ever your own.** „Raskini" is drawn on the reader's own profile and nowhere
 * else: a pair is two people confirming each other, so a third person ending it would be somebody
 * else's decision, and the person being read has their own page to end it from.
 *
 * The other half of the pair is a link, like the team beside it: a pair is two profiles and the
 * point of naming one is to be able to open it.
 */
export function RacingPairLine({
  competitor,
  competitors,
  pairs,
}: {
  competitor: Competitor
  competitors: Competitor[]
  /** The pairs that hold now (`data/derive.ts`, `pairsNow`). */
  pairs: RacingPair[]
}) {
  const { locale, t } = useI18n()
  const today = useToday()
  const { memberNumber: reader, pairInvites, breakPair, notify } = useSession()
  /* The furthest season they are paired for, not the one being run: a pair confirmed today holds
     for the season after this one, so asked about today a profile would say nothing at all to
     somebody who has just confirmed one (`data/derive.ts`, `latestPairOf`). */
  const pair = latestPairOf(pairs, competitor.memberNumber, Number(today.slice(0, 4)))

  const mine = reader === competitor.memberNumber
  const named = (who: string) =>
    competitors
      .filter((one) => one.memberNumber === who)
      .map((one) => `${one.firstName} ${one.lastName}`)
      .join('')

  if (pair === null) {
    /* **On somebody else's profile, nothing at all**: whether they have been asked, and by whom, is
       their business. On the reader's own, the state PDL asks a profile to carry: that there is no
       pair, and the questions still standing, both the ones sent and the ones received (odluka
       07.09.2026; a review found only the first two of the three were drawn). */
    return mine ? (
      <p className="profile__pair">
        <span>{t('pair.none')}</span>{' '}
        {pairInvites
          .filter((one) => one.from === reader || one.to === reader)
          .map((one) => (
            <span key={one.id} className="profile__pair-waiting">
              {one.from === reader
                ? t('pair.sent', { who: named(one.to) })
                : t('pair.received', { who: named(one.from) })}
            </span>
          ))}
      </p>
    ) : null
  }

  const other = pair.memberNumbers.filter((one) => one !== competitor.memberNumber).join('')
  const partner = competitors.find((one) => one.memberNumber === other)

  return (
    <p className="profile__pair">
      <span className="profile__pair-label">{t('pair.mine')}: </span>
      {partner === undefined ? (
        /* A member the portal no longer has: the pair is still a fact and is still said, but there
           is nothing to open. */
        <span>{other}</span>
      ) : (
        <Link to={`/${locale}/takmicar/${other}`}>
          {partner.firstName} {partner.lastName}
        </Link>
      )}{' '}
      <span className="profile__pair-since">
        {t('pair.since', { season: pair.season, date: formatShortDate(pair.since, locale) })}
      </span>
      {mine && (
        <>
          {' '}
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              breakPair(pair.id)
              /* And the other half is told, by name and in their own inbox. Ending a pair is a
                 change that hits somebody who is not pressing anything, and PDL says such a member
                 „se obaveštava odmah po nastanku promene"; the same thing happens through
                 „Prihvati" (`member/PairInviteAnswer.tsx`) and it would be a strange portal that
                 told them one way and not the other (review, 07.09.2026). */
              notify({
                from: t('app.name'),
                to: other,
                subject: t('pair.brokenSubject'),
                body: t('pair.endedBody', { who: named(competitor.memberNumber), season: pair.season }),
                date: today,
              })
            }}
          >
            {t('pair.breakUp')}
          </button>
        </>
      )}
    </p>
  )
}
