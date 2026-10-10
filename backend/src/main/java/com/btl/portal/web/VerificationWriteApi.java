package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.event.EventAddress;
import com.btl.portal.domain.event.WhatARaceCarries;
import com.btl.portal.domain.event.WhatARaceCarries.Figures;
import com.btl.portal.domain.event.WhatAnEventCarries;
import com.btl.portal.domain.mail.WhatAResultChangeSays;
import com.btl.portal.domain.mail.WhatAResultChangeSays.Run;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.verification.DecidingOnASubmission;
import com.btl.portal.domain.verification.HoldingAnItem;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;

/**
 * A MODERATOR ANSWERING SOMETHING IN THE QUEUE, AND HOLDING IT WHILE HE READS IT.
 *
 * <p>{@link VerificationApi} serves the queue and nothing could be done with what it
 * served: „Danas se red samo cita." This is the writing half, and it is three routes
 * because the owner's decision of 18.09.2026 is about two different acts - opening
 * something to read it, and answering it - and he attached a cost to each separately.
 *
 * <p><b>THE RIGHT IS ASKED OF THE ROW AND NOT OF THE ROUTE, which is the one thing this
 * file inherits from {@link VerificationApi} and may not lose.</b> That class says why at
 * length: {@link RightIsNeeded} names ONE code, there are FIVE queues, and a single code on
 * the route „would either shut the route to four moderators out of five or open all five
 * queues to any one of them". So these routes carry no annotation either, they are named in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT} with that reason, and what opens an
 * item is {@code verification.right_code} - which V9 GENERATES as {@code 'queue:' || queue}
 * and keys to {@code admin_right(code)}, so the row itself carries the exact privilege that
 * opens it and nothing here re-derives it.
 *
 * <p><b>AND THE QUESTION IS „MAY HE MODERATE THIS ROW'S QUEUE", NEVER „DOES HE HOLD ANY
 * QUEUE AT ALL".</b> These are two sentences that behave identically against a fixture made
 * of a plain competitor, and they are the difference between a portal that works and one
 * where the moderator of comments decides payments. {@code aModeratorMayNotDecideAnItemInA
 * QueueHeDoesNotHold} is written with a moderator who genuinely holds {@code
 * queue:comments} and is answered about a {@code profiles} row, because that is the only
 * shape in which the two sentences disagree.
 *
 * <p><b>THE REFUSAL IS 404 AND IT GOES DOWN {@code sendError}.</b> ADL A8, 13.09.2026: the
 * owner decided that a moderator without the privilege is refused with 404 and not 403 - the
 * journal words the entry that way, and it is not a sentence of his - because the
 * administration draws no screen a moderator may not open and the server must not be the
 * one place that says the address is there. {@link VerificationApi} measured what an
 * imitation costs - a status written onto the response came back 262 bytes with {@code
 * Content-Length: 0} while an address that maps nothing came back 412 and chunked, which is
 * an oracle for whether an address exists, one request per guess - so the body, the headers
 * and the length are written by the same code that writes them for an address that is not
 * there. <b>An item that does not exist and an item he may not moderate take the same road
 * for the same reason</b>: told apart, the key becomes an oracle for what is in the queue.
 *
 * <p><b>WHAT IS 409 AND WHY IT IS NOT 404.</b> Three refusals here are about the STATE of
 * something the moderator may perfectly well see, and answering them 404 would be a lie he
 * can catch: he has just been served that row by {@link VerificationApi}. Somebody else
 * reading it, an item already answered, and a queue this route cannot carry out are all
 * „the address is there and the thing you asked for cannot happen now", which is what 409
 * says. {@link PaymentApi} already answers 409 to the same shape of thing.
 *
 * <p><b>THIS ROUTE CARRIES OUT FOUR QUEUES OF THE FIVE NOW, AND THE ONE LEFT IS REFUSED
 * RATHER THAN RECORDED.</b> {@code profiles} and {@code teams} were the only two anything on
 * this server could put a row into; V30 gave {@code comments} a row of its own too
 * ({@code comment_submission}), and ADL A64's A3 is the owner saying this file should carry
 * it out rather than go on only serving its fields. V30 gave {@code schedule} the identical
 * shape ({@code schedule_proposal}) and this file carried that tab out too, from the same day
 * until PDL P10a, 22.09.2026 took the tab away: „Redova je pet, ne šest."
 *
 * <p><b>{@code results} was refused until this increment for a reason that has since been
 * answered, and it is worth saying which reason, because it was never „nobody has written
 * it".</b> It was ADL A36: „sta je unutar transakcije a sta posle nje nije odluceno", and
 * recording a decision while doing nothing else would have been worse than refusing - an
 * approved result that never enters the rankings (PDL P9, „Rezultat ulazi u rang liste tek
 * posle odobrenja") has left the queue for ever and reached nothing, the one outcome a screen
 * cannot undo. The owner answered it on 21.09.2026, choosing among three outcomes offered:
 * the result and the rankings are written inside the transaction and the ducats and the post
 * go after it (that is the journal's wording of the choice, not a sentence of his), by the
 * measure he set the same day - which half
 * outcome can repair itself. So the result is written inside the transaction and the letter
 * goes after it, and the two things V25 and V32 said this increment must carry with it are
 * carried: V47 widens {@code result.distance_km} and {@link
 * com.btl.portal.domain.ranking.Totals} was taught the same width.
 *
 * <p><b>{@code payments} is the one still refused</b>, and for the reason it always was: it
 * waits on the increment that lets a member reach that tab at all.
 *
 * <p><b>A RESULT IS APPROVED AS IT WILL BE COUNTED, AND THE MODERATOR MAY SET THE RUNNER'S
 * FIGURES HIMSELF.</b> Three things decide what an approved run is worth, and each has one
 * home:
 *
 * <ul>
 * <li><b>The race, as it stands now.</b> A figure the race fixes is read off the race at the
 * moment of approval, through {@link WhatARaceCarries#figuresOf} - the same function the
 * member's own report and correction are counted by and the same one
 * {@link VerificationApi} shows the moderator his queue through, so the screen and the
 * standings cannot disagree about it.
 * <li><b>The moderator's own figures, where he sets any</b> ({@link Answered#amended}). PDL
 * P9 lets the administration change „samo činjenične podatke (vreme, dužina, uspon, spust,
 * trka, link), nikad bodove direktno" (the record's wording of a decision that carries no
 * date), and the owner's decision of 30.08.2026 is that a change made at verification is
 * explained once, in the rulebook, and not beside each run. So the figures travel and the
 * points never do. On a race in the calendar the race and its kind are not his to change
 * here - only what the race leaves to the runner, which is all
 * {@link WhatARaceCarries#figuresOf} reads off the amendment.
 * <li><b>Whether the race has been run at all</b> (see {@link #howTheRunIsCounted}).
 * </ul>
 *
 * <p><b>A RUN ON A RACE THE CALENDAR DOES NOT HOLD IS APPROVED INTO THE CALENDAR, AND THE ANSWER
 * SAYS WHICH RACE IT IS COUNTED ON</b> (R3 of the results flows). PDL P9, in the record's
 * wording: „Član sme da unese trku koje nema u kalendaru. Tada administrator kreira događaj i
 * trku uz rezultat, i sve troje nastaje istovremeno." The owner's decision of 30.08.2026 made
 * that a road with two ways along it, in his own words: „Ja kad unesem događaj i trku prilikom
 * verifikacije rezultata prvog člana, kad odem da verifikujem drugom članu mogu da zamenim
 * njegov naziv događaja i izbor trke autocompletom sad već postojeće trke." So:
 *
 * <ul>
 * <li><b>{@link Answered#newRace}</b> makes the event and the race and counts the run on them,
 * with the names and the kind the moderator settled and the time he set: the member's kind was
 * a hint („član nagoveštava vrstu, administrator odlučuje", the record's wording), and on a race
 * to a limit the time is the race's limit („a ja ću lako promeniti njegovo vreme sa recimo
 * 23:23:15 na 24:00:00", the owner).
 * <li><b>{@link Answered#raceId}</b> counts it on a race the calendar already holds, chosen by
 * the moderator, and the race answers for what it fixes, exactly as it does for a run sent
 * from the calendar.
 * <li><b>Neither</b> is refused ({@link #THE_RACE_IS_NOT_IN_THE_CALENDAR}), and so is either one
 * anywhere else - beside a refusal, on another tab, on a run whose race the calendar holds
 * already, or both at once.
 * </ul>
 *
 * <p>The event, the race, the result and the submission pointing at them are written after the
 * row is claimed and inside the one transaction, and the letter after it has committed: ADL O14,
 * the owner's choice of 21.09.2026, in the record's wording, „u transakciji su rezultat, rang
 * liste, trka i događaj ako nastaju". Duplicates are not prevented - ADL, owner, 11.09.2026, the
 * cost he accepted, in the record's wording: „kalendar dobija trke koje niko nije planirao, i
 * duplikati se ne sprečavaju" - and the same name twice in one year is told apart by a number in
 * the address rather than refused ({@link #makeTheEventAndTheRace}).
 *
 * <p><b>THE CONTRADICTION BESIDE {@code comments} IS SETTLED, NOT STILL OPEN.</b> PDL („ne
 * odbija nego brise, a napomena je neobavezna") and V9's {@code verification_refusal_says_why}
 * used to disagree, and it stood recorded in {@code PENDING.md} rather than resolved because
 * the queue held no row to settle it against. V30 resolves it the PDL way, by the owner's own
 * hand (ADL A64 A4): the constraint now carries an exception for {@code queue = 'comments'},
 * and {@link DecidingOnASubmission.Submission#reasonIsOptional} is how this file tells the
 * domain layer which row that is. What follows for THIS class is that a refusal of a comments
 * item never reaches {@link #tell} - see {@link #write} - because PDL P22, „Jedini red bez
 * njega je red komentara, gde se ne odbija nego brise, a napomena je neobavezna i namenjena
 * moderatorima" says the note is not a reason owed to the member the other four
 * queues owe one to.
 *
 * <p><b>THE SEASON A TEAM STARTS IN IS {@link SeasonClock#transfersTakeEffect} AND NOT
 * {@link SeasonClock#seasonBeingPaidFor}, and that sentence is in this file because the
 * portal has already made this exact mistake once.</b> {@code transfersTakeEffect} carries
 * the measurement: „a team proposal sent in December and approved on 5 January wrote the
 * RUNNING season, and the team counted that member's results from the middle of it"
 * (06.09.2026). The two functions differ by a whole season for nine months of the year and
 * agree for three, so a case written inside the transfer window is green whichever is read.
 * V11 says whose number it is - a proposal carries „no {@code first_season}, because which
 * season a team starts in is decided by when it is APPROVED and not by when it was asked
 * for" - and {@link TeamWriteApi} says the same from its own side. <b>It is read ONCE here
 * and used for both the team and the founder's membership</b>, so the team's first season
 * and the season its founder joined cannot come apart.
 *
 * <p><b>THE PICTURE IS CLEARED WHATEVER THE ANSWER IS, and the schema is what insists.</b>
 * {@code verification_decided_keeps_no_photo} - „state = 'waiting' or photo_id is null" -
 * means a decided row cannot hold one, so this is not a courtesy but the only way the update
 * succeeds. An approved profile picture is moved onto the member first ({@code
 * competitor.photo_id}), which is what approving one means; a refused one is simply let go,
 * and a {@code photo} row no holder points at is one {@link PhotoApi} does not serve - „a
 * row no holder points at is absent by the same sentence". <b>What is NOT here:</b> the FILE
 * on the disk. V9 says so itself - „that the FILE leaves the disk with it is the deleting
 * code's to do, and it is written down here so nobody reads this constraint as the whole of
 * it" - and the deleting code does not exist yet on either road, so this route would be the
 * first and only place doing it. That is its own work.
 *
 * <p><b>A DECISION ABOUT A PICTURE IS A DECISION ABOUT THE PICTURE THE MODERATOR SAW, and the
 * answer says which that was ({@link Answered#seenPhotoId}).</b> PDL, the owner's answer of
 * 10.10.2026 about approving, in the record's wording: „Odobrava se samo slika koju je moderator
 * video (odluka nosi otisak; promenjena slika se odbija rečenicom)." And his answer of the same
 * day about refusing, which he chose between the outcomes offered: „Obe odluke o profilnoj slici,
 * odobravanje i odbijanje, važe samo za sliku koju je moderator video; ako je slika u međuvremenu
 * promenjena, odluka se odbija istom rečenicom „Slika je promenjena, pogledaj je ponovo." i red
 * ostaje." The cost accepted earlier stands beside it unchanged (PDL, 27.09.2026, the boundary
 * the record names, in its wording and not in a sentence of his): „ako član pregazi sliku dok je
 * moderator gleda, red mu se promeni pod rukom; po pravilu da red ostaje jedan to je
 * prihvatljivo." What is new is only what that costs the moderator: until this decision his press
 * published the NEW picture, which nobody had looked at, and the league has members under age.
 *
 * <p><b>HOW IT IS CARRIED OUT IS MY CHOICE AND NOT THE OWNER'S: he chose the outcome.</b> The
 * claim of the row is the comparison ({@link #write}): the statement that takes the row also
 * demands that it still holds the picture named, and a miss is told apart from a row decided by
 * somebody else by reading the row again. A question asked in Java before the claim would be a
 * check-then-act, the shape {@code VerificationDecisionConcurrencyTest} measured to pass every
 * sequential case and fail only under concurrency: {@code MePhotoApi.send} repoints the row
 * under a lock this route does not take until its claim, so only the statement that waits for
 * that lock sees what the send left. Nothing is asked of the row before the claim except the
 * shape of the request ({@link #whyThePictureIsNotNamedRight}), which needs no lock.
 *
 * <p><b>WHAT THE MEMBER IS TOLD, AND WHAT HE IS NOT.</b> A refusal reaches his inbox with
 * the reason in it, from every queue and not only from his profile: PDL P22, 15.08.2026,
 * „Poruka o odbijanju ide sa svih redova verifikacije, ne samo sa trkackog profila". The
 * same decision says where it lands - the reason reaches the inbox of whoever sent the item
 * in - but that is a SECOND sentence further down, and joining the two with an ellipsis left
 * a quotation that exists nowhere, which is what the citation floor caught.
 * An approved team reaches him too, which
 * is the owner's own sentence of 03.08.2026: „clanu odmah treba da stigne obavestenje u
 * portal inboks da je njihov tim prihvacen i od tog trenutka imaju Admin prava za svoj tim".
 * An approved PROFILE does not, and that is
 * absence rather than omission - nothing decided that it should, and ADL P-javno's rule is
 * to leave out rather than to serve „za svaki slucaj".
 *
 * <p><b>The message names the PORTAL and not the moderator.</b> Who decided is kept on the
 * row ({@code decided_by_name}, V9) because „a decision is the same shape of fact: it was
 * made, it stays made, and it says by whom"; whether the member is shown that name is a
 * different question and nothing has answered it. Told under the portal's name the answer is
 * complete and no name has been handed out that nobody decided to hand out.
 *
 * <p><b>AND A ROW MAY BE ABOUT NOBODY, which is ordinary rather than a curiosity.</b> V9
 * makes {@code competitor_id} nullable on purpose - „A payment waiting to be recognised may
 * be about a person who is not one yet" - so a decision must not fall over a row that names
 * no member, and there is simply nobody to write to. The same is true of the moderator whose
 * hold the superadmin takes away: V23 says an account naming no member is the ordinary case
 * for a moderator who does not race, so he is told if there is an inbox to tell and the hold
 * is taken away either way. Both are cases rather than branches nobody reaches.
 */
