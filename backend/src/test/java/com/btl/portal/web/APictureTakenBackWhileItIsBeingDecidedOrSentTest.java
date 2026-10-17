package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A MEMBER WHO TAKES HIS WAITING PICTURE BACK MEETS, AT THE SAME INSTANT, A DECISION ABOUT IT AND A
 * FIRST SEND OF HIS OWN, AND NEITHER LEAVES A FAULT OR A LOST DECISION.
 *
 * <p><b>The owner's decision, PDL 27.09.2026, chosen between offered outcomes with my
 * recommendation beside the one he took:</b> „Kad član pritisne „Ukloni sliku" dok slika još čeka
 * odluku, red odlazi zajedno sa njom i moderatoru se nikad ne pojavi." And ADL, 09.10.2026, which
 * recorded in advance what carrying it out would have to do: „kad uklanjanje slike koja čeka počne
 * da povlači i red verifikacije, mora da uzme istu bravu". Every sequential case in
 * {@code MePhotoApiTest} already holds that a removal takes the row and the picture with it; none
 * of them can see what this file is about, because that class is {@code @Transactional}, so the
 * route joins the test's transaction and a removal and a request beside it cannot be two
 * transactions at all.
 *
 * <p><b>THE FOUR CASES ARE FOUR WAYS FOR THE ROW TO BE GONE, OR NOT, AT THE MOMENT SOMEBODY ELSE
 * ASKS FOR IT.</b>
 *
 * <ul>
 * <li><b>A first send is in flight when the removal arrives.</b> The send holds the member's turn
 * and has written nothing a removal could find. A removal that did not take the turn asks for the
 * row, finds nothing, answers 200 having withdrawn nothing, and the send then opens a row: the
 * picture the member has just taken back is in front of a moderator. The reviewer of PR 503 wrote
 * this down as reasoning on 09.10.2026 („inače može da promaši prvo slanje u toku", not measured);
 * it is measured here.
 * <li><b>A decision is asked for after the removal committed.</b> The item is not there and the
 * answer is the one for an item that is not there, for both answers, and nothing is written about
 * the member.
 * <li><b>A decision is stopped behind the removal.</b> It asked for the row first and met the lock,
 * so it finds the row gone when its turn comes and is told „O stavci je već odlučeno.", the
 * sentence the loser of a race for a row has always been told: never a 500, and never the other
 * sentence („Slika je promenjena…"), which would tell a moderator who looked at the right picture
 * that it changed.
 * <li><b>A removal is stopped behind a decision.</b> The decision holds the row, so the removal
 * must read the row UNDER the lock: it then finds a row that is no longer waiting, leaves the
 * decision where it is, and takes down what an approval published. Read without the lock it finds
 * a row that is waiting, and its delete then removes the DECIDED row once the lock is let go, which
 * is the record of an approval or of a refusal.
 * </ul>
 *
 * <p><b>THE ORDER IS TAKEN AWAY FROM THE SCHEDULER</b>, the way
 * {@code AMemberSendsAnotherPictureWhileTheDecisionWaitsTest} takes it: the row, or the member's
 * own row, is held from a connection neither HTTP thread touches, the first request is sent and the
 * case waits until the lock manager shows it stopped, and only then is the second sent. Postgres
 * queues the second waiter behind the first, so the order they run in once the hold is let go is
 * the order they were stopped in, and the case asserts it in the outcome rather than assuming it.
 *
 * <p>NOT {@code @Transactional}, for the precedent's reason, so every row is a real commit against
 * the database the whole suite shares; the {@code @AfterEach} takes them out again by key whether
 * the assertions passed or not.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class APictureTakenBackWhileItIsBeingDecidedOrSentTest {

	/** The sentence the loser of a race for a row has always been told. */
	private static final String SOMEBODY_ANSWERED_IT_ALREADY = "O stavci je već odlučeno.";

	private static final String THE_REASON = "Slika je mutna, posalji ostriju";

	/** The circle every picture here is made with, spelled the way a screen sends back what it read. */
	private static final String THE_CIRCLE_HE_SAW = "{\"x\":0.3,\"y\":0.7,\"size\":0.45}";

	private static final String THE_MODERATOR = "povucena-slika-moderator@primer.rs";

	/** A FOLDER OF THIS RUN'S OWN, for the reason {@code MePhotoApiTest} gives for its own. */
	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-takenback-");
		}
		catch (IOException noFolder) {
			throw new UncheckedIOException(noFolder);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	/** Distinct from every other fixture's members, on purpose: these rows are committed. */
	private static final AtomicInteger ISSUED = new AtomicInteger();

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	/** The lock held from this thread so every request queues behind it. */
	@Autowired
	private TransactionTemplate holdingTheRow;

	private final List<Member> members = new ArrayList<>();

	private final List<Long> pictures = new ArrayList<>();

	private boolean theModeratorExists;

	private String moderatorSession;

	/** One member the case made, with the cookie of his session. */
	private record Member(long id, String address, SecretToken session) {
	}

	/** The row a picture of a member waits in, and the picture that row holds. */
	private record Waiting(long row, long photo) {
	}

	/** A status and a body, or the exception that came out in the place of one (status -1). */
	private record Answer(int status, String body, String threw) {
	}

	@AfterEach
	void nothingOfItIsLeftBehind() throws IOException {
		for (Member made : members) {
			db.sql("delete from verification_lock where verification_id in (select id from"
					+ " verification where competitor_id = ?)").param(made.id()).update();
			db.sql("delete from message where to_id = ?").param(made.id()).update();
			db.sql("delete from verification where competitor_id = ?").param(made.id()).update();
			db.sql("delete from account where email = ?").param(made.address()).update();
			db.sql("delete from competitor where id = ?").param(made.id()).update();
		}

		for (long one : pictures) {
			db.sql("delete from photo where id = ?").param(one).update();
		}

		db.sql("delete from account where email = ?").param(THE_MODERATOR).update();

		try (Stream<Path> there = Files.list(PHOTOS)) {
			for (Path file : there.toList()) {
				Files.deleteIfExists(file);
			}
		}
	}

	/* ------------------------------------------------------------------------------------------
	   A FIRST SEND IS IN FLIGHT WHEN THE REMOVAL ARRIVES
	   ------------------------------------------------------------------------------------------ */

	/**
	 * THE REMOVAL WAITS FOR THE SEND OF THE SAME MEMBER THAT IS IN FLIGHT, AND TAKES BACK THE ROW
	 * IT OPENED.
	 *
	 * <p>The member's own row is held from the test, so the send takes his turn and then stops at the
	 * statement that opens its row, which needs a share of that row. The removal is sent once the
	 * lock manager shows the send stopped, and is then stopped behind the SEND's turn, not behind the
	 * test's hold: the count is rooted at the holding connection and follows the chain, so two is
	 * both. When the hold is let go the send commits its row, the removal takes the turn, finds the
	 * row and withdraws it.
	 *
	 * <p><b>The mutation this is written against is one call:</b> the removal without
	 * {@code oneSendOfAMemberAtATime}. It asks for the row, finds none, answers 200 at once, and the
	 * future is DONE while the hold is still held, which the assertion before the hold is let go
	 * names. Everything after it asks what was left behind, because the mutation is also the one that
	 * leaves a picture waiting.
	 */
	@Test
	void aRemovalWaitsForAFirstSendInFlightAndTakesBackTheRowItOpened() throws Exception {
		Member me = aMember();
		/* Counted by difference, because the database is shared by the whole suite and other classes
		   leave rows of their own in it. */
		long photosBefore = db.sql("select count(*) from photo").query(Long.class).single();
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<Answer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from competitor where id = ? for update")
						.param(me.id()).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is held and nothing has been submitted yet")
						.isZero();

				submitted.add(pool.submit(() -> send(me, aJpeg("prvo slanje u toku"))));

				untilStopped(1);

				submitted.add(pool.submit(() -> remove(me)));

				untilStopped(2);

				assertThat(submitted)
						.as("a request was answered while the hold was held: the removal did not wait"
								+ " for the send of its member, so it asked for a row that was not"
								+ " there yet")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			Answer sent = submitted.get(0).get(30, TimeUnit.SECONDS);
			Answer removed = submitted.get(1).get(30, TimeUnit.SECONDS);

			assertThat(sent.status()).as("the send: %s", sent).isEqualTo(200);
			assertThat(removed.status()).as("the removal: %s", removed).isEqualTo(200);

			assertThat(db.sql("select count(*) from verification where competitor_id = ?")
					.param(me.id()).query(Long.class).single())
					.as("the picture he took back is in front of a moderator: the removal ran before"
							+ " the send had opened its row")
					.isZero();
			assertThat(db.sql("select count(*) from photo").query(Long.class).single())
					.as("the picture that was sent and taken back still has a row")
					.isEqualTo(photosBefore);
			assertThat(filesOnTheDisk())
					.as("the picture that was sent and taken back still has a file")
					.isZero();
		}
		finally {
			pool.shutdownNow();
		}
	}

	/* ------------------------------------------------------------------------------------------
	   A DECISION IS ASKED FOR AFTER THE REMOVAL
	   ------------------------------------------------------------------------------------------ */

	/**
	 * A DECISION ASKED FOR AFTER THE REMOVAL IS TOLD THERE IS NO SUCH ITEM, FOR BOTH ANSWERS, AS IT
	 * IS FOR A KEY THAT WAS NEVER ISSUED.
	 *
	 * <p>The item is read first, as always, and the removal had taken the row, so the reading is
	 * the one for an address that is not there. The comparison with a key nobody issued is the
	 * point: two answers that carry one number are an oracle if anything else differs, and what a
	 * moderator who is looking at a card that is gone learns must not be more than a moderator who
	 * typed a key by hand. Nothing is written about the member: no message, no picture on his
	 * profile, no row.
	 */
	@ParameterizedTest
	@ValueSource(booleans = {true, false})
	void aDecisionAskedForAfterTheRemovalIsToldThereIsNoSuchItem(boolean approved) throws Exception {
		Member he = aMember();
		Waiting waiting = aPictureWaitsFor(he);

		assertThat(remove(he).status()).isEqualTo(200);

		Answer late = decide(waiting, approved);
		Answer never = decide(new Waiting(waiting.row() + 100_000, waiting.photo()), approved);

		assertThat(late.status()).as("the late decision: %s", late).isEqualTo(404);
		assertThat(never.status()).as("the decision on a key nobody issued: %s", never).isEqualTo(404);
		assertThat(late.body())
				.as("a moderator who looked at a card that was taken back is told more than one who"
						+ " typed a key by hand")
				.isEqualTo(never.body());

		nothingWasWrittenAboutHim(he);
		assertThat(Files.exists(PHOTOS.resolve(String.valueOf(waiting.photo()))))
				.as("the file of the picture he took back is still on the disk")
				.isFalse();
	}

	/* ------------------------------------------------------------------------------------------
	   A DECISION IS STOPPED BEHIND THE REMOVAL
	   ------------------------------------------------------------------------------------------ */

	/**
	 * A DECISION THAT ASKED FOR THE ROW BEFORE THE REMOVAL TOOK IT FINDS IT GONE, AND IS TOLD IT WAS
	 * ALREADY DECIDED.
	 *
	 * <p>The row is held from the test; the removal is sent and stopped at the row, and then the
	 * decision is sent and stopped behind it. The removal commits first, because it was stopped
	 * first, and the decision then finds nothing where it expected a waiting row. <b>The status is
	 * the claim</b>: 409 and the sentence of a row somebody answered first. A decision that took the
	 * row's absence for the picture having changed would say „Slika je promenjena…", and one that
	 * did not look would write a decision into nothing and answer 500 or 200.
	 */
	@ParameterizedTest
	@ValueSource(booleans = {true, false})
	void aDecisionStoppedBehindTheRemovalIsToldTheRowWasAlreadyDecided(boolean approved)
			throws Exception {

		Member he = aMember();
		Waiting waiting = aPictureWaitsFor(he);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<Answer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update")
						.param(waiting.row()).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db)).as("nothing has been submitted yet").isZero();

				submitted.add(pool.submit(() -> remove(he)));

				untilStopped(1);

				submitted.add(pool.submit(() -> decide(waiting, approved)));

				untilStopped(2);

				assertThat(submitted)
						.as("a request was answered while the row was held, so it never met the lock"
								+ " this case is written to make it meet")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			Answer removed = submitted.get(0).get(30, TimeUnit.SECONDS);
			Answer decided = submitted.get(1).get(30, TimeUnit.SECONDS);

			assertThat(removed.status()).as("the removal: %s", removed).isEqualTo(200);
			assertThat(decided.status())
					.as("a decision on a row that was taken back was carried out, or fell over on it:"
							+ " %s", decided)
					.isEqualTo(409);
			assertThat(mapper.readTree(decided.body()).path("reason").asString())
					.isEqualTo(SOMEBODY_ANSWERED_IT_ALREADY);

			assertThat(db.sql("select count(*) from verification where id = ?").param(waiting.row())
					.query(Long.class).single())
					.as("the row is still in the table: the decision wrote it, or the removal did not"
							+ " take it")
					.isZero();
			nothingWasWrittenAboutHim(he);
			assertThat(Files.exists(PHOTOS.resolve(String.valueOf(waiting.photo()))))
					.as("the file of the picture he took back is still on the disk")
					.isFalse();
		}
		finally {
			pool.shutdownNow();
		}
	}

	/* ------------------------------------------------------------------------------------------
	   A REMOVAL IS STOPPED BEHIND A DECISION
	   ------------------------------------------------------------------------------------------ */

	/**
	 * A REMOVAL STOPPED BEHIND A DECISION LEAVES THE DECISION WHERE IT IS, AND TAKES DOWN WHAT AN
	 * APPROVAL PUBLISHED.
	 *
	 * <p>The row is held from the test; the decision is sent and stopped at the row, and then the
	 * removal is sent and stopped behind it. The decision commits first. <b>What the removal does
	 * next is the whole of the case:</b> it re-reads the row under the lock, finds a row that is no
	 * longer waiting, and withdraws nothing. If it was approved the picture now stands on the
	 * profile, and the removal reads the profile AFTER the lock, so it takes that picture down as
	 * well, which is what „Ukloni sliku" means to a member whose picture was approved a moment
	 * before he pressed it.
	 *
	 * <p><b>The mutation this is written against is the missing {@code for update} in
	 * {@code theOneThatWaits}.</b> The removal then reads a row that is still waiting in its
	 * snapshot, and its delete, which is keyed to the row alone, removes the DECIDED row once the
	 * hold is let go: the record of who decided what, and (for a refusal) the only trace that the
	 * member was sent a reason. The row is asked for by its key and its state, for both answers.
	 */
	@ParameterizedTest
	@ValueSource(booleans = {true, false})
	void aRemovalStoppedBehindADecisionLeavesTheDecisionWhereItIs(boolean approved) throws Exception {
		Member he = aMember();
		Waiting waiting = aPictureWaitsFor(he);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<Answer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update")
						.param(waiting.row()).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db)).as("nothing has been submitted yet").isZero();

				submitted.add(pool.submit(() -> decide(waiting, approved)));

				untilStopped(1);

				submitted.add(pool.submit(() -> remove(he)));

				untilStopped(2);

				assertThat(submitted)
						.as("a request was answered while the row was held, so it never met the lock"
								+ " this case is written to make it meet")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			Answer decided = submitted.get(0).get(30, TimeUnit.SECONDS);
			Answer removed = submitted.get(1).get(30, TimeUnit.SECONDS);

			assertThat(decided.status()).as("the decision: %s", decided).isEqualTo(200);
			assertThat(removed.status()).as("the removal: %s", removed).isEqualTo(200);

			assertThat(db.sql("select state from verification where id = ?").param(waiting.row())
					.query(String.class).optional())
					.as("the decided row is not in the table as the decision left it: the removal"
							+ " deleted a row that was no longer waiting")
					.contains(approved ? "approved" : "rejected");
			assertThat(db.sql("select photo_id from competitor where id = ?").param(he.id())
					.query(Long.class).optional())
					.as("a picture still stands on the profile of a member who took his down after it"
							+ " was approved")
					.isEmpty();
			assertThat(db.sql("select count(*) from message where to_id = ?").param(he.id())
					.query(Long.class).single())
					.as("the member's inbox does not say what the decision did")
					.isEqualTo(approved ? 0L : 1L);

			if (approved) {
				assertThat(Files.exists(PHOTOS.resolve(String.valueOf(waiting.photo()))))
						.as("the file of the picture the approval published is still on the disk after"
								+ " the member took it down")
						.isFalse();
			}
		}
		finally {
			pool.shutdownNow();
		}
	}

	/* ------------------------------------------------------------------------------------------
	   WHAT NOTHING MAY HAVE LEFT
	   ------------------------------------------------------------------------------------------ */

	/** No message to him, no picture on his profile, and no row of his in the queue. */
	private void nothingWasWrittenAboutHim(Member he) {
		assertThat(db.sql("select count(*) from message where to_id = ?").param(he.id())
				.query(Long.class).single())
				.as("he was written to about a picture he took back himself")
				.isZero();
		assertThat(db.sql("select photo_id from competitor where id = ?").param(he.id())
				.query(Long.class).optional())
				.as("a picture was published on the profile of a member who took it back")
				.isEmpty();
		assertThat(db.sql("select count(*) from verification where competitor_id = ?")
				.param(he.id()).query(Long.class).single())
				.as("a row of his is in the queue")
				.isZero();
	}

	private long filesOnTheDisk() throws IOException {
		try (Stream<Path> there = Files.list(PHOTOS)) {
			return there.count();
		}
	}

	/**
	 * Polled rather than assumed, and rooted at the holding connection
	 * ({@link BlockedBehindThisHold}): a fixed sleep either releases the row before the request has
	 * reached the lock, which is the flakiness the forced cases exist to remove, or waits for
	 * nothing. The precedent's own wait asks for one request or for two arriving together; these
	 * cases send the second only once the first is stopped, so they ask for one number at a time.
	 */
	private void untilStopped(int wanted) {
		Instant deadline = Instant.now().plusSeconds(10);

		while (BlockedBehindThisHold.count(db) < wanted) {
			if (Instant.now().isAfter(deadline)) {
				throw new IllegalStateException(wanted + " requests should have been stopped behind"
						+ " the held row within ten seconds, and the lock manager never showed that"
						+ " many behind this connection");
			}

			try {
				Thread.sleep(25);
			}
			catch (InterruptedException interrupted) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException(interrupted);
			}
		}
	}

	/* ------------------------------------------------------------------------------------------
	   THE REQUESTS
	   ------------------------------------------------------------------------------------------ */

	private Answer remove(Member who) {
		return asked(() -> http.perform(delete("/api/me/photo").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, who.session().secret())))
				.andReturn().getResponse());
	}

	private Answer send(Member who, byte[] bytes) {
		return asked(() -> {
			MockMultipartHttpServletRequestBuilder asking = multipart("/api/me/photo");

			asking.file(new MockMultipartFile("picture", "portret.jpg", "image/jpeg", bytes));
			asking.param("cropX", "0.25");
			asking.param("cropY", "0.75");
			asking.param("cropSize", "0.5");

			return http.perform(asking.with(csrf())
							.cookie(new Cookie(SessionCookie.NAME, who.session().secret())))
					.andReturn().getResponse();
		});
	}

	private Answer decide(Waiting waiting, boolean approved) {
		String body = "{\"approved\":" + approved
				+ (approved ? "" : ",\"reason\":\"" + THE_REASON + "\"")
				+ ",\"seenPhotoId\":" + waiting.photo() + ",\"seenCrop\":" + THE_CIRCLE_HE_SAW + "}";

		return asked(() -> http.perform(post("/api/verification/" + waiting.row() + "/decision")
						.with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, theModerator()))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andReturn().getResponse());
	}

	@FunctionalInterface
	private interface Asking {
		MockHttpServletResponse go() throws Exception;
	}

	/** What a request came back with, or the exception that came out of the dispatcher instead. */
	private static Answer asked(Asking asking) {
		try {
			MockHttpServletResponse answer = asking.go();

			return new Answer(answer.getStatus(), answer.getContentAsString(), null);
		}
		catch (Exception failed) {
			Throwable root = failed;

			while (root.getCause() != null) {
				root = root.getCause();
			}

			return new Answer(-1, "", failed.getClass().getSimpleName() + " / "
					+ root.getClass().getSimpleName() + ": " + root.getMessage());
		}
	}

	/* ------------------------------------------------------------------------------------------
	   THE FIXTURE
	   ------------------------------------------------------------------------------------------ */

	/** One member, an account for him and a session, with nothing waiting and nothing standing. */
	private Member aMember() {
		int n = ISSUED.incrementAndGet();
		String address = "povucena-slika-" + n + "@primer.rs";

		long id = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Povukao', 'Povukaovic', 'M', date '1990-05-05',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(String.format("0011%02d", n), String.format("%016x", 0xb265000000000000L + n))
				.query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Roditelj', 'Roditeljevic', ?, (select id from role where code = 'competitor'), ?)")
				.params(address, id).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(address, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		Member made = new Member(id, address, session);

		members.add(made);

		return made;
	}

	/** A picture of his in front of a moderator, with its file on the disk. */
	private Waiting aPictureWaitsFor(Member he) throws IOException {
		long photo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 1000, ?, 0.3, 0.7, 0.45) returning id")
				.param(String.format("%064x", 0xb265L * 1_000_000 + ISSUED.incrementAndGet()))
				.query(Long.class).single();

		pictures.add(photo);

		long row = db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values ('profiles', ?, 'Slika koja ceka', '', ?) returning id")
				.params(he.id(), photo)
				.query(Long.class).single();

		Files.write(PHOTOS.resolve(String.valueOf(photo)), aJpeg("slika koja ceka"));

		return new Waiting(row, photo);
	}

	/** The session of a moderator who holds the profiles queue and nothing else, made once. */
	private String theModerator() {
		if (!theModeratorExists) {
			db.sql("insert into account (first_name, last_name, email, role_id) values"
							+ " ('Probni', 'Probic', ?, (select id from role where code = 'moderator'))")
					.param(THE_MODERATOR).update();
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), 'queue:profiles')")
					.param(THE_MODERATOR).update();

			SecretToken token = SecretToken.fresh();
			Instant now = Instant.now();

			db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
							+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
					.params(THE_MODERATOR, token.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
							Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
					.update();

			moderatorSession = token.secret();
			theModeratorExists = true;
		}

		return moderatorSession;
	}

	/** A JPEG as far as the portal reads one: its three first bytes, then whatever the case says. */
	private static byte[] aJpeg(String tail) {
		byte[] head = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };
		byte[] rest = tail.getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[head.length + rest.length];

		System.arraycopy(head, 0, whole, 0, head.length);
		System.arraycopy(rest, 0, whole, head.length, rest.length);

		return whole;
	}
}
