package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE FROZEN SEASONS AND THEIR TABLES AS THEY ARE READ: what the freeze wrote, row for row, and what a
 * row says about its member in each state the journal names.
 *
 * <p>The season is frozen HERE, by the act itself with a clock of its own ({@link #frozen}), and never by
 * the clock of the context: a context born after 1.1.2028 16:00 freezes at start into the database every
 * class shares. The tables are therefore exactly what {@link TheTablesOfASeason} writes, and a case that
 * changes something afterwards (a deletion, a team gone) asks what the snapshot says about it then.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class FrozenSeasonApiTest {

	private static final Path MOCK = Path.of("..", "frontend", "src", "test", "mock");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private TheTablesOfASeason tables;

	@Autowired
	private ObjectProvider<WhatFollowsTheFreeze> followers;

	private final ObjectMapper json = new ObjectMapper();

	private String memberSession;

	private String superadminSession;

	@BeforeEach
	void theSeasonOf2027() {
		member("000401", "Ana", "Prva", "F");
		member("000402", "Bojan", "Drugi", "M");
		member("000403", "Goran", "Treci", "M");
		member("000404", "Vera", "Cetvrta", "F");

		for (String number : List.of("000401", "000402", "000403", "000404")) {
			db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
							+ " values ((select id from competitor where member_number = ?), 2027, 'feeExempt',"
							+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
					.param(number).update();
		}

		event("prolece-2027", "Prolece", "2027-04-04");
		race("prolece-2027", "Krug", "2027-04-04");
		event("jesen-2027", "Jesen", "2027-10-10");
		race("jesen-2027", "Jesenji krug", "2027-10-10");

		run("000401", "Krug", 30.00);
		run("000402", "Krug", 25.00);
		run("000402", "Jesenji krug", 20.00);
		run("000403", "Jesenji krug", 40.00);
		run("000404", "Jesenji krug", 12.00);

		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values ('tim-a', 'Tim A', '', '', (select id from place where rank = 1), null, null,"
				+ " null, 2027, null)").update();
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
				+ " select id, (select id from team where slug = 'tim-a'), 2027, null, null from competitor"
				+ " where member_number in ('000402', '000403')").update();
		db.sql("insert into racing_pair (season, man_id, woman_id) values (2027,"
				+ " (select id from competitor where member_number = '000402'),"
				+ " (select id from competitor where member_number = '000401'))").update();
		league("liga-2027", "Liga 2027");
		league("druga-liga-2027", "Druga liga 2027");

		memberSession = account("clan@primer.rs", "competitor", "000401");
		superadminSession = account("admin@primer.rs", "superadmin", null);
	}

	@Test
	void beforeTheFreezeNoSeasonIsFrozenAndItsTablesAreAnAddressThatIsNotThere() throws Exception {
		assertThat(json.readTree(answer("/api/frozen-seasons", null).getContentAsString()).isEmpty()).isTrue();

		MockHttpServletResponse tables = answer("/api/frozen-tables/2027", null);
		MockHttpServletResponse nothing = answer("/api/frozen-tables-nowhere/2027", superadminSession);

		assertThat(tables.getStatus()).isEqualTo(404);
		assertThat(answer("/api/frozen-tables/sezona", null).getStatus())
				.as("a word in place of the season was told apart from a season not frozen").isEqualTo(404);
		assertThat(answer("/api/frozen-tables/99999999999", null).getStatus()).isEqualTo(404);
		assertThat(tables.getContentAsString())
				.as("a season not frozen was told apart from an address that maps nothing")
				.isEqualTo(nothing.getContentAsString());
	}

	@Test
	void afterTheFreezeTheSeasonIsListedAndItsTablesAreTheRowsTheFreezeWrote() throws Exception {
		frozen();

		assertThat(json.readTree(answer("/api/frozen-seasons", null).getContentAsString()))
				.isEqualTo(json.readTree("[{\"season\": 2027}]"));

		JsonNode tables = tablesOf2027(null);

		assertThat(tables.get("season").asInt()).isEqualTo(2027);
		assertThat(rows(tables.get("standings"), "gender", "position", "categoryPosition", "memberNumber", "who",
				"category", "points", "races"))
				.containsExactly("M 1 1 000402 Bojan Drugi M40-54 45.0 2", "M 2 2 000403 Goran Treci M40-54 40.0 1",
						"F 1 1 000401 Ana Prva Ž25-39 30.0 1", "F 2 1 000404 Vera Cetvrta Ž55+ 12.0 1");
		assertThat(rows(tables.get("teams"), "position", "slug", "name", "points", "members"))
				.containsExactly("1 tim-a Tim A 85.0 2");
		assertThat(rows(tables.get("teams").get(0).get("roster"), "position", "memberNumber", "who", "points"))
				.containsExactly("1 000402 Bojan Drugi 45.0", "2 000403 Goran Treci 40.0");
		assertThat(rows(tables.get("pairs"), "position", "points", "races")).containsExactly("1 55.0 1");
		assertThat(rows(tables.get("pairs").get(0).get("halves"), "memberNumber", "who", "gender"))
				.containsExactly("000401 Ana Prva F", "000402 Bojan Drugi M");
		assertThat(rows(tables.get("boards"), "board", "position", "memberNumber", "raceName"))
				.contains("bestRace 1 000403 Jesenji krug", "kilometers 1 000402 null");
		assertThat(rows(tables.get("awards"), "kind", "category", "position", "memberNumber", "teamName"))
				.contains("overall null 1 000402 null", "team null 1 000403 Tim A", "pair null 1 000401 null");
	}

	@Test
	void aLeaguesGridIsItsColumnsInOrderAndEachCellNamesTheColumnItIsIn() throws Exception {
		frozen();

		JsonNode league = league(tablesOf2027(null), "liga-2027");

		assertThat(rows(league.get("columns"), "eventSlug", "date", "name"))
				.containsExactly("prolece-2027 2027-04-04 Prolece", "jesen-2027 2027-10-10 Jesen");
		assertThat(rows(league.get("standings"), "gender", "position", "memberNumber", "points"))
				.containsExactly("M 1 000402 45.0", "M 2 000403 40.0", "F 1 000401 30.0", "F 2 000404 12.0");
		assertThat(rows(league.get("standings").get(0).get("cells"), "column", "points"))
				.containsExactly("1 25.0", "2 20.0");
		assertThat(rows(league.get("standings").get(1).get("cells"), "column", "points")).containsExactly("2 40.0");
	}

	@Test
	void aMemberWhoseFeeLapsedIsAnsweredByNumberAndNameAndTheReaderDecidesTheLink() throws Exception {
		frozen();
		db.sql("update competitor set active = false, profile_hidden = true where member_number = '000403'").update();

		assertThat(rows(tablesOf2027(null).get("standings"), "memberNumber", "who"))
				.contains("000403 Goran Treci");
	}

	@Test
	void aMemberWhoAskedToGoLeavesHisGenderAndNoNumberAndNoName() throws Exception {
		frozen();
		db.sql("delete from competitor where member_number = '000404'").update();

		JsonNode tables = tablesOf2027(null);

		assertThat(rows(tables.get("standings"), "gender", "position", "memberNumber", "who", "points"))
				.contains("F 2 null null 12.0");
		assertThat(rows(league(tables, "liga-2027").get("standings"), "gender", "position", "memberNumber", "who"))
				.contains("F 2 null null");
	}

	@Test
	void aMemberDeletedAfterFiveYearsKeepsHisNameAsTextAndHasNoNumber() throws Exception {
		frozen();

		/* What the job of five years does (ADL, 05.11.2026): every pointer to him in a table of the
		   snapshot is emptied, and then he goes. */
		long bojan = db.sql("select id from competitor where member_number = '000402'").query(Long.class).single();

		for (String table : db.sql("select distinct rel.relname from pg_constraint con"
				+ " join pg_class rel on rel.oid = con.conrelid join pg_attribute a on a.attrelid = rel.oid"
				+ " and a.attnum = any (con.conkey) where con.contype = 'f' and con.confrelid = 'competitor'::regclass"
				+ " and rel.relname like 'season%' and a.attname = 'competitor_id' and rel.relname <> 'season_points_at_freeze'")
				.query(String.class).list()) {
			db.sql("update " + table + " set competitor_id = null where competitor_id = ?").param(bojan).update();
		}

		db.sql("delete from team_membership where competitor_id = ?").param(bojan).update();
		db.sql("delete from competitor where id = ?").param(bojan).update();

		JsonNode tables = tablesOf2027(null);

		assertThat(rows(tables.get("standings"), "position", "memberNumber", "who"))
				.contains("1 null Bojan Drugi");
		assertThat(rows(tables.get("teams").get(0).get("roster"), "memberNumber", "who"))
				.contains("null Bojan Drugi");
		assertThat(rows(tables.get("pairs").get(0).get("halves"), "memberNumber", "who"))
				.contains("null Bojan Drugi");
		assertThat(rows(tables.get("awards"), "kind", "memberNumber", "who"))
				.contains("overall null Bojan Drugi", "pair null Bojan Drugi", "team null Bojan Drugi");
	}

	@Test
	void aTeamOrAnEventDeletedLaterIsANameWithoutALinkAndALeagueDeletedLaterIsNotAnswered() throws Exception {
		frozen();
		db.sql("delete from team where slug = 'tim-a'").update();
		db.sql("delete from btl_event where slug = 'jesen-2027'").update();
		db.sql("delete from league where slug = 'druga-liga-2027'").update();

		JsonNode tables = tablesOf2027(null);

		assertThat(rows(tables.get("teams"), "slug", "name")).containsExactly("null Tim A");
		assertThat(rows(league(tables, "liga-2027").get("columns"), "eventSlug", "name"))
				.containsExactly("prolece-2027 Prolece", "null Jesen");
		assertThat(rows(tables.get("leagues"), "slug")).containsExactly("liga-2027");
	}

	@Test
	void everyReaderIsAnsweredTheSameTables() throws Exception {
		frozen();
		db.sql("update competitor set profile_hidden = true where member_number = '000402'").update();

		String visitor = answer("/api/frozen-tables/2027", null).getContentAsString();

		assertThat(answer("/api/frozen-tables/2027", memberSession).getContentAsString()).isEqualTo(visitor);
		assertThat(answer("/api/frozen-tables/2027", superadminSession).getContentAsString()).isEqualTo(visitor);
		assertThat(answer("/api/frozen-seasons", memberSession).getContentAsString())
				.isEqualTo(answer("/api/frozen-seasons", null).getContentAsString());
	}

	@Test
	void aSeasonFrozenWithNobodyInItIsEmptyTablesAndNotAnAddressThatIsNotThere() throws Exception {
		frozenAt(2029);

		MockHttpServletResponse empty = answer("/api/frozen-tables/2028", null);

		assertThat(empty.getStatus()).isEqualTo(200);
		assertThat(json.readTree(empty.getContentAsString()).get("standings").isEmpty()).isTrue();
	}

	/** The portal's fixture names what the screens read, and the answer carries exactly that, list by list. */
	@Test
	void theAnswersCarryEveryFieldTheServedFilesNameAndNothingBeside() throws Exception {
		frozen();

		JsonNode list = json.readTree(answer("/api/frozen-seasons", null).getContentAsString());

		Answers.everyFieldThePortalReadsIsAnswered("/api/frozen-seasons", list, "frozen-seasons.json");
		assertThat(Answers.fieldsOf(list.get(0))).isEqualTo(Answers.servedFields("frozen-seasons.json"));

		JsonNode answered = tablesOf2027(null);
		JsonNode served = json.readTree(Files.readString(MOCK.resolve("frozen-tables.json"), StandardCharsets.UTF_8));

		for (String[] at : List.of(new String[] {}, new String[] {"standings"}, new String[] {"teams"},
				new String[] {"teams", "roster"}, new String[] {"boards"}, new String[] {"pairs"},
				new String[] {"pairs", "halves"}, new String[] {"leagues"}, new String[] {"leagues", "columns"},
				new String[] {"leagues", "standings"}, new String[] {"leagues", "standings", "cells"},
				new String[] {"awards"})) {
			assertThat(Answers.fieldsOf(first(answered, at)))
					.as("the answer and frozen-tables.json under %s", String.join(".", at))
					.isEqualTo(Answers.fieldsOf(first(served, at)));
		}
	}

	private static JsonNode first(JsonNode node, String... path) {
		JsonNode at = node;

		for (String step : path) {
			JsonNode list = at.get(step);

			assertThat(list.isEmpty()).as("nothing under %s to compare", step).isFalse();
			at = list.get(0);
		}

		return at;
	}

	private JsonNode tablesOf2027(String session) throws Exception {
		MockHttpServletResponse response = answer("/api/frozen-tables/2027", session);

		assertThat(response.getStatus()).isEqualTo(200);

		return json.readTree(response.getContentAsString());
	}

	private static JsonNode league(JsonNode tables, String slug) {
		for (JsonNode one : tables.get("leagues")) {
			if (slug.equals(one.get("slug").asString())) {
				return one;
			}
		}

		throw new AssertionError("no league " + slug);
	}

	/** Each row as its named fields, space by space, a JSON null as {@code null}. */
	private static List<String> rows(JsonNode list, String... fields) {
		List<String> rows = new ArrayList<>();

		for (JsonNode row : list) {
			List<String> values = new ArrayList<>();

			for (String field : fields) {
				values.add(row.get(field).isNull() ? "null" : row.get(field).asString());
			}

			rows.add(String.join(" ", values));
		}

		return rows;
	}

	private MockHttpServletResponse answer(String path, String session) throws Exception {
		MockHttpServletRequestBuilder request = get(path);

		if (session != null) {
			request.cookie(new Cookie(SessionCookie.NAME, session));
		}

		MockHttpServletResponse response = http.perform(request).andReturn().getResponse();

		response.setCharacterEncoding("UTF-8");

		return response;
	}

	private void frozen() {
		frozenAt(2028);
	}

	private void frozenAt(int year) {
		Instant at = LocalDateTime.of(year, 1, 1, 16, 0).atZone(SeasonClock.ZONE).toInstant();

		new ASeasonFreezes(db, Clock.fixed(at, ZoneOffset.UTC), inOneTransaction, best, tables, followers).freeze();
	}

	private void member(String number, String first, String last, String gender) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, active,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, cast(? as date),"
						+ " (select id from place where rank = 1), null, null, 2027, true,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, "F".equals(gender) && "000404".equals(number) ? "1960-05-05"
						: "F".equals(gender) ? "1990-05-05" : "1985-05-05", "0011223355" + number).update();
	}

	private void event(String slug, String name, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description,"
						+ " link) values (?, ?, cast(? as date), null, 'Kraljevo',"
						+ " (select id from country where code = 'RS'), 'race', false, '', '')")
				.params(slug, name, day).update();
	}

	private void race(String event, String name, String day) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
						+ " descent_m) values ((select id from btl_event where slug = ?), ?, false, cast(? as date),"
						+ " 'length', 0, 10, 0, 0)")
				.params(event, name, day).update();
	}

	private void run(String member, String raceName, double points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds,"
						+ " points) select (select id from competitor where member_number = ?), ra.id, ra.date,"
						+ " ra.distance_km, 0, 0, 3000, ? from race ra where ra.name = ?")
				.params(member, points, raceName).update();
	}

	private void league(String slug, String name) {
		db.sql("insert into league (slug, name, season, rules, prizes) values (?, ?, 2027, '', '')")
				.params(slug, name).update();

		for (String race : List.of("Krug", "Jesenji krug")) {
			db.sql("insert into league_race (league_id, season, race_id) values ((select id from league where slug = ?),"
					+ " 2027, (select id from race where name = ?))").params(slug, race).update();
		}
	}

	/** An account with a live session, tied to a member where one is named; the secret of the session. */
	private String account(String email, String role, String member) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values ('Probni', 'Probic',"
						+ " ?, (select id from role where code = ?), (select id from competitor where member_number = ?))")
				.params(email, role, member).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))), Timestamp.from(now),
						Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}
}
