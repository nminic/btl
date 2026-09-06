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
import { formatNumber, formatPoints, formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { podiumClass } from '../components/podium'
import { afterJoining } from '../data/afterJoining'
import { teamOf } from '../data/derive'
import { inYearlyWindow, transfersTakeEffect } from '../data/season'
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
  const {
    memberNumber,
    remove,
    editRecord,
    notify,
    applications,
    apply,
    answer,
    invitations,
    close,
  } =
    useSession()
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
        const listedTeams = recordsOf(TEAMS, teams, overlay)
        const team = listedTeams.find((one) => one.slug === slug)

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
        const runs = teamAdminOf(team, listedMembers)
        /* The application this member has open, wherever it is: one at a time, because a
           member is in one team and cannot be waiting on two.

           **On a team that is still there.** A team deleted while the application waited
           left the member waiting on nothing: no way in anywhere else, and no way to end
           it, so they were outside every team on the portal for good (review, 06.09.2026).
           An application about a team that is gone is about nothing, and stops counting. */
        const asking = applications.find(
          (one) =>
            one.memberNumber === memberNumber &&
            listedTeams.some((each) => each.id === one.teamId),
        )
        /* The ones this team can still answer about, worked out before the section is drawn
           rather than inside it: a heading over an empty list announced applications that
           were not there (review, 06.09.2026).

           A member administration has deleted has nothing left to let in, and one who has
           come by a team meanwhile is already somewhere, so taking them would move them out
           of that team without it being asked, which P13 forbids everywhere else. Both stay
           theirs to take back. */
        const waiting = applications.flatMap((ask) => {
          if (ask.teamId !== team.id) {
            return []
          }

          const asked = listedMembers.find((each) => each.memberNumber === ask.memberNumber)

          return asked === undefined || teamOf(asked) !== null ? [] : [{ ask, asked }]
        })
        /* The invitations this team has sent that are still open, with the person each
           one names. One that names somebody the portal no longer has is dropped rather
           than drawn as a blank row, the same way an application is above. */
        const invited = invitations.flatMap((sent) =>
          sent.teamId !== team.id
            ? []
            : /* Walked rather than found, so „the portal no longer has this member" needs
                 no question of its own: nothing matches and no row is drawn.

                 Somebody who now has a team is not an open question either, whichever road
                 they took to it, which is the same test the applications above are filtered
                 by. It is also what keeps an accepted invitation out of this list, since
                 that record stays so the member's own message can name the team that
                 asked. */
              listedMembers
                .filter(
                  (each) => each.memberNumber === sent.memberNumber && teamOf(each) === null,
                )
                .map((asked) => ({ sent, asked })),
        )
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
                    {/* **The way in, and the way it is answered, both on the team's own
                        page.** An application is a record about this team, not a letter to
                        whoever happened to run it when it was sent: who may answer it is
                        worked out here, from the roster, every time it is drawn. Written as
                        a letter it went to a person, and a founder who left went on
                        deciding while the one who really ran the team never saw it (review,
                        06.09.2026).

                        Offered only inside the transfer window, which is the one door
                        through which a team changes (owner, 05.09.2026), and only where
                        there is somebody to answer: a team nobody is in has nobody to
                        decide. */}
                    {memberNumber !== null &&
                      asking === undefined &&
                      runs !== null &&
                      teamOf(me) === null &&
                      inYearlyWindow(today) && (
                        <button
                          type="button"
                          className="button button--secondary"
                          onClick={() => {
                            apply({ teamId: team.id, memberNumber, date: today })
                          }}
                        >
                          {t('teams.join')}
                        </button>
                      )}
                    {/* **And a way to take it back, on its own terms and not on the terms
                        that let it be sent.** Written inside the conditions above, it
                        disappeared the moment any of them changed: the team deleted, a team
                        arrived by another road, the window shut. The application went on
                        existing with nothing that could end it, and the member stayed
                        outside every team on the portal (review, 06.09.2026). Ending what
                        you started may not depend on whether you could start it again.

                        On the team it was sent to and nowhere else: on any other there is
                        simply no way in while it waits, because a member is in one team
                        (PDL P13). */}
                    {asking !== undefined && asking.teamId === team.id && (
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => {
                          answer(asking.id)
                        }}
                      >
                        {t('teams.joinWithdraw')}
                      </button>
                    )}
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

              {/* **What is waiting on this team, for whoever runs it now.** Drawn here and
                  not sent anywhere, so the question follows the team: hand the team to
                  somebody else and the applications go with it, because who may answer is
                  read off the roster every time this page is drawn (owner, 05.09.2026: the
                  application is decided by the administrator of that team).

                  Only inside the window, because the answer writes the season a member runs
                  from and `seasonOnSale` gives the next one only there; outside it the
                  application waits, which is what the window is for. */}
              {memberNumber !== null &&
                runs === memberNumber &&
                inYearlyWindow(today) &&
                waiting.length > 0 && (
                  <>
                    {/* Named by its own heading, because a list of questions about people
                        is a thing a reader arrives at and must be able to leave again
                        (WCAG 2.2, 1.3.1). It also lets a case say „these three and no
                        others" instead of counting every `li` on the page. */}
                    <h2 className="profile__section" id="team-waiting">
                      {t('teams.joinWaiting')}
                    </h2>
                    <ul className="submissions" aria-labelledby="team-waiting">
                      {waiting.map(({ ask, asked }) => (
                        <li key={ask.id} className="submissions__item">
                          <p className="submissions__meta">
                            {asked.firstName} {asked.lastName}
                          </p>
                          {/* And the day they asked, which is the same shape the
                              moderator's queue gives a card (`admin/PendingQueue.tsx`).
                              Until 06.09.2026 the day was written and never read, and a
                              field nobody reads is a field nobody can be wrong about;
                              owner, 06.09.2026, chose to draw it rather than drop it. */}
                          <p className="submissions__meta">
                            {formatShortDate(ask.date, locale)}
                          </p>
                          <p className="member__actions">
                            {/* Both controls carry the name of whoever is being answered
                                about. Two members waiting on one team put two controls
                                with one name on the screen, and a reader who arrives at
                                „Primi u tim" is answered „about whom" by nothing (WCAG 2.2
                                AA, SC 2.4.6; review, 06.09.2026). The same shape
                                `DeleteRecord` keeps a few rows above this one, and for the
                                same reason (`admin.form.deleteNamed`). */}
                            <button
                              type="button"
                              className="button button--secondary"
                              aria-label={t('teams.joinTakenNamed', {
                                name: `${asked.firstName} ${asked.lastName}`,
                              })}
                              onClick={() => {
                                /* What an approval in the moderator's queue writes, because
                                   it is the same fact by another road: the team on the
                                   member's record, and the season they run for it from,
                                   which is the next one (PDL, 05.09.2026). */
                                editRecord(ask.memberNumber, {
                                  teamId: team.id,
                                  teamSince: String(transfersTakeEffect(today)),
                                })
                                answer(ask.id)
                                notify({
                                  from: t('app.name'),
                                  to: ask.memberNumber,
                                  subject: t('teams.joinDoneSubject', { team: team.name }),
                                  body: t('teams.joinDoneBody', { team: team.name }),
                                  date: today,
                                })

                                /* And every team that had invited them stops waiting on a
                                   question that can no longer be answered, and is told so.
                                   The owner's sentence names the road as „ko god da je
                                   poslao poziv", so this door owes the same as the one in
                                   the member's own inbox (PDL, 06.09.2026). Nothing is
                                   kept, because nobody accepted an invitation here. */
                                const after = afterJoining({
                                  member: ask.memberNumber,
                                  joined: team.id,
                                  keep: undefined,
                                  invitations,
                                  teams: listedTeams,
                                  competitors: listedMembers,
                                })

                                for (const id of after.close) {
                                  close(id)
                                }

                                for (const to of after.tell) {
                                  notify({
                                    from: t('app.name'),
                                    to,
                                    subject: t('teams.inviteMissedSubject'),
                                    body: t('teams.inviteMissedBody', {
                                      name: `${asked.firstName} ${asked.lastName}`,
                                      team: team.name,
                                    }),
                                    date: today,
                                  })
                                }
                              }}
                            >
                              {t('teams.joinTaken')}
                            </button>{' '}
                            <button
                              type="button"
                              className="button button--secondary"
                              aria-label={t('teams.joinRefusedNamed', {
                                name: `${asked.firstName} ${asked.lastName}`,
                              })}
                              onClick={() => {
                                answer(ask.id)
                                notify({
                                  from: t('app.name'),
                                  to: ask.memberNumber,
                                  subject: t('teams.joinNoSubject', { team: team.name }),
                                  body: t('teams.joinNoBody', { team: team.name }),
                                  date: today,
                                })
                              }}
                            >
                              {t('teams.joinRefused')}
                            </button>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

              {/* **What this team has asked, so the team does not depend on somebody
                  else's inbox.** The invitation itself lives in the invited member's mail,
                  because that is the one person who decides it and the one place the portal
                  can reach them (PDL, „Gde stoji odluka"). But a team that can see its
                  questions only by asking the person it asked cannot tell a question nobody
                  answered from one never sent, so what is still open is drawn here too.

                  Read rather than answerable: nothing here presses anything, because the
                  answer is not the team's to give. Shown to every member of the team, the
                  same people who may send one. */}
              {memberNumber !== null && everNumbers.has(memberNumber) && invited.length > 0 && (
                <>
                  <h2 className="profile__section" id="team-invited">
                    {t('teams.inviteSent')}
                  </h2>
                  <ul className="submissions" aria-labelledby="team-invited">
                    {invited.map(({ sent, asked }) => (
                      <li key={sent.id} className="submissions__item">
                        <p className="submissions__meta">
                          {asked.firstName} {asked.lastName}
                        </p>
                        <p className="submissions__meta">{formatShortDate(sent.date, locale)}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}

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
