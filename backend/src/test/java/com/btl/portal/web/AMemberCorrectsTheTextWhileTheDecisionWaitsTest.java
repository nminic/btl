package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * THE ROW IS TAKEN BEFORE THE TEXT IS LOOKED AT, SO A MEMBER'S CORRECTION THAT LANDS BETWEEN READING
 * THE ROW AND DECIDING IT IS REFUSED AND NOT PUBLISHED.
 *
 * <p>PDL P11, 18.10.2026, recorded as derived from the owner's „isto kao za sliku" and from his answer
 * of 10.10.2026 about the picture (told to him, he may object): „Odluka moderatora o tekstu važi samo
 * za tekst koji je video. Ako je član u međuvremenu poslao nov tekst, odluka se odbija rečenicom da
 * je tekst promenjen i da ga pogleda ponovo."
 *
 * <p><b>WHY THIS IS A FILE OF ITS OWN</b>, for the reason {@code
 * AMemberSendsAnotherPictureWhileTheDecisionWaitsTest} gives: {@code VerificationWriteApiTest} is
 * {@code @Transactional}, so the route joins the test's transaction and the member's correction and
 * the moderator's decision cannot be two transactions at all. A route that read the words in Java
 * before taking the row, and one that took it first, agree in every sequential case.
 *
 * <p><b>WHAT WAS MEASURED BEFORE THE FIX EXISTED</b> (the review of PR 560, on a real PostgreSQL): a
 * second connection held the row {@code for update}, a decision stood behind it, a correction was
 * written over the row and committed, and the decision answered 200 with the row {@code approved}
 * carrying the NEW words and the profile carrying the OLD ones. The route had read the words before
 * the wait and published them after it. That is the second case this file asserts as 409 for both
 * answers, and the mutation that puts the plain read back answers 200 here.
 *
 * <p><b>THE ORDER IS TAKEN AWAY FROM THE SCHEDULER</b>, the way the precedent takes it: the row is
 * held {@code FOR UPDATE} from a connection neither HTTP thread touches, the decision is sent, and
 * the case waits until the lock manager shows it stopped behind the held row
 * ({@link BlockedBehindThisHold}). Only then does the member's correction happen - on the holding
 * connection, as the statement {@code MeWriteApi.queued} runs on the row that waits ({@code update
 * verification set body ...}, with the row keeping its key and its place) - and the lock is let go.
 *
 * <p>NOT {@code @Transactional}, for the precedent's reason, so every row is a real commit and the
 * {@code @AfterEach} takes them out again by key whether the assertions passed or not.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AMemberCorrectsTheTextWhileTheDecisionWaitsTest {

	/** Distinct from every other fixture's member and moderator, on purpose: these rows are committed. */
	private static final String HE = "000982";

	private static final String THE_MODERATOR = "tekst-pod-rukom-moderator@primer.rs";

	private static final String THE_OTHER_MODERATOR = "tekst-pod-rukom-drugi@primer.rs";

	/** The sentence the route answers with, said whole and with its full stop. */
	private static final String THE_TEXT_WAS_CHANGED = "Tekst je promenjen, pogledaj ga ponovo.";

	/** What the loser of a race for the row has always been told, and is still told when the words
	 *  he named are the ones the row held. */
	private static final String SOMEBODY_ANSWERED_IT_ALREADY = "O stavci je već odlučeno.";

	private static final String THE_REASON = "Tekst je preopsiran, skrati ga";

	/** What the moderator read, and what the member then wrote over it. Different on purpose, and
	 *  neither is a prefix of the other. */
	private static final String THE_TEXT_HE_READ = "Trcim od 2021. godine";

	private static final String THE_CORRECTION = "Trcim planinske trke vec deset godina";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	/** The row's own lock, held from this thread so the request queues behind it. */
	@Autowired
	private TransactionTemplate holdingTheRow;

	private long he;

	private long item;

	private String session;

	private String theOtherSession;

	@BeforeEach
	void aMemberWhoseTextWaitsAndAModeratorWhoMayDecideIt() {
		he = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Pisac', 'Pisic', 'M', date '1990-05-05',"
						+ " (select id from place where rank = 1),"
						+ " 2027, false, true, 'payment', '00112233445599c2', 'Stari odobren tekst',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.param(HE)
				.query(Long.class).single();

		item = db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('profiles', ?, 'Tekst pod rukom', ?) returning id")
				.params(he, THE_TEXT_HE_READ)
				.query(Long.class).single();

		session = aModeratorOfTheProfiles(THE_MODERATOR);
		theOtherSession = aModeratorOfTheProfiles(THE_OTHER_MODERATOR);
	}

	/** An account that holds the profiles queue and nothing else, and the secret of its session. */
	private String aModeratorOfTheProfiles(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'moderator'))")
				.param(email).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:profiles')")
				.param(email).update();

		SecretToken token = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, token.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return token.secret();
	}

	/** Real commits, so a real delete, children before parents. */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from verification_lock where verification_id = ?").param(item).update();
		db.sql("delete from message where to_id = ?").param(he).update();
		db.sql("delete from verification where id = ?").param(item).update();
		db.sql("delete from competitor where id = ?").param(he).update();
		db.sql("delete from account where email in (?, ?)")
				.params(THE_MODERATOR, THE_OTHER_MODERATOR).update();
	}

	/**
	 * THE TEXT IS CORRECTED WHILE THE DECISION WAITS FOR THE ROW, AND THE DECISION IS REFUSED FOR BOTH
	 * ANSWERS; THE ROW STAYS, WAITING WITH THE NEW WORDS, AND A DECISION THAT NAMES THEM IS CARRIED OUT.
	 *
	 * <p>Every column the decision writes is asked, because 409 is also what a route would answer
	 * after it had published the old words or recorded the verdict: the row still waits, holds what
	 * the member wrote last, carries no trace of an answer, his profile still carries the approved
	 * words and nothing was written to him.
	 *
	 * <p>And then the second half, which is the owner's "red ostaje": the moderator reads the card
	 * again and answers about the words that are there, and THAT decision is carried out - an
	 * approval publishes the correction and not the words he first read.
	 */
	@ParameterizedTest
	@ValueSource(booleans = {true, false})
	void aTextCorrectedWhileTheDecisionWaitsForTheRowIsNotDecided(boolean approved) throws Exception {
		ExecutorService pool = Executors.newSingleThreadExecutor();
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update")
						.param(item).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet, so a count of"
								+ " backends held up by this connection that is not nought is counting"
								+ " something other than the request below")
						.isZero();

				submitted.add(pool.submit(() -> decide(session, approved, THE_TEXT_HE_READ)));

				waitUntilTheRequestIsStopped();

				/* AND NOW THE MEMBER'S CORRECTION LANDS, on the connection that holds the row, as the
				   statement `MeWriteApi.queued` runs on the row that waits: the words are written over
				   and the row keeps its key and its place. The request above has already read the row
				   and found the words he read; it is stopped at the statement that takes the row. */
				db.sql("update verification set body = ? where id = ?")
						.params(THE_CORRECTION, item).update();

				assertThat(submitted)
						.as("the decision was answered before the member's correction landed, so it"
								+ " never waited for the row and this case measures nothing about the claim")
						.hasSize(1).noneMatch(Future::isDone);

				return null;
			});

			MockHttpServletResponse answered = submitted.get(0).get(30, TimeUnit.SECONDS);

			assertThat(answered.getStatus())
					.as("a decision about the words the moderator read was carried out on the row the"
							+ " member had since corrected, or fell over on it (approved=%s)", approved)
					.isEqualTo(409);
			assertThat(mapper.readTree(answered.getContentAsString()).path("reason").asString())
					.isEqualTo(THE_TEXT_WAS_CHANGED);

			nothingWasDecidedAndTheRowHoldsTheCorrection();

			/* AND THE CARD READ AGAIN IS DECIDED: the row waited for exactly this. */
			MockHttpServletResponse again = decide(session, approved, THE_CORRECTION);

			assertThat(again.getStatus())
					.as("the decision about the corrected words was refused too (approved=%s)", approved)
					.isEqualTo(200);
			assertThat(db.sql("select state from verification where id = ?").param(item)
					.query(String.class).single())
					.isEqualTo(approved ? "approved" : "rejected");
			assertThat(db.sql("select bio from competitor where id = ?").param(he)
					.query(String.class).single())
					.as("an approval published something other than the words it was about")
					.isEqualTo(approved ? THE_CORRECTION : "Stari odobren tekst");
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * THE WORDS COME BACK WHILE THE DECISION WAITS, AND WHAT IS PUBLISHED IS THE WORDS THE MODERATOR
	 * READ, NOT THE ONES THE REQUEST FOUND ON THE ROW WHEN IT BEGAN.
	 *
	 * <p>The route reads the item once at the start and compares the print under the lock. The two are
	 * equal whenever nothing happens in between, so the case above cannot tell which of them an
	 * approval writes onto the profile. This one makes them differ: the row holds the correction when
	 * the request begins, the moderator names the words he read before it, and the member writes those
	 * words back while the request stands behind the row. The comparison under the lock passes (the
	 * row holds what he named), and what the profile must carry is that, and not the correction the
	 * request saw first.
	 */
	@Test
	void anApprovalPublishesTheWordsItComparedAndNotTheOnesItFoundWhenItBegan() throws Exception {
		db.sql("update verification set body = ? where id = ?").params(THE_CORRECTION, item).update();

		ExecutorService pool = Executors.newSingleThreadExecutor();
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update")
						.param(item).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db)).isZero();

				submitted.add(pool.submit(() -> decide(session, true, THE_TEXT_HE_READ)));

				waitUntilTheRequestIsStopped();

				db.sql("update verification set body = ? where id = ?")
						.params(THE_TEXT_HE_READ, item).update();

				assertThat(submitted)
						.as("the decision was answered before the words were written back, so it never"
								+ " waited for the row and this case measures nothing about what is published")
						.hasSize(1).noneMatch(Future::isDone);

				return null;
			});

			MockHttpServletResponse answered = submitted.get(0).get(30, TimeUnit.SECONDS);

			assertThat(answered.getStatus())
					.as("the words he read were on the row when the row was taken, so the decision stands")
					.isEqualTo(200);
			assertThat(db.sql("select bio from competitor where id = ?").param(he)
					.query(String.class).single())
					.as("the profile carries words other than the ones the moderator read and the row holds")
					.isEqualTo(THE_TEXT_HE_READ);
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * EVERYTHING A DECISION WRITES, AND NONE OF IT IS THERE: the row still waits, holds the words the
	 * member wrote last, carries no trace of an answer, his profile still carries the approved words
	 * and nothing was written to him. Asked of every column on purpose, because 409 is also what a
	 * route would answer after it had published the words or recorded the verdict.
	 */
	private void nothingWasDecidedAndTheRowHoldsTheCorrection() {
		assertThat(db.sql("select state from verification where id = ?").param(item)
				.query(String.class).single()).isEqualTo("waiting");
		assertThat(db.sql("select body from verification where id = ?").param(item)
				.query(String.class).single())
				.as("the row does not hold the words the member wrote last")
				.isEqualTo(THE_CORRECTION);
		assertThat(db.sql("select count(*) from verification where id = ? and decided_at is null"
						+ " and decided_by is null and decided_by_name is null and reason is null")
				.param(item).query(Integer.class).single())
				.as("a column of the decision was written although it was refused")
				.isEqualTo(1);
		assertThat(db.sql("select bio from competitor where id = ?").param(he)
				.query(String.class).single())
				.as("words were published on his profile although the decision was refused")
				.isEqualTo("Stari odobren tekst");
		assertThat(db.sql("select count(*) from message where to_id = ?").param(he)
				.query(Integer.class).single())
				.as("he was written to although the decision was refused")
				.isZero();
	}

	/**
	 * TWO MODERATORS NAME THE SAME WORDS AT THE SAME INSTANT: THE LOSER IS TOLD THE ROW WAS DECIDED,
	 * NOT THAT THE TEXT CHANGED.
	 *
	 * <p>The text did not change, and both of them named the words the row holds, so what each names
	 * is right and it is the state that the loser meets: the statement that takes the row finds it
	 * decided when its turn comes. A route that read a miss the cheap way - „the row is not as I
	 * looked at it, so it is the text" - would tell a man who read the right words that they had
	 * changed. A decided row still holds its words, so asking only whether they are what he named
	 * would pass for the loser too; the answer is owed to the state first.
	 *
	 * <p>Both requests are stopped behind the held row by the lock manager before it is let go
	 * ({@link BlockedBehindThisHold}), which names the branch: a request refused on the READ of an
	 * already decided row is answered without ever reaching the lock, and its future is done by then.
	 */
	@Test
	void twoModeratorsNamingTheSameWordsLeaveTheLoserToldItWasDecidedAndNotThatItChanged()
			throws Exception {

		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update")
						.param(item).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet")
						.isZero();

				submitted.add(pool.submit(() -> decide(session, true, THE_TEXT_HE_READ)));
				submitted.add(pool.submit(() -> decide(theOtherSession, false, THE_TEXT_HE_READ)));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				assertThat(submitted)
						.as("a request that is not held up by this hold was refused before it reached"
								+ " the claim, which is the branch this case is written to keep away"
								+ " from")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			List<MockHttpServletResponse> both = List.of(submitted.get(0).get(30, TimeUnit.SECONDS),
					submitted.get(1).get(30, TimeUnit.SECONDS));

			assertThat(both.stream().map(MockHttpServletResponse::getStatus).sorted().toList())
					.as("one of the two was told yes and one was refused, whichever the database let"
							+ " through first")
					.containsExactly(200, 409);

			MockHttpServletResponse loser = both.get(0).getStatus() == 409 ? both.get(0) : both.get(1);

			assertThat(mapper.readTree(loser.getContentAsString()).path("reason").asString())
					.as("the loser named the words the row held and was told they had changed")
					.isEqualTo(SOMEBODY_ANSWERED_IT_ALREADY);
			assertThat(db.sql("select state from verification where id = ?").param(item)
					.query(String.class).single()).isIn("approved", "rejected");
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * Polled rather than assumed, and rooted at the holding connection
	 * ({@link BlockedBehindThisHold}): a fixed sleep either releases the row before the request
	 * has reached the claim, which is the flakiness the forced case exists to remove, or waits for
	 * nothing.
	 */
	private void waitUntilTheRequestIsStopped() {
		Instant deadline = Instant.now().plusSeconds(10);

		while (BlockedBehindThisHold.count(db) < 1) {
			if (Instant.now().isAfter(deadline)) {
				throw new IllegalStateException("the decision should have been stopped behind the"
						+ " held row within ten seconds, and the lock manager never showed it there");
			}

			try {
				Thread.sleep(25);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException(e);
			}
		}
	}

	private MockHttpServletResponse decide(String as, boolean approved, String seenText)
			throws Exception {

		String body = "{\"approved\":" + approved
				+ (approved ? "" : ",\"reason\":\"" + THE_REASON + "\"")
				+ ",\"seenText\":" + mapper.writeValueAsString(seenText) + "}";

		return http.perform(post("/api/verification/" + item + "/decision").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, as))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andReturn().getResponse();
	}
}
