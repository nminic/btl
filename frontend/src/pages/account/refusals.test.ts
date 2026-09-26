import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  WHEN_CONFIRMING_AN_ADDRESS,
  WHEN_LEAVING_A_TEAM,
  WHEN_PROPOSING_A_TEAM,
  WHEN_RATING_AN_EVENT,
  WHEN_REGISTERING,
  WHEN_SETTING_A_PASSWORD,
} from './refusals'
import {
  WHEN_MODERATING_LEAGUE_RACES,
  WHEN_WRITING_A_LEAGUE,
} from '../admin/leagueWrites'
import { WHEN_DELETING_A_TEAM } from '../admin/teamWrites'

/**
 * EVERY REASON THESE TWO ROUTES CAN NAME HAS A SENTENCE ON THE SCREEN THAT MEETS IT.
 *
 * <p><b>Why a floor at all, when each screen already has a branch for a reason it does
 * not know.</b> That branch prints the reason's own code at the reader, which is
 * honest and is not an answer: somebody who is told `thePasswordHasLeaked` in English
 * has been told nothing he can act on. The branch is there so a screen one release
 * behind its server cannot lie; this is there so it is never one release behind.
 *
 * <p><b>The list is read out of the server rather than remembered.</b> Both routes
 * declare their reasons as constants, which is the whole of what is read here: a
 * fourth reason added to `PasswordResetApi` stops this gate on the day it is written,
 * rather than reaching a reader as a code he cannot read. That is the shape `CLAUDE.md`
 * asks of any list inside a guard - the list is written by hand, and the floor under
 * it is a query over the source of truth, in the same commit.
 *
 * <p><b>Read across the two halves of the repo on purpose.</b> `test/serverConfig.test.ts`
 * already reads `deploy/` and `.env.example` from here for the same reason: the fact
 * being held lives on the other side of a boundary the gate runs over anyway.
 */

/** Where the server's own words live. */
const WEB = join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web')

/**
 * Every reason one route can answer with.
 *
 * A `static final String` and nothing else, so `LOG` and every other constant these
 * classes hold stay out of it without being named.
 *
 * <p><b>The whitespace is `\s*` and not a space, and that is a measurement of 25.09.2026
 * rather than caution.</b> It read ` = ` exactly, so a declaration whose name is long
 * enough to push the value onto the NEXT LINE was invisible to it. `LeagueWriteApi` has
 * one - `THE_SEASON_CANNOT_MOVE_WHILE_RACES_COUNT` wraps at the hundred-column mark - and
 * this gate found it the moment that file was added: it counted ten where the class
 * declares eleven, and reported the eleventh as a reason the screen claimed but no route
 * could answer. Exactly backwards, which is what a guard that reads LINES says about a
 * language that is written in BLOCKS.
 *
 * <p>Left as it was, the guard would have gone on passing for the five files it already
 * read while being blind to any future constant that happened to be named a few letters
 * longer. Nothing about those five moves: their counts are the same three, one, three,
 * six and three, which this file states out loud and would fail on.
 */
function reasonsIn(file: string): string[] {
  const java = readFileSync(join(WEB, file), 'utf-8')

  return [...java.matchAll(/static final String \w+\s*=\s*"([^"]+)";/g)].map((one) => one[1] ?? '')
}

/**
 * A FILE IS READ AGAINST THE SCREENS THAT MEET IT, AND SINCE 24.09.2026 THERE CAN BE MORE
 * THAN ONE.
 *
 * <p>It was one screen per file until `TeamWriteApi` gained a second act: proposing a team
 * and leaving one are two addresses in one class, and the reasons of the two are answered on
 * two different screens. Folded into one dictionary they would still have passed this gate,
 * and a reader of that dictionary would have had to work out which of its names can reach
 * which screen.
 *
 * <p><b>The count is still over the FILE and is what keeps this honest.</b> The union only
 * widens where a reason may be answered; it does not excuse one that is answered nowhere,
 * and a reason added to either route still has to arrive as a red gate with a number in the
 * message.
 */
