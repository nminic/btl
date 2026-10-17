package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * {@code PUT /api/me/mail-language}: whoever holds an account chooses the language of his mail
 * (PDL, „Odgovori vlasnika 17.10.2026, jezik pošte": „Jezik pošte sme da promeni svako ko ima
 * nalog").
 *
 * <p><b>The axes, named so that a source cannot stand in for another.</b> Whose row: the member
 * who writes is neither the first account by key nor the only one, and a third member already holds
 * English, so an update that wrote the first row, every row, or nobody's would each leave a
 * different column wrong. Who may: every signed-in account, so a member who never paid, a member
 * whose fee has lapsed and a moderator who races for nobody each change their own row, and a caller
 * who is not signed in is 401.
 *
 * <p><b>What this cannot tell apart, said rather than left to be found:</b> an answer read back off
 * the row and one echoed from the request are the same value by construction (only a known code is
 * written, and it is stored as it is), so the mutation that echoes passes here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MeMailLanguageApiTest {

	private static final String PATH = "/api/me/mail-language";

	private static final String NOTHING_IS_THERE = "/api/zzzzzzzzzz";

	/** The first member by key, written before the one who chooses. */
	private static final String FIRST_BY_KEY = "000051";

	/** The member who writes in every case below. */
	private static final String HE_CHOOSES = "000052";

	/** A member who already chose English, so „every row became Serbian" is a change too. */
	private static final String ALREADY_ENGLISH = "000053";

	/** A member who has not paid: no number, and his fee does not stand. */
	private static final String NEVER_PAID = "neplacen@primer.rs";

	/** A member whose fee has lapsed: a number, and his fee does not stand. */
	private static final String LAPSED = "000054";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final ObjectMapper mapper = new ObjectMapper();

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	@BeforeEach
	void threeMembersOneWhoHasNotPaidAndAModerator() {
		competitor(FIRST_BY_KEY, true);
		competitor(HE_CHOOSES, true);
		competitor(ALREADY_ENGLISH, true);
		competitor(null, false);
		competitor(LAPSED, false);

		account(FIRST_BY_KEY + "@primer.rs", "competitor", "number", FIRST_BY_KEY);
		account(HE_CHOOSES + "@primer.rs", "competitor", "number", HE_CHOOSES);
		account(ALREADY_ENGLISH + "@primer.rs", "competitor", "number", ALREADY_ENGLISH);
		account(NEVER_PAID, "competitor", "unpaid", null);
		account(LAPSED + "@primer.rs", "competitor", "number", LAPSED);
		account(MODERATOR_WHO_DOES_NOT_RACE, "moderator", null, null);

		db.sql("update account set mail_language = 'en' where email = ?")
				.param(ALREADY_ENGLISH + "@primer.rs").update();
	}

	@Test
	void aVisitorWhoIsNotSignedInIsRefusedAndAMemberIsNot() throws Exception {
		assertThat(sentBy(null, PATH, choosing("en")).getStatus()).isEqualTo(401);
		assertThat(sentBy(HE_CHOOSES + "@primer.rs", PATH, choosing("en")).getStatus()).isEqualTo(200);
	}

	/**
	 * EVERY ACCOUNT MAY, WHATEVER ITS FEE AND WHETHER IT NAMES A MEMBER AT ALL: the owner's choice of
	 * 17.10.2026, „jer je to podešavanje naloga a ne takmičarsko pravo". Each writes his own row and
	 * nobody else's, which the member who chooses in every other case does not touch.
	 */
	@Test
	void everyAccountMayWhateverItsFeeAndWhetherItNamesAMember() throws Exception {
		for (String caller : List.of(MODERATOR_WHO_DOES_NOT_RACE, NEVER_PAID, LAPSED + "@primer.rs")) {
			MockHttpServletResponse written = sentBy(caller, PATH, choosing("en"));

			assertThat(written.getStatus()).as("%s was turned away", caller).isEqualTo(200);
			assertThat(languageOf(caller)).as("%s was answered 200 and his column did not move", caller)
					.isEqualTo("en");
		}

		assertThat(languageOf(HE_CHOOSES + "@primer.rs"))
				.as("somebody else's request wrote the row of the member who chooses")
				.isEqualTo("sr");
	}

	@Test
	void aFormWithNoLanguageInItIsRefusedAndSaysWhatIsMissing() throws Exception {
		for (String nothing : List.of("{}", "{\"language\":null}", "{\"language\":\"de\"}",
				"{\"language\":\"EN\"}", "{\"somethingElse\":\"en\"}", "not json at all")) {

			MockHttpServletResponse refused = sentBy(HE_CHOOSES + "@primer.rs", PATH, nothing);

			assertThat(refused.getStatus()).as("a body of %s was not refused", nothing).isEqualTo(400);
			assertThat(mapper.readTree(refused.getContentAsString()).path("reason").asString())
					.isEqualTo("theFormIsNotComplete");
			assertThat(missingIn(refused)).containsExactly("language");
		}

		assertThat(languageOf(HE_CHOOSES + "@primer.rs"))
				.as("a refused form still wrote something into his column")
				.isEqualTo("sr");
	}

	@Test
	void theRefusalNamesEveryFieldTheFormHasAndNoOther() throws Exception {
		List<String> theFormsOwnFields = new ArrayList<>();

		for (var component : MeMailLanguageApi.Chosen.class.getRecordComponents()) {
			theFormsOwnFields.add(component.getName());
		}

		assertThat(theFormsOwnFields).isNotEmpty();
		assertThat(missingIn(sentBy(HE_CHOOSES + "@primer.rs", PATH, "{}")))
				.containsExactlyInAnyOrderElementsOf(theFormsOwnFields);
	}

	@Test
	void aWriteWithNoContentTypeIsAnsweredAsAnAddressThatIsNotThere() throws Exception {
		MockHttpServletResponse typeless = untyped(PATH);

		assertThat(typeless.getStatus()).isEqualTo(404);
		assertThat(typeless.getContentAsString()).isEqualTo(untyped(NOTHING_IS_THERE).getContentAsString());
	}

	@Test
	void theLanguageIsWrittenForTheAccountWhoseSessionItIsAndForNobodyElse() throws Exception {
		MockHttpServletResponse written = sentBy(HE_CHOOSES + "@primer.rs", PATH, choosing("en"));

		assertThat(written.getStatus()).isEqualTo(200);
		assertThat(mapper.readTree(written.getContentAsString()).path("language").asString())
				.isEqualTo("en");

		assertThat(languageOf(HE_CHOOSES + "@primer.rs"))
				.as("the route answered that it had written and the column says otherwise")
				.isEqualTo("en");
		assertThat(languageOf(FIRST_BY_KEY + "@primer.rs"))
				.as("the first account by key was changed by somebody else's request")
				.isEqualTo("sr");
		assertThat(languageOf(MODERATOR_WHO_DOES_NOT_RACE)).isEqualTo("sr");

		sentBy(HE_CHOOSES + "@primer.rs", PATH, choosing("sr"));

		assertThat(languageOf(ALREADY_ENGLISH + "@primer.rs"))
				.as("a third member's column moved, so the update has no where clause worth the name")
				.isEqualTo("en");
	}

	@Test
	void theChoiceIsChangedAsOftenAsHeLikesAndTheAnswerIsTheRow() throws Exception {
		for (String language : List.of("en", "sr", "en")) {
			MockHttpServletResponse written = sentBy(HE_CHOOSES + "@primer.rs", PATH, choosing(language));

			assertThat(written.getStatus()).isEqualTo(200);
			assertThat(written.getContentAsString()).isEqualTo("{\"language\":\"" + language + "\"}");
			assertThat(languageOf(HE_CHOOSES + "@primer.rs")).isEqualTo(language);
		}
	}

	/* ------------------------------------------------------------------- the fixture */

	private void competitor(String number, boolean active) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', ?, 'M', date '1985-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, number == null ? "Neplacen" : "Clan" + number, active,
						String.format("%016x", ++issued))
				.update();
	}

	/**
	 * @param member how the account names its member: {@code number} by the member number, {@code
	 *               unpaid} as the one member with no number, or {@code null} for none at all
	 */
	private void account(String email, String role, String member, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

		if ("number".equals(member)) {
			db.sql("update account set competitor_id ="
							+ " (select id from competitor where member_number = ?) where email = ?")
					.params(memberNumber, email).update();
		} else if ("unpaid".equals(member)) {
			db.sql("update account set competitor_id ="
							+ " (select id from competitor where member_number is null) where email = ?")
					.param(email).update();
		}

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/* -------------------------------------------------------------------- the requests */

	private static String choosing(String language) {
		return "{\"language\":\"" + language + "\"}";
	}

	private MockHttpServletResponse sentBy(String email, String path, String body) throws Exception {
		MockHttpServletRequestBuilder asking = put(path).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(body);

		return http.perform(email == null ? asking
						: asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse untyped(String path) throws Exception {
		return http.perform(put(path).with(csrf()).content(choosing("en"))
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(HE_CHOOSES + "@primer.rs").secret())))
				.andReturn().getResponse();
	}

	/* -------------------------------------------------------------------- the answers */

	private List<String> missingIn(MockHttpServletResponse answer) throws Exception {
		List<String> named = new ArrayList<>();
		mapper.readTree(answer.getContentAsString()).path("missing")
				.forEach(one -> named.add(one.asString()));
		return named;
	}

	private String languageOf(String email) {
		return db.sql("select mail_language from account where email = ?")
				.param(email).query(String.class).single();
	}
}
