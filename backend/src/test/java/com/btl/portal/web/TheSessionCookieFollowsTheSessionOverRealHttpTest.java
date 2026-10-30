package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.token.SecretToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import javax.sql.DataSource;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE COOKIE THE BROWSER HOLDS ENDS WHEN THE SESSION THE SERVER HOLDS ENDS (PDL 29.10.2026,
 * „Kolačić sesije se obnavlja kad server produži sesiju").
 *
 * <p>The privacy policy promises „najduže 30 dana od kada ste poslednji put koristili
 * portal". The server keeps that promise on its own side: a session runs thirty days from the
 * last time it was written down. The browser kept a different promise, because the cookie was
 * handed out once, at signing in, with an age of thirty days, and never again. A member who came
 * back every week was still thrown out thirty days after signing in.
 *
 * <p>So the answer to the request that renews a session carries the cookie again, and no other
 * answer does. Over a real socket, because the question is what is on the wire: which
 * {@code Set-Cookie} lines an answer carries, how many of them name the session, and what each
 * of them holds.
 *
 * <p><b>Two sessions of two accounts are open in every case, and both are due for renewal.</b>
 * The value in the answer has two places it could come from, the session that arrived with the
 * request and any other that is open, and with only one session open a cookie taken from the
 * wrong one would look exactly like a cookie taken from the right one.
 *
 * <p><b>And the renewal is decided when the answer is committed, not before the route runs</b>
 * ({@link OneSessionCookie}): an answer a cache may keep renews nothing, a route that sets the
 * session's cookie itself is the only one to do so, and a row that is gone by then gets no cookie.
 * Each of those has a case here, over the same socket.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class TheSessionCookieFollowsTheSessionOverRealHttpTest {

	/** A picture a team holds, so anybody may be answered it, under a name of its own. */
	private static final String A_DIGEST = "b278".repeat(16);

	private static final Path FOLDER = aFolderOfItsOwn();

	@DynamicPropertySource
	static void whereThePicturesAre(DynamicPropertyRegistry settings) {
		settings.add("btl.photos.folder", FOLDER::toString);
	}

	private static Path aFolderOfItsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-cookie-case");
		} catch (java.io.IOException cannot) {
			throw new java.io.UncheckedIOException(cannot);
		}
	}

	@Autowired
	private DataSource pool;

	private static final String MINE = "kolacic-prvi@primer.rs";

	private static final String SOMEBODY_ELSE = "kolacic-drugi@primer.rs";

	private static final String RIGHT = "dvanaest1234sasvim";

	private static final String TOKEN_COOKIE = "XSRF-TOKEN";

	private static final String TOKEN_HEADER = "X-XSRF-TOKEN";

	/** Thirty days, written as a number on purpose: the code under test computes it from a constant. */
	private static final String THIRTY_DAYS = "Max-Age=2592000";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	private final HttpClient client = HttpClient.newHttpClient();

	private SecretToken mineDueForRenewal;

	private SecretToken hersDueForRenewal;

	@BeforeEach
	void twoAccountsAndAStaleSessionForEach() throws Exception {
		forget();

		account(MINE);
		account(SOMEBODY_ELSE);

		mineDueForRenewal = open(MINE, Duration.ofDays(2), Duration.ofDays(28));
		hersDueForRenewal = open(SOMEBODY_ELSE, Duration.ofDays(2), Duration.ofDays(28));
	}

	@AfterEach
	void forget() throws Exception {
		try (java.util.stream.Stream<Path> files = Files.list(FOLDER)) {
			for (Path one : files.toList()) {
				Files.delete(one);
			}
		}

		db.sql("delete from team where slug = 'b278-tim-sa-slikom'").update();
		db.sql("delete from photo where digest = ?").param(A_DIGEST).update();
		db.sql("delete from password_reset_token where account_id in"
						+ " (select id from account where email in (?, ?))")
				.params(MINE, SOMEBODY_ELSE).update();
		db.sql("delete from account_session where account_id in"
						+ " (select id from account where email in (?, ?))")
				.params(MINE, SOMEBODY_ELSE).update();
		db.sql("delete from account where email in (?, ?)").params(MINE, SOMEBODY_ELSE).update();
	}

	private void account(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id, password_hash,"
						+ " email_confirmed_at) values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = 'competitor'), ?, now())")
				.params(email, new StoredPassword().of(RIGHT))
				.update();
	}

	/** A session last used {@code ago} ago that runs out {@code left} from now. */
	private SecretToken open(String email, Duration ago, Duration left) {
		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(ago).minus(Duration.ofDays(1))),
						Timestamp.from(now.minus(ago)), Timestamp.from(now.plus(left)))
				.update();

		return session;
	}

	private Instant endsFor(SecretToken session) {
		return db.sql("select expires_at from account_session where token_hash = ?")
				.param(session.hash()).query(Timestamp.class).single().toInstant();
	}

	private boolean stillOpen(SecretToken session) {
		return db.sql("select count(*) from account_session where token_hash = ?")
				.param(session.hash()).query(Integer.class).single() == 1;
	}

	private HttpResponse<String> get(String path, String cookies) throws Exception {
		HttpRequest.Builder asking = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET();

		if (cookies != null) {
			asking.header("Cookie", cookies);
		}

		return client.send(asking.build(), HttpResponse.BodyHandlers.ofString());
	}

	private HttpResponse<String> me(String cookies) throws Exception {
		return get("/api/me", cookies);
	}

	private static String carrying(SecretToken session) {
		return SessionCookie.NAME + "=" + session.secret();
	}

	/** A token handed out to somebody who is not signed in, which is what a browser would echo. */
	private String aToken() throws Exception {
		return handedOut(get("/api/places", null), TOKEN_COOKIE).orElseThrow();
	}

	private HttpResponse<String> post(String path, String cookies, String token, String body) throws Exception {
		return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
						.header("Content-Type", "application/json")
						.header("Cookie", cookies)
						.header(TOKEN_HEADER, token)
						.POST(HttpRequest.BodyPublishers.ofString(body))
						.build(),
				HttpResponse.BodyHandlers.ofString());
	}

	private HttpResponse<String> signOut(SecretToken session) throws Exception {
		String token = aToken();

		return post("/api/sign-out", TOKEN_COOKIE + "=" + token + "; " + carrying(session), token, "");
	}

	/** Every {@code Set-Cookie} line of an answer that names the session, and none that does not. */
	private static List<String> aboutTheSession(HttpResponse<?> answer) {
		return answer.headers().allValues("set-cookie").stream()
				.filter(SessionCookie::isOne)
				.toList();
	}

	/** The names of every cookie an answer sets, sorted, so two answers can be set side by side. */
	private static List<String> namesSet(HttpResponse<?> answer) {
		return answer.headers().allValues("set-cookie").stream()
				.map(one -> one.split("=", 2)[0])
				.sorted().toList();
	}

	private static java.util.Optional<String> handedOut(HttpResponse<?> answer, String name) {
		return answer.headers().allValues("set-cookie").stream()
				.filter(one -> one.startsWith(name + "="))
				.map(one -> one.substring(name.length() + 1).split(";", 2)[0])
				.findFirst();
	}

	private static String valueOf(String setCookie) {
		return setCookie.substring(setCookie.indexOf('=') + 1).split(";", 2)[0];
	}

	/**
	 * Everything after the value, in order, without {@code Expires}. That one is a date
	 * counted from the moment of the answer, so it differs between any two answers and says
	 * nothing the age does not already say.
	 */
	private static List<String> attributesOf(String setCookie) {
		return Arrays.stream(setCookie.split(";")).skip(1).map(String::trim)
				.filter(one -> !one.startsWith("Expires=")).toList();
	}

	/**
	 * A SESSION NOT USED FOR A DAY IS HANDED BACK ITS COOKIE, WITH ITS OWN VALUE.
	 *
	 * <p>The value is the secret that arrived, checked against the other member's, and the
	 * attributes are the ones signing in gives (the case below compares them with a real
	 * sign in). Asked once by each of the two, so a value taken from "the other session that
	 * is open" fails whichever of them asks.
	 */
	@Test
	void aSessionDueForRenewalIsHandedItsOwnCookieAgain() throws Exception {
		Instant endedBefore = endsFor(mineDueForRenewal);

		HttpResponse<String> mine = me(carrying(mineDueForRenewal));

		assertThat(mine.statusCode()).isEqualTo(200);
		assertThat(endsFor(mineDueForRenewal)).as("the row was not renewed, so this measures nothing")
				.isAfter(endedBefore);
		assertThat(aboutTheSession(mine))
				.as("an answer that renews the session must carry its cookie, once")
				.hasSize(1);
		assertThat(valueOf(aboutTheSession(mine).get(0)))
				.as("the cookie handed back holds a secret other than the one that arrived")
				.isEqualTo(mineDueForRenewal.secret())
				.isNotEqualTo(hersDueForRenewal.secret());
		assertThat(attributesOf(aboutTheSession(mine).get(0)))
				.as("the cookie is not the one signing in hands out")
				.containsExactly("Path=/", THIRTY_DAYS, "Secure", "HttpOnly", "SameSite=Strict");
		assertThat(mine.headers().allValues("cache-control"))
				.as("an answer that carries the secret does not forbid a cache to keep it")
				.anyMatch(one -> one.contains("no-store"));

		HttpResponse<String> hers = me(carrying(hersDueForRenewal));

		assertThat(aboutTheSession(hers)).hasSize(1);
		assertThat(valueOf(aboutTheSession(hers).get(0)))
				.as("the second member was handed the first member's session")
				.isEqualTo(hersDueForRenewal.secret())
				.isNotEqualTo(mineDueForRenewal.secret());
	}

	/**
	 * THE COOKIE IT HANDS BACK IS THE ONE SIGNING IN HANDS OUT, attribute for attribute.
	 *
	 * <p>Compared with a real sign in rather than with the class that builds both, because a
	 * test that asks the class for the expected value is satisfied by whatever the class does.
	 */
	@Test
	void andItIsTheSameCookieSigningInGivesOut() throws Exception {
		String token = aToken();
		HttpResponse<String> signedIn = post("/api/sign-in", TOKEN_COOKIE + "=" + token, token,
				"{\"email\":\"" + MINE + "\",\"password\":\"" + RIGHT + "\"}");

		assertThat(signedIn.statusCode()).isEqualTo(204);
		assertThat(aboutTheSession(signedIn)).hasSize(1);

		assertThat(attributesOf(aboutTheSession(me(carrying(mineDueForRenewal))).get(0)))
				.as("renewing hands out a different cookie from the one signing in hands out")
				.isEqualTo(attributesOf(aboutTheSession(signedIn).get(0)));
	}

	/**
	 * A SESSION USED WITHIN THE DAY IS NOT HANDED ANYTHING, and neither is one that was
	 * renewed a moment ago.
	 *
	 * <p>The second half is the same session asked twice: the first request renews it and the
	 * second finds it renewed. A cookie sent on every request of a signed in member would pass
	 * the first request of this case and fail here.
	 */
	@Test
	void aSessionUsedWithinTheDayIsHandedNothing() throws Exception {
		SecretToken justNow = open(MINE, Duration.ofMinutes(1), Duration.ofDays(30));
		Instant endedBefore = endsFor(justNow);

		HttpResponse<String> answer = me(carrying(justNow));

		assertThat(answer.statusCode()).isEqualTo(200);
		assertThat(endsFor(justNow)).as("the row was written to, so this measures nothing")
				.isEqualTo(endedBefore);
		assertThat(aboutTheSession(answer)).as("a session used a minute ago was handed its cookie").isEmpty();

		assertThat(aboutTheSession(me(carrying(mineDueForRenewal)))).hasSize(1);
		assertThat(aboutTheSession(me(carrying(mineDueForRenewal))))
				.as("the same session, asked again at once, was handed its cookie a second time")
				.isEmpty();
	}

	/**
	 * NOBODY WHO IS NOT SIGNED IN IS HANDED A SESSION COOKIE, whatever they carry.
	 *
	 * <p>No cookie, a cookie nobody has, an emptied one, a session that ended, and a real
	 * secret under a name that is not ours. Each is a different way for the code to arrive at
	 * the renewal without a session, and the cookie that would come back for the empty one is
	 * the worst of them: an empty value with an age of thirty days.
	 */
	@Test
	void nobodySignedInIsHandedNoCookie() throws Exception {
		SecretToken ended = open(MINE, Duration.ofDays(40), Duration.ofDays(-10));

		assertThat(aboutTheSession(me(null))).as("no cookie at all").isEmpty();
		assertThat(aboutTheSession(me(carrying(SecretToken.fresh())))).as("a cookie nobody has").isEmpty();
		assertThat(aboutTheSession(me(SessionCookie.NAME + "="))).as("an emptied cookie").isEmpty();
		assertThat(me(carrying(ended)).statusCode()).isEqualTo(401);
		assertThat(aboutTheSession(me(carrying(ended)))).as("a session that ended weeks ago").isEmpty();
		assertThat(aboutTheSession(me("__Host-nesto-drugo=" + mineDueForRenewal.secret())))
				.as("a real secret under a name that is not ours").isEmpty();
	}

	/**
	 * SIGNING OUT FROM A SESSION DUE FOR RENEWAL LEAVES ONE COOKIE AND IT IS THE ONE THAT ENDS.
	 *
	 * <p>The session is due, so the filter hands its renewal to the answer; the route then deletes
	 * the row and says the cookie is over. Both lines in one answer would
	 * leave a browser to choose, and the choice would be the member handed his old session back
	 * in the answer that signs him out. The XSRF cookie is compared with the same call from a
	 * session that is not due, so a replacement that threw it away would show.
	 */
	@Test
	void signingOutFromASessionDueForRenewalLeavesOneCookieAndItIsOver() throws Exception {
		SecretToken notDue = open(SOMEBODY_ELSE, Duration.ofMinutes(1), Duration.ofDays(30));
		HttpResponse<String> control = signOut(notDue);

		HttpResponse<String> answer = signOut(mineDueForRenewal);

		assertThat(answer.statusCode()).isEqualTo(204);
		assertThat(stillOpen(mineDueForRenewal)).as("the session was not ended").isFalse();
		assertThat(aboutTheSession(answer))
				.as("signing out carried more than one cookie for the session, or none")
				.hasSize(1);
		assertThat(valueOf(aboutTheSession(answer).get(0)))
				.as("signing out handed the session back instead of ending it")
				.isEmpty();
		assertThat(aboutTheSession(answer).get(0)).contains("Max-Age=0");
		assertThat(namesSet(answer)).as("signing out dropped or doubled a cookie that is not the session's")
				.isEqualTo(namesSet(control));

		HttpResponse<String> afterwards = me(carrying(mineDueForRenewal));

		assertThat(afterwards.statusCode()).as("the old cookie still opened the portal").isEqualTo(401);
		assertThat(aboutTheSession(afterwards))
				.as("the request after signing out was handed the session's cookie")
				.isEmpty();
		assertThat(stillOpen(hersDueForRenewal)).isTrue();
	}

	/**
	 * SIGNING IN WITH THE OLD COOKIE STILL ON THE REQUEST LEAVES ONE COOKIE AND IT IS THE NEW ONE.
	 *
	 * <p>The old cookie is due for renewal and its row is still there, so nothing but the route's own
	 * word stops the renewal handing it back beside the new one the route hands out. The browser
	 * must be left with the new session, and the answer must name only that.
	 */
	@Test
	void signingInOverAnOldCookieLeavesOnlyTheNewOne() throws Exception {
		String token = aToken();

		HttpResponse<String> answer = post("/api/sign-in",
				TOKEN_COOKIE + "=" + token + "; " + carrying(mineDueForRenewal), token,
				"{\"email\":\"" + MINE + "\",\"password\":\"" + RIGHT + "\"}");

		assertThat(answer.statusCode()).isEqualTo(204);
		assertThat(aboutTheSession(answer)).hasSize(1);
		assertThat(valueOf(aboutTheSession(answer).get(0)))
				.as("the answer that signs in handed back the old session")
				.isNotEmpty()
				.isNotEqualTo(mineDueForRenewal.secret())
				.isNotEqualTo(hersDueForRenewal.secret());
	}

	/**
	 * THE CSRF COOKIE IS LEFT AS IT WAS.
	 *
	 * <p>The same read, once from a session due for renewal and once from one that is not: the
	 * answers set the same cookies, except for the session's, and the ones they share are set
	 * the same way.
	 */
	@Test
	void theCsrfCookieIsNeitherDroppedNorDoubledByRenewing() throws Exception {
		SecretToken notDue = open(SOMEBODY_ELSE, Duration.ofMinutes(1), Duration.ofDays(30));

		HttpResponse<String> plain = get("/api/places", carrying(notDue));
		HttpResponse<String> renewing = get("/api/places", carrying(mineDueForRenewal));

		assertThat(handedOut(plain, TOKEN_COOKIE)).as("the control sets no token, so this measures nothing")
				.isPresent();
		assertThat(namesSet(renewing))
				.isEqualTo(java.util.stream.Stream.concat(namesSet(plain).stream(), java.util.stream.Stream.of(SessionCookie.NAME))
						.sorted().toList());
		assertThat(attributesOf(renewing.headers().allValues("set-cookie").stream()
				.filter(one -> one.startsWith(TOKEN_COOKIE + "=")).findFirst().orElseThrow()))
				.isEqualTo(attributesOf(plain.headers().allValues("set-cookie").stream()
						.filter(one -> one.startsWith(TOKEN_COOKIE + "=")).findFirst().orElseThrow()));
		assertThat(SessionLife.LASTS).as("the age written above is the session's").isEqualTo(Duration.ofDays(30));
	}

	/** A picture a team holds, with its file, which is a picture anybody may be answered. */
	private void aPictureATeamHolds() throws Exception {
		long id = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/png', 5, ?, 0.5, 0.5, 0.5) returning id")
				.param(A_DIGEST).query(Long.class).single();

		Files.write(FOLDER.resolve(String.valueOf(id)), new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x00});

		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values ('b278-tim-sa-slikom', 'Tim sa slikom', '', '',"
						+ " (select id from place where rank = 1), null, null, ?, 2027, null)")
				.param(id).update();
	}

	/**
	 * AN ANSWER A CACHE MAY KEEP RENEWS NOTHING: NOT THE COOKIE, AND NOT THE ROW EITHER (security
	 * review of PR 656, 29.10.2026).
	 *
	 * <p>A picture is served for a day, privately, and a {@code Set-Cookie} stored with it would be
	 * this member's secret handed to whoever is next served that copy. The row stays as it was too,
	 * because a row renewed without its cookie is the gap the renewal exists to close. The next
	 * answer that is not kept, a page, renews both, which is also what proves the session was due.
	 */
	@Test
	void anAnswerACacheMayKeepRenewsNeitherTheRowNorTheCookie() throws Exception {
		aPictureATeamHolds();
		Instant endedBefore = endsFor(mineDueForRenewal);

		HttpResponse<String> picture = get("/api/photos/" + A_DIGEST, carrying(mineDueForRenewal));

		assertThat(picture.statusCode()).as("the picture was not served, so this measures nothing")
				.isEqualTo(200);
		assertThat(picture.headers().allValues("cache-control"))
				.as("the picture is not an answer a cache may keep, so this measures nothing")
				.anyMatch(one -> one.contains("max-age=86400"))
				.noneMatch(one -> one.contains("no-store"));
		assertThat(aboutTheSession(picture)).as("an answer a cache may keep carried the session's secret")
				.isEmpty();
		assertThat(endsFor(mineDueForRenewal))
				.as("the row was renewed by an answer that could not carry its cookie")
				.isEqualTo(endedBefore);

		HttpResponse<String> page = me(carrying(mineDueForRenewal));

		assertThat(aboutTheSession(page)).as("the session was not due, so this measures nothing").hasSize(1);
		assertThat(endsFor(mineDueForRenewal)).isAfter(endedBefore);
	}

	/**
	 * A SESSION ENDED WHILE ITS ANSWER IS ON THE WAY IS HANDED NO COOKIE.
	 *
	 * <p>The filter finds the session and the route answers; between the two, another request ends it
	 * (signing out in another tab, a password reset). That deletion is held open here, so the renewal
	 * is written while it is pending and has to wait behind it - which is what puts it exactly in the
	 * gap - and touches no row once it commits. A cookie sent without asking how many rows were
	 * renewed would hand the browser back a session that is over.
	 */
	@Test
	void aSessionEndedWhileItsAnswerIsOnTheWayIsHandedNoCookie() throws Exception {
		ExecutorService asking = Executors.newSingleThreadExecutor();

		try (AHeldTransaction endingItElsewhere = new AHeldTransaction(pool)) {
			endingItElsewhere.db().sql("delete from account_session where token_hash = ?")
					.param(mineDueForRenewal.hash()).update();

			Future<HttpResponse<String>> answer = asking.submit(() -> me(carrying(mineDueForRenewal)));

			endingItElsewhere.untilBehind(1, List.of(answer));
			endingItElsewhere.commit();

			HttpResponse<String> answered = answer.get(30, TimeUnit.SECONDS);

			assertThat(answered.statusCode()).as("the session was not found before it ended, so this"
					+ " measures nothing").isEqualTo(200);
			assertThat(aboutTheSession(answered))
					.as("a session that ended before its renewal was written was handed its cookie")
					.isEmpty();
		} finally {
			asking.shutdownNow();
		}

		assertThat(stillOpen(mineDueForRenewal)).isFalse();
	}

	private HttpResponse<String> reset(String cookies) throws Exception {
		SecretToken link = SecretToken.fresh();

		db.sql("insert into password_reset_token (account_id, token_hash)"
						+ " values ((select id from account where email = ?), ?)")
				.params(MINE, link.hash()).update();

		String token = aToken();
		String carried = cookies == null ? "" : "; " + cookies;

		return post("/api/password-reset", TOKEN_COOKIE + "=" + token + carried, token,
				"{\"token\":\"" + link.secret() + "\",\"password\":\"novaLozinka9876sasvim\","
						+ "\"passwordRepeat\":\"novaLozinka9876sasvim\"}");
	}

	/**
	 * A RESET ASKED FROM A BROWSER SIGNED IN AS THAT MEMBER ENDS THE BROWSER'S COOKIE TOO.
	 *
	 * <p>The reset ends every session of the account, the one this browser carries among them, and
	 * the answer says so with the cookie that is over - once, and not beside a renewal of the
	 * session it has just ended, which is due here on purpose.
	 */
	@Test
	void aResetFromTheMembersOwnBrowserEndsItsCookie() throws Exception {
		HttpResponse<String> answer = reset(carrying(mineDueForRenewal));

		assertThat(answer.statusCode()).isEqualTo(204);
		assertThat(stillOpen(mineDueForRenewal)).as("the reset did not end the session").isFalse();
		assertThat(aboutTheSession(answer)).as("the reset carried more than one cookie for the session, or none")
				.hasSize(1);
		assertThat(valueOf(aboutTheSession(answer).get(0))).as("the reset handed a session back").isEmpty();
		assertThat(aboutTheSession(answer).get(0)).contains("Max-Age=0");
		assertThat(stillOpen(hersDueForRenewal)).isTrue();
	}

	/**
	 * AND FROM A BROWSER SIGNED IN AS SOMEBODY ELSE IT LEAVES THAT COOKIE ALONE.
	 *
	 * <p>Her session is not one this reset ends, so the answer says nothing that would sign her out:
	 * nothing at all while her session is not due, and her own cookie renewed when it is - which is
	 * the case where a cookie taken from the session the reset DID end would show.
	 */
	@Test
	void aResetFromAnotherMembersBrowserLeavesHerCookieAlone() throws Exception {
		SecretToken hersNotDue = open(SOMEBODY_ELSE, Duration.ofMinutes(1), Duration.ofDays(30));

		HttpResponse<String> notDue = reset(carrying(hersNotDue));

		assertThat(notDue.statusCode()).isEqualTo(204);
		assertThat(stillOpen(mineDueForRenewal)).as("the reset did not end his session").isFalse();
		assertThat(aboutTheSession(notDue)).as("a reset of his password touched her cookie").isEmpty();
		assertThat(stillOpen(hersNotDue)).isTrue();

		HttpResponse<String> due = reset(carrying(hersDueForRenewal));

		assertThat(due.statusCode()).isEqualTo(204);
		assertThat(aboutTheSession(due)).as("her renewal was not one cookie").hasSize(1);
		assertThat(valueOf(aboutTheSession(due).get(0)))
				.as("a reset of his password ended her cookie, or handed her his")
				.isEqualTo(hersDueForRenewal.secret());
	}

	private static final String NEW_PASSWORD = "novaLozinka9876sasvim";

	/** Changing the password from the browser holding {@code session}, with the old password given. */
	private HttpResponse<String> changePassword(SecretToken session, String oldPassword) throws Exception {
		String token = aToken();

		return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/me/password"))
						.header("Content-Type", "application/json")
						.header("Cookie", TOKEN_COOKIE + "=" + token + "; " + carrying(session))
						.header(TOKEN_HEADER, token)
						.PUT(HttpRequest.BodyPublishers.ofString("{\"oldPassword\":\"" + oldPassword
								+ "\",\"password\":\"" + NEW_PASSWORD + "\",\"passwordRepeat\":\"" + NEW_PASSWORD
								+ "\"}"))
						.build(),
				HttpResponse.BodyHandlers.ofString());
	}

	private int sessionsOf(String email) {
		return db.sql("select count(*) from account_session where account_id = (select id from account"
				+ " where email = ?)").param(email).query(Integer.class).single();
	}

	/**
	 * CHANGING THE PASSWORD GIVES THE SESSION THAT ASKED A NEW SECRET, AND THE MEMBER STAYS SIGNED IN
	 * (owner, 30.10.2026, chosen between the outcomes put to him after the security review of PR 656).
	 *
	 * <p>The old secret opens nothing any more, the new one opens his account, and the answer carries
	 * exactly one cookie for the session. His other device is signed out as before, and the other
	 * member's session is left exactly as it was: the new secret has two places it could have been
	 * written, his row and hers, and only the first is right.
	 *
	 * <p>His session is due for renewal, so the filter's renewal has to stand aside for the route's
	 * cookie. The control is a refused change asked from her browser, also due: the same route, an
	 * answer that carries a renewal and no cookie of the route's own, so a change that dropped or
	 * doubled the CSRF cookie would set a different list of names.
	 */
	@Test
	void changingThePasswordGivesTheSessionANewSecret() throws Exception {
		SecretToken mineElsewhere = open(MINE, Duration.ofMinutes(1), Duration.ofDays(30));

		HttpResponse<String> control = changePassword(hersDueForRenewal, "nijeTacnaLozinka123");

		assertThat(control.statusCode()).isEqualTo(400);

		HttpResponse<String> answer = changePassword(mineDueForRenewal, RIGHT);

		assertThat(answer.statusCode()).isEqualTo(204);
		assertThat(aboutTheSession(answer)).as("changing the password carried more than one cookie for the"
				+ " session, or none").hasSize(1);

		String handedOut = valueOf(aboutTheSession(answer).get(0));

		assertThat(handedOut).as("the session kept its old secret, or was handed another member's")
				.isNotEmpty()
				.isNotEqualTo(mineDueForRenewal.secret())
				.isNotEqualTo(hersDueForRenewal.secret());
		assertThat(attributesOf(aboutTheSession(answer).get(0)))
				.containsExactly("Path=/", THIRTY_DAYS, "Secure", "HttpOnly", "SameSite=Strict");
		assertThat(namesSet(answer)).as("changing the password dropped or doubled a cookie that is not the"
				+ " session's").isEqualTo(namesSet(control));

		assertThat(me(carrying(mineDueForRenewal)).statusCode()).as("the old secret still opens the portal")
				.isEqualTo(401);
		assertThat(me(SessionCookie.NAME + "=" + handedOut).statusCode())
				.as("the new secret opens nothing, so the member was signed out").isEqualTo(200);
		assertThat(sessionsOf(MINE)).as("his other device was not signed out, or his own row went").isOne();
		assertThat(stillOpen(mineElsewhere)).isFalse();
		assertThat(me(carrying(hersDueForRenewal)).statusCode())
				.as("her session was touched by his password change").isEqualTo(200);
	}

	/**
	 * A SESSION ENDED WHILE THE PASSWORD IS BEING CHANGED IS HANDED NO NEW SECRET, and the password
	 * changes all the same. Signing out in another tab is held open here, so the rewriting of the
	 * session waits behind it and finds no row once it commits; a cookie sent anyway would be a secret
	 * for a row nobody has.
	 */
	@Test
	void aSessionEndedWhileThePasswordChangesIsHandedNoNewSecret() throws Exception {
		SecretToken notDue = open(MINE, Duration.ofMinutes(1), Duration.ofDays(30));
		ExecutorService asking = Executors.newSingleThreadExecutor();

		try (AHeldTransaction signingOutElsewhere = new AHeldTransaction(pool)) {
			signingOutElsewhere.db().sql("delete from account_session where token_hash = ?")
					.param(notDue.hash()).update();

			Future<HttpResponse<String>> answer = asking.submit(() -> changePassword(notDue, RIGHT));

			signingOutElsewhere.untilBehind(1, List.of(answer));
			signingOutElsewhere.commit();

			HttpResponse<String> answered = answer.get(30, TimeUnit.SECONDS);

			assertThat(answered.statusCode()).isEqualTo(204);
			assertThat(aboutTheSession(answered)).as("a session that ended was handed a new secret").isEmpty();
		} finally {
			asking.shutdownNow();
		}

		assertThat(new com.btl.portal.domain.account.StoredPassword().matches(NEW_PASSWORD,
				db.sql("select password_hash from account where email = ?").param(MINE).query(String.class)
						.single())).as("the password did not change").isTrue();
	}
}
