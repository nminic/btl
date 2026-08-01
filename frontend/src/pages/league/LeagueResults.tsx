import { useMemo } from 'react'
import { CompetitorName } from '../../components/CompetitorName'
import { Resource } from '../../components/Resource'
import { useToday } from '../../clock/useClock'
import { fieldFor } from '../../data/derive'
import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'
import { combineResources, useCompetitors, useRaces, useResults } from '../../data/useResource'
import { formatPoints, formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { leagueTable } from './leagueTable'
import './League.css'

/**
 * The standing of a competition as a grid (owner, 31.07.2026).
 *
 * Everybody who ran at least one of its races down the side, every race across
 * the top, points where they meet, and the total in the second column, which is
 * what the table is ordered by.
 *
 * The headings across the top are written on their side. That was asked for, and
 * the reason is arithmetic: the widest competition in the data has forty six
 * races, and forty six columns of "Beogradski maraton" laid flat is a table
 * nobody can put on a screen. Turned, a column costs its own width and no more.
 *
 * A race somebody did not run is left empty rather than shown as nought. Nought
 * is a claim: it says they ran it and scored nothing.
 *
 * Its own component below the resource, not inside it, so the grid can be
 * memoised: it walks every result there is, and a render that rebuilt it would
 * do that on every keystroke anywhere on the page.
 */
function Grid({
  league,
  events,
  races,
  results,
  competitors,
}: {
  league: League
  events: BtlEvent[]
  races: Race[]
  results: Result[]
  competitors: Competitor[]
}) {
  const { locale, t } = useI18n()
  const today = useToday()
  /* Who the grid is drawn from (PDL P11). A member whose fee has run out is not
     in the standing of the season now, and a competition's grid is that standing
     over a subset of its events. It does not show today, because the one such
     member raced in 2017 and the three competitions of 2027 have no results at
     all, which is exactly why it had to be asked for rather than noticed. */
  const table = useMemo(
    () => leagueTable(league, events, races, results, fieldFor(competitors, league.season, today)),
    [league, events, races, results, competitors, today],
  )

  if (table.rows.length === 0) {
    return <p className="profile__empty">{t('leagues.noResults')}</p>
  }

  return (
    <div className="table-scroll">
      <table className="table league__grid">
        <caption className="visually-hidden">{t('leagues.standing')}</caption>
        <thead>
          <tr>
            {/* The heading of the first column is sticky too, or the names
                stand still while the word above them sails away. */}
            <th scope="col" className="league__who">
              {t('rankings.columns.member')}
            </th>
            <th scope="col" className="league__total">
              {t('rankings.columns.points')}
            </th>
            {table.columns.map((column) => (
              <th scope="col" key={column.raceId} className="league__race">
                {/* The race and the date first, the name of the event after
                    them. A turned heading has to be cut somewhere, and the cut
                    has to fall on the part that repeats: three races of one
                    event on one day gave three columns all reading "BTL trening
                    trek" with the length and the date beyond the edge, which is
                    the one thing that told them apart. The whole of it is in the
                    title for anyone who wants it. */}
                <span
                  className="league__race-name"
                  title={`${column.event}, ${column.race}, ${formatShortDate(column.date, locale)}`}
                >
                  {column.ambiguous
                    ? `${column.event}, ${column.race}, ${formatShortDate(column.date, locale)}`
                    : `${column.race}, ${formatShortDate(column.date, locale)}, ${column.event}`}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.competitor.memberNumber}>
              <th scope="row" className="league__who">
                <CompetitorName competitor={row.competitor} />
              </th>
              <td className="table__points league__total">{formatPoints(row.total, locale)}</td>
              {table.columns.map((column) => {
                const points = row.points.get(column.raceId)

                return (
                  <td key={column.raceId} className="table__points">
                    {points === undefined ? '' : formatPoints(points, locale)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LeagueResults({ league, events }: { league: League; events: BtlEvent[] }) {
  const { t } = useI18n()
  const state = combineResources(useRaces(), useResults(), useCompetitors())

  return (
    <Resource state={state} inline label={t('leagues.standing')}>
      {([races, results, competitors]) => (
        <Grid
          league={league}
          events={events}
          races={races}
          results={results}
          competitors={competitors}
        />
      )}
    </Resource>
  )
}
