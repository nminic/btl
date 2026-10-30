package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
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
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE RIGHT TO RANK, AS THE SERVER TELLS IT TO THE SCREENS: per run ({@code /api/results},
 * {@code inItsStanding}) and per member for the season the list is drawn for ({@code /api/competitors},
 * {@code unranked}).
 *
 * <p>The owner, 28.10.2026: „Odlučuje dan aktivacije, za svaki osnov isto: uplata proknjižena posle
 * 31.3., aktivacija iz balansa preporuke posle 31.3. i oslobođenje Upravnog odbora doneto posle 31.3.
 * ne daju pravo rangiranja za tu sezonu." And 30.10.2026: „Storno pa ponovna aktivacija: odlučuje dan
 * aktivacije članstva koje sada stoji".
 *
 * <p><b>Every member below differs from every other in exactly the thing one wrong reading would
 * miss</b>, and each line of the fixture names the reading it refuses:
 *
 * <ul>
 * <li>000201 and 000202 are booked on the same UTC date, one hour apart, on the two sides of
 * midnight in Belgrade: a rule read in UTC, or one that leaves 31 March itself out, gives them the
 * same answer.</li>
 * <li>000203, 000204 and 000202 are the three bases, each after 31 March, so dropping any one of the
 * three moments reads that member as ranked. 000207 is an exemption decided by 31 March, so a rule
 * that refused every exemption is visible too.</li>
 * <li>000205 spent his balance on 2027 on 20 March, was cancelled, and was activated again from the
 * balance on 5 April. The book still holds the first line; the membership that stands names the
 * second. A moment looked up by the member and the season finds the first.</li>
 * <li>000206 paid on 31 March (the statement is dated that day) and was booked on 1 April: „Rok se
 * meri po danu kada je liga uplatu proknjižila."</li>
 * <li>000208 ranks in 2027 and not in 2028, and 000209 the other way round, and 000209's membership of
 * 2028 was activated in November 2027: the season a membership is OF decides, never the year it was
 * activated in, and never the year the clock stands in.</li>
 * <li>000210 ran in 2027 and holds no membership of it at all: he counts in no season, so in no
 * standing either.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class RightToRankTest {

	/** 2027 and 2028 are both over by then, so every run of both is served whatever the fee. */
	private static final Instant AFTER_BOTH_SEASONS = Instant.parse("2029-06-15T10:00:00Z");

	/** The list is drawn for 2027. */
	private static final Instant JUNE_2027 = Instant.parse("2027-06-15T10:00:00Z");

	/** The list is drawn for 2028. */
	private static final Instant JUNE_2028 = Instant.parse("2028-06-15T10:00:00Z");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	@Autowired
	private BestOfficialSeason best;

	@BeforeEach
	void elevenMembersOfTwoSeasons() {
		clock.moveTo(AFTER_BOTH_SEASONS);

		event("prolecna-2027", "2027-05-01");
		race("prolecna-2027", "Prolecna", "2027-05-01");
		event("prolecna-2028", "2028-05-01");
		race("prolecna-2028", "Prolecna 2028", "2028-05-01");

		/* 23:30 on 31 March in Belgrade, and ten minutes into 1 April: one UTC date. */
		HeldOn.season(db, member("000201"), 2027, "payment", Instant.parse("2027-03-31T21:30:00Z"));
		HeldOn.season(db, member("000202"), 2027, "payment", Instant.parse("2027-03-31T22:10:00Z"));
		HeldOn.season(db, member("000203"), 2027, "balance", Instant.parse("2027-04-02T10:00:00Z"));
		HeldOn.season(db, member("000204"), 2027, "feeExempt", Instant.parse("2027-04-03T10:00:00Z"));

		/* THE CANCELLED ACTIVATION LEAVES ITS LINE IN THE BOOK; THE ONE THAT STANDS NAMES ITS OWN. */
		long again = member("000205");
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season, occurred_at,"
						+ " recorded_by_name) values (?, -30.00, 'EUR', 'membership', 2027,"
						+ " timestamptz '2027-03-20 10:00:00+00', 'Blagajnik Probni')")
				.param(again).update();
		HeldOn.season(db, again, 2027, "balance", Instant.parse("2027-04-05T10:00:00Z"));

		/* PAID ON 31 MARCH, BOOKED ON 1 APRIL. */
		Long booked = HeldOn.season(db, member("000206"), 2027, "payment",
				Instant.parse("2027-04-01T08:00:00Z"));
		long statement = db.sql("insert into bank_statement (account, number, dated, loaded_at,"
						+ " loaded_by_name) values ('160-0000000000001-11', 1, date '2027-03-31',"
						+ " timestamptz '2027-04-01 07:00:00+00', 'Blagajnik Probni') returning id")
				.query(Long.class).single();
		db.sql("insert into bank_statement_line (statement_id, position, order_number, payer, amount,"
						+ " purpose, season, payment_id) values (?, 1, 'NALOG-1', 'Uplatilac', 33.00,"
						+ " 'Clanarina', 2027, ?)")
				.params(statement, booked).update();

		HeldOn.season(db, member("000207"), 2027, "feeExempt", Instant.parse("2027-03-01T10:00:00Z"));

		long eight = member("000208");
		HeldOn.season(db, eight, 2027, "payment", Instant.parse("2026-11-20T10:00:00Z"));
		HeldOn.season(db, eight, 2028, "feeExempt", Instant.parse("2028-05-01T10:00:00Z"));

		long nine = member("000209");
		HeldOn.season(db, nine, 2027, "payment", Instant.parse("2027-06-01T10:00:00Z"));
		HeldOn.season(db, nine, 2028, "payment", Instant.parse("2027-11-20T10:00:00Z"));

		member("000210");

		for (int number = 201; number <= 210; number++) {
			run("000" + number, "Prolecna", "2027-05-01", 10.00 + number - 200);
		}

		run("000208", "Prolecna 2028", "2028-05-01", 7.00);
		run("000209", "Prolecna 2028", "2028-05-01", 9.00);
	}

	/** Whether the standings of its season count each run, by whose run it is and its day. */
	private Map<String, Boolean> inItsStanding() throws Exception {
		Map<String, Boolean> counted = new TreeMap<>();

		for (JsonNode row : answer("/api/results")) {
			counted.put(row.path("memberNumber").asString() + " " + row.path("date").asString(),
					row.path("inItsStanding").asBoolean());
		}

		return counted;
	}

	@Test
	void aRunCountsInTheStandingsOnlyWhereItsSeasonWasActivatedBy31March() throws Exception {
		assertThat(inItsStanding()).isEqualTo(new TreeMap<>(Map.ofEntries(
				Map.entry("000201 2027-05-01", true),
				Map.entry("000202 2027-05-01", false),
				Map.entry("000203 2027-05-01", false),
				Map.entry("000204 2027-05-01", false),
				Map.entry("000205 2027-05-01", false),
				Map.entry("000206 2027-05-01", false),
				Map.entry("000207 2027-05-01", true),
				Map.entry("000208 2027-05-01", true),
				Map.entry("000208 2028-05-01", false),
				Map.entry("000209 2027-05-01", false),
				Map.entry("000209 2028-05-01", true),
				Map.entry("000210 2027-05-01", false))));
	}

	/**
	 * AND A RUN WITHOUT THE RIGHT TO RANK STILL COUNTS IN ITS SEASON, which is what the profile, the
	 * ducats, the threshold of the beginners' category and the season before on the board of progress
	 * read (PDL, 30.10.2026). Only the one who was no member of 2027 counts in no season.
	 */
	@Test
	void aRunWithoutTheRightToRankStillCountsInItsSeason() throws Exception {
		Map<String, Boolean> inItsSeason = new TreeMap<>();

		for (JsonNode row : answer("/api/results")) {
			inItsSeason.put(row.path("memberNumber").asString() + " " + row.path("date").asString(),
					row.path("inItsSeason").asBoolean());
		}

		assertThat(inItsSeason).containsEntry("000202 2027-05-01", true)
				.containsEntry("000205 2027-05-01", true)
				.containsEntry("000208 2028-05-01", true)
				.containsEntry("000210 2027-05-01", false);
	}

	/** Who the list says is unranked, by member number, for the season it is drawn for. */
	private Map<String, Boolean> unranked() throws Exception {
		Map<String, Boolean> told = new TreeMap<>();

		for (JsonNode one : answer("/api/competitors")) {
			told.put(one.path("memberNumber").asString(), one.path("unranked").asBoolean());
		}

		return told;
	}

	@Test
	void theListSaysWhoHoldsTheSeasonItIsDrawnForWithoutTheRightToRank() throws Exception {
		clock.moveTo(JUNE_2027);

		assertThat(unranked()).isEqualTo(new TreeMap<>(Map.ofEntries(
				Map.entry("000201", false), Map.entry("000202", true), Map.entry("000203", true),
				Map.entry("000204", true), Map.entry("000205", true), Map.entry("000206", true),
				Map.entry("000207", false), Map.entry("000208", false), Map.entry("000209", true),
				Map.entry("000210", false))));
	}

	/**
	 * A YEAR ON, THE SAME LIST ASKS ABOUT 2028: 000208 and 000209 swap, and everybody who holds no
	 * membership of 2028 is not „without the right to rank" but no member of it, which is not this
	 * field's to say.
	 */
	@Test
	void aYearOnTheListAsksAboutTheNextSeason() throws Exception {
		clock.moveTo(JUNE_2028);

		assertThat(unranked()).containsEntry("000208", true)
				.containsEntry("000209", false)
				.containsEntry("000202", false)
				.containsEntry("000201", false);
	}

	/**
	 * THE THRESHOLD OF THE BEGINNERS' CATEGORY COUNTS A SEASON WITHOUT THE RIGHT TO RANK (PDL,
	 * 30.10.2026: „Njegovi bodovi se računaju u prag od 12 bodova"). 000202 took 12 points in 2027 and
	 * held it without the right to rank; 2028 is asked about, so 2027 is the season before.
	 */
	@Test
	void theThresholdOfTheBeginnersCategoryCountsASeasonWithoutTheRightToRank() {
		long id = db.sql("select id from competitor where member_number = '000202'")
				.query(Long.class).single();

		assertThat(best.pointsFor(id, 2028)).isEqualByComparingTo(new BigDecimal("12.00"));
	}

	/**
	 * A MEMBERSHIP WITH NO MOMENT AT ALL RANKS: the one exemption written before V35 gave exemptions
	 * their trail, whose check V35 adds {@code not valid} for exactly that row. Written here by
	 * dropping the two checks inside this case's own transaction, which is the shape that row has on
	 * the server and nothing else can write.
	 */
	@Test
	void anExemptionFromBeforeItsTrailRanks() throws Exception {
		db.sql("alter table membership drop constraint membership_free_of_the_fee_says_who").update();
		db.sql("alter table membership drop constraint membership_free_of_the_fee_says_when").update();
		db.sql("insert into membership (competitor_id, season, basis) values (?, 2027, 'feeExempt')")
				.param(db.sql("select id from competitor where member_number = '000210'")
						.query(Long.class).single())
				.update();

		assertThat(inItsStanding()).containsEntry("000210 2027-05-01", true);
	}

	private JsonNode answer(String path) throws Exception {
		return new ObjectMapper().readTree(http.perform(get(path)).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8));
	}

	private long member(String number) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Ime', 'Prezime', 'M', date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027, false, true,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, "00112233" + number + "aa")
				.query(Long.class).single();
	}

	private void event(String slug, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', null, 'Kraljevo',"
						+ " (select id from country where code = 'RS'), 'race', false, '', '')")
				.params(slug, slug).update();
	}

	private void race(String eventSlug, String name, String day) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " date '" + day + "', 'length', 0, 10, 0, 0)")
				.params(eventSlug, name).update();
	}

	private void run(String member, String raceName, String day, double points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from race where name = ?), date '" + day + "', 10, 0, 0, 3000, ?)")
				.params(member, raceName, points).update();
	}

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
			return new AClockTheCaseMoves(AFTER_BOTH_SEASONS);
		}
	}
}
