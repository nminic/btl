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

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

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
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class TheSessionCookieFollowsTheSessionOverRealHttpTest {

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
	void twoAccountsAndAStaleSessionForEach() {
		forget();

		account(MINE);
		account(SOMEBODY_ELSE);

		mineDueForRenewal = open(MINE, Duration.ofDays(2), Duration.ofDays(28));
		hersDueForRenewal = open(SOMEBODY_ELSE, Duration.ofDays(2), Duration.ofDays(28));
	}

	@AfterEach
	void forget() {
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
	 * <p>The filter renews the row and puts the cookie in the answer before the route runs; the
	 * route then deletes the row and says the cookie is over. Both lines in one answer would
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
	 * <p>The old cookie is due for renewal, so the filter hands it back; the route then hands out
	 * the new one. The browser must be left with the new session, and the answer must name only
	 * that.
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
}
