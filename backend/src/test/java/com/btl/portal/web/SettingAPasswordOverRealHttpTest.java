package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE EXACT PAIR OF REQUESTS THE SCREEN SENDS, AGAINST A REAL SOCKET.
 *
 * <p><b>Why this exists beside {@code SignInOverRealHttpTest}, which already measures
 * the same mechanism.</b> That class proves the mechanism EXISTS: a read of
 * {@code /api/places} hands out a token, and echoing it gets a caller in at
 * {@code /api/sign-in}. What it cannot say is how far that reaches. A frontend written
 * on the strength of it would be resting on three things nobody measured - that the
 * route it actually reads hands the cookie out, that the route it actually posts to
 * accepts the echo, and that a refusal comes back in the shape it parses. Each of
 * those is a different route or a different body, and „X already does this" is a claim
 * that asks for a measurement rather than a reading.
 *
 * <p><b>What the screen does, in order, and every line below is one step of it.</b>
 * {@code frontend/src/pages/account/askTheServer.ts}: read {@code /api/countries} when
 * the browser holds no {@code XSRF-TOKEN}; echo whatever that left in
 * {@code X-XSRF-TOKEN}; post the token and the password twice to
 * {@code /api/password-reset}; read {@code reason} out of a 400.
 *
 * <p><b>Nothing here is @Transactional and there cannot be one</b>: the server answers
 * on its own thread with its own connection, so a transaction held by the test would
 * not be the one the request writes in. The rows are cleaned up by hand, the same way
 * {@code SignInOverRealHttpTest} does it.
 *
 * <p><b>And no mail server is raised.</b> {@code /api/password-reset} sends nothing -
 * only {@code /api/password-reset/request} does - so this class binds no SMTP port and
 * cannot collide with the fixed ones other classes hold (`CLAUDE.md`, 18.09.2026).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class SettingAPasswordOverRealHttpTest {

	/** The route the screen reads to be handed a cookie, written here as the screen
	 *  writes it. A different one would measure a different promise. */
	private static final String A_READ_THAT_HANDS_OUT_THE_TOKEN = "/api/countries";

	private static final String TOKEN_COOKIE = "XSRF-TOKEN";

	private static final String TOKEN_HEADER = "X-XSRF-TOKEN";

	private static final String ADDRESS = "kroz-ekran@primer.rs";

	/** Twelve characters and not on the shipped breach list, the same one
	 *  {@code PasswordResetApiTest} uses. */
	private static final String NEW_PASSWORD = "trcim.kroz.sumu.2027";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	private final HttpClient client = HttpClient.newHttpClient();

	private long account;

	/**
	 * An account with NO PASSWORD AT ALL, which is the one this screen was asked for.
	 *
	 * <p>V18: the owner opens accounts for honorary members himself and „they set one
	 * through the reset link"; since 18.09.2026 an invited moderator comes in by the
	 * same road (PDL P28a). The owner's own account was written into the QA database
	 * on 19.09.2026 in exactly this state, which is what made the screen due.
	 */
	@BeforeEach
	void anAccountWaitingForItsFirstPassword() {
		forget();
		account = db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = 'competitor'))"
						+ " returning id")
				.param(ADDRESS).query(Long.class).single();
	}

	@AfterEach
	void forget() {
		db.sql("delete from password_reset_token where account_id in"
				+ " (select id from account where email = ?)").param(ADDRESS).update();
		db.sql("delete from account_session where account_id in"
				+ " (select id from account where email = ?)").param(ADDRESS).update();
		db.sql("delete from account where email = ?").param(ADDRESS).update();
	}

	private HttpResponse<String> read() throws Exception {
		return client.send(
				HttpRequest.newBuilder(
								URI.create("http://localhost:" + port + A_READ_THAT_HANDS_OUT_THE_TOKEN))
						.GET().build(),
				HttpResponse.BodyHandlers.ofString());
	}

	/** The form this screen sends, with whatever the caller wants in the header. */
	private HttpResponse<String> set(String path, String body, String cookie, String header)
			throws Exception {
		HttpRequest.Builder asking = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
				.header("Content-Type", "application/json");

		if (cookie != null) {
			asking.header("Cookie", TOKEN_COOKIE + "=" + cookie);
		}
		if (header != null) {
			asking.header(TOKEN_HEADER, header);
		}

		return client.send(asking.POST(HttpRequest.BodyPublishers.ofString(body)).build(),
				HttpResponse.BodyHandlers.ofString());
	}

	private String resetting(String token, String password, String repeat) {
		return "{\"token\":\"" + token + "\",\"password\":\"" + password
				+ "\",\"passwordRepeat\":\"" + repeat + "\"}";
	}

	private static Optional<String> handedOut(HttpResponse<?> answer, String name) {
		return answer.headers().allValues("set-cookie").stream()
				.filter(one -> one.startsWith(name + "="))
				.map(one -> one.substring(name.length() + 1).split(";", 2)[0])
				.findFirst();
	}

	private String aLiveLink() {
		SecretToken token = SecretToken.fresh();

		db.sql("insert into password_reset_token (account_id, token_hash) values (?, ?)")
				.params(account, token.hash()).update();

		return token.secret();
	}

	private Optional<String> passwordHash() {
		return db.sql("select password_hash from account where id = ?")
				.param(account).query(String.class).optional();
	}

	/**
	 * THE ROUTE THE SCREEN READS HANDS OUT A TOKEN THE SCREEN CAN READ.
	 *
	 * <p>Three separate ways this can be false and each would leave the screen dead:
	 * the read is refused to somebody with no session, the cookie is not handed out at
	 * all, or it is handed out {@code HttpOnly} and the script that must echo it cannot
	 * see it.
	 */
	@Test
	void theReadTheScreenMakesHandsOutATokenItCanRead() throws Exception {
		HttpResponse<String> codebook = read();

		assertThat(codebook.statusCode())
				.as("the screen reads %s before it posts anything, and was refused",
						A_READ_THAT_HANDS_OUT_THE_TOKEN)
				.isEqualTo(200);

		String raw = codebook.headers().allValues("set-cookie").stream()
				.filter(one -> one.startsWith(TOKEN_COOKIE + "="))
				.findFirst()
				.orElseThrow(() -> new AssertionError("no " + TOKEN_COOKIE + " was handed out by "
						+ A_READ_THAT_HANDS_OUT_THE_TOKEN + ", so the screen has nothing to echo"));

		assertThat(raw)
				.as("the token cookie is HttpOnly, so the script that must echo it cannot read it")
				.doesNotContain("HttpOnly");
	}

	/**
	 * AND THE WHOLE SEQUENCE SETS THE PASSWORD.
	 *
	 * <p>The read, the echo, and the body with both fields in it - which is what the
	 * screen sends and, until this ran, nothing had asked the server about.
	 */
	@Test
	void theSequenceTheScreenSendsSetsThePassword() throws Exception {
		String token = handedOut(read(), TOKEN_COOKIE).orElseThrow();
		String link = aLiveLink();

		assertThat(passwordHash())
				.as("the account starts with no password, or this measures nothing")
				.isEmpty();

		HttpResponse<String> answer =
				set("/api/password-reset", resetting(link, NEW_PASSWORD, NEW_PASSWORD), token, token);

		assertThat(answer.statusCode())
				.as("a client doing exactly what the screen does was refused: %s", answer.body())
				.isEqualTo(204);
		assertThat(passwordHash()).isPresent();
	}

	/**
	 * AND WITHOUT THE HEADER IT IS REFUSED, WITH NOTHING WRITTEN.
	 *
	 * <p>Two things at once, and the second is the one that matters to the screen: 403
	 * is a refusal it must SAY, because the link is still live and the reader has to
	 * press again. A 403 that had quietly set the password would make that sentence a
	 * lie in the other direction.
	 *
	 * <p>Without this case the one above would be just as green with the whole
	 * mechanism switched off, and the guard would be gone with nothing to show for it.
	 */
	@Test
	void andWithoutTheHeaderItIsRefusedAndNothingIsWritten() throws Exception {
		String token = handedOut(read(), TOKEN_COOKIE).orElseThrow();
		String link = aLiveLink();

		HttpResponse<String> answer =
				set("/api/password-reset", resetting(link, NEW_PASSWORD, NEW_PASSWORD), token, null);

		assertThat(answer.statusCode()).isEqualTo(403);
		assertThat(passwordHash())
				.as("a request nobody proved came from the portal set a password anyway")
				.isEmpty();
	}

	/**
	 * AND A REFUSAL COMES BACK IN THE SHAPE THE SCREEN READS.
	 *
	 * <p>The screen takes {@code reason} out of the body and looks the word up to
	 * decide what to tell the reader. Nothing else measures that the body really
	 * carries that field under that name over the wire, and a refusal whose shape the
	 * screen cannot read is a reader told „the server refused and named a reason this
	 * screen does not recognise" for the commonest refusal there is.
	 *
	 * <p>Both routes, because the screen beside this one parses the same field out of
	 * the other one and they are two classes that could part company.
	 */
	@Test
	void aRefusalNamesItsReasonInTheBodyTheScreenReads() throws Exception {
		String token = handedOut(read(), TOKEN_COOKIE).orElseThrow();
		String dead = SecretToken.fresh().secret();

		HttpResponse<String> reset =
				set("/api/password-reset", resetting(dead, NEW_PASSWORD, NEW_PASSWORD), token, token);

		assertThat(reset.statusCode()).isEqualTo(400);
		assertThat(reset.body()).isEqualTo("{\"reason\":\"theLinkIsNotValid\"}");

		HttpResponse<String> confirm = set("/api/email-confirmation",
				"{\"token\":\"" + dead + "\"}", token, token);

		assertThat(confirm.statusCode()).isEqualTo(400);
		assertThat(confirm.body()).isEqualTo("{\"reason\":\"theLinkIsNotValid\"}");
	}
}
