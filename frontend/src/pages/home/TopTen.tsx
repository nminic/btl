import { Link } from 'react-router'
import { topTen } from '../../data/derive'
import type { Competitor, Gender, Result } from '../../data/types'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { CompetitorName } from '../../components/CompetitorName'
import { Portrait } from './Portrait'

/** How many places the board keeps: the first one large, the other nine in a
 *  three by three block under it. */
const PLACES = 10

/**
 * The top ten of one gender, in the shape the old portal had (owner,
 * 31.07.2026): the leader beside the heading with their face at full size, and
 * the nine behind them as a three by three block of smaller faces.
 *
 * The board keeps its ten places whether or not there are ten people to put in
 * them, so the two boards standing side by side are the same height in January,
 * when the league has three members with a result, as in December.
 */
export function TopTen({
  competitors,
  results,
  season,
  gender,
}: {
  competitors: Competitor[]
  results: Result[]
  season: number
  gender: Gender
}) {
  const { locale, t } = useI18n()
  const rows = topTen(competitors, results, season, gender)
  const scored = rows.some((row) => row.points > 0)
  const headingId = `top-ten-${gender}`
  const leader = rows[0]
  /* Nine slots, always. A slot with nobody in it is a circle and no name, out of
     the reading, because "place five, empty" is not a fact anybody needs read
     out to them. */
  const rest = Array.from({ length: PLACES - 1 }, (_, index) => rows[index + 1])

  return (
    <section className="card top10" aria-labelledby={headingId}>
      <h2 className="card__title" id={headingId}>
        {t(gender === 'M' ? 'home.topMen' : 'home.topWomen')}
      </h2>

      {leader === undefined ? (
        <p className="card__empty">{t('home.noneRanked')}</p>
      ) : (
        <>
          <div className="top10__first">
            <Portrait competitor={leader.competitor} large />
            <p className="top10__lead">
              <CompetitorName className="top10__name" competitor={leader.competitor} />
              {scored && (
                <span className="top10__points">{formatPoints(leader.points, locale)}</span>
              )}
            </p>
          </div>

          <ol className="top10__rest" start={2}>
            {rest.map((row, index) => (
              <li className="top10__cell" key={row?.competitor.memberNumber ?? `empty-${index}`}>
                <Portrait competitor={row?.competitor} />
                {row !== undefined && (
                  <CompetitorName className="top10__name" competitor={row.competitor} />
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {/* Before the first race there is nothing to rank, so the board says what
          it is actually showing rather than pretending to be a standing. */}
      {leader !== undefined && !scored && <p className="card__note">{t('home.topBeforeSeason')}</p>}

      {/* The standing lives at /tabela; /top-liste is the page of Top 10 boards
          beside it (PDL P28a). */}
      <Link className="card__more" to={`/${locale}/tabela?pol=${gender === 'M' ? 'm' : 'z'}`}>
        {t('home.wholeStanding')}
      </Link>
    </section>
  )
}
