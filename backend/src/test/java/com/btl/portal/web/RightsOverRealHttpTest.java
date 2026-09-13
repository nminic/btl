package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT A REFUSAL LOOKS LIKE ON THE WIRE, read off a socket byte for byte.
 *
 * <p><b>This class exists because a number is not an answer.</b> The owner decided on
 * 13.09.2026 that somebody without the right is told 404, so that an address does not say
 * it is there. That was carried out as a status and nothing else, and a security round the
 * same day measured what a status alone is worth:
 *
 * <table>
 * <caption>what the two answers were before this class existed</caption>
 * <tr><th></th><th>refused (the address exists)</th><th>the address does not exist</th></tr>
 * <tr><td>status</td><td>404</td><td>404</td></tr>
 * <tr><td>body</td><td>empty</td><td>the error document, as JSON</td></tr>
 * <tr><td>Content-Type</td><td>absent</td><td>application/json</td></tr>
 * <tr><td>on the wire</td><td>262 bytes, Content-Length: 0</td><td>412 bytes, chunked</td></tr>
 * </table>
 *
 * <p>One request per guess, and a plain member is enough to run it. What closed it is not
 * a shape made to look like the other one: the refusal now goes down the SAME road, {@code
 * sendError}, which is where an address that is not there already ends up, so the body,
 * the headers and the length are written by the same code rather than kept equal by hand.
 *
 * <p><b>And it is here rather than beside the other cases because MockMvc cannot see any
 * of this.</b> It does not run the container's ERROR dispatch, so the error document is
 * never written and the two answers look alike to it whichever way the code is written.
 * Measured rather than asserted: the comparison below, run through MockMvc against the
 * code as it was before the fix, PASSES. The precedent for coming down here is
 * {@code SignInOverRealHttpTest}, which exists for the same kind of reason.
 *
 * <p><b>The two addresses in each comparison are the same number of characters long</b>,
 * because the error document carries the path that was asked for. Paths of different
 * lengths would differ by a length that says nothing about whether either exists, and the
 * comparison would have to be loosened until it stopped measuring.
 *
 * <p><b>Every request carries a CSRF token, chosen here and sent as both the cookie and
 * the header.</b> Not decoration: without it an unsafe method is refused 403 by the CSRF
 * filter before anything else looks at it, so both answers come back identical and every
 * case about a method would pass while measuring the CSRF filter. That a caller writing
 * his own request can pick both halves is what {@code ApiSecurity} says in as many words,
 * and it is what an attacker does.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import({TestcontainersConfiguration.class, ProbeRoutes.class,
		ProbeRouteOutsideTheApi.class})
class RightsOverRealHttpTest {

	private static final String HOLDS_THE_TICK = "sa-pravom-kroz-mrezu@primer.rs";

	private static final String WITHOUT_THE_TICK = "bez-prava-kroz-mrezu@primer.rs";

	/** The token is any value at all, which is the point of it being sent twice. */
	private static final String A_TOKEN = "11111111-2222-3333-4444-555555555555";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	private final Map<String, String> sessions = new HashMap<>();

	@BeforeEach
	void twoModerators() {
		account(HOLDS_THE_TICK, "moderator");
		account(WITHOUT_THE_TICK, "moderator");

		ticked(HOLDS_THE_TICK, ProbeRoutes.THE_RIGHT_IT_NEEDS);
		ticked(WITHOUT_THE_TICK, ProbeRoutes.THE_OTHER_RIGHT, "entity:events");
	}

	/**
	 * Cleaned up by hand, because a real server answers on its own connection and a
	 * transaction around this thread would roll back nothing it can see.
	 */
	@AfterEach
	void takeThemBackOut() {
		db.sql("delete from account where email in (?, ?)")
				.params(HOLDS_THE_TICK, WITHOUT_THE_TICK).update();
	}

