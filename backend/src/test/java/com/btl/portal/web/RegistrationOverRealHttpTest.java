package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.icegreen.greenmail.junit5.GreenMailExtension;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.TestPropertySource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * REGISTERING OVER A REAL SOCKET, for the three things MockMvc cannot say about it.
 *
 * <p><b>The first is the token.</b> {@code SignInOverRealHttpTest} exists because
 * {@code .with(csrf())} hands the framework a token it has already resolved, so the
 * code that reads one off a request never runs - and for a while a script doing
 * exactly what the portal's own script does got 403 on every request, with the whole
 * suite green throughout. Every case in {@code RegistrationApiTest} carries that same
 * helper, so all of them prove the ABSENCE of a token is refused and none of them
 * proves the presence of a correct one is accepted. This is the one open writing route
 * that did not exist when that lesson was paid for, and it is the route a person who
 * is not a member has to be able to use.
 *
 * <p><b>The second is what a taken address really answers, on the wire.</b> The owner
 * chose that answer knowing what it costs (ADL, 08.09.2026), so the difference between
 * the two answers is a decision and not an accident - which means it is worth reading
 * off a socket rather than out of a mock, where a status is whatever the handler set
 * and nothing has been through a filter chain, a converter or an error dispatch.
 *
 * <p><b>And the third is what a transaction really does</b>, which is the same reason
 * again: whether a row survived, and whether a connection was held while the portal
 * waited on somebody else's machine, are both questions about a commit that happened -
 * and inside a transactional test a commit that happened and one that was rolled back
 * look exactly alike.
 *
 * <p>No {@code @Transactional} here and there cannot be one: the server answers on its
 * own thread with its own connection, so a transaction held by the test would not be
 * the one the request writes in. The rows are cleaned up by hand instead, the way
 * {@code SignInOverRealHttpTest} does it. That is also what lets a case ask
 * {@code pg_stat_activity} whether anybody is sitting in a transaction: the test's own
 * statements are not in one.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3326",
		"spring.mail.properties.mail.smtp.auth=false",
		"btl.portal.address=https://probni-portal.primer.rs"})
class RegistrationOverRealHttpTest {

