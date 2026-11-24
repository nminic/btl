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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * THE CIRCLE THE ADMINISTRATION MOVES, AND A MODERATOR WHO APPROVES A NEW PICTURE OF THE SAME MEMBER AT THE SAME
 * INSTANT ({@link MemberPictureAndWordsApi#setThePicture}, independent security review of PR 825, 24.11.2026, medium).
 *
 * <p>The route answers a circle only for the picture the request says it was drawn over, and asks it of the picture
 * that stands at the moment of writing. A moderator's approval of a new picture takes no turn of the member's and
 * sets {@code competitor.photo_id}, so a circle drawn over the old picture could be written onto the one just
 * approved, over the circle the moderator had set, with a 200. Every sequential case in
 * {@code MemberPictureAndWordsApiTest} passes through that window without ever being in it, which is why this one is
 * written the way {@link VerificationDecisionConcurrencyTest} is: a connection of the case holds what the request
 * needs, the request is submitted and is seen to be stopped behind it by the lock manager, and what the approval does
 * is done from that connection before it lets go.
 *
 * <p><b>THE TWO CASES ARE THE TWO WAYS THE PICTURE CAN CHANGE UNDER THE REQUEST, and each fails on its own
 * mutation</b>: the approval lands while the request waits for the member's turn (the read after the turn is the
 * only thing that sees it), and while the request is already inside, between the read and the write (only a lock on
 * the member's row keeps it out, and the request is seen to wait for it).
 *
 * <p><b>The picture that stands is the old one with an old circle, the approved one carries the moderator's circle,
 * and the request names the old one with a third circle</b>, so each of the three is told from the others by its
 * numbers: a circle written onto the wrong picture shows as the request's numbers on the approved row.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class MemberCircleAgainstAnApprovalConcurrencyTest {

	private static final String THE_SUPERADMIN = "istovremeni-krug-superadmin@primer.rs";

	private static final String HIS_NUMBER = "000957";

	private static final String THE_OLD_DIGEST = String.format("%064x", 0xc1c1e001L);

	private static final String THE_APPROVED_DIGEST = String.format("%064x", 0xc1c1e002L);

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holdingTheRow;

	private long him;

	private long theOldPicture;

	private long theApprovedPicture;

	private String cookie;

	@BeforeEach
	void aMemberWithAPictureAndAPictureWaitingToBeApproved() {
		theOldPicture = aPhotoRow(THE_OLD_DIGEST, "0.30", "0.70", "0.45");
		theApprovedPicture = aPhotoRow(THE_APPROVED_DIGEST, "0.60", "0.40", "0.80");

		him = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, phone, shirt_size, health_statement_at, photo_id)"
						+ " values (?, 'Menjani', 'Clan', 'M', date '1980-01-01',"
						+ " (select id from place order by rank limit 1), 2027, '0011aabbccdd957f', '', false,"
						+ " 'none', 'Otac', 'Ulica 1', '0601234567', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00', ?) returning id")
				.params(HIS_NUMBER, theOldPicture)
				.query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at, password_hash)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = 'superadmin'),"
						+ " timestamptz '2026-09-02 10:00:00+00', null)")
				.param(THE_SUPERADMIN).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(THE_SUPERADMIN, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookie = session.secret();
	}

	/** Real commits, so a real delete: the member first, then the pictures nobody holds any more. */
	@AfterEach
	void takeThemBackOut() {
		db.sql("delete from competitor where id = ?").param(him).update();
		db.sql("delete from account where email = ?").param(THE_SUPERADMIN).update();
		db.sql("delete from photo where id in (?, ?)").params(theOldPicture, theApprovedPicture).update();
	}

	private long aPhotoRow(String digest, String x, String y, String size) {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/jpeg', 40960, ?, ?::numeric, ?::numeric, ?::numeric) returning id")
				.params(digest, x, y, size).query(Long.class).single();
	}

	/** The circle of each picture, as „key: x y diameter", so a circle written onto the wrong row shows. */
	private List<String> everyCircle() {
		return db.sql("select id || ': ' || crop_x || ' ' || crop_y || ' ' || crop_diameter from photo"
						+ " where id in (?, ?) order by id")
				.params(theOldPicture, theApprovedPicture).query(String.class).list();
	}

	/** The administration moving the circle of the picture the screen was served, to a circle of its own. */
	private MockHttpServletResponse theCircleOverTheOldPicture() throws Exception {
		return http.perform(multipart("/api/members/" + HIS_NUMBER + "/photo").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie))
						.param("over", "/api/photos/" + THE_OLD_DIGEST)
						.param("cropX", "0.10").param("cropY", "0.20").param("cropSize", "0.30"))
				.andReturn().getResponse();
	}

	/**
	 * The approved picture keeps the circle the moderator set, and no picture there is carries the request's. The old
	 * picture may be gone by now: the database deletes a {@code photo} row nobody holds when the approval commits (V54),
	 * so only what is left is asked.
	 */
	private void theModeratorsCircleStandsAndTheRequestsWasWrittenNowhere() {
		assertThat(everyCircle())
				.as("a circle drawn over the old picture was written onto the one the moderator approved")
				.contains(theApprovedPicture + ": 0.60000000 0.40000000 0.80000000")
				.noneMatch(one -> one.endsWith(": 0.10000000 0.20000000 0.30000000"));
	}

	/** What the moderator's approval does to the member, which is all of it that this route can meet. */
	private void theApproval() {
		db.sql("update competitor set photo_id = ? where id = ?").params(theApprovedPicture, him).update();
	}

	/**
	 * Until the lock manager shows the request stopped behind what this connection holds, or fails with what the
	 * database says about every backend. A request that is not stopped has gone through the window the case is
	 * written to be in, and that is the failure this wait names.
	 */
	private void untilTheRequestIsStoppedBehindThis(Future<?> submitted) throws InterruptedException {
		Instant deadline = Instant.now().plusSeconds(10);

		while (BlockedBehindThisHold.count(db) < 1) {
			if (submitted.isDone() || Instant.now().isAfter(deadline)) {
				throw new AssertionError("the request was not stopped behind what the case holds (done="
						+ submitted.isDone() + "), so it never met the window this case is written to be in");
			}

			Thread.sleep(20);
		}
	}

	@Test
	void anApprovalThatLandsWhileTheRequestWaitsForHisTurnIsNotWrittenOver() throws Exception {
		ExecutorService pool = Executors.newSingleThreadExecutor();

		try {
			Future<MockHttpServletResponse> submitted = holdingTheRow.execute(heldOpen -> {
				/* HIS TURN, which is what the request takes first and waits for: the same key the route asks for. */
				db.sql("select pg_advisory_xact_lock(hashtextextended(?, 0))::text")
						.param("profile-picture:" + him).query(String.class).single();

				assertThat(BlockedBehindThisHold.count(db)).as("nothing has been submitted yet").isZero();

				Future<MockHttpServletResponse> request = pool.submit(this::theCircleOverTheOldPicture);

				try {
					untilTheRequestIsStoppedBehindThis(request);
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				/* THE APPROVAL, while it waits, committed when this connection lets go of his turn. */
				theApproval();

				return request;
			});

			MockHttpServletResponse answer = submitted.get(30, TimeUnit.SECONDS);

			assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(409);
			assertThat(answer.getContentAsString()).contains(MePhotoApi.THE_PICTURE_HAS_CHANGED);
			theModeratorsCircleStandsAndTheRequestsWasWrittenNowhere();
		} finally {
			pool.shutdownNow();
		}
	}

	@Test
	void anApprovalThatLandsBetweenTheReadAndTheWriteMakesTheRequestWaitForItAndIsNotWrittenOver() throws Exception {
		ExecutorService pool = Executors.newSingleThreadExecutor();

		try {
			Future<MockHttpServletResponse> submitted = holdingTheRow.execute(heldOpen -> {
				/* THE MEMBER'S ROW, which the approval's own write to it would take. Nothing holds his turn, so the
				   request is inside the route and reaches the read of the picture that stands. */
				db.sql("select 1 from competitor where id = ? for update").param(him).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db)).as("nothing has been submitted yet").isZero();

				Future<MockHttpServletResponse> request = pool.submit(this::theCircleOverTheOldPicture);

				try {
					untilTheRequestIsStoppedBehindThis(request);
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				/* THE APPROVAL, written while the request stands at the row, committed when this lets go. */
				theApproval();

				return request;
			});

			MockHttpServletResponse answer = submitted.get(30, TimeUnit.SECONDS);

			assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(409);
			assertThat(answer.getContentAsString()).contains(MePhotoApi.THE_PICTURE_HAS_CHANGED);
			theModeratorsCircleStandsAndTheRequestsWasWrittenNowhere();
		} finally {
			pool.shutdownNow();
		}
	}

	@Test
	void withNoApprovalInTheWayTheCircleIsWrittenOnThePictureItWasDrawnOver() throws Exception {
		/* THE FLOOR UNDER THE TWO ABOVE: the same request, with nothing held and nothing approved, goes through and
		   writes its three numbers on the old picture alone. Without it, a route that refused every circle would pass
		   both. */
		MockHttpServletResponse answer = theCircleOverTheOldPicture();

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);
		assertThat(everyCircle())
				.containsExactly(theOldPicture + ": 0.10000000 0.20000000 0.30000000",
						theApprovedPicture + ": 0.60000000 0.40000000 0.80000000");
	}
}
