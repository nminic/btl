import { useState } from 'react'
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
  membersOf,
  numbered,
  rankMembers,
  seasonOf,
  seasonsWithResults,
  totalsOf,
} from '../data/derive'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { clearResourceCache } from '../data/client'
import type { Competitor, Team } from '../data/types'
import { askTheServer, type Answer } from './account/askTheServer'
import { ServerSaid } from './account/ServerSaid'
import { standsOnTheServer, WHEN_DELETING_A_TEAM } from './admin/teamWrites'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { podiumClass } from '../components/podium'
import { teamOf } from '../data/derive'
import { inYearlyWindow } from '../data/season'
import { readerAdministers, teamAdminOf } from '../data/teamAdmin'
import { useSession } from '../session/useSession'
import { DeleteRecord } from './admin/EntityEditor'
import { MEMBERS, recordsOf, TEAMS } from './admin/entityForms'
import { recordKey } from '../session/context'
import { useOverlay } from './admin/overlay'
import './Profile.css'
import { CompetitorName } from '../components/CompetitorName'
import { AskingThisTeam } from './AskingThisTeam'
import { TeamQueue } from './TeamQueue'

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
  /* **THE MEMBER'S OWN HALF IS THE SERVER'S SINCE T5 (10.10.2026), AND NOTHING OF IT IS READ
     FROM THE SESSION HERE ANY MORE.** „Prijavi se u tim" and „Povuci prijavu" are drawn off
     `GET /api/me/applications` and sent to `POST` and `DELETE` on the application's own address
     (`AskingThisTeam.tsx`), and the list this team must ANSWER comes off the server through
     `TeamQueue`. Until that day the two buttons wrote into the browser, so one screen held two
     mechanisms for one kind of row: a member who applied saw his own „Povuci prijavu" and the
     team did not see him waiting. */
  const { memberNumber, remove, editRecord } = useSession()
  const navigate = useNavigate()
  const overlay = useOverlay()
  const state = combineResources(useTeams(), useCompetitors(), useResults())

  /** Why a deletion did not happen, for the one person who pressed it. */
  const [refused, setRefused] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  /**
   * THE PAGE THE REFUSAL ABOVE WAS DRAWN ON, which is a team and a season (registry item 311).
   *
   * <p><b>A refusal is about the attempt it answered, and it goes when that attempt stops being
   * the page's.</b> It used to be written when the route said no and never cleared: „Odustani" put
   * the question away and left „Prelazni rok je zatvoren..." beside a button that asked nothing, a
   * change of season in the picker left it too - and so did a move to ANOTHER team's page, because
   * this is the same component with another team in it (`app/routeObjects.tsx` carries no `key` on
   * this route), so the sentence about Vardarski krug was read on Dunavski trkači.
   *
   * <p>Since 02.10.2026 the refusal also closes the question (PDL, „Odbijanje zatvara pitanje kao i
   * uspeh"), so the sentence stands beside the „Obriši" button that asked, with the focus on it, and
   * what takes it away is: the address changing (here), a second attempt starting (`deleteOne`), and
   * the reader who has asked again putting the question away (`onKeep` below).
   *
   * <p><b>Held as the adjusting-state-during-render shape and not as an effect</b>: the sentence
   * is gone in the render that the address changed in, with no frame of the old one drawn over the
   * new page. The other two ends are events and clear it where they happen.
   */
  const here = `${slug}/${asked}`
  const [drawnOn, setDrawnOn] = useState(here)

  if (drawnOn !== here) {
    setDrawnOn(here)
    setRefused(null)
  }

  /**
   * TAKING THE TEAM AWAY, AND SINCE 28.09.2026 THROUGH THE ROUTE RATHER THAN THROUGH THE
   * SESSION.
   *
   * <p>PDL P13b, owner 25.09.2026: „Superadmin i moderator sa pravom nad timovima imaju
   * <b>isto dugme i iste posledice</b> kao administrator tog tima." One act, so one address:
   * `DELETE /api/teams/{id}`, which `admin/AdminTeams.tsx` has sent since 26.09.2026 and this
   * screen sends the same way. Until today it sent nothing at all, and the note that used to
   * stand on `AdminTeams.deleteOne` named both halves of what that cost: the deletion did not
   * outlive the tab, and the window bound the administration alone.
   *
   * <p><b>THE WINDOW IS THE ROUTE'S AND THIS SCREEN DRAWS NO CONDITION OF ITS OWN ABOUT
   * IT.</b> `TeamWriteApi.removing` asks `SeasonClock.transferWindowOpen` and answers 409
   * `theWindowIsShut` outside 1.10-31.12 - owner, 25.09.2026, choosing between three offered
   * outcomes: „Van prozora 1.10-31.12 ruta vraca 409, i to <b>i administratoru tima i
   * administraciji</b>", the outcome refused by name being „rok vazi za clana, ne za
   * administraciju". A condition here would be 1 October with a second home, free to disagree
   * with the route the day either was edited, so the reason the reader is given comes off the
   * ANSWER. The button is therefore offered on every day of the year, exactly as the
   * administration's is.
   *
   * <p><b>AND THE SENTENCE IS THE ADMINISTRATION'S OWN, imported rather than written
   * again.</b> `WHEN_DELETING_A_TEAM` is the one map of this route's one refusal, and the note
   * on it says why `theWindowIsShut` lives under two keys rather than one: what the word means
   * to the reader depends on what he pressed. Pressed here and pressed there it is the same
   * thing being refused - this team is not going anywhere until October - so a second Serbian
   * sentence would be a second place to change and the first to drift.
   *
   * <p><b>WHAT GOES WITH THE TEAM IS THE ROUTE'S, ON THE HALF THE ROUTE OWNS.</b> The
   * memberships cascade (V11), so nothing here writes over anybody's `teamId` and the two
   * caches that carried the old answer are dropped instead. Written the other way round, a
   * refused deletion would empty the roster of a team that is still standing - which is the
   * fault `AdminTeams` removed an `alsoRemove` for on 26.09.2026.
   *
   * <p><b>AND THE OTHER HALF IS STILL THE SESSION'S, WHICH IS A BOUNDARY AND NOT AN
   * OVERSIGHT.</b> A team approved during this visit is filed under an identity
   * `admin/entityForms.ts` counts DOWN from nought, and `PendingQueue.tsx` writes its founder
   * into the session and nowhere else. `DELETE /api/teams/-1` is an address nothing answers
   * to, so that row is deleted where it lives and its roster is taken along by hand -
   * `standsOnTheServer` is the question, and the note on it says what sending the other kind
   * would have cost. There is nothing to be refused on that half, so the ordering that makes
   * `editRecord` wrong beside a route cannot arise there.
   */
  async function deleteOne(team: Team, roster: Competitor[]): Promise<void> {
    if (!standsOnTheServer(team.id)) {
      /* The people in it are left without a team rather than left pointing at one that is
         gone. Written as an empty string because the session keeps values as text and cannot
         hold a `null`; `teamOf` is the one reading that knows the two mean the same thing. */
      for (const one of roster) {
        editRecord(recordKey(MEMBERS.id, one.memberNumber), { teamId: '' })
      }

      remove(TEAMS.id, String(team.id))
      void navigate(`/${locale}/timovi`)

      return
    }

    /* THE OLD SENTENCE GOES WHEN A NEW ATTEMPT STARTS, and not when it is answered: with the
       request out the page says it is sending (`DeleteRecord`), and a refusal about the one before
       it standing over that would be read as the answer to this one. */
    setRefused(null)

    const answer = await askTheServer(`/api/teams/${team.id}`, {}, 'DELETE')

    if (answer.got !== 'done') {
      setRefused(answer)

      return
    }

    /* THE NEXT MOUNT READS THE SERVER, AND FOR BOTH OF THE TWO RESOURCES THIS DELETION MOVED.
       The list this screen leaves for is drawn from the same cache this visit filled, so
       without this the team would still be standing in it. `competitors` beside `teams` is the
       half that is easy to miss: the memberships cascade on the server (V11), and a member's
       team reaches this portal as `Competitor.teamId` off `/api/competitors`, so every screen
       that draws somebody's club would go on drawing a team that is gone.

       AND NOTHING IS WRITTEN INTO THE SESSION BESIDE THEM, WHICH IS A DIFFERENCE FROM
       `admin/AdminTeams.tsx` AND NOT AN OMISSION. That screen adds the deletion to the overlay
       because it STAYS MOUNTED over the very list the row came out of, and a screen that is
       still mounted never asks its resource again. This one leaves, so the next mount reads
       the two answers above and the server is the only thing that decides what is in them. A
       `remove` here would be a second answer to „what does this list show" - the fault
       `AdminLeagues.tsx` names in its own words - and there would be no case able to tell the
       two apart, because the row is gone either way. */
    clearResourceCache('teams')
    clearResourceCache('competitors')

    void navigate(`/${locale}/timovi`)
  }

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
        /* Whoever is reading, off the same list as everything else on this screen. Nothing for a
           visitor, for an account that races for nobody and for a member whose fee has lapsed,
           none of whom `/api/competitors` carries, and that is what `AskingThisTeam.tsx` reads
           as „nothing of the member's own half is drawn, or asked for". */
        const me = listedMembers.find((one) => one.memberNumber === memberNumber)
        /* **TWO QUESTIONS AND TWO ANSWERS SINCE 21.09.2026, because one of them was
           being answered by the other and that was a hole.** „Is there anybody here to
           decide" is a fact about the TEAM and the standing rule answers it for every
           reader; „may I decide" is a permission and a member may only be told it about
           himself (`data/teamAdmin.ts`). Asked as `runs === memberNumber`, a member who
           had founded nothing was handed this team's controls, because the seat he is
           not told about fell through to the standing rule. */
        const runs = teamAdminOf(team, listedMembers)
        const mineToRun = readerAdministers(team, listedMembers, memberNumber)
        /* Off BOTH doors the server names a member of this team on, since 02.10.2026: his
           record, and - for a member who hides his profile, read by somebody who may not read
           it - the team's own
           answer (PDL, odeljak 16: „ako je deo tima, njegovo ime se vidi u timu i bodovi koje je
           doneo"). `membersOf` is the one place the two are put together. */
        const everMembers = membersOf(team, listedMembers)
        const everNumbers = new Set(everMembers.map((one) => one.competitor.memberNumber))
        /* The seasons this team has anything in, plus the running one, which is
           the default and a control cannot open on an option it does not have.
           Worked out before the choice, because the choice is held against it. */
        const seasons = [
          ...new Set([Number(running), ...seasonsWithResults(numbered(results).filter(
            (one) => everNumbers.has(one.memberNumber),
          ))]),
        ].sort((left, right) => right - left)
        const season = offeredSeason(asked, seasons, running)
        /* The roster of the season being read, not of today: a page headed by
           a year has to be that year's team (PDL P13). */
        const members = everMembers
          .filter((one) => inTeamIn(one, Number(season)))
          .map((one) => one.competitor)
        const numbers = new Set(members.map((one) => one.memberNumber))
        const inSeason = results.filter((one) => seasonOf(one) === Number(season))
        const mine = numbered(inSeason).filter((one) => numbers.has(one.memberNumber))
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
                {/* **The way in, and the way back out, both on the team's own page and both on
                    the server** (`AskingThisTeam.tsx`). An application is a record about this
                    team, not a letter to whoever happened to run it when it was sent: who may
                    answer it is worked out from the roster every time it is drawn (review,
                    06.09.2026), and the team reads it in `TeamQueue` below. This hands the page
                    the two buttons for the row of controls and what is said about them for
                    under it, and the page lays both out. */}
                <AskingThisTeam
                  me={me}
                  /* What the member and the team must be for the way in to be offered at all.
                     „Nema tim" is read off the record and not by season (PDL, 05.09.2026, „„Nema
                     tim" se čita sa zapisa (`teamId`), ne po sezoni"); only inside the transfer
                     window, the one door through which a team changes (owner, 05.09.2026); and
                     only where there is somebody to answer, because a team nobody is in has
                     nobody to decide. */
                  mayApply={teamOf(me) === null && runs !== null && inYearlyWindow(today)}
                  team={team.id}
                  standing={(id) => listedTeams.some((each) => each.id === id)}
                  here={here}
                >
                  {({ controls, said }) => (
                    <div className="profile__title rankings--tooled">
                      <h1 className="profile__name">{team.name}</h1>
                      <div className="rankings__head-tool">
                        {controls}
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
                        {mineToRun && (
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
                              /* The team goes, and with it its points in the standing: there is
                                 no standing without a record, so the owner's „pa se tim briše
                                 kao i bodovi iz tabele za tu sezonu" is one act and not two. The
                                 frozen seasons are untouched, because nothing here writes a
                                 result (PDL, 04.09.2026), and since 28.09.2026 none of that is
                                 decided on this screen at all: `deleteOne` sends the act to the
                                 route the administration already sends it to. */
                              onDelete={() => deleteOne(team, everMembers.map((one) => one.competitor))}
                              /* A READER WHO ASKED AGAIN AND THEN PUT THE QUESTION AWAY HAS NO USE
                                 FOR THE LAST ANSWER: nothing beside the button is about a deletion
                                 any more (registry item 311; the same shape
                                 `admin/AdminTeams.tsx#deleteOne` clears it in). */
                              onKeep={() => setRefused(null)}
                            />
                          </>
                        )}
                        <SeasonPicker seasons={seasons} season={season} fallback={running} />
                      </div>
                      {/* WHAT IS SAID ABOUT THE MEMBER'S OWN QUESTION, and WHY A DELETION DID NOT
                          HAPPEN, both under the row they were pressed in and not inside it.
                          `Rankings.css` gives whatever follows the control the whole width of the
                          head („Whatever comes first after the control"); put among the buttons a
                          sentence would be a flex item in the narrow second track of that grid,
                          and one of this length would widen the track and squeeze the name of the
                          team beside it.

                          `ServerSaid` draws the refusal of a deletion as an alert, so the reader
                          hears it as it appears, and the question has closed with the answer: the
                          focus is on „Obriši", the button the sentence stands beside
                          (`DeleteRecord`, owner 02.10.2026). */}
                      {said}
                      {refused !== null && (
                        <ServerSaid answer={refused} refusals={WHEN_DELETING_A_TEAM} />
                      )}
                    </div>
                  )}
                </AskingThisTeam>
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

              {/* **WHAT IS WAITING ON THIS TEAM, AND SINCE 29.09.2026 OFF THE SERVER RATHER
                  THAN OUT OF THE SESSION.** Both lists and both answers were held in
                  `session/SessionProvider.tsx` until today - a copy that dies with the tab -
                  while `GET /api/teams/{id}/applications` and its three write verbs had been
                  answered and called by nobody. `pages/TeamQueue.tsx` is the whole of it now.

                  **Only for whoever leads the team**, which is the permission
                  `data/teamAdmin.ts` answers definitely, and the route answers 404 to
                  everybody else. The sent invitations used to be shown to every member of the
                  team; that narrowing follows the owner's decision of 27.09.2026 that only the
                  administrator sends and takes back a team's invitation.

                  **And no window on either section**, which is where the prototype was wrong
                  against the journal: „Prihvati" traži prelazni rok, „Odbij" ne (PDL,
                  06.09.2026), so the window takes „Primi u tim" away and nothing else. */}
              {mineToRun && <TeamQueue team={team.id} members={listedMembers} today={today} />}

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
                          <td>{categoryLabel(categoryOfMember(row.competitor), t)}</td>
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
