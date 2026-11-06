package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
 * THE ADMINISTRATION SETTING OR TAKING DOWN A MEMBER'S PICTURE WHILE A MODERATOR DECIDES THE ONE THAT
 * WAITS ({@link MemberPictureAndWordsApi}; ADL A42 point 2: a row in the queue stands for ever, approved
 * or refused).
 *
 * <p>The row is held from the test, the decision is sent and stopped at it, and then the
 * administration's request is sent and stopped behind the decision. The decision commits first. <b>What
 * the request does next is the whole of the case:</b> the row it was going to delete no longer waits, and
 * it has to leave the row as the decision left it. It is the case
 * {@code APictureTakenBackWhileItIsBeingDecidedOrSentTest.aRemovalStoppedBehindADecisionLeavesTheDecisionWhereItIs}
 * measures for the member's own removal, written for the two doors of the administration.
 *
 * <p><b>The mutation this is written against is the missing {@code for update}</b> in the subquery of the
 * two deletes ({@code MemberPictureAndWordsApi.THE_ROW_OF_HIS_THAT_WAITS_UNDER_LOCK}). Without it the
 * delete removes the decided row by its key once the hold is let go, and for a removal after a refusal
 * the member is also told his picture was taken down, because the deleted row is counted as one that
 * waited. The case is run for both doors and for both answers.
 *
 * <p>The member holds no account here: the doors under test do not ask who he is, only that the number
 * names a member who is not the one asking.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AnAdministratorSettingOrTakingDownAPictureWhileItIsBeingDecidedTest {

	private static final String THE_REASON = "Slika je mutna, posalji ostriju";

	private static final String THE_CIRCLE_HE_SAW = "{\"x\":0.3,\"y\":0.7,\"size\":0.45}";

	private static final String THE_MODERATOR = "odlucuje-slika-moderator@primer.rs";

	private static final String THE_ADMINISTRATOR = "odlucuje-slika-administracija@primer.rs";

	private static final String THE_REMOVAL_SUBJECT = "Uklonjena je vaša profilna slika";

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-administration-");
		}
		catch (IOException noFolder) {
			throw new UncheckedIOException(noFolder);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	private static final AtomicInteger ISSUED = new AtomicInteger();

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holdingTheRow;

	private final List<Long> members = new ArrayList<>();

	private final List<Long> pictures = new ArrayList<>();

	private final List<String> addresses = new ArrayList<>();

	private final Map<String, String> sessions = new HashMap<>();

	private record Member(long id, String number) {
	}

	private record Waiting(long row, long photo) {
	}

	private record Answer(int status, String body, String threw) {
	}

	@AfterEach
	void nothingOfItIsLeftBehind() throws IOException {
		for (long made : members) {
			db.sql("delete from verification_lock where verification_id in (select id from"
					+ " verification where competitor_id = ?)").param(made).update();
			db.sql("delete from message where to_id = ?").param(made).update();
			db.sql("delete from verification where competitor_id = ?").param(made).update();
			db.sql("delete from competitor where id = ?").param(made).update();
		}

		for (long one : pictures) {
			db.sql("delete from photo where id = ?").param(one).update();
		}

		for (String address : addresses) {
			db.sql("delete from account where email = ?").param(address).update();
		}

		try (Stream<Path> there = Files.list(PHOTOS)) {
			for (Path file : there.toList()) {
				Files.deleteIfExists(file);
			}
		}
	}

	/**
	 * Four cases: the door (a picture set, a picture taken down) and the answer the moderator gives. What
	 * a member is told is asked for in each, since the counting of the deleted row is where the removal
	 * after a refusal goes wrong.
	 */
	@ParameterizedTest(name = "{0} after a decision of approved={1}")
	@CsvSource({"remove,true", "remove,false", "set,true", "set,false"})
	void anAdministrationRequestStoppedBehindADecisionLeavesTheDecisionWhereItIs(String door, boolean approved)
			throws Exception {

		boolean removing = door.equals("remove");
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

				submitted.add(pool.submit(() -> removing ? remove(he) : set(he)));

				untilStopped(2);

				assertThat(submitted)
						.as("a request was answered while the row was held, so it never met the lock"
								+ " this case is written to make it meet")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			Answer decided = submitted.get(0).get(30, TimeUnit.SECONDS);
			Answer administered = submitted.get(1).get(30, TimeUnit.SECONDS);

			assertThat(decided.status()).as("the decision: %s", decided).isEqualTo(200);
			assertThat(administered.status()).as("the administration: %s", administered).isEqualTo(200);

			assertThat(db.sql("select state from verification where id = ?").param(waiting.row())
					.query(String.class).optional())
					.as("the decided row is not in the table as the decision left it: the administration"
							+ " deleted a row that was no longer waiting")
					.contains(approved ? "approved" : "rejected");

			Long standing = db.sql("select photo_id from competitor where id = ?").param(he.id())
					.query(Long.class).optional().orElse(null);

			if (removing) {
				assertThat(standing)
						.as("a picture still stands on the profile after the administration took it down")
						.isNull();
			}
			else {
				assertThat(standing)
						.as("the picture the administration set does not stand")
						.isNotNull().isNotEqualTo(waiting.photo());
				pictures.add(standing);
			}

			long removalMessages = db.sql("select count(*) from message where to_id = ? and subject = ?")
					.params(he.id(), THE_REMOVAL_SUBJECT).query(Long.class).single();

			/* Taken down after a refusal there was nothing of his to take down: no picture stood and the
			   row that waited had been answered. After an approval the picture the approval published is
			   what comes down, and he is rightly told so. */
			assertThat(removalMessages)
					.as("he is told his picture was taken down, or is not told when it was")
					.isEqualTo(removing && approved ? 1L : 0L);

			/* The refusal is the decision's message and the set is the administration's. */
			long expected = removing ? 1L : (approved ? 1L : 2L);

			assertThat(db.sql("select count(*) from message where to_id = ?").param(he.id())
					.query(Long.class).single())
					.as("what he was written to does not add up to the decision and the administration's"
							+ " own act")
					.isEqualTo(expected);
		}
		finally {
			pool.shutdownNow();
		}
	}

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

	private Answer remove(Member he) {
		return asked(() -> http.perform(delete("/api/members/" + he.number() + "/photo").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, session(THE_ADMINISTRATOR, "entity:members"))))
				.andReturn().getResponse());
	}

	private Answer set(Member he) {
		return asked(() -> {
			MockMultipartHttpServletRequestBuilder asking = multipart("/api/members/" + he.number() + "/photo");

			asking.file(new MockMultipartFile("picture", "portret.jpg", "image/jpeg",
					aJpeg("slika administracije")));
			asking.param("cropX", "0.25");
			asking.param("cropY", "0.75");
			asking.param("cropSize", "0.5");

			return http.perform(asking.with(csrf())
							.cookie(new Cookie(SessionCookie.NAME, session(THE_ADMINISTRATOR, "entity:members"))))
					.andReturn().getResponse();
		});
	}

	private Answer decide(Waiting waiting, boolean approved) {
		String body = "{\"approved\":" + approved
				+ (approved ? "" : ",\"reason\":\"" + THE_REASON + "\"")
				+ ",\"seenPhotoId\":" + waiting.photo() + ",\"seenCrop\":" + THE_CIRCLE_HE_SAW + "}";

		return asked(() -> http.perform(post("/api/verification/" + waiting.row() + "/decision")
						.with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, session(THE_MODERATOR, "queue:profiles")))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andReturn().getResponse());
	}

	@FunctionalInterface
	private interface Asking {
		MockHttpServletResponse go() throws Exception;
	}

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

	/** A moderator holding one right, made on first use and signed in for the rest of the case. */
	private synchronized String session(String address, String right) {
		String known = sessions.get(address);

		if (known != null) {
			return known;
		}

		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'moderator'))")
				.param(address).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(address, right).update();

		SecretToken token = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(address, token.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		addresses.add(address);
		sessions.put(address, token.secret());

		return token.secret();
	}

	private Member aMember() {
		int n = ISSUED.incrementAndGet();
		String number = String.format("0013%02d", n);

		long id = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Odlucen', 'Odlucenovic', 'M', date '1990-05-05',"
						+ " (select id from place where rank = 1), 2027, ?, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, String.format("%016x", 0xb302000000000000L + n))
				.query(Long.class).single();

		members.add(id);

		return new Member(id, number);
	}

	private Waiting aPictureWaitsFor(Member he) throws IOException {
		long photo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 1000, ?, 0.3, 0.7, 0.45) returning id")
				.param(String.format("%064x", 0xb302L * 1_000_000 + ISSUED.incrementAndGet()))
				.query(Long.class).single();

		pictures.add(photo);

		long row = db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values ('profiles', ?, 'Slika koja ceka', '', ?) returning id")
				.params(he.id(), photo)
				.query(Long.class).single();

		Files.write(PHOTOS.resolve(String.valueOf(photo)), aJpeg("slika koja ceka"));

		return new Waiting(row, photo);
	}

	private static byte[] aJpeg(String tail) {
		byte[] head = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };
		byte[] rest = tail.getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[head.length + rest.length];

		System.arraycopy(head, 0, whole, 0, head.length);
		System.arraycopy(rest, 0, whole, head.length, rest.length);

		return whole;
	}
}
