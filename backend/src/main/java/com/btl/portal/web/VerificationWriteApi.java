package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.event.EventAddress;
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
	 * A RESULT ON A RACE THE CALENDAR DOES NOT HOLD CANNOT BE APPROVED HERE, AND IT IS SAID
	 * OUT LOUD RATHER THAN LEFT TO BE DISCOVERED.
	 *
	 * <p>PDL, „Član sme da unese trku koje nema u kalendaru. Tada administrator kreira događaj
	 * i trku uz rezultat, i sve troje nastaje istovremeno." That is three writes into two
	 * tables this route does not touch, with their own decisions about which event a new race
	 * joins and what it is called, and it is a road of its own rather than a branch of this
	 * one.
	 *
	 * <p><b>It is refused rather than passed over, and that is the point of naming it.</b>
	 * {@code result_submission} takes a described race today - {@code ResultWriteApi} routes
	 * {@code raceId == null} to its own {@code described} path - so such a row really can be
	 * standing in this queue, and {@code result.race_id} is {@code not null}. Left unsaid, an
	 * approval would either fall over as a server fault or, worse, be recorded while writing
	 * nothing. A refusal the moderator can read keeps the boundary visible until the road
	 * exists, and it is 409 for the reason the head of this class gives: he can see the row,
	 * and what he asked for cannot happen now.
	 */
	private static final String THE_RACE_IS_NOT_IN_THE_CALENDAR =
			"Trka nije u kalendaru, pa rezultat ne može odavde da se odobri.";

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

	/** The address the league is blind-copied at, exactly as {@link ResultWriteApi} takes it. */
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
	 */
	record Answered(Boolean approved, String reason) {
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

		/* WHETHER THIS ROUTE CAN CARRY THE ANSWER OUT AT ALL, asked before anything about
		   the answer itself. The two tabs it still cannot, {@code payments} and
		   {@code results}, are refused rather than recorded; the note at the head of this
		   class says what recording them would cost and which of the two is not merely
		   unbuilt but undecided. */
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
				Carried carried = inOneTransaction.execute(committing -> write(item, answer, asking));

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
			WhoIsAsking.Member asking) {

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
		   submission - and only the second is a refusal. */
		if (answer.yes() && RESULTS.equals(item.queue())) {
			Optional<ResponseEntity<?>> refused = whyTheRunCannotBeCounted(sent);

			if (refused.isPresent()) {
				return new Carried(refused.get(), null, null);
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
		   made; it decides only whether a fifteen minute spell has run out, which is a
		   question a case has to be able to move. */
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
		int claimed = db.sql("update verification set state = ?, decided_at = now(),"
						+ " decided_by = a.id,"
						+ " decided_by_name = a.first_name || ' ' || a.last_name,"
						+ " reason = ?, photo_id = null"
						+ " from account a where verification.id = ? and verification.state = ?"
						+ " and a.id = ?")
				.params(state, DecidingOnASubmission.reasonAsItGoesIn(answer), item.id(),
						DecidingOnASubmission.WAITING, asking.account())
				.update();

		if (claimed == 0) {
			return new Carried(no(HttpStatus.CONFLICT, SOMEBODY_ANSWERED_IT_ALREADY), null, null);
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
				said = countTheResult(item, sent);
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
	 * for that shape before. The name is read only after {@link #write} has refused a
	 * described race, so on every road that reads it the join found its row.
	 *
	 * <p>{@code race_date} is taken off the SUBMISSION and not off the race, because V10's
	 * composite key {@code (race_id, race_date)} with {@code on update cascade} is what makes
	 * the two the same fact: the database refuses a day that is not that race's and rewrites
	 * the submission the moment a race moves.
	 */
	private Submission submissionBehind(Item item) {
		return db.sql("select rs.race_id, rs.race_date, ra.name, rs.distance_km, rs.ascent_m,"
						+ " rs.descent_m, rs.seconds, rs.amends_result_id"
						+ " from result_submission rs"
						+ " left join race ra on ra.id = rs.race_id"
						+ " where rs.id = ?")
				.param(item.resultSubmissionId())
				.query((row, one) -> new Submission(row.getObject(1, Long.class),
						row.getDate(2).toLocalDate(), row.getString(3), row.getBigDecimal(4),
						row.getInt(5), row.getInt(6), row.getInt(7), row.getObject(8, Long.class)))
				.single();
	}

	/**
	 * THE TWO THINGS THAT REFUSE AN APPROVED RESULT, ASKED WITHOUT WRITING ANYTHING.
	 *
	 * <p>Both are states the schema permits and this route cannot carry out, and both are
	 * settled before the queue row is claimed for the reason {@link #whyTheTeamCannotBeMade}
	 * gives from its own side: asked afterwards they would need the transaction rolled back,
	 * and a rollback inside a test-managed transaction poisons the outer one instead.
	 *
	 * @param sent what the row names, or empty where it names nothing
	 * @return the refusal, or nothing where there is none
	 */
	private static Optional<ResponseEntity<?>> whyTheRunCannotBeCounted(Submission sent) {
		if (sent == null) {
			return Optional.of(no(HttpStatus.CONFLICT, THE_ITEM_CARRIES_NO_RUN));
		}

		if (sent.raceId() == null) {
			return Optional.of(no(HttpStatus.CONFLICT, THE_RACE_IS_NOT_IN_THE_CALENDAR));
		}

		return Optional.empty();
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
	 * @return what the member is told by post once this has committed
	 */
	private Said countTheResult(Item item, Submission sent) {

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
		int theSeasonAfterTheRun = sent.raceDate().getYear() + 1;
		boolean wasOpen = beginnersCategoryIsOpenFor(item.competitorId(), theSeasonAfterTheRun);

		BigDecimal points = BtlScoreCalculator.calculate(sent.distanceKm().doubleValue(),
				sent.ascentM(), sent.descentM(), sent.seconds());

		/* THE RUN AS IT IS APPROVED, BUILT ONCE. The letter about this approval and the line in his
		   inbox about what it did to his category are two messages about one run, and they cannot
		   name two different runs if both are written from this one value. */
		Run counted = new Run(sent.raceName(), sent.raceDate(), sent.distanceKm(), sent.ascentM(),
				sent.descentM(), sent.seconds(), points);

		if (sent.amendsResultId() == null) {
			db.sql("insert into result (competitor_id, race_id, race_date, distance_km,"
							+ " ascent_m, descent_m, seconds, points)"
							+ " values (?, ?, ?, ?, ?, ?, ?, ?)")
					.params(item.competitorId(), sent.raceId(), sent.raceDate(), sent.distanceKm(),
							sent.ascentM(), sent.descentM(), sent.seconds(), points)
					.update();
		} else {
			db.sql("update result set distance_km = ?, ascent_m = ?, descent_m = ?, seconds = ?,"
							+ " points = ? where id = ?")
					.params(sent.distanceKm(), sent.ascentM(), sent.descentM(), sent.seconds(),
							points, sent.amendsResultId())
					.update();
		}

		if (wasOpen && !beginnersCategoryIsOpenFor(item.competitorId(), theSeasonAfterTheRun)) {
			tellHimHisCategoryMoved(item.competitorId(), theSeasonAfterTheRun, counted);
		}

		return WhatAResultChangeSays.approved(counted);
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
	 * <p><b>The league is blind-copied, which is what every other message about a member's
	 * result already does</b> ({@link ResultWriteApi}), and doing otherwise would make the
	 * approval the one message about a result the league cannot see. That reading is derived
	 * from the shape already in the portal rather than from a decision naming this message.
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
	 * @param raceId        the calendar's race, or empty where the member described one
	 *                      instead; an approval of the second is refused
	 * @param raceName      the race's own name, and empty for exactly the rows that are
	 *                      refused, so every road that reads it found its row
	 * @param amendsResultId the result this replaces, or empty where it is a first report.
	 *                       V32 chose a nullable pointer over a flag beside one, „there or
	 *                       not, rather than a flag and a pointer that have to agree"
	 */
	private record Submission(Long raceId, LocalDate raceDate, String raceName,
			BigDecimal distanceKm, int ascentM, int descentM, int seconds, Long amendsResultId) {
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
