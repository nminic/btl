package com.btl.portal.web;

import com.btl.portal.domain.event.EventAddress;
import com.btl.portal.domain.event.WhatAnEventCarries;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.team.JoiningATeam;
import com.btl.portal.domain.team.Membership;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * A MEMBER PUTTING A TEAM FORWARD, WHICH IS THE FIRST WRITE ON THIS PORTAL THAT ENDS IN
 * THE MODERATOR'S QUEUE RATHER THAN IN THE THING IT IS ABOUT.
 *
 * <p>Owner, PDL P13, 11.08.2026: „Upis tima prolazi kroz moderaciju. Unosi ga bilo koji
 * clan koji to zeli, ali taj tim je u tekucoj sezoni vidljiv u tabeli Novih timova ispod
 * obracunske tabele." So this route makes no team. It makes a {@code team_proposal} and
 * the {@code verification} row that carries it to whoever decides, and until that decision
 * nothing about it is visible anywhere - PDL P13: „svaki novi tim se odobrava pre nego sto
 * postane vidljiv."
 *
 * <p><b>AND IT IS WRITTEN BY A MEMBER, WHICH IS WHY IT CARRIES NO {@link RightIsNeeded}.</b>
 * That annotation names a box the superadmin ticks for a moderator, and there is no box
 * anybody could tick that would let a member found a team: founding one is what every
 * member may do (PDL P13, „Tim registruje bilo koji registrovani clan"). The shape is
 * {@link RegistrationApi}'s and {@link MyApplicationsApi}'s - a route the portal's own
 * people use - and not {@link EventWriteApi}'s, which is the administration writing the
 * calendar.
 *
 * <p><b>It is also not named in {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}, and
 * that is measured rather than assumed.</b> That snapshot is compared exactly and would
 * fail if it needed a name; the floor under it takes every route the controllers map,
 * drops the ones whose PATH is in {@link ApiSecurity#READ_BY_ANYBODY}, and {@code
 * /api/teams} has been on that list since before this method existed. What the list grants
 * is reading - since 18.09.2026 {@code ApiSecurity} opens those paths for {@code GET},
 * {@code HEAD} and {@code OPTIONS} by method and for nothing else - so a {@code POST}
 * arriving here falls through to {@code anyRequest().authenticated()} and somebody who is
 * not signed in is answered 401 by the chain before this class runs. There is no condition
 * in this class about whether anybody is signed in, and there must not be one.
 *
 * <p><b>THREE ANSWERS ARE 404 WITH NO BODY, AND THAT IS A DECISION TAKEN BEFORE THE CODE
 * RATHER THAN A NUMBER PICKED WHILE WRITING IT.</b> An account with no member behind it,
 * a member who is already in a team, and a request outside the transfer window are all
 * told the same nothing.
 *
 * <ul>
 * <li><b>The owner's own words for the second of them.</b> PDL P13, 05.09.2026, after a
 * round proposed a screen explaining the refusal: „Ukoliko neko vec ima tim, dugme za
 * dodavanje tima ne treba da se prikazuje! Ako neko proba deeplink za pravljenje tima iako
 * ima tim, treba da se preusmeri na homepage", and the journal draws the conclusion in as
 * many words - „adresa koju clan ne sme da otvori nije strana sa objasnjenjem nego adresa
 * koje za njega nema." The sentence that used to explain it ({@code teams.proposeHasTeam})
 * was deleted by that same decision. A reason code here would be that sentence coming back
 * through the server.
 * <li><b>The portal already treats the first two of the three as one rule.</b>
 * {@code pages/member/ProposeTeam.tsx} sends a member away for a team he has OR a shut
 * window, in one condition, with its own note saying they „are the same rule read twice".
 * A server that told them apart would be a third opinion about one thing.
 * <li><b>And an account with no member is the shape {@link InboxApi} and
 * {@link NotificationApi} already answer.</b> V23 lets {@code account.competitor_id} be
 * null for „a moderator who does not race, which is the ordinary case and not a fault",
 * and {@code team_proposal.competitor_id} is NOT NULL because „only a member can propose a
 * team" (V11). There is nobody to file the proposal under.
 * </ul>
 *
 * <p><b>AND THE MAPPING SAYS WHAT IT CONSUMES, WHICH IS THE FOURTH BRANCH OF THE SAME
 * DECISION AND WAS MEASURED RATHER THAN FORESEEN.</b> Without {@code consumes}, a
 * {@code POST} arriving with no {@code Content-Type} reaches the argument resolver and is
 * answered 415 - a number that says „this address is here and wants a different type",
 * while an address mapping nothing goes on saying 404. That is the leak
 * {@link NothingIsHereRatherThanAlmost} was written for, arriving through the one door it
 * says it cannot close: a media type refused while a handler is already running is raised
 * far from {@code handleNoMatch} and is not turned into „no handler". Declared on the
 * mapping, the same request never matches at all, the dispatcher raises it FROM
 * {@code handleNoMatch}, and the portal's existing rule turns it into the 404 every
 * unmapped address answers. {@code RightsOverRealHttpTest} is what found this, off a
 * socket, on the day this route became the first write to share a path with a read.
 *
 * <p><b>The other two writes on open paths do not do this, and the difference is measured
 * rather than asserted.</b> A {@code POST} carrying no {@code Content-Type}, 19.09.2026:
 * {@code /api/teams} answers 404 to a superadmin and 404 to a moderator with no tick, the
 * same as {@code /api/zzzzzz}; {@code /api/events} and {@code /api/races} answer 404 to
 * the moderator - their door refuses him before any argument is resolved - and <b>400</b>
 * to the superadmin, because {@code @RequestBody} finds no body at all. So the sentence
 * „this address takes a POST" is still there to be read on those two, by somebody who
 * already holds the right. It is not fixed here: those are other files, one of them merged
 * the same day, and a route reaching into them would be this increment deciding for them.
 *
 * <p><b>The boundary in the other direction, said out loud because a route that refused
 * everybody would satisfy every sentence above.</b> A signed in member with a competitor
 * record, in no team, inside the transfer window, is answered 201 and his proposal is
 * standing in the queue; that is the ordinary use of this route and the case that measures
 * it sits beside the three refusals in the same fixture.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>The decision.</b> Approving or refusing a proposal is the moderator's
 * ({@code queue:teams}, PDL P13, 03.08.2026: „superadministrator ili moderator kome je dato
 * pravo nad redom „Novi timovi""), and it is its own increment. Nothing here writes
 * {@code team}, {@code team_membership} or a {@code message}.
 * <li><b>{@code first_season}, AND THE SCHEMA IS WHY RATHER THAN THIS CLASS.</b> The owner
 * decided on 05.09.2026 that „Obracun bodova tima pocinje 1. januara naredne sezone", and
 * V11 turned that into a column ON THE TEAM with the reason written beside the proposal:
 * a proposal carries „no {@code first_season}, because which season a team starts in is
 * decided by when it is APPROVED and not by when it was asked for." So the number is the
 * approval's to work out, from the window it is approved in, and answering it here would
 * be a SECOND home for it that is free to be wrong: a proposal sent on 31 December and
 * approved on 2 January would carry one number and be written with another. What this
 * route does carry of that decision is the half that is its own - the window, below.
 * <li><b>A change to a team that already exists.</b> V11 puts it in this same table, told
 * apart by {@code team_id} being filled („Izmena tima ide u isti red za verifikaciju kao i
 * predlog novog tima, uz oznaku sta je sta", owner, 04.09.2026). This route writes new
 * teams only, so {@code team_id} is null on every row it writes, and that is the mark
 * rather than an omission. The edit is sent from a different screen by a different person
 * - the team's own administrator (PDL P13, 04.09.2026) - and is its own increment.
 * <li><b>The mark.</b> {@code team_proposal.logo_id} points at {@code photo}, and what
 * this route has nowhere to send a picture TO is the half that RECEIVES a file: no
 * signature under {@code backend/src/main/java} carries a {@code MultipartFile} or a
 * {@code @RequestPart}, so nothing here is written to be handed one. That is read off the
 * signatures and is not a claim that no file could arrive by any road at all;
 * {@link RegistrationApi} carries that boundary in full, with the three routes that read
 * the raw body named. <b>The rest of this sentence is
 * REVERSED rather than extended, and in the same commit that found it.</b> It used to
 * name a digest, a crop and a name the database issues beside multipart and say that none
 * of the four existed anywhere under {@code backend/src/main}; three of the four have
 * existed since {@link PhotoApi} was written (20.09.2026, ADL A60), which looks a row up
 * by {@code photo.digest} and opens its file under {@code String.valueOf} of that row's
 * key, and since {@link TeamApi} began answering a team's digest beside the three
 * fractions of its crop (21.09.2026). Left standing it would read as an instruction to
 * the next reader to take those back out. What is unchanged is the decision this entry
 * exists for: nothing of a team's picture survives a moderator's approval of a proposal,
 * to F5 (ADL, 15.08.2026, „Nista od timske slike ne prezivljava odobravanje predloga, do
 * F5"), and {@link RegistrationApi} names the receiving half as the same boundary for the
 * member's own photograph. The column is nullable, so a proposal without one is a whole
 * row and not a half filled one, and the screen draws initials for a team with no mark
 * ({@link TeamApi}).
 * <li><b>A town out of the world codebook.</b> V11 lets a team's town be either a row of
 * {@code place} or a name typed with its country, and this route collects only the second.
 * Both team forms the portal has send a typed town - {@code predlog-tima.form.json} and
 * {@code admin-tim.form.json} carry {@code city} as text and {@code country} as the two
 * letter code - and nothing offers a place picker for a team. So {@code place_id} is null
 * on every row this writes, which is a shape the schema's pair of checks calls a town, and
 * the day a picker arrives it is this record that gains the field.
 * <li><b>A second proposal from the same member.</b> Nothing here refuses one, because
 * nothing decided that it should be refused: PDL P13 says a member may not FOUND a second
 * team while he is in one, and a proposal is not a team. Two of his waiting at once is a
 * state the queue already knows what to do with - approving the first puts him in a team,
 * and the second is then refused by whoever decides ({@code pages/admin/teamProposal.ts},
 * {@code teamMemberHasTeam}), which is where that rule was written and measured.
 * <li><b>A length for the name and the description.</b> PDL P13 calls the description
 * „ogranicen unos" and the forms cap the three fields at 60, 80 and 600; the schema names
 * no length at all and neither does any other writing route on this server. Left out here
 * rather than invented, so that the day it is enforced it is enforced in one place with a
 * number somebody decided.
 * </ul>
 *
 * <p><b>THE WINDOW AND THE TEAM HE MAY ALREADY BE IN ARE ONE QUESTION AND IT IS ASKED OF
 * {@link JoiningATeam}, WHICH ALREADY ANSWERS IT.</b> That class carries both halves -
 * {@code THE_WINDOW_IS_SHUT} off {@link SeasonClock#transferWindowOpen} and
 * {@code ALREADY_IN_A_TEAM} off the memberships - and it is the portal's home for them.
 *
 * <ul>
 * <li><b>The window is not written again here, and that is the point.</b> The owner,
 * 05.09.2026: „Tim se osniva samo u prelaznom roku, 1. oktobra do 31. decembra... Isti
 * prozor u kom promena tima stupa na snagu 1. januara, pa se sve sto menja sastav desava u
 * jednom roku umesto u dva pravila. Portal taj rok vec ima i vec ga izgovara na strani
 * Clanarine ({@code membership.transferOpen}, {@code membership.transferShut})." A date
 * spelled out in this file would be that one window with a second home, free to drift the
 * day either moves.
 * <li><b>And it is measured in Belgrade, which is neither the server's zone nor the
 * database's.</b> {@link SeasonClock#transferWindowOpen} reads the moment in
 * {@link SeasonClock#ZONE} before it looks at the month, which is ADL A36 O2's sentence
 * that a season is counted in {@code Europe/Belgrade}; read off the machine it would be
 * right in Belgrade and wrong on a server kept in UTC, which is every server this portal
 * runs on. The moment itself comes from the {@link Clock} bean rather than from
 * {@code Instant.now()}, so both edges of the window are one fixture and two assertions
 * ({@code WhatTimeItIs} says why that bean exists).
 * <li><b>„Nema tim" IS READ OFF THE RECORD AND NOT OFF THE SEASON</b>, which is the
 * owner's decision of 05.09.2026 and the one thing here that is easy to get green and
 * wrong. His own case: member {@code 000031} „je upisan u Dunav sa {@code teamSince:
 * 2027}, pa ga portal na dan u 2026. ne broji u timu... a dugme i vrata mu svejedno ne
 * daju da osnuje tim", his reason being that founding one today would leave him in two on
 * 1 January. {@link Membership#standsInTheWayOfJoiningIn} asks exactly that - a membership
 * with no end stands in the way whatever season it began in - so a member whose team
 * starts next year is refused here, and a condition comparing {@code season_from} with the
 * running season would let him through while every case in a fixture where nobody has a
 * team stayed green.
 * <li><b>Where the two readings could still differ, named rather than left to be found.</b>
 * {@code standsInTheWayOfJoiningIn} also refuses a membership that has been ENDED for a
 * season at or after the one he would join, which reading {@code team_id} off the open
 * membership alone would not. Nothing on this portal can produce that row yet - nothing
 * writes {@code team_membership} at all - and when something does, this is the reading the
 * database will enforce anyway: {@code team_membership_one_team_at_a_time} is an exclusion
 * constraint over the same ranges, so asking the narrower question would be answering yes
 * to something the approval could not then write.
 * </ul>
 *
 * <p><b>THE NAME IS COMPARED AS THE ADDRESS IT MAKES, AND ONLY AGAINST TEAMS THAT REALLY
 * EXIST.</b> PDL P13: „Naziv ne sme biti zauzet nekim vec odobrenim timom", and ADL,
 * 03.08.2026, says how that is measured: „Naziv tima se proverava po adresi koju pravi, ne
 * po slovima... Preslikavanje nije jedan na jedan: „Dunavski trkaci" i „Dunavski Trkaci"
 * su dva naziva i jedna adresa", with Cyrillic and Latin one script for this purpose. So
 * the comparison is against {@code team.slug}, which is what {@code team_slug_unique}
 * really protects, and {@link EventAddress#written} is the rule - the same one the portal
 * runs on its own side and the one {@code EventAddressTest} holds against all 1167 shipped
 * names. A second spelling of it here would be a rule free to disagree with the addresses
 * the portal already answers at.
 *
 * <p><b>Which settles what happens when two members propose one name on one day: both
 * proposals are written and both wait.</b> The boundary is „approved" and the owner put it
 * in the sentence: a proposal standing in the queue is not a team, it has no address, and
 * V11 gives {@code team_proposal} no {@code slug} for exactly that reason. The other side
 * of the boundary is the moment one of them is approved - from then on the address belongs
 * to a team and the next proposal of that name is refused here, and the one still waiting
 * is refused by whoever decides it ({@code pages/admin/teamProposal.ts}, {@code teamTaken}).
 * Both sides have a case. Refusing the second proposal instead would mean the portal
 * holding a name for somebody a moderator may yet turn down, which is not a decision
 * anybody took.
 *
 * <p><b>A NAME THAT MAKES NO ADDRESS IS REFUSED, AND IT IS NOT A CURIOSITY.</b> PDL P13:
 * „naziv mora da sadrzi bar jedno slovo nase abecede ili cirilice ili cifru, jer se od
 * njega pravi adresa strane. Naziv od samih znakova, ili napisan pismom koje portal ne
 * prepisuje, nema stranu, pa se odbija na formi umesto da tiho napravi tim koji se ne moze
 * otvoriti." Empty, the first such team would answer at {@code /tim/} and every one after
 * it would be told its name is taken though the two share nothing.
 *
 * <p><b>THE QUEUE ROW CARRIES THE NAME AND THE NOTE, AND THE NOTE IS NOT THE
 * DESCRIPTION.</b> V9 makes {@code subject} NOT NULL because it „carries the name in
 * every case" and {@code body} NOT NULL and blankable because it is „what was written or
 * proposed". What is written to a MODERATOR is {@code teams.proposeNote}, „Zasto ovaj
 * tim", which the portal draws as the one piece of text on a queue card
 * ({@code teams.proposeBody}); the description belongs to the team and stays on the
 * proposal, for an approval to copy across. A round on 19.09.2026 measured the cost of
 * having those two the wrong way round: a member sending what his own form defines was
 * answered 201 and the moderator was shown a card with nothing on it.
 *
 * <p>The name goes into both tables from one set of arguments inside one transaction, so
 * there is no moment at which the two could be made to disagree - nothing on this portal
 * edits a proposal, and the increment that does will write both. The town does NOT go
 * into {@code body}: it has columns of its own on the proposal, and a sentence built out
 * of it here would be the server writing the portal's Serbian.
 *
 * <p><b>Everything else about that row is the schema's and is not written here.</b>
 * {@code state} is {@code waiting} by V9's default, {@code raised_at} is V9's
 * {@code now()}, and {@code right_code} is generated from the queue - so a row cannot
 * stand in a tab nobody has the right to moderate. The queue is {@code teams}, which is
 * the only value {@code verification_only_the_teams_queue_carries_a_proposal} lets a row
 * with a proposal carry.
 *
 * <p><b>AND THE ANSWER IS READ BACK OUT OF THE ROW.</b> The name is stripped on the way in
 * ({@code team_proposal_name_not_blank} refuses a blank one), so what was typed and what
 * was stored are two values on purpose; handed back off the request, this answer would
 * agree with the table on every request that worked and would be a claim about nothing.
 * That is {@link RegistrationApi}'s own reason for reading the address back off the
 * account it has just written, and {@link ModeratorWriteApi}'s for answering with the ticks
 * the table holds.
 */
@RestController
class TeamWriteApi {

	/** A required field nobody filled in, and a town that is not one. */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** A country code {@code /api/countries} does not serve. */
	static final String THE_COUNTRY_IS_NOT_KNOWN = "theCountryIsNotKnown";

	/** A name no page could be opened at, which is PDL P13's one rule about free text. */
	static final String THE_NAME_MAKES_NO_ADDRESS = "theNameMakesNoAddress";

	/** A link that is not one, which is {@code team_proposal_link_shape}. */
	static final String THE_LINK_IS_NOT_SHAPED = "theLinkIsNotShaped";

	/**
	 * A team already answers at the address this name makes.
	 *
	 * <p>Spelt the same as {@link EventWriteApi}'s and {@link RegistrationApi}'s, because
	 * it is the same sentence about a different thing: what was asked for is taken.
	 */
	static final String THE_ADDRESS_IS_TAKEN = "theAddressIsTaken";

	/**
	 * WHAT THIS ROUTE TAKES THAT THE MEMBER'S FORM DOES NOT YET ASK FOR, named rather than
	 * silent.
	 *
	 * <p>A field the form does not have and a field that went missing look exactly alike
	 * from inside a handler, which is the reason this is a constant and not a sentence.
	 * PDL P13, 11.08.2026 says a member fills in „naziv tima, opis (ograniceni unos) i
	 * neobavezni link" and V11 gives {@code team_proposal} a column for each of the two;
	 * {@code predlog-tima.form.json} asks for neither.
	 *
	 * <p>{@code TeamWriteApiTest} reads that file and demands that every field on it be a
	 * component of {@link Proposed}, and that every name on this list really is one the
	 * form does NOT ask for - so a field added to the form tomorrow fails the build until
	 * somebody decides where it goes, and a name that starts being asked for cannot sit
	 * here excusing nothing. That is {@link RegistrationApi#NOT_COLLECTED_YET}'s shape,
	 * inverted: there the form asks and the route does not collect, here the route collects
	 * and the form does not yet ask.
	 *
	 * <p><b>It exists because the other direction was measured and was wrong.</b> This
	 * record once said it was „what the form sends and nothing besides" while differing
	 * from that file in two of five names, and a request carrying the form's own
	 * {@code note} was answered 201 with the queue row left blank - Jackson drops a field
	 * nothing is named for, and nothing in {@code backend/src/main/resources} configures it
	 * otherwise.
	 */
	static final Set<String> ASKED_FOR_BEFORE_THE_FORM_ASKS = Set.of("bio", "link");

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final Clock clock;

	/**
	 * Written by hand rather than left on the method, the same choice {@link EventWriteApi}
	 * and {@link ModeratorWriteApi} made and for the same reason: a proposal and the queue
	 * row that carries it are one thing. A proposal with no queue row is one nobody can
	 * decide and one {@link MyApplicationsApi} drops on purpose, so the member would be
	 * waiting on something that reaches nobody and shows nowhere.
	 *
	 * <p><b>And that is a claim with a case behind it since 19.09.2026, which it was not
	 * when it was first written.</b> Taking this out left {@code TeamWriteApiTest} green at
	 * 37 cases, because a test-managed transaction swallows the question:
	 * {@code TransactionTemplate} joins whatever is already open, so a route with no
	 * transaction of its own is still inside the test's.
	 * {@code TeamProposalAndItsQueueRowAreOneThingTest} is therefore NOT
	 * {@code @Transactional}, and it makes the second write fail with nothing stubbed - the
	 * note is the one field that goes only into {@code verification}, so a note
	 * {@code text} cannot hold is a request whose first statement succeeds and whose second
	 * does not.
	 */
	private final TransactionTemplate inOneTransaction;

	TeamWriteApi(JdbcClient db, MemberOfAccount memberOfAccount, Clock clock,
			TransactionTemplate inOneTransaction) {

		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * WHAT ARRIVES, AND EVERY FIELD OF IT NAMES ITS OWN SOURCE, because two different
	 * sources disagree about what a proposal carries and a round measured what pretending
	 * otherwise costs.
	 *
	 * <p><b>Four of these are {@code predlog-tima.form.json}'s own names</b> -
	 * {@code name}, {@code city}, {@code country} and {@code note} - and
	 * {@link #ASKED_FOR_BEFORE_THE_FORM_ASKS} is the floor that keeps that true in both
	 * directions.
	 *
	 * <p><b>{@code note} IS NOT THE TEAM'S DESCRIPTION, AND CONFUSING THE TWO IS THE
	 * MISTAKE THIS PARAGRAPH EXISTS TO NOT MAKE.</b> Its label is {@code teams.proposeNote},
	 * „Zasto ovaj tim", and the portal puts it in front of whoever decides:
	 * {@code teams.proposeBody} is „{city}, {country}. {note}", which is the one piece of
	 * text a queue card draws. So it goes into {@code verification.body} and into no column
	 * of {@code team_proposal}, which has none for it - a sentence addressed to a moderator
	 * is not a thing the team would afterwards carry. The town is NOT built into that
	 * sentence here: it has columns of its own on the proposal, and a server writing the
	 * portal's Serbian would be a second home for both.
	 *
	 * <p><b>{@code bio} and {@code link} are the other source, and they are PDL's.</b> PDL
	 * P13, 11.08.2026: „Korisnik popunjava naziv tima, opis (ograniceni unos) i neobavezni
	 * link", and V11 gives {@code team_proposal} a column for each „so an approval can copy
	 * them across without deciding anything on the way". The form has neither field today,
	 * which is why they are named on {@link #ASKED_FOR_BEFORE_THE_FORM_ASKS} rather than
	 * left to look like fields that went missing.
	 *
	 * <p>There is no {@code teamId}, no {@code firstSeason} and no {@code logo}, each for
	 * its own reason given above; and no {@code placeId}, because the town arrives typed.
	 *
	 * @param note    why this team, in the member's own words, for whoever decides. Empty
	 *                where he wrote none, and then the card draws the name and the town
	 * @param bio     what the team would say about itself, which may be empty - the same
	 *                shape {@code competitor.bio} and {@code btl_event.description} have
	 * @param link    the team's own page, optional and empty where there is none
	 * @param city    the town, typed by hand, which then names its country
	 * @param country the code of that country, {@code RS}, never its key - the same
	 *                spelling {@link TeamApi} answers with
	 */
	record Proposed(String name, String note, String bio, String link, String city,
			String country) {
	}

	/** Why a team could not be put forward. */
	record Refused(String reason) {
	}

	/**
	 * @param id   the proposal now standing in the queue, which the caller cannot know
	 *             until it comes back
	 * @param name the name AS IT WAS WRITTEN DOWN, read back off the row: it is stripped on
	 *             the way in, so this is not always what was sent
	 */
	record Made(long id, String name) {
	}

	@PostMapping(path = "/api/teams", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> propose(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@RequestBody Proposed typed) {

		Long me = memberOfAccount.competitorId(asking.account());

		/* AN ACCOUNT THAT NAMES NO MEMBER, which V23 says is the ordinary case for a
		   moderator who does not race. There is nobody to file a proposal under, and the
		   answer is the one InboxApi and NotificationApi already give him. */
		if (me == null) {
			return away();
		}

		/* AND THE TWO QUESTIONS JoiningATeam ALREADY ANSWERS, asked before anything about
		   the form: a member the portal would have sent away from this screen learns
		   nothing more by filling it in correctly. Which of the two refused him is not told
		   apart, for the reason written at the top of this class. */
		if (JoiningATeam.mayJoin(membershipsOf(me), ZonedDateTime.now(clock))
				!= JoiningATeam.Answer.YES) {
			return away();
		}

		if (isNothing(typed.name())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		/* THE ADDRESS THE NAME MAKES, worked out once and used twice: to refuse a name that
		   makes none, and to ask whether a team already answers at it. */
		String address = EventAddress.written(typed.name());

		if (address.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_NAME_MAKES_NO_ADDRESS);
		}

		if (isNothing(typed.city()) || isNothing(typed.country())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		/* ANSWERED AS A SENTENCE AND NOT AS A CONSTRAINT VIOLATION. Left to the database,
		   a link that is not one and a country nothing maps both arrive as a 500 after the
		   form has been filled in, which is the fault `WhatAnEventCarries` exists to turn
		   into an answer one table along. */
		if (!WhatAnEventCarries.linkIsShaped(orEmpty(typed.link()))) {
			return no(HttpStatus.BAD_REQUEST, THE_LINK_IS_NOT_SHAPED);
		}

		return inOneTransaction.execute(committing -> write(me, typed, address));
	}

	/**
	 * THE WRITING, AND IT IS ONE TRANSACTION FROM THE PROPOSAL TO THE QUEUE ROW.
	 *
	 * <p>The country is resolved before anything is written, because „is there such a
	 * country" is a question about the codebook and not about the form: a key that cannot
	 * be resolved would otherwise be an error inside the INSERT rather than an answer to
	 * the person. That is {@link RegistrationApi}'s own arrangement for the same three
	 * columns.
	 *
	 * <p><b>The address is asked for once, by a plain question and not by an index, and
	 * that is not the shape {@link EventWriteApi} uses.</b> There it is {@code on conflict
	 * do nothing}, because an event's address is written into a column with a unique index
	 * over it and a second request arriving between the reading and the writing would
	 * collide. Here there is nothing to collide with: this route never writes
	 * {@code team.slug}, a proposal has no address at all, and two proposals of one name
	 * are a state the queue is meant to hold. The index that really protects the address is
	 * {@code team_slug_unique}, and what it protects against is two APPROVALS, which is a
	 * different increment's race to lose.
	 */
	private ResponseEntity<?> write(long me, Proposed typed, String address) {
		Optional<Long> country = countryKey(typed.country());

		if (country.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_COUNTRY_IS_NOT_KNOWN);
		}

		if (addressIsTaken(address)) {
			return no(HttpStatus.CONFLICT, THE_ADDRESS_IS_TAKEN);
		}

		String name = typed.name().strip();

		/* `team_id` IS NOT IN THIS LIST, and its absence is the mark: V11 tells a new team
		   from a change to one that exists by whether the column is filled, and this route
		   writes new teams only. `place_id` and `country_id` are the town in the shape the
		   member sent it, which is the second of the two V11 allows. And `note` is not in
		   it either, because this table has no column for it: what a member writes TO A
		   MODERATOR is not a thing the team would carry afterwards. */
		long proposal = db.sql("insert into team_proposal"
						+ " (competitor_id, name, bio, link, city, country_id)"
						+ " values (?, ?, ?, ?, ?, ?)"
						+ " returning id")
				.params(me, name, orEmpty(typed.bio()), orEmpty(typed.link()),
						typed.city().strip(), country.orElseThrow())
				.query(Long.class)
				.single();

		/* AND THE TAB IT WAITS IN, which is the only one a row carrying a proposal may
		   stand in (`verification_only_the_teams_queue_carries_a_proposal`). `state`,
		   `raised_at` and `right_code` are left to V9 - a state written here would be a
		   second home for „waiting", and a moment read off this server would be a second
		   home for what time it is. */
		db.sql("insert into verification (queue, competitor_id, subject, body, team_proposal_id)"
						+ " values ('teams', ?, ?, ?, ?)")
				/* THE NOTE AND NOT THE DESCRIPTION, which is the whole of what a round on
				   19.09.2026 found: this carried `bio`, and a member sending what his own
				   form defines was answered 201 with a card nobody could read anything off.
				   V9 makes `body` NOT NULL and blankable because it is „what was written or
				   proposed", and what is written HERE, to a moderator, is `teams.proposeNote`
				   - „Zasto ovaj tim". The description is the team's and stays on the
				   proposal, where an approval copies it from. */
				.params(me, name, orEmpty(typed.note()), proposal)
				.update();

		return ResponseEntity.status(HttpStatus.CREATED)
				.body(new Made(proposal, nameWrittenDown(proposal)));
	}

	/**
	 * EVERY MEMBERSHIP HE HAS EVER HAD, and not only the one that has not ended.
	 *
	 * <p>{@link JoiningATeam#mayJoin} says why it wants all of them: one he ended last
	 * season does not stand in the way of next, and one written ahead for a season still to
	 * come does. Read as „the open one" here, the question would become „is he in a team
	 * today", which is a different question with a different answer.
	 */
	private List<Membership> membershipsOf(long me) {
		return db.sql("select team_id, season_from, season_to, left_reason from team_membership"
						+ " where competitor_id = ?")
				.param(me)
				.query((row, one) -> new Membership(row.getLong(1), row.getInt(2),
						row.getObject(3, Integer.class), row.getString(4)))
				.list();
	}

	/**
	 * Whether a team already answers at this address.
	 *
	 * <p>Over {@code team} and never over {@code team_proposal}, which is PDL P13's word
	 * „odobrenim" doing the work: a proposal is not a team and has no address to take.
	 */
	private boolean addressIsTaken(String address) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from team where slug = ?)")
				.param(address).query(Boolean.class).single());
	}

	private Optional<Long> countryKey(String code) {
		return db.sql("select id from country where code = ?").param(code.strip())
				.query(Long.class).optional();
	}

	/** The name as the row holds it, which is the one thing this answer is a claim about. */
	private String nameWrittenDown(long proposal) {
		return db.sql("select name from team_proposal where id = ?").param(proposal)
				.query(String.class).single();
	}

	/**
	 * Whether a field was filled in at all.
	 *
	 * <p>Absent, empty and a run of spaces are one answer and not three, which is the list
	 * of shapes {@link RegistrationApi} keeps for the same reason: JSON has a null, a form
	 * has an empty box and a person has a space bar, and a guard written against one of the
	 * three lets the other two through to a column whose {@code btrim(...) <> ''} would
	 * then refuse them as an error.
	 */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	/** {@code bio} and {@code link} are NOT NULL and may be empty (V11). */
	private static String orEmpty(String value) {
		return value == null ? "" : value.strip();
	}

	/**
	 * THE ANSWER FOR SOMEBODY THIS ADDRESS IS NOT FOR, which carries nothing at all.
	 *
	 * <p>The shape {@link EventWriteApi} and {@link ModeratorWriteApi} answer a caller they
	 * refuse with, and the reason for the empty body is the one written at the top of this
	 * class: the owner deleted the sentence that used to explain this, so there is nothing
	 * to put in one.
	 *
	 * <p><b>IT IS NOT THE SAME BYTES AS AN ADDRESS THAT IS NOT THERE, AND THAT IS WRITTEN
	 * DOWN HERE RATHER THAN LEFT TO BE FOUND.</b> A status on the response comes back with
	 * {@code Content-Length: 0} while an address mapping nothing comes back longer and
	 * chunked, which is the oracle {@link VerificationApi} answers with {@code sendError}
	 * to avoid. That oracle is about ADMINISTRATIVE addresses a refused person must not
	 * learn the existence of; this one is on {@link ApiSecurity#READ_BY_ANYBODY}, answers
	 * {@code GET} 200 to a visitor, and says out loud through {@code OPTIONS} that a write
	 * lives here - a price {@code ApiSecurity} weighed and accepted on 18.09.2026 for
	 * exactly the paths a visitor is invited to. There is nothing left for the shape of
	 * this 404 to hide.
	 *
	 * <p><b>Written the other way round it was measured and nothing moved</b>, which is why
	 * this is a decision and not an oversight: {@code sendError} here leaves the whole gate
	 * green, {@code RightsOverRealHttpTest} included, because the one request that reaches
	 * this line over a socket is one carrying real JSON from a signed in member - and a
	 * request that is NOT this route never gets here at all, since the mapping says what it
	 * consumes.
	 */
	private static ResponseEntity<?> away() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
