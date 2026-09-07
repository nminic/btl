import { Link } from 'react-router'
import { formatShortDate } from '../../i18n/format'
import { useToday } from '../../clock/useClock'
import { pairsFrom } from '../../data/derive'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import type { Competitor, RacingPair } from '../../data/types'

/**
 * „Trkački par" on a profile: who they are paired with, and, on your own page, how to end it and
 * what questions are still standing.
 *
 * PDL says a profile shows „tim i par sa linkovima", and until 07.09.2026 it showed only the team,
 * because nothing made a pair.
 *
 * **Every pair that still counts, and not the one of the furthest season** (review, 07.09.2026). A
 * member can hold two at once: on 2 January, the pair they are running this season in, and one made
 * for the season after. Answered with one of them, the other vanished from their own page and there
 * was no way left to end it, while the person on the far side of it went on being told they were
 * paired. „The furthest wins" was a rule I invented while fixing something else and wrote into no
 * journal, which is how it survived three rounds. A season that is over is history and is not drawn
 * here at all.
 *
 * **Ending one is only ever your own.** „Raskini" stands on the reader's own page and nowhere else:
 * a pair is two people confirming each other, so a third person ending it would be somebody else's
 * decision, and the person being read has their own page to end it from.
 *
 * **The questions still standing are the reader's own, and only on their own page.** Whether
 * somebody else has been asked, and by whom, is their business (odluka 07.09.2026).
 */
export function RacingPairLine({
  competitor,
  competitors,
  pairs,
}: {
  competitor: Competitor
  competitors: Competitor[]
  /** The pairs that hold now, the file and this visit together (`data/derive.ts`, `pairsNow`). */
  pairs: RacingPair[]
}) {
  const { locale, t } = useI18n()
  const today = useToday()
  const { memberNumber: reader, pairInvites, breakPair, notify } = useSession()
  const mine = reader === competitor.memberNumber
  const named = (who: string) =>
    competitors
      .filter((one) => one.memberNumber === who)
      .map((one) => `${one.firstName} ${one.lastName}`)
      .join('')

  const held = pairsFrom(pairs, competitor.memberNumber, Number(today.slice(0, 4)))
  const waiting = mine
    ? pairInvites
        .filter((one) => one.from === reader || one.to === reader)
        .map((one) => (
          <span key={one.id} className="profile__pair-waiting">
            {' '}
            {one.from === reader
              ? t('pair.sent', { who: named(one.to) })
              : t('pair.received', { who: named(one.from) })}
          </span>
        ))
    : []

  if (held.length === 0) {
    /* On somebody else's page, nothing at all. On the reader's own, that there is no pair and what
       is still standing: an empty space answers nothing. */
    return mine ? (
      <p className="profile__pair">
        <span>{t('pair.none')}</span>
        {waiting}
      </p>
    ) : null
  }

  return (
    <>
      {held.map((pair) => {
        const other = pair.memberNumbers.filter((one) => one !== competitor.memberNumber).join('')
        const partner = competitors.find((one) => one.memberNumber === other)

        return (
          <p className="profile__pair" key={pair.id}>
            <span className="profile__pair-label">{t('pair.mine')}: </span>
            {partner === undefined ? (
              /* A member the portal no longer has: the pair is still a fact and is still said, but
                 there is nothing to open. */
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
                       change that hits somebody who is not pressing anything, and PDL says such a
                       member „se obaveštava odmah po nastanku promene"; the same thing happens
                       through „Prihvati" (`member/PairInviteAnswer.tsx`) and it would be a strange
                       portal that told them one way and not the other. */
                    notify({
                      from: t('app.name'),
                      to: other,
                      subject: t('pair.brokenSubject'),
                      body: t('pair.endedBody', {
                        who: named(competitor.memberNumber),
                        season: pair.season,
                      }),
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
      })}
      {waiting.length > 0 && <p className="profile__pair">{waiting}</p>}
    </>
  )
}
