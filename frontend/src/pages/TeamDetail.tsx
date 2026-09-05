import { categoryLabel } from '../data/categories'
import { Link, useNavigate, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { CategoryDonut } from '../components/CategoryDonut'
import { Resource } from '../components/Resource'
import { SeasonPicker } from '../components/SeasonPicker'
import { offeredSeason, useSeason } from '../components/season'
import { useToday } from '../clock/useClock'
import { Counters } from './home/Counters'
import {
  categoryOfMember,
  countsByCategory,
  inTeamIn,
  rankMembers,
  seasonOf,
  seasonsWithResults,
  totalsOf,
} from '../data/derive'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { podiumClass } from '../components/podium'
import { teamOf } from '../data/derive'
import { inYearlyWindow } from '../data/season'
import { teamAdminOf } from '../data/teamAdmin'
import { useSession } from '../session/useSession'
import { DeleteRecord } from './admin/EntityEditor'
import { MEMBERS, recordsOf, TEAMS } from './admin/entityForms'
import { useOverlay } from './admin/overlay'
import './Profile.css'
import { CompetitorName } from '../components/CompetitorName'

/* A team is the only entity besides a competitor that carries a standing, so
 * its page is built the same way. Three of one width across the top (owner,
 * 31.07.2026): what the team says about itself, the races, the figures. Under
 * them the people who made those figures, ordered by what each contributed.
 *
 * The season is chosen once, beside the name, and it is the running one by
 * default with no "all of them" on offer: a team is a thing of one season, its
 * members change from year to year, and a standing summed over every season
 * would be a list of who has been around longest. */

export function TeamDetail() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const today = useToday()
  const running = today.slice(0, 4)
  const asked = useSeason(running)
  const { memberNumber, remove, editRecord, notify, asked: pendingAsks } = useSession()
  const navigate = useNavigate()
  const overlay = useOverlay()
  const state = combineResources(useTeams(), useCompetitors(), useResults())

  return (
    <Resource state={state}>
      {([teams, competitors, results]) => {
        /* Through the overlay, because a moderator naming another administrator
           writes there and not into the file on the disc; read from the file alone,
           the button stayed with the member they had just replaced (review,
           05.09.2026). The ways into founding a team read the same records for the
           same reason. */
        const listedMembers = recordsOf(MEMBERS, competitors, overlay)
        const team = recordsOf(TEAMS, teams, overlay).find((one) => one.slug === slug)

        if (team === undefined) {
          return <h1>{t('teams.notFound')}</h1>
        }

        /* Everybody in the team today, for the control alone: which seasons
           this team can be asked about must not move when one of them is
           chosen.

           **Off the same list the button above is read from.** Read from the file
           while the button read the session, one screen answered twice about one
           fact: a team approved a minute ago drew „Izmeni" for its founder and „0
           članova" under it, because the founder's team is written into the session
           and nowhere else (review, 05.09.2026). PDL, 05.09.2026: the founder „je od
           tog trenutka prvi i jedini član i vidi se u sastavu tima". */
        /* Whoever is reading, off the same list as everything else on this screen, and
           what they are called, because an application says who is asking. */
        const me = listedMembers.find((one) => one.memberNumber === memberNumber)
        const myName = me === undefined ? '' : `${me.firstName} ${me.lastName}`
        const runs = teamAdminOf(team, listedMembers)
        const everMembers = listedMembers.filter((one) => one.teamId === team.id)
        const everNumbers = new Set(everMembers.map((one) => one.memberNumber))
        /* The seasons this team has anything in, plus the running one, which is
           the default and a control cannot open on an option it does not have.
           Worked out before the choice, because the choice is held against it. */
        const seasons = [
          ...new Set([Number(running), ...seasonsWithResults(results.filter(
            (one) => everNumbers.has(one.memberNumber),
          ))]),
        ].sort((left, right) => right - left)
        const season = offeredSeason(asked, seasons, running)
        /* The roster of the season being read, not of today: a page headed by
           a year has to be that year's team (PDL P13). */
        const members = everMembers.filter((one) => inTeamIn(one, Number(season)))
        const numbers = new Set(members.map((one) => one.memberNumber))
        const inSeason = results.filter((one) => seasonOf(one) === Number(season))
        const mine = inSeason.filter((one) => numbers.has(one.memberNumber))
        const totals = totalsOf(mine)
        /* Places, not row numbers, and the whole ladder rather than points
           alone: two members level on points used to be given 1 and 2 by the
           order they happened to be in, which is the one thing the ladder in
           src/data/derive.ts exists to prevent (PDL P12). */
        const rows = rankMembers(members, mine)

        return (
          <>
            <PageMeta
              title={t('seo.team.recordTitle', { name: team.name, city: team.city })}
              description={t('seo.team.recordDescription', { name: team.name })}
            />

            <div className="profile">
              <header className="profile__head">
                {/* The same row a competitor's profile has, and the same named
                    control (owner, 05.08.2026: one shape everywhere). It carried
                    a row of its own until then and was left without one when the
                    profile moved onto the shared row. */}
                <div className="profile__title rankings--tooled">
                  <h1 className="profile__name">{team.name}</h1>
                  <div className="rankings__head-tool">
                    {/* The way into the team's own data, and only for whoever
                        administers it (owner, 04.09.2026: „na strani tog tima za
                        administratora tima treba da postoje dugmići Izmeni i
                        Obriši"). Who that is is worked out from the roster rather
                        than stored, so it follows a founder who leaves
                        (`data/teamAdmin.ts`).

                        Written against a member number that is really there:
                        `admin` is null for a team nobody is in, and comparing it
                        with a visitor's own null would put the button in front of
                        everybody who is not signed in. */}
                    {/* And the way in, for somebody who has no team to leave. Only inside
                        the transfer window, because that is the one door through which a
                        team changes (owner, 05.09.2026), and only where there is somebody
                        to answer: a team nobody is in has no administrator, so an
                        application to it would be a letter to nobody.

                        Asked once. The application lives as a question in the
                        administrator's inbox, and the member who sent it cannot see that
                        inbox, so without this the same application would be sent again on
                        every press. */}
                    {memberNumber !== null &&
                      runs !== null &&
                      teamOf(me) === null &&
                      inYearlyWindow(today) &&
                      (pendingAsks.some(
                        (one) => one.teamId === team.id && one.memberNumber === memberNumber,
                      ) ? (
                        <p className="rankings__empty">{t('teams.joinAsked')}</p>
                      ) : (
                        <button
                          type="button"
                          className="button button--secondary"
                          onClick={() => {
                            notify({
                              from: t('app.name'),
                              to: runs,
                              subject: t('teams.joinSubject', { name: myName }),
                              body: t('teams.joinBody', { name: myName, team: team.name }),
                              date: today,
                              asks: {
                                kind: 'teamJoin',
                                teamId: team.id,
                                teamName: team.name,
                                memberNumber,
                              },
                            })
                          }}
                        >
                          {t('teams.join')}
                        </button>
                      ))}
                    {memberNumber !== null && runs === memberNumber && (
                      <>
                        <Link
                          className="button button--secondary"
                          to={`/${locale}/tim/${team.slug}/izmena`}
                        >
                          {t('teams.edit')}
                        </Link>
                        {/* Asked twice before it happens, and asked by the portal's one
                            way of asking about something nothing brings back
                            (`DeleteRecord`), dressed as the button beside it. Not a
                            dialog written here: all three of its controls carry the name
                            of what is being deleted, so a reader who arrives at the
                            question „delete what" is answered without going back up the
                            page, and that was got right once already. */}
                        <DeleteRecord
                          name={team.name}
                          look="button button--secondary"
                          onDelete={() => {
                            /* The team goes, and with it its points in the standing:
                               there is no standing without a record, so the owner's „pa
                               se tim briše kao i bodovi iz tabele za tu sezonu" is one
                               act and not two. The frozen seasons are untouched, because
                               nothing here writes a result (PDL, 04.09.2026).

                               And the people in it are left without a team rather than
                               left pointing at one that is gone. Written as an empty
                               string because the session keeps values as text and cannot
                               hold a `null`; `teamOf` is the one reading that knows the
                               two mean the same thing. */
                            for (const one of everMembers) {
                              editRecord(one.memberNumber, { teamId: '' })
                            }

                            remove(TEAMS.id, team.id)
                            void navigate(`/${locale}/timovi`)
                          }}
                        />
                      </>
                    )}
                    <SeasonPicker seasons={seasons} season={season} fallback={running} />
                  </div>
                </div>
                <p className="profile__meta">
                  {team.city}
                  {' · '}
                  {t('units.memberCount', { count: everMembers.length })}
                </p>
                {/* The way back, under the name and not over it. It stood first and the page
                    then began with a link rather than with its own heading, so a reader
                    listing the headings of a page met a control before learning which page
                    they were on (WCAG 2.2, 1.3.1 and 2.4.6; owner, 04.09.2026, who chose to
                    keep it a link rather than dress it as a button: it is a way out, not an
                    action). `EventDetail` has always had its heading first inside this same
                    header, so this is that shape and not a new one. */}
                <p className="profile__meta">
                  <Link to={`/${locale}/timovi`}>{t('teams.backToTeams')}</Link>
                </p>
              </header>

              {/* Three of one width, and the words first, because they are the
                  only part of the row somebody had to write by hand. */}
              <div className="profile__row profile__row--bio">
                <section className="profile__card profile__bio" aria-labelledby="team-about">
                  <h2 className="profile__card-title" id="team-about">
                    {t('teams.about')}
                  </h2>
                  {team.bio === '' ? (
                    <p className="profile__bio-text profile__bio-text--none">
                      {t('teams.aboutEmpty')}
                    </p>
                  ) : (
                    team.bio.split(/\n{2,}/).map((paragraph) => (
                      <p className="profile__bio-text" key={paragraph}>
                        {paragraph}
                      </p>
                    ))
                  )}
                </section>

                <section className="profile__card profile__card--donut">
                  <CategoryDonut counts={countsByCategory(mine)} caption={t('profile.byCategory')} />
                </section>

                <Counters totals={totals} races={false} />
              </div>

              <h2 className="profile__section">{t('teams.members')}</h2>

              {rows.length === 0 ? (
                /* Two different silences: a team nobody has ever joined, and a
                   team that existed but had nobody in it that season. */
                <p className="profile__empty">
                  {t(everMembers.length === 0 ? 'teams.noMembers' : 'teams.noMembersThatSeason')}
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    {/* Named, because the ring above it draws a table of its own
                        for anyone who cannot see the drawing, and two tables on
                        one screen have to be told apart. */}
                    <caption className="visually-hidden">{t('teams.members')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('rankings.columns.position')}</th>
                        <th scope="col">{t('competitors.columns.member')}</th>
                        <th scope="col">{t('competitors.columns.category')}</th>
                        <th scope="col" className="table__hide-phone">
                          {t('competitors.columns.races')}
                        </th>
                        <th scope="col">{t('competitors.columns.points')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.competitor.memberNumber}
                          className={podiumClass(row.position)}
                        >
                          <td className="table__position">{row.position}</td>
                          <td>
                            <CompetitorName competitor={row.competitor} />{' '}
                            <span className="table__member-number">
                              {row.competitor.memberNumber}
                            </span>
                          </td>
                          <td>{categoryLabel(categoryOfMember(row.competitor, Number(season)), t)}</td>
                          <td className="table__hide-phone">{formatNumber(row.races, locale)}</td>
                          <td className="table__points">{formatPoints(row.points, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      }}
    </Resource>
  )
}
