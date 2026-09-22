package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
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
import java.time.LocalDate;
import java.util.Optional;

/**
 * A MEMBER RATING AN EVENT, WHICH TAKES {@link TeamWriteApi}'S SHAPE BECAUSE IT IS THE
 * SAME KIND OF WRITE: THE SECOND ROUTE ON THIS PORTAL THAT ENDS IN THE MODERATOR'S QUEUE
 * RATHER THAN IN THE THING IT IS ABOUT.
 *
 * <p>Owner, PDL P22/P28a, 06.08.2026: „Komentari idu kroz odobrenje pre objave" (PDL
 * 3098). So this route makes no {@code event_comment}. It makes a {@code
 * comment_submission} and the {@code verification} row that carries it to whoever
 * decides, and until that decision the rating and the words are visible to nobody but
 * the member who sent them - {@link CommentApi} reads {@code event_comment} alone and
 * names {@code verification} nowhere, „that has been a leak once already" in its own
 * words.
 *
 * <p><b>AND IT IS WRITTEN BY A MEMBER, WHICH IS WHY IT CARRIES NO {@link RightIsNeeded}
 * EITHER.</b> Rating an event is what every member may do, not a box the superadmin
 * ticks for a moderator. It is named in {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}
 * for that reason, alongside {@code POST /api/teams} - the snapshot compares exactly, so
 * this route could not have been added quietly. Unauthenticated is 401 from the chain
 * before this class runs, the same shape {@link CommentApi}'s own {@code GET} already
 * has and the same reason: there is no condition in this class about whether anybody is
 * signed in, and there must not be one.
 *
 * <p><b>THE MAPPING SAYS WHAT IT CONSUMES</b>, {@link TeamWriteApi}'s fourth branch of
 * one decision, copied rather than rediscovered: without {@code consumes}, a
 * {@code POST} with no {@code Content-Type} reaches the argument resolver and answers
 * 415, a third response that says „this address is here" beside the 401 an outsider gets
 * and the 201 a member gets - a leak {@link NothingIsHereRatherThanAlmost} exists to
 * close everywhere else on this server.
 *
 * <p><b>AN ACCOUNT NAMING NO MEMBER IS ANSWERED THE SAME EMPTY 404 {@link TeamWriteApi}
 * ANSWERS IT WITH</b>, for the same reason: V23 calls it the ordinary case for a
 * moderator who does not race, and {@link InboxApi} and {@link NotificationApi} already
 * answer it that way. There is nobody to file a submission under.
 *
 * <p><b>ALL THREE MARKS OR NONE, NEVER A SUBSET, AND THAT IS PDL P6'S OWN ARITHMETIC
 * RATHER THAN A TASTE FOR SYMMETRY.</b> PDL, 07.08.2026 („Ukupna ocena se pokazuje samo
 * kad su sve tri date"): the overall a card draws is the average of the three, worked
 * out wherever it is shown and never stored, so a mark left out divides the same total
 * by three and quietly answers a third of itself - five for the organisation alone
 * publishing as 1,7 while the same card calls the other two „Bez ocene". The form
 * already refuses to send until all three are chosen ({@code event.commentNeedsMarks},
 * {@code RateEvent.tsx}); this is the same rule kept a second time at the one address
 * that can be reached without it, exactly as {@link TeamWriteApi} keeps the transfer
 * window at the door as well as on the button. Answered as {@link #THE_FORM_IS_NOT_COMPLETE}
 * rather than as a fourth reason of its own: a mark of nought and a mark left out of the
 * request are one state from here, the same way {@link TeamWriteApi#isNothing} treats
 * absent, blank and a run of spaces as one answer rather than three.
 *
 * <p><b>THE COMMENT ITSELF MAY BE EMPTY.</b> PDL 370: „Komentar je fakultativan" - the
 * text is optional, the marks are not, and the two are asked apart rather than folded
 * into one completeness check.
 *
 * <p><b>THE EVENT HAS TO HAVE BEEN RUN, AND THAT IS ANSWERED HERE AND NOT ONLY BY
 * HIDING A LINK.</b> PDL, 07.08.2026 („Ocena i komentar se ne primaju za trku koja nije
 * istrčala"): „P9 već odbija datum u budućnosti, a pravilo je do sad bilo čuvano samo
 * skrivanjem dugmeta: adresa {@code /kalendar/{adresa}/ocena} je otvarala formu i
 * primala unos." {@code RateOne} in {@code RateEvent.tsx} already refuses a future event
 * on the screen; before this route existed there was nothing behind that screen at all,
 * so a typed address or a replayed request reached nothing that could refuse it. Read
 * off {@code btl_event.date} inside this handler and compared in {@link SeasonClock#ZONE},
 * never off the machine's own zone, for the reason every date on this server is: read
 * as the machine's day this would be right in Belgrade and wrong on the server it
 * actually runs on. <b>The day of the race itself counts as run</b> - the owner's own
 * words, „Dan same trke se računa kao održan, jer se ocena daje na povratku sa nje" - so
 * the comparison is {@code date.isAfter(today)} and never {@code isBefore}.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>Whether this member ran the event.</b> PDL 371 names the two places that ask:
 * „forma je ne nudi kome ne pripada, a moderator vidi šta je stiglo" - the FORM (through
 * {@code ran(results, races, event.id, mine)}, checked before the screen ever draws a
 * star) and the MODERATOR reading the card. This route is not the third place, and it is
 * not added on the strength of a reading between those lines: PDL names two and this
 * stays at two. A member with no result at all can still reach this address by typing
 * it, and the answer he gets is 201 - the same boundary {@link TeamWriteApi} draws
 * around its own three refusals rather than inventing a fourth.
 * <li><b>A second comment on an event this member has already written one about.</b>
 * Nothing here refuses it, because nothing decided that it should: PDL 3206 says abuse
 * is not expected of somebody signed in, and {@link TeamWriteApi} already answers the
 * identical question about a second proposal the same way - „nothing decided that it
 * should be refused" - while {@link MyApplicationsApi}'s own one-at-a-time rule guards a
 * single profile rather than a per-event count. The moderator is the gate PDL 371 names,
 * and he sees every waiting item on the tab, including two from one member about one
 * race.
 * <li><b>A length on the text.</b> The schema names none - {@code comment_submission.body}
 * is {@code text} with no check - and neither does any other writing route on this
 * server, {@link TeamWriteApi} says so of its own {@code bio}/{@code link}/{@code note}
 * in as many words. Left out here rather than invented, for the day somebody decides one.
 * <li><b>Whether the member's fee is current.</b> V23 makes {@code account.competitor_id}
 * the only fact this route reads to find him, and PDL 3178's „registrovan a neplaćen ne
 * može ništa" is about an account with NO competitor behind it at all - the case
 * {@link #away()} already answers - not about a member whose fee has since lapsed. No
 * write on this server gates on {@code competitor.active}; it governs what a PUBLIC
 * answer links back to ({@link CommentApi}'s own {@code case when author.active}), never
 * who may submit. A lapsed member's rating waits and is decided exactly like anybody
 * else's.
 * </ul>
 *
 * <p><b>THE SUBJECT IS READ LIVE, IN THE SAME STATEMENT THAT WRITES IT, NEVER CAPTURED
 * IN JAVA</b> - {@link MeWriteApi#queued}'s own shape, {@code insert ... select ... from}
 * rather than a variable read earlier and handed to a parameter. ADL A64's A5 decided
 * the identical class of question - captured against live - the other way for the name a
 * published comment carries, „the name as it was when the comment went out... *went out*
 * means published, not sent in": a value copied once is a value that can go stale between
 * the copy and the moment that matters. Applied here to the event's OWN name for the
 * queue card, and nothing stops it going stale between one Java statement and the next
 * inside a single request; read inside the {@code insert}, there is no moment for it to.
 *
 * <p><b>AND THE TEXT GOES INTO BOTH TABLES, WHICH IS NOT THE SAME SHAPE {@link TeamWriteApi}
 * USES FOR {@code note}.</b> There {@code note} lives only in {@code verification.body},
 * because a team's proposal carries no column for what a member wrote TO A MODERATOR.
 * Here there is no such split: {@link VerificationApi}'s own answer reads {@code v.body}
 * for every tab alike, including this one, so the card a moderator reads has to carry the
 * words; and {@link VerificationWriteApi#publishTheComment} copies the words out of
 * {@code comment_submission.body} and not out of {@code verification.body} when it
 * publishes, so the row that becomes the comment has to carry them too. One value, written
 * into both columns from the one string this handler is given, rather than a second home
 * for it invented on one side or the other.
 *
 * <p><b>ONE TRANSACTION FROM THE SUBMISSION TO THE QUEUE ROW</b>, {@code TransactionTemplate}
 * written by hand in the field rather than {@code @Transactional} on the method - the choice
 * {@link TeamWriteApi} made and the measured reason it gives for it: a test-managed
 * transaction swallows the question, because {@code TransactionTemplate} joins whatever is
 * already open. {@code state}, {@code raised_at} and {@code right_code} are left to V9's own
 * defaults, the same absence {@link TeamWriteApi} and {@link MeWriteApi} leave.
 *
 * <p><b>AND THE EVENT MUST BE A REAL ONE</b>, asked once with a plain {@code select} rather
 * than left to the foreign key: a key that fails arrives as a 500 after the form has been
 * filled in, which is the fault {@link TeamWriteApi}'s own country lookup exists to turn
 * into an answer instead. Answered {@link #THE_EVENT_IS_NOT_KNOWN} before the day on it is
 * even asked about, so the two refusals cannot be confused for one another.
 */
