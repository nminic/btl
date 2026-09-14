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

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * REGISTERING OVER A REAL SOCKET, for the two things MockMvc cannot say about it.
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
 * <p>No {@code @Transactional} here and there cannot be one: the server answers on its
 * own thread with its own connection, so a transaction held by the test would not be
 * the one the request writes in. The rows are cleaned up by hand instead, the way
 * {@code SignInOverRealHttpTest} does it.
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
	 * A RELAY THAT DOES NOT ANSWER LEAVES NOTHING BEHIND AT ALL.
	 *
	 * <p><b>This is the case that measures the transaction, and it can only live here.</b>
	 * {@code RegistrationApiTest} runs inside a transaction of its own, so the rows an
	 * endpoint writes are visible to it whether the endpoint's own transaction would have
	 * committed or not - a rollback there is indistinguishable from a commit. Over a
	 * socket the server has its own connection and its own transaction, and what is left
	 * in the table afterwards is what really happened.
	 *
	 * <p><b>Why it must leave nothing, rather than keeping the account and retrying the
	 * message.</b> Kept, the person holds an account he can neither confirm nor sign in to,
	 * at an address that is now taken - so registering again is refused, signing in is
	 * refused, and no screen he can reach fixes either. Nothing recovers that but the
	 * owner's own hand. Rolled back, he tries again in a minute and the address is free.
	 * That is why the message goes out INSIDE the transaction, and this is the case that
	 * fails the day somebody moves it out or takes {@code @Transactional} off.
	 *
	 * <p>GreenMail is stopped rather than the portal pointed elsewhere, because what has to
	 * fail is the send this request makes with the relay the running server was built with.
	 * The extension starts a fresh server for each test, so the next case is untouched.
	 */
	@Test
	void aRelayThatDoesNotAnswerLeavesNothingBehindAtAll() throws Exception {
		String token = aFreshToken();

		SMTP.getSmtp().stopService();

		HttpResponse<String> answer = registering(token, token);

		assertThat(answer.statusCode())
				.as("a registration whose confirmation message never went out was reported as"
						+ " having succeeded")
				.isEqualTo(500);
		assertThat(db.sql("select count(*) from account where lower(email) = lower(?)")
				.param(ADDRESS).query(Integer.class).single())
				.as("an account was left behind that can never be confirmed, at an address that"
						+ " can never be registered again")
				.isZero();
		assertThat(db.sql("select count(*) from competitor where first_name = 'Mrezni'")
				.query(Integer.class).single())
				.as("a person was left in the register of members with no account behind him")
				.isZero();
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