	private void account(String email, String role) {
		db.sql("insert into account (email, role_id) values (?, (select id from role where code = ?))")
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

	private void ticked(String email, String... rights) {
		for (String right : rights) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, right).update();
		}
	}

	/** The whole answer, headers and body and chunk sizes, exactly as it came off the wire. */
	private String answerTo(String method, String path, String email) throws Exception {
		return answerTo(method, path, email, A_TOKEN);
	}

	/**
	 * @param token the CSRF value to send as both the cookie and the header, or null to send
	 *              none - which is a setting of its own, because half of what the reviews
	 *              measured needed no token at all
	 */
	private String answerTo(String method, String path, String email, String token)
			throws Exception {
		String cookies = (token == null ? "" : "XSRF-TOKEN=" + token)
				+ (email == null ? ""
						: (token == null ? "" : "; ") + SessionCookie.NAME + "="
								+ sessions.get(email));

		String asking = method + " " + path + " HTTP/1.1\r\n"
				+ "Host: localhost:" + port + "\r\n"
				+ (cookies.isEmpty() ? "" : "Cookie: " + cookies + "\r\n")
				+ (token == null ? "" : "X-XSRF-TOKEN: " + token + "\r\n")
				+ "Connection: close\r\n\r\n";

		try (Socket socket = new Socket("localhost", port)) {
			socket.getOutputStream().write(asking.getBytes(StandardCharsets.ISO_8859_1));
			socket.getOutputStream().flush();
			return new String(socket.getInputStream().readAllBytes(), StandardCharsets.ISO_8859_1);
		}
	}

	/**
	 * The answer without the two lines that must differ between any two requests.
	 *
	 * <p>{@code Date} moves with the clock and {@code Set-Cookie} carries a fresh CSRF
	 * token. Nothing else is allowed to differ, and in particular the length is kept: the
	 * chunk sizes and the body stay in, because the length was half of what gave the two
	 * answers away.
	 */
	private static String withoutTheClock(String answer) {
		return answer.replaceAll("(?m)^Date:.*\r\n", "")
				.replaceAll("(?m)^Set-Cookie:.*\r\n", "");
	}

	/** And without the two values inside the body that name the moment and the address. */
	private static String withoutTheMomentOrTheAddress(String answer, String path) {
		return withoutTheClock(answer)
				.replaceAll("\"timestamp\":\"[^\"]*\"", "\"timestamp\":\"AT SOME MOMENT\"")
				.replace(path, "THE ADDRESS THAT WAS ASKED FOR");
	}

	private void answersTheSameWay(String method, String real, String notThere, String email)
			throws Exception {
		answersTheSameWay(method, real, notThere, email, A_TOKEN);
	}

	private void answersTheSameWay(String method, String real, String notThere, String email,
			String token) throws Exception {
		String toTheReal = answerTo(method, real, email, token);
		String toTheOther = answerTo(method, notThere, email, token);

		assertThat(real.length())
				.as("the two addresses are not the same length, so the error document each of"
						+ " them carries makes them differ by a length that means nothing")
				.isEqualTo(notThere.length());

		assertThat(withoutTheClock(toTheReal).length())
				.as("%s %s and %s %s came back different LENGTHS, which is an oracle for whether"
						+ " an address exists even when both say 404", method, real, method, notThere)
				.isEqualTo(withoutTheClock(toTheOther).length());

		assertThat(withoutTheMomentOrTheAddress(toTheReal, real))
				.as("%s on an address that exists and %s on one that does not came back"
						+ " different, so the answer says which is which", method, method)
				.isEqualTo(withoutTheMomentOrTheAddress(toTheOther, notThere));
	}

	/**
	 * A ROUTE HE MAY NOT READ ANSWERS EXACTLY LIKE AN ADDRESS THAT IS NOT THERE.
	 *
	 * <p>Whole answer, both ways: the same number of bytes, and the same bytes. {@code
	 * HEAD} as well as {@code GET}, because the measurement of 13.09.2026 found the two
	 * differed on both (243 against 275 bytes on {@code HEAD}).
	 */
	@ParameterizedTest
	@ValueSource(strings = {"GET", "HEAD"})
	void aRouteHeMayNotReadAnswersExactlyLikeAnAddressThatIsNotThere(String method)
			throws Exception {
		assertThat(answerTo("GET", ProbeRoutes.NEEDS_A_RIGHT, HOLDS_THE_TICK))
				.as("the guarded route does not answer the moderator who HOLDS its tick, so both"
						+ " addresses in this comparison are simply missing and it measures nothing")
				.startsWith("HTTP/1.1 200");

		answersTheSameWay(method, ProbeRoutes.NEEDS_A_RIGHT, ProbeRoutes.NEEDS_A_RIGHT_TWIN,
				WITHOUT_THE_TICK);
	}

	/**
	 * AND A METHOD AN ADDRESS DOES NOT TAKE ANSWERS THE SAME WAY TOO.
	 *
	 * <p>Shutting {@code OPTIONS} shut one door of five. Spring works out from the mapped
	 * methods that a path exists but does not take this verb, before any handler runs, so
	 * nothing in the rights layer is consulted: {@code DELETE /api/teams} answered 405 with
	 * {@code Allow: GET} and {@code DELETE /api/sign-in} answered 405 with {@code Allow:
	 * POST}, while {@code DELETE} on an address mapping nothing answered 404.
	 *
	 * <p>Asked of {@code /api/teams}, one of the portal's own routes rather than a probe,
	 * and with the token, so that the CSRF filter is not what is being measured.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"DELETE", "PUT", "PATCH", "POST"})
	void aMethodAnAddressDoesNotTakeAnswersLikeAnAddressThatIsNotThere(String method)
			throws Exception {
		assertThat(answerTo("GET", ProbeRoutes.TAKES_ONLY_GET, null))
				.as("%s is not a route that answers a plain read, so this comparison is between"
						+ " two addresses that are both missing", ProbeRoutes.TAKES_ONLY_GET)
				.startsWith("HTTP/1.1 200");

		assertThat(answerTo(method, ProbeRoutes.TAKES_ONLY_GET, WITHOUT_THE_TICK))
				.as("the answer listed which methods the address takes, which is the same"
						+ " sentence as saying it is there")
				.doesNotContain("Allow:");

		/* SIGNED IN, and that is part of the setting rather than a detail. An address the
		   portal does not open is refused 401 before anything is dispatched, so a stranger
		   gets 401 for the twin and 404 for the real one and the two would differ for a
		   reason that has nothing to do with this rule. The oracle belongs to somebody who
		   is signed in, which is every member of the league. */
		answersTheSameWay(method, ProbeRoutes.TAKES_ONLY_GET, ProbeRoutes.TAKES_ONLY_GET_TWIN,
				WITHOUT_THE_TICK);
	}

	/**
	 * AND SO DOES A PLAIN READ OF A ROUTE THAT ONLY TAKES A WRITE, WITH NO TOKEN AT ALL.
	 *
	 * <p>The other half of the finding, measured independently by the second review, and it
	 * is the half that says the CSRF token is no obstacle to any of this: a safe method
	 * never meets that filter, so a {@code GET} of a route mapped only for {@code POST}
	 * answered 405 with {@code Allow: POST} to somebody carrying nothing but a session.
	 *
	 * <p>Signing in is the one route in the portal today that takes only a {@code POST}, and
	 * it is asked here without a token on purpose, so that nothing but the rule about
	 * methods can be what makes the two answers alike.
	 */
	@Test
	void aReadOfARouteThatOnlyTakesAWriteAnswersLikeAnAddressThatIsNotThere() throws Exception {
		assertThat(answerTo("POST", ProbeRoutes.TAKES_ONLY_POST, null))
				.as("%s does not take a POST at all, so this compares two addresses that are"
						+ " both missing", ProbeRoutes.TAKES_ONLY_POST)
				.doesNotStartWith("HTTP/1.1 404");

		assertThat(answerTo("GET", ProbeRoutes.TAKES_ONLY_POST, WITHOUT_THE_TICK, null))
				.as("a plain read, carrying no token whatsoever, was told which methods the"
						+ " address takes")
				.doesNotContain("Allow:");

		answersTheSameWay("GET", ProbeRoutes.TAKES_ONLY_POST, ProbeRoutes.TAKES_ONLY_POST_TWIN,
				WITHOUT_THE_TICK, null);
	}

	/**
	 * AND A METHOD AN ADDRESS DOES TAKE IS UNTOUCHED.
	 *
	 * <p>The other direction, and the one that matters for everything still to be written:
	 * every route that writes is a {@code POST} yet to come, and a rule that shut verbs by
	 * name rather than by what the address maps would shut them before they were written.
	 * Signing in is the one route in the portal today that takes a {@code POST}.
	 */
	@Test
	void aMethodAnAddressDoesTakeIsUntouched() throws Exception {
		assertThat(answerTo("POST", "/api/sign-in", null))
				.as("signing in was answered as though the address did not exist, so the rule"
						+ " about methods is shutting ones that ARE mapped")
				.doesNotStartWith("HTTP/1.1 404");
	}

	/**
	 * AND THE RULE ABOUT METHODS REACHES PAST {@code /api}, which is measured rather than
	 * claimed.
	 *
	 * <p>It is not narrowed to {@code /api} because a test of the path would be a branch
	 * that nothing could take: outside {@code /api} this application serves the health
	 * probe and nothing else. A branch nothing reaches is a branch nothing measures, so the
	 * rule is the whole application's - and where it reaches is a fact, so a case asks
	 * about it instead of a comment claiming it.
	 */
	@Test
	void aMethodAnAddressOutsideTheApiDoesNotTakeAnswersTheSameWay() throws Exception {
		assertThat(answerTo("GET", ProbeRouteOutsideTheApi.OUTSIDE_THE_API, null))
				.as("the route outside the api does not answer a plain read, so this compares two"
						+ " addresses that are both missing")
				.startsWith("HTTP/1.1 200");

		answersTheSameWay("DELETE", ProbeRouteOutsideTheApi.OUTSIDE_THE_API, ProbeRouteOutsideTheApi.OUTSIDE_THE_API_TWIN,
				null);
	}
}
