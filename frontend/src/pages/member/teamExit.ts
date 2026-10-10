import { clearResourceCache } from '../../data/client'
import { askTheServer, type Answer } from '../account/askTheServer'

/**
 * A MEMBER LEAVING HIS TEAM, WHICH IS THE ROUTE'S ONLY CALLER ON THIS SIDE.
 *
 * <p>`DELETE /api/teams/{id}/membership` (`TeamWriteApi.leave`) has existed since
 * 24.09.2026 and until this module NOTHING on the portal sent it: measured rather than
 * assumed, `grep -rn "membership" frontend/src` found the address in prose and in
 * `account/refusals.test.ts` and in no caller at all. The dictionary of its one refusal
 * (`account/refusals.ts`, `WHEN_LEAVING_A_TEAM`) was written the same day, against the
 * screen that had not been built yet.
 *
 * <p><b>A module of its own rather than a function inside the screen</b>, which is
 * `member/teamWrites.ts`'s own shape and its own reason: `askTheServer` lives under
 * `pages/account` and `data/` imports from `pages/` nowhere in this repo, so the one place
 * that may hold both this write and the caches it invalidates is a module on this side of
 * that line. `react/only-export-components` asks for the same thing from the other
 * direction, and `Membership.tsx` is a component file.
 *
 * <p><b>A `.ts` and never a `.tsx`</b>, for the reason `admin/teamWrites.ts` gives: a table
 * of addresses is data rather than words on a screen.
 *
 * <p><b>THIS MODULE SENDS ONE VERB AND ONE ONLY, AND THAT IS A BOUNDARY RATHER THAN A STAGE
 * OF THE WORK.</b> Leaving is the one thing a member does to his own membership from this
 * screen. Getting into a team is asked elsewhere since T5 (10.10.2026) - on the team's own page
 * (`pages/joiningThisTeam.ts`), and in the inbox for an invitation (`member/teamWrites.ts`) -
 * and is never his alone to decide, so the sentence beside the button (`membership.askToJoin`)
 * says where it is asked, and the question before he leaves (`membership.leaveTeamAsk`) says
 * that coming back needs the team.
 */

/**
 * WHERE THE LEAVING GOES, AND IT TAKES THE TEAM RATHER THAN THE MEMBER.
 *
 * <p><b>Who is leaving comes off the session and is never in the address</b>, which is the
 * route's own decision rather than a spelling: „the thing being removed is named, and who
 * is removing it comes off the session" (`TeamWriteApi.leave`, which took the shape from
 * `/api/verification/{id}/hold`). A member number written here would be an address one
 * member could aim at another.
 *
 * <p><b>And it is NOT `/api/teams/{id}`</b>, which is the other act of the same class and
 * takes the team away entirely (`admin/teamWrites.ts`). The route's own heading calls that
 * distinction „a decision and not a spelling": a member leaving is not a team being
 * deleted, and written at the bare address the two would have had to be told apart by who
 * was asking.
 *
 * @param team `team.id`, which is the key `GET /api/teams` answers with and the key the
 *             session carries as `myTeamId`
 */
export function theExitGoesTo(team: number): string {
  return `/api/teams/${String(team)}/membership`
}

/**
 * Leaves the team, and says what came back.
 *
 * <p><b>THE CACHES ARE DROPPED ONLY WHERE THE SERVER AGREED</b>, which is
 * `member/teamWrites.ts`'s rule in its own words: a portal that dropped them on the asking
 * would draw a member out of a team that still holds him. A refusal leaves everything
 * exactly as the server last said it was.
 *
 * <p><b>TWO RESOURCES, AND THE SECOND IS THE ONE THAT IS EASY TO MISS.</b>
 *
 * <ul>
 * <li><b>`teams`</b>, because this write can change that list in two ways and one of them
 * REMOVES A ROW: `TeamWriteApi.leaving` ends on `emptyTeams.goIfEmpty`, so a member who was
 * the last of his team takes the team with him (PDL P13a, owner 25.09.2026: „I tim (ako
 * nema više ni jednog člana) i par (ako nema bar jednog člana) nestaju sa spiska"). The
 * other way is quieter and is still this list: the same method runs
 * `update team set admin_id = null where id = ? and admin_id = ?`, so a departing
 * administrator empties the seat, and `organizer_member_number` is read off `t.admin_id` in
 * the very query that answers this resource (`TeamApi`).
 * <li><b>`competitors`</b>, because a member's team reaches this portal as
 * `Competitor.teamId` off `/api/competitors`, and that field is answered by the IDENTICAL
 * clause this write moves - `left join team_membership m ... and m.season_to is null`
 * (`CompetitorApi`, and `MeApi` says in as many words that the clause is „`CompetitorApi`'s
 * word for word so that the portal answers one thing rather than two"). Left alone, every
 * screen that draws somebody's club would go on drawing the team he has left.
 * </ul>
 *
 * <p><b>AND THE SESSION IS NOT DROPPED HERE, WHICH IS A BOUNDARY AND NOT AN OMISSION.</b>
 * The fact this screen actually draws is `myTeamId`, and it is not a resource at all: it
 * comes off `GET /api/me` through `session/SessionProvider.tsx`, whose only writer is
 * `theServerSignedMeIn`. That is React state behind a hook, so it can only be written from
 * a component, and `member/Membership.tsx` does it there - the same two steps
 * `member/SignIn.tsx` already takes, and for the same reason: this route answers 204 and
 * therefore answers NOTHING, so what stands afterwards has to be asked for rather than
 * worked out here.
 *
 * <p><b>Why asking again rather than writing `null` into the session by hand.</b> Both
 * branches of the route do leave `myTeamId` empty - the membership that has begun is closed
 * with `season_to` and the one that has not is deleted, and `/api/me` answers the team of
 * the membership `where m.season_to is null` either way - so a screen that assumed it would
 * be right today. It would be right by ACCIDENT: no case could tell a screen that read the
 * server from one that guessed, because the two agree. The server is the one home for it
 * (`member/useMyCategory.ts`: „WHAT STANDS AFTERWARDS IS WHAT THE ROUTE ANSWERED, not what
 * was sent"), and the day that answer changes the screen moves with it for free.
 *
 * @param team which team is being left, off the session's `myTeamId`
 */
export async function theServerWasToldILeft(team: number): Promise<Answer> {
  const answer = await askTheServer(theExitGoesTo(team), {}, 'DELETE')

  if (answer.got === 'done') {
    clearResourceCache('teams')
    clearResourceCache('competitors')
  }

  return answer
}
