package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A CIRCLE THAT WOULD COST SECONDS TO READ IS REFUSED AT ONCE, AT BOTH DOORS, OVER A REAL SOCKET, AND NO
 * CONNECTION IS HELD WHILE IT IS.
 *
 * <p><b>The finding</b>, from the security review of PR 688: {@code MePhotoApi.fraction} parsed whatever
 * arrived, and both {@code POST /api/me/photo} (a member) and {@code POST /api/members/{number}/photo} (the
 * administration) read their three fractions through it inside a {@code @Transactional} mapping, after the
 * first statements have run. A request of a million and a half digits was measured at about 25 s, and ten in
 * parallel take the pool. Measuring the fix found the second road: {@code 1E-99999999}, eleven characters,
 * 79,6 s in {@code setScale}.
 *
 * <p><b>What is asked, of each door and each road:</b> the answer is the refusal the portal already had,
 * 400 with {@code theCropIsNotACircle}; it arrives in under a second; and while it is on its way no backend
 * of the database has been {@code idle in transaction} for longer than {@value #HELD_TOO_LONG_MS} ms. That
 * last is what the pool is: a connection whose transaction has begun and which waits on the server's own
 * code. A correct request is in that state too, for the microseconds between its own statements, so the
 * literal „never" would fail a correct server by sampling luck; held for longer than a fifth of a second is
 * the fault, and the mutation that puts it back holds it for seconds.
 *
 * <p>{@code pg_stat_activity} is asked the way {@code BlockedBehindThisHold} learned to: the snapshot is
 * cleared first and nothing is read through a transaction, so every poll sees the backends as they are.
 *
 * <p>The wait for the answer is an assertion and not a timeout: a server that has not answered in
 * {@value #WAITED_S} s fails on this case's own sentence.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class ACircleThatCostsTooMuchIsRefusedAtOnceOverRealHttpTest {

	private static final String A_TOKEN = "11111111-2222-3333-4444-555555555555";

	private static final String A_MEMBER = "b306-krug-clan@primer.rs";

	private static final String SUPERADMIN = "b306-krug-superadmin@primer.rs";

	private static final String THE_MEMBERS_NUMBER = "993061";

	private static final long HELD_TOO_LONG_MS = 200;

	private static final long WAITED_S = 5;

	private static final long UNDER_A_SECOND_MS = 1000;

	private static final String MILLIONS_OF_DIGITS = "0." + "5".repeat(1_500_000);

	private static final String AN_ENORMOUS_SCALE = "1E-99999999";

	private static final String BOUNDARY = "b306-krug";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	private final Map<String, String> sessions = new LinkedHashMap<>();

	private final HttpClient client = HttpClient.newHttpClient();

	@BeforeEach
	void aMemberAndAnAdministrator() {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(THE_MEMBERS_NUMBER, String.format("%016x", Long.parseLong(THE_MEMBERS_NUMBER)))
				.update();
		HeldOn.activeAt(db, THE_MEMBERS_NUMBER, ZonedDateTime.now());

		account(A_MEMBER, "competitor");
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(THE_MEMBERS_NUMBER, A_MEMBER).update();
		account(SUPERADMIN, "superadmin");
	}

	@AfterEach
	void takeThemBackOut() {
		for (String email : sessions.keySet()) {
			db.sql("delete from account where email = ?").param(email).update();
		}

		db.sql("delete from competitor where member_number = ?").param(THE_MEMBERS_NUMBER).update();
	}

	@Test
	void aMemberSendingMillionsOfDigitsIsRefusedAtOnce() throws Exception {
		refusedAtOnce(A_MEMBER, "/api/me/photo", MILLIONS_OF_DIGITS);
	}

	@Test
	void aMemberSendingAnEnormousScaleIsRefusedAtOnce() throws Exception {
		refusedAtOnce(A_MEMBER, "/api/me/photo", AN_ENORMOUS_SCALE);
	}

	@Test
	void theAdministrationSendingMillionsOfDigitsIsRefusedAtOnce() throws Exception {
		refusedAtOnce(SUPERADMIN, "/api/members/" + THE_MEMBERS_NUMBER + "/photo", MILLIONS_OF_DIGITS);
	}

	@Test
	void theAdministrationSendingAnEnormousScaleIsRefusedAtOnce() throws Exception {
		refusedAtOnce(SUPERADMIN, "/api/members/" + THE_MEMBERS_NUMBER + "/photo", AN_ENORMOUS_SCALE);
	}

	private void refusedAtOnce(String who, String path, String cropX) throws Exception {
		HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
				.header("Content-Type", "multipart/form-data; boundary=" + BOUNDARY)
				.header("Cookie", "XSRF-TOKEN=" + A_TOKEN + "; " + SessionCookie.NAME + "=" + sessions.get(who))
				.header("X-XSRF-TOKEN", A_TOKEN)
				.POST(HttpRequest.BodyPublishers.ofByteArray(aBody(cropX)))
				.build();

		AtomicInteger heldTooLong = new AtomicInteger();
		Timestamp sentAt = db.sql("select clock_timestamp()").query(Timestamp.class).single();
		long from = System.nanoTime();
		CompletableFuture<HttpResponse<String>> sent = client.sendAsync(request,
				HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
		HttpResponse<String> answer = null;

		while (answer == null && System.nanoTime() - from < TimeUnit.SECONDS.toNanos(WAITED_S)) {
			heldTooLong.accumulateAndGet(backendsHeldTooLong(sentAt), Math::max);

			try {
				answer = sent.get(20, TimeUnit.MILLISECONDS);
			} catch (TimeoutException notYet) {
				/* asked again on the next turn */
			}
		}

		long tookMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - from);
		heldTooLong.accumulateAndGet(backendsHeldTooLong(sentAt), Math::max);

		assertThat(answer)
				.as("%s did not answer a circle of %s characters in %s s, so it is reading it at the cost of a"
						+ " thread and a connection", path, cropX.length(), WAITED_S)
				.isNotNull();
		assertThat(heldTooLong.get())
				.as("a backend stood idle in transaction for longer than %s ms while %s read the circle, so the"
						+ " connection was held for the parse", HELD_TOO_LONG_MS, path)
				.isZero();
		assertThat(answer.statusCode()).as(answer.body()).isEqualTo(400);
		assertThat(answer.body()).contains(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		assertThat(tookMs).as("the refusal took %s ms", tookMs).isLessThan(UNDER_A_SECOND_MS);
	}

	/**
	 * Backends idle in a transaction that began after this request was sent, for longer than the bound. A
	 * transaction older than the request is somebody else's - under a mutation, the request of the case before
	 * this one, still being parsed - and counting it would make this case measure its neighbour.
	 */
	private int backendsHeldTooLong(Timestamp sentAt) {
		db.sql("select pg_stat_clear_snapshot()::text").query(String.class).single();
		return db.sql("select count(*)::int from pg_stat_activity where state = 'idle in transaction'"
						+ " and pid <> pg_backend_pid() and xact_start >= ?"
						+ " and clock_timestamp() - state_change > make_interval(secs => ?)")
				.params(sentAt, HELD_TOO_LONG_MS / 1000.0)
				.query(Integer.class)
				.single();
	}

	/** A picture that only begins like one, which is all either door looks at before the circle, and the circle. */
	private static byte[] aBody(String cropX) {
		ByteArrayOutputStream body = new ByteArrayOutputStream();
		body.writeBytes(("--" + BOUNDARY + "\r\nContent-Disposition: form-data; name=\"picture\";"
				+ " filename=\"slika.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n").getBytes(StandardCharsets.UTF_8));
		body.writeBytes(new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 'b', '3', '0', '6' });
		body.writeBytes("\r\n".getBytes(StandardCharsets.UTF_8));

		for (Map.Entry<String, String> part : Map.of("cropX", cropX, "cropY", "0.5", "cropSize", "0.5").entrySet()) {
			body.writeBytes(("--" + BOUNDARY + "\r\nContent-Disposition: form-data; name=\"" + part.getKey()
					+ "\"\r\n\r\n" + part.getValue() + "\r\n").getBytes(StandardCharsets.UTF_8));
		}

		body.writeBytes(("--" + BOUNDARY + "--\r\n").getBytes(StandardCharsets.UTF_8));
		return body.toByteArray();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

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
