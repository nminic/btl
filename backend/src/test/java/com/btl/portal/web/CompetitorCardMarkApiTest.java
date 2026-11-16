package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.card.WhatACardSays;
import com.btl.portal.domain.season.SeasonClock;
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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE MARK OF THE STATE OF A CARD, ASKED FOR AS THE MEMBER'S OWN PROFILE ASKS FOR IT.
 *
 * <p>Owner, PDL P11, 16.11.2026, point 15 under „Profil ima deljivu sliku za društvene mreže (OG
 * sliku)”: the address of his own profile carries a short mark of the state of his card, „koja se menja
 * sa svakom promenom kartice”. What is held here is where the mark comes from: the digest the address
 * of the card carries ({@link CompetitorCards#addressOf}), and nothing else.
 *
 * <p><b>Nothing in the setting is the only one of its kind</b> (the rule in {@code CLAUDE.md} about two
 * sources of one value): the member asked for is never first on the list, and the member first on it
 * runs in the same race, so a mark read off the wrong member is another mark; the two languages are two
 * cards with two marks; and a race run by somebody else is the change that must NOT move the mark.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, CompetitorCardMarkApiTest.TheClockTheseCasesUse.class})
@Transactional
class CompetitorCardMarkApiTest {

	private static final Instant OCTOBER_2028 = LocalDateTime.of(2028, 10, 1, 12, 0)
			.atZone(SeasonClock.ZONE).toInstant();

	/** First on the list, with a race of his own in the same race. */
	private static final String FIRST = "000720";

	/** The member whose mark is asked for. */
	private static final String ASKED = "000721";

	/** A hidden profile, whose fee stands. */
	private static final String HIDDEN = "000722";

	/** A member whose fee has lapsed: a member of 2027 and not of 2028. */
	private static final String LAPSED = "000723";

	/** A member who is deleted before the case asks. */
	private static final String DELETED = "000724";

	private static final String NOBODY = "000799";

	private final ObjectMapper json = new ObjectMapper();

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private CompetitorCards cards;

	private long event;

	@BeforeEach
	void aLeagueWithARace() {
		for (String number : List.of(FIRST, ASKED, HIDDEN, LAPSED, DELETED)) {
			member(number, number.equals(ASKED) ? "Nikola" : "Ime", number.equals(ASKED) ? "Minić" : "Prezime");
			memberOf(number, number.equals(LAPSED) ? 2027 : 2028);
		}

		db.sql("update competitor set profile_hidden = true where member_number = ?").param(HIDDEN).update();

		event = db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values ('prolece-2028', 'Prolece', date '2028-04-04', null, 'Grad',"
						+ " (select id from country where code = 'RS'), 'race', false, '', '') returning id")
				.query(Long.class).single();

		long ten = race("Deset");

		run(ASKED, ten);
		run(FIRST, ten);
		run(HIDDEN, ten);
		run(LAPSED, ten);

		db.sql("delete from membership where competitor_id = (select id from competitor where member_number = ?)")
				.param(DELETED).update();
		db.sql("delete from competitor where member_number = ?").param(DELETED).update();
	}

	@Test
	void theMarkIsTheBeginningOfTheDigestTheAddressOfHisCardCarriesInEitherLanguage() throws Exception {
		for (WhatACardSays language : List.of(WhatACardSays.SERBIAN, WhatACardSays.ENGLISH)) {
			MockHttpServletResponse answered = response(page(ASKED, language), null);

			assertThat(answered.getStatus()).as(language.code()).isEqualTo(200);
			assertThat(answered.getContentType()).as(language.code()).startsWith("application/json");
			assertThat(answered.getHeader("Cache-Control")).as(language.code()).isEqualTo("no-store");

			JsonNode body = json.readTree(answered.getContentAsString());

			assertThat(body.propertyNames()).as("the answer names the mark and nothing else").containsExactly("mark");
			assertThat(body.get("mark").asString()).as(language.code())
					.matches("[0-9a-f]{4}")
					.isEqualTo(digestIn(cards.addressOf(ASKED, language).orElseThrow()).substring(0, 4));
		}

		/* The two axes the source could be confused along, and each has both of its states here: the
		   other language's card, and the member first on the list. Were they the same mark, the case
		   above would hold of a mark read off either of them. */
		assertThat(markOf(ASKED, WhatACardSays.SERBIAN)).isNotEqualTo(markOf(ASKED, WhatACardSays.ENGLISH));
		assertThat(markOf(ASKED, WhatACardSays.SERBIAN)).isNotEqualTo(markOf(FIRST, WhatACardSays.SERBIAN));
	}

	@Test
	void theMarkMovesWhenHisCardDoesAndNotWhenSomebodyElseRuns() throws Exception {
		String before = markOf(ASKED, WhatACardSays.SERBIAN);

		run(FIRST, race("Tudja"));
		assertThat(markOf(ASKED, WhatACardSays.SERBIAN)).as("somebody else ran, and his card is the same")
				.isEqualTo(before);

		run(ASKED, race("Jos jedna"));

		String after = markOf(ASKED, WhatACardSays.SERBIAN);

		assertThat(after).as("he ran, and his card changed").isNotEqualTo(before)
				.isEqualTo(digestIn(cards.addressOf(ASKED, WhatACardSays.SERBIAN).orElseThrow()).substring(0, 4));
	}

