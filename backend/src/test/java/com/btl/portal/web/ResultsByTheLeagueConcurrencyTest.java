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

	@BeforeEach
	void twoModeratorsOneMemberAndOneRace() {
		moderator(ONE_MODERATOR);
		moderator(THE_OTHER_MODERATOR);

		member = db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Istovremeni', 'Unos', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true,"
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
		db.sql("delete from message where to_id = ?").param(member).update();
		db.sql("delete from result where competitor_id = ?").param(member).update();
		db.sql("delete from btl_event where slug = ?").param(THE_EVENT).update();
		db.sql("delete from competitor where id = ?").param(member).update();

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
