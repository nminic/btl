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
import { WHEN_WRITING_A_PRICE } from '../admin/priceWrites'
import { must } from '../../test/at'

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
/**
 * THE CONSTANTS THESE CLASSES DECLARE THAT ARE NOT REASONS AT ALL, named per file.
 *
 * <p><b>Why this list exists, and it is a measurement of 26.09.2026 rather than a
 * convenience.</b> {@link reasonsIn} reads every `static final String` a class declares,
 * which is the only question a guard on this side of the repo can ask - there is no Java
 * compiler in this run, and „which of these reaches the `Refused` record" would mean
 * following a value through code, the shape `CLAUDE.md` says has no floor. That proxy held
 * for the first six files, whose every such constant is a refusal. `PricingWriteApi`
 * declares two that are not: `A_FEE = "fee"` and `A_REFERRAL = "referral"` are the KINDS of
 * row it treats differently, and V4's `price_row_kind_known` is where they come from.
 *
 * <p><b>The floor under this list is the count beside it and not a second opinion about
 * it.</b> `howMany` is over every constant the file declares, this one included, so a
 * constant added to one of these classes - reason or not - fails the case with the number in
 * the message, and somebody decides once which of the two it is. A list that could grow
 * silently would be the thing this whole file exists to refuse.
 *
 * <p><b>And it is checked to be pulling its weight:</b> a name written here that the file
 * does not declare fails too, so a constant renamed on the server does not leave an
 * exemption standing for a string that no longer exists.
 */
const NOT_A_REASON: Record<string, string[]> = {
  'PricingWriteApi.java': ['fee', 'referral'],
}

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
       answered, and the note on it says why it is not a line in the dictionary above. */
    ['TeamWriteApi.java', [WHEN_PROPOSING_A_TEAM, WHEN_LEAVING_A_TEAM], 6],
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
    /* THE SEVENTH, ADDED 26.09.2026 WITH THE SCREEN THAT MEETS IT. `PricingWriteApi` had
       named five reasons since PR 370 and nothing on this side could read any of them,
       because no screen called the route at all - `grep -rn "api/pricing" frontend/src`
       came back empty.

       EIGHT CONSTANTS AND SIX REASONS since V34 (26.09.2026), which is the first time
       those two numbers differ on this list: see `NOT_A_REASON` above. `theNameIsLonger-
       ThanTheFormAllows` is V34's own sixth, alongside the column it measures the length
       of. Two of the six cannot be reached from the screen today and both are answered
       anyway, for the reason `WHEN_WRITING_A_PRICE` gives: the form is the floor and the
       route decides (PDL P12c), so a request that goes round the screen meets the route
       with nothing in between. */
    ['PricingWriteApi.java', [WHEN_WRITING_A_PRICE], 8],
  ]

  /** What a file declares that really is a refusal, which is every constant bar the ones
   *  named above. */
  function refusalsIn(file: string): string[] {
    const exempt = NOT_A_REASON[file] ?? []

    return reasonsIn(file).filter((one) => !exempt.includes(one))
  }

  it.each(routes)('are all answered on the screen that meets %s', (file, screens, howMany) => {
    /* THE COUNT IS OVER EVERY CONSTANT AND NOT OVER THE REFUSALS, which is what makes
       `NOT_A_REASON` a list with a floor rather than a list: a constant added to one of
       these classes moves this number whether or not it is a reason, so it cannot be
       exempted by accident - only by somebody writing it down. */
    expect(reasonsIn(file), `${file} names no reason at all, so this measures nothing`).toHaveLength(
      howMany,
    )
    expect(
      refusalsIn(file).filter((reason) => !screens.some((screen) => Object.hasOwn(screen, reason))),
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

  /**
   * EVERY EXEMPTION IS LOAD-BEARING, and this is the floor that makes `NOT_A_REASON` a list
   * with a bottom rather than a list.
   *
   * <p><b>Found by a mutation before any review saw it, on 26.09.2026.</b> The first draft of
   * this file held two things about an exemption: that the constant is one the class really
   * declares, and that the count beside it covers every constant whether exempt or not. Both
   * are true and neither is enough - adding a REAL reason to the list
   * (`theFormIsNotComplete`) satisfied the first, moved neither count, and quietly took that
   * reason out of the gate. A screen could then drop its sentence and nothing would say so.
   *
   * <p><b>What is asked instead is what an exemption is FOR.</b> The only constant that needs
   * one is a constant that would otherwise fail the case above: one no screen answers, because
   * it is not a refusal at all. So a name here whose reason IS answered on a screen is an
   * exemption doing nothing, and it is refused - which is exactly the mutation, and it is the
   * whole class of that mutation rather than that one name.
   *
   * <p><b>And it is a question about one lookup, not about following a value.</b> „Does any
   * screen that meets this file claim this name" is read off the dictionaries; it needs no
   * Java parsed and nothing traced from a constant to the place it is answered with, which is
   * the shape `CLAUDE.md` says has no bottom.
   */
  it('excuses only a constant that no screen answers, and none that any screen does', () => {
    for (const [file, exempt] of Object.entries(NOT_A_REASON)) {
      const declared = reasonsIn(file)
      const screens = must(
        routes.find(([named]) => named === file),
        `${file} is excused from a gate it is not on`,
      )[1]

      /* A name left here after the server renamed or dropped it is an exemption standing for
         a string that does not exist, and it would silently excuse the next constant spelt
         the same way. */
      expect(exempt.filter((one) => !declared.includes(one)), `${file}: not declared`).toEqual([])

      /* And the half the mutation found: an exemption for something a screen does answer is
         an exemption that hides a live reason. */
      expect(
        exempt.filter((one) => screens.some((screen) => Object.hasOwn(screen, one))),
        `${file}: answered on a screen, so it is a reason and may not be excused`,
      ).toEqual([])
    }

    /* And that the walk above walked something: an empty table would satisfy every line
       of it. */
    expect(Object.keys(NOT_A_REASON)).not.toEqual([])
  })
})
