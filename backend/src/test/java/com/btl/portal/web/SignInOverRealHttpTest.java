package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.StoredPassword;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.web.servlet.ServletListenerRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT THE SERVER ACTUALLY DOES, OVER A REAL SOCKET.
 *
 * <p>This class exists because of one measurement on 12.09.2026, and the whole
 * point of it is the word PRESENCE. Every other case in {@link SignInApiTest}
 * carries {@code .with(csrf())}, and that helper hands the framework a token it
 * has already resolved, so the code that reads a token off a request never runs.
 * What those cases prove is that ABSENCE of a token is refused. Nothing there
 * proved that presence of a CORRECT one is accepted, and for a while it was not:
 * the configuration set a cookie repository but left the default request handler,
 * which expects a masked value, so a script doing exactly what the portal's own
 * script does got 403 on every request, right password included. The suite stayed
 * green throughout, because a suite that only ever measures "no" cannot tell a
 * working lock from a jammed one.
 *
 * <p>So this one speaks HTTP. It reads the {@code XSRF-TOKEN} cookie off a plain
 * read and echoes it in {@code X-XSRF-TOKEN}, which is the entire mechanism and
 * the only thing a browser can do that another site cannot.
 *
 * <p><b>Two cases and not one, because a 204 has two possible fathers.</b> It
 * means "the correct token was accepted" only if a WRONG one in the same shape is
 * refused; if CSRF were switched off altogether the first case would pass just as
 * happily. The two requests differ in nothing but the value of one header.
 *
 * <p><b>And the session guard lives here too, for the same reason and not by
 * convenience.</b> It used to ask MockMvc, and MockMvc turned out to be answering
 * about itself: {@code .with(csrf())} reaches into the shared filter chain of the
 * cached context and swaps the token repository for a test one that keeps the
 * token in a session. Run after {@code SignInApiTest} in one JVM, the guard went
 * red on a plain read of the codebook - on a server that had done nothing of the
 * sort. It passed here and failed on CI purely because the two run the classes in
 * a different order. A real socket has no such helper, and the question is
 * answered by the container rather than by the test framework.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class SignInOverRealHttpTest {

	private static final String ADDRESS = "kroz-mrezu@primer.rs";

	private static final String RIGHT = "dvanaest1234sasvim";

	private static final String TOKEN_COOKIE = "XSRF-TOKEN";

	private static final String TOKEN_HEADER = "X-XSRF-TOKEN";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	@Autowired
	private SessionsCreated sessions;

	private final HttpClient client = HttpClient.newHttpClient();

	/** Counts what the CONTAINER reports, which is the one answer nothing can fake. */
	static class SessionsCreated implements HttpSessionListener {

		private final AtomicInteger howMany = new AtomicInteger();

		@Override
		public void sessionCreated(HttpSessionEvent event) {
			howMany.incrementAndGet();
		}

		int soFar() {
			return howMany.get();
		}
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class WatchingForSessions {

		@Bean
		SessionsCreated sessionsCreated() {
			return new SessionsCreated();
		}

		@Bean
		ServletListenerRegistrationBean<HttpSessionListener> watchingForSessions(SessionsCreated created) {
			return new ServletListenerRegistrationBean<>(created);
		}
	}

	/* No @Transactional here and there cannot be one: the server answers on its own
	   thread with its own connection, so a transaction held by the test would not be
	   the one the request writes in. The rows are cleaned up by hand instead. */
	@BeforeEach
	void anAccountToSignInTo() {
		forget();
		db.sql("insert into account (email, role_id, password_hash) values (?,"
						+ " (select id from role where code = 'competitor'), ?)")
				.params(ADDRESS, new StoredPassword().of(RIGHT))
				.update();
	}

	@AfterEach
	void forget() {
		db.sql("delete from account_session where account_id in (select id from account where email = ?)")
				.param(ADDRESS).update();
		db.sql("delete from account where email = ?").param(ADDRESS).update();
	}

	private HttpResponse<String> read() throws Exception {
		return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/places"))
				.GET().build(), HttpResponse.BodyHandlers.ofString());
	}

	/** The form, sent with whatever the caller wants to put in the header. */
	private HttpResponse<String> signIn(String cookie, String header) throws Exception {
		return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/sign-in"))
						.header("Content-Type", "application/json")
						.header("Cookie", TOKEN_COOKIE + "=" + cookie)
						.header(TOKEN_HEADER, header)
						.POST(HttpRequest.BodyPublishers.ofString(
								"{\"email\":\"" + ADDRESS + "\",\"password\":\"" + RIGHT + "\"}"))
						.build(),
				HttpResponse.BodyHandlers.ofString());
	}

	/** Reads one cookie out of the {@code Set-Cookie} headers of an answer. */
	private static Optional<String> handedOut(HttpResponse<?> answer, String name) {
		return answer.headers().allValues("set-cookie").stream()
				.filter(one -> one.startsWith(name + "="))
				.map(one -> one.substring(name.length() + 1).split(";", 2)[0])
				.findFirst();
	}

	private int missesAt(String email) {
		return db.sql("select failed_sign_ins from account where email = ?")
				.param(email).query(Integer.class).single();
	}

	/**
	 * A SCRIPT THAT READS THE COOKIE AND ECHOES IT GETS IN.
	 *
	 * <p>Three things in one sequence, and each is a separate way the mechanism can
	 * be broken: the token is handed out to somebody who has not signed in (or the
	 * script has nothing to echo), it is readable by script (or the script cannot
	 * read it), and echoing it is accepted (or nobody ever gets in).
	 */
	@Test
	void aScriptThatReadsTheCookieAndEchoesItGetsIn() throws Exception {
		HttpResponse<String> codebook = read();

		assertThat(codebook.statusCode()).isEqualTo(200);
		String token = handedOut(codebook, TOKEN_COOKIE)
				.orElseThrow(() -> new AssertionError("no " + TOKEN_COOKIE + " was handed out,"
						+ " so the portal's own script has nothing to echo"));
		assertThat(codebook.headers().allValues("set-cookie").stream()
				.filter(one -> one.startsWith(TOKEN_COOKIE + "=")).findFirst().orElseThrow())
				.as("the token cookie is HttpOnly, so the script that must echo it cannot read it")
				.doesNotContain("HttpOnly");

		HttpResponse<String> answer = signIn(token, token);

		assertThat(answer.statusCode())
				.as("a client doing exactly what the portal's script does was refused")
				.isEqualTo(204);
		assertThat(handedOut(answer, SessionCookie.NAME))
				.as("signed in over real HTTP and got no session cookie")
				.isPresent();
	}

	/**
	 * AND A WRONG TOKEN IN THE SAME SHAPE IS REFUSED.
	 *
	 * <p>Same address, same right password, same cookie, same header name: the only
	 * thing changed is the value echoed back. Without this case the one above would
	 * be just as green with CSRF switched off entirely, and the guard would be gone
	 * with nothing to show for it.
	 */
	@Test
	void andAWrongTokenInTheSameShapeIsRefused() throws Exception {
		String token = handedOut(read(), TOKEN_COOKIE).orElseThrow();

		HttpResponse<String> answer = signIn(token, "0d5ff4e4-1111-2222-3333-444455556666");

		assertThat(answer.statusCode()).isEqualTo(403);
		assertThat(handedOut(answer, SessionCookie.NAME))
				.as("a request nobody proved came from the portal was let in")
				.isEmpty();
		assertThat(missesAt(ADDRESS))
				.as("a request nobody proved came from the portal cost a miss")
				.isZero();
	}

	/**
	 * NOTHING HANDS OUT A SESSION, on either chain, to anybody.
	 *
	 * <p>The configuration says in as many words that it keeps no session until
	 * somebody signs in, and until a security round on 11.09.2026 that was true of
	 * one of its two chains. The other carried CSRF protection, whose default token
	 * repository lives IN THE SESSION, so an unsafe method arriving without a token
	 * created one before anything had decided whether the path existed at all.
	 *
	 * <p><b>Asked of the container and not of the answer.</b> A session that was
	 * created is what matters, and whether the answer got as far as carrying a
	 * cookie for it is a detail of how it was written; so an {@code HttpSessionListener}
	 * counts what Tomcat itself reports, and the cookie is checked as well because
	 * that is the half an attacker sees. The four paths are the two chains times
	 * the two kinds of method, because the chain that leaked is the one nothing
	 * else here touches.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"/api/places", "/api/nema-ovoga", "/actuator/health", "/nema-ni-ovoga"})
	void nothingHandsOutASessionToAnybody(String path) throws Exception {
		int before = sessions.soFar();

		for (String method : new String[] {"GET", "POST"}) {
			HttpResponse<String> answer = client.send(
					HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
							.method(method, HttpRequest.BodyPublishers.noBody()).build(),
					HttpResponse.BodyHandlers.ofString());

			assertThat(answer.headers().allValues("set-cookie"))
					.as("%s %s answered with a session cookie", method, path)
					.noneMatch(one -> one.startsWith("JSESSIONID"));
		}

		assertThat(sessions.soFar() - before)
				.as("the container created a session for somebody merely asking about %s", path)
				.isZero();
	}
}
