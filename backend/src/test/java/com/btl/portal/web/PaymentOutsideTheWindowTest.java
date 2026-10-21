package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A MEMBERSHIP PAID FOR OUTSIDE THE RENEWAL WINDOW (15 OCTOBER TO 31 DECEMBER), MEASURED ON THE SERVER.
 *
 * <p><b>Why this file exists.</b> PDL P8, the owner's confirmation of 16.10.2026 under the price list:
 * „moze da uplati odmah za tekucu godinu bez rangiranja". A new member who registers between 1
 * January and 14 October pays at once, for the RUNNING season, at the row „1. januara do 14. oktobra".
 * The screen did not offer him that (item U1), and the first question was whether the server would
 * take the payment if it did. Every case of {@code PaymentApiTest}, {@code PaymentsDueApiTest} and
 * {@code MyMembershipApiTest} stands inside the window or on October 2026, so nothing measured the
 * other nine and a half months of the year at the price and the booking.
 *
 * <p><b>What is measured, with nothing assumed:</b> the season the list is about and the season a
 * payment is booked for, the row of the price list the day falls in, the junior price replacing it,
 * the tax on a euro payment, the membership row the booking writes and the flag that activates the
 * member. Both edges of the window are walked from both sides, because a window that is wrong by a
 * day is wrong on exactly one of the four.
 *
 * <p><b>The clock is a fixed instant at noon UTC</b> (14:00 in Belgrade in summer, 13:00 in winter), so
 * no case here sits on the hour the league's zone and UTC disagree about the day.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PaymentOutsideTheWindowTest {

	private static final Instant IN_JUNE_2027 = Instant.parse("2027-06-01T10:00:00Z");

	private static final String MODERATOR = "blagajnik-van-prozora@primer.rs";

	/** Rank 1 is a town abroad, so a member of this fixture is billed in euro unless the case says otherwise. */
	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** A CLOCK THE CASE MOVES, reporting UTC as its zone as every other case in this package does. */
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
		AClockTheCaseMoves aClockThisFileMoves() {
			return new AClockTheCaseMoves(IN_JUNE_2027);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	private String moderatorCookie;

	@BeforeEach
	void aModeratorWhoMayWorkThePaymentsQueue() {
		clock.moveTo(IN_JUNE_2027);

		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Probni', 'Blagajnik', ?, (select id from role where code = 'moderator'))")
				.param(MODERATOR).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(MODERATOR, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:payments')")
				.param(MODERATOR).update();

		moderatorCookie = session.secret();
	}

	private long competitor(String referralSuffix, String memberNumber, String birthDate, String town) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Takmicar',"
						+ " 'M', ?, " + town + ", null, null, 2027, false, false, "
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(memberNumber, java.sql.Date.valueOf(LocalDate.parse(birthDate)),
						"00112233445566" + referralSuffix)
				.query(Long.class).single();
	}

	/** An account that belongs to the member, which is what puts him on the list of who owes. */
	private void anAccountOf(long competitorId, String email) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Probni', 'Clan', ?, (select id from role where code = 'competitor'), ?)")
				.params(email, competitorId).update();
	}

	private BigDecimal priceOf(String key, String column) {
		return db.sql("select " + column + " from price_row where key = ?").param(key)
				.query(BigDecimal.class).single();
	}

	private MockHttpServletResponse confirm(long competitorId, BigDecimal received, String method,
			String reference) throws Exception {
		return http.perform(post("/api/payments").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, moderatorCookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content(mapper.writeValueAsString(
								new PaymentApi.Confirm(competitorId, received, false, method, reference))))
				.andReturn().getResponse();
	}

	private JsonNode theList() throws Exception {
		String served = http.perform(get("/api/payments")
						.cookie(new Cookie(SessionCookie.NAME, moderatorCookie)))
				.andReturn().getResponse().getContentAsString();

		return mapper.readTree(served);
	}

	private JsonNode rowOf(JsonNode list, long competitorId) {
		for (JsonNode row : list.get("accounts")) {
			if (row.get("competitorId").asLong() == competitorId) {
				return row;
			}
		}

		throw new AssertionError("the list does not carry " + competitorId + ": " + list);
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED PAYS THE RUNNING SEASON, AT THE ROW THAT COVERS JUNE, AND IS ACTIVATED.
	 *
	 * <p>He lives in Serbia, so the amount is the dinar column and there is no tax. The reference is
	 * the running season and his number without its leading zeros, which is the shape the screen will
	 * print for him ({@code paymentReference} on the screen).
	 */
	@Test
	void aMemberWhoseFeeHasLapsedPaysTheRunningSeasonAtTheRowThatCoversTheDay() throws Exception {
		long id = competitor("c1", "005005", "1990-05-15", A_TOWN_IN_SERBIA);

		MockHttpServletResponse answer = confirm(id, priceOf("season", "rsd"), "ips", "2027005005");

		assertThat(answer.getStatus()).isEqualTo(201);

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(), PaymentApi.Confirmed.class);

		assertThat(body.memberNumber()).isEqualTo("005005");
		assertThat(body.amount()).isEqualByComparingTo(priceOf("season", "rsd"));
		assertThat(body.fee()).isEqualByComparingTo("0");

		assertThat(db.sql("select p.season || ' ' || r.key from payment p join price_row r on r.id = p.price_row_id"
						+ " where p.id = ?").param(body.paymentId()).query(String.class).single())
				.as("the season the money bought and the row of the price list it was priced at")
				.isEqualTo("2027 season");

		assertThat(db.sql("select basis from membership where competitor_id = ? and season = 2027")
				.param(id).query(String.class).single()).isEqualTo("payment");
		assertThat(db.sql("select count(*) from membership where competitor_id = ? and season <> 2027")
				.param(id).query(Long.class).single())
				.as("a payment in June buys the running season and no other")
				.isZero();
		assertThat(db.sql("select active from competitor where id = ?").param(id)
				.query(Boolean.class).single()).isTrue();
	}

	/** A NEW MEMBER ABROAD HAS NO NUMBER, PAYS THE ROW OF THE DAY WITH THE TAX ON IT, AND IS GIVEN THE NUMBER. */
	@Test
	void aNewMemberAbroadPaysTheRunningSeasonWithTheTaxAndIsGivenHisNumber() throws Exception {
		long id = competitor("c2", null, "1990-05-15", A_TOWN);
		BigDecimal sent = priceOf("season", "eur").add(priceOf("processing", "eur"));

		MockHttpServletResponse answer = confirm(id, sent, "paypal", null);

		assertThat(answer.getStatus()).isEqualTo(201);

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(), PaymentApi.Confirmed.class);

		assertThat(body.memberNumber()).matches("^[0-9]{6}$");
		assertThat(body.amount()).isEqualByComparingTo(priceOf("season", "eur"));
		assertThat(body.fee()).isEqualByComparingTo(priceOf("processing", "eur"));

		assertThat(db.sql("select p.season || ' ' || r.key from payment p join price_row r on r.id = p.price_row_id"
						+ " where p.id = ?").param(body.paymentId()).query(String.class).single())
				.isEqualTo("2027 season");
		assertThat(db.sql("select active from competitor where id = ?").param(id)
				.query(Boolean.class).single()).isTrue();
		assertThat(db.sql("select count(*) from membership where competitor_id = ? and season = 2027")
				.param(id).query(Long.class).single()).isEqualTo(1L);
	}

	/**
	 * THE JUNIOR PRICE REPLACES THE ROW OF THE DAY, AND THE SEASON IT IS MEASURED THROUGH IS THE RUNNING ONE.
	 *
	 * <p>Born in 2012 he is fifteen in 2027 and so still pays the junior price (the oldest junior in a
	 * season is fifteen), and not in 2028, which is the season a mistaken „next season" would measure.
	 */
	@Test
	void aJuniorPaysTheJuniorPriceOutsideTheWindowToo() throws Exception {
		long id = competitor("c3", null, "2012-05-05", A_TOWN);
		BigDecimal sent = priceOf("junior", "eur").add(priceOf("processing", "eur"));

		MockHttpServletResponse answer = confirm(id, sent, "paypal", null);

		assertThat(answer.getStatus()).isEqualTo(201);

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(), PaymentApi.Confirmed.class);

		assertThat(body.amount()).isEqualByComparingTo(priceOf("junior", "eur"));
		assertThat(priceOf("junior", "eur"))
				.as("the junior and the row of the day cost the same, so this case cannot tell them apart")
				.isNotEqualByComparingTo(priceOf("season", "eur"));
		assertThat(db.sql("select p.season || ' ' || r.key from payment p join price_row r on r.id = p.price_row_id"
						+ " where p.id = ?").param(body.paymentId()).query(String.class).single())
				.isEqualTo("2027 junior");
	}

	/**
	 * THE LIST OF WHO OWES IS ABOUT THE SEASON THE DAY NAMES AND PRICED AT THE ROW THE DAY FALLS IN, on
	 * both sides of both edges of the window.
	 *
	 * <p>14 October and 31 December are the last days outside and inside; 15 October and 1 January are the
	 * first days inside and outside. The three members answer three axes at once: abroad (the tax is
	 * added), in Serbia (it is not, and the column is the dinar one), and a junior (the junior price
	 * replaces whichever row applies).
	 */
	@ParameterizedTest
	@CsvSource({
			"2027-10-14T10:00:00Z, 2027, season",
			"2027-10-15T10:00:00Z, 2028, early",
			"2027-12-31T10:00:00Z, 2028, late",
			"2028-01-01T10:00:00Z, 2028, season"
	})
	void theListIsAboutTheSeasonTheDayNamesAndPricedAtTheRowTheDayFallsIn(String day, int season,
			String row) throws Exception {
		long abroad = competitor("d1", "005021", "1990-05-15", A_TOWN);
		long serbian = competitor("d2", "005022", "1990-05-15", A_TOWN_IN_SERBIA);
		long junior = competitor("d3", "005023", "2018-05-05", A_TOWN);

		anAccountOf(abroad, "d1@primer.rs");
		anAccountOf(serbian, "d2@primer.rs");
		anAccountOf(junior, "d3@primer.rs");

		clock.moveTo(Instant.parse(day));

		JsonNode list = theList();
		BigDecimal tax = priceOf("processing", "eur");

		assertThat(list.get("season").asInt()).isEqualTo(season);
		assertThat(rowOf(list, abroad).get("price").decimalValue())
				.isEqualByComparingTo(priceOf(row, "eur"));
		assertThat(rowOf(list, abroad).get("expected").decimalValue())
				.isEqualByComparingTo(priceOf(row, "eur").add(tax));
		assertThat(rowOf(list, serbian).get("price").decimalValue())
				.isEqualByComparingTo(priceOf(row, "rsd"));
		assertThat(rowOf(list, serbian).get("expected").decimalValue())
				.isEqualByComparingTo(priceOf(row, "rsd"));
		assertThat(rowOf(list, junior).get("price").decimalValue())
				.isEqualByComparingTo(priceOf("junior", "eur"));
		assertThat(rowOf(list, junior).get("expected").decimalValue())
				.isEqualByComparingTo(priceOf("junior", "eur").add(tax));
	}
}
