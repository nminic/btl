package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
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
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHAT {@code GET /api/ducat-awards/{memberNumber}} ANSWERS, AND TO WHOM.
 *
 * <p><b>Three members and nothing here is the only one of its kind.</b> The member asked about,
 * {@value #ASKED}, is neither the first written nor the first by number, and the other two hold
 * ducats whose race is NEWER than any of his, so an answer that let another member's row through would
 * put that row first and not somewhere.
 *
 * <p><b>The day of the race, the row's key, the tier and the catalogue order are four different
 * orders</b> over his rows, so an answer ordered by any of the other three is a different list.
 *
 * <p><b>The clock stands in October 2028</b>, so 2028 is the running season and 2027 is the one before
 * it: the member whose fee has lapsed held 2027 and not 2028, which is the boundary
 * {@link ResultApi#aRunIsServed} is about. His rows were written in 2028 (the job at night), so the
 * moment a row was written ({@code awarded_at}) and the day of the race that won it ({@code won_on})
 * fall in different seasons and a rule asked of the wrong one is a different answer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, DucatAwardApiTest.TheClockTheseCasesUse.class})
@Transactional
class DucatAwardApiTest {

	private static final Instant OCTOBER_2028 = LocalDateTime.of(2028, 10, 1, 12, 0)
			.atZone(SeasonClock.ZONE).toInstant();

	private static final Instant NOVEMBER_2026 = LocalDateTime.of(2026, 11, 13, 12, 0)
			.atZone(SeasonClock.ZONE).toInstant();

	/** A member with ducats whose newest race is newer than any of the asked member's. */
	private static final String OTHER = "000501";

	/** A member whose fee stood in 2027 and has lapsed in 2028, the season running. */
	private static final String LAPSED = "000502";

	private static final String ASKED = "000503";

	private final ObjectMapper json = new ObjectMapper();

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	@BeforeEach
	void threeMembersHoldDucats() {
		clock.moveTo(OCTOBER_2028);
		member(OTHER);
		member(LAPSED);
		member(ASKED);
		memberOf(OTHER, 2028);
		memberOf(LAPSED, 2027);
		memberOf(ASKED, 2027);
		memberOf(ASKED, 2028);

		/* His rows, written in this order, so the row's key is not the day of the race. */
		held(ASKED, "duk-sve-trke", "100", 3, null, null, "2025-03-01", "2028-01-05");
		held(ASKED, "duk-mesecni-km", "125", 1, 2028, 8, "2028-08-10", "2028-08-11");
		held(ASKED, "duk-obim-planete", "40075", 5, null, null, "2026-06-01", "2028-01-05");
		held(ASKED, "duk-sezonski-km", "1000", 2, 2028, null, "2028-05-05", "2028-05-06");
		/* Two more on the day of the race of August, from one family whose tier rose part way: the snapshot
		   of a threshold the family does not start at, and a tier the family does not have today. */
		held(ASKED, "duk-sve-trke", "200", 4, null, null, "2028-08-10", "2028-08-11");
		held(ASKED, "duk-sve-trke", "300", 2, null, null, "2028-08-10", "2028-08-11");

		held(OTHER, "duk-mesecni-km", "125", 1, 2028, 9, "2028-09-20", "2028-09-21");
		held(OTHER, "duk-maratoni", "100", 4, null, null, "2028-09-20", "2028-09-21");

		held(LAPSED, "duk-mesecni-km", "125", 1, 2028, 9, "2028-09-25", "2028-09-26");
		held(LAPSED, "duk-uspon", "100000", 4, null, null, "2028-09-25", "2028-09-26");
		held(LAPSED, "duk-sezonski-km", "1000", 2, 2027, null, "2027-11-02", "2028-01-05");
		held(LAPSED, "duk-maratoni", "100", 4, null, null, "2024-04-04", "2028-01-05");
	}

