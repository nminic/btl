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
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
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
 * AT 16:00:00 ON 1 JANUARY A MEMBER WHO HOLDS ONLY THE SEASON THAT JUST ENDED IS NO LONGER ACTIVE, ON EVERY
 * ROUTE THAT ASKS, AND ONE SECOND BEFORE HE STILL IS.
 *
 * <p>The owner's decision (PDL 06.11.2026, „Član sa članarinom samo za sezonu koja je upravo završila ostaje
 * aktivan 1. januara do 16:00"): „na spisku članova, u najavama i komentarima ... U 16:00:00 postaje
 * neaktivan." {@link ResultApi} measured the instant; the six other readers ({@link AttendanceApi},
 * {@link CommentApi}, {@link CompetitorApi}, {@link MembersApi}, {@link PairApi}, {@link TeamApi}) did not,
 * so replacing their moment with the start of the day, or their clock with the machine's, kept every case
 * green (review of PR 678: 12, 23, 42, 14, 20 and 128 cases passing).
 *
 * <p><b>Both edges from ONE fixture, and the clock moves between them</b>, the shape
 * {@code TeamWriteApiTest} keeps: the same two members at 15:59:59 and at 16:00:00, one who holds 2027 and
 * 2028 (the control, there at both instants, so an empty answer cannot pass for „he is gone") and one who
 * holds only 2027. The instant is the whole of the case: the day does not tell the two edges apart, and
 * neither does the machine's clock or the database's year.
 *
 * <p><b>Each route says it in its own words</b>: the list of competitors does not carry him, the members
 * list carries him with {@code active} false, the pair is not a pair, the team is administered by the other
 * member, the announcement of arrival is gone and the author of his comment has no number.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TheMomentTheSeasonEndsIsAskedByEveryReaderTest {

	static final Instant ONE_SECOND_BEFORE_FOUR = LocalDateTime.of(2028, 1, 1, 15, 59, 59)
			.atZone(SeasonClock.ZONE).toInstant();

	static final Instant FOUR = LocalDateTime.of(2028, 1, 1, 16, 0, 0).atZone(SeasonClock.ZONE).toInstant();

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
			return new AClockTheCaseMoves(ONE_SECOND_BEFORE_FOUR);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private String boraCookie;

	private String moderatorCookie;

	@BeforeEach
	void fixture() {
		long aca = competitor("000971", "Aca", "M", "00000000000b3121");
		long bora = competitor("000972", "Bora", "F", "00000000000b3122");

		HeldOn.season(db, aca, 2027, "feeExempt");
		HeldOn.season(db, bora, 2027, "feeExempt");
		HeldOn.season(db, bora, 2028, "feeExempt");

		db.sql("insert into racing_pair (season, man_id, woman_id) values (2028, ?, ?)").params(aca, bora).update();
		/* NO NAMED ADMINISTRATOR: the longest in the team administers it, and of two who joined together the
		   smaller number, which is the member who holds only 2027. */
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values ('tim-b312', 'Tim b312', '', '', (select id from place where rank = 1), null,"
				+ " null, null, 2027, null)").update();

		for (long each : new long[] {aca, bora}) {
			db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
					+ " values (?, (select id from team where slug = 'tim-b312'), 2027, null, null)")
					.param(each).update();
		}

		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description,"
				+ " link) values ('dogadjaj-b312', 'Dogadjaj b312', date '2028-02-01',"
				+ " (select id from place where rank = 1), null, null, 'race', false, '', '')").update();
		db.sql("insert into attending (event_id, competitor_id)"
				+ " values ((select id from btl_event where slug = 'dogadjaj-b312'), ?)").param(aca).update();
		db.sql("insert into event_comment (event_id, competitor_id, who, published_at, rating_organisation,"
				+ " rating_value, rating_ambience, body) values ((select id from btl_event where slug ="
				+ " 'dogadjaj-b312'), ?, 'Aca Probic', timestamptz '2027-12-01 10:00:00+00', 5, 5, 5, 'Dobro')")
				.param(aca).update();

		boraCookie = account("b312-bora@primer.rs", "competitor", bora);
		moderatorCookie = account("b312-mod@primer.rs", "moderator", null);
		db.sql("insert into account_admin_right (account_id, right_code)"
				+ " values ((select id from account where email = 'b312-mod@primer.rs'), 'entity:members')").update();
	}

	@Test
	void theListOfCompetitorsCarriesHimUntilFourAndNotFrom() throws Exception {
		assertThat(numbersIn("/api/competitors", boraCookie, ONE_SECOND_BEFORE_FOUR, "memberNumber"))
				.containsExactly("000971", "000972");
		assertThat(numbersIn("/api/competitors", boraCookie, FOUR, "memberNumber")).containsExactly("000972");
	}

	@Test
	void theListOfMembersSaysHeIsActiveUntilFourAndNotFrom() throws Exception {
		assertThat(activeFlagsIn(ONE_SECOND_BEFORE_FOUR)).containsExactly(true, true);
		assertThat(activeFlagsIn(FOUR)).containsExactly(false, true);
	}

	@Test
	void theirPairIsAPairUntilFourAndNotFrom() throws Exception {
		assertThat(answer("/api/pairs", boraCookie, ONE_SECOND_BEFORE_FOUR)).hasSize(1);
		assertThat(answer("/api/pairs", boraCookie, FOUR)).isEmpty();
	}

	@Test
	void theTeamIsAdministeredByTheLongestMemberWhoStandsAtThatInstant() throws Exception {
		assertThat(answer("/api/teams", boraCookie, ONE_SECOND_BEFORE_FOUR).get(0).get("administeredByMe")
				.asBoolean()).as("at 15:59:59 he stands and the smaller number administers").isFalse();
		assertThat(answer("/api/teams", boraCookie, FOUR).get(0).get("administeredByMe").asBoolean())
				.as("at 16:00:00 he does not stand and she is the one left").isTrue();
	}

	@Test
	void hisAnnouncedArrivalIsThereUntilFourAndNotFrom() throws Exception {
		assertThat(numbersIn("/api/attendance", boraCookie, ONE_SECOND_BEFORE_FOUR, "memberNumber"))
				.containsExactly("000971");
		assertThat(answer("/api/attendance", boraCookie, FOUR)).isEmpty();
	}

	@Test
	void hisCommentCarriesHisNumberUntilFourAndNotFrom() throws Exception {
		assertThat(answer("/api/comments", boraCookie, ONE_SECOND_BEFORE_FOUR).get(0).get("memberNumber")
				.asString()).isEqualTo("000971");
		assertThat(answer("/api/comments", boraCookie, FOUR)).hasSize(1);
		assertThat(answer("/api/comments", boraCookie, FOUR).get(0).get("memberNumber").isNull())
				.as("the comment stays, the link to the profile goes").isTrue();
	}

	private List<Boolean> activeFlagsIn(Instant at) throws Exception {
		List<Boolean> flags = new ArrayList<>();

		for (JsonNode member : answer("/api/members", moderatorCookie, at)) {
			flags.add(member.get("active").asBoolean());
		}

		return flags;
	}

	private List<String> numbersIn(String path, String cookie, Instant at, String field) throws Exception {
		List<String> numbers = new ArrayList<>();

		for (JsonNode each : answer(path, cookie, at)) {
			numbers.add(each.get(field).asString());
		}

		return numbers;
	}

	private JsonNode answer(String path, String cookie, Instant at) throws Exception {
		clock.moveTo(at);

		MockHttpServletResponse answered = http.perform(get(path).cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();

		assertThat(answered.getStatus()).as(path + " at " + at).isEqualTo(200);

		return new ObjectMapper().readTree(answered.getContentAsString(StandardCharsets.UTF_8));
	}

	private long competitor(String number, String first, String gender, String referral) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
				+ " first_season, referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
				+ " shirt_size, health_statement_at) values (?, ?, 'Probic', ?, date '1990-01-01',"
				+ " (select id from place where rank = 1), 2027, ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, first, gender, referral).query(Long.class).single();
	}

	private String account(String email, String role, Long competitor) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', ?,"
				+ " (select id from role where code = ?))").params(email, role).update();

		if (competitor != null) {
			db.sql("update account set competitor_id = ? where email = ?").params(competitor, email).update();
		}

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
