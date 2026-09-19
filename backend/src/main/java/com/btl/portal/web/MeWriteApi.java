package com.btl.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;
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
 * member does, and it is the whole of what this route offers. So it is named in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}, and since 19.09.2026 that snapshot
 * keys by the METHOD and the path together, so {@code PUT /api/me} is a line of its own
 * beside the {@code GET} that was already there.
 *
 * <p><b>That line is the correction of the same day paying for itself, and it is worth a
 * sentence because the first draft of this class said the opposite.</b> Written as bare
 * paths, the snapshot would have excused this write by a name put there for a read: the
 * address was already named, so nothing would have asked anybody about a verb added to it.
 * The line is held in BOTH directions by one case rather than two, because that snapshot is
 * compared exactly: taking the pair out fails it, and so does putting in a pair no
 * controller maps. Both were run before this was opened.
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
 * <p><b>WHAT THAT 404 HIDES IS NOT THE ADDRESS BUT THE WRITE AT IT, AND THAT SENTENCE IS
 * THE CORRECTION OF 19.09.2026.</b> {@code GET /api/me} answers the same caller 200 at the
 * same address, so the address's existence was never the thing to keep from him and no
 * other person's existence is behind this refusal. What IS kept from him is that a WRITE
 * lives here: a member-less account is offered this errand on no screen of this portal, and
 * until this round one request was enough to learn of it, because the refusal was decided
 * after the body had been read. Two things follow, and both are below rather than implied:
 * the body is not touched until „is there a member here" is answered ({@link #change}), and
 * the refusal goes down the road an address that is not there takes ({@link #away}).
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
 * So the shape is copied rather than argued: a TEXT never writes {@code competitor.bio} at
 * all, and the approval that will write it is another increment's. The boundary the other
 * way, and it is two things and not one: the SWITCH is written here and now, and so is a
 * DELETION, because nothing approves either of them.
 *
 * <p><b>2. A SECOND TEXT WHILE ONE IS WAITING IS REFUSED, AND THE PORTAL ALREADY DECIDED
 * THAT ON ITS OWN SIDE.</b> The owner settled it on 19.09.2026 - „Nov tekst o sebi se
 * ODBIJA dok prethodni ceka odluku moderatora. Odgovor je 409, i prvi tekst ostaje u redu
 * netaknut" - and his reason is the portal's own:
 * {@code pages/member/ProfileBio.tsx} draws no button while one stands, „a second ask gives
 * a moderator two texts of one person and no question to answer", and the same file names
 * the hole it could not close from a browser. The rule therefore lives twice on purpose,
 * exactly as {@link com.btl.portal.domain.registration.WhatRegistrationAsksFor} says of its
 * own: „the form is JavaScript in somebody else's browser: a registration can arrive
 * without ever having passed through it".
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
 * <li><b>AND A DELETION IS NOT A SECOND TEXT.</b> Since the owner's decision of the same
 * day, a blank {@code bio} removes what stands, at once. Asked as „{@code bio} was sent"
 * this guard would answer 409 to a member asking for his own words to come down because a
 * PROPOSAL of his is still undecided, which is a right refused on account of somebody
 * else's queue. So it asks whether a TEXT was sent, and {@link #write} carries the reason
 * and the boundary that follows.
 * </ul>
 *
 * <p><b>3. ONE ROUTE, THREE ROADS, AND THE ANSWER MUST NOT LIE ON ANY OF THEM.</b> Two of
 * the three are immediate (the switch and a deletion) and one waits (a text). The answer
 * carries three values and every one of them is read back out of the database after the
 * writing, never off the request:
 *
 * <ul>
 * <li><b>{@code bio} is the text that STANDS ON THE PROFILE</b>, which after a request
 * carrying a new one is still the old one and after a deletion is empty. Answered off the
 * request it would tell a screen that the member's unapproved words are now his profile,
 * which is the very thing decision 1 above refuses, arriving through the server instead of
 * through the table.
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
 * things stood between that sentence and this portal when this was written, and both were
 * named rather than left to be assumed: <b>{@code POST /api/inbox} was merged</b> (PR 307,
 * {@code InboxWriteApi}), so a route that puts a message in a member's box now exists; and
 * <b>a moderator's decision in the queue is the December block</b>, so there is still
 * nothing that would send one. This route writes no {@code message} and no notification,
 * invents no table and no address, and says so here. A sentence claiming somebody was
 * told when he was not is worse than the missing half.
 *
 * <h2>ADL A54, AND WHICH OF ITS TWO MEANINGS LEAVING A FIELD OUT HAS HERE</h2>
 *
 * <p><b>A54, 19.09.2026: „IZOSTAVLJENO POLJE NIKAD NE SME TIHO DA PROMENI VREDNOST. Sme da
 * znaci „ne diraj", nikad „vrati na podrazumevano"."</b> The rule asks every writing route
 * to SAY which of the two it means, in as many words, and calls a route that does not say
 * it unfinished. Here it is the first meaning, for BOTH fields and for the same reason:
 *
 * <ul>
 * <li><b>{@code profileHidden} left out means the column is not touched.</b> It is boxed as
 * a {@link Boolean} precisely so it can mean that. Read as „vrati na podrazumevano" it
 * would be {@code false}, and a member mending a sentence would publish the profile page he
 * chose to keep from visitors - PDL P23's whole subject and a promise the published privacy
 * policy makes. That is exactly the harm A54 was written against, arriving on this route.
 * <li><b>{@code bio} left out means his words are not touched.</b> Null, blank and a text
 * are three instructions and not two: leave it, remove it, propose a new one. Read as
 * „vrati na podrazumevano" the first and the second would be one, and a member changing
 * only his switch would silently lose his biography.
 * </ul>
 *
 * <p><b>The second half of A54 has no exception on any route and is obeyed here.</b> „Kad
 * se forma odbije, kaze se sta fali": a body naming neither field is answered
 * {@link NotComplete}, with {@code reason} first so every caller that reads a refusal by
 * its reason is unaffected, and {@link #WHAT_THIS_ROUTE_TAKES} beside it. This is the
 * second route on the portal to answer that shape; {@link RaceWriteApi} is the first, and
 * {@code PUT /api/events/{id}} and {@code PUT /api/moderators/{id}} still answer a bare
 * reason, which A54 carries as separate work rather than as something this branch reaches
 * into.
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
 * <li><b>A WITHDRAWAL OF A TEXT THAT IS WAITING.</b> Removing what STANDS is here; taking
 * back what a moderator is already holding is not, and the two are different things. See
 * {@link #write} for the boundary, which is written down rather than patched.
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
 * <p><b>THE WRITES ARE ONE TRANSACTION, AND THE CLAIM IS HELD IN TWO DIFFERENT WAYS
 * BECAUSE THERE ARE TWO DIFFERENT PAIRS.</b> A request carrying both halves either does
 * both or does neither: told 200 after half of it, the portal would be reporting work it
 * did not do.
 *
 * <ul>
 * <li><b>The switch and a DELETION are one statement</b> ({@link #write}), so nothing can
 * come between them. There is no lever by which a case could make half of that fail,
 * because nothing about a boolean or an empty string can be refused by
 * {@code competitor}'s constraints, and that is said out loud at {@link #write} rather than
 * left as a gap somebody finds.
 * <li><b>The switch and a TEXT are two statements, and they have a case.</b>
 * {@code TransactionTemplate} joins whatever transaction is already open, so a test-managed
 * one swallows the question entirely - measured on {@link TeamWriteApi} on 19.09.2026,
 * where taking the transaction out left its whole file green.
 * {@code TheSwitchAndTheTextAreOneThingTest} is therefore NOT {@code @Transactional} and
 * makes the SECOND statement fail with nothing stubbed: the text is the one value that goes
 * only into {@code verification}, so a text PostgreSQL cannot hold is a request whose first
 * statement succeeds and whose second does not.
 * </ul>
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
	 * A request that named neither field, and a body this portal could not read.
	 *
	 * <p>Spelt the same as {@link TeamWriteApi}'s, {@link PairWriteApi}'s and
	 * {@link RaceWriteApi}'s, because it is the same sentence about a different form: what
	 * arrived cannot be acted on, and the caller can correct it by sending something else.
	 * That is what separates it from the 409 below, which is a conflict with a row already
	 * in the database and no rewriting of the request reaches.
	 *
	 * <p>It is NOT the answer to a blank {@code bio}: since the owner's decision of
	 * 19.09.2026 that is a deletion and is carried out.
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

	/**
	 * THE TWO NAMES THIS ROUTE TAKES, which is what a request naming neither of them is
	 * told it left out.
	 *
	 * <p>ADL A54's second half: „kad se forma odbije, kaze se sta fali". Here there is
	 * exactly one way to fail it - a body naming neither field - so what is missing is
	 * everything this address accepts, and saying so is also the one place the portal tells
	 * a caller what it takes.
	 *
	 * <p><b>Written out by hand with its floor in the same commit</b>, which is
	 * {@link RaceWriteApi#NotComplete}'s own arrangement: {@code MeWriteApiTest} reads the
	 * components of {@link Change} off the record itself and demands this be exactly them,
	 * so a third field added to the request tomorrow fails the build until somebody decides
	 * whether leaving it out is a refusal.
	 */
	static final List<String> WHAT_THIS_ROUTE_TAKES = List.of("bio", "profileHidden");

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	/**
	 * The application's own reader, so a body is read exactly as {@code @RequestBody} would
	 * have read it and the only thing this class changed about reading it is WHEN. Taken
	 * from {@link InboxWriteApi}, which measured why the moment matters.
	 */
	private final ObjectMapper json;

	/**
	 * Written by hand rather than left on the method, the same choice {@link TeamWriteApi},
	 * {@link PairWriteApi} and {@link EventWriteApi} made: see the head of this class for
	 * what it holds together and for the case that measures it.
	 */
	private final TransactionTemplate inOneTransaction;

	MeWriteApi(JdbcClient db, MemberOfAccount memberOfAccount, ObjectMapper json,
			TransactionTemplate inOneTransaction) {

		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.json = json;
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
	 * <p><b>{@code bio} as an empty string would be a DELETION nobody asked for.</b> Since
	 * the owner's decision of 19.09.2026 a blank text is „skloni moju biografiju", so null
	 * and blank are two different instructions and a primitive could not carry the first.
	 *
	 * <p>There is no member number, no name, no town and no birthday choice: this route
	 * changes the caller's own record and reads who that is off the session.
	 *
	 * @param bio           what the member would say about himself. A text goes to a
	 *                      moderator and not to the profile; BLANK removes what stands
	 *                      there, at once; null leaves it alone
	 * @param profileHidden whether visitors who are not signed in may reach his profile
	 *                      page. Null leaves it alone
	 */
	record Change(String bio, Boolean profileHidden) {
	}

	/** Why a change could not be made. */
	record Refused(String reason) {
	}

	/**
	 * The same refusal, SAYING WHICH FIELDS WERE LEFT OUT.
	 *
	 * <p>ADL A54's second half, which has no exception on any route: „kad se forma odbije,
	 * kaze se sta fali". A 400 that names nothing leaves a caller with a full form and no
	 * idea which box the server could not see.
	 *
	 * <p>{@code reason} is FIRST and carries the same word a {@link Refused} would, so every
	 * caller that reads a refusal by its reason reads this one unchanged; the list is what is
	 * added, not what is swapped. That is {@link RaceWriteApi#NotComplete}'s shape and this
	 * is the second route on the portal to answer it.
	 */
	record NotComplete(String reason, List<String> missing) {
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

	/**
	 * THE BODY ARRIVES AS BYTES AND IS READ ONLY AFTER „IS THERE A MEMBER HERE" IS ANSWERED,
	 * AND THAT ORDER IS THE WHOLE OF WHY THIS SIGNATURE IS NOT {@code @RequestBody Change}.
	 *
	 * <p><b>Measured, not foreseen, and this was the THIRD route to be caught by it.</b>
	 * Written the ordinary way, a signed in account with no member behind it sent a body
	 * this portal cannot parse and was answered <b>400</b>, while the same request to an
	 * address that maps nothing answered <b>404</b>. The body is read while ARGUMENTS ARE
	 * RESOLVED, which is before the first line of this method, so the refusal below never
	 * ran. {@link InboxWriteApi} (PR 307) and {@link ModeratorWriteApi} (PR 308) were the
	 * first two, and the cause is identical on all three: „does this account name a member"
	 * is asked INSIDE the handler.
	 *
	 * <p><b>What the difference told him, and this is the correction of 19.09.2026.</b> The
	 * paragraph above about the 404 says this address's existence is not a thing to hide,
	 * because {@code GET /api/me} answers the same caller 200. That is true, and it is
	 * exactly why the leak was not about the ADDRESS: what 400 said was that a WRITE lives
	 * at it. A member-less account is never offered that write anywhere on this portal, and
	 * one request was enough to learn it exists.
	 *
	 * <p><b>Why it is not solved at the door.</b> {@link RightsAtTheDoor} decides in
	 * {@code preHandle}, before any argument is resolved, but it knows exactly two kinds of
	 * guard and „does this account name a member" is neither. A third kind would wear
	 * {@link AskedAtTheDoor}, which means „a right decides here" to every floor that counts
	 * guarded routes, and those floors would then demand that a plain MEMBER be refused this
	 * route - the opposite of what it is for. So the door is not widened; the order inside
	 * this method is fixed instead, which is what {@link InboxWriteApi} did.
	 *
	 * <p><b>AND IT IS NOT {@code @RequestBody(required = false)}</b>, which that branch tried
	 * first and measured wrong the same hour. The flag stops an absent body being an
	 * exception AND sets {@code ConsumesRequestCondition}'s own {@code bodyRequired} to
	 * false, after which that condition stops applying to a request carrying no body at all
	 * - so {@code consumes} stops guarding the very door it was added for and a write with
	 * no {@code Content-Type} goes from 404 to 400. Taking the request instead leaves that
	 * flag at its default of {@code true}.
	 *
	 * <p><b>What that costs, named rather than left to be found.</b> A body this portal
	 * cannot read is answered by this class instead of by the container: the status is the
	 * same 400 Spring answered before, and what changes is that the body now carries this
	 * class's own {@link NotComplete}. The two are one answer here on purpose, because a
	 * request whose body cannot be read is one in which no field arrived at all.
	 *
	 * @param request  the request, whose body is not touched until the line below is answered
	 * @param response asked for so a refusal can go down the same road an address that is not
	 *                 there takes
	 */
	@PutMapping(path = "/api/me", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> change(@AuthenticationPrincipal WhoIsAsking.Member asking,
			HttpServletRequest request, HttpServletResponse response) throws IOException {

		Long me = memberOfAccount.competitorId(asking.account());

		/* AN ACCOUNT THAT NAMES NO MEMBER, which V23 says is the ordinary case for a
		   moderator who does not race. There is no biography to change and no profile page
		   to hide, and the answer is the one InboxApi and NotificationApi already give him.
		   ASKED FIRST, before a byte of what he sent is looked at, for the reason above. */
		if (me == null) {
			return away(response);
		}

		Change typed = read(request.getInputStream().readAllBytes());

		/* A BODY THAT CHANGES NOTHING AT ALL, and one this portal could not read: one answer
		   and not two, because neither carries a single value this route could act on.
		   Answered 200, the first would be the portal agreeing to do nothing and reporting
		   that it had. */
		if (typed == null || (typed.bio() == null && typed.profileHidden() == null)) {
			return ResponseEntity.badRequest()
					.body(new NotComplete(THE_FORM_IS_NOT_COMPLETE, WHAT_THIS_ROUTE_TAKES));
		}

		/* OVER WHAT WOULD BE STORED. Stripped first, so the number this refuses is the
		   number the card would have to draw. A blank text is a deletion and is nought
		   characters long, so it never reaches this. */
		if (typed.bio() != null && typed.bio().strip().length() > AS_LONG_AS_THE_FORM_ALLOWS) {
			return no(HttpStatus.BAD_REQUEST, THE_TEXT_IS_TOO_LONG);
		}

		return inOneTransaction.execute(committing -> write(me, typed));
	}

	/**
	 * WHAT WAS SENT, TURNED INTO THE RECORD, OR NOTHING AT ALL.
	 *
	 * <p>The application's own {@link ObjectMapper} and not one made here, so a body is read
	 * exactly as {@code @RequestBody} would have read it - unknown fields dropped and all -
	 * and the only thing this route changed about reading it is WHEN.
	 *
	 * <p><b>Written with no condition of its own, and that is deliberate rather than
	 * terse.</b> {@code readAllBytes} answers an empty array for a request that carried
	 * nothing, and Jackson refuses empty input exactly as it refuses input it cannot parse,
	 * so a check for one would be a branch beside a road that already goes where it should.
	 */
	private Change read(byte[] sent) {
		try {
			return json.readValue(sent, Change.class);
		}
		catch (JacksonException cannot) {
			return null;
		}
	}

	/**
	 * THE WRITING, AND IT IS ONE TRANSACTION OVER AT MOST TWO STATEMENTS.
	 *
	 * <p>The conflict is asked FIRST, before either statement, for the reason written at the
	 * head of this class: a value returned from inside {@code TransactionTemplate.execute}
	 * commits whatever has already been written, so a refusal decided after the switch had
	 * moved would be a 409 reported over a change that was kept.
	 *
	 * <p><b>THE CONFLICT IS ABOUT A TEXT AND NOT ABOUT THE FIELD, WHICH IS WHAT THE OWNER'S
	 * DECISION OF 19.09.2026 CHANGED.</b> A blank {@code bio} is now a DELETION, and
	 * deleting is „pravo clana nad sopstvenim podatkom, ne predlog" (PDL P11). Asked as
	 * „{@code bio} was sent" this guard would answer 409 to a member asking for his own text
	 * to be taken down because somebody else has not yet decided a PROPOSAL of his, which is
	 * a right refused on account of a queue. So it asks „a text was sent", and the case that
	 * holds it sends a deletion from exactly that member.
	 *
	 * <p><b>THE BOUNDARY THAT FOLLOWS AND IS NOT INVENTED AWAY:</b> deleting what stands does
	 * NOT withdraw a text that is waiting. Nothing decided that it should, the two decisions
	 * of 19.09.2026 are about different things, and a member whose waiting text is later
	 * approved gets words back on a profile he had cleared. That is what the two decisions
	 * say read together; it is written here rather than quietly patched, because patching it
	 * would be this route deciding what withdrawal means.
	 *
	 * <p><b>THE SWITCH AND THE DELETION ARE ONE STATEMENT, AND THAT IS THE ANSWER TO „TOGETHER
	 * OR NOT AT ALL" RATHER THAN A CASE.</b> Both are immediate and both are columns of
	 * {@code competitor}, so they are written by a single {@code update} and there is no
	 * moment at which one could have happened and the other not. {@code coalesce} carries
	 * ADL A54's own sentence into the statement itself: a parameter that is null leaves the
	 * column exactly as it was.
	 *
	 * <p><b>What that costs, said plainly:</b> there is no lever by which a case could make
	 * half of it fail, because nothing about a boolean or an empty string can be refused by
	 * {@code competitor}'s constraints - measured against V7, which bounds the member number,
	 * the names, the gender, the basis, the birthday choice, the referral code and the town,
	 * and says nothing about these two columns. So the claim rests on there being ONE
	 * statement. What the transaction still holds, and what {@code
	 * TheSwitchAndTheTextAreOneThingTest} measures, is this statement together with the queue
	 * row, where a lever does exist.
	 */
	private ResponseEntity<?> write(long me, Change typed) {
		boolean removing = typed.bio() != null && typed.bio().isBlank();

		if (typed.bio() != null && !removing && theTextThatWaits(me).isPresent()) {
			return no(HttpStatus.CONFLICT, A_TEXT_ALREADY_WAITS);
		}

		if (typed.profileHidden() != null || removing) {
			/* THE MEMBER THE SESSION NAMES AND NOBODY ELSE. `me` came from
			   `MemberOfAccount`, which read `account.competitor_id` off the signed in
			   account; nothing the caller sent reaches this line.

			   The casts are written out rather than left to inference: a null parameter
			   arrives with no type of its own, and `coalesce` is the one place on this
			   statement where nothing else would say what it should be. */
			db.sql("update competitor set bio = coalesce(cast(? as text), bio),"
							+ " profile_hidden = coalesce(cast(? as boolean), profile_hidden)"
							+ " where id = ?")
					.params(removing ? "" : null, typed.profileHidden(), me)
					.update();
		}

		if (typed.bio() != null && !removing) {
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
	 *
	 * <p><b>The two questions are asked one after the other and not one inside the other.</b>
	 * The first draft called {@link #theTextThatWaits} from inside the {@code RowMapper},
	 * which issues a second statement while the first {@code ResultSet} is still open. It
	 * worked - this is always inside a transaction and PgJDBC buffers a whole result by
	 * default - but both of those are conditions somebody else may change without ever
	 * reading this line, and neither is written down anywhere as a promise to this class.
	 * Read out first, the answer depends on nothing but the two values.
	 */
	private Changed whatStandsFor(long me) {
		Standing standing = db.sql("select bio, profile_hidden from competitor where id = ?")
				.param(me)
				.query((row, one) -> new Standing(row.getString(1), row.getBoolean(2)))
				.single();

		return new Changed(standing.bio(), standing.profileHidden(),
				theTextThatWaits(me).orElse(null));
	}

	/** The member's own two columns, before the queue is asked about anything. */
	private record Standing(String bio, boolean profileHidden) {
	}

	/**
	 * THE ANSWER FOR AN ACCOUNT THIS ADDRESS IS NOT FOR, which carries nothing at all.
	 *
	 * <p><b>It is {@code sendError} and not a {@link ResponseEntity}, and the reason changed
	 * on 19.09.2026 along with the rest of this refusal.</b> {@link TeamWriteApi} builds its
	 * own 404 and says why it may: {@code /api/teams} is open for reading, answers a visitor
	 * 200, and says through {@code OPTIONS} that a write lives there, so „there is nothing
	 * left for the shape of this 404 to hide". Here there is. A status on the response comes
	 * back with {@code Content-Length: 0} while an address mapping nothing comes back longer
	 * and chunked, and what that difference would tell a member-less account is precisely
	 * what the line above stops him learning from the status: that a WRITE lives at an
	 * address the portal never offered him. {@link InboxWriteApi} came to the same answer on
	 * the same week.
	 *
	 * <p><b>AND A CASE ON THIS BRANCH DOES FALL WHEN THIS LINE IS TURNED INTO
	 * {@code setStatus}</b> (found on review: the paragraph used to claim none could, and
	 * that held only until the case below grew to cover this address). {@code RightsOverRealHttpTest}
	 * asks {@code PUT /api/me} of a real socket, byte for byte against its twin, in
	 * {@code aResourceWithNoMemberBehindTheAccountAnswersLikeAnAddressThatIsNotThere}, and the
	 * swap measures 367 against 225 - the same two numbers on two separate runs. MockMvc could
	 * never have shown this: it runs no ERROR dispatch at all, so a status and a
	 * {@code sendError} look alike to it, but a real socket does not agree, because
	 * {@code sendError} runs the container's ERROR dispatch and a status written onto the
	 * response does not. Both the STATUS and the SHAPE of this refusal are measured on this
	 * branch; neither is argued.
	 *
	 * <p>Returning {@code null} afterwards is how {@link InboxApi} says the same thing: the
	 * error has been committed and there is no body left to write.
	 */
	private static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
