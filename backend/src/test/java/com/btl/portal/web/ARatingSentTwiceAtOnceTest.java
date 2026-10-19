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

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * TWO RATINGS WITH NO WORDS FROM ONE MEMBER AT ONE INSTANT LEAVE HIM ONE PUBLISHED RATING OF THE EVENT.
 *
 * <p><b>The owner, 19.10.2026:</b> one rating per member per event, a new one replaces the old. A rating
 * with no words replaces the old one in two statements (delete his published ones of the event, insert
 * the new). Under READ COMMITTED two requests that both delete before either inserts both delete
 * nothing and both insert, and nothing in the database refuses the second ({@code event_comment} has
 * no unique key on the member and the event, by decision). What holds the line is the lock
 * {@link CommentWriteApi} takes on the member's row first: the second request waits there, then
 * deletes what the first committed and inserts its own.
 *
 * <p><b>NOT {@code @Transactional}, and the order is taken from the scheduler</b>, the shape
 * {@code MemberPaymentTwiceAtOneInstantTest} sets out and {@link BlockedBehindThisHold} counts with:
 * the case holds the member's row {@code FOR UPDATE} before either request is sent, waits until both
 * are stopped inside the database, and only then lets go. A request stops on the held row either at the
 * lock (with it) or at the foreign key of the insert (without it), so the wait is satisfied in both
 * readings and the case fails on the COUNT, not on a timeout: without the lock the two overlap after
 * the release and the member ends with two rows. The rows are real commits and
 * {@link #andNothingOfItIsLeftBehind} takes them back out.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ARatingSentTwiceAtOnceTest {

	/** Distinct from every other fixture's, on purpose: these rows are committed. */
	private static final String THE_NUMBER = "000974";

	private static final String HIS_ADDRESS = "dve-ocene-odjednom@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holdingTheRow;

	private long him;

	private long event;

	private String cookie;

	@BeforeEach
	void aMemberWhoRanAnEventAndHasRatedItOnce() {
		him = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, referral_code, bio,"
						+ " profile_hidden, birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at) values (?, 'Dvaput', 'Ocenjivac', 'M', date '1990-05-15',"
						+ " (select id from place where rank = 1), 2027, false, true, '0011aabbccddee74', '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.param(THE_NUMBER).query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Dvaput', 'Ocenjivac', ?, (select id from role where code = 'competitor'), ?)")
				.params(HIS_ADDRESS, him).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(HIS_ADDRESS, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookie = session.secret();

		event = db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description,"
						+ " link) values ('dve-ocene-odjednom', 'Dvaput ocenjena trka', date '2026-05-01',"
						+ " (select id from place where rank = 1), 'race', false, '', '') returning id")
				.query(Long.class).single();

		long race = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values (?, 'Trka', false, date '2026-05-01',"
						+ " 'length', 0, 10, 0, 0) returning id")
				.param(event).query(Long.class).single();

		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
						+ " seconds, points) values (?, ?, date '2026-05-01', 10, 0, 0, 3600, 100)")
				.params(him, race).update();

		/* THE RATING HE ALREADY HAS, which both requests are racing to replace. */
		db.sql("insert into event_comment (event_id, competitor_id, who, published_at, rating_organisation,"
						+ " rating_value, rating_ambience, body) values (?, ?, 'Dvaput Ocenjivac',"
						+ " timestamptz '2026-05-02 10:00:00+00', 3, 3, 3, '')")
				.params(event, him).update();
	}

	/** Real commits, so a real delete, children before parents. */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from event_comment where event_id = ?").param(event).update();
		db.sql("delete from result where competitor_id = ?").param(him).update();
		db.sql("delete from race where event_id = ?").param(event).update();
		db.sql("delete from btl_event where id = ?").param(event).update();
		db.sql("delete from account_session where account_id = (select id from account where email = ?)")
				.param(HIS_ADDRESS).update();
		db.sql("delete from account where email = ?").param(HIS_ADDRESS).update();
		db.sql("delete from competitor where id = ?").param(him).update();
	}

	@Test
	void twoRatingsWithNoWordsAtOnceLeaveTheMemberOneRatingOfTheEvent() throws Exception {
		List<MockHttpServletResponse> both = atOnceBehindTheHeldRow(() -> rated(5), () -> rated(1));

		assertThat(both.stream().map(MockHttpServletResponse::getStatus).toList())
				.as("a request was refused or failed; each is a rating that is taken")
				.containsExactly(201, 201);

		assertThat(db.sql("select rating_organisation from event_comment where event_id = ?"
						+ " and competitor_id = ?").params(event, him).query(Integer.class).list())
				.as("the member holds two published ratings of one event, or none")
				.hasSize(1)
				.first()
				.isIn(5, 1);
	}

	/** {@code MemberPaymentTwiceAtOneInstantTest}'s shape, which says why each step is where it is. */
	private List<MockHttpServletResponse> atOnceBehindTheHeldRow(Callable<MockHttpServletResponse> one,
			Callable<MockHttpServletResponse> other) throws Exception {

		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from competitor where id = ? for update")
						.param(him).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet")
						.isZero();

				submitted.add(pool.submit(one));
				submitted.add(pool.submit(other));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new IllegalStateException(e);
				}

				assertThat(submitted)
						.as("a request was answered before it reached the database")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			return List.of(submitted.get(0).get(30, TimeUnit.SECONDS),
					submitted.get(1).get(30, TimeUnit.SECONDS));
		} finally {
			pool.shutdownNow();
		}
	}

	private MockHttpServletResponse rated(int stars) throws Exception {
		return http.perform(post("/api/comments").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"eventId\":" + event + ",\"organisation\":" + stars + ",\"value\":"
								+ stars + ",\"ambience\":" + stars + ",\"body\":\"\"}"))
				.andReturn().getResponse();
	}
}
