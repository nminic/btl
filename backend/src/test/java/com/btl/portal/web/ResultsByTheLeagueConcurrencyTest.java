package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * TWO MODERATORS ENTER ONE MEMBER ON ONE RACE IN THE SAME INSTANT, AND ONE RESULT IS WRITTEN.
 *
 * <p>{@link ResultsByTheLeagueApi} locks every member a save names before it judges a row, so the
 * second save waits for the first and then meets the result the first wrote („Član ima najviše
 * jedan rezultat na jednoj trci", PDL P6, 09.09.2026). A barrier that lets two requests go together
 * would pass whether or not the lock is there, whenever the scheduler happens to run them one after
 * the other; so this holds the member's row from a third connection until the lock manager shows
 * BOTH requests queued behind it ({@link BlockedBehindThisHold}), the shape
 * {@code VerificationDecisionConcurrencyTest} measured for the queue. Without the lock neither
 * request waits, and the case fails on that before it reaches its answer.
 *
 * <p>Not transactional, because the two requests run on their own connections and must see what
 * the other committed; what the case writes is taken back out after it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ResultsByTheLeagueConcurrencyTest {

	private static final String ONE_MODERATOR = "istovremeni-unos-prvi@primer.rs";

	private static final String THE_OTHER_MODERATOR = "istovremeni-unos-drugi@primer.rs";

	private static final String THE_MEMBER = "000941";

	private static final String THE_EVENT = "istovremeni-unos-2026";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holdingTheRow;

	private final Map<String, String> sessions = new HashMap<>();

	private long member;

	private long race;

	/** The second member and the events the cases below make, taken back out after each. */
	private final List<Long> moreMembers = new ArrayList<>();

	private final List<String> moreEvents = new ArrayList<>();

	@BeforeEach
	void twoModeratorsOneMemberAndOneRace() {
		moderator(ONE_MODERATOR);
		moderator(THE_OTHER_MODERATOR);

		member = db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Istovremeni', 'Unos', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, true,"
						+ " '0011223344558a41', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.param(THE_MEMBER).query(Long.class).single();

		long event = db.sql("insert into btl_event (slug, name, date, place_id, kind, featured,"
						+ " description, link) values (?, 'Istovremeni unos', date '2026-05-01',"
						+ " (select id from place where rank = 1), 'race', false, '', '') returning id")
				.param(THE_EVENT).query(Long.class).single();

		race = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values (?, 'Istovremena desetka', false,"
						+ " date '2026-05-01', 'length', 0, 10.00, 50, 50) returning id")
				.param(event).query(Long.class).single();
	}

	@AfterEach
	void takeThemBackOut() {
		moreMembers.add(member);
		moreEvents.add(THE_EVENT);

		for (long each : moreMembers) {
			db.sql("delete from message where to_id = ?").param(each).update();
			db.sql("delete from result where competitor_id = ?").param(each).update();
		}

		for (String slug : moreEvents) {
			db.sql("delete from btl_event where slug = ?").param(slug).update();
		}

		for (long each : moreMembers) {
			db.sql("delete from competitor where id = ?").param(each).update();
		}

		for (String email : sessions.keySet()) {
			db.sql("delete from account where email = ?").param(email).update();
		}
	}

	@Test
	void twoSavesOfOneMemberOnOneRaceAtOneInstantWriteOneResult() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			Callable<MockHttpServletResponse> one = () -> entered(ONE_MODERATOR, 3600);
			Callable<MockHttpServletResponse> theOther = () -> entered(THE_OTHER_MODERATOR, 4000);

			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from competitor where id = ? for update")
						.param(member).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is held and nothing has been sent yet, so a count that is not"
								+ " nought is counting something other than the two saves below")
						.isZero();

				submitted.add(pool.submit(one));
				submitted.add(pool.submit(theOther));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				assertThat(submitted).as("a save went through without waiting for the member's row")
						.noneMatch(Future::isDone);

				return null;
			});

			List<MockHttpServletResponse> answers = List.of(submitted.get(0).get(30, TimeUnit.SECONDS),
					submitted.get(1).get(30, TimeUnit.SECONDS));

			assertThat(answers.stream().map(MockHttpServletResponse::getStatus).sorted().toList())
					.as("both saves were written, so the member has two results on one race")
					.containsExactly(201, 400);

			MockHttpServletResponse refused = answers.stream().filter(a -> a.getStatus() == 400)
					.findFirst().orElseThrow();

			assertThat(new ObjectMapper().readTree(refused.getContentAsString()).path("rows").get(0)
					.path("reason").asString())
					.isEqualTo(ResultsByTheLeagueApi.HE_HAS_A_RESULT_ON_THIS_RACE);

			assertThat(db.sql("select count(*) from result where competitor_id = ? and race_id = ?")
					.params(member, race).query(Integer.class).single()).isEqualTo(1);
			assertThat(db.sql("select count(*) from message where to_id = ?")
					.param(member).query(Integer.class).single())
					.as("the refused save told him something").isEqualTo(1);
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * A RESULT OF HIS THAT ANOTHER WRITER IS PUTTING ON THE SAME RACE MAKES THE SAVE WAIT, AND THE SAVE
	 * THEN MEETS IT.
	 *
	 * <p>The other writer is this connection, standing for the approval of his run
	 * ({@code VerificationWriteApi}), which does not take the save's lock on {@code competitor}: it
	 * writes his result and holds it uncommitted. Every row of {@code result} checks
	 * {@code result_competitor_fk}, which takes his {@code competitor} row {@code for key share}, and the
	 * save's {@code for update} on that row waits for it. So the save is stopped before it judges a row,
	 * the lock manager says so, and once this connection commits the save's own question finds the
	 * result and names the row (PDL P6, 09.09.2026). That is why the save's insert needs no
	 * {@code on conflict}: no writer of his result can get past this lock unseen.
	 *
	 * <p>Without the lock the save does not wait at the lock but at the insert, behind V65's key, and
	 * answers 500 (a duplicate key) once this connection commits; without the key as well, 201 and two
	 * results. Either fails here.
	 */
	@Test
	void aResultOfHisBeingWrittenElsewhereMakesTheSaveWaitAndThenRefusesTheRow() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			long theOneThatGotThere = holdingTheRow.execute(heldOpen -> {
				long written = db.sql("insert into result (competitor_id, race_id, race_date,"
								+ " distance_km, ascent_m, descent_m, seconds, points) values (?, ?,"
								+ " date '2026-05-01', 10.00, 50, 50, 3300, 9.99) returning id")
						.params(member, race).query(Long.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("nothing has been sent yet, so a count that is not nought is counting"
								+ " something other than the save below")
						.isZero();

				submitted.add(pool.submit(() -> entered(ONE_MODERATOR, 3600)));

				Instant deadline = Instant.now().plusSeconds(10);

				while (BlockedBehindThisHold.count(db) < 1) {
					assertThat(Instant.now()).as("the save never waited for the result being written")
							.isBefore(deadline);

					try {
						Thread.sleep(20);
					} catch (InterruptedException e) {
						throw new RuntimeException(e);
					}
				}

				assertThat(submitted.get(0)).as("the save went through without waiting").isNotDone();

				return written;
			});

			MockHttpServletResponse refused = submitted.get(0).get(30, TimeUnit.SECONDS);

			assertThat(refused.getStatus()).isEqualTo(400);
			assertThat(new ObjectMapper().readTree(refused.getContentAsString()).path("rows").get(0)
					.path("reason").asString())
					.isEqualTo(ResultsByTheLeagueApi.HE_HAS_A_RESULT_ON_THIS_RACE);
			assertThat(db.sql("select id from result where competitor_id = ? and race_id = ?")
					.params(member, race).query(Long.class).list())
					.as("the save wrote a result of its own beside the one already there")
					.containsExactly(theOneThatGotThere);
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * TWO SAVES OF ONE NEW RACE ON ONE EVENT, AT ONE INSTANT, MAKE ONE RACE (PDL, owner, 23.10.2026, „Unos
	 * rezultata ne sme da napravi duplu trku").
	 *
	 * <p>Both saves find the event and neither finds the race, because the other has not written it yet: the
	 * question about the race is only true once the event is HELD ({@code for no key update}), which is what
	 * puts the second save behind the first. This connection holds the event until the lock manager shows
	 * BOTH saves queued behind it ({@link BlockedBehindThisHold}), so the case does not depend on the
	 * scheduler. A save that asked about the race before it held the event, or did not ask at all, makes
	 * a second race here, and each member's result lands on his own.
	 */
	@Test
	void twoSavesOfOneNewRaceOnOneEventAtOneInstantMakeOneRace() throws Exception {
		long other = anotherMember("000942", "0011223344558a42");
		long eventId = db.sql("select id from btl_event where slug = ?").param(THE_EVENT)
				.query(Long.class).single();

		bothSaveTheSameNewRace("Istovremeni unos", "2026-05-01", () -> {
			db.sql("select 1 from btl_event where id = ? for update").param(eventId)
					.query(Integer.class).single();
		});

		assertThat(db.sql("select count(*) from race where event_id = ? and name = 'Nova istovremena'")
				.param(eventId).query(Integer.class).single()).as("a second race of the name was made")
				.isEqualTo(1);
		assertThat(db.sql("select count(distinct race_id) from result where competitor_id in (?, ?)"
				+ " and race_id in (select id from race where name = 'Nova istovremena')")
				.params(member, other).query(Integer.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(*) from result where competitor_id in (?, ?)")
				.params(member, other).query(Integer.class).single()).isEqualTo(2);
	}

	/**
	 * THE SAME WHERE THE EVENT IS MADE IN THE SAME INSTANT: both saves find no event, both insert at its
	 * address, and the one that loses is begun again from the top ({@code THE_ADDRESS_WAS_TAKEN}). Whichever
	 * order they take the second time round, the second meets the race the first made.
	 *
	 * <p>This connection stands for the save that made the event first: it inserts the event and holds it
	 * uncommitted, so both real saves stop at their insert behind it, and neither could have seen the event
	 * at the top.
	 */
	@Test
	void twoSavesOfOneNewRaceOnAnEventBeingMadeAtOneInstantMakeOneRace() throws Exception {
		long other = anotherMember("000942", "0011223344558a42");
		String slug = "istovremeno-izdanje-2026";

		moreEvents.add(slug);

		bothSaveTheSameNewRace("Istovremeno izdanje", "2026-06-01", () -> {
			db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
					+ " values (?, 'Istovremeno izdanje', date '2026-06-01',"
					+ " (select id from place where rank = 1), 'race', false, '', '')")
					.param(slug).update();
		});

		assertThat(db.sql("select count(*) from race r join btl_event e on e.id = r.event_id"
				+ " where e.slug = ?").param(slug).query(Integer.class).single())
				.as("a second race of the name was made").isEqualTo(1);
		assertThat(db.sql("select count(*) from result where competitor_id in (?, ?)")
				.params(member, other).query(Integer.class).single()).isEqualTo(2);
	}

	/** Takes what {@code hold} takes, keeps it until both saves wait behind it, lets go, and answers both. */
	private void bothSaveTheSameNewRace(String eventName, String day, Runnable hold) throws Exception {
		bothSave(hold, () -> onTheNewRace(ONE_MODERATOR, eventName, day, THE_MEMBER),
				() -> onTheNewRace(THE_OTHER_MODERATOR, eventName, day, "000942"));
	}

	/**
	 * THE SAME, WITH THE TWO REQUESTS GIVEN: each is a save of the new race, sent by the address of the
	 * event or by its key, which are two roads in {@code theRaceAndItsRows} that each hold the event
	 * before the race is asked about.
	 */
	private void bothSave(Runnable hold, Callable<MockHttpServletResponse> one,
			Callable<MockHttpServletResponse> theOther) throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				hold.run();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the hold is taken and nothing has been sent yet, so a count that is not"
								+ " nought is counting something other than the two saves below")
						.isZero();

				submitted.add(pool.submit(one));
				submitted.add(pool.submit(theOther));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				assertThat(submitted).as("a save went through without waiting").noneMatch(Future::isDone);

				return null;
			});

			assertThat(List.of(submitted.get(0).get(30, TimeUnit.SECONDS).getStatus(),
					submitted.get(1).get(30, TimeUnit.SECONDS).getStatus())).containsExactly(201, 201);
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * THE ROAD OF THE KEY (review of PR 637, round 1, high): a save that names the event by its key holds it
	 * the same way, and the cases above never sent one, so replacing that read with a plain one left every
	 * case green. Three pairs, each with a request by the key: one by the address on the same day, one by
	 * the address on ANOTHER day of the event (a race on a later day leaves the event where it begins), and
	 * two by the key on another day. Every pair leaves one race, and each member's result is on it.
	 */
	@Test
	void aSaveByTheKeyAndOneByTheAddressOnTheSameDayMakeOneRace() throws Exception {
		bothByKeyOrAddress("2026-05-01", true, false);
	}

	@Test
	void aSaveByTheKeyAndOneByTheAddressOnAnotherDayOfTheEventMakeOneRace() throws Exception {
		bothByKeyOrAddress("2026-05-02", true, false);
	}

	@Test
	void twoSavesByTheKeyOnAnotherDayOfTheEventMakeOneRace() throws Exception {
		bothByKeyOrAddress("2026-05-02", true, true);
	}

	private void bothByKeyOrAddress(String day, boolean oneByKey, boolean theOtherByKey) throws Exception {
		long other = anotherMember("000942", "0011223344558a42");
		long eventId = db.sql("select id from btl_event where slug = ?").param(THE_EVENT)
				.query(Long.class).single();

		bothSave(() -> db.sql("select 1 from btl_event where id = ? for update").param(eventId)
						.query(Integer.class).single(),
				() -> oneByKey ? onTheNewRaceByKey(ONE_MODERATOR, eventId, day, THE_MEMBER)
						: onTheNewRace(ONE_MODERATOR, "Istovremeni unos", day, THE_MEMBER),
				() -> theOtherByKey ? onTheNewRaceByKey(THE_OTHER_MODERATOR, eventId, day, "000942")
						: onTheNewRace(THE_OTHER_MODERATOR, "Istovremeni unos", day, "000942"));

		assertThat(db.sql("select count(*) from race where event_id = ? and name = 'Nova istovremena'"
						+ " and date = cast(? as date)").params(eventId, day).query(Integer.class).single())
				.as("a second race of the name was made").isEqualTo(1);
		assertThat(db.sql("select count(*) from race where event_id = ? and name = 'Nova istovremena'")
				.param(eventId).query(Integer.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(distinct race_id) from result where competitor_id in (?, ?)")
				.params(member, other).query(Integer.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(*) from result where competitor_id in (?, ?)")
				.params(member, other).query(Integer.class).single()).isEqualTo(2);
	}

	private MockHttpServletResponse onTheNewRaceByKey(String email, long eventId, String day, String number)
			throws Exception {
		return http.perform(post("/api/results/on-a-race-of-an-event").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"event\":{\"id\":" + eventId + "},\"race\":{\"name\":"
								+ "\"Nova istovremena\",\"date\":\"" + day + "\",\"kind\":\"length\","
								+ "\"distanceKm\":10.00,\"ascentM\":0,\"descentM\":0},\"rows\":["
								+ "{\"memberNumber\":\"" + number + "\",\"seconds\":3600}]}"))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse onTheNewRace(String email, String eventName, String day, String number)
			throws Exception {
		return http.perform(post("/api/results/on-a-race-of-an-event").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"event\":{\"name\":\"" + eventName + "\",\"date\":\"" + day
								+ "\",\"city\":\"Ohrid\",\"country\":\"MK\"},\"race\":{\"name\":"
								+ "\"Nova istovremena\",\"kind\":\"length\",\"distanceKm\":10.00,"
								+ "\"ascentM\":0,\"descentM\":0},\"rows\":[{\"memberNumber\":\"" + number
								+ "\",\"seconds\":3600}]}"))
				.andReturn().getResponse();
	}

	private long anotherMember(String number, String referral) {
		long made = db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Drugi', 'Istovremeni', 'M', date '1991-01-01',"
						+ " (select id from place where rank = 1), 2027, true,"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 2', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, referral).query(Long.class).single();

		moreMembers.add(made);

		return made;
	}

	private MockHttpServletResponse entered(String email, int seconds) throws Exception {
		return http.perform(post("/api/races/" + race + "/results").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"rows\":[{\"memberNumber\":\"" + THE_MEMBER + "\",\"seconds\":"
								+ seconds + "}]}"))
				.andReturn().getResponse();
	}

	private void moderator(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'moderator'))")
				.param(email).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:results')")
				.param(email).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session.secret());
	}
}
