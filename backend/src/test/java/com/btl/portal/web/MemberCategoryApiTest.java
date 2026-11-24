package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.registration.WhatADataCorrectionSays;
import com.btl.portal.domain.registration.WhatADataCorrectionSays.Field;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE ADMINISTRATION'S CHOICE OF A MEMBER'S CATEGORY ON HIS CARD „PODACI" ({@link MemberCategoryApi}).
 *
 * <p>Owner, 24.11.2026 (PDL, „Administracija bira kategoriju članu u njegovim podacima, a u prijavi je
 * starosna podrazumevana"), and the rule derived beside it: the same rules as the member's own choice on
 * „Moja članarina". So most of what is held here is held as an EQUALITY with the member's own route, which is
 * the floor that falls the day the two roads part: whatever the administration's write answers is exactly
 * what the member's own read then says, for a member who has the right and for one who has not.
 *
 * <p><b>THE FIXTURE KEEPS THE SOURCES APART.</b> The member chosen for ({@link #HE}) is never the one who
 * chooses, never the first by key ({@link #FIRST_BY_KEY} is, and his wish must not move), and the one who
 * chooses for a moderator is a moderator who races, so „his own record" and „somebody else's" are two rows.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MemberCategoryApiTest {

	/** 21 November 2028, the first day 2029 is on sale, so the box is for 2029 and open. */
	private static final Instant ON_SALE = Instant.parse("2028-11-21T12:00:00Z");

	/** 1 January 2029 at 09:59 in Belgrade, the last minute of the deadline (10:00, PDL P7). */
	private static final Instant JUST_BEFORE_THE_DEADLINE = Instant.parse("2029-01-01T08:59:00Z");

	/** And 10:00 in Belgrade, the deadline itself. */
	private static final Instant THE_DEADLINE = Instant.parse("2029-01-01T09:00:00Z");

	private static final String FIRST_BY_KEY = "000051";

	private static final String HE = "000052";

	private static final String OVER_THE_LINE = "000053";

	private static final String THE_MODERATOR_WHO_RACES = "000054";

	private static final String THE_SUPERADMIN = "super@primer.rs";

	private static final String OVER_THE_MEMBERS = "clanovi@primer.rs";

	private static final String WITHOUT_THE_RIGHT = "uplate@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private final ObjectMapper mapper = new ObjectMapper();

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

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
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(ON_SALE);
		}
	}

	@BeforeEach
	void fourMembersAndThreeOfTheAdministration() {
		clock.moveTo(ON_SALE);

		competitor(FIRST_BY_KEY, "Prva", "Po Kljucu", "F", "1990-01-01", false);
		competitor(HE, "Drugi", "Kome Se Bira", "M", "1985-01-01", false);
		competitor(OVER_THE_LINE, "Treci", "Presao", "M", "1970-01-01", false);
		competitor(THE_MODERATOR_WHO_RACES, "Mira", "Clanovic", "F", "1980-01-01", false);

		account(HE + "@primer.rs", "competitor", HE);
		account(OVER_THE_LINE + "@primer.rs", "competitor", OVER_THE_LINE);
		account(THE_SUPERADMIN, "superadmin", null);
		account(OVER_THE_MEMBERS, "moderator", THE_MODERATOR_WHO_RACES);
		ticked(OVER_THE_MEMBERS, CompetitorApi.OVER_THE_MEMBERS);
		account(WITHOUT_THE_RIGHT, "moderator", null);
		ticked(WITHOUT_THE_RIGHT, "queue:payments");

		/* TWELVE POINTS IN AN OFFICIAL SEASON close the beginners' category to him (PDL P7, 11.08.2026). */
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description, link)"
						+ " values ('prva', 'Trka prva', date '2027-05-10', (select id from place where rank = 1),"
						+ " null, null, 'race', false, '', '')").update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = 'prva'), 'Trka prve sezone', false,"
						+ " date '2027-05-10', 'length', 0, 10.00, 0, 0)").update();
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from race where name = 'Trka prve sezone'), date '2027-05-10', 10.00, 0, 0, 3600, 12.00)")
				.param(OVER_THE_LINE).update();

		/* Every member is a member of 2027, 2028 and 2029, so a run counts and the public list carries the
		   season being chosen (`CategoryOfASeason`). */
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " select c.id, s.season, 'feeExempt', 'Probni Probic', timestamptz '2026-09-01 10:00:00+00'"
						+ " from competitor c cross join (values (2027), (2028), (2029)) as s (season)"
						+ " where c.member_number is not null on conflict do nothing")
				.update();
	}

	/* ------------------------------------------------------------------- who may */

	@Test
	void aVisitorIsAskedToSignInAndAModeratorWithoutTheRightIsToldNothingIsHere() throws Exception {
		assertThat(read(HE, null).getStatus()).isEqualTo(401);
		assertThat(chosen(HE, true, null).getStatus()).isEqualTo(401);

		assertThat(read(HE, WITHOUT_THE_RIGHT).getStatus()).isEqualTo(404);
		assertThat(chosen(HE, true, WITHOUT_THE_RIGHT).getStatus()).isEqualTo(404);
		/* And the member himself, who has a page of his own for it and not this address. */
		assertThat(chosen(HE, true, HE + "@primer.rs").getStatus()).isEqualTo(404);

		assertThat(wishes()).containsExactly(FIRST_BY_KEY + " 2027 false", HE + " 2027 false",
				OVER_THE_LINE + " 2027 false", THE_MODERATOR_WHO_RACES + " 2027 false");
	}

	@Test
	void theSuperadminAndAModeratorOverTheMembersChooseForSomebodyElse() throws Exception {
		assertThat(read(HE, THE_SUPERADMIN).getStatus()).isEqualTo(200);
		assertThat(read(HE, OVER_THE_MEMBERS).getStatus()).isEqualTo(200);

		assertThat(chosen(HE, true, OVER_THE_MEMBERS).getStatus()).isEqualTo(200);
		assertThat(chosen(OVER_THE_LINE, true, THE_SUPERADMIN).getStatus()).isEqualTo(200);

		assertThat(wishes()).containsExactly(FIRST_BY_KEY + " 2027 false", HE + " 2027 false", HE + " 2029 true",
				OVER_THE_LINE + " 2027 false", OVER_THE_LINE + " 2029 true", THE_MODERATOR_WHO_RACES + " 2027 false");
	}

	@Test
	void aModeratorDoesNotChooseForHimselfAndANumberNobodyHasIsNotThere() throws Exception {
		assertThat(chosen(THE_MODERATOR_WHO_RACES, true, OVER_THE_MEMBERS).getStatus()).isEqualTo(404);
		assertThat(chosen("999999", true, OVER_THE_MEMBERS).getStatus()).isEqualTo(404);
		assertThat(read("999999", OVER_THE_MEMBERS).getStatus()).isEqualTo(404);

		assertThat(wishes()).doesNotContain(THE_MODERATOR_WHO_RACES + " 2029 true");
	}

	/* ------------------------------------------------------------------- the same rules */

	@Test
	void aMemberWithTheRightIsMadeABeginnerAndSeesItOnHisOwnPageAndOnTheList() throws Exception {
		MockHttpServletResponse answer = chosen(HE, true, OVER_THE_MEMBERS);

		assertThat(body(answer).path("firstSeason").asBoolean()).isTrue();
		assertThat(body(answer).path("firstSeasonAllowed").asBoolean()).isTrue();
		/* THE SAME ANSWER HIS OWN PAGE GIVES HIM, character for character: the floor over the two roads. */
		assertThat(answer.getContentAsString()).isEqualTo(hisOwn(HE));
		assertThat(read(HE, OVER_THE_MEMBERS).getContentAsString()).isEqualTo(hisOwn(HE));

		/* And the public list, at once (PDL P7, 18.10.2026, „Izbor kategorije se vidi odmah i svuda"): his
		   season being chosen is a beginner's, the first by key's is not. */
		assertThat(onTheList(HE, 2029)).isEqualTo("beginner");
		assertThat(onTheList(FIRST_BY_KEY, 2029)).isEqualTo("age");

		/* And back again, in the other direction. */
		chosen(HE, false, OVER_THE_MEMBERS);

		assertThat(onTheList(HE, 2029)).isEqualTo("age");
		assertThat(chosen(HE, false, OVER_THE_MEMBERS).getContentAsString()).isEqualTo(hisOwn(HE));
	}

	@Test
	void aMemberWithoutTheRightKeepsTheWishAndRunsInHisAgeBandAsOnHisOwnPage() throws Exception {
		MockHttpServletResponse answer = chosen(OVER_THE_LINE, true, OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(body(answer).path("firstSeason").asBoolean()).isTrue();
		assertThat(body(answer).path("firstSeasonAllowed").asBoolean()).isFalse();
		assertThat(body(answer).path("category").asString()).doesNotContain(" ");
		assertThat(answer.getContentAsString()).isEqualTo(hisOwn(OVER_THE_LINE));
		assertThat(onTheList(OVER_THE_LINE, 2029)).isEqualTo("age");

		/* AND HIS OWN ROUTE, sent the same wish, answers the same: the two roads part nowhere. */
		String fromTheAdministration = answer.getContentAsString();

		assertThat(hisOwnSent(OVER_THE_LINE, true)).isEqualTo(fromTheAdministration);
	}

	@Test
	void theDeadlineIsTheMembersOwn() throws Exception {
		clock.moveTo(JUST_BEFORE_THE_DEADLINE);

		assertThat(chosen(HE, true, OVER_THE_MEMBERS).getStatus()).isEqualTo(200);

		clock.moveTo(THE_DEADLINE);

		MockHttpServletResponse shut = chosen(HE, false, OVER_THE_MEMBERS);

		assertThat(shut.getStatus()).isEqualTo(409);
		assertThat(body(shut).path("reason").asString()).isEqualTo(MeCategoryWriteApi.THE_CHOICE_IS_SHUT);
		assertThat(body(read(HE, OVER_THE_MEMBERS)).path("open").asBoolean()).isFalse();
		assertThat(wishes()).contains(HE + " 2029 true");
		assertThat(messages()).hasSize(1);
	}

	@Test
	void aFormWithNoWishIsRefusedSayingWhichFieldIsMissing() throws Exception {
		MockHttpServletResponse empty = sent(put("/api/members/" + HE + "/category").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{}"), OVER_THE_MEMBERS);

		assertThat(empty.getStatus()).isEqualTo(400);
		assertThat(body(empty).path("reason").asString()).isEqualTo(MeCategoryWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(body(empty).path("missing").toString()).isEqualTo("[\"firstSeason\"]");
	}

	/* ------------------------------------------------------------------- the message */

	@Test
	void hisInboxIsToldThatHisCategoryWasChangedAndOnlyWhenTheWishMoved() throws Exception {
		chosen(HE, false, OVER_THE_MEMBERS);

		assertThat(messages()).isEmpty();

		chosen(HE, true, OVER_THE_MEMBERS);

		String said = WhatADataCorrectionSays.corrected(List.of(Field.CATEGORY)).body();

		assertThat(messages()).containsExactly(HE + " | " + PairWriteApi.THE_LEAGUE + " | " + said);
		assertThat(said).contains("kategorija");

		chosen(HE, true, OVER_THE_MEMBERS);

		assertThat(messages()).hasSize(1);
	}

	/* ------------------------------------------------------------------- the fixture */

	private void competitor(String number, String first, String last, String gender, String birthDate,
			boolean firstSeason) {

		long id = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, cast(? as date), (select id from place where rank = 1), 2027,"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, first, last, gender, birthDate, String.format("%016x", ++issued))
				.query(Long.class).single();

		db.sql("insert into category_wish (competitor_id, season, beginner) values (?, 2027, ?)")
				.params(id, firstSeason).update();
	}

	private void account(String email, String role, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, role, memberNumber).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	/* ------------------------------------------------------------------- the requests */

	private MockHttpServletResponse sent(MockHttpServletRequestBuilder asks, String email) throws Exception {
		return http.perform(email == null ? asks
						: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse read(String number, String email) throws Exception {
		return sent(get("/api/members/" + number + "/category"), email);
	}

	private MockHttpServletResponse chosen(String number, boolean firstSeason, String email) throws Exception {
		return sent(put("/api/members/" + number + "/category").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content("{\"firstSeason\":" + firstSeason + "}"), email);
	}

	/** What the member's own page reads ({@code GET /api/me/category}). */
	private String hisOwn(String number) throws Exception {
		return sent(get("/api/me/category"), number + "@primer.rs").getContentAsString();
	}

	/** What the member's own route answers to the same wish ({@code PUT /api/me/category}). */
	private String hisOwnSent(String number, boolean firstSeason) throws Exception {
		return sent(put("/api/me/category").with(csrf()).contentType(MediaType.APPLICATION_JSON)
				.content("{\"firstSeason\":" + firstSeason + "}"), number + "@primer.rs").getContentAsString();
	}

	/* ------------------------------------------------------------------- the answers */

	private JsonNode body(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	/** What the public list says of his category in that season: „beginner", „age", or „none". */
	private String onTheList(String number, int season) throws Exception {
		JsonNode list = mapper.readTree(sent(get("/api/competitors"), null).getContentAsString(StandardCharsets.UTF_8));

		for (JsonNode one : list) {
			if (number.equals(one.path("memberNumber").asString())) {
				for (JsonNode category : one.path("categories")) {
					if (category.path("season").asInt() == season) {
						return category.path("beginner").asBoolean() ? "beginner" : "age";
					}
				}
			}
		}

		return "none";
	}

	/** Every wish, as „number season beginner", in that order. */
	private List<String> wishes() {
		return new ArrayList<>(db.sql("select c.member_number || ' ' || w.season || ' ' || w.beginner"
						+ " from category_wish w join competitor c on c.id = w.competitor_id"
						+ " order by c.member_number, w.season")
				.query(String.class).list());
	}

	/** Every message, as „to | from | body", so one to the wrong member shows. */
	private List<String> messages() {
		return db.sql("select coalesce(c.member_number, 'everybody') || ' | ' || m.from_name || ' | ' || m.body"
						+ " from message m left join competitor c on c.id = m.to_id order by m.id")
				.query(String.class).list();
	}
}