	/**
	 * A HIDDEN PROFILE, A LAPSED MEMBER, A DELETED ONE, A NUMBER NOBODY HOLDS AND A PAGE OF THE WRONG
	 * SHAPE ARE THE ONE ANSWER THE CARD GIVES THEM. PDL, 06.09.2026, confirmed 03.10.2026: „Oba
	 * slučaja dobijaju isti ishod".
	 */
	@Test
	void whereTheCardIsNothingTheMarkIsTheSameNothingToTheByte() throws Exception {
		MockHttpServletResponse noCard = response("/api/cards/competitor/" + NOBODY + "-sr1-0123456789abcdef.jpg", null);

		assertThat(noCard.getStatus()).isEqualTo(404);

		for (String path : List.of(page(HIDDEN, WhatACardSays.SERBIAN), page(LAPSED, WhatACardSays.SERBIAN),
				page(DELETED, WhatACardSays.SERBIAN), page(NOBODY, WhatACardSays.SERBIAN),
				page(HIDDEN, WhatACardSays.ENGLISH),
				"/api/cards/marks/" + ASKED + "-de", "/api/cards/marks/" + ASKED,
				"/api/cards/marks/00072-sr", "/api/cards/marks/" + ASKED + "-sr1")) {
			MockHttpServletResponse answered = response(path, null);

			assertThat(answered.getStatus()).as(path).isEqualTo(404);
			assertThat(answered.getHeaderNames()).as(path).isEqualTo(noCard.getHeaderNames());
			assertThat(answered.getContentAsByteArray()).as(path).isEqualTo(noCard.getContentAsByteArray());
		}

		/* And the members around them have one, so the emptiness above is about them. */
		assertThat(response(page(ASKED, WhatACardSays.SERBIAN), null).getStatus()).isEqualTo(200);
		assertThat(response(page(FIRST, WhatACardSays.SERBIAN), null).getStatus()).isEqualTo(200);
	}

	/** The member himself is answered what a visitor is, because the card is drawn for a visitor. */
	@Test
	void theMemberHimselfIsAnsweredWhatAVisitorIs() throws Exception {
		String his = account("svoj-znak@primer.rs", ASKED);
		String hiding = account("skriven-znak@primer.rs", HIDDEN);

		assertThat(response(page(ASKED, WhatACardSays.SERBIAN), his).getContentAsString())
				.isEqualTo(response(page(ASKED, WhatACardSays.SERBIAN), null).getContentAsString());
		assertThat(response(page(HIDDEN, WhatACardSays.SERBIAN), hiding).getStatus())
				.as("his own hidden profile has no card, so it has no mark either")
				.isEqualTo(404);
	}

	private String markOf(String number, WhatACardSays language) throws Exception {
		MockHttpServletResponse answered = response(page(number, language), null);

		assertThat(answered.getStatus()).as(number).isEqualTo(200);
		return json.readTree(answered.getContentAsString()).get("mark").asString();
	}

	private static String page(String number, WhatACardSays language) {
		return "/api/cards/marks/" + number + "-" + language.code();
	}

	/** The sixteen hexadecimal characters of the digest in the address of a card. */
	private static String digestIn(String address) {
		String name = address.substring(0, address.length() - ".jpg".length());

		return name.substring(name.lastIndexOf('-') + 1);
	}

	private MockHttpServletResponse response(String path, String session) throws Exception {
		MockHttpServletRequestBuilder request = get(path);

		if (session != null) {
			request.cookie(new Cookie(SessionCookie.NAME, session));
		}

		MockHttpServletResponse response = http.perform(request).andReturn().getResponse();
		response.setCharacterEncoding("UTF-8");
		return response;
	}

	private void member(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'M', date '1980-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, "0011223388" + number).update();
	}

	private void memberOf(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}

	private long race(String name) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, date '2028-04-04', 'length', 0, 10, 0, 0) returning id")
				.params(event, name).query(Long.class).single();
	}

	private void run(String member, long race) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds,"
						+ " points) select (select id from competitor where member_number = ?), id, date,"
						+ " 10, 0, 0, 3600, 0 from race where id = ?")
				.params(member, race).update();
	}

	private String account(String email, String member) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values ('Probni',"
						+ " 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, member).update();

		SecretToken session = SecretToken.fresh();
		Instant now = OCTOBER_2028;

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))), Timestamp.from(now),
						Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		Clock theClockOfOctober2028() {
			return new FixedAt(OCTOBER_2028);
		}
	}

	private static final class FixedAt extends Clock {

		private final Instant now;

		private FixedAt(Instant now) {
			this.now = now;
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
}
