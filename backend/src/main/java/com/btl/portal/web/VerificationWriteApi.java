package com.btl.portal.web;

import com.btl.portal.domain.event.EventAddress;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.verification.DecidingOnASubmission;
import com.btl.portal.domain.verification.HoldingAnItem;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
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
 * length: {@link RightIsNeeded} names ONE code, there are SIX queues, and a single code on
 * the route „would either shut the route to five moderators out of six or open all six
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
 * <p><b>THE REFUSAL IS 404 AND IT GOES DOWN {@code sendError}.</b> ADL A8, the owner on
 * 13.09.2026: „Server odbija moderatora bez privilegije sa 404, ne sa 403", because the
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
 * <p><b>THIS ROUTE CARRIES OUT FOUR QUEUES OF THE SIX NOW, WHERE UNTIL 22.09.2026 IT CARRIED
 * OUT TWO, AND THE REMAINING TWO ARE STILL REFUSED RATHER THAN RECORDED.</b> {@code profiles}
 * and {@code teams} were the only two anything on this server could put a row into; V30 gave
 * {@code comments} and {@code schedule} a row of their own too
 * ({@code comment_submission}, {@code schedule_proposal}), and ADL A64's A3 is the owner
 * saying this file should carry them out rather than go on only serving their fields. Nothing
 * writes a {@code result_submission} still - measured, not assumed: {@code insert into
 * verification} exists today in exactly two places under {@code backend/src/main}
 * ({@link MeWriteApi}, {@link TeamWriteApi} - a third grep hit is {@code insert into
 * verification_lock}, a different table), the same count V30's own header measures before
 * this file carried out a third and a fourth queue. And the two new tabs still wait on the
 * increment that lets a member reach them at all - so {@code payments} and {@code results} are
 * refused
 * for the same reason they always were: recording the decision and doing nothing else would
 * be worse than refusing, since an approved result that never enters the rankings (PDL P9,
 * „Rezultat ulazi u rang liste tek posle odobrenja") has left the queue for ever and reached
 * nothing, the one outcome a screen cannot undo. <b>And {@code results} is not merely unbuilt
 * but UNDECIDED</b>: ADL A36, „Transakcione granice", says in as many words that the „trece
 * mesto, verifikacija rezultata, i dalje NIJE odluceno i ostaje otvoreno", so what is inside
 * the transaction and what is after it has no answer yet and this increment must not invent
 * one.
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
 * moderatorima" says the note is not a reason owed to the member the other five
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
 * portal inboks da je njihov tim prihvacen." An approved PROFILE does not, and that is
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

	/** {@code verification.queue} for the four tabs this route can carry out. */
	private static final String PROFILES = "profiles";

	private static final String TEAMS = "teams";

	/** ADL A64, 22.09.2026: the row whose refusal needs no reason (A4) and whose approval
	 *  publishes a row into {@code event_comment} rather than refusing 409 (A3). */
	private static final String COMMENTS = "comments";

	/** ADL A64, 22.09.2026: the row whose approval moves an event and its races (A3). */
	private static final String SCHEDULE = "schedule";

	/**
	 * THE TABS AN APPROVAL HERE KNOWS WHAT TO DO WITH.
	 *
	 * <p>A written list, and the floor under it asks the DATABASE for every queue there is
	 * ({@code admin_right where scope = 'queue'}) and requires each one to be either carried
	 * out or refused with the reason below. A seventh tab, or a sixth that grows a
	 * consequence, fails that case until somebody decides what it means - which is the
	 * opposite of a list that quietly goes on being five-sixths right.
	 */
	private static final Set<String> CARRIED_OUT_HERE = Set.of(PROFILES, TEAMS, COMMENTS, SCHEDULE);

	private static final String NOT_DECIDED_ON_THIS_PORTAL_YET =
			"Odluka o ovom redu još nije uvedena.";

	private static final String SOMEBODY_ELSE_IS_READING_IT =
			"Stavku trenutno drži drugi moderator.";

	private static final String SOMEBODY_ANSWERED_IT_ALREADY = "O stavci je već odlučeno.";

	private static final String A_REFUSAL_NEEDS_A_REASON = "Uz odbijanje je razlog obavezan.";

	private static final String THE_FORM_IS_NOT_COMPLETE = "Forma nije popunjena.";

	private static final String THE_NAME_IS_TAKEN = "Tim sa tim nazivom već postoji.";

	private static final String HE_IS_ALREADY_IN_A_TEAM = "Osnivač je već u nekom timu.";

	/** PDL P10b, owner 22.09.2026: an event with a result already written may not be moved
	 *  across 1 January on the race that result was run at. */
	private static final String THE_DATE_WOULD_MOVE_A_RESULT_TO_ANOTHER_YEAR =
			"Događaj ima upisane rezultate koje bi ovaj datum prebacio u drugu godinu.";

	/** V19: a race counted by a league of its own year may not be carried out of that year,
	 *  because {@code league_race_race_fk} is composite over {@code (race_id, season)} and
	 *  does not cascade an update. The same refusal {@code EventWriteApi.change} and
	 *  {@code RaceWriteApi.change} make, said in this queue's own voice. */
	private static final String THE_DATE_WOULD_TAKE_A_RACE_OUT_OF_ITS_LEAGUE =
			"Događaj ima trku koja se boduje u ligi te sezone, pa ne može u drugu godinu.";

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

	VerificationWriteApi(JdbcClient db, WhatHeMayDo mayHe, TransactionTemplate inOneTransaction,
			Clock clock, MemberOfAccount memberOfAccount) {
		this.db = db;
		this.mayHe = mayHe;
		this.inOneTransaction = inOneTransaction;
		this.clock = clock;
		this.memberOfAccount = memberOfAccount;
	}

	/** Why something was refused, the shape every writing route on this server answers with. */
	record Refused(String reason) {
	}

	/**
	 * @param id         the item he now holds
	 * @param secondsLeft how long he has, which the owner made an obligation rather than a
	 *                    nicety: „portal mora moderatoru da kaze koliko mu je ostalo, pre
	 *                    nego sto odluci"
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
	ResponseEntity<?> hold(@PathVariable long id,
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
				.params(id, asking.account(), Timestamp.from(until), Timestamp.from(now))
				.update();

		if (taken == 0) {
			return no(HttpStatus.CONFLICT, SOMEBODY_ELSE_IS_READING_IT);
		}

		return ResponseEntity.ok(new Held(id, HoldingAnItem.leftOf(
				new HoldingAnItem.Hold(asking.account(), until), now).toSeconds()));
	}

	/**
	 * HE IS DONE WITH IT, OR THE SUPERADMIN TAKES IT OFF SOMEBODY WHO IS NOT.
	 *
	 * <p><b>The second half is the owner's, with its cost priced and accepted:</b>
	 * „Superadmin SME da otme tudje zakljucavanje, i onaj kome je oteto to sazna. Time
	 * zaglavljena stavka uvek ima resenje koje ne trazi bazu. Cena koju je prihvatio: jedna
	 * ruta vise i jedna poruka u sanduce, da moderator ne otkrije tek kad mu odluka ne
	 * prodje." This is that one route, and the message is written below.
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
	ResponseEntity<?> letGo(@PathVariable long id,
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
			db.sql("delete from verification_lock where verification_id = ?").param(id).update();

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
	 * @param response asked for so a refusal can go down the same road an address that is
	 *                 not there takes
	 */
	@PostMapping(path = "/api/verification/{id}/decision", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> decide(@PathVariable long id, @RequestBody Answered typed,
			@AuthenticationPrincipal WhoIsAsking.Member asking,
			HttpServletResponse response) throws IOException {

		/* THE DOOR FIRST, AND NOTHING ABOUT THE BODY BEFORE IT. Measured on a real socket
		   on 21.09.2026: asked the other way round, a plain competitor holding nothing sent
		   `{}` and got 400 in 348 bytes, while the same body on a sibling address that maps
		   nothing got 404 in 425. One request, and he has learnt that an administrative
		   action lives at that address - which is the whole of what ADL A8 forbids, „ne sme
		   ni da sazna da radnja postoji". It did not leak WHICH items exist; it leaked that
		   the route does, which is the same oracle one level up. A refusal about the form is
		   a refusal only somebody who may decide is entitled to hear. */
		Optional<Item> found = itemHeMayModerate(id, asking);

		if (found.isEmpty()) {
			return away(response);
		}

		Item item = found.get();

		/* AN EMPTY OBJECT, WHICH IS THE ONE INCOMPLETE FORM THAT REACHES HERE. A body that
		   is missing or unreadable never does: the route declares it consumes JSON and
		   {@code @RequestBody} is required, so the chain answers 400 before this method
		   runs. A null check over {@code typed} would be a branch no request can reach,
		   and a branch nothing can measure is one nobody can be sure of. */
		if (typed.approved() == null) {
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
			case APPROVE_IT, REJECT_IT ->
					inOneTransaction.execute(committing -> write(item, answer, asking));
		};
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
	private ResponseEntity<?> write(Item item, DecidingOnASubmission.Answer answer,
			WhoIsAsking.Member asking) {

		/* WHAT AN APPROVAL WOULD RUN INTO, ASKED FIRST AND WRITING NOTHING. Both of these
		   refuse the answer rather than record it, so they have to be settled before the row
		   is claimed: asked afterwards they would need the transaction rolled back, and a
		   rollback inside a test-managed transaction poisons the outer one instead. Nothing
		   here writes, so there is nothing to undo. */
		Proposal proposal = TEAMS.equals(item.queue()) ? proposalBehind(item) : null;

		/* THE SAME "ASKED FIRST AND WRITING NOTHING", and read exactly once: the row
		   scheduleMoveBehind reads is the row PDL P10b's guard below judges AND the row
		   moveTheEvent later writes from, so a refusal and the write it would otherwise
		   precede cannot end up reading two different answers to "what day does this event
		   stand on right now" (ADL A64 A2 already makes the same point about
		   schedule_proposal.event_date, which this is one door further down from). */
		ScheduleMove move = SCHEDULE.equals(item.queue()) ? scheduleMoveBehind(item) : null;

		/* THE SEASON, READ ONCE AND USED BY BOTH HALVES. See the head of this class for why
		   it is this function and not the one beside it, and for the day the portal got it
		   wrong. Read twice - once to refuse and once to write - it would be the same fact
		   with two homes, which is the thing this file spends most of its words avoiding. */
		int season = SeasonClock.transfersTakeEffect(clock.instant().atZone(SeasonClock.ZONE));

		if (answer.yes() && proposal != null) {
			Optional<ResponseEntity<?>> refused = whyTheTeamCannotBeMade(proposal, season);

			if (refused.isPresent()) {
				return refused.get();
			}
		}

		/* PDL P10b, owner 22.09.2026: „Ako dogadjaj ima upisane rezultate a pomeraj datuma bi
		   ih preveo u drugu godinu, portal odbija izmenu i kaze zasto." Settled before the
		   claim for the identical reason the team's refusal above is. Asked of
		   EventWriteApi.wouldStrandAResultInAnotherYear rather than a copy of the same
		   query written here: the plan for THIS increment does touch that class, unlike the
		   plan for the increment that wrote moveTheEvent, so there is no reason left to
		   repeat the shape instead of calling it. */
		if (answer.yes() && move != null
				&& EventWriteApi.wouldStrandAResultInAnotherYear(db, move.eventId(), move.deltaDays())) {
			return no(HttpStatus.CONFLICT, THE_DATE_WOULD_MOVE_A_RESULT_TO_ANOTHER_YEAR);
		}

		/* AND THE SAME FOR A LEAGUE (V19), settled in the same place and asked of the same
		   shared question rather than of a copy of it.

		   THIS QUEUE IS THE THIRD DOOR ON ONE `update race set date = date + ...`, and until
		   24.09.2026 it was one of the two that did not ask. `RaceWriteApi` has refused a
		   single race since B40; this and `EventWriteApi.change` move races by the armful,
		   and `league_race_race_fk` - composite over `(race_id, season)` and without
		   `on update cascade` - answered them with a server fault instead. A moderator
		   pressing „Prihvati" on a perfectly ordinary proposal met a 500. */
		if (answer.yes() && move != null
				&& EventWriteApi.wouldTakeARaceOutOfItsLeaguesSeason(db, move.eventId(),
						move.deltaDays())) {
			return no(HttpStatus.CONFLICT, THE_DATE_WOULD_TAKE_A_RACE_OUT_OF_ITS_LEAGUE);
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
		 * the state OUTSIDE this transaction, which is a check-then-act, and the owner's own
		 * precedent says what that is worth: `PaymentNumberConcurrencyTest` exists because
		 * „Java provera-pa-upis prolazi svaki sekvencijalni slucaj i pada samo ovde".
		 *
		 * So the claim is the UPDATE and the answer is the COUNT. `where state = 'waiting'`
		 * makes the statement take the row's lock and re-read it after the other transaction
		 * commits; the loser matches nothing, writes nothing, and is told 409, which is the
		 * owner's own requirement that „drugi moderator na zauzetu stavku dobija odbijenicu,
		 * ne tihi neuspeh" (PDL P9, 18.09.2026). It is also why every consequence below
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
			return no(HttpStatus.CONFLICT, SOMEBODY_ANSWERED_IT_ALREADY);
		}

		/* AND THE HOLD GOES WITH THE ANSWER. Nothing is being read any more, and a decided
		   row carrying a hold would be the one shape V28 says it cannot refuse by itself. */
		db.sql("delete from verification_lock where verification_id = ?").param(item.id()).update();

		/* FOUR QUEUES, FOUR MEANINGS, and the chain ends on an unconditional `else` rather
		   than on a fourth named check: `item.queue()` is one of exactly the four
		   `CARRIED_OUT_HERE` names by the time this runs - `decide` above already refused
		   anything else - so asking a fourth time would be a branch nothing can ever take
		   the other way, which is the shape this file removes rather than writes (V29's own
		   trigger function says why in as many words). PROFILES is the one left as the
		   catch, because it is the one queue this method already reads straight off `item`
		   with no proposal of its own to fetch. */
		if (answer.yes()) {
			if (TEAMS.equals(item.queue())) {
				makeTheTeam(proposal, season);
			} else if (COMMENTS.equals(item.queue())) {
				publishTheComment(item);
			} else if (SCHEDULE.equals(item.queue())) {
				moveTheEvent(move);
			} else {
				publishTheProfile(item);
			}
		} else if (!COMMENTS.equals(item.queue())) {
			/* COMMENTS NEVER REACHES HERE (ADL A64 A4). PDL P22, „Jedini red bez njega je red
			   komentara, gde se ne odbija nego brise, a napomena je neobavezna i namenjena
			   moderatorima" says the note beside a deleted comment - where there is one - is
			   not a reason owed to the member, unlike the other three that reach this
			   branch, which PDL P22 requires the opposite of: „razlog stize u sanduce onome
			   ko je stavku poslao". */
			tell(item.competitorId(), "Stavka je odbijena",
					DecidingOnASubmission.reasonAsItGoesIn(answer));
		}

		return ResponseEntity.ok(new Decided(item.id(), state));
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
	 * prava za svoj tim", and 05.09.2026: „Odobrenje novog tima upisuje osnivaca u taj tim",
	 * which was found by a review of PR 186 when approval wrote only the team and the
	 * founder could go on to found another.
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
	 * WHAT A SCHEDULE PROPOSAL ASKS FOR, READ ONCE BEFORE THE ROW IS CLAIMED: the event,
	 * the day it stands on right now, and the day it is being asked to move to.
	 *
	 * <p><b>THE DAY MOVED FROM IS READ FRESH, NEVER FROM THE PROPOSAL (ADL A64 A2).</b> An
	 * administrator may have moved this event again since the report was sent, and A2's
	 * whole point is that the report survives that disagreement rather than pretending it
	 * did not happen: {@code schedule_proposal.event_date} is the day the reporter SAW,
	 * not the day that is true now, so {@code btl_event.date} is read inside THIS
	 * transaction instead - exactly as {@code EventWriteApi.change} reads its own
	 * {@code before} fresh rather than trusting what the caller believed the day to be.
	 *
	 * <p><b>READ HERE AND CARRIED, RATHER THAN READ AGAIN IN {@link #moveTheEvent}
	 * (PDL P10b).</b> The row this method returns is what the P10b guard in {@link #write}
	 * judges AND what {@link #moveTheEvent} then writes from; read twice, the two could
	 * answer "what day does this event stand on" differently if an administrator moved it
	 * for a second time in between, and the write would apply a delta the guard never saw.
	 */
	private ScheduleMove scheduleMoveBehind(Item item) {
		return db.sql("select e.id, e.date, sp.proposed_date from schedule_proposal sp"
						+ " join btl_event e on e.id = sp.event_id where sp.id = ?")
				.param(item.scheduleProposalId())
				.query((row, one) -> new ScheduleMove(row.getLong(1), row.getDate(2).toLocalDate(),
						row.getDate(3).toLocalDate()))
				.single();
	}

	/**
	 * THE EVENT MOVES TO THE PROPOSED DAY, AND ITS RACES MOVE WITH IT BY THE SAME NUMBER
	 * OF DAYS (ADL A64 A3).
	 *
	 * <p>Owner, 10.08.2026, quoted in {@link EventWriteApi}: „Kad se datum dogadjaja
	 * pomeri, trke se pomeraju sa njim, za isti broj dana ... Isto vazi i za obicnu
	 * ispravku datuma, ne samo za kopiju." The two statements below ARE that sentence,
	 * copied rather than called: the plan for this increment names {@link EventWriteApi}
	 * as a file it does not touch, so the shape is repeated here instead of extracted,
	 * and both copies answer to the same owner's sentence rather than to each other.
	 *
	 * <p><b>By the time this runs, PDL P10b has already been asked and answered.</b>
	 * {@link #write} judges {@code move} before the queue row is claimed and only calls
	 * this method once that has passed, so nothing here asks again whether the move is
	 * allowed - the same division {@link #whyTheTeamCannotBeMade} and
	 * {@link #makeTheTeam} already keep.
	 *
	 * <p>Written without a branch on whether the day moved at all, the same reason
	 * {@code EventWriteApi.change} has none: adding zero days is what "it did not move"
	 * means, and {@code schedule_proposal_proposes_another_day} already keeps a proposal
	 * from ever asking for exactly that.
	 */
	private void moveTheEvent(ScheduleMove move) {
		db.sql("update btl_event set date = ? where id = ?")
				.params(move.proposedDate(), move.eventId())
				.update();

		/* AND ONLY THIS EVENT'S RACES: `where event_id = ?` is the whole of what keeps a
		   race under a DIFFERENT event untouched, the same filter EventWriteApi.change
		   applies for the identical reason. */
		db.sql("update race set date = date + cast(? as int) where event_id = ?")
				.params(move.deltaDays(), move.eventId())
				.update();
	}

	/** The event a schedule proposal is about, the day it stands on right now, and the day
	 *  it is being asked to move to - read once by {@link #scheduleMoveBehind} rather than
	 *  twice, so a PDL P10b refusal and the write it would otherwise precede cannot end up
	 *  reading two different answers to "what day is this, right now". */
	private record ScheduleMove(long eventId, LocalDate before, LocalDate proposedDate) {

		private long deltaDays() {
			return ChronoUnit.DAYS.between(before, proposedDate);
		}
	}

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
	 * refusal, and told apart the key would be an oracle for what is in the queue.
	 *
	 * <p><b>The hold is read in the SAME statement</b>, so „who holds it" and „what state it
	 * is in" are one reading of one moment. Read separately, a hold taken between the two
	 * queries would be a decision made against a row somebody had just opened.
	 */
	private Optional<Item> itemHeMayModerate(long id, WhoIsAsking.Member asking) {
		Optional<Item> item = db.sql("select v.id, v.queue, v.right_code, v.state, v.competitor_id,"
						+ " v.photo_id, v.team_proposal_id, v.comment_submission_id,"
						+ " v.schedule_proposal_id, v.body, l.held_by, l.held_until"
						+ " from verification v"
						+ " left join verification_lock l on l.verification_id = v.id"
						+ " where v.id = ?")
				.param(id)
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
			Long photoId, Long teamProposalId, Long commentSubmissionId, Long scheduleProposalId,
			String body, HoldingAnItem.Hold hold) {
	}

	/** What a member asked for, in the shape an approval copies across. */
	private record Proposal(long competitorId, String name, String bio, String link,
			Long placeId, String city, Long countryId) {
	}
}
