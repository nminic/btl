package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.mail.MailLanguage;
import com.btl.portal.domain.mail.WhatTheMessageSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * {@code GET} and {@code PUT /api/members/{memberNumber}/data}: the administration over the members
 * reading and correcting a member's data (PDL, „Red člana, kartica Podaci i strana Podešavanja",
 * 22.10.2026, and what of M7 still stands; see {@link MemberDataWriteApi}).
 *
 * <p><b>THE POSTAVKA KEEPS EVERY SOURCE OF A VALUE APART FROM EVERY OTHER</b> ({@code CLAUDE.md},
 * „Dva izvora, jedna vrednost"). The member corrected is never the first row, never the one asking,
 * and never the only one with a book, a promise, a token or an account; the moderator who asks is a
 * member himself with data of his own; a third member holds tokens of his own that must survive; and
 * the day of the request is not the day anybody was born.
 */
@SpringBootTest(properties = "btl.superadmin.email=" + MemberDataWriteApiTest.NAMED_SUPERADMINS)
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MemberDataWriteApiTest {

	private static final Instant TODAY = Instant.parse("2027-10-20T09:00:00Z");

	/** Two named, neither held by any account of this class, and the second is the one asked about. */
	static final String NAMED_SUPERADMINS = "Glavni.Admin@Primer.rs,drugi-admin@primer.rs";

	private static final String THE_SUPERADMIN = "superadmin-podaci@primer.rs";

	private static final String OVER_THE_MEMBERS = "moderator-clanovi-podaci@primer.rs";

	private static final String OVER_THE_PAYMENTS_ONLY = "moderator-uplate-podaci@primer.rs";

	private static final String AN_ACTIVE_MEMBER = "clan-podaci@primer.rs";

	/** The corrected member's own address, not confirmed. */
	private static final String HIS_ADDRESS = "ispravljani@primer.rs";

	private static final String A_CONFIRMED_ONE = "potvrdjen-podaci@primer.rs";

	/** An account with no password and an address not confirmed, the other state of {@link #HIS_ADDRESS}. */
	private static final String HE_HAS_NONE = "bez-lozinke-podaci@primer.rs";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String ANOTHER_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank offset 1 limit 1)";

	private static final String A_TOWN_ABROAD =
			"(select id from place where country_id <> (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, phone, shirt_size, health_statement_at";

	private static final Path THE_REGISTRATION_FORM =
			Path.of("..", "frontend", "src", "forms", "definitions", "registracija.form.json");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Value("${btl.portal.address}")
	private String portalAddress;

	/**
	 * Watched, and told to hand nothing to a relay: M7 says „poruka u sanduče", so the correction
	 * itself is never mailed, and the one letter there is - the new link to a corrected address
	 * (owner, 22.10.2026) - is read off what was handed to it.
	 */
	@MockitoSpyBean
	private Postman postman;

	private final Map<String, String> cookies = new HashMap<>();

	/** Brought in first, so he is the first row and never the one corrected. */
	private long first;

	/** The member every correction below is about: 000005, in Serbia, an account not confirmed. */
	private long corrected;

	/** The moderator over the members is himself a member, 000003. */
	private long theModeratorHimself;

	/** A man and a woman in a racing pair of 2028: 000004 and 000006. */
	private long inAPair;

	private long hisPartner;

	/** 000007, with no account at all. */
	private long withNoAccount;

	/** 000008, whose account is confirmed. */
	private long confirmed;

	/** 000009, the superadmin's own record. */
	private long theSuperadminHimself;

	/** 000010, born 2013, under sixteen, a parent's consent on record, and a junior's promise. */
	private long aMinor;

	/**
	 * 000011, entered by the administration and never taken over: an account with NO PASSWORD and an
	 * address not confirmed, with links of both kinds sent to the old address (PDL, owner, 23.10.2026:
	 * which link a correction sends depends on this).
	 */
	private long withNoPassword;

	@BeforeEach
	void membersAndTheAdministration() {
		doNothing().when(postman).send(any(Said.class), anyString());

		first = competitor("000002", "a1", "Prvi", "M", "1980-01-01", A_TOWN_IN_SERBIA);
		theModeratorHimself = competitor("000003", "a2", "Moderator", "M", "1985-03-03", A_TOWN_IN_SERBIA);
		corrected = competitor("000005", "a3", "Ispravljani", "M", "1990-05-15", A_TOWN_IN_SERBIA);
		inAPair = competitor("000004", "a4", "Upar", "M", "1991-06-06", A_TOWN_IN_SERBIA);
		hisPartner = competitor("000006", "a5", "Partnerka", "F", "1992-07-07", A_TOWN_IN_SERBIA);
		withNoAccount = competitor("000007", "a6", "Bez", "M", "1970-02-02", A_TOWN_IN_SERBIA);
		confirmed = competitor("000008", "a7", "Potvrdjeni", "F", "1975-04-04", A_TOWN_IN_SERBIA);
		theSuperadminHimself = competitor("000009", "a8", "Super", "M", "1960-08-08", A_TOWN_ABROAD);
		aMinor = competitor("000010", "a9", "Mladi", "M", "2013-01-01", A_TOWN_IN_SERBIA);
		withNoPassword = competitor("000011", "aa", "Bezlozinke", "F", "1993-09-09", A_TOWN_IN_SERBIA);

		db.sql("insert into competitor_document (competitor_id, document_number) values (?, 'AB123'),"
				+ " (?, 'FIRST1'), (?, 'MINOR1')").params(corrected, first, aMinor).update();
		db.sql("insert into parental_consent (competitor_id, guardian_name, relation, given_at, given_from)"
						+ " values (?, 'Majka Mladog', 'mother', timestamptz '2026-09-01 10:00:00+00', '127.0.0.1')")
				.param(aMinor).update();
		db.sql("insert into racing_pair (season, man_id, woman_id) values (2028, ?, ?)")
				.params(inAPair, hisPartner).update();

		/* BOOKS AND PROMISES ON TWO MEMBERS, so one read off the wrong member cannot pass for his. */
		credited(corrected, "1200.00", "RSD");
		credited(first, "600.00", "RSD");
		promised(corrected, 2028, "1200.00", "RSD");
		promised(first, 2028, "600.00", "RSD");
		promised(aMinor, 2028, "0.00", "RSD");

		account(THE_SUPERADMIN, "superadmin", theSuperadminHimself, "Super", "Admin", true);
		account(OVER_THE_MEMBERS, "moderator", theModeratorHimself, "Mira", "Clanovic", true);
		ticked(OVER_THE_MEMBERS, "entity:members");
		account(OVER_THE_PAYMENTS_ONLY, "moderator", null, "Kasa", "Uplatic", true);
		ticked(OVER_THE_PAYMENTS_ONLY, "queue:payments");
		account(AN_ACTIVE_MEMBER, "competitor", first, "Prvi", "Clan", true);
		account(HIS_ADDRESS, "competitor", corrected, "Ispravljani", "Clan", false);
		account(HE_HAS_NONE, "competitor", withNoPassword, "Bezlozinke", "Clan", false, false);
		account(A_CONFIRMED_ONE, "competitor", confirmed, "Potvrdjeni", "Clan", true);
		account("upar@primer.rs", "competitor", inAPair, "Upar", "Clan", true);
		account("mladi@primer.rs", "competitor", aMinor, "Mladi", "Clan", true);

		/* LINKS SENT TO HIS ADDRESS, AND TO THE FIRST MEMBER'S, which must survive a correction
		   of his. */
		for (String email : List.of(HIS_ADDRESS, AN_ACTIVE_MEMBER, HE_HAS_NONE)) {
			db.sql("insert into email_verification_token (account_id, token_hash)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, SecretToken.fresh().hash()).update();
			db.sql("insert into password_reset_token (account_id, token_hash)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, SecretToken.fresh().hash()).update();
		}
	}

	private long competitor(String number, String suffix, String name, String gender, String born,
			String town) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, ?, 'Clan', ?,"
						+ " cast(? as date), " + town + ", null, null, 2027, true, ?, null, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', '0601234567', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, name, gender, born, "0011aabbccddee" + suffix)
				.query(Long.class).single();
	}

	private void credited(long competitor, String amount, String currency) {
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season, occurred_at,"
						+ " recorded_by_name) values (?, ?::numeric, ?, 'overpayment', 2027,"
						+ " timestamptz '2027-01-10 10:00:00+00', 'Blagajnik Probni')")
				.params(competitor, amount, currency).update();
	}

	private void promised(long competitor, int season, String amount, String currency) {
		db.sql("insert into balance_promise (competitor_id, season, amount, currency, promised_at)"
						+ " values (?, ?, ?::numeric, ?, timestamptz '2027-10-16 10:00:00+00')")
				.params(competitor, season, amount, currency).update();
	}

	private void account(String email, String role, Long competitor, String first, String last,
			boolean confirmedAddress) {
		account(email, role, competitor, first, last, confirmedAddress, true);
	}

	/** @param withAPassword whether the account has a password: one the administration entered has none */
	private void account(String email, String role, Long competitor, String first, String last,
			boolean confirmedAddress, boolean withAPassword) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id, email_confirmed_at,"
						+ " password_hash) values (?, ?, ?, (select id from role where code = ?), ?, ?, ?)")
				.params(first, last, email, role, competitor,
						confirmedAddress ? Timestamp.from(Instant.parse("2026-09-02T10:00:00Z")) : null,
						withAPassword ? "{bcrypt}$2a$10$notarealhashnotarealhashnotarealhashnotarealhashnotarea" : null)
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

	private MockHttpServletResponse read(String number, String email) throws Exception {
		return sent(get("/api/members/" + number + "/data"), email);
	}

	private MockHttpServletResponse corrected(String number, String json, String email) throws Exception {
		return sent(put("/api/members/" + number + "/data").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(json), email);
	}

	private JsonNode body(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	private long count(String sql, Object... params) {
		return db.sql(sql).params(params).query(Long.class).single();
	}

	/** Every message, as „to subject", so one to the wrong member or to everybody shows. */
	private List<String> messages() {
		return db.sql("select coalesce(to_id::text, 'everybody') || ' ' || subject from message order by id")
				.query(String.class).list();
	}

	/** The columns of one member's row a correction can move, in one line. */
	private String rowOf(long competitor) {
		return db.sql("select first_name || '|' || last_name || '|' || father_name || '|' || gender || '|'"
						+ " || birth_date || '|' || address || '|' || coalesce(phone, '-') || '|' || shirt_size"
						+ " || '|' || coalesce(place_id::text, '-') || '|' || coalesce(city, '-') || '|'"
						+ " || coalesce(country_id::text, '-') from competitor where id = ?")
				.param(competitor).query(String.class).single();
	}

	private String bookOf(long competitor) {
		return db.sql("select coalesce(sum(amount), 0) || ' ' || coalesce(min(currency), '-')"
						+ " || ' ' || count(*) from balance_entry where competitor_id = ?")
				.param(competitor).query(String.class).single();
	}

	private List<Integer> promisesOf(long competitor) {
		return db.sql("select season from balance_promise where competitor_id = ? order by season")
				.param(competitor).query(Integer.class).list();
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return body(answer).path("reason").asString();
	}

	private List<String> listIn(MockHttpServletResponse answer, String name) throws Exception {
		List<String> found = new ArrayList<>();

		body(answer).path(name).forEach(one -> found.add(one.asString()));

		return found;
	}

	/** Nothing about anybody moved: every row, book, promise, token, address and message as set up. */
	private void nothingWasWritten(Map<String, Object> before) {
		assertThat(everythingNow()).isEqualTo(before);
		verifyNoInteractions(postman);
	}

	private Map<String, Object> everythingNow() {
		Map<String, Object> now = new LinkedHashMap<>();

		for (long one : List.of(first, theModeratorHimself, corrected, inAPair, hisPartner, withNoAccount,
				confirmed, theSuperadminHimself, aMinor, withNoPassword)) {
			now.put("row " + one, rowOf(one));
			now.put("book " + one, bookOf(one));
			now.put("promises " + one, promisesOf(one));
		}

		now.put("documents", db.sql("select competitor_id || ' ' || document_number from competitor_document"
				+ " order by competitor_id").query(String.class).list());
		now.put("addresses", db.sql("select email from account order by id").query(String.class).list());
		now.put("tokens", count("select count(*) from email_verification_token")
				+ count("select count(*) from password_reset_token"));
		now.put("messages", messages());

		return now;
	}

	// --- who may ---

	@Test
	void aVisitorIsAskedToSignInAndNothingIsWritten() throws Exception {
		Map<String, Object> before = everythingNow();

		assertThat(read("000005", null).getStatus()).isEqualTo(401);
		assertThat(corrected("000005", "{\"firstName\": \"Novo\"}", null).getStatus()).isEqualTo(401);
		nothingWasWritten(before);
	}

	@Test
	void anybodyWithoutTheRightOverTheMembersIsToldThereIsNothingHere() throws Exception {
		Map<String, Object> before = everythingNow();

		/* ADL A8: 404. The member asks about another member and about himself alike, and the moderator
		   of the payments holds a right, only not this one. */
		for (String refused : List.of(AN_ACTIVE_MEMBER, OVER_THE_PAYMENTS_ONLY, "upar@primer.rs")) {
			assertThat(read("000005", refused).getStatus()).as(refused).isEqualTo(404);
			assertThat(corrected("000005", "{\"firstName\": \"Novo\"}", refused).getStatus()).as(refused)
					.isEqualTo(404);
		}

		nothingWasWritten(before);
	}

	@Test
	void aNumberNobodyHasIsAnAddressThatIsNotThereWhateverTheBodySays() throws Exception {
		assertThat(read("009999", OVER_THE_MEMBERS).getStatus()).isEqualTo(404);

		MockHttpServletResponse answer = corrected("009999", "{nije json", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString()).isEmpty();
	}

	@Test
	void aModeratorDoesNotCorrectHisOwnRecordAndIsToldItIsNotThere() throws Exception {
		Map<String, Object> before = everythingNow();

		/* „moderator ne ispravlja svoj zapis" (M7): the same 404 a number nobody has gets, whatever the
		   body, and the same moderator corrects somebody else's in the very next request. */
		MockHttpServletResponse answer = corrected("000003", "{nije json", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(corrected("000003", "{\"firstName\": \"Sam\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(404);
		nothingWasWritten(before);

		assertThat(corrected("000005", "{\"firstName\": \"Drugi\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(rowOf(corrected)).startsWith("Drugi|");
	}

	@Test
	void aModeratorStillReadsHisOwnData() throws Exception {
		MockHttpServletResponse answer = read("000003", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(body(answer).path("firstName").asString()).isEqualTo("Moderator");
	}

	@Test
	void theSuperadminCorrectsHisOwnRecord() throws Exception {
		/* „superadmin sme" (M7). */
		MockHttpServletResponse answer = corrected("000009", "{\"fatherName\": \"Drugi Otac\"}", THE_SUPERADMIN);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(rowOf(theSuperadminHimself)).contains("|Drugi Otac|");
	}

	/** NoTextHoldsAZeroTest names both paths as „a 400 before any handler is reached"; this is that. */
	@Test
	void aZeroInTheNumberOfTheAddressIsRefusedBeforeTheHandlerIsReached() throws Exception {
		Map<String, Object> before = everythingNow();

		assertThat(sent(get(URI.create("/api/members/%00/data")), THE_SUPERADMIN).getStatus()).isEqualTo(400);
		assertThat(sent(put(URI.create("/api/members/%00/data")).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"firstName\": \"Novo\"}"), THE_SUPERADMIN)
				.getStatus()).isEqualTo(400);
		nothingWasWritten(before);
	}

	// --- what is read ---

	@Test
	void everythingTheRegistrationAskedIsReadBarThePassword() throws Exception {
		MockHttpServletResponse answer = read("000005", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);

		JsonNode data = body(answer);
		Long geonames = db.sql("select p.geonames_id from competitor c join place p on p.id = c.place_id"
				+ " where c.id = ?").param(corrected).query(Long.class).single();

		assertThat(data.path("memberNumber").asString()).isEqualTo("000005");
		assertThat(data.path("firstName").asString()).isEqualTo("Ispravljani");
		assertThat(data.path("lastName").asString()).isEqualTo("Clan");
		assertThat(data.path("fatherName").asString()).isEqualTo("Otac");
		assertThat(data.path("gender").asString()).isEqualTo("M");
		assertThat(data.path("birthDate").asString()).isEqualTo("1990-05-15");
		assertThat(data.path("idNumber").asString()).isEqualTo("AB123");
		assertThat(data.path("email").asString()).isEqualTo(HIS_ADDRESS);
		assertThat(data.path("emailConfirmed").asBoolean()).isFalse();
		assertThat(data.path("emailConfirmed").isBoolean()).isTrue();
		assertThat(data.path("address").asString()).isEqualTo("Ulica 1");
		assertThat(data.path("phone").asString()).isEqualTo("0601234567");
		assertThat(data.path("placeId").asLong()).isEqualTo(geonames);
		/* THE TOWN IS NAMED WHICHEVER ROAD IT CAME BY (23.10.2026), so the form opens with it: the
		   codebook's own name and its country, read off the codebook and not written here. */
		assertThat(data.path("city").asString()).isEqualTo(db.sql("select p.name from competitor c"
				+ " join place p on p.id = c.place_id where c.id = ?").param(corrected).query(String.class).single());
		assertThat(data.path("country").asString()).isEqualTo("RS");
		assertThat(data.path("shirtSize").asString()).isEqualTo("M");

		Set<String> names = new TreeSet<>(data.propertyNames());

		assertThat(names).containsExactlyInAnyOrder("memberNumber", "firstName", "lastName", "fatherName",
				"gender", "birthDate", "idNumber", "email", "emailConfirmed", "address", "phone", "placeId",
				"city", "country", "shirtSize");
	}

	@Test
	void aMemberWithNoAccountAndNoDocumentHasNeitherAddressNorNumber() throws Exception {
		JsonNode data = body(read("000007", THE_SUPERADMIN));

		assertThat(data.path("email").isNull()).isTrue();
		assertThat(data.path("emailConfirmed").isNull()).isTrue();
		assertThat(data.path("idNumber").isNull()).isTrue();
		assertThat(body(read("000008", THE_SUPERADMIN)).path("emailConfirmed").asBoolean()).isTrue();
	}

	// --- what is refused about the form ---

	@Test
	void aBodyThatCannotBeActedOnNamesEveryFieldTheRouteTakes() throws Exception {
		Map<String, Object> before = everythingNow();

		for (String json : List.of("{nije json", "[]", "{}", "{\"placeId\": \"Beograd\"}", "\"ime\"")) {
			MockHttpServletResponse answer = corrected("000005", json, OVER_THE_MEMBERS);

			assertThat(answer.getStatus()).as(json).isEqualTo(400);
			assertThat(reasonIn(answer)).as(json).isEqualTo(MeWriteApi.THE_FORM_IS_NOT_COMPLETE);
			assertThat(listIn(answer, "missing")).as(json).isEqualTo(MemberDataWriteApi.WHAT_THIS_ROUTE_TAKES);
		}

		nothingWasWritten(before);
	}

	@Test
	void aNameTheRouteDoesNotTakeIsRefusedByNameAndNothingIsWritten() throws Exception {
		Map<String, Object> before = everythingNow();

		MockHttpServletResponse answer = corrected("000005", "{\"firstName\": \"Novo\", \"password\": \"x\","
				+ " \"beginner\": true, \"healthStatement\": true}", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MemberDataWriteApi.NOT_TAKEN_HERE);
		assertThat(listIn(answer, "fields")).containsExactly("password", "beginner", "healthStatement");
		nothingWasWritten(before);
	}

	@Test
	void aBoxLongerThanTheFormHoldsIsNamedAndOneAtTheLimitIsTaken() throws Exception {
		Map<String, Object> before = everythingNow();

		MockHttpServletResponse answer = corrected("000005", "{\"firstName\": \"" + "a".repeat(61)
				+ "\", \"fatherName\": \"" + "o".repeat(61) + "\", \"lastName\": \"" + "p".repeat(60)
				+ "\", \"phone\": \"" + "1".repeat(31) + "\", \"address\": \"" + "u".repeat(121)
				+ "\", \"city\": \"" + "g".repeat(81) + "\", \"country\": \"RS\"}", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MeWriteApi.A_FIELD_IS_TOO_LONG);
		assertThat(listIn(answer, "fields"))
				.containsExactly("firstName", "fatherName", "address", "phone", "city");
		nothingWasWritten(before);

		/* Stripped before it is measured, as the member's own form is. */
		assertThat(corrected("000005", "{\"firstName\": \"" + "a".repeat(60) + " \"}", OVER_THE_MEMBERS)
				.getStatus()).isEqualTo(200);
	}

	@Test
	void aFieldTheSchemaHoldsNotNullCannotBeEmptied() throws Exception {
		Map<String, Object> before = everythingNow();

		MockHttpServletResponse answer = corrected("000005", "{\"firstName\": \" \", \"fatherName\": \"\","
				+ " \"lastName\": \"Novo\", \"gender\": \"\", \"birthDate\": \" \", \"email\": \"\","
				+ " \"shirtSize\": \"\", \"address\": \"  \"}", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MeWriteApi.A_FIELD_IS_BLANK);
		assertThat(listIn(answer, "fields")).containsExactly("firstName", "fatherName", "address", "gender",
				"birthDate", "email", "shirtSize");
		nothingWasWritten(before);
	}

	@Test
	void aValueTheFormDoesNotOfferIsNamed() throws Exception {
		Map<String, Object> before = everythingNow();

		MockHttpServletResponse answer = corrected("000005", "{\"gender\": \"X\", \"birthDate\": \"15.05.1990\","
				+ " \"idNumber\": \"AB-12\", \"email\": \"bez-majmuna\", \"shirtSize\": \"XXXXL\","
				+ " \"firstName\": \"Novo\"}", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MeWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(listIn(answer, "missing")).containsExactly("gender", "birthDate", "idNumber", "email",
				"shirtSize");
		nothingWasWritten(before);
	}

	@Test
	void aDayAfterTodayIsNotADayOfBirth() throws Exception {
		Map<String, Object> before = everythingNow();

		MockHttpServletResponse answer = corrected("000005", "{\"birthDate\": \"2027-10-21\"}", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(listIn(answer, "missing")).containsExactly("birthDate");
		nothingWasWritten(before);

		/* And today itself is a day somebody can have been born on, with a parent's consent. */
		assertThat(corrected("000010", "{\"birthDate\": \"2027-10-20\"}", OVER_THE_MEMBERS).getStatus())
				.isEqualTo(200);
	}

	@Test
	void aTownIsSaidOnceAndIsOneThePortalKnows() throws Exception {
		Map<String, Object> before = everythingNow();

		MockHttpServletResponse twice = corrected("000005", "{\"placeId\": 1, \"city\": \"Grad\","
				+ " \"country\": \"RS\"}", OVER_THE_MEMBERS);
		MockHttpServletResponse unknown = corrected("000005", "{\"city\": \"Grad\", \"country\": \"XX\"}",
				OVER_THE_MEMBERS);

		assertThat(twice.getStatus()).isEqualTo(400);
		assertThat(reasonIn(twice)).isEqualTo(MeWriteApi.THE_TOWN_IS_NOT_SAID_ONCE);
		assertThat(unknown.getStatus()).isEqualTo(400);
		assertThat(reasonIn(unknown)).isEqualTo(MeWriteApi.THE_TOWN_IS_NOT_KNOWN);
		nothingWasWritten(before);
	}

	// --- what is written ---

	@Test
	void everythingIsCorrectedOnTheMemberTheAddressNamesAndHeIsToldWhich() throws Exception {
		String rowOfTheFirst = rowOf(first);
		Long abroad = db.sql("select p.geonames_id from place p where p.id = " + A_TOWN_ABROAD)
				.query(Long.class).single();

		MockHttpServletResponse answer = corrected("000005", "{\"firstName\": \" Petar \", \"lastName\": \"Peric\","
				+ " \"fatherName\": \"Jovan\", \"gender\": \"F\", \"birthDate\": \"1991-02-03\","
				+ " \"idNumber\": \"CD456\", \"email\": \" Nova.Adresa@Primer.rs \", \"address\": \"Druga 2\","
				+ " \"phone\": \"065111222\", \"placeId\": " + abroad + ", \"shirtSize\": \"XL\"}",
				OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);

		/* THE ROW OF THE MEMBER THE ADDRESS NAMES, and the first member and the moderator untouched. */
		assertThat(rowOf(corrected)).isEqualTo("Petar|Peric|Jovan|F|1991-02-03|Druga 2|065111222|XL|"
				+ db.sql("select id from place where id = " + A_TOWN_ABROAD).query(Long.class).single() + "|-|-");
		assertThat(rowOf(first)).isEqualTo(rowOfTheFirst);
		assertThat(rowOf(theModeratorHimself)).startsWith("Moderator|");

		assertThat(db.sql("select document_number from competitor_document where competitor_id = ?")
				.param(corrected).query(String.class).single()).isEqualTo("CD456");
		assertThat(db.sql("select document_number from competitor_document where competitor_id = ?")
				.param(first).query(String.class).single()).isEqualTo("FIRST1");

		/* THE ADDRESS, folded as every address is stored, and every link sent to the old one retired -
		   his and nobody else's. */
		assertThat(db.sql("select email from account where competitor_id = ?").param(corrected)
				.query(String.class).single()).isEqualTo("nova.adresa@primer.rs");
		assertThat(count("select count(*) from password_reset_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", corrected)).isZero();

		/* AND ONE NEW LINK, AT ONCE, TO THE CORRECTED ADDRESS (owner, PDL 22.10.2026: „portal odmah
		   šalje novu vezu za potvrdu na ispravljenu adresu"): the only link his account now has, in
		   the letter the confirmation always sends, to the address the row now carries and to nobody
		   else - not the old one, not the moderator who sent the correction. */
		ArgumentCaptor<Said> letter = ArgumentCaptor.forClass(Said.class);
		ArgumentCaptor<String> to = ArgumentCaptor.forClass(String.class);

		verify(postman, times(1)).send(letter.capture(), to.capture());
		assertThat(to.getValue()).isEqualTo("nova.adresa@primer.rs");
		assertThat(letter.getValue().subject()).isEqualTo(WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS,
				MailLanguage.SERBIAN, new Portal(portalAddress), "x").subject());

		Matcher token = Pattern.compile("potvrda-adrese\\?token=([A-Za-z0-9_-]+)").matcher(letter.getValue().body());

		assertThat(token.find()).as(letter.getValue().body()).isTrue();
		assertThat(db.sql("select a.competitor_id from email_verification_token t join account a on a.id = t.account_id"
						+ " where t.token_hash = ?").param(SecretToken.hashOf(token.group(1)))
				.query(Long.class).single()).isEqualTo(corrected);
		assertThat(count("select count(*) from email_verification_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", corrected)).isOne();
		assertThat(count("select count(*) from email_verification_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", first)).isOne();
		assertThat(count("select count(*) from password_reset_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", first)).isOne();

		/* ONE MESSAGE, TO HIM, FROM THE LEAGUE, naming every datum and no value. */
		assertThat(messages()).containsExactly(corrected + " Izmenjeni su vaši podaci");
		assertThat(db.sql("select coalesce(from_id::text, '-') || ' | ' || from_name || ' | ' || body from message")
				.query(String.class).single())
				.isEqualTo("- | Balkanska trkačka liga | Administracija lige je izmenila vaše podatke: ime, prezime,"
						+ " ime oca, pol, datum rođenja, broj ličnog dokumenta, adresa elektronske pošte, adresa,"
						+ " telefon, mesto, veličina majice.\n\nBalkanska trkačka liga");

		/* AND THE ANSWER IS WHAT A READ NOW SAYS. */
		assertThat(body(answer)).isEqualTo(body(read("000005", OVER_THE_MEMBERS)));
	}

	@Test
	void aCorrectionNamesOnlyWhatMovedAndASaveOfWhatStoodTellsNothing() throws Exception {
		MockHttpServletResponse same = corrected("000005", "{\"firstName\": \"Ispravljani\", \"gender\": \"M\","
				+ " \"birthDate\": \"1990-05-15\", \"idNumber\": \"AB123\", \"email\": \"ISPRAVLJANI@primer.rs\","
				+ " \"shirtSize\": \"M\"}", OVER_THE_MEMBERS);

		assertThat(same.getStatus()).isEqualTo(200);
		assertThat(messages()).isEmpty();
		verifyNoInteractions(postman);
		/* The same address in other letters is the same address: no link was retired. The three
		   accounts of the fixture that hold links hold one of this kind each. */
		assertThat(count("select count(*) from email_verification_token")).isEqualTo(3);

		assertThat(corrected("000005", "{\"lastName\": \"Novic\", \"firstName\": \"Ispravljani\"}",
				OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(db.sql("select body from message").query(String.class).single())
				.startsWith("Administracija lige je izmenila vaše podatke: prezime.");
	}

	/**
	 * EVERY FIELD SENT ALONE IS A REQUEST, and none of them is mistaken for a body that names nothing:
	 * a country alone is a town said by half, which is its own refusal and not „the form is empty".
	 */
	@Test
	void everyFieldSentAloneIsARequestAboutIt() throws Exception {
		assertThat(corrected("000005", "{\"lastName\": \"Samo\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(corrected("000005", "{\"shirtSize\": \"XXL\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(rowOf(corrected)).startsWith("Ispravljani|Samo|").contains("|XXL|");

		MockHttpServletResponse half = corrected("000005", "{\"country\": \"RS\"}", OVER_THE_MEMBERS);

		assertThat(half.getStatus()).isEqualTo(400);
		assertThat(reasonIn(half)).isEqualTo(MeWriteApi.THE_TOWN_IS_NOT_SAID_ONCE);
	}

	@Test
	void aPhoneEmptiedIsRemovedAndOneLeftOutIsKept() throws Exception {
		assertThat(corrected("000005", "{\"address\": \"Treca 3\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(rowOf(corrected)).contains("|Treca 3|0601234567|");

		assertThat(corrected("000005", "{\"phone\": \" \"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(rowOf(corrected)).contains("|Treca 3|-|");
	}

	@Test
	void aTypedTownIsWrittenWithItsCountry() throws Exception {
		assertThat(corrected("000005", "{\"city\": \" Mali Grad \", \"country\": \"RS\"}", OVER_THE_MEMBERS)
				.getStatus()).isEqualTo(200);

		JsonNode data = body(read("000005", OVER_THE_MEMBERS));

		assertThat(data.path("placeId").isNull()).isTrue();
		assertThat(data.path("city").asString()).isEqualTo("Mali Grad");
		assertThat(data.path("country").asString()).isEqualTo("RS");
		assertThat(db.sql("select body from message").query(String.class).single()).contains(": mesto.");
	}

	/**
	 * NOT TO AN ADDRESS THE SETTINGS NAME AS THE SUPERADMIN'S (owner, 23.10.2026). Typed in other
	 * letters and with spaces, and the second of the two named as well as the first.
	 */
	@Test
	void anAddressTheSettingsNameAsTheSuperadminsIsRefused() throws Exception {
		Map<String, Object> before = everythingNow();

		for (String named : List.of(" glavni.admin@primer.RS ", "DRUGI-ADMIN@primer.rs")) {
			MockHttpServletResponse answer = corrected("000005", "{\"email\": \"" + named + "\"}", OVER_THE_MEMBERS);

			assertThat(answer.getStatus()).as(named).isEqualTo(409);
			assertThat(reasonIn(answer)).as(named).isEqualTo(MemberDataWriteApi.THE_ADDRESS_IS_THE_SUPERADMINS);
		}

		nothingWasWritten(before);
	}

	/** The new link is written in the language the account's mail is written in, not always Serbian. */
	@Test
	void theNewLinkIsInTheLanguageOfHisMail() throws Exception {
		db.sql("update account set mail_language = 'en' where competitor_id = ?").param(corrected).update();

		assertThat(corrected("000005", "{\"email\": \"engleski@primer.rs\"}", OVER_THE_MEMBERS).getStatus())
				.isEqualTo(200);

		ArgumentCaptor<Said> letter = ArgumentCaptor.forClass(Said.class);

		verify(postman, times(1)).send(letter.capture(), anyString());
		assertThat(letter.getValue().subject()).isEqualTo(WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS,
				MailLanguage.ENGLISH, new Portal(portalAddress), "x").subject());
	}

	/**
	 * AN ACCOUNT WITH NO PASSWORD IS SENT THE LINK TO SET ONE, NOT THE LINK TO CONFIRM, AND SPENDING IT
	 * CONFIRMS THE ADDRESS TOO.
	 *
	 * <p>PDL, owner, 23.10.2026, choosing among the outcomes offered with my recommendation beside it:
	 * when the administration corrects the address of a member who has NO password, the portal sends
	 * him the link to set a password (it confirms the address as well) instead of the link to confirm;
	 * a member who has a password still gets the link to confirm (the case below).
	 *
	 * <p><b>The other state of the same fact is in the same fixture</b>: {@link #HIS_ADDRESS} has a
	 * password and {@link #HE_HAS_NONE} has none, both unconfirmed, both with links of both kinds sent
	 * to the old address, so a link chosen by the wrong account, by the wrong column or by nothing is a
	 * different row. The letter is the invitation's own (always Serbian, owner, 10.10.2026, Q4), goes
	 * to the corrected address and to nobody else, and the one link the account now has is a link to
	 * set a password, written for him and not for the member beside him whose links survive. The link
	 * is SPENT here, not only read: the address is confirmed and the password is set by it.
	 */
	@Test
	void anAccountWithNoPasswordIsSentTheLinkToSetOneAndSpendingItConfirmsTheAddress() throws Exception {
		assertThat(corrected("000011", "{\"email\": \" Nova.Bez.Lozinke@Primer.rs \"}", OVER_THE_MEMBERS)
				.getStatus()).isEqualTo(200);

		ArgumentCaptor<Said> letter = ArgumentCaptor.forClass(Said.class);
		ArgumentCaptor<String> to = ArgumentCaptor.forClass(String.class);

		verify(postman, times(1)).send(letter.capture(), to.capture());
		assertThat(to.getValue()).isEqualTo("nova.bez.lozinke@primer.rs");
		assertThat(letter.getValue().subject()).isEqualTo(WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER,
				new Portal(portalAddress), "x").subject());

		Matcher token = Pattern.compile("nova-lozinka\\?token=([A-Za-z0-9_-]+)").matcher(letter.getValue().body());

		assertThat(token.find()).as(letter.getValue().body()).isTrue();
		assertThat(db.sql("select a.competitor_id from password_reset_token t join account a on a.id = t.account_id"
						+ " where t.token_hash = ?").param(SecretToken.hashOf(token.group(1)))
				.query(Long.class).single()).isEqualTo(withNoPassword);

		/* THE ONLY LINK HE HAS NOW, of the one kind, and nothing of the other: the old links are
		   retired, the link to confirm is not written. The others' links stand. */
		assertThat(count("select count(*) from password_reset_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", withNoPassword)).isOne();
		assertThat(count("select count(*) from email_verification_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", withNoPassword)).isZero();
		assertThat(count("select count(*) from password_reset_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", first)).isOne();
		assertThat(count("select count(*) from email_verification_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", first)).isOne();
		assertThat(count("select count(*) from password_reset_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", corrected)).isOne();

		/* SPENT: the password is set and the address, which was not confirmed, is. */
		assertThat(db.sql("select email_confirmed_at is null and password_hash is null from account"
				+ " where competitor_id = ?").param(withNoPassword).query(Boolean.class).single()).isTrue();

		MockHttpServletResponse spent = http.perform(post("/api/password-reset").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"token\":\"" + token.group(1) + "\",\"password\":\"trcim.kroz.sumu.2027\","
								+ "\"passwordRepeat\":\"trcim.kroz.sumu.2027\"}"))
				.andReturn().getResponse();

		assertThat(spent.getStatus()).isEqualTo(204);
		assertThat(db.sql("select email_confirmed_at is not null and password_hash is not null from account"
				+ " where competitor_id = ?").param(withNoPassword).query(Boolean.class).single()).isTrue();
	}

	/** The account that has a password is sent the link to confirm, and the one beside it, with none, is not. */
	@Test
	void anAccountWithAPasswordIsSentTheLinkToConfirmAndNotTheLinkToSetOne() throws Exception {
		assertThat(corrected("000005", "{\"email\": \"s.lozinkom@primer.rs\"}", OVER_THE_MEMBERS).getStatus())
				.isEqualTo(200);

		ArgumentCaptor<Said> letter = ArgumentCaptor.forClass(Said.class);

		verify(postman, times(1)).send(letter.capture(), eq("s.lozinkom@primer.rs"));
		assertThat(letter.getValue().body()).contains("potvrda-adrese?token=").doesNotContain("nova-lozinka");
		assertThat(count("select count(*) from password_reset_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", corrected)).isZero();
		assertThat(count("select count(*) from email_verification_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", corrected)).isOne();
		assertThat(count("select count(*) from email_verification_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", withNoPassword)).isOne();
	}

	/**
	 * A RELAY THAT DOES NOT TAKE THE LETTER DOES NOT TAKE THE CORRECTION BACK: it is committed, the
	 * link is written, and asking for another („Pošalji ponovo") is what gets him out of it, the
	 * answer `resend` gives to the same failure.
	 */
	@Test
	void aLetterTheRelayDoesNotTakeLeavesTheCorrectionAndItsLinkStanding() throws Exception {
		doThrow(new MailSendException("the relay is not there")).when(postman).send(any(Said.class), anyString());

		assertThat(corrected("000005", "{\"email\": \"bez-releja@primer.rs\"}", OVER_THE_MEMBERS).getStatus())
				.isEqualTo(200);
		assertThat(db.sql("select email from account where competitor_id = ?").param(corrected)
				.query(String.class).single()).isEqualTo("bez-releja@primer.rs");
		assertThat(count("select count(*) from email_verification_token t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?", corrected)).isOne();
	}

	// --- the money ---

	@Test
	void aTownInAnotherCountryRestatesHisBookAndForgetsHisCodesInTheModeratorsName() throws Exception {
		Long abroad = db.sql("select p.geonames_id from place p where p.id = " + A_TOWN_ABROAD)
				.query(Long.class).single();

		assertThat(corrected("000005", "{\"placeId\": " + abroad + "}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);

		/* 1200 RSD at 120 is 10 EUR, and the lines name the moderator who sent it, not the member. */
		assertThat(db.sql("select coalesce(sum(amount), 0) from balance_entry where competitor_id = ?"
				+ " and currency = 'EUR'").param(corrected).query(String.class).single()).isEqualTo("10.00");
		assertThat(db.sql("select distinct recorded_by_name from balance_entry where competitor_id = ?"
				+ " and reason <> 'overpayment'").param(corrected).query(String.class).list())
				.containsExactly("Mira Clanovic");
		assertThat(promisesOf(corrected)).isEmpty();

		/* The first member's book and code are his and stay. */
		assertThat(bookOf(first)).isEqualTo("600.00 RSD 1");
		assertThat(promisesOf(first)).containsExactly(2028);
	}

	@Test
	void aTownInTheSameCountryMovesNoMoney() throws Exception {
		Long another = db.sql("select p.geonames_id from place p where p.id = " + ANOTHER_TOWN_IN_SERBIA)
				.query(Long.class).single();

		assertThat(corrected("000005", "{\"placeId\": " + another + "}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(bookOf(corrected)).isEqualTo("1200.00 RSD 1");
		assertThat(promisesOf(corrected)).containsExactly(2028);
	}

	@Test
	void aDateOfBirthThatMovesTheJuniorPriceForgetsThatSeasonsCodeAndADayDoesNot() throws Exception {
		/* Born 2013: 2028 - 2013 = 15, a junior of 2028. A day later is still 2013 and still a junior. */
		assertThat(corrected("000010", "{\"birthDate\": \"2013-01-02\"}", OVER_THE_MEMBERS).getStatus())
				.isEqualTo(200);
		assertThat(promisesOf(aMinor)).containsExactly(2028);

		/* 2012 is sixteen in 2028 and pays the full price: the code minted for the junior goes. He is
		   still under sixteen today and his parent's consent stands. */
		assertThat(corrected("000010", "{\"birthDate\": \"2012-12-31\"}", OVER_THE_MEMBERS).getStatus())
				.isEqualTo(200);
		assertThat(promisesOf(aMinor)).isEmpty();
		assertThat(promisesOf(corrected)).containsExactly(2028);

		/* AND A YEAR THAT MOVES BUT CROSSES NO LINE KEEPS THE CODE: 1990 to 1989 is a grown man's
		   price in 2028 either way. It is the year compared and not the price, otherwise. */
		assertThat(corrected("000005", "{\"birthDate\": \"1989-05-15\"}", OVER_THE_MEMBERS).getStatus())
				.isEqualTo(200);
		assertThat(promisesOf(corrected)).containsExactly(2028);
	}

	// --- the rules of M7 ---

	@Test
	void theGenderOfAMemberInAPairIsNotChangedAndHeIsToldWhy() throws Exception {
		Map<String, Object> before = everythingNow();

		MockHttpServletResponse answer = corrected("000004", "{\"gender\": \"F\", \"firstName\": \"Drugo\"}",
				OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(MemberDataWriteApi.A_PAIR_HOLDS_THE_GENDER);
		nothingWasWritten(before);

		/* The gender he already has is not a change, and everything else of his is still correctable. */
		assertThat(corrected("000004", "{\"gender\": \"M\", \"firstName\": \"Drugo\"}", OVER_THE_MEMBERS)
				.getStatus()).isEqualTo(200);

		/* And a member in no pair has his gender corrected. */
		assertThat(corrected("000007", "{\"gender\": \"F\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(rowOf(withNoAccount)).contains("|F|");
	}

	@Test
	void aDateThatMakesHimYoungerThanSixteenIsRefusedWithoutAParentsConsent() throws Exception {
		Map<String, Object> before = everythingNow();

		MockHttpServletResponse answer = corrected("000005", "{\"birthDate\": \"2012-10-21\"}", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(MemberDataWriteApi.A_MINOR_NEEDS_A_CONSENT);
		nothingWasWritten(before);

		/* Sixteen to the day, today, is old enough. */
		assertThat(corrected("000005", "{\"birthDate\": \"2011-10-20\"}", OVER_THE_MEMBERS).getStatus())
				.isEqualTo(200);
	}

	@Test
	void aDateSentBackAsItStoodIsNotACorrectionThatMakesAnybodyYounger() throws Exception {
		/* A member under sixteen with no consent on record, which no rule of the portal makes but a row
		   older than it may be: saving his form unchanged is not „making him younger". */
		db.sql("delete from parental_consent where competitor_id = ?").param(aMinor).update();

		assertThat(corrected("000010", "{\"birthDate\": \"2013-01-01\", \"firstName\": \"Mladji\"}",
				OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
	}

	@Test
	void aDocumentNumberIsRemovedOnlyFromAMemberUnderSixteen() throws Exception {
		Map<String, Object> before = everythingNow();

		MockHttpServletResponse adult = corrected("000005", "{\"idNumber\": \" \"}", OVER_THE_MEMBERS);

		assertThat(adult.getStatus()).isEqualTo(400);
		assertThat(reasonIn(adult)).isEqualTo(MeWriteApi.A_FIELD_IS_BLANK);
		assertThat(listIn(adult, "fields")).containsExactly("idNumber");
		nothingWasWritten(before);

		assertThat(corrected("000010", "{\"idNumber\": \"\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(count("select count(*) from competitor_document where competitor_id = ?", aMinor)).isZero();
		assertThat(count("select count(*) from competitor_document where competitor_id = ?", corrected)).isOne();

		/* And a member who never gave one is given one. */
		assertThat(corrected("000007", "{\"idNumber\": \"NEW1\"}", OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(body(read("000007", OVER_THE_MEMBERS)).path("idNumber").asString()).isEqualTo("NEW1");
	}

	@Test
	void anAddressIsCorrectedOnlyOnAnAccountAndOnlyWhileItIsNotConfirmed() throws Exception {
		Map<String, Object> before = everythingNow();

		MockHttpServletResponse confirmedOne = corrected("000008", "{\"email\": \"druga@primer.rs\"}",
				OVER_THE_MEMBERS);
		MockHttpServletResponse noAccount = corrected("000007", "{\"email\": \"prva@primer.rs\"}",
				OVER_THE_MEMBERS);
		/* Taken by another account, in other letters. */
		MockHttpServletResponse taken = corrected("000005", "{\"email\": \"CLAN-PODACI@primer.rs\"}",
				OVER_THE_MEMBERS);

		assertThat(confirmedOne.getStatus()).isEqualTo(409);
		assertThat(reasonIn(confirmedOne)).isEqualTo(MemberDataWriteApi.THE_ADDRESS_IS_CONFIRMED);
		assertThat(noAccount.getStatus()).isEqualTo(409);
		assertThat(reasonIn(noAccount)).isEqualTo(MemberDataWriteApi.THERE_IS_NO_ACCOUNT);
		assertThat(taken.getStatus()).isEqualTo(409);
		assertThat(reasonIn(taken)).isEqualTo(MemberDataWriteApi.THE_ADDRESS_IS_TAKEN);
		nothingWasWritten(before);

		/* AN ADDRESS STORED IN CAPITALS, which a row older than the fold can be (EmailConfirmationApi says
		   why the lookup is `lower` on both sides), is the same address as the one typed in small letters. */
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Stari', 'Nalog',"
				+ " 'Stari.Nalog@Primer.rs', (select id from role where code = 'competitor'))").update();

		MockHttpServletResponse inCapitals = corrected("000005", "{\"email\": \"stari.nalog@primer.rs\"}",
				OVER_THE_MEMBERS);

		assertThat(inCapitals.getStatus()).isEqualTo(409);
		assertThat(reasonIn(inCapitals)).isEqualTo(MemberDataWriteApi.THE_ADDRESS_IS_TAKEN);

		/* The superadmin's own address is confirmed, so not even he moves it through the portal. */
		assertThat(corrected("000009", "{\"email\": \"novi-super@primer.rs\"}", THE_SUPERADMIN).getStatus())
				.isEqualTo(409);
	}

	// --- floors over the form ---

	/**
	 * EVERY BOX THIS ROUTE BOUNDS IS BOUNDED BY THE NUMBER ON THE REGISTRATION'S FORM, read off the
	 * file rather than described, so the form and the server cannot come apart on a length.
	 */
	@Test
	void everyBoxIsAsLongAsTheRegistrationsFormSays() throws Exception {
		Map<String, Integer> onTheForm = new HashMap<>();

		mapper.readTree(Files.readString(THE_REGISTRATION_FORM)).path("fields").forEach(field -> {
			if (field.has("maxLength")) {
				onTheForm.put(field.path("name").asString(), field.path("maxLength").asInt());
			}
		});

		MemberDataWriteApi.EACH_BOX_ON_THE_FORM.forEach((name, box) ->
				assertThat(box.longest()).as(name).isEqualTo(onTheForm.get(name)));
		assertThat(MemberDataWriteApi.EACH_BOX_ON_THE_FORM).isNotEmpty();
	}

	/**
	 * EVERY FIELD OF THE REGISTRATION IS EITHER TAKEN HERE OR NAMED AS LIVING ELSEWHERE, with the
	 * reason, so a field added to the form tomorrow fails here until somebody says which it is - the
	 * same partition {@code MeWriteApiTest} keeps for the member's own route.
	 */
	@Test
	void everyFieldOfTheRegistrationIsTakenOrNamedAsLivingElsewhere() throws Exception {
		Map<String, String> elsewhere = new LinkedHashMap<>();

		elsewhere.put("password", "the owner: „samo bez lozinke\"");
		elsewhere.put("passwordRepeat", "the same, and it is the form checking itself");
		elsewhere.put("beginner", "the beginners' category has its own screen and route");
		elsewhere.put("healthStatement", "a moment recorded once at registration, not a fact");
		elsewhere.put("parentConsent", "evidence that a consent was given (V8), which is not edited");
		elsewhere.put("parentRelation", "the same row");

		List<String> onTheForm = new ArrayList<>();

		mapper.readTree(Files.readString(THE_REGISTRATION_FORM)).path("fields")
				.forEach(field -> onTheForm.add(field.path("name").asString()));

		List<String> unaccounted = onTheForm.stream()
				.filter(name -> !MemberDataWriteApi.WHAT_THIS_ROUTE_TAKES.contains(name))
				.filter(name -> !elsewhere.containsKey(name))
				.toList();

		assertThat(unaccounted).isEmpty();
		assertThat(elsewhere.keySet()).allSatisfy(name -> assertThat(onTheForm).contains(name));
		assertThat(elsewhere.keySet()).doesNotContainAnyElementsOf(MemberDataWriteApi.WHAT_THIS_ROUTE_TAKES);
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TheDayOfTheseCases {

		@Bean
		@Primary
		Clock theDayOfTheseCases() {
			return Clock.fixed(TODAY, ZoneOffset.UTC);
		}
	}
}