@RestController
class VerificationWriteApi {

	private static final Logger LOG = LoggerFactory.getLogger(VerificationWriteApi.class);

	/** {@code verification.queue} for the three tabs this route can carry out. */
	private static final String PROFILES = "profiles";

	private static final String TEAMS = "teams";

	/** ADL A64, 22.09.2026: the row whose refusal needs no reason (A4) and whose approval
	 *  publishes a row into {@code event_comment} rather than refusing 409 (A3). */
	private static final String COMMENTS = "comments";

	/** V10's own tab, and the one whose approval writes the first {@code result} row this
	 *  server has ever written. */
	private static final String RESULTS = "results";

	/**
	 * THE TABS AN APPROVAL HERE KNOWS WHAT TO DO WITH.
	 *
	 * <p>A written list, and the floor under it asks the DATABASE for every queue there is
	 * ({@code admin_right where scope = 'queue'}) and requires each one to be either carried
	 * out or refused with the reason below. A sixth tab, or a fifth that grows a
	 * consequence, fails that case until somebody decides what it means - which is the
	 * opposite of a list that quietly goes on being four-fifths right.
	 *
	 * <p>A fourth name stood here from V30 until PDL P10a, 22.09.2026: {@code SCHEDULE}, the
	 * row whose approval moved an event and its races (ADL A64 A3). The tab left „Redova je
	 * pet, ne šest", and {@code moveTheEvent}, {@code scheduleMoveBehind} and
	 * {@code ScheduleMove} left with it rather than standing here unreachable.
	 *
	 * <p><b>{@code RESULTS} joined it on the day ADL A36's boundary stopped being open.</b>
	 * The reason this tab was refused was never that nobody had written the code: it was that
	 * „sta je unutar transakcije a sta posle nje nije odluceno", and an approved result that
	 * never entered the rankings would have left the queue for ever and reached nothing. The
	 * owner answered it on 21.09.2026, choosing among three outcomes offered: the result and
	 * the rankings inside the transaction, the ducats and the post after it (the journal's
	 * wording of the choice, not a sentence of his) - by the measure he set the same day,
	 * which of the half outcomes
	 * can repair itself: a result without its post is repaired by sending it again, a ducat
	 * without its result is not. So this class now writes the result inside and posts outside,
	 * and {@code payments} is the one name left out, still waiting on the increment that lets
	 * a member reach that tab at all.
	 */
	private static final Set<String> CARRIED_OUT_HERE = Set.of(PROFILES, TEAMS, COMMENTS, RESULTS);

	private static final String NOT_DECIDED_ON_THIS_PORTAL_YET =
			"Odluka o ovom redu još nije uvedena.";

	private static final String SOMEBODY_ELSE_IS_READING_IT =
			"Stavku trenutno drži drugi moderator.";

	private static final String SOMEBODY_ANSWERED_IT_ALREADY = "O stavci je već odlučeno.";

	private static final String A_REFUSAL_NEEDS_A_REASON = "Uz odbijanje je razlog obavezan.";

	private static final String THE_FORM_IS_NOT_COMPLETE = "Forma nije popunjena.";

	private static final String THE_NAME_IS_TAKEN = "Tim sa tim nazivom već postoji.";

	private static final String HE_IS_ALREADY_IN_A_TEAM = "Osnivač je već u nekom timu.";

	/**
	 * THE PICTURE THE MODERATOR SAW IS NOT THE ONE THE ROW HOLDS NOW: NOTHING IS DECIDED AND THE ROW
	 * STAYS.
	 *
	 * <p>The owner's sentence, PDL 10.10.2026, said whole: „Slika je promenjena, pogledaj je
	 * ponovo." The same one for both answers, the approval and the refusal („odluka se odbija
	 * istom rečenicom"). 409 for the reason the head of this class gives: he can see the row, and
	 * what he asked for cannot happen as he asked it.
	 *
	 * <p><b>A sentence of the server, like every refusal of this route, and not a code the screen
	 * looks up</b> (the head of {@code admin/verificationWrites.ts} says why this route answers in
	 * words). So the dictionary has no key for it and there is no English one: every other sentence
	 * of this route is Serbian only as well. The words are the ones of the outcome he chose, so
	 * they are written here as the record has them, full stop included.
	 */
	private static final String THE_PICTURE_WAS_CHANGED = "Slika je promenjena, pogledaj je ponovo.";

	/**
	 * THE KEY OF A SEEN PICTURE BESIDE A DECISION THAT HAS NO PICTURE: a form fault, so 400.
	 *
	 * <p>The rule this route keeps for every field that rides with one kind of decision only
	 * ({@link #AN_AMENDMENT_GOES_WITH_AN_APPROVED_RUN}, {@link
	 * #A_RACE_IS_NAMED_ONLY_FOR_A_RUN_NOT_IN_THE_CALENDAR}): taken and quietly dropped, it would
	 * tell whoever sent it that it was kept. Nothing on the portal sends one there; the sentence is
	 * for a request that did not come from the screen.
	 */
	private static final String A_SEEN_PICTURE_GOES_WITH_A_DECISION_ABOUT_ONE =
			"Viđena slika se zadaje samo uz odluku o slici.";

	/**
	 * A RUN ON A RACE THE CALENDAR DOES NOT HOLD IS NOT APPROVED BY A PLAIN YES: THE ANSWER HAS
	 * TO SAY WHICH RACE IT IS COUNTED ON.
	 *
	 * <p>Since R3 of the results flows such a run is approved here, on one of two roads the
	 * answer names ({@link Answered#newRace} or {@link Answered#raceId}, see the head of this
	 * class). An approval that names neither is refused, and that is a choice made with the plan
	 * of R3 rather than a decision of the owner's: an approval that wrote an event and a race into
	 * the public calendar out of what the member typed, with nobody having said so, would be a
	 * field left out that quietly changed something (ADL A8, owner, 19.09.2026: „Izostavljeno
	 * polje nikad ne sme tiho da promeni vrednost"). It is 409 for the reason the head of this
	 * class gives: he can see the row, and what he asked for cannot happen as he asked it.
	 *
	 * <p><b>{@code result.race_id} is {@code not null}</b>, so the approval this refuses could
	 * not be carried out as sent: left unsaid, it would either fall over as a server fault or,
	 * worse, be recorded while writing nothing.
	 */
	private static final String THE_RACE_IS_NOT_IN_THE_CALENDAR =
			"Trke nema u kalendaru: uz odobrenje upiši novu trku ili izaberi postojeću.";

	/**
	 * THE RACE IS NAMED BY THE ANSWER ONLY WHERE THE CALENDAR DOES NOT HOLD IT, AND ONLY BESIDE
	 * AN APPROVAL.
	 *
	 * <p>Beside a refusal nothing is counted, on another tab there is no run, and a run on a race
	 * the calendar holds already has its race, which an approval here does not change (R1, „On a
	 * race in the calendar the race and its kind are not his to change here"). Taken and quietly
	 * dropped, any of the three would tell the moderator his race was kept, which is the reason
	 * {@link #AN_AMENDMENT_GOES_WITH_AN_APPROVED_RUN} gives for the figures. A form fault and not
	 * a state, so 400.
	 */
	private static final String A_RACE_IS_NAMED_ONLY_FOR_A_RUN_NOT_IN_THE_CALENDAR =
			"Trka se zadaje samo uz odobrenje prijave sa trke van kalendara.";

	/** A new race and a race of the calendar named in one answer, which no row could be. */
	private static final String THE_RACE_IS_NAMED_TWICE =
			"Trka je zadata dvaput: ili nova ili postojeća.";

	/**
	 * A race of the calendar named by a key no race answers to: a form fault about the race the
	 * form carries, the shape {@code ResultWriteApi.THE_RACE_IS_NOT_KNOWN} answers the member's
	 * own report with, and 400 for the reason {@code RaceWriteApi} gives for an event nobody has -
	 * the run being decided is not the thing that is missing.
	 */
	private static final String THE_RACE_IS_NOT_KNOWN = "Te trke nema u kalendaru.";

	/**
	 * AND A ROW IN THE RESULTS TAB THAT NAMES NO SUBMISSION AT ALL, which the schema permits
	 * on purpose and this route therefore may not fall over.
	 *
	 * <p>V10 says so in as many words beside the constraint, and says it is one-directional
	 * deliberately: „A results row without a submission is a real thing... so the other
	 * direction would be false." Nothing on this server writes such a row today -
	 * {@link ResultWriteApi#queue} always names the submission it just made - but a route that
	 * read the pointer without asking would answer a state the schema allows with a server
	 * fault, and a 500 tells the moderator nothing he can act on.
	 */
	private static final String THE_ITEM_CARRIES_NO_RUN =
			"Stavka ne nosi prijavljen rezultat.";

	/**
	 * A RUN ON A RACE THAT HAS NOT BEEN RUN YET, which the calendar can make of a run that was
	 * sent on the right day by moving the race afterwards, and which a moderator choosing a race
	 * for a run the calendar did not hold can name (see {@link #howTheRunIsCounted}). 409,
	 * because the moderator can see the row and what he asked for cannot happen now.
	 */
	private static final String THE_RACE_HAS_NOT_BEEN_RUN_YET =
			"Trka još nije održana, pa rezultat ne može da se odobri.";

	/**
	 * FIGURES OF THE MODERATOR'S OWN, SENT WHERE NOTHING COUNTS THEM: beside a refusal, or on a
	 * tab whose items are not runs. A form fault and not a state, so 400.
	 */
	private static final String AN_AMENDMENT_GOES_WITH_AN_APPROVED_RUN =
			"Izmena vrednosti ide samo uz odobrenje rezultata.";

	/* PDL P10b, owner 22.09.2026: an event with a result already written may not be moved
	   across 1 January on the race that result was run at. This route asked that question
	   of its own approvals, over a schedule proposal's move, from V30 until PDL P10a,
	   22.09.2026 took the queue away the same day: „Ovo nikad nije bilo o prijavi termina...
	   bilo bi dostizno i da prijave nikad nije bilo." The guard itself is untouched and
	   lives where it always did, {@code EventWriteApi.wouldStrandAResultInAnotherYear},
	   asked from the event's own screen; only the second road to it, through an approval
	   here, is gone. */

	/** Who the member hears from, which is the league and never the moderator by name. */
	private static final String THE_PORTAL = "Verifikacija";

	private final JdbcClient db;

	private final WhatHeMayDo mayHe;

	private final TransactionTemplate inOneTransaction;

	/**
	 * @param clock the bean and never {@code Instant.now()}, which is what makes the
	 *              difference between a hold of three minutes and one of sixteen something a
	 *              case can state instead of wait for ({@code WhatTimeItIs})
	 */
	private final Clock clock;

	/**
	 * ONE HOME FOR „WHICH MEMBER IS BEHIND THIS ACCOUNT", rather than a second statement
	 * here saying the same thing.
	 *
	 * <p>{@link MemberOfAccount} already answers it and already carries the reason it is
	 * written the way it is: {@code JdbcClient.single()} refuses a null result outright even
	 * when exactly one row came back, which is precisely the ordinary case an account naming
	 * no member is (V23). A copy of that query here would be the same fact in two places, and
	 * the copy is the one that gets it wrong.
	 */
	private final MemberOfAccount memberOfAccount;

	/**
	 * THE ONE PLACE THAT ANSWERS „HAS HE FINISHED AN OFFICIAL SEASON OVER THE THRESHOLD",
	 * asked here rather than written again.
	 *
	 * <p>Its own note says why an approval needs nothing else: „Nothing here is triggered BY a
	 * verification - the answer simply changes the moment the row it approved exists, which is
	 * why the right is never stored". So this class does not write a category anywhere and
	 * there is no column for it to get wrong. What it asks this for is the one thing that does
	 * NOT follow by itself: whether the answer moved, so the member can be told (PDL,
	 * 27.09.2026).
	 */
	private final BestOfficialSeason bestOfficialSeason;

	private final Postman postman;

	/**
	 * The one the rest of this application reads bodies with, asked for rather than made, so that a
	 * body read here is read exactly as {@code @RequestBody} would have read it and the only thing
	 * that changed about reading it is WHEN.
	 */
	private final ObjectMapper json;

	/** The league's own address, which the letter about an approved run is blind-copied to
	 *  ({@link #post} carries why). Configured rather than written here for the reason
	 *  {@code application.properties} gives beside it. */
	private final String theLeague;

