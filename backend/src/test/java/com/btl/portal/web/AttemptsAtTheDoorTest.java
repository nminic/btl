package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * THE THREE HOURLY ALLOWANCES, AT THE NUMBERS THE PORTAL SHIPS WITH.
 *
 * <p>Owner, 21.11.2026 (ADL): „najviše 5 registracija sa jedne IP adrese na sat, i najviše 3 ponovna
 * slanja poruke za potvrdu po jednoj adresi na sat", and three an hour for a new password's link.
 *
 * <p><b>The numbers come off {@code src/main/resources/application.properties}</b>, read here and put
 * back over the test-wide override ({@code src/test/resources/config/application.properties}, which
 * raises them out of reach for every other context). So what a case meets here is what QA and
 * production meet, and the cases below still say 5 and 3 in so many words: a change to the shipped
 * numbers fails them.
 *
 * <p><b>Every case knocks with keys of its own</b> - its own network, its own address - because the
 * count is a singleton of the context and outlives the case, exactly as it outlives a request on the
 * server.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3337",
		"spring.mail.properties.mail.smtp.auth=false",
		"btl.portal.address=https://probni-portal.primer.rs"})
@Transactional
class AttemptsAtTheDoorTest {

	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3337));

	private static final Path SHIPPED = Path.of("src", "main", "resources", "application.properties");

	private static final String[] THE_THREE = {"btl.attempts.registrations-per-hour",
			"btl.attempts.confirmation-letters-per-hour", "btl.attempts.new-password-letters-per-hour"};

	/** Twelve characters and not on the shipped list of leaked ones. */
	private static final String PASSWORD = "trcim.kroz.sumu.2027";

	@DynamicPropertySource
	static void theNumbersThePortalShipsWith(DynamicPropertyRegistry settings) throws IOException {
		Properties shipped = new Properties();

		try (Reader reading = Files.newBufferedReader(SHIPPED, StandardCharsets.UTF_8)) {
			shipped.load(reading);
		}

		for (String one : THE_THREE) {
			String value = shipped.getProperty(one);

			assertThat(value).as("%s ships no %s", SHIPPED, one).isNotNull();
			settings.add(one, () -> value);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private Instant start;

	private int fresh;

	/** A clock the case moves, the shape `CommentWriteApiTest` uses and for the same reason. */
	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		private AClockTheCaseMoves(Instant now) {
			this.now = now;
		}

		void moveTo(Instant when) {
			this.now = when;
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisCaseUses {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(Instant.now());
		}
	}

	@BeforeEach
	void theClockGoesOnFromWhereTheLastCaseLeftIt() {
		/* FORWARD ONLY: the counts outlive the case, so a clock set back would put a later case's
		   attempts before an earlier one's. Every case's keys are its own anyway. */
		start = clock.instant().plus(Duration.ofHours(3));
		clock.moveTo(start);
	}

	private String aFresh(String what) {
		fresh++;

		return what + "-" + fresh + "-" + System.nanoTime();
	}

	private String aFreshAddress() {
		return aFresh("vrata") + "@primer.rs";
	}

	/** A network of its own for the case: 198.51.100.0/24 is documentation, and nobody's. */
	private String aFreshNetwork() {
		fresh++;

		return "198.51." + (fresh / 250) + "." + (fresh % 250 + 1);
	}

	private MockHttpServletResponse send(MockHttpServletRequestBuilder request, Object body) throws Exception {
		return http.perform(request.with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(new ObjectMapper().writeValueAsString(body)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse register(String network, Map<String, Object> form) throws Exception {
		return send(post("/api/registration").header(AttemptsAtTheDoor.THE_CALLERS_ADDRESS, network), form);
	}

	/** An attempt the form would never send: refused 400, and every attempt counts all the same. */
	private MockHttpServletResponse anIncompleteRegistration(String network) throws Exception {
		return register(network, Map.of());
	}

	private MockHttpServletResponse resend(String address) throws Exception {
		return send(post("/api/email-confirmation/resend"), Map.of("email", address));
	}

	private MockHttpServletResponse askForANewPassword(String address) throws Exception {
		return send(post("/api/password-reset/request"), Map.of("email", address));
	}

	private Map<String, Object> aGrownUpAt(String address) {
		Map<String, Object> form = new LinkedHashMap<>();
		LocalDate today = LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE);
		long town = db.sql("select geonames_id from place order by rank limit 1").query(Long.class).single();

		form.put("firstName", "Petar");
		form.put("lastName", "Petrovic");
		form.put("fatherName", "Milorad");
		form.put("birthDate", today.minusYears(30).toString());
		form.put("gender", "M");
		form.put("beginner", true);
		form.put("email", address);
		form.put("password", PASSWORD);
		form.put("passwordRepeat", PASSWORD);
		form.put("address", "Ulica slobode 15/4");
		form.put("placeId", town);
		form.put("idNumber", "AB1234567");
		form.put("phone", "+381601234567");
		form.put("shirtSize", "L");
		form.put("healthStatement", true);

		return form;
	}

	private long anUnconfirmedAccountAt(String address) {
		return db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = 'competitor'))"
						+ " returning id")
				.param(address).query(Long.class).single();
	}

	private int accountsAt(String address) {
		return db.sql("select count(*) from account where email = ?").param(address).query(Integer.class).single();
	}

	private int linksFor(long account) {
		return db.sql("select count(*) from email_verification_token where account_id = ?")
				.param(account).query(Integer.class).single();
	}

	private static void isTheRefusal(MockHttpServletResponse answer, String retryAfter) throws Exception {
		assertThat(answer.getStatus()).isEqualTo(429);
		assertThat(answer.getContentAsString()).isEqualTo("{\"reason\":\"tooManyAttempts\"}");
		assertThat(answer.getHeader("Retry-After")).isEqualTo(retryAfter);
	}

	// ------------------------------------------------------------------ registering, by network

	@Test
	void fiveRegistrationsFromOneNetworkAreLetInAndTheSixthIsRefusedForAnHour() throws Exception {
		String network = aFreshNetwork();

		for (int one = 1; one <= 5; one++) {
			assertThat(anIncompleteRegistration(network).getStatus()).as("attempt %d", one).isEqualTo(400);
		}

		isTheRefusal(anIncompleteRegistration(network), "3600");
	}

	@Test
	void aRegistrationThatIsWrittenCountsAndTheRefusedOneWritesAndSendsNothing() throws Exception {
		String network = aFreshNetwork();

		for (int one = 1; one <= 5; one++) {
			assertThat(register(network, aGrownUpAt(aFreshAddress())).getStatus()).as("registration %d", one)
					.isEqualTo(204);
		}

		assertThat(SMTP.waitForIncomingEmail(5000, 5)).isTrue();

		String sixth = aFreshAddress();

		isTheRefusal(register(network, aGrownUpAt(sixth)), "3600");
		assertThat(accountsAt(sixth)).isZero();
		assertThat(SMTP.waitForIncomingEmail(500, 6)).as("no sixth letter").isFalse();
	}

	@Test
	void anotherNetworkHasItsOwnFive() throws Exception {
		String spent = aFreshNetwork();

		for (int one = 1; one <= 5; one++) {
			anIncompleteRegistration(spent);
		}

		assertThat(anIncompleteRegistration(spent).getStatus()).isEqualTo(429);
		assertThat(anIncompleteRegistration(aFreshNetwork()).getStatus()).isEqualTo(400);
	}

	@Test
	void everyAddressOfOneIpv6NetworkSpendsTheSameFive() throws Exception {
		fresh++;
		String network = "2001:db8:" + Integer.toHexString(fresh) + ":7:";

		for (int one = 1; one <= 5; one++) {
			assertThat(anIncompleteRegistration(network + ":" + one).getStatus()).isEqualTo(400);
		}

		assertThat(anIncompleteRegistration(network + "ffff:ffff:ffff:ffff").getStatus()).isEqualTo(429);
		assertThat(anIncompleteRegistration("2001:db8:" + Integer.toHexString(fresh) + ":8::1").getStatus())
				.as("the next /64").isEqualTo(400);
	}

	@Test
	void theAllowanceComesBackOneAttemptAtATimeAnHourAfterEach() throws Exception {
		String network = aFreshNetwork();

		anIncompleteRegistration(network);

		for (int one = 2; one <= 5; one++) {
			clock.moveTo(start.plus(Duration.ofMinutes(10)));
			anIncompleteRegistration(network);
		}

		clock.moveTo(start.plus(Duration.ofMinutes(59)).plusSeconds(59));
		isTheRefusal(anIncompleteRegistration(network), "1");

		clock.moveTo(start.plus(Duration.ofHours(1)));
		assertThat(anIncompleteRegistration(network).getStatus()).as("the first ran out").isEqualTo(400);
		isTheRefusal(anIncompleteRegistration(network), Long.toString(Duration.ofMinutes(10).toSeconds()));
	}

	@Test
	void whatTheCallerWritesAboutHimselfIsNotRead() throws Exception {
		String network = aFreshNetwork();
		Function<Integer, MockHttpServletRequestBuilder> claiming = one -> post("/api/registration")
				.header(AttemptsAtTheDoor.THE_CALLERS_ADDRESS, network)
				.header("CF-Connecting-IP", "203.0.113." + one)
				.header("X-Forwarded-For", "203.0.113." + one)
				.header("X-Real-IP", "203.0.113." + one);

		for (int one = 1; one <= 5; one++) {
			assertThat(send(claiming.apply(one), Map.of()).getStatus()).isEqualTo(400);
		}

		assertThat(send(claiming.apply(6), Map.of()).getStatus()).as("a new address claimed every time")
				.isEqualTo(429);

		/* AND THE OTHER WAY ROUND: one claim made every time, a different network behind it. */
		for (int one = 1; one <= 6; one++) {
			assertThat(send(post("/api/registration")
					.header(AttemptsAtTheDoor.THE_CALLERS_ADDRESS, aFreshNetwork())
					.header("CF-Connecting-IP", network)
					.header("X-Forwarded-For", network), Map.of()).getStatus()).isEqualTo(400);
		}
	}

	@Test
	void withoutTheHeaderNginxWritesTheConnectionItselfIsCounted() throws Exception {
		String connection = aFreshNetwork();
		Function<String, MockHttpServletResponse> from = remote -> {
			try {
				return send(post("/api/registration").with(request -> {
					request.setRemoteAddr(remote);
					return request;
				}), Map.of());
			} catch (Exception failed) {
				throw new IllegalStateException(failed);
			}
		};

		for (int one = 1; one <= 5; one++) {
			assertThat(from.apply(connection).getStatus()).isEqualTo(400);
		}

		assertThat(from.apply(connection).getStatus()).isEqualTo(429);
		assertThat(from.apply(aFreshNetwork()).getStatus()).isEqualTo(400);
	}

	@Test
	void aHeaderThatIsNotAnAddressIsCountedAsWhatItSaysAndNotLetThroughUncounted() throws Exception {
		String nonsense = aFresh("not-an-address");

		for (int one = 1; one <= 5; one++) {
			anIncompleteRegistration(nonsense);
		}

		assertThat(anIncompleteRegistration(nonsense).getStatus()).isEqualTo(429);
	}

	// ------------------------------------------------------------- the two letters, by address

	@Test
	void threeLettersOfConfirmationForOneAddressAndTheFourthIsRefusedWithoutALink() throws Exception {
		String address = aFreshAddress();
		long account = anUnconfirmedAccountAt(address);

		for (int one = 1; one <= 3; one++) {
			assertThat(resend(address).getStatus()).as("letter %d", one).isEqualTo(204);
		}

		assertThat(SMTP.waitForIncomingEmail(5000, 3)).isTrue();

		isTheRefusal(resend(address), "3600");
		assertThat(linksFor(account)).as("no fourth link").isEqualTo(3);
		assertThat(SMTP.waitForIncomingEmail(500, 4)).as("no fourth letter").isFalse();
	}

	@Test
	void theFourthIsTheSameRefusalForAnAddressNobodyHoldsOneConfirmedAndOneWaiting() throws Exception {
		String nobody = aFreshAddress();
		String confirmed = aFreshAddress();
		String waiting = aFreshAddress();

		db.sql("update account set email_confirmed_at = now() where id = ?")
				.param(anUnconfirmedAccountAt(confirmed)).update();
		anUnconfirmedAccountAt(waiting);

		for (String address : new String[] {nobody, confirmed, waiting}) {
			for (int one = 1; one <= 3; one++) {
				assertThat(resend(address).getStatus()).as("%s, %d", address, one).isEqualTo(204);
			}

			isTheRefusal(resend(address), "3600");
		}
	}

	@Test
	void oneAddressIsOneCountHoweverItIsWritten() throws Exception {
		String address = aFreshAddress();

		resend(address);
		resend("  " + address.toUpperCase() + " ");
		resend(address.substring(0, 1).toUpperCase() + address.substring(1));

		assertThat(resend(address).getStatus()).isEqualTo(429);
	}

	@Test
	void anotherAddressHasItsOwnThreeAndABlankOneIsNeverCounted() throws Exception {
		String spent = aFreshAddress();

		for (int one = 1; one <= 3; one++) {
			resend(spent);
		}

		assertThat(resend(spent).getStatus()).isEqualTo(429);
		assertThat(resend(aFreshAddress()).getStatus()).isEqualTo(204);

		for (int one = 1; one <= 5; one++) {
			assertThat(resend("   ").getStatus()).isEqualTo(204);
			assertThat(askForANewPassword("   ").getStatus()).isEqualTo(204);
		}
	}

	@Test
	void theLetterOfConfirmationComesBackAnHourLater() throws Exception {
		String address = aFreshAddress();

		for (int one = 1; one <= 3; one++) {
			resend(address);
		}

		clock.moveTo(start.plus(Duration.ofMinutes(59)).plusSeconds(59));
		isTheRefusal(resend(address), "1");

		clock.moveTo(start.plus(Duration.ofHours(1)));
		assertThat(resend(address).getStatus()).isEqualTo(204);
	}

	@Test
	void threeRequestsForANewPasswordAndTheFourthIsRefusedAlikeForEveryAddress() throws Exception {
		String held = aFreshAddress();
		String nobody = aFreshAddress();

		anUnconfirmedAccountAt(held);

		for (String address : new String[] {held, nobody}) {
			for (int one = 1; one <= 3; one++) {
				assertThat(askForANewPassword(address).getStatus()).as("%s, %d", address, one).isEqualTo(204);
			}

			isTheRefusal(askForANewPassword(address), "3600");
		}

		assertThat(SMTP.waitForIncomingEmail(5000, 3)).isTrue();
		assertThat(SMTP.waitForIncomingEmail(500, 4)).as("no fourth letter to the address held").isFalse();

		clock.moveTo(start.plus(Duration.ofHours(1)));
		assertThat(askForANewPassword(nobody).getStatus()).isEqualTo(204);
	}

	@Test
	void theThreeDoorsAreThreeCounts() throws Exception {
		String address = aFreshAddress();

		for (int one = 1; one <= 3; one++) {
			resend(address);
		}

		assertThat(resend(address).getStatus()).isEqualTo(429);
		assertThat(askForANewPassword(address).getStatus()).as("the letters of confirmation spent nothing here")
				.isEqualTo(204);

		String other = aFreshAddress();

		for (int one = 1; one <= 3; one++) {
			askForANewPassword(other);
		}

		assertThat(askForANewPassword(other).getStatus()).isEqualTo(429);
		assertThat(resend(other).getStatus()).as("and the other way round").isEqualTo(204);

		/* AND REGISTERING SPENDS NEITHER, even keyed by the very same text: a header that is not an
		   address is counted as what it says, so the two keys are equal here and only the count tells
		   them apart. */
		String both = aFreshAddress();

		for (int one = 1; one <= 5; one++) {
			anIncompleteRegistration(both);
		}

		assertThat(resend(both).getStatus()).isEqualTo(204);
		assertThat(askForANewPassword(both).getStatus()).isEqualTo(204);
	}

}
