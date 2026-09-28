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
  WHEN_WRITING_TO_A_MEMBER,
} from './refusals'
import {
  WHEN_MODERATING_LEAGUE_RACES,
  WHEN_WRITING_A_LEAGUE,
} from '../admin/leagueWrites'
import { WHEN_WRITING_A_PRICE } from '../admin/priceWrites'
import { must } from '../../test/at'
import { WHEN_WRITING_A_MODERATOR } from '../admin/moderatorWrites'
import { WHEN_ACTIVATING, WHEN_BOOKING_A_PAYMENT } from '../admin/activation'
import { WHEN_DELETING_A_TEAM } from '../admin/teamWrites'
import { WHEN_SENDING_A_PICTURE } from '../member/photoWrites'
import { WHEN_DELETING_A_MEMBER } from '../admin/memberWrites'
import { WHEN_ANSWERING_A_PAIR_INVITE } from '../member/pairWrites'
import { WHEN_ANSWERING_A_TEAM_INVITE } from '../member/teamWrites'

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
  /* `MePhotoApi` declared one of these on 26.09.2026 and gained two more on 27.09.2026
     with `mine`, the GET this class did not use to have (PDL 21a/21b):
     `THE_PROFILES_TAB = "profiles"` is the NAME OF A QUEUE, the one PDL P28a calls
     „Profili", and it is the value the route writes into `verification.queue` and reads
     back by. `A_PUBLISHED_PICTURE_IS_ASKED_FOR_AT = "/api/photos/"` and
     `MY_WAITING_PICTURE_IS_ASKED_FOR_AT = "/api/me/photo/"` are the two prefixes `mine`
     builds a picture's address out of, never a reason a send was turned away. None of the
     three is a refusal and no screen answers any of them, which is what the third case
     below checks about every name on this list. */
  'MePhotoApi.java': ['profiles', '/api/photos/', '/api/me/photo/'],
  /* `CompetitorWriteApi` declares five that are not refusals either, and they fall into two
     kinds. `delete` and `anonymise` are the two words the DELETE's `account` parameter may
     carry (PDL P23, 14.09.2026), so they are what a request SAYS rather than why one was
     turned away - the same kind of constant as `PricingWriteApi`'s two. `<Obrisani član>`,
     `<Obrisana članica>` and `M` are what stands where a deleted member's name stood, and
     the letter the route reads his gender off to choose between the first two. */
  'CompetitorWriteApi.java': ['delete', 'anonymise', '<Obrisani član>', '<Obrisana članica>', 'M'],
  /* THE TWO WORDS `membership.basis` SPELLS, and they are the schema's vocabulary rather than
     anything the route refuses. `MembershipWriteApi` turns the ground a moderator pressed into
     one of them and writes it to the column; `membership_basis_known` (V38) is what decides the
     set, and `MembershipConstraintsTest` reads it out of `pg_constraint` rather than believing a
     copy. Same kind of constant as `PricingWriteApi`'s two above. */
  'MembershipWriteApi.java': ['feeExempt', 'balance'],
  /* `PairWriteApi` declares three that are not refusals, and none of them is a new KIND: a
     subject line, a sender's name and a letter, the same three shapes `CompetitorWriteApi` and
     `MePhotoApi` already hold above. `THE_PAIR_IS_BROKEN` is what the other half reads in his
     inbox when a pair ends (`pair.brokenSubject` in `i18n/sr.json`); `THE_LEAGUE` is who the
     portal says it is when it writes to a member itself, the owner's choice of 19.09.2026
     between three offered answers; `MAN` is the letter `competitor.gender` carries for a man,
     the same value `CompetitorWriteApi`'s own `M` already excuses above, read here off a
     different class for a different reason. None of the three is answered by asking a
     question and none is refused by anybody: the class writes them rather than replies with
     them. */
  'PairWriteApi.java': ['Trkački par je raskinut', 'Balkanska trkačka liga', 'M'],
  /* `TeamJoiningWriteApi` declares one that is not a refusal, and it is a shape this table
     already holds twice: a SUBJECT LINE, the one a team's administrator reads when the man
     he asked has joined somewhere else (`teams.inviteMissedSubject` in `i18n/sr.json`). It
     is the same kind of constant as `PairWriteApi`'s `THE_PAIR_IS_BROKEN` above, and it is
     the whole of that class's Serbian that is a constant rather than a method: the other
     seven sentences take a value, so they are `static String` METHODS and this pattern does
     not see them at all. `THE_LEAGUE` is not here either, and not because it is excused -
     it is `private static final String THE_LEAGUE = PairWriteApi.THE_LEAGUE`, a name rather
     than a literal, so the pattern above never matched it and the count of six says so. */
  'TeamJoiningWriteApi.java': ['Poziv u tim je ostao bez odgovora'],
}