	VerificationWriteApi(JdbcClient db, WhatHeMayDo mayHe, TransactionTemplate inOneTransaction,
			Clock clock, MemberOfAccount memberOfAccount, BestOfficialSeason bestOfficialSeason,
			Postman postman, ObjectMapper json, @Value("${btl.mail.league}") String theLeague) {
		this.db = db;
		this.mayHe = mayHe;
		this.inOneTransaction = inOneTransaction;
		this.clock = clock;
		this.memberOfAccount = memberOfAccount;
		this.bestOfficialSeason = bestOfficialSeason;
		this.postman = postman;
		this.json = json;
		this.theLeague = theLeague;
	}

	/** Why something was refused, the shape every writing route on this server answers with. */
	record Refused(String reason) {
	}

	/**
	 * @param id         the item he now holds
	 * @param secondsLeft how long he has, which follows from the quarter of an hour the owner
	 *                    chose (PDL, 18.09.2026) and which the journal derives as an obligation
	 *                    rather than a nicety: the portal must tell the moderator how much is
	 *                    left before he decides - the journal's derivation, not his sentence
	 */
	record Held(long id, long secondsLeft) {
	}

	/**
	 * @param approved what he pressed
	 * @param reason   what he typed, which only a refusal uses and which
	 *                 {@link DecidingOnASubmission#reasonAsItGoesIn} rather than this route
	 *                 decides the fate of
	 * @param amended  the figures the moderator puts in place of the runner's, on an approved
	 *                 run and nowhere else. <b>Left out, it means „do not touch": the run is
	 *                 counted at the figures it was sent with.</b> It never means „put them
	 *                 back to anything" (ADL A8, 19.09.2026: „Izostavljeno polje nikad ne sme
	 *                 tiho da promeni vrednost", and a route has to say which of the two
	 *                 readings its omission has - this is that sentence for this field)
	 * @param newRace  the event and the race an approval writes into the calendar, on a run
	 *                 whose race the calendar does not hold. Left out, nothing is written into
	 *                 the calendar at all: see {@link #THE_RACE_IS_NOT_IN_THE_CALENDAR}
	 * @param raceId   the race of the calendar such a run is counted on instead, named by its
	 *                 key (PDL P9, owner, 30.08.2026: „kad odem da verifikujem drugom članu mogu
	 *                 da zamenim njegov naziv događaja i izbor trke autocompletom sad već
	 *                 postojeće trke"). How the races to choose from are offered is the screen's
	 *                 to settle, not this route's: the route takes a key and answers for it. Never
	 *                 beside {@code newRace}: a run is counted on one race
	 * @param seenPhotoId the key of the picture the moderator had in front of him when he
	 *                    answered, which is {@code verification.photo_id} as the queue served it
	 *                    ({@code photoId}). <b>Asked of EVERY decision about a row that holds a
	 *                    picture, the refusal as much as the approval</b> (PDL, 10.10.2026: „I
	 *                    odbijanje slike traži viđenu sliku."), and refused beside any other
	 *                    ({@link #A_SEEN_PICTURE_GOES_WITH_A_DECISION_ABOUT_ONE}). Left out of a
	 *                    decision about a picture it is a form not filled in, never „do not
	 *                    check": a field whose absence switched the check off would be a check
	 *                    anybody could skip (ADL A8, owner, 19.09.2026: „Izostavljeno polje nikad
	 *                    ne sme tiho da promeni vrednost").
	 *                    <p><b>The key and not a digest of the bytes, and that is a technical
	 *                    choice of mine</b> (the owner chose the outcome: „odluka nosi otisak
	 *                    viđene slike"). It needs nothing new on the queue's answer, because
	 *                    {@code photoId} is already served and is already what decides that a card
	 *                    draws a picture at all. And it is the stricter of the two: a key is issued
	 *                    once and never again, so a picture replaced and then replaced back by the
	 *                    same bytes is a different picture to it, which a digest would call
	 *                    unchanged. <b>Its one cost, named so it is not found:</b> the same file
	 *                    sent again is a new key too, so a decision about the old one is refused
	 *                    ({@link #THE_PICTURE_WAS_CHANGED}), which is the safe direction.
	 *                    <p><b>And a limit, also named:</b> a circle moved over the same picture is
	 *                    NOT a change of key ({@code MePhotoApi.send} moves it on the row that is
	 *                    there). That is right while the moderator is shown the whole original and
	 *                    never the circle, which is what the queue draws today (the note on
	 *                    {@code PhotoApi.waitingOn}). The day it draws the circle as the owner
	 *                    decided on 27.09.2026 (PDL: „Moderator mora da vidi sliku koju odobrava, i
	 *                    to kao isečak sa zatamnjenim ostatkom, a ostatak se nazire."), a moved
	 *                    circle is something he has or has not seen, and this key will not say
	 *                    which
	 */
	record Answered(Boolean approved, String reason, Amended amended, NewRace newRace, Long raceId,
			Long seenPhotoId) {
	}

	/**
	 * THE EVENT AND THE RACE AN APPROVAL WRITES INTO THE CALENDAR, as the moderator settles them.
	 *
	 * <p>PDL P9, the owner's decision of 30.08.2026 in the record's wording: „Verifikacija menja
	 * naziv događaja, naziv trke, vrstu i vreme, i upisuje događaj i trku u kalendar." The names
	 * and the kind are here; the time is the amendment's ({@link Answered#amended}), because it
	 * is one of the four figures and they travel together. <b>The day and the town are not
	 * here</b>: they are what the member gave (V10 collects them „at the moment somebody knows
	 * them"), and that decision does not name them among what verification changes.
	 *
	 * <p><b>All three are asked for, and none of them falls back on what the member typed.</b> A
	 * blank one is a form not filled in. A default here would be the second meaning of an omitted
	 * field that ADL A8 forbids, „vrati na podrazumevano". What the moderator is offered to start
	 * from is the screen's to show, because the screen is the one place that knows what he saw.
	 *
	 * @param raceKind one of {@link WhatARaceCarries#KINDS}: the member's choice was a hint, and
	 *                 this is the decision (PDL P9, 30.08.2026, „član nagoveštava vrstu,
	 *                 administrator odlučuje")
	 */
	record NewRace(String eventName, String raceName, String raceKind) {
	}

	/**
	 * THE FOUR FIGURES OF A RUN AS THE MODERATOR SETS THEM, in the shape and under the names
	 * the member's own correction carries them ({@code ResultWriteApi.Correction}).
	 *
	 * <p><b>All four may travel, and the ones the race fixes are not read</b>, which is that
	 * same route's rule and its reason: which figures a race fixes is
	 * {@link WhatARaceCarries#figuresOf}'s answer and not the caller's, so the screen sends what
	 * it holds and one place decides. A figure the race leaves to the runner and the amendment
	 * leaves out is not a figure at all, and the approval is refused as a form not filled in
	 * rather than counted with nothing in it.
	 */
	record Amended(BigDecimal distanceKm, Integer ascentM, Integer descentM, Integer seconds) {

		Figures figures() {
			return new Figures(distanceKm, ascentM, descentM, seconds);
		}
	}

	/**
	 * @param id    the item
	 * @param state what it now is, read back from the row and not from the request
	 */
	record Decided(long id, String state) {
	}

	/**
	 * HE OPENS SOMETHING TO READ IT, AND NOBODY ELSE MAY TOUCH IT FOR FIFTEEN MINUTES.
	 *
	 * <p>Renewing is the same act as taking: a moderator still reading asks again and his
	 * spell starts over, which is what keeps a long read from losing the item under his
	 * hand. Written as two routes, „take" would have to refuse the holder his own item.
	 *
	 * @param response asked for so a refusal can go down the same road an address that is
	 *                 not there takes, exactly as {@link VerificationApi#verification} does
	 */
	@PostMapping("/api/verification/{id}/hold")
	ResponseEntity<?> hold(@PathVariable AKey id,
			@AuthenticationPrincipal WhoIsAsking.Member asking,
			HttpServletResponse response) throws IOException {

		Optional<Item> item = itemHeMayModerate(id, asking);

		if (item.isEmpty()) {
			return away(response);
		}

		/* AND NOTHING IS HELD IN A TAB THIS ROUTE CANNOT ANSWER. Without this a moderator
		   of payments or results could take an item and watch fifteen minutes count down
		   towards a decision that is refused 409 whatever he presses, which is a worse
		   answer than the refusal itself: it is the refusal, fifteen minutes late. */
		if (!CARRIED_OUT_HERE.contains(item.get().queue())) {
			return no(HttpStatus.CONFLICT, NOT_DECIDED_ON_THIS_PORTAL_YET);
		}

		Instant now = clock.instant();

		/* NOTHING IS HELD IN ORDER TO BE READ ONCE IT HAS BEEN ANSWERED. Asked after the
		   hold below it would let a moderator take a spell on a row nobody can do anything
		   with, and the screen would count down fifteen minutes towards a refusal. */
		if (!DecidingOnASubmission.WAITING.equals(item.get().state())) {
			return no(HttpStatus.CONFLICT, SOMEBODY_ANSWERED_IT_ALREADY);
		}

		if (HoldingAnItem.mayTouch(item.get().hold(), asking.account(), now)
				!= HoldingAnItem.Answer.GO_AHEAD) {
			return no(HttpStatus.CONFLICT, SOMEBODY_ELSE_IS_READING_IT);
		}

		Instant until = HoldingAnItem.endOfAQuietSpell(now);

		/* THE CLAIM ITSELF, AND THE CHECK ABOVE IS NOT IT.
		 *
		 * Measured on 21.09.2026, two moderators on a barrier against a free item: BOTH were
		 * answered 200 twelve times out of twelve. The Java check passed for both - nothing
		 * held the row when either of them looked - and `on conflict do update` with no
		 * condition then let the second overwrite the first and reported success. One row in
		 * the table, which the old note here said and was right about, and two men told the
		 * item was theirs, which it did not say and which is what a moderator sees.
		 *
		 * So the condition is written where the row is locked. `insert ... on conflict` takes
		 * the conflicting row's lock, so the second statement evaluates its WHERE against
		 * what the first really wrote, and the answer is a count rather than a belief. It
		 * updates only when the hold is HIS (renewing, which must go on working) or when the
		 * one there has run out. Otherwise nought rows, and nought rows is 409.
		 *
		 * The edge is the one `HoldingAnItem.stillRunning` writes - strictly after - so
		 * `held_until <= now` is „run out" on both sides and neither can move without the
		 * other. This is the shape `JoiningATeam` already names: a question answered a moment
		 * earlier for the sake of a sentence the caller can read, with the database behind it
		 * as the one that actually decides. */
		int taken = db.sql("insert into verification_lock (verification_id, held_by, held_until)"
						+ " values (?, ?, ?)"
						+ " on conflict (verification_id) do update"
						+ " set held_by = excluded.held_by, held_until = excluded.held_until"
						+ " where verification_lock.held_by = excluded.held_by"
						+ "    or verification_lock.held_until <= ?")
				.params(item.get().id(), asking.account(), Timestamp.from(until),
						Timestamp.from(now))
				.update();

		if (taken == 0) {
			return no(HttpStatus.CONFLICT, SOMEBODY_ELSE_IS_READING_IT);
		}

		return ResponseEntity.ok(new Held(item.get().id(), HoldingAnItem.leftOf(
				new HoldingAnItem.Hold(asking.account(), until), now).toSeconds()));
	}

	/**
	 * HE IS DONE WITH IT, OR THE SUPERADMIN TAKES IT OFF SOMEBODY WHO IS NOT.
	 *
	 * <p><b>The second half is the owner's choice, with its cost priced and accepted</b>
	 * (PDL, 18.09.2026, among the outcomes offered): the superadmin may take another's hold
	 * away and the one it is taken from is told, so that a stuck item always has a way out that
	 * does not need the database. The cost he accepted, as the journal records it: one route
	 * more and one message in the inbox, so that a moderator does not find out only when his
	 * decision is refused. This is that one route, and the message is written below.
	 *
	 * <p><b>It is the SUPERADMIN and not „a moderator holding everything".</b>
	 * {@link WhatHeMayDo#holdsEveryRightThereIs} reads V5's {@code rights_mode = 'all'} off
	 * the ROLE, which a partial unique index makes at most one role carry;
	 * {@link OnlyTheSuperadmin} sets out at length why a fully ticked moderator must still
	 * be refused, and asking the mode is what refuses him.
	 *
	 * <p>Letting go of nothing answers the same as letting go of your own, because both
	 * leave the item free and a moderator closing a screen twice has done nothing wrong.
	 */
	@DeleteMapping("/api/verification/{id}/hold")
	ResponseEntity<?> letGo(@PathVariable AKey id,
			@AuthenticationPrincipal WhoIsAsking.Member asking,
			HttpServletResponse response) throws IOException {

		Optional<Item> item = itemHeMayModerate(id, asking);

		if (item.isEmpty()) {
			return away(response);
		}

		HoldingAnItem.Hold hold = item.get().hold();

		if (hold == null) {
			return ResponseEntity.noContent().build();
		}

		boolean his = HoldingAnItem.mayTouch(hold, asking.account(), clock.instant())
				== HoldingAnItem.Answer.GO_AHEAD;

		if (!his && !mayHe.holdsEveryRightThereIs()) {
			return no(HttpStatus.CONFLICT, SOMEBODY_ELSE_IS_READING_IT);
		}

		return inOneTransaction.execute(committing -> {
			db.sql("delete from verification_lock where verification_id = ?")
					.param(item.get().id()).update();

			/* AND HE LEARNS IT, which is the half of the owner's answer that costs the
			   message. Only when it was somebody else's and only when there is an inbox to
			   write to: a moderator who does not race has no `competitor` row (V23) and
			   `message.to_id` points at one. */
			if (!his) {
				tell(memberOfAccount.competitorId(hold.heldBy()), "Stavka vam je oduzeta",
						"Superadmin je preuzeo stavku koju ste držali u redu za verifikaciju.");
			}

			return ResponseEntity.noContent().build();
		});
	}