@RestController
class CommentWriteApi {

	/** All three marks given, or the mark itself out of scale. One name for both, matching
	 *  {@link TeamWriteApi#isNothing}'s own reasoning: a guard written against one shape of
	 *  "not there" lets the others through to a column whose {@code check} would then
	 *  refuse them as a server fault instead of an answer. */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** No {@code btl_event} answers to the id that was sent. */
	static final String THE_EVENT_IS_NOT_KNOWN = "theEventIsNotKnown";

	/** PDL, 07.08.2026: a rating is not accepted before the race is run. The day of the
	 *  race itself counts as run. */
	static final String THE_EVENT_HAS_NOT_BEEN_RUN = "theEventHasNotBeenRun";

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final Clock clock;

	/** Written by hand rather than left on the method, {@link TeamWriteApi}'s own choice
	 *  and for its own measured reason: a submission and the queue row that carries it are
	 *  one thing, and {@code @Transactional} on this class would let a test go on passing
	 *  while the second statement silently never ran. */
	private final TransactionTemplate inOneTransaction;

	CommentWriteApi(JdbcClient db, MemberOfAccount memberOfAccount, Clock clock,
			TransactionTemplate inOneTransaction) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * @param eventId      the event this is about, {@code btl_event.id}
	 * @param organisation PDL P6's first mark, 0 to 5
	 * @param value        the second, „vrednost za novac"
	 * @param ambience     the third, „ambijent"
	 * @param body         what the member wrote, which may be empty (PDL 370)
	 */
	record Rated(long eventId, int organisation, int value, int ambience, String body) {
	}

