package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.verification.DecidingOnASubmission;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Optional;

/**
 * A MEMBER RATING AN EVENT, WHICH TAKES {@link TeamWriteApi}'S SHAPE BECAUSE IT IS THE
 * SAME KIND OF WRITE: THE SECOND ROUTE ON THIS PORTAL THAT ENDS IN THE MODERATOR'S QUEUE
 * RATHER THAN IN THE THING IT IS ABOUT.
 *
 * <p>Owner, PDL P22/P28a, 06.08.2026: „Komentari idu kroz odobrenje pre objave" (PDL P18,
 * „Komentari idu kroz odobrenje pre objave"), <b>PRECISED BY THE OWNER ON 19.10.2026</b>: „Komentar
 * se salje na moderaciju samo ako ima tekst. Ako ima samo 3 ocene u zvezdicama, objavljuje se
 * odmah." So this route makes one of TWO things, and which one is decided by one question - is
 * there text - asked once in {@link #write}:
 *
 * <ul>
 * <li><b>With text</b>, it makes no {@code event_comment}. It makes a {@code comment_submission}
 * and the {@code verification} row that carries it to whoever decides, and until that decision
 * the rating and the words are on nobody's page - {@link CommentApi} reads {@code event_comment}
 * alone and names {@code verification} nowhere, „that has been a leak once already" in its own
 * words. Answered {@code waiting: true}.
 * <li><b>With three marks and no text</b>, it makes the {@code event_comment} itself, at once,
 * and no submission and no queue row: there is nothing for a moderator to read, so a card
 * for it would be a card with nothing on it. Answered {@code waiting: false}.
 * </ul>
 *
 * <p><b>WHAT COUNTS AS TEXT is this route's own reasoning and not a recorded decision</b> - the
 * owner's sentence says „ima tekst" and nothing in PDL or ADL says what a text is. It is the text
 * after {@link String#strip()} (the same strip {@link #orEmpty} has always applied before storing),
 * so spaces, tabs, line breaks and the Unicode space separators alone are not text. A comment of
 * nothing but those would otherwise stand in a moderator's queue with an empty body to approve.
 * The direction is the safe one for what it does not cover: a character that {@code strip} does not
 * treat as white space (a no-break space, a zero-width space) counts as text and is moderated.
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
 * <p><b>AN ACCOUNT NAMING NO MEMBER IS ANSWERED LIKE AN ADDRESS THAT MAPS NOTHING, AND BEFORE
 * ITS BODY IS READ.</b> V23 calls it the ordinary case for a moderator who does not race, and
 * there is nobody to file a submission under. Two things follow from ADL A8 (owner, 13.09.2026:
 * the server need not give away even that an address exists), and
 * {@code ABodyIsReadAfterTheDoorOverRealHttpTest} measures both over a real socket rather than
 * arguing them. The body is read by {@link WhatWasSent#read} AFTER the member question and is not
 * bound as an argument, because an argument is bound before the first line of the handler and an
 * account that names no member was told 400 for a body that is not JSON while a body that reads
 * got 404 (register 166). And the 404 is the one {@link #nothingIsHere} makes - answered through
 * {@code sendError}, as an address that maps nothing is - and not a status written onto the
 * response, which came back as 225 bytes with {@code Content-Length: 0} where the twin came back
 * chunked as 373. This address is not on {@link ApiSecurity#READ_BY_ANYBODY}, so the price the
 * owner accepted on 18.09.2026 for the three writes that are does not apply to it.
 *
 * <p><b>AND A MEMBER WHOSE FEE DOES NOT STAND IS ANSWERED THE SAME, ON THE SAME LINE.</b>
 * Comments are on the list PDL P8 gives of what a member who has not paid may not do
 * (10.10.2026, „komentare"), so the question that opens this route is
 * {@link ActiveMemberOrAdministration#activeMember} and not „does the account name a member": a
 * member who has never paid, or whose fee has lapsed, is turned away by the branch that turns
 * away an account naming no member, before his body is read. The decision is quoted in full on
 * {@link ActiveMemberOrAdministration}.
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
 * <p><b>THE COMMENT ITSELF MAY BE EMPTY.</b> PDL P6, „Komentar je fakultativan" - the
 * text is optional, the marks are not, and the two are asked apart rather than folded
 * into one completeness check. And since 19.10.2026 an empty one is not queued at all but
 * published (see the top of this note).
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
 * <p><b>ONLY A MEMBER WHO HAS A RESULT ON THE EVENT MAY RATE IT, AND THIS ROUTE ASKS.</b> PDL P6,
 * 11.08.2026: „članovi mogu da ocene samo događaje na kojima imaju upisan rezultat". Until
 * 19.10.2026 the rule stood in two places, the form and the moderator who read what arrived, and this
 * route was deliberately not a third. A rating with three marks and no words no longer reaches a
 * moderator, so the second place was gone, and the owner, 19.10.2026, on a high finding of the review
 * of PR 578: „Dakle ako clan nema rezultat, ne moze uopste da da komentar. To treba da odbije forma."
 * That the SERVER refuses is derived (PDL, [IZVEDENO 19.10.2026]) from „ne moze uopste" and from the
 * rule that all input is checked on the backend. <b>It asks what the form asks</b>
 * ({@code ran(results, races, event.id, mine)}, {@code pages/event/ran.ts}): a row of {@code result}
 * of this member on a race of this event. {@code result} holds only what was approved (a run still
 * waiting is a {@code result_submission}), which is the form's own reading, and the one thing
 * {@code GET /api/results} withholds - the running season of a member whose fee lapsed - cannot
 * differ here, because a member whose fee has lapsed is turned away before this question. Asked
 * AFTER the event is known and has been run, so those two refusals keep their sentences, and answered
 * as {@link #nothingIsHere} and not as a reason of its own: the form never offers this rating to such a
 * member, so there is no screen sentence for it, and ADL A8 asks that a request the server will not
 * take say no more than an address that maps nothing.
 *
 * <p><b>ONE RATING PER MEMBER PER EVENT, AND A NEW ONE REPLACES THE OLD</b> (owner, 19.10.2026,
 * chose among offered outcomes with the recommendation: „Jedna ocena po članu po događaju; nova
 * zamenjuje staru"). A rating with no words replaces the member's published one AT ONCE, in the
 * same transaction ({@link #publishAtOnce}). A rating with words goes to the moderator and the old
 * one stands until he approves it; on approval the approved one replaces the old
 * ({@link VerificationWriteApi#publishTheComment}).
 *
 * <p><b>THE NEWEST ONE SENT WINS, WHICH IS DERIVED FROM THE OWNER'S RULE AND IS NOT HIS WORDS</b> (19.10.2026): from „jedna ocena po članu po događaju; nova zamenjuje staru" it follows
 * that a rating with no words, which replaces at once, also withdraws the same member's rating of the
 * same event that still waits for a moderator, and the cascade of {@code comment_submission} removes
 * its queue row. Only a WAITING one: a decided submission stays, because ADL A36 O11 forbids deleting
 * a decided row. It is taken {@code for update of v skip locked}: a card a moderator is deciding
 * at this very instant is not waited for (he decided first, and waiting for it while holding the
 * member's row would be a lock order opposite to the approval's, which takes the card first and the
 * member second).
 *
 * <p><b>AND SINCE 20.10.2026 A RATING WITH WORDS WITHDRAWS HIS OLDER WAITING ONE TOO</b>, which is
 * derived and not the owner's words: from the same „nova zamenjuje staru" and from the shape the owner
 * chose for an edit (PDL P6, 20.10.2026, „Član uvek sme da obriše svoju ocenu ili da je izmeni": an
 * edit with text goes to the moderator and the old PUBLISHED one stays until he approves it), the newest
 * one SENT wins among the waiting ones. Until then two edits with words left two cards of one member
 * about one event in the queue, and whichever a moderator approved LAST was published, the older one
 * included. Only the waiting card goes; the published one stands until an approval replaces it, which
 * is exactly the half the owner rejected the opposite of („Odbijeno: da izmena sa tekstom odmah skine
 * staru"). The same statement, {@link #withdrawWhatWaits}, for both roads.
 *
 * <p><b>EDITING IS THIS ROUTE AND NOTHING ELSE.</b> The owner's edit (20.10.2026) opens the form with the
 * old marks and text and sends it: without text it is published at once, with text it goes to the
 * moderator and the old one stays published until he approves it. That is, measured case by case,
 * what a new rating already does here, so there is no second door for it. It keeps every gate a rating
 * has, the result on the event included: that is the reading of 20.10.2026 against „Dakle ako clan nema
 * rezultat, ne moze uopste da da komentar" (19.10.2026), derived and not decided in words - an edit
 * makes a new rating, and a member whose result has gone since may delete his rating and not rewrite it.
 *
 * <p><b>DELETING HIS OWN RATING, {@code DELETE /api/comments/{id}}</b> (owner, PDL P6, 20.10.2026:
 * „zelim funkcionalnost da clan moze uvek da obrise svoj komentar"; the shape he chose with the
 * recommendation: „brisanje je odmah ... i briše i onu koja čeka"). The id is the one
 * {@code GET /api/comments} answers his published rating with, which is the card the screen puts
 * „Obriši" beside. It deletes every published rating of his of THAT event (an approval used to be able
 * to make a second) and his rating of it that still waits, by {@link #withdrawWhatWaits}, under the lock
 * on his row, and answers 204. <b>„Uvek" is read as: no result on the event, no day of the event and no
 * season is asked</b> - a member whose result was deleted since, or who rated an event of an earlier
 * season, deletes his rating all the same. <b>What „uvek" is NOT read as, derived and not the owner's
 * words:</b> a member whose fee does not stand is answered 404 like an account naming no member, because
 * PDL P8 (10.10.2026) lists „komentare" among what he may not do and {@code DELETE /api/results/{id}},
 * whose decision says the member deletes „ima pravo na to, iako je verifikovan", is closed to him the
 * same way; he does not see the comments at all (03.10.2026). An id that is not his rating - another
 * member's, a deleted member's (its {@code competitor_id} is null and matches nobody), one that names no
 * row or is not a key - is 404 as well, the answer of an address that maps nothing (ADL A8). A card a
 * moderator is deciding at that very instant is not waited for and stays ({@code skip locked}, above):
 * if he approves it, it is published after the deletion, because he decided first.
 *
 * <p><b>THE MEMBER'S ROW IS LOCKED FIRST</b>, {@code for update}, at the top of the transaction, the
 * shape {@code MyMembershipWriteApi} and {@code PaymentApi} keep. Two ratings of one member at one
 * instant would otherwise both delete nothing, both insert, and leave him two published ratings of one
 * event with no rule in the database to refuse the second. Held, the second reads what the first
 * committed and replaces it. The approval takes the same row ({@code publishTheComment}). There is
 * no unique index (the lock was chosen over one, 19.10.2026), so duplicates already in
 * {@code event_comment} are cleared by the next write of that member, not by a migration.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>A length on the text.</b> The schema names none - {@code comment_submission.body}
 * is {@code text} with no check - and neither does any other writing route on this
 * server, {@link TeamWriteApi} says so of its own {@code bio}/{@code link}/{@code note}
 * in as many words. Left out here rather than invented, for the day somebody decides one.
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

	/** Who is asking, and whether his fee stands: the one question this route opens with. */
	private final ActiveMemberOrAdministration readers;

	private final Clock clock;

	/** Written by hand rather than left on the method, {@link TeamWriteApi}'s own choice
	 *  and for its own measured reason: a submission and the queue row that carries it are
	 *  one thing, and {@code @Transactional} on this class would let a test go on passing
	 *  while the second statement silently never ran. */
	private final TransactionTemplate inOneTransaction;

	CommentWriteApi(JdbcClient db, ActiveMemberOrAdministration readers, Clock clock,
			TransactionTemplate inOneTransaction) {
		this.db = db;
		this.readers = readers;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * @param eventId      the event this is about, {@code btl_event.id}
	 * @param organisation PDL P6's first mark, 0 to 5
	 * @param value        the second, „vrednost za novac"
	 * @param ambience     the third, „ambijent"
	 * @param body         what the member wrote, which may be empty (PDL P6, „Komentar je fakultativan")
	 */
	record Rated(long eventId, int organisation, int value, int ambience, String body) {
	}

	/** Why a rating could not be sent. */
	record Refused(String reason) {
	}

	/**
	 * @param id      the submission now standing in the queue where {@code waiting} is true, and
	 *                the {@code event_comment} just published where it is false - the same number
	 *                {@code GET /api/comments} answers that comment with
	 * @param waiting whether a moderator still has to read it (owner, 19.10.2026: only a comment
	 *                with text is sent to moderation). Answered so a screen says which of the two
	 *                happened from the server's own answer and does not decide "is there text" a
	 *                second time
	 */
	record Made(long id, boolean waiting) {
	}

	@PostMapping(path = "/api/comments", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> rate(@AuthenticationPrincipal WhoIsAsking.Member asking,
			WhatWasSent<Rated> sent) throws IOException {
		Long me = readers.activeMember(asking).orElse(null);

		/* AN ACCOUNT THAT NAMES NO MEMBER, OR A MEMBER WHOSE FEE DOES NOT STAND: there is nobody
		   to file this under (PDL P8, 10.10.2026, „komentare"), and his body is not read. It is
		   read below, after this question, and not bound as an argument - see the class note for
		   what that cost. */
		if (me == null) {
			throw nothingIsHere();
		}

		Rated typed = sent.read();

		if (typed == null || !allThreeAreGiven(typed)) {
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

		/* A MEMBER WHO HAS NO RESULT ON THIS EVENT CANNOT RATE IT (owner, 19.10.2026), asked after the
		   event is known and has been run so those two keep their own sentences. See the class note
		   for why this is the 404 and not a reason of its own. */
		if (!hasARunOn(me, typed.eventId())) {
			throw nothingIsHere();
		}

		return inOneTransaction.execute(committing -> write(me, typed));
	}

	/**
	 * Whether this member has a result on a race of this event: {@code pages/event/ran.ts}'s question,
	 * asked of the table the form's data comes from. Both keys are bound, so another member's result
	 * on this event, or this member's result on another event, is a different answer.
	 */
	private boolean hasARunOn(long member, long eventId) {
		return db.sql("select exists (select 1 from result r join race ra on ra.id = r.race_id"
						+ " where r.competitor_id = ? and ra.event_id = ?)")
				.params(member, eventId)
				.query(Boolean.class)
				.single();
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
		/* THE MEMBER'S ROW, FIRST (see the class note): of two ratings of this member at one instant the
		   second waits here and then reads what the first committed. */
		db.sql("select id from competitor where id = ? for update")
				.param(me)
				.query(Long.class)
				.single();

		String body = orEmpty(typed.body());

		/* THE OWNER'S QUESTION, 19.10.2026: „samo ako ima tekst". Read off the stripped text that is
		   stored, never off the raw field, so a request of nothing but white space is the same
		   state as an empty box and as a body left out of the request. */
		if (body.isEmpty()) {
			return publishAtOnce(me, typed);
		}

		/* HIS OLDER RATING OF THIS EVENT THAT STILL WAITS GOES, AND THE PUBLISHED ONE STAYS (class note,
		   20.10.2026): the newest one sent wins among the waiting ones. Before the insert, so the card
		   this request makes is never among what it withdraws. */
		withdrawWhatWaits(me, typed.eventId());

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

		return ResponseEntity.status(HttpStatus.CREATED).body(new Made(submission, true));
	}

	/**
	 * THREE MARKS AND NO TEXT ARE PUBLISHED ON THE SPOT (owner, 19.10.2026), as the very row an
	 * approval would have made and in the very shape {@link VerificationWriteApi#publishTheComment}
	 * writes it: the name is {@code first_name || ' ' || last_name} read from {@code competitor} IN
	 * THIS STATEMENT, and {@code published_at} is the database's {@code now()}. ADL A64 A5 reads
	 * „published" as the moment the name is taken, and this is that moment.
	 *
	 * <p><b>The member's published rating of this event is deleted first, and so is his rating of it
	 * that still waits, in the same transaction</b> (one per member per event, the newest one sent
	 * wins; see the class note).
	 *
	 * <p>{@code me} came out of {@link ActiveMemberOrAdministration#activeMember}, so the
	 * {@code competitor} row exists and {@code single()} always has its one row. The body is the
	 * empty string and not null, because {@code event_comment.body} is NOT NULL.
	 */
	private ResponseEntity<?> publishAtOnce(long me, Rated typed) {
		/* THE NEW ONE REPLACES THE OLD, AT ONCE (owner, 19.10.2026): this member's published rating of
		   THIS event goes, and nobody else's and no other event's. Every one of them, so a member who
		   already has two (an approval used to be able to make a second) ends with one. */
		db.sql("delete from event_comment where competitor_id = ? and event_id = ?")
				.params(me, typed.eventId())
				.update();

		/* AND HIS RATING OF THIS EVENT THAT STILL WAITS GOES TOO: the newest one sent wins (class note). */
		withdrawWhatWaits(me, typed.eventId());

		long comment = db.sql("insert into event_comment (event_id, competitor_id, who, published_at,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " select ?, c.id, c.first_name || ' ' || c.last_name, now(), ?, ?, ?, ''"
						+ " from competitor c where c.id = ? returning id")
				.params(typed.eventId(), typed.organisation(), typed.value(), typed.ambience(), me)
				.query(Long.class)
				.single();

		return ResponseEntity.status(HttpStatus.CREATED).body(new Made(comment, false));
	}

	/**
	 * THIS MEMBER'S RATING OF THIS EVENT THAT STILL WAITS FOR A MODERATOR, AND NOTHING ELSE, GOES; the
	 * cascade of {@code comment_submission} takes its queue row with it. The one home of that statement,
	 * for the three roads that take it: a rating with no words, a rating with words, and the member's
	 * own deletion.
	 *
	 * <p>Keyed by the member AND the event, so another member's card and his card of another event stay;
	 * only a WAITING card, so a decided one stays (ADL A36 O11); and {@code skip locked}, so a card a
	 * moderator is deciding this instant is not waited for while this transaction holds the member's row
	 * (class note).
	 */
	private void withdrawWhatWaits(long me, long eventId) {
		db.sql("delete from comment_submission where id in (select cs.id from comment_submission cs"
						+ " join verification v on v.comment_submission_id = cs.id"
						+ " where cs.competitor_id = ? and cs.event_id = ? and v.state = ?"
						+ " for update of v skip locked)")
				.params(me, eventId, DecidingOnASubmission.WAITING)
				.update();
	}

	/**
	 * THE MEMBER DELETES HIS OWN RATING (owner, PDL P6, 20.10.2026), the published one and the one that
	 * waits: see the class note for what „uvek" is read as, and what it is not.
	 *
	 * @param asking read off the session; whoever has none never reaches this, the chain answers 401
	 * @param id     his published rating, as {@code GET /api/comments} answers it
	 */
	@DeleteMapping("/api/comments/{id}")
	ResponseEntity<?> delete(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable AKey id) {
		Long me = readers.activeMember(asking).orElse(null);

		/* AN ACCOUNT THAT NAMES NO MEMBER, OR A MEMBER WHOSE FEE DOES NOT STAND (PDL P8, 10.10.2026,
		   „komentare"): the answer of an address that maps nothing, before any row is read. */
		if (me == null) {
			throw nothingIsHere();
		}

		if (!Boolean.TRUE.equals(inOneTransaction.execute(committing -> takeBack(me, id.value())))) {
			throw nothingIsHere();
		}

		return ResponseEntity.noContent().build();
	}

	/**
	 * Whether this rating was his, having deleted it, his other published ones of the same event and his
	 * one of it that waits. Nothing is deleted where it was not his.
	 *
	 * <p><b>His row is locked FIRST and the rating is read under the lock</b>, the order every write of
	 * his rating keeps (class note): a new rating of the same event committed while this waited has
	 * already replaced the one the screen named, and the answer is then the 404 of a rating that is not
	 * there, never the deletion of the new one through the old one's id.
	 */
	private boolean takeBack(long me, long comment) {
		db.sql("select id from competitor where id = ? for update")
				.param(me)
				.query(Long.class)
				.single();

		/* WHOSE IT IS STANDS IN THIS `where`: another member's rating, a deleted member's (no
		   `competitor_id` at all), and an id that names nothing are one answer, no event. */
		Optional<Long> event = db.sql("select event_id from event_comment where id = ? and competitor_id = ?")
				.params(comment, me)
				.query(Long.class)
				.optional();

		if (event.isEmpty()) {
			return false;
		}

		/* EVERY PUBLISHED RATING OF HIS OF THAT EVENT, the named one among them, and nobody else's. */
		db.sql("delete from event_comment where competitor_id = ? and event_id = ?")
				.params(me, event.get())
				.update();

		withdrawWhatWaits(me, event.get());

		return true;
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

	/** {@code comment_submission.body} is NOT NULL and may be empty (V30, PDL P6, „Komentar je fakultativan"). */
	private static String orEmpty(String value) {
		return value == null ? "" : value.strip();
	}

	/**
	 * THE ANSWER FOR SOMEBODY THIS ADDRESS IS NOT FOR, which goes down the road an address that maps
	 * nothing goes down, and the caller throws it.
	 *
	 * <p>{@link ResponseStatusException} is answered by {@code sendError}, one call into the machinery
	 * an unmapped address already uses and not an imitation of it. The status written onto the response
	 * that stood here came back as 225 bytes with {@code Content-Length: 0} where the twin came back
	 * chunked as 373 (the clock lines left out), which is an oracle for whether a route lives at this
	 * address, one request per guess. It is made here and thrown at the call site and not thrown from
	 * this method, because the coverage report counts a line whose call never comes back as not run:
	 * PR 466 measured that a method that always throws left every {@code return} that called it
	 * uncovered, and the gate refuses anything under a hundred per cent.
	 */
	private static ResponseStatusException nothingIsHere() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND);
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
