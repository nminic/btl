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
 * <p><b>The approval's side of the same lock is measured here as well</b>
 * ({@link #anApprovalAndARatingWithNoWordsAtOnceLeaveOneRatingOfTheEvent}), and it needs another hold: the
 * member's row is not what stops an approval, because without its lock the approval does not ask for it.
 * What stops both requests is the EVENT row, held {@code FOR UPDATE}: the foreign key of their
 * {@code event_comment} insert asks for it. The approval is sent first and waited for until it stands on
 * the event row (it has claimed its card and holds nothing of the member's), the rating second and
 * waited for in the same way, and only then is the hold let go. With the lock in the approval the
 * rating waits for the member's row behind it; without it the two overlap and the member ends with two
 * published ratings of one event. The first idea, that this order cannot be forced, was wrong
 * (review of PR 578, round 2, measured).
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

	private String moderatorCookie;

	private static final String MODERATOR_ADDRESS = "dve-ocene-odjednom-moderator@primer.rs";

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

		/* THE ONE WHO DECIDES, for the case about an approval: the superadmin sees every queue. */
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Mod', 'Eratorka', ?, (select id from role where code = 'superadmin'))")
				.param(MODERATOR_ADDRESS).update();

		SecretToken deciding = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(MODERATOR_ADDRESS, deciding.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		moderatorCookie = deciding.secret();

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
		db.sql("delete from verification where competitor_id = ?").param(him).update();
		db.sql("delete from comment_submission where competitor_id = ?").param(him).update();
		db.sql("delete from event_comment where event_id = ?").param(event).update();
		db.sql("delete from result where competitor_id = ?").param(him).update();
		db.sql("delete from race where event_id = ?").param(event).update();
		db.sql("delete from btl_event where id = ?").param(event).update();
		db.sql("delete from message where to_id = ?").param(him).update();
		db.sql("delete from account_session where account_id = (select id from account where email = ?)")
				.param(HIS_ADDRESS).update();
		db.sql("delete from account where email = ?").param(HIS_ADDRESS).update();
		db.sql("delete from account_session where account_id = (select id from account where email = ?)")
				.param(MODERATOR_ADDRESS).update();
		db.sql("delete from account where email = ?").param(MODERATOR_ADDRESS).update();
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

	/**
	 * A CARD A MODERATOR IS DECIDING THIS INSTANT IS NOT WAITED FOR. His rating with words waits in the
	 * queue and the card's row is held {@code FOR UPDATE} from another connection, as a decision holds
	 * it; his rating with no words must still be taken (201) and replace the published one, and the
	 * card it could not withdraw stays. Waiting for it would hold the member's row while waiting for
	 * the card, the order opposite to an approval's (card first, member second), and two such requests
	 * are a deadlock.
	 */
	@Test
	void aCardBeingDecidedIsNotWaitedForAndStaysInTheQueue() throws Exception {
		long submission = db.sql("insert into comment_submission (event_id, competitor_id,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " values (?, ?, 1, 1, 1, 'Čeka odluku.') returning id")
				.params(event, him).query(Long.class).single();
		long card = db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " comment_submission_id) values ('comments', ?, 'Dvaput ocenjena trka',"
						+ " 'Čeka odluku.', ?) returning id")
				.params(him, submission).query(Long.class).single();

		ExecutorService pool = Executors.newFixedThreadPool(1);

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update")
						.param(card).query(Integer.class).single();

				Future<MockHttpServletResponse> rating = pool.submit(() -> rated(4));
				long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);

				while (!rating.isDone() && System.nanoTime() < deadline) {
					try {
						Thread.sleep(50);
					} catch (InterruptedException e) {
						throw new IllegalStateException(e);
					}
				}

				assertThat(rating.isDone())
						.as("the rating waited for a card that is being decided")
						.isTrue();

				return null;
			});
		} finally {
			pool.shutdownNow();
		}

		assertThat(db.sql("select rating_organisation from event_comment where event_id = ?"
						+ " and competitor_id = ?").params(event, him).query(Integer.class).list())
				.as("the published rating was replaced although the card could not be withdrawn")
				.containsExactly(4);
		assertThat(db.sql("select count(*) from verification where id = ?").param(card)
				.query(Long.class).single())
				.as("the card a moderator is deciding was withdrawn from under him")
				.isOne();
	}

	/**
	 * AN APPROVAL AND A RATING WITH NO WORDS FROM ONE MEMBER AT ONE INSTANT LEAVE HIM ONE PUBLISHED RATING
	 * OF THE EVENT. His rating with words waits; the moderator approves it while the member sends a rating
	 * with no words. The approval takes the member's row before it deletes his older ratings and inserts
	 * the approved one ({@code VerificationWriteApi#publishTheComment}), the rating takes the same row
	 * first; the second of the two waits for the first and then replaces it. Without the approval's lock
	 * both read nothing, both insert, and the member holds the one with words and the one without.
	 *
	 * <p>Forced the way the class note says: the EVENT row is held, the approval is sent and waited for,
	 * then the rating, and only then is the row let go. Which of the two ends up as the row is not
	 * claimed; that it is one is.
	 */
	@Test
	void anApprovalAndARatingWithNoWordsAtOnceLeaveOneRatingOfTheEvent() throws Exception {
		long card = waitingCardWithWords("Sa rečima.");
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from btl_event where id = ? for update")
						.param(event).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the event row is locked and nothing has been submitted yet")
						.isZero();

				submitted.add(pool.submit(() -> approved(card)));
				stoppedBehindTheHold(1, submitted);
				submitted.add(pool.submit(() -> rated(5)));
				stoppedBehindTheHold(2, submitted);

				assertThat(submitted)
						.as("a request was answered before it reached the database")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			assertThat(List.of(submitted.get(0).get(30, TimeUnit.SECONDS).getStatus(),
					submitted.get(1).get(30, TimeUnit.SECONDS).getStatus()))
					.as("the approval and the rating are each taken")
					.containsExactly(200, 201);
		} finally {
			pool.shutdownNow();
		}

		assertThat(db.sql("select body || ':' || rating_organisation from event_comment where event_id = ?"
						+ " and competitor_id = ?").params(event, him).query(String.class).list())
				.as("the member holds two published ratings of one event")
				.hasSize(1);
	}

	/** A rating with words of his, waiting, and the card that carries it. */
	private long waitingCardWithWords(String words) {
		long submission = db.sql("insert into comment_submission (event_id, competitor_id,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " values (?, ?, 2, 2, 2, ?) returning id")
				.params(event, him, words).query(Long.class).single();

		return db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " comment_submission_id) values ('comments', ?, 'Dvaput ocenjena trka', ?, ?)"
						+ " returning id")
				.params(him, words, submission).query(Long.class).single();
	}

	private MockHttpServletResponse approved(long card) throws Exception {
		return http.perform(post("/api/verification/" + card + "/decision").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, moderatorCookie))
						.contentType(MediaType.APPLICATION_JSON).content("{\"approved\":true}"))
				.andReturn().getResponse();
	}

	/** Waits until this many requests stand behind the hold, or fails the case saying how many did. */
	private void stoppedBehindTheHold(int expected, List<Future<MockHttpServletResponse>> submitted) {
		long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);

		while (BlockedBehindThisHold.count(db) < expected && System.nanoTime() < deadline
				&& submitted.stream().noneMatch(Future::isDone)) {
			try {
				Thread.sleep(20);
			} catch (InterruptedException e) {
				throw new IllegalStateException(e);
			}
		}

		assertThat(BlockedBehindThisHold.count(db))
				.as("requests stopped behind the held event row")
				.isEqualTo(expected);
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