/**
 * REASONS A FILE REALLY NAMES THAT NO SCREEN ANSWERS YET, BECAUSE THE SCREEN THAT WOULD MEET
 * THEM HAS NOT BEEN WRITTEN.
 *
 * <p><b>A different thing from {@link NOT_A_REASON}, and kept apart on purpose.</b> That one
 * says „this constant is not a refusal at all". This one says „it is a refusal, it is real,
 * and the act it belongs to has no screen" - which is a statement about the calendar rather
 * than about the constant, and it has to expire.
 *
 * <p><b>Why it exists at all, measured on 26.09.2026.</b> This gate is over the FILE, which
 * is what keeps it honest, and `CompetitorWriteApi` is the first file here with two acts of
 * which only ONE has a screen: `DELETE /api/competitors/{memberNumber}` is sent by
 * `admin/AdminMembers.tsx` and its three reasons are answered, while
 * `POST /api/competitors` is the group entry that sends invitations (PDL P8b, 25.09.2026)
 * and has no screen anywhere in `frontend/src`. The three alternatives were all worse:
 * leaving the file off this list gives the three live reasons no floor at all; writing six
 * sentences for a screen that does not exist invents a user interface for another
 * increment; and filing them under `NOT_A_REASON` would be a plain lie about what they are.
 *
 * <p><b>The floor under it is the case below, and it has teeth in both directions.</b> A
 * name here the file does not declare fails, so a reason renamed on the server does not
 * leave a standing excuse. And a name here that a screen DOES answer fails too, which is
 * what makes this list expire by itself: the day the group entry screen names its six in a
 * dictionary, this entry has to shrink or the gate goes red.
 */