	/**
	 * HE ANSWERS IT, AND IT LEAVES THE QUEUE FOR EVERYBODY AT ONCE.
	 *
	 * <p>That last part needs no code and is the point: {@link VerificationApi} serves only
	 * {@code state = 'waiting'}, so the moment this writes a state the row is gone from
	 * every moderator's screen. The owner asked for exactly that - „kad moderator odluci,
	 * automatski se skida svim ostalima" - and a second mechanism that removed it would be a
	 * second home for what „waiting" means.
	 *
	 * @param request  the request, whose body is not touched until „may he" is answered
	 * @param response asked for so a refusal can go down the same road an address that is
	 *                 not there takes
	 */
	@PostMapping(path = "/api/verification/{id}/decision", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> decide(@PathVariable AKey id, @AuthenticationPrincipal WhoIsAsking.Member asking,
			HttpServletRequest request, HttpServletResponse response) throws IOException {

		/* THE DOOR FIRST, AND NOTHING ABOUT THE BODY BEFORE IT. Measured on a real socket
		   on 21.09.2026: asked the other way round, a plain competitor holding nothing sent
		   `{}` and got 400 in 348 bytes, while the same body on a sibling address that maps
		   nothing got 404 in 425. One request, and he has learnt that an administrative
		   action lives at that address - which is the whole of what ADL A8 forbids (the owner's
		   own words in that section, of 30.07.2026: „Ne treba ni da budu svesni moderatori da
		   postoje akcije koje im nisu dodeljene."). It did not leak WHICH items exist; it leaked that
		   the route does, which is the same oracle one level up. A refusal about the form is
		   a refusal only somebody who may decide is entitled to hear.

		   AND THE BODY IS READ BY THIS METHOD, which is why it takes the request and not
		   `@RequestBody`. Measured over a socket on 02.10.2026: with the body bound as an argument,
		   a body that is not JSON, or none at all, was answered 400 in 427 bytes to a competitor
		   holding nothing, where the address that maps nothing answers 404 in 425. The same
		   oracle, because arguments are bound before the first line of this method and the door
		   below never ran. Taking the request leaves `consumes` asking about the type before
		   anything is dispatched, and nothing is read until the door has said yes. The shape is
		   `InboxWriteApi.write`'s.

		   AND NOTHING ABOUT THE KEY EITHER, which is why it arrives as an `AKey`. A word in the
		   key's place used to be answered 400 by Spring before this method ran, to EVERY signed-in
		   asker, while a number was 404 for him; now it is the key no row has, and it is answered as
		   an item that is not there, by the one line that answers that (`itemHeMayModerate`).
		   `hold` and `letGo` take it the same way. */
		Optional<Item> found = itemHeMayModerate(id, asking);

		if (found.isEmpty()) {
			return away(response);
		}

		Item item = found.get();

		/* AN EMPTY OBJECT, A BODY THAT IS NOT JSON AND NO BODY AT ALL ARE ONE ANSWER, which is the
		   one `InboxWriteApi` gives the same three: none of them carries a value this route could
		   act on, and the caller who sees it is by now somebody who may take this item. */
		Answered typed = read(request);

		if (typed == null || typed.approved() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		/* FIGURES OF HIS OWN TRAVEL WITH AN APPROVED RUN AND WITH NOTHING ELSE. On a refusal they
		   would be figures nobody counts, and on another tab figures for a thing that has none;
		   taken and quietly dropped, either would tell the moderator his numbers were kept, which
		   is the reason `EventWriteApi` refuses a country beside a codebook town rather than
		   dropping it. */
		if (typed.amended() != null && !(typed.approved() && RESULTS.equals(item.queue()))) {
			return no(HttpStatus.BAD_REQUEST, AN_AMENDMENT_GOES_WITH_AN_APPROVED_RUN);
		}

		/* AND THE RACE A RUN IS COUNTED ON THE SAME WAY, for the same reason. Whether the run's
		   race is one the calendar holds is the row's to answer and is asked in `write`; what can
		   be answered from the request alone is answered here, before anything else is asked. */
		if ((typed.newRace() != null || typed.raceId() != null)
				&& !(typed.approved() && RESULTS.equals(item.queue()))) {
			return no(HttpStatus.BAD_REQUEST, A_RACE_IS_NAMED_ONLY_FOR_A_RUN_NOT_IN_THE_CALENDAR);
		}

		if (typed.newRace() != null && typed.raceId() != null) {
			return no(HttpStatus.BAD_REQUEST, THE_RACE_IS_NAMED_TWICE);
		}

		/* WHETHER THIS ROUTE CAN CARRY THE ANSWER OUT AT ALL, asked before anything about
		   the answer itself. The one tab it still cannot, {@code payments}, is refused rather
		   than recorded; the note at the head of this class says why. {@code results} stood
		   beside it until the owner's choice of 21.09.2026 settled what an approval writes. */
		if (!CARRIED_OUT_HERE.contains(item.queue())) {
			return no(HttpStatus.CONFLICT, NOT_DECIDED_ON_THIS_PORTAL_YET);
		}

		if (HoldingAnItem.mayTouch(item.hold(), asking.account(), clock.instant())
				!= HoldingAnItem.Answer.GO_AHEAD) {
			return no(HttpStatus.CONFLICT, SOMEBODY_ELSE_IS_READING_IT);
		}

		DecidingOnASubmission.Answer answer =
				new DecidingOnASubmission.Answer(typed.approved(), typed.reason());

		/* COMMENTS IS THE ONE QUEUE WHOSE REFUSAL NEEDS NOTHING IN THE BOX (ADL A64 A4): PDL
		   P22, „ne odbija nego brise, a napomena je neobavezna", the same sentence stated
		   twice in the diary, and the note beside it,
		   where there is one, is a trace for a moderator and never a reason the member is
		   owed. Asked of `item.queue()` rather than remembered as a second list: the schema
		   already names this queue by the same literal in `verification_refusal_says_why`. */
		return switch (DecidingOnASubmission.decide(new DecidingOnASubmission.Submission(
				item.state(), COMMENTS.equals(item.queue())), answer)) {
			case ALREADY_DECIDED -> no(HttpStatus.CONFLICT, SOMEBODY_ANSWERED_IT_ALREADY);
			case A_REFUSAL_NEEDS_A_REASON -> no(HttpStatus.BAD_REQUEST, A_REFUSAL_NEEDS_A_REASON);
			case APPROVE_IT, REJECT_IT -> {
				Carried carried = inOneTransaction.execute(committing -> write(item, answer,
						asking, typed));

				/* AND THE POST GOES AFTER THE TRANSACTION HAS COMMITTED, never inside it.
				   ADL A36, the owner's choice of 21.09.2026 for this very tab, among three outcomes
				   offered: the result and the rankings inside the transaction, the ducats and the post
				   after it (the journal's wording, not a sentence of his). The cost of the other
				   order is measured rather than supposed - B58, 14.09.2026: with sending
				   inside, one request held a pool connection 5,15 s when the relay hung, ten
				   at once took the whole pool, and a member's legitimate sign-in failed after
				   thirty seconds. The line in his inbox is a ROW and stays inside with
				   everything else the answer writes; only what leaves the building waits. */
				postAfterwards(carried);

				yield carried.answer();
			}
		};
	}

	/**
	 * WHAT WAS SENT, TURNED INTO THE RECORD, OR NOTHING AT ALL.
	 *
	 * <p>The application's own {@link ObjectMapper}, so a body is read exactly as
	 * {@code @RequestBody} would have read it and the only thing that changed about reading it is
	 * WHEN. Read off the stream and not into an array first, so a body is never held whole: a
	 * parser stops at the first byte it cannot use, which is all a body that is not JSON costs.
	 *
	 * <p>Absent, empty and unreadable are one answer and not three, for the reason
	 * {@code InboxWriteApi} gives for the same shape: none of them carries a single value this
	 * route could act on. Written with no condition of its own, on purpose: Jackson refuses empty
	 * input exactly as it refuses input it cannot parse, so a check for one would be a branch
	 * beside a road that already goes where it should.
	 */
	private Answered read(HttpServletRequest request) throws IOException {
		try {
			return json.readValue(request.getInputStream(), Answered.class);
		}
		catch (JacksonException cannot) {
			return null;
		}
	}

	/**
	 * EVERYTHING ONE ANSWER CHANGES, IN ONE TRANSACTION.
	 *
	 * <p>What an approval MEANS comes first and the row is marked after it, so a
	 * consequence that cannot be carried out - a name taken since the proposal was sent, a
	 * founder who joined a team in the meantime - leaves the item standing in the queue
	 * rather than answered and unfulfilled. Both of those are real: PDL P13 says a name „ne
	 * sme biti zauzet nekim vec odobrenim timom" and that a member may not found a second
	 * team while he is in one, and {@link TeamWriteApi} names both as the decider's to
	 * enforce, „koja je gde napisana i merena" on the portal's own side.
	 */
	private Carried write(Item item, DecidingOnASubmission.Answer answer,
			WhoIsAsking.Member asking, Answered typed) {

		/* WHAT THE DECISION IS ABOUT IS SETTLED BEFORE ANYTHING IS READ FOR IT, from the request and
		   the row alone and writing nothing: a decision about a picture names the picture the
		   moderator saw, and a decision about anything else names none. Whether the row STILL holds
		   that picture is not asked here. It is asked by the statement that claims the row, further
		   down, because that is the one place the answer cannot change under the question - the head
		   of this class says why a question put to the row before it would be a check-then-act. */
		Optional<ResponseEntity<?>> unnamed = whyThePictureIsNotNamedRight(item, typed);

		if (unnamed.isPresent()) {
			return new Carried(unnamed.get(), null, null);
		}

		/* WHAT AN APPROVAL WOULD RUN INTO, ASKED FIRST AND WRITING NOTHING. It has to be
		   settled before the row is claimed: asked afterwards it would need the transaction
		   rolled back, and a rollback inside a test-managed transaction poisons the outer one
		   instead. Nothing here writes, so there is nothing to undo.
		   A schedule proposal's own day asked the identical question of PDL P10b here, read
		   once and carried to a write further down for the same reason team proposals are -
		   from V30 until PDL P10a, 22.09.2026 took the queue away with the question still
		   answered where it always was, {@code EventWriteApi.wouldStrandAResultInAnotherYear},
		   just no longer asked a second time from this route. */
		Proposal proposal = TEAMS.equals(item.queue()) ? proposalBehind(item) : null;

		/* AND WHAT A RESULT ROW IS ABOUT, read the same way and for the same reason. It is
		   read for a REFUSAL too and not only for an approval, because {@link #tell} on a
		   refused result says nothing about the run - the reason the moderator typed is the
		   whole of that message - so nothing here depends on the answer. */
		Submission sent = RESULTS.equals(item.queue()) && item.resultSubmissionId() != null
				? submissionBehind(item)
				: null;

		/* THE SEASON, READ ONCE AND USED BY BOTH HALVES. See the head of this class for why
		   it is this function and not the one beside it, and for the day the portal got it
		   wrong. Read twice - once to refuse and once to write - it would be the same fact
		   with two homes, which is the thing this file spends most of its words avoiding. */
		int season = SeasonClock.transfersTakeEffect(clock.instant().atZone(SeasonClock.ZONE));

		if (answer.yes() && proposal != null) {
			Optional<ResponseEntity<?>> refused = whyTheTeamCannotBeMade(proposal, season);

			if (refused.isPresent()) {
				return new Carried(refused.get(), null, null);
			}
		}

		/* AND THE SAME FOR A RESULT: asked before the row is claimed, writing nothing, so a
		   run this route cannot count leaves the item standing in the queue rather than
		   answered and unfulfilled. Asked of the QUEUE and not of `sent`, because `sent` is
		   empty for two different reasons - a row in another tab, and a results row naming no
		   submission - and only the second is a refusal.

		   WHAT IS COUNTED AND ON WHICH RACE is worked out here too, once, and carried to the
		   writing half: the race a run on a race the calendar does not hold will be counted on is
		   decided by the answer, and the race and the figures must be the same ones the refusals
		   above them were asked about. */
		Counting counting = null;

		if (answer.yes() && RESULTS.equals(item.queue())) {
			counting = howTheRunIsCounted(sent, typed);

			if (counting.refused() != null) {
				return new Carried(counting.refused(), null, null);
			}
		}

		String state = answer.yes() ? DecidingOnASubmission.APPROVED : DecidingOnASubmission.REJECTED;

		/* THE STATE, THE MOMENT, THE ACCOUNT AND THE NAME IT WAS DECIDED UNDER, plus the
		   picture let go - all in one statement, because V9 ties them together with three
		   biconditionals and a row that satisfied two of them would be refused anyway.

		   THE NAME COMES OFF THE ACCOUNT AND NOT OFF THE MEMBER, and those are two different
		   values rather than the same one read twice: PDL P21 has a parent holding the
		   account of a competitor under sixteen, so `account.first_name` is the parent's and
		   `competitor.first_name` is the child's. Selected inside the statement, there is no
		   variable in between for the other one to arrive in.

		   `decided_at` is the DATABASE's `now()`, which is V9's own default for `raised_at`
		   and the same sentence: a moment read off this server would be a second home for
		   what time it is. The Clock bean above decides nothing about when a decision was
		   made; it decides whether a fifteen minute spell has run out, which season a team
		   starts in and whether a race has been run yet, which are questions a case has to be
		   able to move. */
		/* AND THE CONDITION ON THE STATE IS THE WHOLE OF WHAT MAKES THIS ONE DECISION.
		 *
		 * Measured on 21.09.2026 over real sockets, two moderators released by a barrier:
		 * without it BOTH were answered 200, twelve times out of twelve. Worse than a
		 * duplicate: with one approving and one refusing, six times out of six the team was
		 * made, the founder was written into it, and he was ALSO sent a message saying his
		 * item had been refused, while the row settled on `approved`. Two messages in one
		 * inbox contradicting each other, and no fault anywhere.
		 *
		 * `DecidingOnASubmission.decide` had already been asked and had answered - it read
		 * the state OUTSIDE this transaction, which is a check-then-act, and the portal's own
		 * precedent says what that is worth: `PaymentNumberConcurrencyTest` exists because a
		 * check-then-act written in Java passes every sequential case and fails only under
		 * concurrency (a paraphrase of that class's own note, not a sentence of the owner's).
		 *
		 * So the claim is the UPDATE and the answer is the COUNT. `where state = 'waiting'`
		 * makes the statement take the row's lock and re-read it after the other transaction
		 * commits; the loser matches nothing, writes nothing, and is told 409, which is what
		 * follows from the owner's answer about the shared queue (PDL P9, 18.09.2026, as the journal
		 * derives it: a second moderator who meets an item that is held gets a refusal, not a
		 * silent failure). It is also why every consequence below
		 * happens AFTER this line and not before it. */
		/* AND THE PICTURE HE SAW IS THE SECOND CONDITION OF THE SAME CLAIM, for the same reason and
		 * written where the same lock is. `MePhotoApi.send` repoints `photo_id` on this very row
		 * under `for update`, so a statement that has to wait for that lock re-reads the row after
		 * the send has committed: the condition below is evaluated against the picture the member
		 * LEFT and not against the one this request read a moment earlier. Nothing is asked in Java
		 * before it, because that would be the check-then-act this class has measured twice.
		 *
		 * The two `?` are one value, written twice because a null has no type until it is cast: a
		 * decision about anything but a picture names none (`whyThePictureIsNotNamedRight`), and
		 * for those the condition is true whatever the row holds. For a picture it is the key he
		 * named, and `photo_id = null` in the SET above does not matter to it, because a WHERE is
		 * evaluated against the row as it stood. */
		int claimed = db.sql("update verification set state = ?, decided_at = now(),"
						+ " decided_by = a.id,"
						+ " decided_by_name = a.first_name || ' ' || a.last_name,"
						+ " reason = ?, photo_id = null"
						+ " from account a where verification.id = ? and verification.state = ?"
						+ " and a.id = ?"
						+ " and (cast(? as bigint) is null or verification.photo_id = ?)")
				.params(state, DecidingOnASubmission.reasonAsItGoesIn(answer), item.id(),
						DecidingOnASubmission.WAITING, asking.account(), typed.seenPhotoId(),
						typed.seenPhotoId())
				.update();

		if (claimed == 0) {
			/* A MISS HAS TWO CAUSES, and the row says which. Somebody decided it first, which is
			   what this refusal always meant; or it still waits and holds another picture than the
			   one he named, which the member's send did while he looked. The second is asked of
			   the row and not remembered from the request, so that a row decided meanwhile is
			   never told it was changed: a decided row keeps no picture (V9), so `is distinct
			   from` could not tell it apart from a changed one without the state beside it. */
			boolean changed = Boolean.TRUE.equals(db.sql("select exists(select 1 from verification"
							+ " where id = ? and state = ? and photo_id is distinct from ?)")
					.params(item.id(), DecidingOnASubmission.WAITING, typed.seenPhotoId())
					.query(Boolean.class).single());

			return new Carried(no(HttpStatus.CONFLICT,
					changed ? THE_PICTURE_WAS_CHANGED : SOMEBODY_ANSWERED_IT_ALREADY), null, null);
		}

		/* AND THE HOLD GOES WITH THE ANSWER. Nothing is being read any more, and a decided
		   row carrying a hold would be the one shape V28 says it cannot refuse by itself. */
		db.sql("delete from verification_lock where verification_id = ?").param(item.id()).update();

		/* THREE QUEUES, THREE MEANINGS, and the chain ends on an unconditional `else` rather
		   than on a third named check: `item.queue()` is one of exactly the three
		   `CARRIED_OUT_HERE` names by the time this runs - `decide` above already refused
		   anything else - so asking a third time would be a branch nothing can ever take
		   the other way, which is the shape this file removes rather than writes (V29's own
		   trigger function says why in as many words). PROFILES is the one left as the
		   catch, because it is the one queue this method already reads straight off `item`
		   with no proposal of its own to fetch. A fourth branch stood here for SCHEDULE,
		   calling {@code moveTheEvent}, from V30 until PDL P10a, 22.09.2026 took the queue
		   away the same day: „Redova je pet, ne šest." */
		Said said = null;

		if (answer.yes()) {
			if (TEAMS.equals(item.queue())) {
				makeTheTeam(proposal, season);
			} else if (COMMENTS.equals(item.queue())) {
				publishTheComment(item);
			} else if (RESULTS.equals(item.queue())) {
				said = countTheResult(item, sent, counting);
			} else {
				publishTheProfile(item);
			}
		} else if (!COMMENTS.equals(item.queue())) {
			/* COMMENTS NEVER REACHES HERE (ADL A64 A4). PDL P22, „Jedini red bez njega je red
			   komentara, gde se ne odbija nego brise, a napomena je neobavezna i namenjena
			   moderatorima" says the note beside a deleted comment - where there is one - is
			   not a reason owed to the member, unlike the other two that reach this
			   branch, which PDL P22 requires the opposite of: „razlog stize u sanduce onome
			   ko je stavku poslao". */
			tell(item.competitorId(), "Stavka je odbijena",
					DecidingOnASubmission.reasonAsItGoesIn(answer));
		}

		return new Carried(ResponseEntity.ok(new Decided(item.id(), state)), item.competitorId(),
				said);
	}

	/**
	 * THE TEXT BECOMES HIS BIOGRAPHY, OR THE PICTURE BECOMES HIS PORTRAIT.
	 *
	 * <p>One tab and two kinds of item, told apart by {@code photo_id} exactly as
	 * {@link MeWriteApi} tells them apart: „the profiles tab carries both (PDL P28a,
	 * 06.08.2026), and a picture waiting is not a text waiting". The schema is what offers
	 * the distinction and nothing here invents a second mark for it.
	 *
	 * <p>A row about nobody cannot be published onto anybody, and it is not a fault: the
	 * statements simply match no member and the decision is still recorded. That is a state
	 * V9 allows on purpose and this is what it does here.
	 */
	private void publishTheProfile(Item item) {
		if (item.photoId() == null) {
			db.sql("update competitor set bio = ? where id = ?")
					.params(item.body(), item.competitorId()).update();
		} else {
			db.sql("update competitor set photo_id = ? where id = ?")
					.params(item.photoId(), item.competitorId()).update();
		}
	}

	/**
	 * WHETHER THE REQUEST NAMES A PICTURE WHERE THERE IS ONE AND NONE WHERE THERE IS NOT, asked of
	 * the request and the row alone and writing nothing.
	 *
	 * <p>Two of the four combinations are a refusal, and neither is about the state of anything,
	 * which is why they are answered here: a row that holds a picture and a request that names none
	 * is a form not filled in ({@link #THE_FORM_IS_NOT_COMPLETE}, the sentence every body that
	 * carries no decision gets), and a request that names one beside a row that holds none is a field
	 * that rides with the wrong decision ({@link #A_SEEN_PICTURE_GOES_WITH_A_DECISION_ABOUT_ONE}).
	 * Both are 400. Of the other two, neither names a picture beside a row that holds none and needs
	 * nothing, and both naming one is the picture itself, which this does not ask: the statement that
	 * claims the row does.
	 *
	 * <p><b>Asked of the ROW and not of the queue.</b> {@code PendingQueue.tsx} draws a picture on
	 * any card whose {@code photoId} is not null, "whichever tab it stands in" (the note on
	 * {@code WaitingPicture}), and the screen asks the same fact to decide what it sends, so the
	 * two cannot come apart. Today only the profiles tab ever holds one: {@code MePhotoApi} is the
	 * one writer. That a team's logo would be decided the same way is my reading and not the
	 * owner's, who spoke of the profile picture; it costs nothing because nothing writes such a
	 * row.
	 *
	 * <p><b>The same answer for the approval and the refusal</b> (PDL, 10.10.2026: „I odbijanje
	 * slike traži viđenu sliku."), which is why this takes no {@code answer}: a version that asked
	 * it only of an approval would leave a refusal that rejects a picture nobody looked at, and
	 * the owner refused exactly that outcome („Odbijeno: da otisak traži samo odobravanje").
	 */
	private static Optional<ResponseEntity<?>> whyThePictureIsNotNamedRight(Item item,
			Answered typed) {

		if (item.photoId() == null) {
			return typed.seenPhotoId() == null ? Optional.empty()
					: Optional.of(no(HttpStatus.BAD_REQUEST, A_SEEN_PICTURE_GOES_WITH_A_DECISION_ABOUT_ONE));
		}

		return typed.seenPhotoId() == null
				? Optional.of(no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE))
				: Optional.empty();
	}

	/**
	 * THE PROPOSAL BECOMES A TEAM, AND THE MEMBER WHO SENT IT IS IN IT.
	 *
	 * <p>Owner, 03.08.2026 (PDL P13): „ako ga prihvate, clanu odmah treba da stigne
	 * obavestenje u portal inboks da je njihov tim prihvacen i od tog trenutka imaju Admin
	 * prava za svoj tim", and the entry of 05.09.2026 (PDL), which is not his sentence: it was
	 * written after a review of PR 186 found that approval wrote only the team and the
	 * founder could go on to found another, and it says that approval writes the founder into
	 * the team.
	 *
	 * <p><b>The address is made HERE and nowhere earlier</b>, which is why
	 * {@code team_proposal} has no {@code slug}: „a proposal standing in the queue is not a
	 * team, it has no address". {@link EventAddress#written} is the rule the whole portal
	 * runs on, so the address this makes is the one the team's page will answer at.
	 *
	 * <p><b>Nothing of the proposal's picture survives</b> (ADL, 15.08.2026: „Nista od
	 * timske slike ne prezivljava odobravanje predloga, do F5"), so {@code logo_id} is not
	 * copied and the screen draws initials for a team with no mark.
	 */
	private Proposal proposalBehind(Item item) {
		return db.sql("select competitor_id, name, bio, link, place_id, city,"
						+ " country_id from team_proposal where id = ?")
				.param(item.teamProposalId())
				.query((row, one) -> new Proposal(row.getLong(1), row.getString(2), row.getString(3),
						row.getString(4), row.getObject(5, Long.class), row.getString(6),
						row.getObject(7, Long.class)))
				.single();
	}

	/**
	 * THE SUBMISSION BECOMES A COMMENT, under the event it was written about (ADL A64 A1
	 * and A3).
	 *
	 * <p>THE EVENT, THE THREE MARKS AND THE TEXT ARE A STRAIGHT COPY, exactly what
	 * {@code comment_submission} already holds, because A1 built that table in the shape
	 * {@code event_comment} takes rather than in a shape this method would have to
	 * translate. {@code published_at} is the one column not copied - it is the instant
	 * this statement runs.
	 *
	 * <p><b>{@code who} is NOT a straight copy (ADL A64 A5, 22.09.2026).</b> V7 says
	 * {@code event_comment.who} is „the name as it was when the comment went out", and
	 * *went out* means published rather than sent in - a review of PR 354 found the two
	 * reading apart, because the moderator's own card already draws the CURRENT name
	 * ({@link VerificationApi#waitingIn}) while this statement copied the one captured at
	 * submission. So this reads {@code competitor.first_name || ' ' || competitor.last_name}
	 * FRESH, at the moment it runs, off the same {@code competitor_id} the submission
	 * carries. {@code comment_submission} carries no name of its own to fall back to (ADL
	 * A64 A6, 22.09.2026): {@code competitor_id} is {@code not null} there and its foreign
	 * key is {@code on delete cascade}, so a submission still waiting for a decision can
	 * never point at a member who is gone - the row would have gone with him.
	 *
	 * <p><b>Nothing is deleted here, and that is on purpose and not an omission.</b> PDL
	 * says a REFUSED comment „se ne odbija nego brise" (3267, 4255); an APPROVED one is
	 * published, which is the opposite outcome, and the row in {@code comment_submission}
	 * is left standing exactly as {@code result_submission} and {@code team_proposal} are
	 * left standing after their own decisions. Deleting it would in any case cascade the
	 * {@code verification} row away with it ({@code verification_comment_submission_fk}),
	 * which ADL A36 O11 forbids for a decided row regardless of which way it was decided.
	 */
	private void publishTheComment(Item item) {
		db.sql("insert into event_comment (event_id, competitor_id, who, published_at,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " select cs.event_id, cs.competitor_id,"
						+ " c.first_name || ' ' || c.last_name, now(),"
						+ " cs.rating_organisation, cs.rating_value, cs.rating_ambience, cs.body"
						+ " from comment_submission cs"
						+ " left join competitor c on c.id = cs.competitor_id"
						+ " where cs.id = ?")
				.param(item.commentSubmissionId())
				.update();
	}

	/**
	 * WHAT THE MEMBER SENT IN, AND THE NAME OF THE RACE HE SENT IT FOR.
	 *
	 * <p><b>The race is joined OUTER and the name may be absent, and that is a described race
	 * rather than a missing row.</b> {@code result_submission_race_is_from_the_calendar_or
	 * _described} (V10) makes {@code race_id} and {@code race_name} exclusive, so a row that
	 * names no race in the calendar carries its own name instead and has no {@code race} to
	 * join to. An inner join would simply not return such a row and {@code single()} would
	 * throw, which would turn a refusal the moderator is entitled to make into a server
	 * fault.
	 *
	 * <p><b>What is NOT done here is to fall back to {@code race_name} when the join finds
	 * nothing.</b> That would be a name arriving from two places, and this portal has paid
	 * for that shape before. A described race is never counted under the name the member
	 * typed: it is counted on the race the answer names, new or chosen, and that race's name is
	 * the one {@link #howTheRunIsCounted} carries ({@link CountedOn#raceName}). The name read
	 * here is used only where the join found its row.
	 *
	 * <p><b>And the town the member gave, which only a described race carries</b> (V10's
	 * {@code result_submission_described_race_names_its_town}): it is the town of the event an
	 * approval makes, PDL P9, 30.08.2026, in the record's wording: „Događaj u kalendaru nosi
	 * grad i državu, a forma ih nije tražila, pa bi događaj napravljen pri verifikaciji ostao
	 * bez mesta." Read as the keys the row holds, the codebook's or the typed one with its
	 * country, and written into the event the same way, so nothing is resolved twice.
	 *
	 * <p>{@code race_date} is taken off the SUBMISSION and not off the race, because V10's
	 * composite key {@code (race_id, race_date)} with {@code on update cascade} is what makes
	 * the two the same fact: the database refuses a day that is not that race's and rewrites
	 * the submission the moment a race moves.
	 *
	 * <p><b>The race's own figures are read as well, as it stands NOW.</b> The figures a race
	 * fixes were copied into the submission on the day it was sent, and a race corrected since
	 * is the race the run is counted on ({@link WhatARaceCarries#figuresOf} says why); the copy
	 * is what the RUNNER sent, and the race is what the race says today. Nothing for a race the
	 * calendar does not hold, and on that road nothing here is read.
	 */
	private Submission submissionBehind(Item item) {
		return db.sql("select rs.id, rs.race_id, rs.race_date, ra.name, rs.distance_km,"
						+ " rs.ascent_m, rs.descent_m, rs.seconds, rs.amends_result_id, ra.kind,"
						+ " ra.distance_km, ra.ascent_m, ra.descent_m, ra.limit_seconds,"
						+ " rs.place_id, rs.city, rs.country_id"
						+ " from result_submission rs"
						+ " left join race ra on ra.id = rs.race_id"
						+ " where rs.id = ?")
				.param(item.resultSubmissionId())
				.query((row, one) -> new Submission(row.getLong(1), row.getObject(2, Long.class),
						row.getDate(3).toLocalDate(), row.getString(4),
						new Figures(row.getBigDecimal(5), row.getInt(6), row.getInt(7),
								row.getInt(8)),
						row.getObject(9, Long.class),
						row.getString(10) == null ? null
								: new WhatARaceCarries.ARace(row.getString(10), row.getBigDecimal(11),
										row.getInt(12), row.getInt(13), row.getInt(14)),
						row.getObject(15, Long.class), row.getString(16),
						row.getObject(17, Long.class)))
				.single();
	}

	/**
	 * THE RACE AN APPROVED RUN IS COUNTED ON AND THE FIGURES IT IS COUNTED AT, OR WHY IT CANNOT BE
	 * COUNTED, ASKED WITHOUT WRITING ANYTHING.
	 *
	 * <p>Every refusal here is a state the schema permits and this route cannot carry out, and all
	 * are settled before the queue row is claimed for the reason {@link #whyTheTeamCannotBeMade}
	 * gives from its own side: asked afterwards they would need the transaction rolled back, and a
	 * rollback inside a test-managed transaction poisons the outer one instead.
	 *
	 * <p><b>THE RACE, ONE OF THREE WAYS.</b> A run sent from the calendar is counted on its own
	 * race, and an answer that names another one is refused rather than dropped. A run on a race
	 * the calendar does not hold is counted on the race the ANSWER names: one of the calendar,
	 * which a moderator chooses for the second member who ran a race the first member's approval
	 * put into the calendar (PDL P9, owner, 30.08.2026: „kad odem da verifikujem drugom članu mogu
	 * da zamenim njegov naziv događaja i izbor trke autocompletom sad već postojeće trke"), or a
	 * new one this approval makes, on the day the member gave. Neither named is the refusal
	 * {@link #THE_RACE_IS_NOT_IN_THE_CALENDAR} says why it is.
	 *
	 * <p><b>A race that has not been run yet is refused whichever way it was named.</b> PDL P9,
	 * owner, 11.08.2026: „Ne sme, ne može biti rezultata u budućnosti." {@code ResultWriteApi}
	 * refuses such a run when it is sent, but a race may be moved after that - the administration
	 * moves it through {@code EventWriteApi} and {@code RaceWriteApi}, and V10's
	 * {@code on update cascade} carries the waiting run's day along - and a race the moderator
	 * chooses may be one still to come. Asking it here as well is my reading of that decision,
	 * carried to the moment the run would become a result, and not a sentence of the owner's about
	 * approvals. The day of the race itself counts as run, exactly as it does on the member's side.
	 * On a race this approval makes the day is the one the member's own route judged when he sent
	 * it, so the question is asked of it too rather than skipped for one of three roads.
	 *
	 * <p><b>THE FIGURES, ONE WAY FOR EVERY RACE THAT STANDS IN THE CALENDAR, AND THE ONES THE
	 * RACE IS MADE OF FOR ONE THAT DOES NOT YET.</b> A race of the calendar, chosen or the run's
	 * own, is asked through {@link WhatARaceCarries#figuresOf} as it stands now, and the runner's
	 * figures are the moderator's where he set any. A race this approval makes is made OF the run
	 * ({@link #makeTheEventAndTheRace} puts on it exactly the figures its kind fixes), so the run
	 * is counted at the four figures as sent or as amended - which is what {@code figuresOf} would
	 * answer about that race once it existed. Judged either way by the same three checks the
	 * member's own report is judged by, because these numbers go into the same columns; a figure
	 * the race leaves to the runner and the amendment leaves out fails them as a form not filled in.
	 *
	 * @param sent  what the row names, or empty where it names nothing
	 * @param typed the answer, whose race and figures this reads
	 * @return the refusal, or what the run is counted on and at
	 */
	private Counting howTheRunIsCounted(Submission sent, Answered typed) {
		if (sent == null) {
			return Counting.notCounted(no(HttpStatus.CONFLICT, THE_ITEM_CARRIES_NO_RUN));
		}

		CountedOn on;

		if (sent.raceId() != null) {
			if (typed.newRace() != null || typed.raceId() != null) {
				return Counting.notCounted(no(HttpStatus.BAD_REQUEST,
						A_RACE_IS_NAMED_ONLY_FOR_A_RUN_NOT_IN_THE_CALENDAR));
			}

			on = new CountedOn(sent.raceId(), sent.raceName(), sent.raceDate(), sent.race(), null);
		} else if (typed.raceId() != null) {
			Optional<CountedOn> chosen = theRaceChosen(typed.raceId());

			if (chosen.isEmpty()) {
				return Counting.notCounted(no(HttpStatus.BAD_REQUEST, THE_RACE_IS_NOT_KNOWN));
			}

			on = chosen.get();
		} else if (typed.newRace() != null) {
			NewRace asked = typed.newRace();

			/* THE KIND IS ASKED FOR ITSELF BEFORE THE LIST IS ASKED ABOUT IT, because
			   `WhatARaceCarries.KINDS` is a `Set.of(...)` and an immutable set THROWS on
			   `contains(null)` rather than answering false - `ResultWriteApi.described` measured it
			   as a 500 where the form was owed a sentence. */
			if (isNothing(asked.eventName()) || isNothing(asked.raceName()) || asked.raceKind() == null
					|| !WhatARaceCarries.KINDS.contains(asked.raceKind())) {
				return Counting.notCounted(no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE));
			}

			on = new CountedOn(null, asked.raceName().strip(), sent.raceDate(), null,
					new Made(asked.eventName().strip(), asked.raceKind()));
		} else {
			return Counting.notCounted(no(HttpStatus.CONFLICT, THE_RACE_IS_NOT_IN_THE_CALENDAR));
		}

		if (on.day().isAfter(today())) {
			return Counting.notCounted(no(HttpStatus.CONFLICT, THE_RACE_HAS_NOT_BEEN_RUN_YET));
		}

		Figures given = typed.amended() == null ? sent.figures() : typed.amended().figures();
		Figures counted = on.made() == null ? WhatARaceCarries.figuresOf(on.race(), given) : given;

		if (ResultWriteApi.notADistance(counted.distanceKm())
				|| ResultWriteApi.notAClimb(counted.ascentM())
				|| ResultWriteApi.notAClimb(counted.descentM())
				|| ResultWriteApi.notATime(counted.seconds())) {
			return Counting.notCounted(no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE));
		}

