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
 * THE PICTURE IS COMPARED BY THE STATEMENT THAT CLAIMS THE ROW, SO A MEMBER'S SEND THAT LANDS
 * BETWEEN READING THE ROW AND CLAIMING IT IS REFUSED AND NOT PUBLISHED.
 *
 * <p>PDL, the owner's answers of 10.10.2026: „Odobrava se samo slika koju je moderator video
 * (odluka nosi otisak; promenjena slika se odbija rečenicom)." and „Obe odluke o profilnoj slici,
 * odobravanje i odbijanje, važe samo za sliku koju je moderator video; ako je slika u međuvremenu
 * promenjena, odluka se odbija istom rečenicom „Slika je promenjena, pogledaj je ponovo." i red
 * ostaje."
 *
 * <p><b>WHY THIS IS A FILE OF ITS OWN, AND WHY {@code VerificationWriteApiTest} CANNOT HOLD IT.</b>
 * That class is {@code @Transactional}, so the route joins the test's transaction and the member's
 * send and the moderator's claim cannot be two transactions at all. Every case there that replaces
 * the picture does it BEFORE the moderator presses, which the claim meets as a row that already holds
 * another picture; it cannot tell a claim that asks the row for the picture from a route that asked
 * the row in Java a moment earlier and then claimed it without asking, because sequentially the two
 * agree. <b>This is the shape {@code VerificationDecisionConcurrencyTest} names for the state of the
 * row</b> - a check written in Java passes every sequential case and fails only under concurrency -
 * and the picture is the second thing the claim has to be the one to ask.
 *
 * <p><b>THE ORDER IS TAKEN AWAY FROM THE SCHEDULER</b>, the way that precedent takes it. The case
 * holds the row {@code FOR UPDATE} from a connection neither HTTP thread touches, sends the decision,
 * and waits until the lock manager shows it stopped behind the held row: by then it has read the row
 * (a plain read is not stopped by a row lock), found the picture it named, and reached the statement
 * that claims. Only then does the member's send happen - on the holding connection, as the same
 * {@code update verification set photo_id} that {@code MePhotoApi.send} runs under its own {@code for
 * update} - and the lock is let go. The claim wakes up and re-reads the row after the commit, which
 * is what READ COMMITTED does for a statement that waited, and so meets the picture the member left.
 *
 * <p><b>What it measures that nothing else can, and the mutation that says so.</b> A claim without
 * the condition on the picture goes through on the repointed row. For an approval it then publishes
 * the picture it read before the send, which the database has since deleted (V54: nobody holds it),
 * so the decision falls over as a server fault; for a refusal it simply records a verdict on a
 * picture nobody looked at and tells the member. A route that asked the row first in Java and then
 * claimed without the condition does exactly the same, because its question was put before the lock
 * was let go. Both answer something other than 409 here.
 *
 * <p>NOT {@code @Transactional}, for the precedent's reason, so every row is a real commit against the
 * database the whole suite shares and the {@code @AfterEach} takes them out again by key whether the
 * assertions passed or not.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AMemberSendsAnotherPictureWhileTheDecisionWaitsTest {

	/** Distinct from every other fixture's member and moderator, on purpose: these rows are committed. */
	private static final String HE = "000981";

	private static final String THE_MODERATOR = "slika-pod-rukom-moderator@primer.rs";

	private static final String THE_OTHER_MODERATOR = "slika-pod-rukom-drugi@primer.rs";

	/** The owner's sentence, said whole and with its full stop (PDL, 10.10.2026). */
	private static final String THE_PICTURE_WAS_CHANGED = "Slika je promenjena, pogledaj je ponovo.";

	/** What the loser of a race for the row has always been told, and is still told when the picture
	 *  he named is the one the row held. */
	private static final String SOMEBODY_ANSWERED_IT_ALREADY = "O stavci je već odlučeno.";

	private static final String THE_REASON = "Slika je mutna, posalji ostriju";

	private static final String A_TOWN = "(select id from place where rank = 1)";

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

	private long seen;

	private long newer;

	private String session;

	private String theOtherSession;

	@BeforeEach
	void aMemberWhosePictureWaitsAndAModeratorWhoMayDecideIt() {
		he = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Slikar', 'Slikovic', 'M', date '1990-05-05', " + A_TOWN
						+ ", 2027, false, true, 'payment', '00112233445599c1', '', false, 'none',"
						+ " 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.param(HE)
				.query(Long.class).single();

		seen = aPicture("pod-rukom-prva");
		newer = aPicture("pod-rukom-druga");

		item = db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values ('profiles', ?, 'Slika pod rukom', '', ?) returning id")
				.params(he, seen)
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

	/**
	 * Real commits, so a real delete, children before parents. The database deletes a {@code photo}
	 * row nobody holds at the end of the transaction that lets go of it (V54), so the pictures go with
	 * the row that holds them, and are named here as well for the case that failed before it got that
	 * far.
	 */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from verification_lock where verification_id = ?").param(item).update();
		db.sql("delete from message where to_id = ?").param(he).update();
		db.sql("delete from verification where id = ?").param(item).update();
		db.sql("delete from competitor where id = ?").param(he).update();
		db.sql("delete from photo where id in (?, ?)").params(seen, newer).update();
		db.sql("delete from account where email in (?, ?)")
				.params(THE_MODERATOR, THE_OTHER_MODERATOR).update();
	}

	/**
	 * THE PICTURE IS REPLACED WHILE THE DECISION WAITS FOR THE ROW, AND THE DECISION IS REFUSED FOR
	 * BOTH ANSWERS.
	 *
	 * <p>Every column the decision writes is asked, because 409 is also what a route would answer
	 * after it had published the new picture or recorded the verdict: the row still waits, still
	 * holds the picture the member left, carries no trace of an answer, nothing is on his profile
	 * and nothing was written to him.
	 */
	@ParameterizedTest
	@ValueSource(booleans = {true, false})
	void aPictureReplacedWhileTheDecisionWaitsForTheRowIsNotDecided(boolean approved)
			throws Exception {

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

				submitted.add(pool.submit(() -> decide(session, approved)));

				waitUntilTheRequestIsStopped();

				/* AND NOW THE MEMBER'S SEND LANDS, on the connection that holds the row, as the
				   statement `MePhotoApi.send` runs once it has the row: the pointer moves to the
				   other picture and the row keeps its key and its place. The request above has
				   already read the row and found `seen`; it is stopped at the statement that
				   claims it. */
				db.sql("update verification set photo_id = ? where id = ?")
						.params(newer, item).update();

				assertThat(submitted)
						.as("the decision was answered before the member's send landed, so it never"
								+ " waited for the row and this case measures nothing about the claim")
						.hasSize(1).noneMatch(Future::isDone);

				return null;
			});

			MockHttpServletResponse answered = submitted.get(0).get(30, TimeUnit.SECONDS);

			assertThat(answered.getStatus())
					.as("a decision about the picture the moderator saw was carried out on the row"
							+ " the member had since changed, or fell over on it (approved=%s)", approved)
					.isEqualTo(409);
			assertThat(mapper.readTree(answered.getContentAsString()).path("reason").asString())
					.isEqualTo(THE_PICTURE_WAS_CHANGED);

			assertThat(db.sql("select state from verification where id = ?").param(item)
					.query(String.class).single()).isEqualTo("waiting");
			assertThat(db.sql("select photo_id from verification where id = ?").param(item)
					.query(Long.class).single())
					.as("the row does not hold the picture the member left")
					.isEqualTo(newer);
			assertThat(db.sql("select count(*) from verification where id = ? and decided_at is null"
							+ " and decided_by is null and decided_by_name is null and reason is null")
					.param(item).query(Integer.class).single())
					.as("a column of the decision was written although it was refused")
					.isEqualTo(1);
			assertThat(db.sql("select photo_id from competitor where id = ?").param(he)
					.query(Long.class).optional())
					.as("a picture was published on his profile although the decision was refused")
					.isEmpty();
			assertThat(db.sql("select count(*) from message where to_id = ?").param(he)
					.query(Integer.class).single())
					.as("he was written to although the decision was refused")
					.isZero();
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * TWO MODERATORS NAME THE SAME PICTURE AT THE SAME INSTANT: THE LOSER IS TOLD THE ROW WAS
	 * DECIDED, NOT THAT THE PICTURE CHANGED.
	 *
	 * <p>The picture did not change, and both of them named the one the row holds, so the condition
	 * on the picture is met by both and it is the state that the loser's claim misses. The two
	 * refusals are different sentences and a route that read a miss the cheap way - „my claim found
	 * nothing, so it is the picture" - would tell a man who looked at the right picture that it had
	 * changed. A decided row keeps no picture (V9), so asking only whether the row now holds another
	 * one than he named is true of it too; the answer is owed to the state first.
	 *
	 * <p>Both requests are stopped behind the held row by the lock manager before it is let go
	 * ({@link BlockedBehindThisHold}), which names the branch: a request refused on the READ of an
	 * already decided row is answered without ever reaching the claim, and its future is done by then.
	 */
	@Test
	void twoModeratorsNamingTheSamePictureLeaveTheLoserToldItWasDecidedAndNotThatItChanged()
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

				submitted.add(pool.submit(() -> decide(session, true)));
				submitted.add(pool.submit(() -> decide(theOtherSession, false)));

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
					.as("the loser named the picture the row held and was told it had changed")
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
	 * nothing. The precedent's own wait asks for two requests; this case sends one.
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

	private MockHttpServletResponse decide(String as, boolean approved) throws Exception {
		String body = "{\"approved\":" + approved
				+ (approved ? "" : ",\"reason\":\"" + THE_REASON + "\"")
				+ ",\"seenPhotoId\":" + seen + "}";

		return http.perform(post("/api/verification/" + item + "/decision").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, as))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andReturn().getResponse();
	}

	private long aPicture(String name) {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 1000, ?, 0.3, 0.7, 0.45)"
						+ " returning id")
				.param(String.format("%064x", (name + System.nanoTime()).hashCode() & 0xffffffffL))
				.query(Long.class).single();
	}
}
