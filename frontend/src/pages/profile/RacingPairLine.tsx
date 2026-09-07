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
  const { memberNumber: reader, breakPair } = useSession()
  /* The furthest season they are paired for, not the one being run: a pair confirmed today holds
     for the season after this one, so asked about today a profile would say nothing at all to
     somebody who has just confirmed one (`data/derive.ts`, `latestPairOf`). */
  const pair = latestPairOf(pairs, competitor.memberNumber, Number(today.slice(0, 4)))

  if (pair === null) {
    return null
  }

  const other = pair.memberNumbers.filter((one) => one !== competitor.memberNumber).join('')
  const named = competitors.find((one) => one.memberNumber === other)

  return (
    <p className="profile__pair">
      <span className="profile__pair-label">{t('pair.mine')}: </span>
      {named === undefined ? (
        /* A member the portal no longer has: the pair is still a fact and is still said, but there
           is nothing to open. */
        <span>{other}</span>
      ) : (
        <Link to={`/${locale}/takmicar/${other}`}>
          {named.firstName} {named.lastName}
        </Link>
      )}{' '}
      <span className="profile__pair-since">
        {t('pair.since', { season: pair.season, date: formatShortDate(pair.since, locale) })}
      </span>
      {reader === competitor.memberNumber && (
        <>
          {' '}
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              breakPair(pair.id)
            }}
          >
            {t('pair.breakUp')}
          </button>
        </>
      )}
    </p>
  )
}
