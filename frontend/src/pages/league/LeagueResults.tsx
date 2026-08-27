import { useMemo } from 'react'
import { CompetitorName } from '../../components/CompetitorName'
import { Pager } from '../../components/Pager'
import { PER_PAGE, pageFrom } from '../../components/pageOf'
import { Resource } from '../../components/Resource'
import { useToday } from '../../clock/useClock'
import { categoryLabel } from '../../data/categories'
import { fieldFor } from '../../data/derive'
import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'
import { combineResources, useCompetitors, useRaces, useResults } from '../../data/useResource'
import { formatDistance, formatPoints, formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { leagueGroups, leagueTable } from './leagueTable'
import './League.css'
import { useFilterParams } from '../../app/useFilterParams'

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
  const [params] = useFilterParams()
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

  /* Fifty placed to a page (owner, 03.08.2026, PDL P24). A competition has as
     many rows as the league has members and there is no number of members the
     portal would refuse, so this is the side that had to be bounded. The width
     is not bounded and cannot be by paging: forty six races are forty six
     columns whatever this does, so they go on scrolling inside their own box. */
  const page = pageFrom(params.get('strana'), table.rows.length)

  /* Split the way this competition says it ranks, and paged over the split
     rather than beside it.

     Owner, in P15: „Podela na kategorije se podešava na nivou svake Lige.
     RunTrace liga ima podelu samo po polu, bez uzrasnih kategorija." Half of
     that decision was carried: the setting is on the record, on the admin form
     and printed on the list of competitions, and this table read none of it, so
     both settings drew one undivided grid. Measured 27.08.2026: the word
     „category" appeared nowhere in this file.

     The blocks are cut out of one ordered list rather than paged one by one, so
     the page is still fifty rows wherever the boundaries fall. A block that has
     nobody left on this page is not drawn, which is also what keeps a competition
     of five people from showing eight empty tables. */
  const from = (page - 1) * PER_PAGE
  const groups = leagueGroups(league, table.rows)
  let above = 0
  const shown = groups
    .map((group) => {
      const start = above

      above += group.rows.length

      return {
        code: group.code,
        rows: group.rows.slice(Math.max(0, from - start), Math.max(0, from + PER_PAGE - start)),
      }
    })
    .filter((group) => group.rows.length > 0)

  return (
    <>
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
                  {/* The race by what it is known by, which is its length: it
                      has no name of its own (data/types.ts). */}
                  {(() => {
                    const name = formatDistance(column.distanceKm, locale)
                    const day = formatShortDate(column.date, locale)

                    return (
                      <span className="league__race-name" title={`${column.event}, ${name}, ${day}`}>
                        {column.ambiguous
                          ? `${column.event}, ${name}, ${day}`
                          : `${name}, ${day}, ${column.event}`}
                      </span>
                    )
                  })()}
                </th>
              ))}
            </tr>
          </thead>
          {shown.map((group) => (
          <tbody key={group.code}>
            {/* What this block is, said in the table rather than beside it: a
                row of its own, spanning every column, so a screen reader meets
                the name of the group before the people in it rather than after.
                `colgroup` is the scope a heading over a block of columns takes,
                and this heading is over the whole width of one.

                Named by the same string the standing names it by
                (`categoryLabel`), so the two screens never call one group two
                things. It also carries the gender case unchanged, which is what
                a competition ranking by gender alone shows. */}
            <tr className="league__group">
              <th scope="colgroup" colSpan={2 + table.columns.length}>
                {/* The words inside their own box, and it is that box that is
                    pinned rather than the cell around it. The cell spans every
                    column, so it is wider than the screen by design, and pinning
                    the left edge of something wider than the window pins nothing:
                    measured at 360px, the heading travelled from 16 to -384 as
                    soon as the grid was scrolled 400 pixels sideways, which is
                    the name of the block sailing off the left edge while the
                    reader is still inside it. */}
                <span className="league__group-name">{categoryLabel(group.code, t)}</span>
              </th>
            </tr>
            {group.rows.map((row) => (
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
          ))}
        </table>
      </div>

      <Pager page={page} rows={table.rows.length} label={t('pager.leagueStanding')} />
    </>
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
