import { Link } from 'react-router'
import { BOARD_PLACES, boardOfTen } from '../../data/derive'
import type { Competitor, Gender, Result } from '../../data/types'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { CompetitorName } from '../../components/CompetitorName'
import { Portrait } from './Portrait'

/**
 * The top ten of one gender, in the shape the old portal had (owner,
 * 31.07.2026): the leader beside the heading with their face at full size, and
 * the nine behind them as a three by three block of smaller faces.
 *
 * Every place carries its number, as it did on the old portal, because a board
 * headed "Top 10" in which no place is named leaves the reader to work out
 * whether the top left cell of the block is second or tenth.
 *
 * The board keeps its ten places whether or not the league has ten members, so
 * the two boards standing side by side are the same height all season.
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
  const slots = boardOfTen(competitors, results, season, gender)
  const scored = slots.some((slot) => slot.points > 0)
  const waiting = slots.some((slot) => !slot.ranked)
  const headingId = `top-ten-${gender}`
  const leader = slots[0]
  /* Nine slots, always. A slot with nobody in it is a circle and no name, and it
     is out of the reading entirely: "place five, empty" is not a fact anybody
     needs read out to them. */
  const rest = Array.from({ length: BOARD_PLACES - 1 }, (_, index) => slots[index + 1])

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
              <span className="top10__place">{t('home.place', { place: 1 })}</span>
              <CompetitorName className="top10__name" competitor={leader.competitor} />
              {scored && (
                <span className="top10__points">
                  {formatPoints(leader.points, locale)}
                  {t('home.pointsUnit')}
                </span>
              )}
            </p>
          </div>

          <ol className="top10__rest">
            {rest.map((slot, index) => (
              <li
                className="top10__cell"
                key={slot?.competitor.memberNumber ?? `empty-${index}`}
                aria-hidden={slot === undefined ? 'true' : undefined}
              >
                <span className="top10__place">{t('home.place', { place: index + 2 })}</span>
                <Portrait competitor={slot?.competitor} />
                {slot !== undefined && (
                  <CompetitorName className="top10__name" competitor={slot.competitor} />
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {/* Which of the two kinds of incomplete this board is, because they are
          different facts: nobody has raced yet, or some have and the rest of the
          places are held by members waiting for their first result. */}
      {leader !== undefined && !scored && <p className="card__note">{t('home.topBeforeSeason')}</p>}
      {leader !== undefined && scored && waiting && (
        <p className="card__note">{t('home.topPartlyFilled')}</p>
      )}

      {/* The standing lives at /tabela; /top-liste is the page of Top 10 boards
          beside it (PDL P28a). */}
      <Link className="card__more" to={`/${locale}/tabela?pol=${gender === 'M' ? 'm' : 'z'}`}>
        {t('home.wholeStanding')}
      </Link>
    </section>
  )
}