describe('the reasons the server can name', () => {
  const routes: [file: string, screens: Record<string, string>[], howMany: number][] = [
    /* The counts are here so that a regular expression which stopped matching cannot
       pass as "this route names nothing". Three, one and three are what the files hold
       today; one more is exactly the event this file exists for, and it arrives as a
       red gate with the number in the message. */
    ['PasswordResetApi.java', [WHEN_SETTING_A_PASSWORD], 3],
    ['EmailConfirmationApi.java', [WHEN_CONFIRMING_AN_ADDRESS], 1],
    /* The third route, added 21.09.2026 when the registration screen began to send.
       It is the first one here whose refusals do not all arrive under 400: the taken
       address is a 409. That changes nothing in this file, and the reason it does not
       is the point - the gate is over the NAMES a route declares, and a name is what
       the screen looks a sentence up by, whichever number carried it. */
    ['RegistrationApi.java', [WHEN_REGISTERING], 3],
    /* The fourth and fifth, added 22.09.2026 when ProposeTeam.tsx and RateEvent.tsx
       began to send: two more members' writes that answer 201 rather than 204, which
       is `askTheServer`'s own widening and not a fact this gate has any reason to
       know about - the reasons a route can name are still just names. */
    /* And the sixth reason of the fourth, added 24.09.2026 with DELETE
       /api/teams/{id}/membership: one class, two acts, two screens. The count is the
       file's and went from five to six; `WHEN_LEAVING_A_TEAM` is where the sixth is
       answered, and the note on it says why it is not a line in the dictionary above.

       A THIRD SCREEN ON THE SAME FILE SINCE 26.09.2026, AND THE COUNT DID NOT MOVE. The
       administration's screen of teams now sends `DELETE /api/teams/{id}`, whose one named
       refusal is `theWindowIsShut` - the reason `WHEN_LEAVING_A_TEAM` already carries,
       under a different key, because what the reader has to do about it differs (the note
       on `WHEN_DELETING_A_TEAM` says which and why). So this file declares the same six it
       did yesterday, which is the measurement that matters: the union widened where a
       reason may be ANSWERED and the floor under it did not soften. Three acts of one
       class now, the shape `LeagueWriteApi` has at two.

       AND THE BOUNDARY OF THAT REGISTRATION, MEASURED RATHER THAN ASSUMED, because it is
       not what a reader would guess. Taking `WHEN_DELETING_A_TEAM` back out of this line
       fails NOTHING today: its only reason is `theWindowIsShut`, which
       `WHEN_LEAVING_A_TEAM` also claims, so the first case above is satisfied by the
       sibling whether the third dictionary is named here or not. What the registration
       does buy is the OTHER direction, and that was measured too: a reason added to
       `WHEN_DELETING_A_TEAM` that no route can answer fails the second case, and would
       pass unnoticed if the dictionary were not on this list. So it is registered for the
       direction that has teeth, and the direction that has none is written down here
       instead of being left to look like cover it does not give. */
    ['TeamWriteApi.java',
      [WHEN_PROPOSING_A_TEAM, WHEN_LEAVING_A_TEAM, WHEN_DELETING_A_TEAM], 6],
    ['CommentWriteApi.java', [WHEN_RATING_AN_EVENT], 3],
    /* THE SIXTH, ADDED 25.09.2026, AND IT IS THE FIRST THAT WAS OWED RATHER THAN NEW.
       `LeagueWriteApi` has named eleven reasons since B40 and six of them have been drawn
       on the screen since 24.09.2026 - with no floor under the list, so the panel that
       draws them could have gone a release behind its server and nothing would have said
       so. What made this owed rather than optional is the rule `CLAUDE.md` states: a list
       inside a guard is written by hand and the floor under it is a query over the source
       of truth, in the same commit. The other half of the eleven arrived in this very
       commit, which is the commit that has to carry the floor for all of them.

       TWO SCREENS AND ELEVEN NAMES, WHICH IS THE SHAPE `TeamWriteApi` ALREADY HAS. Four
       routes of one class fall into two acts that no screen meets both of: making,
       changing and deleting the record (`admin/AdminLeagues.tsx`, and the terms and
       prizes on `pages/Leagues.tsx`), and putting races into it or taking them out
       (`admin/LeagueRaceModeration.tsx`). `theSeasonIsFrozen` is in both tables under two
       different dictionary keys, because what the reader has to do about it differs, and
       the union is what this gate counts. */
    ['LeagueWriteApi.java', [WHEN_WRITING_A_LEAGUE, WHEN_MODERATING_LEAGUE_RACES], 11],
  ]

  it.each(routes)('are all answered on the screen that meets %s', (file, screens, howMany) => {
    const reasons = reasonsIn(file)

    expect(reasons, `${file} names no reason at all, so this measures nothing`).toHaveLength(
      howMany,
    )
    expect(
      reasons.filter((reason) => !screens.some((screen) => Object.hasOwn(screen, reason))),
    ).toEqual([])
  })

  it('and the screens claim no reason their route cannot answer', () => {
    /* The other direction, and it is not decoration: a key left behind by a reason the
       server dropped is a sentence in the dictionary that nothing can ever draw, and
       the next reader has no way to tell it from one that is live. */
    const known = new Set(routes.flatMap(([file]) => reasonsIn(file)))
    const claimed = routes.flatMap(([, screens]) => screens.flatMap((one) => Object.keys(one)))

    expect(claimed.filter((reason) => !known.has(reason))).toEqual([])
  })
})
