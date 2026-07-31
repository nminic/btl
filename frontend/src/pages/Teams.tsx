import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../components/Resource'
import { rankMembers, rankTeams } from '../data/derive'
import type { Competitor, Result, Team } from '../data/types'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'
import { CompetitorName } from '../components/CompetitorName'

/** How many columns the team row has, so the drawer underneath can span them. */
const COLUMNS = 6

/* Who is in the team and what each of them brought to its total.
 *
 * The team standing is a plain sum with no normalisation (PDL P12), so the only
 * honest way to read a team's position is to see whose races add up to it. That
 * is why this opens inside the standing rather than only on the team's own page:
 * the question "why are they ahead of us" is asked while looking at the table.
 */
function MemberContributions({
  team,
  competitors,
  results,
}: {
  team: Team
  competitors: Competitor[]
  results: Result[]
}) {
  const { locale, t } = useI18n()
  const own = competitors.filter((one) => one.teamId === team.id)

  if (own.length === 0) {
    return <p className="rankings__empty">{t('teams.noMembers')}</p>
  }

  const numbers = new Set(own.map((one) => one.memberNumber))
  const rows = rankMembers(
    own,
    results.filter((result) => numbers.has(result.memberNumber)),
  )

  return (
    <div className="contributions__pane">
      <div className="table-scroll">
        <table className="table contributions">
          <caption className="visually-hidden">{t('teams.membersOf', { team: team.name })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('rankings.columns.position')}</th>
              <th scope="col">{t('rankings.columns.member')}</th>
              <th scope="col">{t('rankings.columns.races')}</th>
              <th scope="col">{t('rankings.columns.distance')}</th>
              <th scope="col">{t('rankings.columns.points')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.competitor.memberNumber}>
                <td className="table__position">{row.position}</td>
                <td>
                  <CompetitorName competitor={row.competitor} />
                </td>
                <td>{formatNumber(row.races, locale)}</td>
                <td>{formatNumber(row.kilometers, locale, 2)}</td>
                <td className="table__points">{formatPoints(row.points, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Teams() {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState<string[]>([])
  const state = combineResources(useTeams(), useCompetitors(), useResults())

  const toggle = (id: string) =>
    setOpen((current) =>
      current.includes(id) ? current.filter((one) => one !== id) : [...current, id],
    )

  return (
    <div className="rankings">
      <h1>{t('teams.title')}</h1>

      <Resource state={state}>
        {([teams, competitors, results]) => {
          const rows = rankTeams(teams, competitors, results)

          return (
            <>
              <p className="rankings__note">{t('teams.note')}</p>

              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('rankings.columns.position')}</th>
                      <th scope="col">{t('teams.columns.team')}</th>
                      <th scope="col" className="table__hide-phone">
                        {t('teams.columns.city')}
                      </th>
                      <th scope="col" className="table__hide-phone">
                        {t('teams.columns.members')}
                      </th>
                      <th scope="col">{t('teams.columns.points')}</th>
                      <th scope="col">
                        <span className="visually-hidden">{t('teams.membersColumn')}</span>
                      </th>
                    </tr>
                  </thead>

                  {/* One tbody per team, so the drawer belongs to the row above it
                      rather than floating between rows of other teams. */}
                  {rows.map((row) => {
                    const shown = open.includes(row.team.id)
                    const drawerId = `team-members-${row.team.id}`

                    return (
                      <tbody key={row.team.id}>
                        <tr className={row.position === 1 ? 'podium' : undefined}>
                          {/* The place, not the row number: a tie nothing separates
                              is shared, so the column can read 1, 1, 3 (PDL P12). */}
                          <td className="table__position">{row.position}</td>
                          <td>
                            <Link to={`/${locale}/tim/${row.team.slug}`}>{row.team.name}</Link>
                          </td>
                          <td className="table__hide-phone">{row.team.city}</td>
                          <td className="table__hide-phone">
                            {formatNumber(row.members, locale)}
                          </td>
                          <td className="table__points">
                            {formatPoints(row.totals.points, locale)}
                          </td>
                          <td>
                            {/* One word to read and the whole sentence to hear. The
                                sentence used to be the visible text and it does not
                                wrap, so on a telephone this column alone was 279 of
                                the 661 pixels the table wanted inside a box 328 wide
                                (PDL P24). A screen reader still gets the team it
                                belongs to, because twenty buttons called "Prikaži"
                                are twenty buttons it cannot tell apart. The visible
                                word is the first word of the label, so what is read
                                out contains what is on screen (WCAG 2.2, 2.5.3). */}
                            <button
                              type="button"
                              className="contributions__toggle"
                              aria-expanded={shown}
                              aria-controls={drawerId}
                              aria-label={
                                shown
                                  ? t('teams.hideMembers', { team: row.team.name })
                                  : t('teams.showMembers', { team: row.team.name })
                              }
                              onClick={() => toggle(row.team.id)}
                            >
                              {shown ? t('teams.hide') : t('teams.show')}
                            </button>
                          </td>
                        </tr>

                        {/* The row stays whether the drawer is open or not, so
                            aria-controls always points at an element that exists.
                            What is inside it does not: the drawer filters all 3522
                            results and ranks the members of its team, and with fifty
                            teams a closed drawer meant fifty passes over the whole
                            set on every single click. */}
                        <tr id={drawerId} hidden={!shown}>
                          <td colSpan={COLUMNS} className="contributions__cell">
                            {shown && (
                              <MemberContributions
                                team={row.team}
                                competitors={competitors}
                                results={results}
                              />
                            )}
                          </td>
                        </tr>
                      </tbody>
                    )
                  })}
                </table>
              </div>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