	/** Why a rating could not be sent. */
	record Refused(String reason) {
	}

	/** @param id the submission now standing in the queue. */
	record Made(long id) {
	}

	@PostMapping(path = "/api/comments", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> rate(@AuthenticationPrincipal WhoIsAsking.Member asking, @RequestBody Rated typed) {
		Long me = memberOfAccount.competitorId(asking.account());

		/* AN ACCOUNT THAT NAMES NO MEMBER, the same case and the same answer TeamWriteApi
		   gives it: there is nobody to file this under. */
		if (me == null) {
			return away();
		}

		if (!allThreeAreGiven(typed)) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		Optional<LocalDate> when = dateOf(typed.eventId());

		if (when.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_EVENT_IS_NOT_KNOWN);
		}

		/* THE DAY OF THE RACE ITSELF COUNTS AS RUN (owner, 07.08.2026), so this compares
		   with `isAfter` and never `isBefore` or `!isBefore`: an event dated today is not
		   after today, and a rating for it goes through. */
		if (when.get().isAfter(LocalDate.now(clock.withZone(SeasonClock.ZONE)))) {
			return no(HttpStatus.BAD_REQUEST, THE_EVENT_HAS_NOT_BEEN_RUN);
		}

		return inOneTransaction.execute(committing -> write(me, typed));
	}

