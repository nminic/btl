package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHAT MEMBERS WROTE ABOUT AN EVENT, read by members and by nobody else.
 *
 * <p>The first resource of this portal that is not public, so this file measures two
 * things no other resource's did: that a visitor is refused, and that what is still
 * waiting for a moderator never leaves the server.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CommentApiTest {

	private static final String A_MEMBER = "takmicar@primer.rs";

	/**
	 * TEXT THAT IS IN THE QUEUE FOR APPROVAL AND MUST NEVER BE ANYWHERE ELSE.
	 *
	 * <p>Each one is a sentence a reader of the answer could only have got by reading
	 * {@code verification}, and that is the whole point: the leak of 07.08.2026 was a public
	 * screen joining the queue to find what had been approved, which handed the visitor every
	 * unapproved comment along the way („ukljucujuci i onaj sa reklamom za tudji link").
	 *
	 * <p><b>Written out rather than read off the rows, because these are what the case is
	 * ABOUT.</b> The floor under them is that the rows really are in the queue, and it is
	 * asserted in each case before the strings are refused - a fixture that failed to write
	 * them would otherwise make every one of these refusals pass by being about nothing.
	 */
	private static final String WAITING_FOR_A_MODERATOR = "Ovaj komentar jos niko nije odobrio";

	private static final String THE_QUEUE_SAYS_SOMETHING_ELSE = "Tekst kakav stoji samo u redu";

	private static final String APPROVED_BUT_NEVER_PUBLISHED = "Odobreno u redu a nigde upisano";

	/**
	 * AND A SECOND COMMENT BY SOMEBODY WHO ALREADY HAS ONE HERE, which is the row that makes a
	 * bare join visible.
	 *
	 * <p>One author with two rows in this queue is what a {@code left join} onto it can be seen
	 * by, and a measured mutation is what put this here: such a join reads nothing, changes no
	 * field and no order, so every refusal of queue text stays green - what it changes is the
	 * LENGTH, because the comment whose author matches twice comes back twice.
	 *
	 * <p><b>And it is a second comment WAITING rather than a refused one, which is the
	 * correction of a fixture that stood on a state this portal does not have.</b> It was
	 * first written as a draft refused and sent in again, citing the rule that a refused item
	 * returns to its member ({@code PDL.md:3935}). That rule names the comment as its one
	 * exception, in as many words: „Sve sto se odbije vraca se clanu... Izuzetak je jedino
	 * komentar, koji se brise" ({@code PDL.md:3016}), „Komentar se ne vraca nego brise.
	 * Moderator ga prihvati ili obrise, odmah. Clanu se ne salje nista" ({@code PDL.md:3017}),
	 * and „odbijanje ne trazi razlog" ({@code PDL.md:3085}).
	 *
	 * <p>So a refused comment is not a row that waits with a reason on it - it is a row that is
	 * gone. A floor resting on it would hold only until somebody wrote the queue the way the
	 * owner decided it, and would then quietly fall to nothing. A member with a comment on two
	 * events, both waiting, is the same floor and is the queue as it will really be.
	 */
	private static final String A_SECOND_ONE_STILL_WAITING = "Jos jedan komentar istog clana";

	private static final String THE_MODERATOR_WHO_DECIDED = "Milica Odlucila";

	private static final String SOMEBODY_ONLY_THE_QUEUE_KNOWS = "Bogdan Tasic";

	/** The name on a comment whose author is no longer in the record: V7's tombstone. */
	private static final String DEPARTED = "Nekadasnji clan";

	/** And the name a member published under before she had the one she has now. */
	private static final String FORMER_NAME = "Milica Jovanovic";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private int issued;

	private SecretToken session;

	/**
	 * NINE PUBLISHED COMMENTS, AND NOT ONE OF THEM IS THE ONLY ONE OF ITS KIND.
	 *
	 * <p>Each list below says which wrong answer it refuses:
	 *
	 * <ul>
	 * <li><b>The order.</b> Written so that newest first is the list 6, 2, 7, 4, 8, 9, 3, 5, 1
	 * - which is neither the order they were written in, nor the key ascending, nor the key
	 * descending, nor oldest first, nor either event grouped together. Written in the order
	 * they went out, „newest first" and „the key backwards" would be one list, and a resource
	 * sorting by the key it came back with would pass.
	 * <li><b>Two of them published in the SAME instant, and carrying keys that do not follow
	 * the order they were written in.</b> Both halves were measured rather than reasoned.
	 * Without a tie there is nothing for the tie-break to break, and taking it out of the order
	 * left the suite green. With a tie but with keys left to {@code bigserial}, it stayed green
	 * anyway: this database's own answer for equal keys happened to be the same list the
	 * tie-break produces, which PostgreSQL promises neither way. So the earlier of the two
	 * carries the HIGHER key, the way a history imported from an older system does, and an
	 * order with nothing to break the tie now answers them the other way round.
	 * <li><b>Whose it is.</b> Seven authors are members in good standing, one let her fee
	 * lapse, and one is gone from the record altogether. The last two are the two halves of
	 * „is there a visible profile", which is the question of 07.08.2026, and they are
	 * deliberately not the same row: an author who is GONE leaves a null in
	 * {@code competitor_id} and one who did not RENEW does not, so a reader asking „is there
	 * a record" passes on the first and fails on the second.
	 * <li><b>Where they are in the answer.</b> Neither the lapsed member's comment nor the
	 * departed member's is the first record of the answer or the first row written, so a case
	 * that reached for {@code answer().get(0)} instead of the comment it names would be about
	 * somebody else and would fail. The rule of 06.09.2026: never the only one of its kind,
	 * and never first.
	 * <li><b>The day, against two other zones rather than one.</b> One comment went out at half
	 * past eleven at night in UTC, which is the next day in Belgrade; the two published in one
	 * instant went out at a moment that is a different day again in the zone this suite pins
	 * itself to. So the league's zone, UTC and the machine's own each answer differently, and a
	 * resource reading any of the three passes or fails on its own account. Measured against
	 * only the first of those, reading the MACHINE's zone was green on a machine that already
	 * stands in Belgrade.
	 * <li><b>Two events</b>, so a resource answering for one of them is the wrong length, and
	 * {@code eventId} is a field that varies.
	 * <li><b>A name that has changed since.</b> One member published under the surname she
	 * had then and carries another now, which is the only fixture in which „the name on the
	 * comment" and „the name of the member" are two different strings. Without her, a reader
	 * taking the name off the member's row is right about all the others - a member who did not
	 * renew still has his row, and one who is gone falls back to the comment - so the tombstone
	 * would be measured by nothing.
	 * <li><b>An empty body</b>, which the form allows on purpose: a member may rate an event
	 * and say nothing.
	 * </ul>
	 *
	 * <p><b>AND FOUR ROWS IN THE QUEUE FOR APPROVAL, each of which would change the answer if
	 * anything read it.</b> One still waiting; one approved whose text differs from the text
	 * that was really published, so a reader taking the body from the queue answers the wrong
	 * sentence rather than none; one approved that was never written into
	 * {@code event_comment} at all, so „approved" and „published" are two different sets and
	 * the second is the one this resource is about; and a SECOND one waiting under an author
	 * the queue already holds a row for.
	 *
	 * <p>That last one is the only thing a join which reads NOTHING out of the queue can be
	 * seen by, and it was a measured mutation rather than a thought: such a join changes no
	 * field and no order, so every refusal of queue text stays green - what it changes is the
	 * LENGTH, because the comment whose author matches two rows comes back twice. Nothing
	 * about it is unusual: a member who wrote about two events has two comments waiting.
	 */
	@BeforeEach
	void nineThatWerePublishedAndFourThatAreNot() {
		account(A_MEMBER);

		event("fruskogorski-maraton-2010", "2010-05-08");
		event("ironman-st-polten-2010", "2010-05-30");

		member("'000010'", "Nikola", "Jovic", "M", true);
		member("'000020'", "Sofija", "Lukic", "F", true);
		member("'000030'", "Ana", "Peric", "F", false);
		member("'000040'", "Vuk", "Maric", "M", true);
		member("'000050'", "Jelena", "Nikolic", "F", true);
		member("'000060'", "Milica", "Petrovic", "F", true);
		member("'000070'", "Lazar", "Ilic", "M", true);
		member("'000080'", "Dunja", "Kostic", "F", true);

		comment("Jovic", "fruskogorski-maraton-2010", "2010-05-09 09:00:00+00", 5, 4, 5,
				"Staza je bila jasno obelezena.");
		/* THE ONE WHOSE DAY IS NOT THE SAME DAY IN BOTH ZONES. Half past eleven at night in
		   UTC is half past midnight in Belgrade, so this comment went out on the 31st in the
		   league's own time and the column says the 30th. */
		comment("Lukic", "fruskogorski-maraton-2010", "2010-05-30 22:30:00+00", 4, 3, 5, "");
		/* SHE DID NOT RENEW, and the row is still here: a fee that lapses lowers `active` and
		   deletes nobody. */
		comment("Peric", "ironman-st-polten-2010", "2010-05-15 08:00:00+00", 3, 4, 4,
				"Startni paket ne opravdava kotizaciju.");
		/* AND THIS ONE'S AUTHOR IS GONE FROM THE RECORD, which is what the tombstone is for. */
		departedComment("fruskogorski-maraton-2010", "2010-05-20 12:00:00+00", 2, 2, 3,
				"Predugacka staza i slaba organizacija.");
		/* AND THIS ONE WENT OUT UNDER A NAME ITS AUTHOR NO LONGER HAS, which is the only row
		   here where the tombstone and the member's own row disagree. */
		commentUnderAFormerName("Petrovic", FORMER_NAME, "fruskogorski-maraton-2010",
				"2010-05-25 10:00:00+00", 4, 5, 3, "Osvezenje na svakih pet kilometara.");
		comment("Maric", "ironman-st-polten-2010", "2010-05-12 07:30:00+00", 5, 5, 4,
				"Kisa je padala celim putem.");
		comment("Nikolic", "ironman-st-polten-2010", "2010-06-02 11:00:00+00", 1, 3, 2,
				"Start je kasnio sat vremena.");
		/* AND TWO THAT WENT OUT IN THE SAME INSTANT, written in this order so that the key
		   descending is the REVERSE of the order they were inserted in. Without a tie there
		   is nothing for the tie-break to break, and it was measured: taking `c.id desc` out
		   of the order left the whole suite green. With them, a sort that keeps the rows in
		   the order it found them answers Ilic before Kostic and the case says so.

		   THE INSTANT IS ALSO WHERE THE MACHINE'S ZONE PARTS FROM THE LEAGUE'S. Half past
		   five in the morning UTC is the 18th in Belgrade and the 17th in the zone this
		   suite pins itself to, so „the day in the league" and „the day on this machine" are
		   two different answers here - which is what the case about the day needs and what
		   the comment at half past eleven at night cannot give it. */
		commentImportedUnderItsOwnKey(900002, "Ilic", "ironman-st-polten-2010",
				"2010-05-18 05:30:00+00", 2, 5, 1, "Staza je izmerena kratko.");
		commentImportedUnderItsOwnKey(900001, "Kostic", "fruskogorski-maraton-2010",
				"2010-05-18 05:30:00+00", 3, 1, 4, "Nije bilo vode na petom kilometru.");

		waitingInTheQueue("Ana Peric", WAITING_FOR_A_MODERATOR);
		decidedInTheQueue("Vuk Maric", THE_QUEUE_SAYS_SOMETHING_ELSE);
		decidedInTheQueue(SOMEBODY_ONLY_THE_QUEUE_KNOWS, APPROVED_BUT_NEVER_PUBLISHED);
		/* AND A SECOND ROW FOR ONE OF THEM, which is what a bare join can be seen by. */
		waitingInTheQueue("Vuk Maric", A_SECOND_ONE_STILL_WAITING);
	}

	private void account(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', ?,"
				+ " (select id from role where code = 'competitor'))").param(email).update();

		session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();
	}

	private void event(String slug, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', (select id from place where rank = 1),"
						+ " null, null, 'race', false, '', '')")
				.params(slug, "Dogadjaj " + slug).update();
	}

	/**
	 * @param feeStanding whether the membership was renewed, which decides whether there is a
	 *                    profile for the comment's name to lead to (PDL, 07.08.2026)
	 */
	private void member(String number, String first, String last, String gender,
			boolean feeStanding) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (" + number + ", ?, ?, ?, date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(first, last, gender, feeStanding, String.format("%016x", ++issued))
				.update();
	}

	/** By surname, and the name written on the comment is the author's own. */
	private void comment(String last, String eventSlug, String published, int organisation,
			int value, int ambience, String body) {
		db.sql("insert into event_comment (event_id, competitor_id, who, published_at,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " values ((select id from btl_event where slug = ?),"
						+ " (select id from competitor where last_name = ?),"
						+ " (select first_name || ' ' || last_name from competitor where last_name = ?),"
						+ " timestamptz '" + published + "', ?, ?, ?, ?)")
				.params(eventSlug, last, last, organisation, value, ambience, body).update();
	}

	/**
	 * A COMMENT WHOSE KEY DOES NOT FOLLOW THE ORDER IT WAS WRITTEN IN, which is what an
	 * imported history looks like and the only shape that measures the tie-break.
	 *
	 * <p>The two comments written this way went out in the SAME instant, so what decides which
	 * comes first is the key alone. Left to {@code bigserial} the keys ascend with the order
	 * the rows were inserted, and this database's own answer for a tie happens to be the same
	 * list the tie-break produces - measured, not guessed: taking {@code c.id desc} out of the
	 * order left this case green. The order of equal keys is not something PostgreSQL promises
	 * either way, so a fixture whose keys follow its insertions cannot tell an order that
	 * decides ties from one that leaves them to whatever comes back.
	 *
	 * <p>So the earlier of the two is written with the HIGHER key. The resource must answer it
	 * first, and an order with nothing to break the tie answers the other one first. Nothing
	 * about that is contrived: V7 exists to carry a history imported from an older system, and
	 * the note on this resource's order says in as many words that for such a history the key
	 * follows nothing.
	 *
	 * <p>The keys are far above anything the sequence has handed out, so the sequence is left
	 * where it was and nothing written afterwards collides with them.
	 */
	private void commentImportedUnderItsOwnKey(long key, String last, String eventSlug,
			String published, int organisation, int value, int ambience, String body) {
		db.sql("insert into event_comment (id, event_id, competitor_id, who, published_at,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " values (?, (select id from btl_event where slug = ?),"
						+ " (select id from competitor where last_name = ?),"
						+ " (select first_name || ' ' || last_name from competitor where last_name = ?),"
						+ " timestamptz '" + published + "', ?, ?, ?, ?)")
				.params(key, eventSlug, last, last, organisation, value, ambience, body).update();
	}

	/**
	 * A COMMENT WHOSE AUTHOR IS NO LONGER IN THE RECORD, which is the row V7 made the
	 * tombstone for: {@code competitor_id} is null and {@code who} carries the name it went
	 * out under.
	 */
	private void departedComment(String eventSlug, String published, int organisation, int value,
			int ambience, String body) {
		db.sql("insert into event_comment (event_id, competitor_id, who, published_at,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " values ((select id from btl_event where slug = ?), null, ?,"
						+ " timestamptz '" + published + "', ?, ?, ?, ?)")
				.params(eventSlug, DEPARTED, organisation, value, ambience, body).update();
	}

	/** The same row, written under a name its author no longer carries. */
	private void commentUnderAFormerName(String last, String then, String eventSlug,
			String published, int organisation, int value, int ambience, String body) {
		db.sql("insert into event_comment (event_id, competitor_id, who, published_at,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " values ((select id from btl_event where slug = ?),"
						+ " (select id from competitor where last_name = ?), ?,"
						+ " timestamptz '" + published + "', ?, ?, ?, ?)")
				.params(eventSlug, last, then, organisation, value, ambience, body).update();
	}

	private void waitingInTheQueue(String subject, String body) {
		db.sql("insert into verification (queue, subject, body, state)"
				+ " values ('comments', ?, ?, 'waiting')").params(subject, body).update();
	}

	/** Approved, and approved is not published: what publishes is the row in `event_comment`. */
	private void decidedInTheQueue(String subject, String body) {
		db.sql("insert into verification (queue, subject, body, state, decided_at, decided_by_name)"
						+ " values ('comments', ?, ?, 'approved', now(), ?)")
				.params(subject, body, THE_MODERATOR_WHO_DECIDED).update();
	}

	/* NO REFUSED ROW IS WRITTEN ANYWHERE HERE, and that is a decision rather than a gap. V9
	   gives `verification` a state of `rejected` that carries a reason, because that is what
	   the other five queues do. The comments queue is the owner's one exception: „Komentar se
	   ne vraca nego brise. Moderator ga prihvati ili obrise, odmah. Clanu se ne salje nista"
	   (PDL 3017), and „odbijanje ne trazi razlog" (PDL 3085). So a refused comment is not a
	   row in a state - it is a row that is gone, and a fixture writing one would be standing
	   on something this portal is not allowed to have. */

	private MockHttpServletRequestBuilder asking() {
		return get("/api/comments").cookie(new Cookie(SessionCookie.NAME, session.secret()));
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(whole());
	}

	private String whole() throws Exception {
		return http.perform(asking()).andReturn().getResponse().getContentAsString();
	}

	/** The one record written under the given name, which is one because the fixture says so. */
	private JsonNode recordOf(String who) throws Exception {
		List<JsonNode> found = StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("who").asString().equals(who)).toList();

		assertThat(found).as("%s wrote some number of comments other than one, so nothing below is"
				+ " about the record it says it is about", who).hasSize(1);

		assertThat(answer().get(0).path("who").asString())
				.as("%s is the FIRST record of the answer, so a case reaching for the first record"
						+ " instead of this one would measure the same thing and the fixture would"
						+ " prove nothing (06.09.2026)", who)
				.isNotEqualTo(who);

		return found.getFirst();
	}

	private List<String> whoWrote() throws Exception {
		return StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("who").asString()).toList();
	}

	private int published() {
		return db.sql("select count(*) from event_comment").query(Integer.class).single();
	}

	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/comments", answer(), "comments.json");
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/comments", answer());
	}

	/**
	 * AND THE MARKS INSIDE THE RATING ARE THE THREE THE PORTAL SERVES, no more.
	 *
	 * <p>{@code Answers} reads the names of a record and would not see a fourth mark added
	 * INSIDE {@code rating}, which is the one place a field can be added to this answer
	 * without it noticing. The field it would be is known by name: „Ukupna ocena se ne cuva
	 * nego se racuna gde god se prikaze" ({@code PDL.md:3733}, 07.08.2026), because a number
	 * derived from three others has no fourth place to live and the first rounding somebody
	 * changed would leave two different answers on one portal.
	 *
	 * <p><b>Read off the file the portal serves and not written out here</b>, for the reason
	 * every list in this repository is: a list of three written into a case is a list that
	 * has to be right about marks nobody has added yet. PDL P6 fixes it at three and V7
	 * makes it three columns; this compares the answer with what the screens already read.
	 */
	@Test
	void theMarksInsideTheRatingAreTheOnesThePortalServes() throws Exception {
		Set<String> served = Answers.fieldsOf(Answers.servedRecord("comments.json").path("rating"));

		assertThat(served).as("the file the portal serves carries no marks at all, so the"
				+ " comparison below compares nothing").isNotEmpty();

		assertThat(Answers.fieldsOf(answer().get(0).path("rating")))
				.as("the marks answered are not the ones the portal reads; a mark ADDED here is the"
						+ " total, which PDL 3733 says is worked out wherever it is drawn and never"
						+ " stored")
				.containsExactlyInAnyOrderElementsOf(served);
	}

	/**
	 * AND THE THREE MARKS ARE THE THREE THAT WERE GIVEN, each in its own place.
	 *
	 * <p><b>The case above this one compares NAMES, and a review measured what that is worth:</b>
	 * swapping two of the three columns in the query left the whole suite green. Seven comments
	 * carried seven different triples and not one assertion looked at a number, so a member who
	 * marked the organisation 5 and the value 4 would have had his card read „Organizacija: 4 od
	 * 5" and „Vrednost za novac: 5 od 5" - his words under somebody else's marks.
	 *
	 * <p><b>Read off the rows and matched by key, rather than written out here.</b> That is the
	 * precedent in {@code TeamApiTest} carried one step further: a list written into a case is a
	 * list that has to be kept right by hand, and this compares every comment there is. A mark
	 * answered as a constant, two columns exchanged, or the marks of one comment given to
	 * another all fail it.
	 *
	 * <p><b>The floor is that a swap is visible at all.</b> With every comment marked the same
	 * in two of its three, exchanging those two changes nothing anywhere, and this would pass on
	 * a query that does. So the fixture is asked how many comments carry three marks that
	 * differ from one another, in so many words.
	 */
	@Test
	void everyCommentCarriesTheThreeMarksItsAuthorGave() throws Exception {
		assertThat(db.sql("select count(*) from event_comment"
						+ " where rating_organisation <> rating_value"
						+ " and rating_value <> rating_ambience"
						+ " and rating_organisation <> rating_ambience")
				.query(Integer.class).single())
				.as("no comment in the fixture carries three marks that differ from one another, so"
						+ " two of the columns could be exchanged without changing any answer")
				.isEqualTo(5);

		Map<Long, String> given = db.sql("select id, rating_organisation || '/' || rating_value"
						+ " || '/' || rating_ambience from event_comment")
				.query((row, one) -> Map.entry(row.getLong(1), row.getString(2)))
				.list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

		assertThat(given).as("no marks were read out of the database, so the loop below compares"
				+ " nothing").hasSize(published());
		assertThat(Set.copyOf(given.values()))
				.as("two comments in the fixture carry the same three marks, so one could be"
						+ " answered with the other's and this case would not see it")
				.hasSize(published());

		for (JsonNode one : answer()) {
			JsonNode marks = one.path("rating");

			assertThat(marks.path("organisation").asInt() + "/" + marks.path("value").asInt()
					+ "/" + marks.path("ambience").asInt())
					.as("the comment written by %s came back with marks that are not the ones its"
							+ " author gave, in that order", one.path("who").asString())
					.isEqualTo(given.get(one.path("id").asLong()));
		}

		/* AND ONE OF THEM WRITTEN OUT, which is the shape `TeamApiTest` uses. The loop above
		   would hold just as well if the fixture and the answer were wrong together; this says
		   what the numbers are. Not the first record of the answer, for the reason every case
		   here avoids it. */
		JsonNode hers = recordOf("Dunja Kostic").path("rating");

		assertThat(List.of(hers.path("organisation").asInt(), hers.path("value").asInt(),
				hers.path("ambience").asInt()))
				.as("the three marks are not the ones written into the fixture for this comment")
				.containsExactly(3, 1, 4);
	}

	/**
	 * AND EVERY COMMENT COMES BACK UNDER ITS OWN KEY.
	 *
	 * <p><b>Measured in review: answering {@code id} with the EVENT's id passed everything.</b>
	 * Nine comments then came back carrying two distinct keys between them, and
	 * {@code EventComments.tsx} draws the list with {@code key={comment.id}} - so React keeps one
	 * item per key and the page quietly loses every comment but one per event.
	 *
	 * <p>Both halves, because each catches the opposite failure. The set says the keys are the
	 * comments' own and not another table's; the count says no two of them are the same, which
	 * is the half a set comparison silently forgives.
	 */
	@Test
	void everyCommentComesBackUnderItsOwnKey() throws Exception {
		Set<Long> keys = db.sql("select id from event_comment").query(Long.class).list().stream()
				.collect(Collectors.toCollection(LinkedHashSet::new));

		assertThat(keys).as("no comment was read out of the database, so the comparison below"
				+ " compares nothing").hasSize(published());

		List<Long> answered = StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("id").asLong()).toList();

		assertThat(answered)
				.as("a comment came back under a key that is not its own; answered with the event's"
						+ " id instead, the list collapses in the browser to one item per key")
				.containsExactlyInAnyOrderElementsOf(keys);
		assertThat(Set.copyOf(answered))
				.as("two comments came back under one key, and the page keeps one item per key")
				.hasSize(answered.size());
	}

	/**
	 * A VISITOR WHO IS NOT SIGNED IN IS NOT SERVED A COMMENT.
	 *
	 * <p>The owner, 11.08.2026: „komentare vide samo prijavljeni clanovi BTL. Drugim
	 * (posetiocima) se ne prikazuju." He sees the races and the results; what people said
	 * about a running he does not.
	 *
	 * <p><b>This case is why the route's absence from {@code READ_BY_ANYBODY} is measured at
	 * all.</b> Nothing else would catch it being added there:
	 * {@code ApiSecurityTest.everyRouteNobodyOpenedIsARouteNobodyCanRead} asks only the routes
	 * that are NOT on the open list, so a route moved onto it walks straight out of that
	 * case's sight, and the two cases about the open list would then find this one open and
	 * be satisfied. Measured before this file was written: adding {@code /api/comments} to
	 * the list turns nothing else in the suite red.
	 *
	 * <p><b>Both halves, and the second is not decoration.</b> Without the 200, a resource
	 * that answered 401 to everybody - or one whose query fell over - would pass the refusal
	 * and say the rule held.
	 */
	@Test
	void aVisitorWhoIsNotSignedInIsNotServedAComment() throws Exception {
		assertThat(http.perform(get("/api/comments")).andReturn().getResponse().getStatus())
				.as("a visitor was served the comments, and the owner decided on 11.08.2026 that"
						+ " they are for signed in members only")
				.isEqualTo(401);

		assertThat(http.perform(asking()).andReturn().getResponse().getStatus())
				.as("a signed in member was refused the comments, so the refusal above is not about"
						+ " who is asking")
				.isEqualTo(200);
	}

	/**
	 * ONLY WHAT A MODERATOR LET OUT IS ANSWERED.
	 *
	 * <p>„Komentari idu kroz odobrenje pre objave" ({@code PDL.md:2886}) and „prikazuju se na
	 * dnu strane dogadjaja i to tek kad ih moderator odobri" ({@code PDL.md:3740}). In this
	 * schema that is a table rather than a column: {@code event_comment} is the record of what
	 * was published and what is still waiting is a row in {@code verification}.
	 *
	 * <p><b>Two measurements, because each catches the opposite failure.</b> The text says a
	 * particular unapproved sentence did not come out; the length says the answer is exactly
	 * the published comments, so an unapproved one cannot have arrived under some other
	 * wording either.
	 */
	@Test
	void onlyWhatAModeratorLetOutIsAnswered() throws Exception {
		assertThat(db.sql("select count(*) from verification where queue = 'comments'"
						+ " and state = 'waiting' and body = ?").param(WAITING_FOR_A_MODERATOR)
				.query(Integer.class).single())
				.as("nothing is waiting for a moderator in the fixture, so this case has nothing to"
						+ " keep out")
				.isOne();

		assertThat(whole())
				.as("a comment nobody has approved yet was served, which is what the queue is for")
				.doesNotContain(WAITING_FOR_A_MODERATOR);

		assertThat(answer().size())
				.as("the answer is not as long as the comments that were published, which is what an"
						+ " unapproved one coming through looks like")
				.isEqualTo(published());
	}

	/**
	 * AND NOTHING IN THE QUEUE FOR APPROVAL IS TOUCHED BY THIS RESOURCE.
	 *
	 * <p>The owner, 07.08.2026: „Javne strane ne smeju da preuzimaju red za verifikaciju.
	 * Strana dogadjaja ga je citala da bi nasla odobrene komentare, pa je svaki posetilac
	 * dobijao u pregledac adrese neaktiviranih clanova i tekstove neodobrenih komentara."
	 * This has been a leak once and the shape that caused it is the tempting one: join the
	 * queue to find what was approved.
	 *
	 * <p><b>Three rows that would each change the answer if anything read the queue, and they
	 * fail in three different directions.</b> An APPROVED row whose text differs from what was
	 * really published: a reader taking the body from the queue answers the wrong sentence
	 * rather than none, which a length would never see. An approved row that was never written
	 * into {@code event_comment}: „approved" and „published" are two different sets, and a
	 * reader keyed on the state answers with a comment the portal does not have. And the name
	 * of the moderator who decided, which is the queue's own column and belongs to nobody but
	 * the administration.
	 */
	@Test
	void theQueueForApprovalIsNotTouchedByThisResource() throws Exception {
		assertThat(db.sql("select count(*) from verification where queue = 'comments'"
						+ " and state = 'approved'").query(Integer.class).single())
				.as("nothing is approved in the queue in the fixture, so every refusal below is"
						+ " about a row that is not there")
				.isEqualTo(2);

		/* AND ONE AUTHOR HAS TWO ROWS IN THE QUEUE, which is the only thing a join that reads
		   NOTHING out of it can be seen by. Measured before the review was called: a bare
		   `left join` onto the queue changes no field and no order, so every refusal below
		   stayed green; what it changes is the LENGTH, because the comment whose author
		   matches twice comes back twice.

		   BOTH OF HIS ARE WAITING, and the first draft of this fixture had one of them
		   REFUSED instead. That is a state the comments queue does not have: „Komentar se ne
		   vraca nego brise... Clanu se ne salje nista" (PDL 3017). A floor standing on it
		   would hold until somebody wrote the queue as the owner decided it and would then
		   fall to nothing without a word. A member who wrote about two events has two
		   comments waiting, and that is the same floor out of a state the portal really has. */
		assertThat(db.sql("select count(*) from event_comment k where ("
						+ " select count(*) from verification v"
						+ " where v.queue = 'comments' and v.subject = k.who) > 1")
				.query(Integer.class).single())
				.as("no published comment in the fixture has an author the queue names twice, so a"
						+ " query that joins the queue and reads nothing out of it answers exactly"
						+ " what this one does and the length below says nothing")
				.isOne();

		assertThat(answer().size())
				.as("a comment came back more than once, which is what joining the queue does to an"
						+ " author it holds two rows for")
				.isEqualTo(published());

		String whole = whole();

		for (String fromTheQueue : List.of(THE_QUEUE_SAYS_SOMETHING_ELSE,
				APPROVED_BUT_NEVER_PUBLISHED, THE_MODERATOR_WHO_DECIDED,
				SOMEBODY_ONLY_THE_QUEUE_KNOWS, A_SECOND_ONE_STILL_WAITING)) {
			assertThat(whole)
					.as("%s is written in the queue for approval and nowhere else, and it left the"
							+ " server - which is the leak of 07.08.2026", fromTheQueue)
					.doesNotContain(fromTheQueue);
		}

		assertThat(recordOf("Vuk Maric").path("body").asString())
				.as("the text answered for a comment that is BOTH published and in the queue is not"
						+ " the published one, so the body is being read from the queue")
				.isEqualTo("Kisa je padala celim putem.");
	}

	/**
	 * NEWEST FIRST, which is the order the page grows in.
	 *
	 * <p>„Komentari se ucitavaju skrolovanjem, deset pre prvog dopunjavanja, od najnovijeg ka
	 * najstarijem" (owner, 11.08.2026), and the comments carried over from an earlier running
	 * of the same event go „izlistano redom" among them rather than in a section of their own.
	 * A page that grows by ten reads the list from the top, so an unsettled order reshuffles
	 * between two readings of data nobody touched.
	 *
	 * <p>The whole list rather than the first record: written as „the newest is first" it is
	 * satisfied by an answer that is otherwise in any order at all.
	 */
	@Test
	void theNewestCommentComesFirstAndTheOldestLast() throws Exception {
		assertThat(db.sql("select count(*) from event_comment a join event_comment b"
						+ " on b.published_at = a.published_at and b.id > a.id")
				.query(Integer.class).single())
				.as("no two comments in the fixture went out in the same instant, so the tie-break"
						+ " in the order breaks nothing and the list below holds without it")
				.isOne();

		assertThat(db.sql("select count(*) from event_comment a join event_comment b"
						+ " on b.published_at = a.published_at and b.id > a.id"
						/* AND THE HIGHER KEY IS THE ONE WRITTEN FIRST. Without this the keys of
						   the tied pair ascend with the order they were inserted in, and this
						   database's own answer for a tie is then the same list the tie-break
						   produces - so the clause could be deleted with the suite staying green,
						   which was measured. */
						+ " where b.ctid < a.ctid")
				.query(Integer.class).single())
				.as("the tied pair's keys follow the order the rows were written in, so an order"
						+ " that leaves ties to the database answers the same list as one that"
						+ " breaks them and the list below holds either way")
				.isOne();

		assertThat(whoWrote())
				.as("the comments came back in some order other than newest first, with the higher"
						+ " key of two published in one instant ahead of the lower")
				.containsExactly("Jelena Nikolic", "Sofija Lukic", FORMER_NAME, DEPARTED,
						"Lazar Ilic", "Dunja Kostic", "Ana Peric", "Vuk Maric", "Nikola Jovic");
	}

	/**
	 * AND THE NAME IS THE ONE THE COMMENT WENT OUT UNDER, not the one its author has now.
	 *
	 * <p>„Komentar clana koji je napustio ligu ostaje sa imenom pod kojim je objavljen"
	 * ({@code PDL.md:3740}, 06.08.2026), and V7 makes {@code who} a column of the comment
	 * rather than a join for exactly that reason.
	 *
	 * <p><b>This is the only row in the fixture where the two names differ, and without it the
	 * column is measured by nothing.</b> Read off the member instead, every other comment here
	 * still answers correctly: a member who did not renew keeps his row, and one who is gone
	 * leaves a null that a fallback covers. So a resource joining the name would be green on
	 * six of seven, and the seventh is this one.
	 */
	@Test
	void theNameIsTheOneTheCommentWentOutUnderAndNotTheOneItsAuthorHasNow() throws Exception {
		assertThat(db.sql("select count(*) from event_comment k join competitor c"
						+ " on c.id = k.competitor_id"
						+ " where k.who <> c.first_name || ' ' || c.last_name")
				.query(Integer.class).single())
				.as("every comment in the fixture went out under the name its author still has, so"
						+ " the tombstone and a join answer the same thing everywhere here")
				.isOne();

		assertThat(recordOf(FORMER_NAME).path("memberNumber").asString())
				.as("the comment written under a former name did not come back with its author's"
						+ " number, and she is a member in good standing with a profile to lead to")
				.isEqualTo("000060");
	}

	/**
	 * AND THE DAY IS THE DAY IN BELGRADE, not the day the column is written in.
	 *
	 * <p>V7 keeps {@code published_at} as an instant and says why - a race is run on a DAY and
	 * a comment goes out at a moment - and leaves the arithmetic here: „Held in UTC; which day
	 * that is in Belgrade is the backend's arithmetic." A comment published at half past
	 * eleven at night is dated the next day, which is the day it was published in the league's
	 * own time and the day the member who wrote it would say.
	 *
	 * <p><b>The floor says the fixture really crosses a midnight</b>, because with every
	 * comment written at midday the two readings agree on all six and this case would pass on
	 * a resource that answers the UTC day, the machine's day, or the column cast to a date.
	 */
	@Test
	void theDayIsTheDayInBelgradeAndNotTheDayTheColumnIsWrittenIn() throws Exception {
		assertThat(db.sql("select count(*) from event_comment"
						+ " where (published_at at time zone 'Europe/Belgrade')::date"
						+ " <> (published_at at time zone 'UTC')::date")
				.query(Integer.class).single())
				.as("no comment in the fixture went out on a different day in Belgrade than in UTC,"
						+ " so the two readings agree everywhere and this case measures neither")
				.isOne();

		assertThat(recordOf("Sofija Lukic").path("date").asString())
				.as("the day answered is the day in UTC rather than the day in Belgrade, and the"
						+ " league is not in UTC")
				.isEqualTo("2010-05-31");

		/* AND THE SAME QUESTION AGAINST THE ZONE THIS MACHINE IS IN, which is a second
		   comparison and not the same one said twice.

		   The assertion above separates Belgrade from UTC and nothing else. Read as
		   `ZoneId.systemDefault()` it was GREEN on a developer's machine, because that machine
		   already stands in Belgrade - so the case was measuring „not UTC" while its name and
		   the note on the resource both say „the league's zone". It would have gone red on CI
		   for no better reason than that `ubuntu-latest` happens to leave `TZ` unset, which is
		   the difference between a local gate and the real one.

		   So the suite pins `user.timezone` (backend/pom.xml) to a zone that is NOT the
		   league's, and this pair of comments went out at an instant where that zone and
		   Belgrade fall on different days. Both readings are now wrong in a way this case can
		   see, and the local gate asks the same question CI does. */
		assertThat(db.sql("select count(*) from event_comment k"
						+ " where k.who = 'Dunja Kostic'"
						+ " and (k.published_at at time zone 'Europe/Belgrade')::date"
						+ " <> (k.published_at at time zone ?)::date")
				.param(ZoneId.systemDefault().getId())
				.query(Integer.class).single())
				.as("this machine stands in a zone that agrees with the league's about the day this"
						+ " comment went out, so the assertion below cannot tell a resource reading"
						+ " the league's zone from one reading the machine's. The zone is pinned in"
						+ " backend/pom.xml precisely so that it does not")
				.isOne();

		assertThat(recordOf("Dunja Kostic").path("date").asString())
				.as("the day answered is the day in this machine's zone rather than in the"
						+ " league's, and the server may stand anywhere while the league does not")
				.isEqualTo("2010-05-18");
	}

	/**
	 * A COMMENT OF A MEMBER WHOSE FEE LAPSED IS STILL ANSWERED, AND WITHOUT HIS NUMBER.
	 *
	 * <p><b>Why it comes back at all.</b> It is published prose and the owner kept it:
	 * „Komentar clana koji je napustio ligu ostaje sa imenom pod kojim je objavljen"
	 * ({@code PDL.md:3740}, 06.08.2026). What changes is the link, not the comment.
	 *
	 * <p><b>Why the number does not.</b> „Komentar clana koji je napustio ligu nema vezu ka
	 * profilu, pa ni kad je taj clan i dalje u zapisu", and the reason recorded on 07.08.2026
	 * is that the code asked the wrong question: „ima li zapisa" umesto „ima li vidljivog
	 * profila" ({@code PDL.md:3756}). A member who did not renew is still in the record and
	 * has no visible profile - {@code /api/competitors} keeps him off its list altogether
	 * (owner, 13.09.2026) - and the number IS the profile link.
	 *
	 * <p><b>And leaving it in would name, by subtraction, whoever has not paid.</b> That is
	 * the sentence {@code PairApi} carries from the same day: a number that is in this answer
	 * and not in that one says, through the DIFFERENCE between two answers rather than through
	 * any field in either, the one thing Article 74 puts beside the date of birth - „sve u
	 * vezi sa clanarinom". Which is why the refusal below is asked of the whole answer as
	 * TEXT: the leak is the number leaving at all, not the shape it leaves in.
	 *
	 * <p><b>The anchor is what makes the other two halves measurements.</b> A member in good
	 * standing, written the same way, keeps his number - so an answer that lost every number
	 * is not withholding this one over a membership.
	 */
	@Test
	void aCommentOfAMemberWhoDidNotRenewIsAnsweredWithoutHisNumber() throws Exception {
		assertThat(db.sql("select c.member_number from competitor c where not c.active"
				+ " and exists (select 1 from event_comment k where k.competitor_id = c.id)")
				.query(String.class).list())
				.as("nobody who wrote a comment in the fixture let the fee lapse, so whatever is"
						+ " missing below is missing for another reason")
				.containsExactly("000030");

		assertThat(recordOf("Ana Peric").path("who").asString())
				.as("the comment of a member who did not renew did not come back at all, and the"
						+ " owner kept it: it is published prose under the name it went out with")
				.isEqualTo("Ana Peric");

		assertThat(recordOf("Ana Peric").path("memberNumber").isNull())
				.as("the number of a member who did not renew came back, and that number leaving"
						+ " here while /api/competitors keeps it off names, by subtraction, whoever"
						+ " has not paid")
				.isTrue();

		assertThat(whole())
				.as("000030 left the server somewhere else in the answer, and the leak is the number"
						+ " leaving at all rather than the field it leaves in")
				.doesNotContain("000030");

		assertThat(recordOf("Nikola Jovic").path("memberNumber").asString())
				.as("a member in good standing lost his number too, so what is withheld above is not"
						+ " the membership")
				.isEqualTo("000010");
	}

	/**
	 * AND A COMMENT WHOSE AUTHOR IS GONE FROM THE RECORD COMES BACK UNDER THE NAME IT WENT OUT
	 * WITH.
	 *
	 * <p>V7 made {@code who} the tombstone and the reference {@code on delete set null}
	 * exactly so that this comment survives its author: „Komentar clana koji je napustio ligu
	 * ostaje sa imenom pod kojim je objavljen, bez veze ka profilu" (owner, 06.08.2026). Read
	 * with an inner join instead, every comment of everybody who ever left would disappear
	 * from the portal, which is the opposite of what was decided.
	 *
	 * <p><b>Its own case beside the one above, and not folded into it.</b> The two are
	 * different rows in the database - a lapsed member leaves {@code competitor_id} pointing
	 * at him and a departed one leaves it null - so a reader asking „is there a record"
	 * answers correctly here and wrongly there. Measured together they would pass on that
	 * reader half the time and nobody would know which half.
	 */
	@Test
	void aCommentWhoseAuthorIsGoneComesBackUnderTheNameItWentOutWith() throws Exception {
		assertThat(db.sql("select count(*) from event_comment where competitor_id is null")
				.query(Integer.class).single())
				.as("no comment in the fixture has lost its author, so this case is about no row at"
						+ " all")
				.isOne();

		assertThat(recordOf(DEPARTED).path("memberNumber").isNull())
				.as("a comment whose author is gone came back with a member number, and there is"
						+ " nobody for it to lead to")
				.isTrue();

		assertThat(recordOf(DEPARTED).path("body").asString())
				.as("the comment of an author who is gone did not come back, and the tombstone in V7"
						+ " exists so that it does")
				.isEqualTo("Predugacka staza i slaba organizacija.");
	}

	/**
	 * AND EVERY EVENT'S COMMENTS ARE IN ONE ANSWER, which is the shape the portal reads by.
	 *
	 * <p>{@code EventComments.tsx} takes the whole list and keeps the ones belonging to the
	 * event being drawn together with those from its earlier runnings - a rule about events
	 * rather than about comments („komentar za Beogradski maraton 2026. mora biti vidljiv i uz
	 * izdanje iz 2027"). A resource answering per event would have to know that rule too.
	 */
	@Test
	void theCommentsOfEveryEventComeBackTogether() throws Exception {
		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("eventId").asLong()).distinct().count())
				.as("the answer carries the comments of one event only, and the page that draws them"
						+ " reads the whole list")
				.isEqualTo(2);
	}
}
