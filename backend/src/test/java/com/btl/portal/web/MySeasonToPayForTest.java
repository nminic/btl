package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * {@code GET /api/me/applications} SAYS WHICH SEASON THE ASKER STILL HAS TO PAY BEFORE HE CAN ENTER
 * A TEAM (PDL, ODLUKA 30.10.2026, "U prelaznom roku svaki ulaz u tim traži plaćenu narednu
 * sezonu").
 *
 * <p>A class of its own and not a case of {@link MyApplicationsApiTest}, because that one reads
 * the real clock and the answer here depends on the day twice over: on whether the transfer window
 * is open, and on which season is on sale inside it. A clock the case moves is the shape
 * {@code TeamJoiningApiTest} uses.
 *
 * <p><b>The three members are three states and not one member three times</b>, so that the answer
 * for each is a claim about HIS rows: one holds both seasons, one holds only the season being run
 * (he owes the next), and one holds only the season on sale (nothing owed, which is what tells the
 * season on sale from the season being run).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, MySeasonToPayForTest.TheClockTheseCasesUse.class})
@Transactional
class MySeasonToPayForTest {

	private static final String HOLDS_BOTH = "000100";

	private static final String HOLDS_ONLY_THE_ONE_BEING_RUN = "000200";

	private static final String HOLDS_ONLY_THE_NEXT = "000300";

	/** Inside the window of 2027: the season on sale is 2028 and the one being run is 2027. */
	private static final Instant INSIDE_THE_WINDOW = Instant.parse("2027-11-20T09:00:00Z");

	/** Outside it: September, where the season on sale is the one being run. */
	private static final Instant OUTSIDE_THE_WINDOW = Instant.parse("2027-09-20T09:00:00Z");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private int issued;

	private final Map<String, SecretToken> sessions = new HashMap<>();

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
			return new AClockTheCaseMoves(INSIDE_THE_WINDOW);
		}
	}

	@BeforeEach
	void threeMembersOfWhomTwoHoldDifferentSeasons() {
		clock.moveTo(INSIDE_THE_WINDOW);

		member(HOLDS_BOTH, 2027, 2028);
		member(HOLDS_ONLY_THE_ONE_BEING_RUN, 2027);
		member(HOLDS_ONLY_THE_NEXT, 2028);
	}

	/**
	 * THE MEMBER WHO HOLDS ONLY THE SEASON BEING RUN OWES THE NEXT, AND THE ANSWER NAMES IT.
	 *
	 * <p>{@code competitor.active} is true for all three, so only the season he is asked about can
	 * tell them apart. The number is the season on sale, 2028, and not the season being run.
	 */
	@Test
	void aMemberWhoHoldsOnlyTheSeasonBeingRunOwesTheNextAndTheAnswerNamesIt() throws Exception {
		assertThat(owedBy(HOLDS_ONLY_THE_ONE_BEING_RUN).asInt()).isEqualTo(2028);
	}

	/** Whoever holds the season on sale owes nothing, whatever else he does or does not hold. */
	@Test
	void aMemberWhoHoldsTheSeasonOnSaleOwesNothing() throws Exception {
		assertThat(owedBy(HOLDS_BOTH).isNull()).as("holding both").isTrue();
		assertThat(owedBy(HOLDS_ONLY_THE_NEXT).isNull())
				.as("holding the one on sale alone (the season being run is not what is asked)")
				.isTrue();
	}

	/**
	 * OUTSIDE THE WINDOW NOBODY ENTERS A TEAM, SO NOBODY OWES A SENTENCE.
	 *
	 * <p>The member asked is the one who holds only 2028: outside the window the season on sale is
	 * the one being run (2027), which he does NOT hold, so a version without the window would name
	 * it. The member who holds 2027 would be null either way and could not tell the two apart.
	 */
	@Test
	void outsideTheWindowNobodyOwesAnything() throws Exception {
		clock.moveTo(OUTSIDE_THE_WINDOW);

		assertThat(owedBy(HOLDS_ONLY_THE_NEXT).isNull()).isTrue();
		assertThat(owedBy(HOLDS_ONLY_THE_ONE_BEING_RUN).isNull()).isTrue();
	}

	/** The field is on every answer, null or not: a screen reads it without asking whether it is there. */
	@Test
	void theFieldIsAlwaysThereAndNullWhereNothingIsOwed() throws Exception {
		JsonNode whole = answerTo(HOLDS_BOTH);

		assertThat(whole.has("seasonToPayFor")).isTrue();
		assertThat(whole.path("seasonToPayFor").isNull()).isTrue();
	}

	// ----- the fixture -------------------------------------------------------------------

	private JsonNode owedBy(String memberNumber) throws Exception {
		return answerTo(memberNumber).path("seasonToPayFor");
	}

	private JsonNode answerTo(String memberNumber) throws Exception {
		MockHttpServletRequestBuilder asking = get("/api/me/applications")
				.cookie(new Cookie(SessionCookie.NAME, sessions.get(memberNumber).secret()));

		return new ObjectMapper().readTree(
				http.perform(asking).andReturn().getResponse().getContentAsString());
	}

	private void member(String number, int... seasons) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, active, "
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', ?, 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, true, "
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, "Probić" + number, String.format("%016x", ++issued))
				.update();

		for (int season : seasons) {
			db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
							+ " select c.id, ?, 'feeExempt', 'Probni Probic',"
							+ " timestamptz '2026-09-01 10:00:00+00' from competitor c"
							+ " where c.member_number = ?")
					.params(season, number)
					.update();
		}

		String email = number + "@primer.rs";

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, number)
				.update();

		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(number, session);
	}
}