		return new Counting(null, on, counted);
	}

	/**
	 * A RACE OF THE CALENDAR AS IT STANDS NOW, BY ITS KEY AND BY NOTHING ELSE.
	 *
	 * <p><b>By the key and never by the name</b>, which is what makes it the race the moderator
	 * chose: two races carry one name as a matter of course, since a race starts out with its
	 * event's (PDL, owner, 23.08.2026: „ja mogu da u okviru Beogradskog maratona imam dve trke, od
	 * 42.2 i 21.1, i obe će dobiti default naziv Beogradski maraton."), and a race found by its
	 * name would be whichever the database met first.
	 */
	private Optional<CountedOn> theRaceChosen(long id) {
		return db.sql("select id, name, date, kind, distance_km, ascent_m, descent_m, limit_seconds"
						+ " from race where id = ?")
				.param(id)
				.query((row, one) -> new CountedOn(row.getLong(1), row.getString(2),
						row.getDate(3).toLocalDate(),
						new WhatARaceCarries.ARace(row.getString(4), row.getBigDecimal(5), row.getInt(6),
								row.getInt(7), row.getInt(8)),
						null))
				.optional();
	}

	/** Absent, blank and a run of spaces are one state, {@code TeamWriteApi#isNothing}'s own
	 *  reasoning: a guard written against one shape of „not there" lets the others through to a
	 *  column whose {@code check} refuses them as a server fault instead of an answer. */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	/** Today in the league's own zone and never the machine's, {@code ResultWriteApi}'s own
	 *  reading of the same question: a server kept in UTC would call a race run this morning
	 *  in Belgrade a race still to come for the first hour of the day. */
	private LocalDate today() {
		return LocalDate.now(clock.withZone(SeasonClock.ZONE));
	}

	/**
	 * THE SUBMISSION BECOMES A RESULT, AND FROM THIS MOMENT IT COUNTS.
	 *
	 * <p>PDL P9: „Rezultat ulazi u rang liste tek posle odobrenja. Ne prikazuje se pre
	 * verifikacije, pa ne postoji ni oznaka „nepotvrđen" u tabelama." This statement is that
	 * sentence: nothing anywhere reads a submission for a standing, and the row this writes is
	 * the only thing that does.
	 *
	 * <p><b>THE POINTS ARE COMPUTED HERE AND NEVER COPIED, and there is nowhere to copy them
	 * from.</b> {@code result_submission} has no points column at all - V10 gave it the four
	 * figures the formula is fed and nothing else - which is the schema saying the same thing
	 * ADL A12a says in words: „Bodovi i mere trke se preračunavaju na serveru."
	 * {@link BtlScoreCalculator} is the one home for the formula and its golden set is
	 * untouchable, so this hands it the four numbers and stores what it answers.
	 *
	 * <p><b>A CORRECTION UPDATES THE OLD ROW AND DOES NOT REPLACE IT, and that is forced
	 * rather than chosen.</b> {@code result_submission_amends_fk} is {@code on delete
	 * cascade} (V32), so deleting the result being corrected would take THIS VERY SUBMISSION
	 * away with it inside this transaction, and the {@code verification} row after it through
	 * {@code verification_result_submission_fk} - the row this method was reached by. Writing
	 * over it keeps the one fact that follows from the outcome the owner chose on 28.08.2026
	 * (the journal's wording of what follows, not his sentence): the approval replaces the
	 * result, so the old one leaves and the new one enters in the same moment, with no moment in
	 * between in which the member has no result.
	 *
	 * <p><b>The race is not written again on a correction, and the owner is why.</b> On
	 * 27.08.2026 he answered the questions about correcting one's own result (the journal words
	 * the answer, it does not quote him): everything is changed except the race, and whoever
	 * got the race wrong deletes the result and enters a new one. V32's
	 * own check says the same from the schema's side. So the statement names the four figures
	 * and the points and nothing else.
	 *
	 * <p><b>Nothing is said here about the OLD figures, because there are none to say.</b> The
	 * owner corrected himself on 04.09.2026: „Nakon odobrene ispravke, nigde ne stoji stara
	 * vrednost, niti se prikazuje", which struck out both the sentence of 01.09.2026 that the
	 * old value is kept and the history table it would have needed.
	 *
	 * <p>{@code item.competitorId()} is read without a check and cannot be null on this road:
	 * V9 allows the column to be empty for a payment about somebody who is not a member yet,
	 * but the only thing that ever writes a {@code results} row is
	 * {@link ResultWriteApi#queue}, which writes the member it is acting for. If that ever
	 * stopped being true, {@code result.competitor_id not null} refuses the insert loudly
	 * rather than writing a result belonging to nobody.
	 *
	 * <p><b>WHAT IS COUNTED IS {@code counted}, NOT WHAT WAS SENT, and the two part company in
	 * two ways.</b> A figure the race fixes is the race's as it stands now, and a figure the
	 * runner gives is the moderator's where he set one at approval. The second is the owner's
	 * decision of 30.08.2026, in the journal's wording: verification changes what the member
	 * reported, and that is explained once, in the rulebook, „a ne beleška uz svaku izmenjenu
	 * prijavu i ne čuvanje poslate vrednosti pored upisane". So nothing beside the result says
	 * what was sent, and <b>the decided submission is written over with what was counted</b>:
	 * left as it was, the database would keep the value sent beside the value written, which is
	 * the outcome that decision was not. The member keeps what he sent where the record of it
	 * belongs, in the line in his inbox written when he sent it, and for a correction in the
	 * letter that carried the old figures and the new ones as well. That last step is my reading
	 * of the decision, not a sentence of the owner's. A run sent in fresh has had no letter of its
	 * own since 09.10.2026, which is a decision and not a reading ({@link ResultWriteApi} carries
	 * it).
	 *
	 * <p><b>AND THE RACE IT IS COUNTED ON IS THE ONE {@link #howTheRunIsCounted} SETTLED, which
	 * for a run on a race the calendar does not hold is made here, first.</b> The decided
	 * submission is written over with that race too, by the same reading and in the same
	 * statement as its figures: the name, the kind and the town the member typed are what a run
	 * carries „samo pre verifikacije; posle nje svaki rezultat ima svoju trku" (PDL P9,
	 * 30.08.2026, in the record's wording of the owner's answer), and V10 does not let one row
	 * hold a race of the calendar and a described one at once - so the four described columns are
	 * emptied in the statement that names the race. It follows the write-back of R1 and stands or
	 * falls with it: whether the submission keeps what was sent is still before the owner, asked
	 * after the review of PR 495, and if it is to be kept, both go together.
	 *
	 * @param counting the race and the four figures as they are counted, worked out and checked
	 *                 by {@link #write} before the row was claimed
	 * @return what the member is told by post once this has committed
	 */
	private Said countTheResult(Item item, Submission sent, Counting counting) {
		CountedOn on = counting.on();
		Figures counted = counting.counted();

		/* WAS THE BEGINNERS' CATEGORY STILL OPEN TO HIM, ASKED BEFORE THE ROW EXISTS.
		 *
		 * THE SEASON IS THE ONE AFTER THE RUN'S, NEVER THE RUN'S OWN, and that distinction is
		 * the whole of the owner's decision of 26.09.2026, in the journal's wording and not in a
		 * sentence of his: if the approval takes the member's total for the current season to
		 * twelve or more, the beginners' category is closed for the NEXT season at once. A season's
		 * category was decided off the seasons before it, and a season
		 * is never before itself - `BestOfficialSeason` carries the day the portal got exactly
		 * this wrong, when a season's own growing total closed it on him from the inside.
		 *
		 * Asked twice around the write rather than computed from the points, because the rule
		 * is „the best SINGLE official season" and not „this result's points": a member three
		 * points short whose best season is another one entirely is not moved by this run at
		 * all. Both readings go through the one home that owns the question. */
		int theSeasonAfterTheRun = on.day().getYear() + 1;
		boolean wasOpen = beginnersCategoryIsOpenFor(item.competitorId(), theSeasonAfterTheRun);

		/* THE RACE IT GOES ON, MADE FIRST WHERE THE CALENDAR DOES NOT HOLD IT YET. After the claim
		   and never before it, which is ADL O14, the owner's choice of 21.09.2026 among the
		   outcomes offered, in the record's wording: „u transakciji su rezultat, rang liste, trka i
		   događaj ako nastaju; van nje su dodela dukata, obaveštenje i sve što ide spolja." So a
		   moderator who lost the race to decide this row makes nothing, and the event, the race,
		   the result and the submission pointing at them are one commit or none (PDL P9,
		   30.08.2026, the cost the owner accepted in the record's wording: „prevezivanje mora da
		   bude atomsko sa upisom trke, inače nastane trka bez rezultata ili rezultat koji pokazuje
		   na trku koje nema"). */
		long race = on.made() == null ? on.raceId() : makeTheEventAndTheRace(sent, on, counted);

		BigDecimal points = BtlScoreCalculator.calculate(counted.distanceKm().doubleValue(),
				counted.ascentM(), counted.descentM(), counted.seconds());

		/* THE RUN AS IT IS APPROVED, BUILT ONCE. The letter about this approval and the line in his
		   inbox about what it did to his category are two messages about one run, and they cannot
		   name two different runs if both are written from this one value. It names the race the run
		   is COUNTED on, which for a race the calendar did not hold is the one the moderator named
		   and not the words the member typed. */
		Run run = new Run(on.raceName(), on.day(), counted.distanceKm(), counted.ascentM(),
				counted.descentM(), counted.seconds(), points);

		if (sent.amendsResultId() == null) {
			db.sql("insert into result (competitor_id, race_id, race_date, distance_km,"
							+ " ascent_m, descent_m, seconds, points)"
							+ " values (?, ?, ?, ?, ?, ?, ?, ?)")
					.params(item.competitorId(), race, on.day(),
							counted.distanceKm(), counted.ascentM(), counted.descentM(),
							counted.seconds(), points)
					.update();
		} else {
			db.sql("update result set distance_km = ?, ascent_m = ?, descent_m = ?, seconds = ?,"
							+ " points = ? where id = ?")
					.params(counted.distanceKm(), counted.ascentM(), counted.descentM(),
							counted.seconds(), points, sent.amendsResultId())
					.update();
		}

		/* AND THE DECIDED SUBMISSION SAYS WHAT WAS COUNTED, AND ON WHICH RACE (see the note on this
		   method). After the claim and never before it, so a moderator who lost the race to decide
		   this row writes nothing here either. On a run from the calendar the race and its day are
		   the ones the row already names and the four described columns are already empty, so the
		   one statement serves every road rather than a second one written for one of them. */
		db.sql("update result_submission set race_id = ?, race_date = ?, race_name = null,"
						+ " race_kind = null, place_id = null, city = null, country_id = null,"
						+ " distance_km = ?, ascent_m = ?, descent_m = ?, seconds = ? where id = ?")
				.params(race, on.day(), counted.distanceKm(), counted.ascentM(), counted.descentM(),
						counted.seconds(), sent.id())
				.update();

		if (wasOpen && !beginnersCategoryIsOpenFor(item.competitorId(), theSeasonAfterTheRun)) {
			tellHimHisCategoryMoved(item.competitorId(), theSeasonAfterTheRun, run);
		}

		return WhatAResultChangeSays.approved(run);
	}

	/**
	 * THE EVENT AND THE RACE A RUN ON A RACE THE CALENDAR DOES NOT HOLD IS COUNTED ON, WRITTEN INTO
	 * THE CALENDAR BY THE APPROVAL ITSELF.
	 *
	 * <p>PDL P9, in the record's wording: „Član sme da unese trku koje nema u kalendaru. Tada
	 * administrator kreira događaj i trku uz rezultat, i sve troje nastaje istovremeno." And ADL,
	 * owner, 11.09.2026, in the record's wording: „Odobrena prijava rezultata sa trke koje nema u
	 * kalendaru pravi javnu trku". So this is an ordinary event of the calendar and nothing marks
	 * it as having grown out of a run; whoever may moderate the results tab writes it, the way an
	 * approved team proposal makes a team ({@link #makeTheTeam}) for whoever may moderate that one.
	 *
	 * <p><b>THE EVENT.</b> The moderator's name for it, the day the member ran, the town the
	 * member gave, kind {@code race} (a member reports a run, and only an event that is a race
	 * holds races, {@code RaceWriteApi}), not featured, and an empty description and link - the
	 * event's link is the organiser's page (V7), and the address the member sent is proof of his
	 * run, not that. Its day is its one race's, which is V29's rule as well, asked on commit.
	 *
	 * <p><b>ITS ADDRESS IS THE NAME AND THE YEAR, AND THE SAME NAME TWICE IN ONE YEAR GETS THE NEXT
	 * FREE NUMBER RATHER THAN A REFUSAL.</b> PDL, owner, 19.09.2026, choosing among four outcomes
	 * offered, in the record's wording: „Adresa događaja je naziv i godina, a isti naziv dvaput u
	 * istoj godini dobija redni broj." - {@code naziv-godina}, then {@code -2}, then {@code -3} -
	 * and among the outcomes refused, a moderator asked to type a different name. ADL O7 the same
	 * day says the number is given once, when the event is made. The address is the one rule
	 * {@link EventAddress} holds, and the number is put on it here, by the unique index itself:
	 * an address taken - by an event already there, or by a second approval committing first - is
	 * an insert that writes nothing, and the next number is tried. Nothing is asked before the
	 * insert, so there is no moment between a question and a write for another approval to land
	 * in. <b>{@code EventWriteApi} still refuses the same name twice in one year</b>, which the
	 * record calls a known state until that decision is carried out there („Do sprovođenja portal
	 * i dalje odbija dvojnika, i to je poznato stanje, ne propust"); the numbering is written here
	 * for the one caller it has, and goes to {@link EventAddress} on the day it has two, the way
	 * {@link WhatARaceCarries#figuresOf} moved there when a second road came to need it.
	 *
	 * <p><b>THE RACE.</b> The moderator's name for it, given by hand ({@code renamed}, V7: „says the
	 * name was given by hand"), the same day, and the kind the moderator decided. <b>What it
	 * carries is exactly what its kind fixes, out of the four figures the run is counted at</b>,
	 * and nought for the rest, which is V7's pair of biconditionals said from the writing side: a
	 * race of a length fixes the distance, the climb and the fall, a race to a limit fixes the time
	 * and its limit is the time on the run (PDL P9, owner, 30.08.2026, in the record's wording: „Na
	 * vremenskoj trci van kalendara polja za vreme znače ograničenje trke, ne vreme koje je član
	 * istrčao."), and a free race fixes nothing. The climb and the fall of a race to a limit or a
	 * free one are nought rather than the first runner's: a race cannot know them in advance (PDL
	 * P9, 29.08.2026, in the record's wording: „Uspon i spust se unose zato što na krugu zavise od
	 * broja krugova, pa ih trka ne može znati unapred."), and nought is what a race the
	 * administration enters without them carries ({@code RaceWriteApi}). That last reading is mine.
	 *
	 * @param counted the four figures the run is counted at, already judged, which the race is
	 *                made of
	 * @return the race's key
	 */
	private long makeTheEventAndTheRace(Submission sent, CountedOn on, Figures counted) {
		String address = EventAddress.of(on.made().eventName(), on.day());
		Long event = null;

		for (int ordinal = 1; event == null; ordinal++) {
			event = db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
							+ " featured, description, link) values (?, ?, ?, ?, ?, ?, ?, false, '', '')"
							+ " on conflict (slug) do nothing returning id")
					.params(ordinal == 1 ? address : address + "-" + ordinal, on.made().eventName(),
							on.day(), sent.placeId(), sent.city(), sent.countryId(), WhatAnEventCarries.A_RACE)
					.query(Long.class)
					.optional()
					.orElse(null);
		}

		boolean course = WhatARaceCarries.fixesTheCourse(on.made().kind());
		boolean time = WhatARaceCarries.fixesTheTime(on.made().kind());

		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values (?, ?, true, ?, ?, ?, ?, ?, ?)"
						+ " returning id")
				.params(event, on.raceName(), on.day(), on.made().kind(),
						time ? counted.seconds() : 0,
						course ? counted.distanceKm() : BigDecimal.ZERO,
						course ? counted.ascentM() : 0,
						course ? counted.descentM() : 0)
				.query(Long.class)
				.single();
	}

	/**
	 * WHETHER THE BEGINNERS' CATEGORY IS STILL OPEN TO HIM FOR A GIVEN SEASON, asked of the
	 * two places that already own the halves of that question and answered here by neither.
	 *
	 * <p>{@link BestOfficialSeason} is the half the database answers and
	 * {@link Category#firstSeasonAllowed} is the half that owns the threshold. Twelve is not
	 * written here and must never be: it is one number in one place, and the same number is
	 * what a participation medal is worth.
	 */
	private boolean beginnersCategoryIsOpenFor(long member, int season) {
		return Category.firstSeasonAllowed(bestOfficialSeason.pointsFor(member, season));
	}

	/**
	 * AND HE IS TOLD WHEN AN APPROVAL TAKES IT AWAY FROM HIM.
	 *
	 * <p>PDL, the entry titled Ponisten izbor kategorije se javlja clanu, sa razlogom
	 * (27.09.2026): the owner chose the first of three outcomes offered, with my recommendation
	 * beside it, and the outcome is that the member is told when a verification undoes his choice
	 * of the beginners' category. The two he refused were silence and an explanation on the
	 * membership page, which he would have no reason to open.
	 *
	 * <p><b>WHAT THE MESSAGE CARRIES IS HOW THAT ENTRY WRITES THE OUTCOME DOWN, AND IT IS NOT A
	 * SENTENCE HE SAID.</b> The entry says the message carries the reason: which result was
	 * approved, how many points it is worth, and that the beginners' category is closed for the
	 * next season. That wording is not in quotation marks there, and its first form, in the entry
	 * of 26.09.2026, named the result and its points only and is marked there as my reasoning
	 * awaiting his confirmation or objection. So the three parts are read as what the chosen
	 * outcome meant, and each is held by its own case in {@code VerificationWriteApiTest}. <b>A
	 * result is named the way the letter about the same approval names it</b> - its race, which is
	 * the race's own name and never the event's, and the day it was run - because both are
	 * written from the one {@link Run}, so the two messages cannot name two runs.
	 *
	 * <p><b>Why a message is owed at all, in his own words:</b> what the portal keeps is the
	 * WISH and not the category („racunaj da clan bira ono sto ZELI", 26.09.2026), so his tick
	 * stays where it was while the category under it changes. Without a line in his inbox that
	 * reads as the portal losing his choice.
	 *
	 * <p><b>It is sent whether or not he ever ticked the box, and that is deliberate.</b>
	 * Asking {@code competitor.first_season_2027} would be a second condition over a field
	 * whose name carries a season (V7) and which
	 * {@code TheChoiceAsItStands} already records as a debt to be paid when a second season
	 * exists. What this message reports is true either way - a right he had is gone - and the
	 * portal telling somebody about a category he was not asking for is a smaller fault than
	 * staying silent towards somebody who was.
	 */
	private void tellHimHisCategoryMoved(long member, int season, Run counted) {
		tell(member, "Početnička kategorija vam je zatvorena",
				"Odobren vam je rezultat sa trke " + counted.raceName() + " od "
						+ WhatAResultChangeSays.asADay(counted.day()) + ", koji nosi "
						+ counted.points().toPlainString() + " bodova."
						+ " Time ste u zvaničnoj sezoni prešli prag od "
						+ Category.FIRST_SEASON_POINTS + " bodova, pa vam je početnička"
						+ " kategorija zatvorena za sezonu " + season + ".");
	}

	/**
	 * WHAT LEAVES THE BUILDING, AND ONLY AFTER THE TRANSACTION HAS COMMITTED.
	 *
	 * <p>Nothing to post is the ordinary case and not an absence: only an approved result is
	 * posted. A refusal reaches the member's inbox with the moderator's reason instead (PDL
	 * P22, „razlog stize u sanduce onome ko je stavku poslao"), and an approved profile or
	 * team is not posted at all - nothing decided that it should, and this class leaves out
	 * rather than serves „za svaki slucaj".
	 */
	private void postAfterwards(Carried carried) {
		if (carried.said() == null) {
			return;
		}

		post(carried.member(), carried.said());
	}

	/**
	 * A LETTER, OR NOTHING WHERE THERE IS NO ADDRESS TO SEND IT TO.
	 *
	 * <p><b>A member with no account is an ordinary state rather than a fault.</b>
	 * {@code account.competitor_id} is unique but optional in the other direction too: an
	 * account may be deleted while the member it belonged to stays (V23's {@code on delete
	 * restrict} guards the member, not the account), and the imported history of the league is
	 * members who never had one - „NIKO SE NE DOVODI U PORTAL DOK SE SAM NE PRIJAVI" (owner,
	 * 27.09.2026). So this asks {@code optional()} and writes nothing when there is nobody to
	 * write to, the same shape {@link #tell} has for the inbox.
	 *
	 * <p><b>The league is blind-copied, and since 09.10.2026 that rests on a reading of a
	 * decision rather than on a precedent.</b> Until then the reason written here was that every
	 * other message about a member's result already did it ({@link ResultWriteApi}), and that
	 * route now carries out two decisions which make it untrue: what a member does to his own
	 * result is not copied (PDL P9, 25.09.2026, „Skrivena kopija ligi NE ide kad član sam menja ili
	 * briše svoj rezultat"), and a run sent in is not posted at all (PDL P9, 09.10.2026, „Pri
	 * slanju rezultata član dobija samo red u sandučetu"). What still stands is the rule those two
	 * narrow, „Skrivena kopija svakog takvog obaveštenja ide na administrativnu adresu lige",
	 * whose one written exception is the member acting on his own result - and an approval is
	 * the moderator's act, not his. That is my reading and not a decision naming this message,
	 * since whether „takvog" reaches a letter carrying no old value at all is a question put to
	 * the owner on 09.10.2026. The case that turns round if he decides otherwise is
	 * {@code VerificationWriteApiTest.theLetterAboutAnApprovedRunIsCopiedToTheLeagueInBlind}.
	 *
	 * <p><b>A relay that will not take it is logged and nothing else</b>, exactly as
	 * {@link ResultWriteApi} decided: the result is written and the answer is already the
	 * moderator's, so failing his request over the post office would undo a decision that was
	 * correctly made.
	 */
	private void post(long member, Said said) {
		Optional<String> to = db.sql("select email from account where competitor_id = ?")
				.param(member)
				.query(String.class)
				.optional();

		if (to.isEmpty()) {
			return;
		}

		try {
			postman.send(said, to.get(), theLeague);
		} catch (MailException theRelayDidNotTakeIt) {
			LOG.warn("the message about the approved result of member {} did not go out; the"
					+ " result is written and the decision stands either way", member,
					theRelayDidNotTakeIt);
		}
	}

	/*
	 * WHAT A SCHEDULE PROPOSAL ASKED FOR, AND HOW THE EVENT MOVED, stood here from V30
	 * until PDL P10a, 22.09.2026 - `scheduleMoveBehind`, `moveTheEvent` and the
	 * `ScheduleMove` record that carried one read of "what day is this, right now"
	 * between the P10b guard in `write` and the write itself. The owner's decision the
	 * same day (PDL P10a), which the journal words as five queues and not six. What the two
	 * methods did -
	 * move an event and its races together, by the same number of days - is still done,
	 * from the one place P10a leaves it: `EventWriteApi.change`, the shape both copies
	 * answered to rather than to each other, on the administrator's own screen.
	 */

	/**
	 * THE TWO THINGS THAT REFUSE AN APPROVAL, ASKED WITHOUT WRITING ANYTHING.
	 *
	 * <p>Both are the decider's to enforce and {@link TeamWriteApi} says so from its own
	 * side, naming where each is written and measured on the portal's: „Naziv ne sme biti
	 * zauzet nekim vec odobrenim timom" (PDL P13), and a member may not found a second team
	 * while he is in one.
	 *
	 * <p><b>Separate from {@link #makeTheTeam} because of WHEN each has to run.</b> A refusal
	 * must be settled before the queue row is claimed, or the claim would have to be rolled
	 * back; and the writing half must run after it, or an answer nobody won would leave a
	 * team behind. Split, neither needs a rollback at all.
	 *
	 * @return the refusal, or nothing where there is none
	 */
	private Optional<ResponseEntity<?>> whyTheTeamCannotBeMade(Proposal proposal, int season) {
		if (Boolean.TRUE.equals(db.sql("select exists(select 1 from team where slug = ?)")
				.param(EventAddress.written(proposal.name())).query(Boolean.class).single())) {
			return Optional.of(no(HttpStatus.CONFLICT, THE_NAME_IS_TAKEN));
		}

		/* AND WHETHER HE MAY STILL BE PUT IN ONE. `team_membership_one_team_at_a_time` is an
		   exclusion constraint and would refuse the row anyway, but it would refuse it as a
		   server fault after the team had been made inside this same transaction. Asked
		   here, the moderator is told which of the two things stopped him. The question is
		   the schema's own - a membership that ends at or after the season he would join
		   stands in the way - and `Membership.standsInTheWayOfJoiningIn` is where it is
		   written; read as „has an open membership" it would let through a member somebody
		   wrote ahead for a later season. */
		if (Boolean.TRUE.equals(db.sql("select exists(select 1 from team_membership"
						+ " where competitor_id = ? and (season_to is null or season_to >= ?))")
				.params(proposal.competitorId(), season).query(Boolean.class).single())) {
			return Optional.of(no(HttpStatus.CONFLICT, HE_IS_ALREADY_IN_A_TEAM));
		}

		return Optional.empty();
	}

	/** And the writing half, which runs only once this answer has claimed the row. */
	private void makeTheTeam(Proposal proposal, int season) {
		long team = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id,"
						+ " first_season, admin_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?) returning id")
				.params(EventAddress.written(proposal.name()), proposal.name(), proposal.bio(),
						proposal.link(), proposal.placeId(), proposal.city(), proposal.countryId(),
						season, proposal.competitorId())
				.query(Long.class)
				.single();

		db.sql("insert into team_membership (competitor_id, team_id, season_from)"
						+ " values (?, ?, ?)")
				.params(proposal.competitorId(), team, season)
				.update();

		tell(proposal.competitorId(), "Tim je prihvaćen",
				"Vaš tim " + proposal.name() + " je prihvaćen i od sada ga vodite.");
	}

	/**
	 * THE ITEM, AND ONLY IF THIS MODERATOR MAY MODERATE THE TAB IT STANDS IN.
	 *
	 * <p>One method for both halves, because they answer the same way and must go on
	 * answering the same way: an item that is not there and an item he may not see are one
	 * refusal, and told apart the key would be an oracle for what is in the queue. <b>A key
	 * that is not a number is the third way to be one of them</b>: it arrives as {@link AKey#NONE},
	 * the key no row has, and finds no row.
	 *
	 * <p><b>The hold is read in the SAME statement</b>, so „who holds it" and „what state it
	 * is in" are one reading of one moment. Read separately, a hold taken between the two
	 * queries would be a decision made against a row somebody had just opened.
	 */
	private Optional<Item> itemHeMayModerate(AKey key, WhoIsAsking.Member asking) {
		Optional<Item> item = db.sql("select v.id, v.queue, v.right_code, v.state, v.competitor_id,"
						+ " v.photo_id, v.team_proposal_id, v.comment_submission_id,"
						+ " v.result_submission_id, v.body, l.held_by, l.held_until"
						+ " from verification v"
						+ " left join verification_lock l on l.verification_id = v.id"
						+ " where v.id = ?")
				.param(key.value())
				.query((row, one) -> new Item(row.getLong(1), row.getString(2), row.getString(3),
						row.getString(4), row.getObject(5, Long.class), row.getObject(6, Long.class),
						row.getObject(7, Long.class), row.getObject(8, Long.class),
						row.getObject(9, Long.class), row.getString(10),
						row.getObject(11, Long.class) == null ? null
								: new HoldingAnItem.Hold(row.getLong(11),
										row.getTimestamp(12).toInstant())))
				.optional();

		/* MAY HE, ASKED OF THE ONE PLACE THAT ANSWERS IT (ADL A8, „Odgovara jedno mesto"),
		   and asked about the code THE ROW carries rather than about any code this file
		   knows. The superadmin holds every right with no tick anywhere (V5's `rights_mode =
		   'all'`), so a condition over the ticks would refuse him his own portal. */
		return item.filter(one -> mayHe.may(asking, one.rightCode()));
	}

	/**
	 * A LINE IN HIS INBOX, OR NOTHING WHERE THERE IS NOBODY TO PUT IT IN.
	 *
	 * <p><b>Never to the whole league.</b> {@code message.to_id} left empty means everybody
	 * (V13: „EMPTY MEANS EVERYBODY"), so a row about nobody would post a moderator's refusal
	 * and its reason to every member of the portal. That is the shape this portal has
	 * measured before, and the guard against it is that nothing is written at all when there
	 * is no addressee.
	 *
	 * @param member whose inbox, or {@code null} where the item is about nobody in the
	 *               record (V9) or the account names no member (V23)
	 */
	private void tell(Long member, String subject, String body) {
		if (member == null) {
			return;
		}

		db.sql("insert into message (to_id, from_id, from_name, subject, body)"
						+ " values (?, null, ?, ?, ?)")
				.params(member, THE_PORTAL, subject, body)
				.update();
	}

	/** The road an address that is not there already takes (ADL A8; {@link RightsAtTheDoor}). */
	private static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}

	/** One queue row with whatever holds it, as one reading of one moment. */
	private record Item(long id, String queue, String rightCode, String state, Long competitorId,
			Long photoId, Long teamProposalId, Long commentSubmissionId, Long resultSubmissionId,
			String body, HoldingAnItem.Hold hold) {
	}

	/** What a member asked for, in the shape an approval copies across. */
	private record Proposal(long competitorId, String name, String bio, String link,
			Long placeId, String city, Long countryId) {
	}

	/**
	 * A RUN WAITING TO BE JUDGED, AND WHAT IT IS A CORRECTION OF.
	 *
	 * @param id            the submission's own key, which an approval writes what it counted
	 *                      back into
	 * @param raceId        the calendar's race, or empty where the member described one
	 *                      instead; such a run is counted on the race the answer names
	 * @param raceDate      the day it was run: the calendar race's own, or the one the member
	 *                      gave where he described the race
	 * @param raceName      the race's own name, and empty exactly where the member described
	 *                      the race - that run is counted under the name of the race the answer
	 *                      names, never under this one
	 * @param figures       the four figures as they were SENT
	 * @param amendsResultId the result this replaces, or empty where it is a first report.
	 *                       V32 chose a nullable pointer over a flag beside one, „there or
	 *                       not, rather than a flag and a pointer that have to agree"
	 * @param race          what the race answers for as it stands now, and empty where the
	 *                      calendar does not hold it
	 * @param placeId       the town the member gave for a race he described, as the codebook's
	 *                      key, and empty where he typed it or the race is the calendar's
	 * @param city          the town he typed instead, with {@code countryId} beside it
	 * @param countryId     the typed town's country, as its key
	 */
	private record Submission(long id, Long raceId, LocalDate raceDate, String raceName,
			Figures figures, Long amendsResultId, WhatARaceCarries.ARace race, Long placeId,
			String city, Long countryId) {
	}

	/**
	 * THE RACE AN APPROVED RUN IS COUNTED ON, as it will stand once the approval is written.
	 *
	 * @param raceId   the race's key, and empty for the one this approval makes, whose key exists
	 *                 only once it is written
	 * @param raceName its name, which the letter and the line about the category name the run by
	 * @param day      the day it is run on, which is the result's day and, for a race this
	 *                 approval makes, its event's day as well
	 * @param race     what it fixes as it stands now, and empty for the race this approval makes,
	 *                 which is made of the run (see {@link #makeTheEventAndTheRace})
	 * @param made     what this approval writes into the calendar, and empty where the race is
	 *                 there already
	 */
	private record CountedOn(Long raceId, String raceName, LocalDate day,
			WhatARaceCarries.ARace race, Made made) {
	}

	/** What an approval writes into the calendar besides the race's name: its event's name, and
	 *  the kind of race the moderator decided. */
	private record Made(String eventName, String kind) {
	}

	/**
	 * WHAT AN APPROVED RUN IS COUNTED ON AND AT, OR WHY IT IS NOT COUNTED AT ALL.
	 *
	 * @param refused why not, and empty where it is counted
	 * @param on      the race, and empty where it is refused
	 * @param counted the four figures, judged, and empty where it is refused
	 */
	private record Counting(ResponseEntity<?> refused, CountedOn on, Figures counted) {

		static Counting notCounted(ResponseEntity<?> why) {
			return new Counting(why, null, null);
		}
	}

	/**
	 * WHAT THE ANSWER IS, AND WHAT STILL HAS TO GO OUT ONCE IT HAS COMMITTED.
	 *
	 * <p>It exists because ADL A36 puts the boundary between those two things: „Rezultat i
	 * rang liste su UNUTAR transakcije; dukati i posta idu POSLE nje." Carried back rather
	 * than posted where it is decided, so nothing holds a pool connection open across a relay
	 * that may hang, and so a letter is never sent about a transaction that then rolled back.
	 *
	 * @param said   what to post, or empty where there is nothing to post - which is every
	 *               answer but an approved result
	 * @param member whose address, read only when there is something to send
	 */
	private record Carried(ResponseEntity<?> answer, Long member, Said said) {
	}
}
