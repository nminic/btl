import { Link } from 'react-router'
import { useToday } from '../clock/useClock'
import { Resource } from '../components/Resource'
import { SeasonPicker } from '../components/SeasonPicker'
import { offeredSeason, useSeason } from '../components/season'
import { rankTeams, seasonOf, seasonsWithResults } from '../data/derive'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import { mineIn, rowClass } from '../components/mine'
import './Rankings.css'

/**
 * The standing of the teams, for one season.
 *
 * The season is chosen beside the heading and it is the running one by default,
 * with no "all of them" on offer (owner, 31.07.2026): a team is a thing of one
 * season, its members change from year to year, and a standing summed over every
 * season since the league began would be a list of who has been around longest.
 *
 * A row is a team and nothing else. It used to open a drawer with every member
 * and what each of them contributed; that lives on the team's own page now
 * (owner, 31.07.2026), which is where somebody who wants it is going anyway. The
 * drawer also cost more than it looked: it ranked the members of its team out of
 * the whole result set, so a page of fifty closed drawers was fifty passes over
 * everything waiting to happen.
 */
export function Teams() {
  const { locale, t } = useI18n()
  const today = useToday()
  const { memberNumber } = useSession()
  const running = today.slice(0, 4)
  const asked = useSeason(running)
  const state = combineResources(useTeams(), useCompetitors(), useResults())

  return (
    <div className="rankings rankings--tooled">
      <h1>{t('teams.title')}</h1>

      <Resource state={state}>
        {([teams, competitors, results]) => {
          /* The seasons anybody has raced in, and the running one, which is the
             default and a control cannot open on an option it does not have.
             Worked out before the choice, because the choice is held against it. */
          const seasons = [...new Set([Number(running), ...seasonsWithResults(results)])].sort(
            (left, right) => right - left,
          )
          const season = offeredSeason(asked, seasons, running)
          const inSeason = results.filter((one) => seasonOf(one) === Number(season))
          const rows = rankTeams(teams, competitors, inSeason, Number(season))
          /* The team of whoever is reading, so its row is marked (owner,
             05.08.2026). Read off the member rather than held in the session,
             because a member can be moved between teams by a moderator and the
             session would then be marking the row they used to be in. */
          const myTeam = competitors.find((one) => one.memberNumber === memberNumber)?.teamId

          return (
            <>
              <div className="rankings__head-tool">
                {/* A team is put forward by whoever wants to run in it, and
                    decided on by a moderator in the queue that has been waiting
                    for one since it was written (owner, 03.08.2026; PDL P22).
                    Beside the season rather than under the table: it is
                    something to do with this screen, and the foot of a standing
                    of forty is not where anybody looks for it. */}
                {memberNumber !== null && (
                  <Link className="button button--secondary" to={`/${locale}/novi-tim`}>
                    {t('teams.propose')}
                  </Link>
                )}
                <SeasonPicker seasons={seasons} season={season} fallback={running} />
              </div>

              {rows.length === 0 ? (
                <p className="rankings__empty">{t('teams.empty')}</p>
              ) : (
              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('teams.title')}</caption>
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
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.team.id}
                        /* Gold for a lead, not for being first in an empty
                           table: in a season nobody has raced yet every team is
                           level on nothing, and the top row is only the one the
                           sort happened to leave there. */
                        className={rowClass(
                          row.position === 1 && row.totals.points > 0 ? 'podium' : undefined,
                          myTeam === undefined ? undefined : mineIn([row.team.id], myTeam),
                        )}
                      >
                        {/* The place, not the row number: a tie nothing separates
                            is shared, so the column can read 1, 1, 3 (PDL P12). */}
                        <td className="table__position">
                          {row.position}
                          {myTeam === undefined ||
                          mineIn([row.team.id], myTeam) === undefined ? null : (
                            <span className="visually-hidden"> {t('teams.myTeam')}</span>
                          )}
                        </td>
                        <td>
                          <Link to={`/${locale}/tim/${row.team.slug}`}>{row.team.name}</Link>
                        </td>
                        <td className="table__hide-phone">{row.team.city}</td>
                        <td className="table__hide-phone">{formatNumber(row.members, locale)}</td>
                        <td className="table__points">{formatPoints(row.totals.points, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