	@Test
	void everyFieldThePortalReadsIsAnsweredAndNothingBeside() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/ducat-awards/" + ASKED, answer(ASKED, null),
				"ducat-awards.json");
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/ducat-awards/" + ASKED, answer(ASKED, null));
	}

	@Test
	void hisDucatsComeNewestRaceFirstAndTheRestOfTheTieByTheCatalogueThenTheHigherThreshold()
			throws Exception {
		assertThat(rowsOf(answer(ASKED, null))).containsExactly(
				"duk-mesecni-km 125 1 2028 8",
				"duk-sve-trke 300 2 null null",
				"duk-sve-trke 200 4 null null",
				"duk-sezonski-km 1000 2 2028 null",
				"duk-obim-planete 40075 5 null null",
				"duk-sve-trke 100 3 null null");
	}

	@Test
	void aMemberWhoseFeeHasLapsedIsAnsweredWhatTheResultsWouldTellAndNotTheRunningSeason()
			throws Exception {
		/* The ducat of 2027 was written in 2028 and the ducat of all time was won before the league: both
		   are his to be shown, as the races that won them are on /api/results. The two won by races of 2028
		   are not, as those races are not. */
		assertThat(rowsOf(answer(LAPSED, null))).containsExactly(
				"duk-sezonski-km 1000 2 2027 null",
				"duk-maratoni 100 4 null null");
	}

	@Test
	void aMemberWhoseFeeStandsIsAnsweredTheRunningSeason() throws Exception {
		assertThat(rowsOf(answer(OTHER, null))).containsExactly(
				"duk-mesecni-km 125 1 2028 9",
				"duk-maratoni 100 4 null null");
	}

	@Test
	void aMemberWhoHasNotPaidTheSeasonStillAheadIsAnsweredTheDucatsOfThePreviousSeasonStillRunning()
			throws Exception {
		/* NOVEMBER 2026: the season being paid for is 2027, the first, and the one running is 2026, which
		   the league has no memberships for. The member who has not yet paid 2027 is not active, so the
		   only thing that serves his ducat of a race of 2026 is the half of the rule that says a day
		   before the first season is served. The other member has paid 2027 and his row is written FIRST,
		   so an answer that let every row through would put his ducat in front of the asked one's. */
		clock.moveTo(NOVEMBER_2026);
		member("000505");
		member("000506");
		memberOf("000506", 2027);
		held("000506", "duk-maratoni", "100", 4, null, null, "2026-06-06", "2026-06-07");
		held("000505", "duk-uspon", "100000", 4, null, null, "2026-06-05", "2026-06-07");

		assertThat(rowsOf(answer("000505", null))).containsExactly("duk-uspon 100000 4 null null");
		assertThat(rowsOf(answer("000506", null))).containsExactly("duk-maratoni 100 4 null null");
	}

	@Test
	void everyReaderIsAnsweredTheSameAndNobodyIsRefused() throws Exception {
		String member = account("clan@primer.rs", "competitor", OTHER);
		String superadmin = account("admin@primer.rs", "superadmin", null);
		MockHttpServletResponse visitor = response(ASKED, null);

		/* The two sessions are somebody on the server's own clock, so the two lines after this compare a
		   reader and not a second visitor. */
		assertThat(me(member)).contains("\"" + OTHER + "\"");
		assertThat(me(superadmin)).contains("superadmin");
		assertThat(visitor.getStatus()).isEqualTo(200);
		assertThat(response(ASKED, member).getContentAsString()).isEqualTo(visitor.getContentAsString());
		assertThat(response(ASKED, superadmin).getContentAsString()).isEqualTo(visitor.getContentAsString());
		assertThat(response(LAPSED, member).getContentAsString())
				.isEqualTo(response(LAPSED, null).getContentAsString());
	}

	@Test
	void aNumberNobodyHoldsADeletedMemberAndAMemberWithNothingAreOneAnswer() throws Exception {
		member("000504");
		db.sql("delete from competitor where member_number = ?").param(OTHER).update();

		for (String number : List.of("999999", "000504", OTHER, "nije-broj")) {
			MockHttpServletResponse answered = response(number, null);

			assertThat(answered.getStatus()).as(number).isEqualTo(200);
			assertThat(answered.getContentAsString()).as(number).isEqualTo("[]");
		}

		assertThat(rowsOf(answer(ASKED, null))).as("the case still has somebody with ducats").hasSize(6);
	}

	private static List<String> rowsOf(JsonNode answered) {
		List<String> rows = new ArrayList<>();

		for (JsonNode one : answered) {
			rows.add(one.get("ducat").asString() + " " + one.get("value").decimalValue().stripTrailingZeros()
					.toPlainString() + " " + one.get("tier").asInt() + " " + one.get("season") + " "
					+ one.get("month"));
		}

		return rows;
	}

	private String me(String session) throws Exception {
		MockHttpServletResponse response = http.perform(get("/api/me").cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();

		response.setCharacterEncoding("UTF-8");
		assertThat(response.getStatus()).as("the session is nobody on the server's clock").isEqualTo(200);

		return response.getContentAsString();
	}

	private JsonNode answer(String number, String session) throws Exception {
		return json.readTree(response(number, session).getContentAsString());
	}

	private MockHttpServletResponse response(String number, String session) throws Exception {
		MockHttpServletRequestBuilder request = get("/api/ducat-awards/" + number);

		if (session != null) {
			request.cookie(new Cookie(SessionCookie.NAME, session));
		}

		MockHttpServletResponse response = http.perform(request).andReturn().getResponse();

		response.setCharacterEncoding("UTF-8");

		return response;
	}

	/** One row of {@code ducat_award}, its kind and period copied from the family as the writer copies them. */
	private void held(String number, String code, String threshold, int tier, Integer season, Integer month,
			String wonOn, String awardedOn) {
		db.sql("insert into ducat_award (competitor_id, ducat_id, awarded_at, kind, threshold, reached, period,"
						+ " season, month, tier, won_on, result_id)"
						+ " select (select id from competitor where member_number = ?), d.id, ?, d.kind,"
						+ " cast(? as numeric), cast(? as numeric), d.period, ?, cast(? as smallint), ?,"
						+ " cast(? as date), null from ducat d where d.code = ?")
				.params(number, Timestamp.from(LocalDateTime.parse(awardedOn + "T03:00").atZone(SeasonClock.ZONE)
						.toInstant()), threshold, threshold, season, month, tier, wonOn, code)
				.update();
	}

	private void member(String number) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Ime', 'Prezime', 'M', date '1985-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, "0011223366" + number).update();
	}

	private void memberOf(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}

	/** An account with a live session, tied to a member where one is named; the secret of the session. */
	private String account(String email, String role, String member) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values ('Probni', 'Probic',"
						+ " ?, (select id from role where code = ?), (select id from competitor where member_number = ?))")
				.params(email, role, member).update();

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
		AClockTheCaseMoves theClockOfOctober2028() {
			return new AClockTheCaseMoves(OCTOBER_2028);
		}
	}

	/** A clock the case moves, standing in October 2028 until it says otherwise. */
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
}
