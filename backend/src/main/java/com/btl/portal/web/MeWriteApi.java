package com.btl.portal.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * A MEMBER CHANGING WHAT THE PORTAL SAYS ABOUT HIM, WHICH IS ONE REQUEST TAKING TWO
 * DIFFERENT ROADS.
 *
 * <p>Owner, PDL P22, 15.08.2026: „Clan menja tekst o sebi u Podesavanjima, kao i sliku",
 * and his answer on 18.09.2026 when asked what a written {@code /api/me} would carry:
 * „upis bio i slike ide SA VERIFIKACIJOM". Beside it, PDL P23, 06.09.2026: „Skrivanje
 * profila se pravi. Jedno polje na clanu i jedan prekidac u Podesavanjima." So one screen
 * sends two things and they do NOT end in the same place:
 *
 * <ul>
 * <li><b>The text waits.</b> PDL P11: „Profil ima trkacku biografiju koju popunjava
 * takmicar, a administrator odobrava pre objave", and PDL P18: „Sva polja clan uredjuje
 * sam, administrator potvrdjuje." Nothing this route does touches {@code competitor.bio}.
 * What it writes is a row in {@code verification}, in the tab a moderator holding
 * {@code queue:profiles} works in.
 * <li><b>The switch takes effect at once.</b> PDL P11: „Clan sme da sakrije profil od
 * posetilaca koji nisu clanovi; od drugih clanova ne sme", and P23 calls it „jedno polje
 * na clanu". No decision anywhere puts it in front of anybody, and there is nothing about
 * it for a moderator to judge: it is the member's own choice over his own page.
 * </ul>
 *
 * <p><b>A SEPARATE CLASS FROM {@link MeApi} AND NOT A SECOND METHOD ON IT</b>, which is
 * the split the portal already makes three times over - {@link TeamApi} and
 * {@link TeamWriteApi}, {@link PairApi} and {@link PairWriteApi}, {@link ModeratorApi} and
 * {@link ModeratorWriteApi}. A read that answers who is asking and a write that reaches two
 * tables inside a transaction share a path and nothing else.
 *
 * <p><b>AND IT IS WRITTEN BY A MEMBER, WHICH IS WHY IT CARRIES NO {@link RightIsNeeded}.</b>
 * That annotation names a box the superadmin ticks for a moderator, and no box anybody
 * could tick would let one member edit another's profile: editing his own is what every
 * member does, and it is the whole of what this route offers. {@code /api/me} is therefore
 * named in {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT} already, and it is named
 * there as a PATH - so this method needs nothing added to that snapshot and nothing in
 * that file is touched here. The day the snapshot becomes pairs of a method and a path,
 * {@code PUT /api/me} is the line it will want.
 *
 * <p><b>And it is not on {@link ApiSecurity#READ_BY_ANYBODY}</b>, so a request arriving
 * with no session is answered 401 by the chain before this class runs. There is no
 * condition here about whether anybody is signed in, and there must not be one.
 *
 * <p><b>WHOSE PROFILE IS CHANGED IS READ OFF THE SESSION AND NEVER OFF THE REQUEST.</b>
 * There is no member in the path and no member in the body: the address is
 * {@code /api/me}, and {@link MemberOfAccount} turns the signed in account into the one
 * member it names (V23, „jedan nalog je tacno jedan clan", owner, 14.09.2026). A field
 * naming somebody else is a field Jackson drops, and the case that holds it sends one.
 * This is {@link WhatHeMayDo}'s own rule about reading the session rather than the
 * request, applied to identity instead of to privilege.
 *
 * <p><b>AN ACCOUNT THAT NAMES NO MEMBER IS ANSWERED 404 WITH NO BODY.</b> V23 lets
 * {@code account.competitor_id} be null for „a moderator who does not race, which is the
 * ordinary case and not a fault", and such an account has no biography to change and no
 * profile page to hide. ADL A8, 13.09.2026: „Server odbija bez privilegije sa 404, ne sa
 * 403." It is the same answer {@link InboxApi}, {@link NotificationApi},
 * {@link TeamWriteApi} and {@link PairWriteApi} already give him.
 *
 * <p><b>WHY THAT 404 IS A STATUS AND NOT {@code sendError}, AND THE DIFFERENCE IS
 * MEASURED RATHER THAN WAVED AWAY.</b> {@link VerificationApi} answers its refusal through
 * {@code sendError} because a status alone comes back with {@code Content-Length: 0} while
 * an address mapping nothing comes back longer and chunked, and that difference is an
 * oracle for whether an ADMINISTRATIVE address exists. There is nothing of that sort here.
 * This 404 is told to the caller about the caller's OWN account; {@code GET /api/me}
 * answers the same caller 200 at the same address, so the address's existence is not a
 * thing this answer could hide from him, and no other person's existence is behind it.
 * {@link TeamWriteApi} weighed the same question for its own 404 and came to the same
 * answer by a different road: its path is open to visitors and says out loud through
 * {@code OPTIONS} that a write lives there.
 *
 * <p><b>THE MAPPING SAYS WHAT IT CONSUMES</b>, which {@link TeamWriteApi} measured on
 * 19.09.2026: without it, a request arriving with no {@code Content-Type} reaches the
 * argument resolver and is answered 415, a number that says „this address is here and
 * wants a different type", while an address mapping nothing goes on saying 404. Declared
 * on the mapping, the same request never matches, the dispatcher raises it from
 * {@code handleNoMatch}, and {@link NothingIsHereRatherThanAlmost} turns it into the 404
 * every unmapped address answers.
 *
 * <h2>FOUR THINGS THIS ROUTE DECIDES, EACH WITH ITS BOUNDARY IN BOTH DIRECTIONS</h2>
 *
 * <p><b>1. THE TEXT THAT STANDS ON THE PROFILE IS NOT TOUCHED WHILE A NEW ONE WAITS.</b>
 * PDL P11, 12.08.2026, says it of the picture in as many words - „Dok nova slika ceka, na
 * profilu stoji ona koja je odobrena: nijedna neodobrena slika se ne prikazuje nikome osim
 * onome ko ju je poslao i onome ko je odobrava" - and the text is the other half of the
 * same queue row (PDL P28a, 06.08.2026: „Biografije i profilne slike postaju jedan red,
 * „Trkacki profil"... isti clan, isti profil, dve stavke koje moderator gleda zajedno").
 * So the shape is copied rather than argued: this route issues no {@code update} against
 * {@code competitor.bio} at all, and the approval that will write it is another
 * increment's. The boundary the other way: the SWITCH is written here and now, because
 * nothing approves it.
 *
 * <p><b>2. A SECOND TEXT WHILE ONE IS WAITING IS REFUSED, AND THE PORTAL ALREADY DECIDED
 * THAT ON ITS OWN SIDE.</b> {@code pages/member/ProfileBio.tsx} draws no button while one
 * stands and says why: „a second ask gives a moderator two texts of one person and no
 * question to answer". The same file names the hole it could not close - „somebody who
 * writes twice across two visits gives the moderator two cards, which is written down
 * rather than left to be discovered (PDL P22)" - and this is the side that can close it.
 * The rule therefore lives twice on purpose, exactly as {@link
 * com.btl.portal.domain.registration.WhatRegistrationAsksFor} says of its own: „the form
 * is JavaScript in somebody else's browser: a registration can arrive without ever having
 * passed through it".
 *
 * <ul>
 * <li><b>Refused:</b> a member whose text is standing in the queue undecided, sending
 * another, is answered 409 and the queue still holds the FIRST text.
 * <li><b>Accepted, and each of these is its own case:</b> a member whose earlier text was
 * DECIDED, approved or refused, may send another - that is the whole reason the owner
 * asked for this screen („odbijanje se vraca, clan ispravi i posalje ponovo", PDL P22,
 * 15.08.2026), and a guard written over the queue rather than over {@code state =
 * 'waiting'} would shut the one door it was built to open. So may a member whose waiting
 * row is in ANOTHER tab, and so may a member while SOMEBODY ELSE's text waits.
 * <li><b>And it is NOT the same as a waiting picture.</b> The profiles tab carries both
 * (PDL P28a, 06.08.2026), and a picture waiting is not a text waiting: „razlikuje se samo
 * sta moderator pise, jer se slika menja po instrukciji a tekst se pise ponovo".
 * {@code photo_id} is what the SCHEMA offers to tell the two apart, and it is what is
 * asked here. <b>The boundary, written down because it is real:</b> the portal's own
 * screens tell them apart by a {@code kind} that has no column at all - {@link
 * VerificationApi} names it first among the twelve fields the file carries and the schema
 * does not - and nothing on this server writes a picture into this queue yet. The day
 * something does, it either fills {@code photo_id}, which V9 calls „the picture, while
 * there still is one" and which a moderator must have in order to judge one, and this
 * guard goes on being right; or it invents a mark, and this is the sentence to read then.
 * </ul>
 *
 * <p><b>3. ONE ROUTE, TWO ROADS, AND THE ANSWER MUST NOT LIE IN EITHER DIRECTION.</b> The
 * answer carries three values and every one of them is read back out of the database after
 * the writing, never off the request:
 *
 * <ul>
 * <li><b>{@code bio} is the text that STANDS ON THE PROFILE</b>, which after a request
 * carrying a new one is still the old one. Answered off the request it would tell a screen
 * that the member's unapproved words are now his profile, which is the very thing decision
 * 1 above refuses, arriving through the server instead of through the table.
 * <li><b>{@code profileHidden} is the flag as the row now holds it.</b> Leaving it out
 * would be the opposite lie: the one half of this request that DID take effect would be
 * the half the caller is told nothing about, and the screen would have to assume what it
 * had just asked for. Read back off the row, it is a claim the table makes.
 * <li><b>{@code waiting} is what tells the two roads apart</b>, and it is the key of this
 * member's text standing in the queue undecided, or nothing where none stands. Non-empty
 * means „your words are with a moderator"; empty means nothing of yours is. It is read the
 * same way whether or not THIS request put it there, so a member who only flicked the
 * switch while an older text waits is told the truth about both.
 * </ul>
 *
 * <p><b>4. THE REFUSED TEXT DOES NOT REACH THE MEMBER TODAY, AND NOTHING HERE PRETENDS
 * OTHERWISE.</b> PDL P22 says it must: „Biografija se odbija i vraca clanu, kao i sve
 * ostalo: uz obavezan razlog, koji stize u sanduce", and PDL P11 gives the picture's half
 * the same shape - „Odbijena slika se vraca sa preciznom instrukcijom u inboks". Two
 * things stand between that sentence and this portal, and both are named rather than left
 * to be assumed: <b>{@code POST /api/inbox} is written and not merged</b> (PR 307,
 * {@code InboxWriteApi}), so there is no route that puts a message in a member's box; and
 * <b>a moderator's decision in the queue is the December block</b>, so there is nothing
 * that would send one. This route writes no {@code message} and no notification, invents
 * no table and no address, and says so here. A sentence claiming somebody was told when
 * he was not is worse than the missing half.
 *
 * <h2>WHAT ELSE IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED</h2>
 *
 * <ul>
 * <li><b>The picture.</b> PDL P11, 12.08.2026 puts changing it in this same panel and ends
 * „Ide u naredni inkrement, ne u tekuci PR". It is a file - multipart, a digest, a crop and
 * a row in {@code photo} - and nothing under {@code backend/src/main} receives one. This
 * route takes no picture and prepares none.
 * <li><b>The decision.</b> Approving or refusing what waits here belongs to whoever holds
 * {@code queue:profiles} and is its own increment. Nothing here writes
 * {@code competitor.bio}, sets {@code verification.state}, or names a moderator.
 * <li><b>EMPTYING A BIOGRAPHY THAT ALREADY STANDS.</b> A blank text is refused below
 * rather than queued or applied, and that is a decision taken before the code. PDL P11
 * calls removing one's own picture „pravo clana nad sopstvenim podatkom, ne predlog", but
 * that very half was struck out on 15.08.2026 and shelved to F5, and nobody has decided it
 * for the text; writing it here would be this increment deciding something the owner put
 * off. Queueing it instead is no better: V9 says {@code body} is blank for „a tab that
 * proposes nothing", so a blank one in this tab is indistinguishable from an item that
 * proposes no text at all, which is the card with nothing on it that a round on 19.09.2026
 * measured the cost of. The day it is decided it is decided once, for the text and the
 * picture together.
 * <li><b>A text identical to the one already standing.</b> {@code ProfileBio.tsx} declines
 * to send one, „a moderator reading a card that asks them to approve what they approved
 * last week learns to skim", and that is a screen sparing a moderator rather than a rule
 * anybody wrote down. From here the two cases look alike: a member re-sending his words
 * after a refusal that was about something else is doing an ordinary thing. Nothing
 * decided that it should be refused, so nothing here refuses it - {@link TeamWriteApi}'s
 * own reason for a second proposal - and the guard above already keeps one member's texts
 * from piling up in the queue.
 * <li><b>The birthday choice.</b> PDL P23, 06.09.2026 gives {@code birthday_shown} three
 * values and a switch in the same Settings, and V7 gives it a column with a default. It is
 * not in this increment's scope and is not collected here; a field answered „for good
 * measure" is a promise about what the portal takes before anybody has said which screen
 * sends it.
 * </ul>
 *
 * <p><b>THE TWO WRITES ARE ONE TRANSACTION, AND THAT IS A CLAIM WITH A CASE BEHIND IT.</b>
 * A request carrying both a switch and a text either does both or does neither: told 200
 * after half of it, the portal would be reporting work it did not do, and the member would
 * have a hidden profile and no idea his words never left. {@code TransactionTemplate}
 * joins whatever transaction is already open, so a test-managed one swallows the question
 * entirely - measured on {@link TeamWriteApi} on 19.09.2026, where taking the transaction
 * out left its whole file green. {@code TheSwitchAndTheTextAreOneThingTest} is therefore
 * NOT {@code @Transactional} and makes the SECOND statement fail with nothing stubbed: the
 * text is the one value that goes only into {@code verification}, so a text PostgreSQL
 * cannot hold is a request whose first statement succeeds and whose second does not.
 *
 * <p><b>AND EVERY REFUSAL HAPPENS BEFORE THE FIRST WRITE.</b>
 * {@code TransactionTemplate.execute} rolls back on an exception and not on a returned
 * value, so a 409 decided after the switch had been written would be a refusal reported
 * over a change that was kept. The conflict is therefore asked before anything is written,
 * inside the same transaction that would write it.
 */
@RestController
class MeWriteApi {

	/**
	 * A request that named nothing at all, and a text that is nothing but space.
	 *
	 * <p>Spelt the same as {@link TeamWriteApi}'s and {@link PairWriteApi}'s, because it is
	 * the same sentence about a different form: what arrived cannot be acted on, and the
	 * caller can correct it by sending something else. That is what separates it from the
	 * 409 below, which is a conflict with a row already in the database and no rewriting of
	 * the request reaches.
	 */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** More characters than the box the member types into will hold. */
	static final String THE_TEXT_IS_TOO_LONG = "theTextIsTooLong";

	/** This member's words are already standing in front of a moderator. */
	static final String A_TEXT_ALREADY_WAITS = "aTextAlreadyWaits";

	/**
	 * THE TAB THIS WAITS IN, and the only one it could wait in.
	 *
	 * <p>V5 carries the six queues of the rights matrix and V9 generates
	 * {@code verification.right_code} out of the tab and keys it to them, so a row cannot
	 * stand in a tab nobody has the right to moderate. This is the tab PDL P28a,
	 * 06.08.2026 calls „Profili: trkacke biografije i profilne slike".
	 */
	private static final String THE_PROFILES_TAB = "profiles";

	/**
	 * AS MANY CHARACTERS AS THE FORM'S OWN BOX HOLDS, and the number is the owner's.
	 *
	 * <p>PDL P11, 31.07.2026: „Biografija je ogranicena na 360 znakova, bez skrola u
	 * kartici", with the arithmetic beside it - „Na trecini reda kartica prima oko
	 * cetrdeset znakova po redu i devet redova, dakle tri stotine sezdeset" - and the
	 * sentence that says where it lives: „Ogranicenje stoji na polju u formi registracije
	 * ({@code registracija.form.json})". Six hundred was struck out the same day.
	 *
	 * <p><b>Why the server says it at all, when the box already does.</b> The same reason
	 * {@link com.btl.portal.domain.registration.WhatRegistrationAsksFor} gives for deciding
	 * what is required although the form decides it too: the form is JavaScript in somebody
	 * else's browser, and a request that never passed through it is exactly the one that
	 * would put a text nine hundred characters long in front of a moderator and then onto a
	 * card that has room for nine lines. {@link TeamWriteApi} left a length out on purpose
	 * and said why - „so that the day it is enforced it is enforced in one place with a
	 * number somebody decided" - and here somebody decided it.
	 *
	 * <p><b>Written here and measured against the file, which is the floor under it.</b>
	 * {@code MeWriteApiTest} reads {@code registracija.form.json} and demands that
	 * {@code bio}'s {@code maxLength} be this number, the same arrangement
	 * {@code WhatRegistrationAsksForTest} and {@code TeamWriteApiTest} have for what their
	 * forms ask. The day the owner moves the box, the build stops until this moves with it.
	 *
	 * <p><b>Counted in the units the box counts in.</b> HTML's {@code maxlength} is a
	 * code-unit length, which is what {@link String#length()} answers, so the server and
	 * the box agree about a text rather than nearly agreeing about it.
	 *
	 * <p><b>Measured over what is STORED and not over what arrived.</b> The text is
	 * stripped on the way in, so a member who ends a full box with a newline is not refused
	 * for a character that is thrown away before the row is written.
	 */
	static final int AS_LONG_AS_THE_FORM_ALLOWS = 360;

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	/**
	 * Written by hand rather than left on the method, the same choice {@link TeamWriteApi},
	 * {@link PairWriteApi} and {@link EventWriteApi} made: see the head of this class for
	 * what it holds together and for the case that measures it.
	 */
	private final TransactionTemplate inOneTransaction;

	MeWriteApi(JdbcClient db, MemberOfAccount memberOfAccount,
			TransactionTemplate inOneTransaction) {

		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * WHAT ARRIVES, AND BOTH FIELDS ARE BOXED FOR THE SAME REASON AND NOT BY HABIT.
	 *
	 * <p>A field that was not sent and a field that was sent empty are two different
	 * requests, and a primitive cannot tell them apart. {@link PairWriteApi} boxes its own
	 * answer for the same reason - „a body that names no answer at all is a form that was
	 * not filled in, and a primitive would read it as „Odbij" and close somebody's question
	 * for him" - and here the cost of getting it wrong is worse in one direction than in
	 * the other:
	 *
	 * <p><b>{@code profileHidden} as a {@code boolean} would UNHIDE a profile nobody asked
	 * to unhide.</b> A member changing only his text sends no switch, Jackson leaves a
	 * primitive at {@code false}, and this route would publish the page of somebody who
	 * chose to be away from visitors - PDL P23's whole subject, and a privacy policy
	 * promise. Boxed, „not sent" means the column is not touched at all, and a case sends
	 * exactly that request against a member who is hidden.
	 *
	 * <p><b>{@code bio} as an empty string would queue a text nobody wrote.</b> Null means
	 * the member is not changing his words; blank means he sent a box with nothing in it,
	 * which is refused for the reason given at the head of this class.
	 *
	 * <p>There is no member number, no name, no town and no birthday choice: this route
	 * changes the caller's own record and reads who that is off the session.
	 *
	 * @param bio           what the member would say about himself, going to a moderator
	 *                      and not to the profile. Null where he is not changing it
	 * @param profileHidden whether visitors who are not signed in may reach his profile
	 *                      page. Null where he is not changing it
	 */
	record Change(String bio, Boolean profileHidden) {
	}

	/** Why a change could not be made. */
	record Refused(String reason) {
	}

	/**
	 * WHAT IS TRUE AFTER THE REQUEST, READ BACK OUT OF THE DATABASE AND NOT OFF THE
	 * REQUEST.
	 *
	 * <p>See decision 3 at the head of this class for why each of the three is here and
	 * what the answer would be claiming without it.
	 *
	 * @param bio           the text STANDING ON THE PROFILE, which is never the one this
	 *                      request sent: a new one waits for a moderator and the profile
	 *                      goes on carrying the approved words (PDL P11, 12.08.2026)
	 * @param profileHidden the flag as the row now holds it, which after a request carrying
	 *                      one IS what was sent - this half needs nobody's approval
	 * @param waiting       the key of this member's text standing in the queue undecided,
	 *                      or null where none stands. Not „what this request wrote": a
	 *                      member who sent only the switch is told about the text that was
	 *                      already waiting, because that is what is true
	 */
	record Changed(String bio, boolean profileHidden, Long waiting) {
	}

	@PutMapping(path = "/api/me", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> change(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@RequestBody Change typed) {

		Long me = memberOfAccount.competitorId(asking.account());

		/* AN ACCOUNT THAT NAMES NO MEMBER, which V23 says is the ordinary case for a
		   moderator who does not race. There is no biography to change and no profile page
		   to hide, and the answer is the one InboxApi and NotificationApi already give
		   him. */
		if (me == null) {
			return away();
		}

		/* A BODY THAT CHANGES NOTHING AT ALL. Both fields absent is a form nobody filled
		   in, not a request to leave everything as it is: answered 200 it would be the
		   portal agreeing to do nothing and reporting that it had. */
		if (typed.bio() == null && typed.profileHidden() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		if (typed.bio() != null) {
			/* AND A BOX WITH NOTHING IN IT. Absent, empty and a run of spaces are two
			   answers and not three: the first says „I am not changing my words" and the
			   other two say „I wrote nothing", which is the case the head of this class
			   refuses rather than queues. */
			if (typed.bio().isBlank()) {
				return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
			}

			/* OVER WHAT WOULD BE STORED. Stripped first, so the number this refuses is the
			   number the card would have to draw. */
			if (typed.bio().strip().length() > AS_LONG_AS_THE_FORM_ALLOWS) {
				return no(HttpStatus.BAD_REQUEST, THE_TEXT_IS_TOO_LONG);
			}
		}

		return inOneTransaction.execute(committing -> write(me, typed));
	}

	/**
	 * THE WRITING, AND IT IS ONE TRANSACTION FROM THE SWITCH TO THE QUEUE ROW.
	 *
	 * <p>The conflict is asked FIRST, before either statement, for the reason written at the
	 * head of this class: a value returned from inside {@code TransactionTemplate.execute}
	 * commits whatever has already been written, so a refusal decided after the switch had
	 * moved would be a 409 reported over a change that was kept.
	 *
	 * <p>The switch goes before the text, which is also what gives
	 * {@code TheSwitchAndTheTextAreOneThingTest} its lever: the text is the one value that
	 * reaches only the second statement.
	 */
	private ResponseEntity<?> write(long me, Change typed) {
		if (typed.bio() != null && theTextThatWaits(me).isPresent()) {
			return no(HttpStatus.CONFLICT, A_TEXT_ALREADY_WAITS);
		}

		if (typed.profileHidden() != null) {
			/* THE MEMBER THE SESSION NAMES AND NOBODY ELSE. `me` came from
			   `MemberOfAccount`, which read `account.competitor_id` off the signed in
			   account; nothing the caller sent reaches this line. */
			db.sql("update competitor set profile_hidden = ? where id = ?")
					.params(typed.profileHidden(), me)
					.update();
		}

		if (typed.bio() != null) {
			queued(me, typed.bio().strip());
		}

		return ResponseEntity.ok(whatStandsFor(me));
	}

	/**
	 * THE ROW THAT CARRIES THE TEXT TO WHOEVER DECIDES IT.
	 *
	 * <p><b>The subject is the MEMBER'S name and comes out of his own row, which is not the
	 * same value as the name on the account.</b> V9 makes {@code subject} NOT NULL because
	 * it „carries the name in every case", and the case that makes the two differ is an
	 * ordinary one rather than a curiosity: PDL P21 says a member under sixteen has his
	 * account held by a parent - „Za takmicare ispod 16 godina podatke unosi roditelj...
	 * Roditelj odrzava nalog dok dete ne napuni 16" - so {@code account.first_name} is the
	 * parent's and {@code competitor.first_name} is the child's. The card a moderator reads
	 * is about the child's profile, so it carries the child's name. Written as one
	 * statement with the name selected out of {@code competitor}, there is no Java variable
	 * in between for the other value to arrive in, and the fixture that measures it gives
	 * the account and the member different names.
	 *
	 * <p><b>Everything else about the row is the schema's.</b> {@code state} is
	 * {@code waiting} by V9's default, {@code raised_at} is V9's {@code now()} - a moment
	 * read off this server would be a second home for what time it is - and
	 * {@code right_code} is generated from the tab, so the row cannot stand where nobody
	 * may moderate it. {@code photo_id} is left null, which is this route saying it brings
	 * no picture; see decision 2 at the head of this class for what that null also does.
	 */
	private void queued(long me, String text) {
		db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " select ?, c.id, c.first_name || ' ' || c.last_name, ?"
						+ " from competitor c where c.id = ?")
				.params(THE_PROFILES_TAB, text, me)
				.update();
	}

	/**
	 * THIS MEMBER'S TEXT STANDING IN THE QUEUE UNDECIDED, OR NOTHING.
	 *
	 * <p>One home for the question, asked twice in one request: once as the guard that
	 * refuses a second text, and once as the {@code waiting} this route answers with.
	 * Written as two queries they would be two ways of arriving at one fact, free to
	 * disagree the day one of them was edited - which is {@link VerificationApi}'s own
	 * reason for reading „may he" off one list.
	 *
	 * <p><b>{@code state = 'waiting'} and not merely „a row in this tab".</b> A text that
	 * has been decided, approved or refused alike, stands in the table for ever (V9, ADL
	 * A42) and must not stop the member sending another: being refused and sending a new
	 * one is the whole errand the owner asked for on 15.08.2026.
	 *
	 * <p><b>{@code photo_id is null}</b>, which is the schema's own mark for „this item
	 * brings no picture" - see decision 2 at the head of this class, where the boundary is
	 * written out.
	 *
	 * <p><b>Oldest first with the key last, and {@code limit 1}.</b> V9 indexes the queue
	 * that way and {@link VerificationApi} reads it that way. The guard above means this
	 * route can never leave two, but a row written by anything else would otherwise turn
	 * this answer into a fault rather than into an answer, and „which of them" would depend
	 * on the order the table happens to hold them in.
	 */
	private Optional<Long> theTextThatWaits(long me) {
		return db.sql("select id from verification where competitor_id = ? and queue = ?"
						+ " and state = 'waiting' and photo_id is null"
						+ " order by raised_at, id limit 1")
				.params(me, THE_PROFILES_TAB)
				.query(Long.class)
				.optional();
	}

	/**
	 * WHAT IS TRUE ABOUT THIS MEMBER NOW, off the row and never off the request.
	 *
	 * <p>{@link TeamWriteApi} reads its answer back out of the row it wrote for the same
	 * reason, and {@link RegistrationApi} reads the address back off the account it made:
	 * handed back off the request, an answer agrees with the table on every request that
	 * worked and is a claim about nothing.
	 */
	private Changed whatStandsFor(long me) {
		return db.sql("select bio, profile_hidden from competitor where id = ?")
				.param(me)
				.query((row, one) -> new Changed(row.getString(1), row.getBoolean(2),
						theTextThatWaits(me).orElse(null)))
				.single();
	}

	/**
	 * THE ANSWER FOR AN ACCOUNT THIS ADDRESS IS NOT FOR, which carries nothing at all.
	 *
	 * <p>The shape {@link TeamWriteApi} and {@link PairWriteApi} answer with, and the head
	 * of this class says why it is a status here rather than {@code sendError}.
	 */
	private static ResponseEntity<?> away() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