	/**
	 * THE WRITING, AND IT IS ONE TRANSACTION FROM THE SUBMISSION TO THE QUEUE ROW.
	 *
	 * <p>The text is read once, into a local, and written into both tables from that one
	 * value - {@link #db}'s two statements never see the request a second time - so there
	 * is no moment at which the card a moderator reads and the row a decision would publish
	 * could be made to disagree.
	 */
	private ResponseEntity<?> write(long me, Rated typed) {
		String body = orEmpty(typed.body());

		/* `comment_submission_organisation_in_scale` and its two siblings (V30) bound this
		   the same way the guard above does, 0 to 5; the guard above is stricter, 1 to 5,
		   because a rating reaching this line has already passed `allThreeAreGiven`. */
		long submission = db.sql("insert into comment_submission"
						+ " (event_id, competitor_id, rating_organisation, rating_value,"
						+ " rating_ambience, body) values (?, ?, ?, ?, ?, ?) returning id")
				.params(typed.eventId(), me, typed.organisation(), typed.value(), typed.ambience(),
						body)
				.query(Long.class)
				.single();

		/* THE TAB IT WAITS IN, which is the only one a row carrying a submission may stand
		   in (`verification_only_the_comments_queue_carries_a_submission`). `state`,
		   `raised_at` and `right_code` are left to V9, the same absence TeamWriteApi and
		   MeWriteApi leave. THE SUBJECT IS THE EVENT'S NAME, READ HERE AND NOT CAPTURED
		   EARLIER - see the class-level note on why that is ADL A64 A5's own question asked
		   of a second value. */
		db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " comment_submission_id)"
						+ " select 'comments', ?, e.name, ?, ?"
						+ " from btl_event e where e.id = ?")
				.params(me, body, submission, typed.eventId())
				.update();

		return ResponseEntity.status(HttpStatus.CREATED).body(new Made(submission));
	}

	/** The day this event is on, or nothing where the id names no event at all. */
	private Optional<LocalDate> dateOf(long eventId) {
		return db.sql("select date from btl_event where id = ?")
				.param(eventId)
				.query((row, one) -> row.getDate(1).toLocalDate())
				.optional();
	}

	/** All three in 1 to 5, never 0: a mark left out and a mark of nought are one state
	 *  from here, PDL P6's own arithmetic (see the class-level note). */
	private static boolean allThreeAreGiven(Rated typed) {
		return inScale(typed.organisation()) && inScale(typed.value()) && inScale(typed.ambience());
	}

	private static boolean inScale(int mark) {
		return mark >= 1 && mark <= 5;
	}

	/** {@code comment_submission.body} is NOT NULL and may be empty (V30, PDL 370). */
	private static String orEmpty(String value) {
		return value == null ? "" : value.strip();
	}

	/** The answer for somebody this address is not for, which carries nothing at all -
	 *  {@link TeamWriteApi#away}'s own shape and its own reason: there is nothing decided
	 *  to put in a body. */
	private static ResponseEntity<?> away() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
