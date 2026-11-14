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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE TERM OF A SEARCH OF THE PAYMENTS IS NOT IN THE ADDRESS OF THE REQUEST, AND SO NOT IN THE LOG THAT KEEPS ADDRESSES.
 *
 * <p><b>The decision (ADL, 07.11.2026, owner, chosen between offered outcomes, with the assistant's recommendation):</b>
 * „Pojam pretrage uplata ne putuje u adresi zahteva nego u telu, jer je to često ime nekoga ko još nije član, a
 * adresa ostaje u logu servera." What an access log of a server keeps is the line of the request, and the line holds
 * the address with whatever follows its question mark. So the question that is asked here is the one that decision
 * is about, and it is asked of a real server with its own access log switched on (Tomcat's, which is the one this
 * process has; the edge proxy in front of it is not part of this repository and is not measured here): <b>after a
 * search, does the log hold the term.</b>
 *
 * <p><b>The measurement has to be able to see, so it has a control.</b> The old address, {@code
 * GET /api/payments?search=...}, is sent with a term of its own and is refused (400); the log must hold THAT term. A
 * log that held neither would pass the case about the new road for any reason at all, including that the log was
 * never written, which is the one way this could be vacuous.
 *
 * <p><b>The two terms are not one constant</b>: a term that travels in the body and a term that travels in the
 * address are two values, so a log line that holds one cannot be mistaken for a line that holds the other.
 *
 * <p>Nothing here is {@code @Transactional}, because the server answers on its own thread with its own connection;
 * the rows are made and removed by hand, as {@code RightsOverRealHttpTest} does.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
		"server.tomcat.accesslog.enabled=true",
		"server.tomcat.accesslog.buffered=false",
		"server.tomcat.accesslog.prefix=access_of_the_payments_search",
		"server.tomcat.accesslog.suffix=.log" })
@Import(TestcontainersConfiguration.class)
class ASearchTermOfThePaymentsStaysOutOfTheAccessLogOverRealHttpTest {

	private static final String A_READ_THAT_HANDS_OUT_THE_TOKEN = "/api/countries";

	private static final String TOKEN_COOKIE = "XSRF-TOKEN";

	private static final String TOKEN_HEADER = "X-XSRF-TOKEN";

	private static final String THE_BOOKKEEPER = "uplate-kroz-log@primer.rs";

	/** A name of somebody who is not a member yet, which is what the term of this search usually is. */
	private static final String A_TERM_IN_THE_BODY = "Nikoljdanovicbodyterm";

	/** Another, so the control line cannot be taken for the line of the case. */
	private static final String A_TERM_IN_THE_ADDRESS = "Petkovicaddressterm";

	private static final Path THE_LOG_DIRECTORY = aDirectory();

	private static Path aDirectory() {
		try {
			return Files.createTempDirectory("btl-access-log-of-the-payments-search");
		} catch (IOException failed) {
			throw new IllegalStateException(failed);
		}
	}

	@DynamicPropertySource
	static void theLogIsWrittenWhereThisCaseCanRead(DynamicPropertyRegistry registry) {
		registry.add("server.tomcat.accesslog.directory", THE_LOG_DIRECTORY::toString);
	}

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	private final HttpClient client = HttpClient.newHttpClient();

	private String session;

	@BeforeEach
	void aModeratorHoldingTheQueueOfThePayments() {
		forget();
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = 'moderator'))")
				.param(THE_BOOKKEEPER).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:payments')")
				.param(THE_BOOKKEEPER).update();

		SecretToken token = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(THE_BOOKKEEPER, token.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		session = token.secret();
	}

	@AfterEach
	void forget() {
		db.sql("delete from account where email = ?").param(THE_BOOKKEEPER).update();
	}

	private Optional<String> handedOut(HttpResponse<?> answer) {
		return answer.headers().allValues("set-cookie").stream()
				.filter(one -> one.startsWith(TOKEN_COOKIE + "="))
				.map(one -> one.substring(TOKEN_COOKIE.length() + 1).split(";", 2)[0])
				.findFirst();
	}

	private HttpResponse<String> theTokenIsRead() throws Exception {
		return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + A_READ_THAT_HANDS_OUT_THE_TOKEN))
				.GET().build(), HttpResponse.BodyHandlers.ofString());
	}

	/** The search as the portal sends a write: the session, the token in the cookie and in the header, the term in the body. */
	private HttpResponse<String> searchingFor(String term, String token) throws Exception {
		return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/payments/search"))
				.header("Content-Type", "application/json")
				.header("Cookie", SessionCookie.NAME + "=" + session + "; " + TOKEN_COOKIE + "=" + token)
				.header(TOKEN_HEADER, token)
				.POST(HttpRequest.BodyPublishers.ofString("{\"term\":\"" + term + "\"}")).build(),
				HttpResponse.BodyHandlers.ofString());
	}

	/** The old way, with the term in the address. */
	private HttpResponse<String> theOldAddress(String term) throws Exception {
		return client.send(HttpRequest.newBuilder(
						URI.create("http://localhost:" + port + "/api/payments?search=" + term))
				.header("Cookie", SessionCookie.NAME + "=" + session).GET().build(),
				HttpResponse.BodyHandlers.ofString());
	}

	/** Every line the access log of this run holds, as it holds them. */
	private String theLog() throws IOException {
		try (Stream<Path> files = Files.list(THE_LOG_DIRECTORY)) {
			StringBuilder all = new StringBuilder();

			for (Path file : files.toList()) {
				all.append(Files.readString(file, StandardCharsets.UTF_8));
			}

			return all.toString();
		}
	}

	/**
	 * THE TERM IS IN THE BODY AND THE LOG DOES NOT HOLD IT, while the same log holds the term of the old address.
	 */
	@Test
	void theLogHoldsTheTermOfTheOldAddressAndNotTheTermOfTheBody() throws Exception {
		String token = handedOut(theTokenIsRead()).orElseThrow();

		HttpResponse<String> found = searchingFor(A_TERM_IN_THE_BODY, token);

		assertThat(found.statusCode())
				.as("the search in the body was not answered, so the log below says nothing about a search")
				.isEqualTo(200);
		assertThat(found.body()).as("what was answered is not the list").contains("accounts");

		HttpResponse<String> old = theOldAddress(A_TERM_IN_THE_ADDRESS);

		assertThat(old.statusCode())
				.as("the old address was answered, and not refused")
				.isEqualTo(400);

		String log = theLog();

		assertThat(log)
				.as("the log holds no line of the search: the case measures a log that was never written")
				.contains("POST /api/payments/search");
		assertThat(log)
				.as("the log holds no line of the old address: the control cannot see a term in an address")
				.contains("GET /api/payments?search=" + A_TERM_IN_THE_ADDRESS);
		assertThat(log)
				.as("the term of the search is in the access log of the server")
				.doesNotContain(A_TERM_IN_THE_BODY);
	}
}