	/** Its own port again, and not the one {@code RegistrationApiTest} binds. */
	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3326));

	private static final String ADDRESS = "kroz-mrezu-registracija@primer.rs";

	private static final String PASSWORD = "trcim.kroz.sumu.2027";

	private static final String TOKEN_COOKIE = "XSRF-TOKEN";

	private static final String TOKEN_HEADER = "X-XSRF-TOKEN";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	private final HttpClient client = HttpClient.newHttpClient();

	private long aTownOfTheCodebook;

	@BeforeEach
	void aTownToRegisterFrom() {
		forget();
		aTownOfTheCodebook = db.sql("select geonames_id from place order by rank limit 1")
				.query(Long.class).single();
	}

	/**
	 * THE ACCOUNT GOES FIRST AND THE MEMBER SECOND, and the order is the schema's rather
	 * than a preference.
	 *
	 * <p>{@code account_competitor_fk} is ON DELETE RESTRICT, which V23 chose on the
	 * owner's own decision of 14.09.2026 - „Baza odbija brisanje clana dok se njegov nalog
	 * ne resi" - so a member cannot be deleted while a login still names him. Written the
	 * other way round this method would fail on the constraint rather than clean up, and
	 * the next case would run against rows the last one left.
	 */
	@AfterEach
	void forget() {
		db.sql("delete from account where lower(email) = lower(?)").param(ADDRESS).update();
		db.sql("delete from competitor where first_name = 'Mrezni'").update();
	}

	private HttpResponse<String> read() throws Exception {
		return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/places"))
				.GET().build(), HttpResponse.BodyHandlers.ofString());
	}

	/** Reads one cookie out of the {@code Set-Cookie} headers of an answer. */
	private static Optional<String> handedOut(HttpResponse<?> answer, String name) {
		return answer.headers().allValues("set-cookie").stream()
				.filter(one -> one.startsWith(name + "="))
				.map(one -> one.substring(name.length() + 1).split(";", 2)[0])
				.findFirst();
	}

	/** A complete registration, sent with whatever the caller wants in the header. */
	private HttpResponse<String> registering(String cookie, String header) throws Exception {
		LocalDate born = LocalDate.now().minusYears(30);
		String form = """
				{"firstName":"Mrezni","lastName":"Mreznic","fatherName":"Milorad",\
				"birthDate":"%s","gender":"M","firstSeason2027":true,"email":"%s",\
				"password":"%s","passwordRepeat":"%s","address":"Ulica slobode 15",\
				"placeId":%d,"idNumber":"AB1234567","shirtSize":"L","healthStatement":true}"""
				.formatted(born, ADDRESS, PASSWORD, PASSWORD, aTownOfTheCodebook);

		return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/registration"))
						.header("Content-Type", "application/json")
						.header("Cookie", TOKEN_COOKIE + "=" + cookie)
						.header(TOKEN_HEADER, header)
						.POST(HttpRequest.BodyPublishers.ofString(form))
						.build(),
				HttpResponse.BodyHandlers.ofString());
	}

	private String aFreshToken() throws Exception {
		return handedOut(read(), TOKEN_COOKIE)
				.orElseThrow(() -> new AssertionError("no " + TOKEN_COOKIE + " was handed out,"
						+ " so the portal's own script has nothing to echo"));
	}

	/**
	 * A SCRIPT THAT READS THE COOKIE AND ECHOES IT REGISTERS SOMEBODY.
	 *
	 * <p>Which is the whole mechanism: the token is handed out to somebody who is not
	 * signed in - and nobody registering ever is - it is readable by script, and echoing
	 * it is accepted. Any one of the three broken and the portal has a registration form
	 * that nobody on earth can submit, with every case in the other file still green.
	 *
	 * <p><b>And a wrong token in the same shape is refused</b>, because a 204 has two
	 * possible fathers: it means "the correct token was accepted" only if an incorrect one
	 * is not. With CSRF switched off altogether the first half would pass just as happily.
	 * The two requests differ in nothing but the value of one header.
	 */
	@Test
	void aScriptThatReadsTheCookieAndEchoesItRegistersSomebody() throws Exception {
		String token = aFreshToken();

		HttpResponse<String> refused = registering(token, "0d5ff4e4-1111-2222-3333-444455556666");

		assertThat(refused.statusCode())
				.as("a request nobody proved came from the portal registered an account")
				.isEqualTo(403);
		assertThat(db.sql("select count(*) from account where lower(email) = lower(?)")
				.param(ADDRESS).query(Integer.class).single()).isZero();

		HttpResponse<String> accepted = registering(token, token);

		assertThat(accepted.statusCode())
				.as("a client doing exactly what the portal's script does was refused, so the"
						+ " registration form cannot be submitted by anybody at all")
				.isEqualTo(204);
		assertThat(accepted.body()).isEmpty();
		assertThat(db.sql("select count(*) from account where lower(email) = lower(?)")
				.param(ADDRESS).query(Integer.class).single()).isOne();
	}

	/**
	 * A RELAY THAT IS DOWN LEAVES HIM AN ACCOUNT, A MEMBER AND A TOKEN, AND SAYS SO.
	 *
	 * <p><b>THIS CASE USED TO ASSERT THE OPPOSITE, AND WHY IT CHANGED IS THE WHOLE OF
	 * IT.</b> Until 14.09.2026 it was called {@code
	 * aRelayThatDoesNotAnswerLeavesNothingBehindAtAll} and it demanded a 500 with an empty
	 * table: the message went out INSIDE the transaction, so a relay that would not take
	 * it rolled the registration back, and the reasoning beside it was about the person -
	 * kept, he holds an account he can neither confirm nor sign in to, at an address that
	 * is now taken, and nothing but the owner's hand recovers him.
	 *
	 * <p><b>That reasoning was right about the person and silent about everybody else.</b>
	 * A security round measured what it cost while the relay was merely SLOW rather than
	 * down: one request held a connection of a pool of ten for 5,15 seconds doing nothing
	 * but waiting, ten such requests took the pool, and a steady twelve every two seconds
	 * answered a member's ordinary sign in with 500 after thirty seconds - 202 other
	 * people's requests hard-failed during one such minute, none of them registering.
	 * {@code aRelayThatHangsHoldsNoConnectionWhileItHangs} is the case that measures that
	 * directly, and it is the reason the order changed.
	 *
	 * <p><b>What replaces the protection, so that it is replaced and not dropped.</b> The
	 * token is written in the same transaction as the account, so what he holds is an
	 * account a RESEND can rescue rather than a dead end - the control has been on the
	 * screen since PDL of 29.07.2026 („plus dugme za ponovno slanje potvrde") and B59 is
	 * the increment that makes it do something. That is what this asks for below: not
	 * merely that the rows survive, but that the one row a resend needs survives with
	 * them.
	 *
	 * <p><b>And the answer is 204, which is the other half of the decision.</b> A 500 says
	 * nothing happened, to somebody for whom everything happened; he would read it,
	 * register again, and be told the address is taken. 204 is what is true: he is
	 * registered, and the letter is late.
	 *
	 * <p>GreenMail is stopped rather than the portal pointed elsewhere, because what has to
	 * fail is the send this request makes with the relay the running server was built with.
	 * The extension starts a fresh server for each test, so the next case is untouched.
	 * Stopping it makes the port REFUSE, which is the fast failure - 0,16 s - and this case
	 * is about what is left behind rather than about how long it took.
	 */
	@Test
	void aRelayThatIsDownLeavesHimAnAccountHeCanStillBeSentALinkFor() throws Exception {
		String token = aFreshToken();

		SMTP.getSmtp().stopService();

		HttpResponse<String> answer = registering(token, token);

		assertThat(answer.statusCode())
				.as("a registration that really happened was answered as if nothing had, so he"
						+ " will try again and be told the address is taken")
				.isEqualTo(204);
		assertThat(db.sql("select count(*) from account where lower(email) = lower(?)")
				.param(ADDRESS).query(Integer.class).single())
				.as("the account was rolled back because the letter did not go out, which is the"
						+ " arrangement that held a connection open while the relay thought"
						+ " about it")
				.isOne();
		assertThat(db.sql("select count(*) from competitor where first_name = 'Mrezni'")
				.query(Integer.class).single())
				.as("the member was rolled back with it")
				.isOne();
		assertThat(db.sql("select count(*) from email_verification_token t"
						+ " join account a on a.id = t.account_id"
						+ " where lower(a.email) = lower(?)")
				.param(ADDRESS).query(Integer.class).single())
				.as("he has an account and NO token, so asking for the link again has nothing to"
						+ " send and the account really is the dead end the old arrangement"
						+ " existed to prevent")
				.isOne();
	}

	/**
	 * A RELAY THAT HANGS HOLDS NO CONNECTION TO THE DATABASE WHILE IT HANGS.
	 *
	 * <p><b>This is the case the finding existed for, and the one the suite did not
	 * have.</b> The case above stops GreenMail, which makes the port REFUSE - the
	 * connection fails in 0,16 s and nothing is held long enough to matter. What was
	 * measured in production terms is the other shape entirely: a relay that ACCEPTS the
	 * connection and then says nothing, which is an ordinary condition for somebody else's
	 * SMTP service and which costs the full five seconds of
	 * {@code mail.smtp.timeout}. Measuring the fast one and calling it "a relay that does
	 * not answer" is exactly how a route that held a connection for five seconds stayed
	 * green.
	 *
	 * <p><b>What it asks, and why it asks the database rather than the clock.</b> While
	 * the request is in flight, no backend of this database may be {@code idle in
	 * transaction}. That is the whole claim in one question, and it is PostgreSQL's own
	 * answer rather than an inference: a transaction open with nobody using it is exactly
	 * what a connection held across a network call looks like from the other side.
	 *
	 * <p><b>What it deliberately does NOT assert, written down rather than left as a
	 * gap.</b> That another route answers quickly while this one hangs. It would pass
	 * either way and so would measure nothing: the pool is ten, one held connection leaves
	 * nine, and the second request is served in milliseconds whether the first is holding
	 * one or not. The finding's own measurement needed ten and twenty concurrent
	 * registrations to make that visible, and a case that starts twenty threads to prove
	 * one sentence is a case that fails on a loaded machine for reasons of its own.
	 *
	 * <p><b>The floor under it is the count of samples.</b> A request that finished at once
	 * would be sampled never and would pass this by not being looked at, so the case
	 * demands that it really was looked at while it really was waiting.
	 */
	@Test
	void aRelayThatHangsHoldsNoConnectionWhileItHangs() throws Exception {
		String token = aFreshToken();

		SMTP.getSmtp().stopService();

		ExecutorService onItsOwnThread = Executors.newSingleThreadExecutor();

		try (ARelayThatSaysNothing silent = ARelayThatSaysNothing.on(3326)) {
			long began = System.nanoTime();
			Future<HttpResponse<String>> registering =
					onItsOwnThread.submit(() -> registering(token, token));

			int looked = 0;
			int worst = 0;

			while (!registering.isDone()) {
				worst = Math.max(worst, backendsIdleInTransaction());
				looked++;
				Thread.sleep(100);
			}

			HttpResponse<String> answer = registering.get();
			long tookMillis = (System.nanoTime() - began) / 1_000_000;

			assertThat(tookMillis)
					.as("the request came back in %d ms, so the relay did not hang and this case"
							+ " measured the fast refusal instead", tookMillis)
					.isGreaterThan(3_000);
			assertThat(looked)
					.as("the request was never sampled while it was in flight, so nothing here"
							+ " was measured at all")
					.isGreaterThan(5);
			assertThat(worst)
					.as("a connection sat idle inside an open transaction while the portal waited"
							+ " on somebody else's mail relay; ten of these take the whole pool"
							+ " and every other route on the portal stops")
					.isZero();

			assertThat(answer.statusCode()).isEqualTo(204);
			assertThat(db.sql("select count(*) from account where lower(email) = lower(?)")
					.param(ADDRESS).query(Integer.class).single()).isOne();
		} finally {
			onItsOwnThread.shutdownNow();
		}
	}

	/** How many backends of this database are sitting inside a transaction doing nothing. */
	private int backendsIdleInTransaction() {
		return db.sql("select count(*) from pg_stat_activity"
						+ " where datname = current_database() and state = 'idle in transaction'")
				.query(Integer.class).single();
	}

	/**
	 * A SERVER THAT TAKES THE CONNECTION AND THEN SAYS NOTHING, which is what a slow relay
	 * is and what stopping GreenMail is not.
	 *
	 * <p>It binds the port the running portal was configured with, so what hangs is the
	 * send this request really makes. Accepted connections are kept rather than closed:
	 * closed, the client would read end-of-stream and fail at once, which is the fast case
	 * again by another road.
	 */
	private static final class ARelayThatSaysNothing implements AutoCloseable {

		private final ServerSocket listening;

		private final List<Socket> taken = new ArrayList<>();

		private final Thread accepting;

		private ARelayThatSaysNothing(ServerSocket listening) {
			this.listening = listening;
			this.accepting = new Thread(this::takeThemAndSayNothing, "a-relay-that-says-nothing");
			this.accepting.setDaemon(true);
			this.accepting.start();
		}

		/**
		 * Binds the port GreenMail has just let go of.
		 *
		 * <p>A listening socket is not left in TIME_WAIT the way a connected one is, so the
		 * port is free the moment the service stops - but stopping is another thread's work
		 * and this one is allowed to be a moment late.
		 */
		static ARelayThatSaysNothing on(int port) throws Exception {
			for (int attempt = 0; ; attempt++) {
				try {
					ServerSocket listening = new ServerSocket();

					listening.setReuseAddress(true);
					listening.bind(new InetSocketAddress("127.0.0.1", port));

					return new ARelayThatSaysNothing(listening);
				} catch (IOException stillHeld) {
					if (attempt == 20) {
						throw stillHeld;
					}

					Thread.sleep(100);
				}
			}
		}

		private void takeThemAndSayNothing() {
			while (!listening.isClosed()) {
				try {
					synchronized (taken) {
						taken.add(listening.accept());
					}
				} catch (IOException weAreDone) {
					return;
				}
			}
		}

		@Override
		public void close() throws IOException {
			listening.close();

			synchronized (taken) {
				for (Socket one : taken) {
					one.close();
				}
			}
		}
	}

	/**
	 * AND THE SECOND REGISTRATION AT THE SAME ADDRESS IS ANSWERED DIFFERENTLY, WHICH IS
	 * THE DECISION.
	 *
	 * <p>ADL, owner of 08.09.2026, on two offered outcomes with the cost written beside
	 * each: „Registracija na vec zauzetu adresu kaze da je zauzeta. Vlasnik je birao
	 * izmedju toga i tihog slanja nove veze vlasniku sanduceta, i izabrao izricitu poruku.
	 * Cena je izlozena pre izbora i prihvacena: bilo ko time moze da proveri da li je data
	 * adresa clan lige."
	 *
	 * <p><b>This is the case that fails the day somebody makes the two answers alike</b> -
	 * which is what signing in does, deliberately, one route away, and is exactly the
	 * habit somebody reading {@code SignInApi} would carry over. The two requests are
	 * identical, so nothing but the address being taken can be deciding, and the
	 * difference is read off the socket rather than out of a handler.
	 *
	 * <p>The reverse, if the owner ever changes his mind, is one line in
	 * {@code RegistrationApi} and this case - and the ADL entry says so in as many words:
	 * „obrnuti oblik je jedan ekran i nijedna migracija".
	 */
	@Test
	void theSecondRegistrationAtOneAddressIsToldThatItIsTaken() throws Exception {
		String token = aFreshToken();

		HttpResponse<String> first = registering(token, token);
		HttpResponse<String> second = registering(token, token);

		assertThat(first.statusCode()).isEqualTo(204);
		assertThat(second.statusCode())
				.as("the second registration at one address was answered exactly as the first,"
						+ " which is the shape the owner weighed and did not choose")
				.isEqualTo(409);
		assertThat(second.body())
				.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_ADDRESS_IS_TAKEN + "\"}");
		assertThat(second.statusCode()).isNotEqualTo(first.statusCode());

		assertThat(db.sql("select count(*) from account where lower(email) = lower(?)")
				.param(ADDRESS).query(Integer.class).single())
				.as("the second registration wrote a second account")
				.isOne();
		assertThat(db.sql("select count(*) from competitor where first_name = 'Mrezni'")
				.query(Integer.class).single())
				.as("the second registration left a person in the register of members behind it")
				.isOne();
	}
}
