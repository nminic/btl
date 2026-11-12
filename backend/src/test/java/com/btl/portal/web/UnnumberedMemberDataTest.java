package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * {@code GET} and {@code PUT /api/members/unnumbered/{competitorId}/data}: the data of somebody who
 * registered and has no member number yet, read and corrected from the screen Uplate before his fee is
 * booked (owner, 10.11.2026, PDL „Ekran Uplate: izmena podataka pre knjiženja i čišćenje reda"; see
 * {@link MemberDataApi#readUnnumbered}).
 *
 * <p><b>Every rule of the correction itself is {@link MemberDataWriteApiTest}'s</b> and is not repeated:
 * both addresses hand the member they name to one method. What is measured here is only what the new
 * address adds, and that is WHOM THE KEY NAMES and WHO MAY ASK.
 *
 * <p><b>THE POSTAVKA KEEPS EVERY SOURCE OF THE MEMBER APART</b> ({@code CLAUDE.md}, „Dva izvora, jedna
 * vrednost"). The registrant corrected is never the first row nor the only one without a number: a second
 * registrant without a number is brought in first. Beside them stand somebody with a number and an
 * account (he has the other address), somebody from the imported history with neither a number nor an
 * account (he never registered), and the moderator over the members, who has registered and not paid
 * either, so his own record is on the same list.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class UnnumberedMemberDataTest {

	private static final String THE_SUPERADMIN = "superadmin-bez-broja@primer.rs";

	private static final String OVER_THE_MEMBERS = "moderator-clanovi-bez-broja@primer.rs";

	private static final String OVER_THE_PAYMENTS_ONLY = "moderator-uplate-bez-broja@primer.rs";

	private static final String A_MEMBER = "clan-bez-broja@primer.rs";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, phone, shirt_size, health_statement_at";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@MockitoSpyBean
	private Postman postman;

	private final Map<String, String> cookies = new HashMap<>();

	/** Registered, no number, and brought in FIRST, so a key read as „the first one" lands here. */
	private long theOtherRegistrant;

	/** Registered, no number: the one every read and correction below is about. */
	private long theRegistrant;

	/** Registered and given a number, 000005: he has the address by his number and none by key. */
	private long numbered;

	/** From the imported history: no number and no account. He never registered. */
	private long neverRegistered;

	/** The moderator over the members, who has registered and not paid: no number either. */
	private long theModeratorHimself;

	@BeforeEach
	void registrantsAndTheAdministration() {
		doNothing().when(postman).send(any(Said.class), anyString());

		theOtherRegistrant = competitor(null, "b1", "Drugi");
		theRegistrant = competitor(null, "b2", "Prijavljeni");
		numbered = competitor("000005", "b3", "Brojni");
		neverRegistered = competitor(null, "b4", "Istorijski");
		theModeratorHimself = competitor(null, "b5", "Moderator");

		account("drugi-bez-broja@primer.rs", "competitor", theOtherRegistrant);
		account("prijavljeni-bez-broja@primer.rs", "competitor", theRegistrant);
		account(A_MEMBER, "competitor", numbered);
		account(OVER_THE_MEMBERS, "moderator", theModeratorHimself);
		ticked(OVER_THE_MEMBERS, "entity:members");
		account(OVER_THE_PAYMENTS_ONLY, "moderator", null);
		ticked(OVER_THE_PAYMENTS_ONLY, "queue:payments");
		account(THE_SUPERADMIN, "superadmin", null);
	}

	private long competitor(String number, String suffix, String name) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, ?, 'Clan', 'M',"
						+ " date '1990-05-15', " + A_TOWN_IN_SERBIA + ", null, null, 2027, ?, null, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', '0601234567', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, name, "0022aabbccddee" + suffix)
				.query(Long.class).single();
	}

	private void account(String email, String role, Long competitor) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id, email_confirmed_at,"
						+ " password_hash) values ('Ime', 'Prezime', ?, (select id from role where code = ?), ?, ?,"
						+ " '{bcrypt}$2a$10$notarealhashnotarealhashnotarealhashnotarealhashnotarea')")
				.params(email, role, competitor, Timestamp.from(Instant.parse("2026-09-02T10:00:00Z")))
				.update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
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

	private MockHttpServletResponse read(String key, String email) throws Exception {
		return sent(get("/api/members/unnumbered/" + key + "/data"), email);
	}

	private MockHttpServletResponse corrected(String key, String json, String email) throws Exception {
		return sent(put("/api/members/unnumbered/" + key + "/data").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(json), email);
	}

	private JsonNode body(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	private String nameOf(long competitor) {
		return db.sql("select first_name || ' ' || last_name || ' ' || coalesce(member_number, '-')"
				+ " from competitor where id = ?").param(competitor).query(String.class).single();
	}

	private Map<String, Object> everybody() {
		Map<String, Object> now = new LinkedHashMap<>();

		for (long one : List.of(theOtherRegistrant, theRegistrant, numbered, neverRegistered, theModeratorHimself)) {
			now.put("row " + one, nameOf(one));
		}

		now.put("messages", db.sql("select count(*) from message").query(Long.class).single());

		return now;
	}

	// --- who may ---

	@Test
	void aVisitorIsAskedToSignIn() throws Exception {
		Map<String, Object> before = everybody();

		assertThat(read(Long.toString(theRegistrant), null).getStatus()).isEqualTo(401);
		assertThat(corrected(Long.toString(theRegistrant), "{\"firstName\": \"Novo\"}", null).getStatus())
				.isEqualTo(401);
		assertThat(everybody()).isEqualTo(before);
	}

	/**
	 * „Podatke člana bez članskog broja menjaju isti kao danas: admin i moderator sa pravom nad članovima"
	 * (owner, 10.11.2026, with the recommendation). The moderator of the payments works on the very screen
	 * that lists the man and holds a right, only not this one: 404, ADL A8, as for a member.
	 */
	@Test
	void theRightOverThePaymentsAloneOpensNothingHere() throws Exception {
		Map<String, Object> before = everybody();

		for (String refused : List.of(OVER_THE_PAYMENTS_ONLY, A_MEMBER)) {
			assertThat(read(Long.toString(theRegistrant), refused).getStatus()).as(refused).isEqualTo(404);
			assertThat(corrected(Long.toString(theRegistrant), "{\"firstName\": \"Novo\"}", refused).getStatus())
					.as(refused).isEqualTo(404);
		}

		assertThat(everybody()).isEqualTo(before);
	}

	@Test
	void theRightOverTheMembersAndTheSuperadminReadHim() throws Exception {
		for (String allowed : List.of(OVER_THE_MEMBERS, THE_SUPERADMIN)) {
			MockHttpServletResponse answer = read(Long.toString(theRegistrant), allowed);

			assertThat(answer.getStatus()).as(allowed).isEqualTo(200);
			assertThat(body(answer).path("firstName").asString()).as(allowed).isEqualTo("Prijavljeni");
		}
	}

	// --- whom the key names ---

	/**
	 * THE KEY NAMES THE ROW IT IS THE KEY OF, and not the first registrant without a number, who is
	 * brought in first for exactly that reason. The answer is the shape of the other address, with the
	 * number null.
	 */
	@Test
	void theKeyNamesHimAndNotTheFirstWithoutANumber() throws Exception {
		JsonNode his = body(read(Long.toString(theRegistrant), OVER_THE_MEMBERS));
		JsonNode theOthers = body(read(Long.toString(theOtherRegistrant), OVER_THE_MEMBERS));

		assertThat(his.path("firstName").asString()).isEqualTo("Prijavljeni");
		assertThat(his.path("email").asString()).isEqualTo("prijavljeni-bez-broja@primer.rs");
		assertThat(his.path("memberNumber").isNull()).isTrue();
		assertThat(theOthers.path("firstName").asString()).isEqualTo("Drugi");
	}

	/**
	 * A MEMBER WITH A NUMBER HAS HIS ADDRESS AND NOT A SECOND ONE, and somebody from the imported history
	 * who never registered has none at all: the list on Uplate is whoever signed himself up. Both a 404,
	 * the answer of a key nobody has, and nothing written about either.
	 */
	@Test
	void aNumberedMemberAndOneWhoNeverRegisteredAreNotHere() throws Exception {
		Map<String, Object> before = everybody();

		for (long nobodyHere : List.of(numbered, neverRegistered)) {
			assertThat(read(Long.toString(nobodyHere), THE_SUPERADMIN).getStatus()).as(nameOf(nobodyHere))
					.isEqualTo(404);
			assertThat(corrected(Long.toString(nobodyHere), "{\"firstName\": \"Novo\"}", THE_SUPERADMIN)
					.getStatus()).as(nameOf(nobodyHere)).isEqualTo(404);
		}

		assertThat(everybody()).isEqualTo(before);
		/* And the numbered one is answered at his own address, so the 404 above is about the key. */
		assertThat(sent(get("/api/members/000005/data"), THE_SUPERADMIN).getStatus()).isEqualTo(200);
	}

	/**
	 * A KEY IS SPELT ONE WAY: a leading zero, a letter, a number past what a key can hold, all name nobody
	 * and are answered as a key nobody has, never as a malformed request and never as an alias of a row.
	 */
	@Test
	void aKeySpeltAnyOtherWayNamesNobody() throws Exception {
		Map<String, Object> before = everybody();

		for (String key : List.of("0" + theRegistrant, theRegistrant + "a", "99999999999999999999", "-1",
				Long.toString(Long.MAX_VALUE))) {
			assertThat(read(key, THE_SUPERADMIN).getStatus()).as(key).isEqualTo(404);
			assertThat(corrected(key, "{\"firstName\": \"Novo\"}", THE_SUPERADMIN).getStatus()).as(key)
					.isEqualTo(404);
		}

		assertThat(everybody()).isEqualTo(before);
	}

	/** NoTextHoldsAZeroTest names both paths as „a 400 before any handler is reached"; this is that. */
	@Test
	void aZeroInTheKeyIsRefusedBeforeTheHandlerIsReached() throws Exception {
		Map<String, Object> before = everybody();

		assertThat(sent(get(URI.create("/api/members/unnumbered/%00/data")), THE_SUPERADMIN).getStatus())
				.isEqualTo(400);
		assertThat(sent(put(URI.create("/api/members/unnumbered/%00/data")).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"firstName\": \"Novo\"}"), THE_SUPERADMIN)
				.getStatus()).isEqualTo(400);
		assertThat(everybody()).isEqualTo(before);
	}

	// --- the correction ---

	@Test
	void theCorrectionLandsOnHimAloneAndTheAnswerIsWhatAReadNowSays() throws Exception {
		MockHttpServletResponse answer = corrected(Long.toString(theRegistrant),
				"{\"firstName\": \"Petar\", \"lastName\": \"Peric\"}", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(nameOf(theRegistrant)).isEqualTo("Petar Peric -");
		assertThat(nameOf(theOtherRegistrant)).isEqualTo("Drugi Clan -");
		assertThat(nameOf(numbered)).isEqualTo("Brojni Clan 000005");
		assertThat(body(answer)).isEqualTo(body(read(Long.toString(theRegistrant), OVER_THE_MEMBERS)));
		/* He is told, as a member with a number is (M7, „član dobija poruku u sanduče"). */
		assertThat(db.sql("select to_id from message").query(Long.class).list()).containsExactly(theRegistrant);
	}

	/**
	 * „moderator ne ispravlja svoj zapis" (M7) holds at this address too, and here it is not a corner: a
	 * moderator who races and has not paid is on the list on Uplate like anybody, so his own row has the
	 * pencil. The same moderator corrects somebody else in the next request.
	 */
	@Test
	void aModeratorDoesNotCorrectHisOwnRecordHereEither() throws Exception {
		Map<String, Object> before = everybody();

		assertThat(corrected(Long.toString(theModeratorHimself), "{\"firstName\": \"Sam\"}", OVER_THE_MEMBERS)
				.getStatus()).isEqualTo(404);
		assertThat(everybody()).isEqualTo(before);
		assertThat(corrected(Long.toString(theRegistrant), "{\"firstName\": \"Drugi\"}", OVER_THE_MEMBERS)
				.getStatus()).isEqualTo(200);
	}
}
