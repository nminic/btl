import { useMemo } from 'react'
import { CompetitorName } from '../../components/CompetitorName'
import { Resource } from '../../components/Resource'
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
  const table = useMemo(
    () => leagueTable(league, events, races, results, competitors),
    [league, events, races, results, competitors],
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
            <th scope="col">{t('rankings.columns.member')}</th>
            <th scope="col" className="league__total">
              {t('rankings.columns.points')}
            </th>
            {table.columns.map((column) => (
              <th scope="col" key={column.raceId} className="league__race">
                {/* The date is what tells two runnings of one event apart, and it
                    is the shortest thing that does. */}
                <span className="league__race-name">
                  {column.event}, {column.race}, {formatShortDate(column.date, locale)}
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
  const state = combineResources(useRaces(), useResults(), useCompetitors())

  return (
    <Resource state={state}>
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