const NOT_YET_ON_ANY_SCREEN: Record<string, string[]> = {
  'CompetitorWriteApi.java': [
    'theGroupIsEmpty',
    'theGroupIsTooBig',
    'theAddressIsTwiceInTheGroup',
    'theFormIsNotComplete',
    'theAddressIsNotShaped',
    'theAddressIsTaken',
  ],
  /* `PairWriteApi` names two more this way, both `POST /api/pairs`'s: `aQuestionAlreadyStands`
     and `aPairAlreadyHolds`. Measured rather than assumed: `grep -rn "api/pairs" frontend/src`
     finds every occurrence of the address in the repo, and none of them is a caller of this
     route - the tests that touch it stand up a fake `GET` for the public list, and
     `profile/InviteToPair.tsx`, the screen `PairWriteApi`'s own javadoc names as „the portal's
     own half of it", writes its question into `useSession().invitePair` rather than asking the
     server at all. The day that screen calls the route for real, these two move into a
     dictionary and this entry shrinks to nothing, the same way `CompetitorWriteApi`'s six above
     are waiting to. */
  'PairWriteApi.java': ['aQuestionAlreadyStands', 'aPairAlreadyHolds'],
  /* `TeamJoiningWriteApi` names two this way, and they belong to the two POST routes of that
     class rather than to the PUT the screen sends. `aQuestionAlreadyStands` is
     `POST /api/teams/{id}/applications`'s („Prijava ne može da se umnoži", PDL 06.09.2026)
     and `heHasAlreadyBeenAsked` is `POST /api/teams/{id}/invitations`'s („Isti tim ne poziva
     istog čoveka dvaput"). Measured rather than assumed: `grep -rn "api/teams" frontend/src`
     answers 65 times and not one of them sends either address - the only two places those
     paths are written at all are prose, in `data/useResource.ts` and in
     `member/inboxFromTheServer.test.tsx`, and both name the PUT. The day a screen asks to
     join a team or sends an invitation, these two move into a dictionary and this entry
     shrinks, the same way `CompetitorWriteApi`'s six above are waiting to. */
  'TeamJoiningWriteApi.java': ['aQuestionAlreadyStands', 'heHasAlreadyBeenAsked'],
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
       with nothing in between.

       NINE CONSTANTS AND SEVEN REASONS since V40 (27.09.2026).
       `theRowIsFreeInOneCurrencyOnly` is PDL 20b: a row is free in both currencies or
       priced in both. It is the one reason on this list the FORM cannot turn back, which
       is why it is worth saying twice - nought is a perfectly good number in both amount
       boxes, so no `min` or `max` on either of them can ask whether the two agree. */
    ['PricingWriteApi.java', [WHEN_WRITING_A_PRICE], 9],
    /* THE SEVENTH, ADDED WITH B106: making a moderator, ticking his boxes and taking his
       moderatorship away are one class and one screen (`admin/AdminModerators.tsx`), so
       one dictionary covers all four reasons the class declares. */
    ['ModeratorWriteApi.java', [WHEN_WRITING_A_MODERATOR], 4],
    /* THE NINTH, ADDED 26.09.2026 WITH B108, AND IT IS THE FIRST ON THIS LIST WHOSE ROUTE
       TAKES A FILE. `MePhotoApi` had named its five since the day it was written and
       nothing on this side could read any of them, because no screen called the route at
       all: `grep -rn "me/photo" frontend/src` came back empty, tests included.

       SEVEN CONSTANTS AND FOUR REASONS SINCE 27.09.2026, and both numbers moved for
       different reasons at once. `aPictureAlreadyWaits` left the class: PDL 21c has a
       second send overwrite the row that waits rather than being refused for it, so the
       route lost a reason instead of renaming one. `mine` arrived beside it, the GET this
       class did not use to have (PDL 21a/21b), and it declares no reason of its own but
       two address prefixes the screen never had to answer for either; `NOT_A_REASON`
       above says which three constants are not reasons now and why. The three routes of
       the class are one act as far as this gate goes, because neither `GET /api/me/photo`
       nor `DELETE /api/me/photo` names a refusal at all - both answer 200 or an empty 404
       - so the one dictionary the screen hands in still covers everything the file can
       say. */
    ['MePhotoApi.java', [WHEN_SENDING_A_PICTURE], 7],
    /* THE EIGHTH, ADDED 26.09.2026 WITH THE SCREEN THAT MEETS HALF OF IT. `CompetitorWriteApi`
       declares fourteen constants, which is the largest number on this list and the first
       where all three categories appear at once: five that are not refusals
       (`NOT_A_REASON`), six that are refusals of an act with no screen yet
       (`NOT_YET_ON_ANY_SCREEN`), and the three the administration's screen of members
       answers.

       AND THE THREE IT ANSWERS ARE WHOLE SERBIAN SENTENCES RATHER THAN CODES, which changes
       nothing here and is worth saying because it looks like it should. This gate is over
       the NAMES a route declares and over whether a screen claims each one; what those
       names LOOK like is not its question. `WHEN_DELETING_A_MEMBER` explains why the server
       answers prose here where every other route answers a code, and why the screen maps it
       rather than letting `ServerSaid` print it. */
    ['CompetitorWriteApi.java', [WHEN_DELETING_A_MEMBER], 14],
    /* THE TENTH, ADDED 28.09.2026 WITH THE SCREEN THAT ACTIVATES A MEMBERSHIP. Nine constants
       and SEVEN reasons, which is the third file on this list where those two numbers differ;
       `NOT_A_REASON` above says which two are not refusals and why. The payments screen answers
       all seven.

       THE SCREEN CANNOT REACH ALL SEVEN AND ANSWERS THEM ANYWAY, which is the arrangement
       `WHEN_WRITING_A_PRICE` already keeps and gives the reason for: the screen is the floor and
       the route decides. One of the seven it could not predict even in principle -
       `nothingWouldComeOffTheBalance`, which the server settles on the PAIR of currencies while
       the screen is served one - and that is set out on `admin/activation.ts`. */
    ['MembershipWriteApi.java', [WHEN_ACTIVATING], 9],
    /* THE ELEVENTH, ADDED 28.09.2026, AND IT IS HERE BECAUSE OF WHAT HAPPENED WITHOUT IT.
       `admin/activation.ts` carried two sentences saying `POST /api/payments` takes no amount and
       spends the balance by what a QR code promised. Both were true when written and both were
       overturned by `V42`; the contradiction arrived by a MERGE, so neither parent disagreed with
       itself and no round of review on either could see it. It was found by reading, which is the
       one thing that does not scale.

       WHAT THIS WOULD HAVE DONE INSTEAD: `theAmountIsNotMoney`, `theAmountIsNotKeptExactly`,
       `theMethodIsNotKnown`, `theReferenceIsNotShaped` and `theReferenceIsTaken` are five reasons
       this class declares that no screen answered, so the merge that brought them in would have
       gone red with the number in the message on the day it happened.

       TEN CONSTANTS AND TEN REASONS, which is the first file on this list where those two
       numbers agree, so it needs no entry in either table above. `METHODS` is a `Set<String>` and
       `A_REFERENCE` a `Pattern`, so neither is a `static final String` and neither has to be
       excused - the count is the floor that says so, and it moves if either ever becomes one.

       THE TENTH IS `theMembershipCostsNothing`, ADDED 28.09.2026, and it arrived through exactly
       the door this entry was written for. It is a BACKEND refusal, added by a branch that had no
       business on any screen - a price list free in both currencies is legal (PDL 20b) while
       `payment_amount_positive` (V16) will not take a payment of nought - and the screen would
       have gone on knowing nine names while the route could say ten. Section 21 of the project's
       own rules is the same shape the other way round: a backend branch DELETING a constant broke
       this very gate from the far side.

       AND FOUR OF THE TEN POINT AT THE SENTENCES `WHEN_ACTIVATING` ALREADY USES, which this gate
       is indifferent to and `activation.ts` gives the reason for: a refusal means the same thing
       whichever door refused it, and a second Serbian sentence for it would be a second place to
       change. What this gate asks is that every name be answered, not that every name have a
       sentence of its own. */
    ['PaymentApi.java', [WHEN_BOOKING_A_PAYMENT], 10],
    /* ADDED 28.09.2026 WITH THE SCREEN THAT ANSWERS A SERVED INVITATION INTO A RACING PAIR.
       Seven constants, and the count splits three ways: three are not refusals at all
       (`NOT_A_REASON` above), two are real refusals of the act that ASKS rather than answers
       and have no screen yet (`NOT_YET_ON_ANY_SCREEN` above), and the remaining two are the
       whole of what `PUT /api/pairs/{id}` can actually name - `theFormIsNotComplete` for a
       body naming neither „Prihvati" nor „Odbij", `thePairWouldNotBeMixed` for the two turning
       out to be the same sex by the time the answer is read again. Both read straight off
       `PairWriteApi.answer` and `settle`; `A_QUESTION_ALREADY_STANDS` and `A_PAIR_ALREADY_HOLDS`
       are `ask`'s, eleven lines above `settle` in the same file, and this route never reaches
       them. `member/pairWrites.ts`'s own comment on `WHEN_ANSWERING_A_PAIR_INVITE` names this
       same split and says why the other five are not here; this entry is that decision taken. */
    ['PairWriteApi.java', [WHEN_ANSWERING_A_PAIR_INVITE], 7],
    /* ADDED 28.09.2026 WITH THE SCREEN THAT ANSWERS A SERVED INVITATION INTO A TEAM, and it
       is this list's twin of the line above it in every way but one. Six constants splitting
       three ways: one is not a refusal at all (a subject line, `NOT_A_REASON`), two are real
       refusals of the two POST routes of the same class and no screen sends either
       (`NOT_YET_ON_ANY_SCREEN`), and the remaining three are the whole of what
       `PUT /api/teams/{id}/invitations/{invitation}` can name - `theFormIsNotComplete`,
       `theWindowIsShut` and `heIsAlreadyInATeam`, all three read straight off
       `TeamJoiningWriteApi.answer` and `answering`.

       AND THE ONE WAY IT IS NOT A TWIN: TWO OF ITS THREE POINT AT SENTENCES THE SCREEN ALSO
       DRAWS BEFORE ANYTHING IS SENT. `theWindowIsShut` is `teams.inviteWaits` and
       `heIsAlreadyInATeam` is `teams.inviteOvertakenUnnamed`, and both of those stand where
       „Prihvati" would have been, decided from `GET /api/me/applications` at the moment of
       drawing (PDL, 06.09.2026: „pravo na odgovor se računa u trenutku iscrtavanja"). The
       same two facts are therefore answered twice over, once by each door, because either
       can change between the drawing and the press. This gate is indifferent to that and
       `member/teamWrites.ts` gives the reason it is right: a refusal means the same thing
       whichever door refused it, which is the arrangement `WHEN_ACTIVATING` and
       `WHEN_BOOKING_A_PAYMENT` already share four sentences by. What is asked here is that
       every name be answered, not that every name have a sentence of its own. */
    ['TeamJoiningWriteApi.java', [WHEN_ANSWERING_A_TEAM_INVITE], 6],
    /* ADDED 28.09.2026 WITH THE SCREEN THAT WRITES ONE MEMBER'S NOTE TO ANOTHER,
       `event/GoingToEvent.tsx`. Two constants, both real refusals of
       `POST /api/inbox`, and neither exempt: there is nothing in this class that is
       not a reason.

       AND IT IS THE FIRST ENTRY HERE WHOSE TWO NAMES BOTH GET A SENTENCE OF THEIR
       OWN, which the four lines above it deliberately do not. `WHEN_WRITING_TO_A_MEMBER`
       carries the measurement: the route's `theFormIsNotComplete` answers a blank
       ADDRESSEE or a blank TITLE and never a blank text, so the sentence the screen
       already draws for an empty box („Napiši poruku...") would be the nearest one
       rather than the true one. What this gate asks is unchanged either way - that
       every name be answered - and the choice between borrowing a sentence and
       writing one is the screen's, not this file's. */
    ['InboxWriteApi.java', [WHEN_WRITING_TO_A_MEMBER], 2],
  ]

  /** What a file declares that really is a refusal AND has a screen today, which is every
   *  constant bar the ones named in the two tables above. */
  function refusalsIn(file: string): string[] {
    const exempt = [...(NOT_A_REASON[file] ?? []), ...(NOT_YET_ON_ANY_SCREEN[file] ?? [])]

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

  /**
   * AND THE SAME FLOOR UNDER THE OTHER TABLE, which is the one that has to expire.
   *
   * <p>The second expectation is the whole point of it. A reason waiting here for a screen
   * that does not exist is honest; the same reason still waiting once a screen DOES answer
   * it is an excuse standing over a live sentence, and nothing else would notice, because
   * `refusalsIn` filters it out before the gate above ever sees it. So the day the group
   * entry screen names its six in a dictionary, this fails and somebody deletes the entry.
   */
  it('excuses only a reason no screen answers yet, and lets none of them outlive its screen', () => {
    for (const [file, waiting] of Object.entries(NOT_YET_ON_ANY_SCREEN)) {
      const declared = reasonsIn(file)
      const screens = must(
        routes.find(([named]) => named === file),
        `${file} is excused from a gate it is not on`,
      )[1]

      expect(waiting.filter((one) => !declared.includes(one)), `${file}: not declared`).toEqual([])

      expect(
        waiting.filter((one) => screens.some((screen) => Object.hasOwn(screen, one))),
        `${file}: a screen answers this now, so it may no longer wait for one`,
      ).toEqual([])
    }

    /* The two tables say different things about the same kind of constant, so a name in
       both is one of them being wrong and there is no telling which. */
    for (const [file, waiting] of Object.entries(NOT_YET_ON_ANY_SCREEN)) {
      expect(
        waiting.filter((one) => (NOT_A_REASON[file] ?? []).includes(one)),
        `${file}: called both "not a reason" and "a reason with no screen"`,
      ).toEqual([])
    }

    expect(Object.keys(NOT_YET_ON_ANY_SCREEN)).not.toEqual([])
  })
})
