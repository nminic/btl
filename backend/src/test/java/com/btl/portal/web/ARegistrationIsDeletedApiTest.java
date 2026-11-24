package com.btl.portal.web;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * {@code DELETE /api/members/unnumbered/{competitorId}} AND {@code mayBeDeleted} ON {@code GET /api/payments}:
 * the administration deletes, from the screen Uplate, a registration that never became a member, and
 * nothing else (the owner, 23.11.2026, „Imam dva Borka Olara, želim jednog da obrišem za stalno", and the set
 * of „Obriši nalog" of 20.11.2026).
 *
 * <p><b>THE AXES, EACH WITH BOTH STATES.</b>
 * <ul>
 * <li><b>Each clause of the set</b>: {@link ThingsOfTheLeague#BLOCKERS}, the very list {@code
 * MeLeavingApiTest} measures {@code DELETE /api/me} over, gives him one row that breaks one clause; he is
 * refused for it, and the list stops offering him. With none of them he goes. Removing a clause from the
 * condition, or reading anything but the condition on this route or on the list, turns a case here.
 * <li><b>Whom the key names</b>: he is never the only registration. His namesake, registered the same way
 * with the same name, the same town and the same day of birth, stands beside him in every case, was
 * brought in FIRST (so „the first one" lands on the namesake), and must stand after he goes, with his
 * session, on the list, still offered. Beside them a member with a number and an account, and somebody of
 * the imported history with neither.
 * <li><b>Who asks</b>: nobody signed in (401), a member and a moderator holding only the payments (404, ADL
 * A8), a moderator over the members (deletes), and a request without the token (403).
 * <li><b>The log</b>: one line, with the key of his ACCOUNT and the time, and never his name, his address
 * of post or the key of his row; the two keys are made to differ, so the line cannot name one by naming
 * the other.
 * <li><b>The mail</b>: none is sent.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ARegistrationIsDeletedApiTest {

	private static final String OVER_THE_MEMBERS = "moderator-clanovi-brisanje-prijave@primer.rs";

	private static final String OVER_THE_PAYMENTS_ONLY = "moderator-uplate-brisanje-prijave@primer.rs";

	private static final String A_MEMBER = "clan-brisanje-prijave@primer.rs";

	private static final String HIS_ADDRESS = "borko-drugi@primer.rs";

	private static final String THE_NAMESAKES_ADDRESS = "borko-prvi@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@MockitoSpyBean
	private Postman postman;

	private final Map<String, String> cookies = new HashMap<>();

	private int issued;

	/** Registered first, with his name: the one who must stay. */
	private long theNamesake;

	/** Registered second, with the same name: the one deleted. */
	private long him;

	private long hisAccount;

	private SecretToken hisSession;

	private SecretToken theNamesakesSession;

	/** Given a number, with an account: he is at the other address and none by key. */
	private long numbered;

	/** Of the imported history: no number and no account. He never registered. */
	private long neverRegistered;

	private ThingsOfTheLeague.Around around;

	@BeforeEach
	void twoBorkosAndTheAdministration() {
		doNothing().when(postman).send(any(Said.class), anyString());

		theNamesake = competitor(null);
		theNamesakesSession = account(THE_NAMESAKES_ADDRESS, "competitor", theNamesake);

		/* AN ACCOUNT NOBODY USES, so the key of his account and the key of his row part: the line in the log
		   is asked for the one and must not carry the other, and with both the same number that could not be
		   told. */
		account("razmak-brisanje-prijave@primer.rs", "competitor", null);
		him = competitor(null);
		hisSession = account(HIS_ADDRESS, "competitor", him);
		hisAccount = db.sql("select id from account where competitor_id = ?").param(him).query(Long.class).single();

		numbered = competitor("099801");
		account(A_MEMBER, "competitor", numbered);
		neverRegistered = competitor(null);

		account(OVER_THE_MEMBERS, "moderator", null);
		ticked(OVER_THE_MEMBERS, CompetitorApi.OVER_THE_MEMBERS);
		/* AND THE PAYMENTS, so he reads the list the button stands on; the deletion asks only the first. */
		ticked(OVER_THE_MEMBERS, "queue:payments");
		account(OVER_THE_PAYMENTS_ONLY, "moderator", null);
		ticked(OVER_THE_PAYMENTS_ONLY, "queue:payments");

		around = ThingsOfTheLeague.Around.in(db, theNamesake);

		assertThat(hisAccount).as("the two keys must differ for the log to be measured").isNotEqualTo(him);
	}

	private long competitor(String number) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Borko', 'Olar', 'M', date '1990-01-01', " + ThingsOfTheLeague.A_TOWN_IN_SERBIA
						+ ", 2027, ?, '', false, 'none', 'Otac', 'Ulica 1', 'M', now()) returning id")
				.params(number, String.format("%016x", 0x0b0dL * 1000 + ++issued))
				.query(Long.class).single();
	}

	/**
	 * @param competitor null for an account that races for nobody, the administration's; an account that
	 *                   names a registration is left with its address UNCONFIRMED, as both Borkos on
	 *                   production were („bez potvrđene adrese", PDL 23.11.2026); the member with a number
	 *                   has his confirmed, since he is the one who signs in
	 */
	private SecretToken account(String email, String role, Long competitor) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id, email_confirmed_at,"
						+ " password_hash) values ('Borko', 'Olar', ?, (select id from role where code = ?), ?, ?,"
						+ " '{bcrypt}$2a$10$notarealhashnotarealhashnotarealhashnotarealhashnotarea')")
				.params(email, role, competitor,
						competitor == null || competitor == numbered
								? Timestamp.from(Instant.parse("2026-09-02T10:00:00Z")) : null)
				.update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());

		return session;
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private MockHttpServletResponse sent(MockHttpServletRequestBuilder asks, String email) throws Exception {
		return http.perform(email == null ? asks : asks.cookie(new Cookie(SessionCookie.NAME, cookies.get(email))))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse deleting(String key, String email) throws Exception {
		return sent(delete("/api/members/unnumbered/" + key).with(csrf()), email);
	}

	/** Who of the list is offered „Obriši", as the screen Uplate reads it, by key. */
	private Map<Long, Boolean> offered() throws Exception {
		return offeredTo(OVER_THE_MEMBERS);
	}

	/** The same, as the list is served to whoever asks. */
	private Map<Long, Boolean> offeredTo(String email) throws Exception {
		MockHttpServletResponse answer = sent(get("/api/payments"), email);

		assertThat(answer.getStatus()).as("GET /api/payments").isEqualTo(200);

		Map<Long, Boolean> rows = new LinkedHashMap<>();

		for (JsonNode row : mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8)).get("accounts")) {
			rows.put(row.get("competitorId").asLong(), row.get("mayBeDeleted").asBoolean());
		}

		return rows;
	}

	private boolean stands(long competitor) {
		return db.sql("select count(*) from competitor where id = ?").param(competitor).query(Long.class).single()
				== 1;
	}

	private boolean open(SecretToken session) {
		return db.sql("select count(*) from account_session where token_hash = ?")
				.param(session.hash()).query(Long.class).single() == 1;
	}

	private Map<String, Object> everybody() {
		Map<String, Object> now = new LinkedHashMap<>();

		for (long one : List.of(theNamesake, him, numbered, neverRegistered)) {
			now.put("row " + one, stands(one));
			now.put("accounts of " + one, db.sql("select count(*) from account where competitor_id = ?")
					.param(one).query(Long.class).single());
		}

		now.put("his session", open(hisSession));
		now.put("the namesake's session", open(theNamesakesSession));

		return now;
	}

	private record Heard(List<String> lines) {
	}

	private static Heard heardWhile(Callable<?> passing) throws Exception {
		Logger speaking = (Logger) LoggerFactory.getLogger(ARegistrationIsDeletedApi.class);
		ListAppender<ILoggingEvent> heard = new ListAppender<>();

		heard.start();
		speaking.addAppender(heard);

		try {
			passing.call();

			return new Heard(heard.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
		}
		finally {
			speaking.detachAppender(heard);
			heard.stop();
		}
	}

	// --- who goes ---

	@Test
	void theAdministrationDeletesOneBorkoAndTheOtherStaysOffered() throws Exception {
		assertThat(offered()).as("both are offered before")
				.containsEntry(him, true).containsEntry(theNamesake, true)
				.doesNotContainKey(neverRegistered);
		assertThat(offered().get(numbered)).as("a member with a number is not offered").isFalse();

		Instant before = Instant.now();
		MockHttpServletResponse[] answer = new MockHttpServletResponse[1];
		Heard heard = heardWhile(() -> answer[0] = deleting(Long.toString(him), OVER_THE_MEMBERS));
		Instant after = Instant.now();

		assertThat(answer[0].getStatus()).isEqualTo(204);
		assertThat(answer[0].getContentAsString()).isEmpty();

		assertThat(stands(him)).as("he is still there").isFalse();
		assertThat(db.sql("select count(*) from account where email = ?").param(HIS_ADDRESS)
				.query(Long.class).single()).as("his account outlived him").isZero();
		assertThat(open(hisSession)).as("his session outlived his account").isFalse();

		assertThat(stands(theNamesake)).as("the other Borko went with him").isTrue();
		assertThat(open(theNamesakesSession)).as("the other Borko's session went with him").isTrue();
		assertThat(stands(numbered)).isTrue();
		assertThat(stands(neverRegistered)).isTrue();

		assertThat(offered()).as("the list after the deletion")
				.doesNotContainKey(him).containsEntry(theNamesake, true);

		verify(postman, never()).send(any(Said.class), anyString());

		assertThat(heard.lines()).as("one line in the log, and only one").hasSize(1);

		String line = heard.lines().getFirst();
		Matcher said = Pattern.compile("account (\\d+) was deleted by the administration at (\\S+)$").matcher(line);

		assertThat(said.find()).as(line).isTrue();
		assertThat(Long.parseLong(said.group(1))).as("the key in the log is not his account's").isEqualTo(hisAccount);
		assertThat(Instant.parse(said.group(2))).as("the time in the log is not the time of the deletion")
				.isBetween(before, after);
		assertThat(line).as("the log names him").doesNotContain("Borko", "Olar", HIS_ADDRESS, "primer.rs")
				.doesNotContain(" " + him + " ");
	}

	@Test
	void aSecondPressFindsNobodyAndSaysNothing() throws Exception {
		assertThat(deleting(Long.toString(him), OVER_THE_MEMBERS).getStatus()).isEqualTo(204);

		Map<String, Object> before = everybody();
		MockHttpServletResponse[] again = new MockHttpServletResponse[1];
		Heard heard = heardWhile(() -> again[0] = deleting(Long.toString(him), OVER_THE_MEMBERS));

		assertThat(again[0].getStatus()).isEqualTo(404);
		assertThat(again[0].getContentAsString()).isEmpty();
		assertThat(heard.lines()).as("a deletion that deleted nothing was logged").isEmpty();
		assertThat(everybody()).isEqualTo(before);
	}

	@ParameterizedTest
	@MethodSource("com.btl.portal.web.ThingsOfTheLeague#blockers")
	void oneThingOfTheLeagueBehindHimAndHeIsNeitherOfferedNorDeleted(String what) throws Exception {
		ThingsOfTheLeague.BLOCKERS.get(what).accept(around, him);

		assertThat(offered().getOrDefault(him, false)).as("%s, and the list offers him", what).isFalse();
		assertThat(offered()).as("%s of his took the button from the other Borko", what)
				.containsEntry(theNamesake, true);

		Map<String, Object> before = everybody();
		MockHttpServletResponse[] answer = new MockHttpServletResponse[1];
		Heard heard = heardWhile(() -> answer[0] = deleting(Long.toString(him), OVER_THE_MEMBERS));

		assertThat(answer[0].getStatus()).as("%s, and he was not answered as an address that is not there", what)
				.isEqualTo(404);
		assertThat(answer[0].getContentAsString()).as(what).isEmpty();
		assertThat(heard.lines()).as(what).isEmpty();
		assertThat(everybody()).as("%s, and somebody was deleted", what).isEqualTo(before);
	}

	@Test
	void aMemberWithANumberAndSomebodyWhoNeverRegisteredAreNotAtThisAddress() throws Exception {
		Map<String, Object> before = everybody();

		for (long nobody : List.of(numbered, neverRegistered)) {
			MockHttpServletResponse answer = deleting(Long.toString(nobody), OVER_THE_MEMBERS);

			assertThat(answer.getStatus()).as("row %d", nobody).isEqualTo(404);
			assertThat(answer.getContentAsString()).isEmpty();
		}

		assertThat(everybody()).isEqualTo(before);
	}

	@ParameterizedTest
	@ValueSource(strings = {"999999999999", "0", "007", "7a", "1234567890123456789"})
	void aKeyNobodyHasOrOneSpeltOtherwiseIsAnAddressThatIsNotThere(String key) throws Exception {
		Map<String, Object> before = everybody();

		MockHttpServletResponse answer = deleting(key, OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString()).isEmpty();
		assertThat(everybody()).isEqualTo(before);
	}

	@Test
	void aKeySpeltWithALeadingZeroDoesNotReachHim() throws Exception {
		Map<String, Object> before = everybody();

		assertThat(deleting("0" + him, OVER_THE_MEMBERS).getStatus()).isEqualTo(404);
		assertThat(everybody()).isEqualTo(before);
	}

	// --- who asks ---

	@Test
	void nobodySignedInIsAskedToSignIn() throws Exception {
		Map<String, Object> before = everybody();

		assertThat(deleting(Long.toString(him), null).getStatus()).isEqualTo(401);
		assertThat(everybody()).isEqualTo(before);
	}

	/**
	 * „Pravo ima ko ima pravo da briše člana u redu tabele članova" (PDL 23.11.2026, derived from the
	 * precedent). The moderator of the payments works on the very screen that lists him and holds a right,
	 * only not this one: 404 (ADL A8), as for a member.
	 */
	@Test
	void theRightOverThePaymentsAloneDeletesNothing() throws Exception {
		Map<String, Object> before = everybody();

		for (String refused : List.of(OVER_THE_PAYMENTS_ONLY, A_MEMBER)) {
			MockHttpServletResponse answer = deleting(Long.toString(him), refused);

			assertThat(answer.getStatus()).as(refused).isEqualTo(404);
			assertThat(answer.getContentAsString()).as(refused).isEmpty();
		}

		assertThat(everybody()).isEqualTo(before);
	}

	/**
	 * THE OFFER IS THE SERVER'S AND NOT THE SCREEN'S (owner, 24.11.2026, PDL „Sitnice iz recenzije PR-a 815
	 * i 811 i panela tima": „server ne šalje oznaku da prijava sme da se obriše moderatoru koji nema pravo nad
	 * članovima"). The moderator of the payments reads the very list and holds a right, only not the one over
	 * the members, so every row he is served says no, and the one the moderator over the members is offered
	 * stays offered to him: the same list, the same morning, two answers.
	 */
	@Test
	void theModeratorOfThePaymentsAloneIsOfferedNoDeletionAtAll() throws Exception {
		assertThat(offeredTo(OVER_THE_MEMBERS)).as("the one with the right is offered him").containsEntry(him, true);

		Map<Long, Boolean> his = offeredTo(OVER_THE_PAYMENTS_ONLY);

		assertThat(his).as("the list is the same list").containsKey(him);
		assertThat(his.values()).as("a deletion offered to somebody the route answers 404").doesNotContain(true);
	}

	@Test
	void withoutTheTokenNothingIsDeleted() throws Exception {
		Map<String, Object> before = everybody();

		assertThat(sent(delete("/api/members/unnumbered/" + him), OVER_THE_MEMBERS).getStatus()).isEqualTo(403);
		assertThat(everybody()).isEqualTo(before);
	}
}
