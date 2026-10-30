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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A CHANGE OF BASIS KEEPS THE DAY THE SEASON WAS FIRST ACTIVATED, AND A CANCELLATION DOES NOT.
 *
 * <p>The owner, 30.10.2026 (PDL, „„Bez prava rangiranja", odgovori na pitanja iz PR-a 664", chosen
 * with the recommendation): „Promena osnova članstva (uplata u oslobođenje i obrnuto) zadržava dan
 * prve aktivacije te sezone, pa sezona ne gubi pravo rangiranja samo zato što je članstvo ponovo
 * upisano. Promena osnova nije storno: storno pa nova aktivacija i dalje odlučuje po danu nove
 * aktivacije". And 28.10.2026: „Odlučuje dan aktivacije, za svaki osnov isto".
 *
 * <p><b>Every change goes through the route</b>, {@code PUT /api/members/{memberNumber}/membership},
 * the one door that changes a basis, and the clock is moved between the first activation and the
 * change. The cases assert the MOMENT {@link WhenASeasonWasActivated#of} reads afterwards, not only
 * whether the season ranks: a carry from the wrong row or the wrong season can rank for the wrong
 * reason, and only the moment tells.
 *
 * <p><b>The axes, each with both of its states</b>, and where:
 *
 * <ul>
 * <li>the direction: a payment to an exemption and back, two members ({@link
 * #aChangeAfter31MarchKeepsTheFirstDayInBothDirections});</li>
 * <li>the first activation before 31 March and after it ({@link
 * #aFirstActivationAfter31MarchStaysWithoutTheRight});</li>
 * <li>the change before 31 March and after it ({@link #aChangeBefore31MarchKeepsTheFirstDayToo});</li>
 * <li>a change against a cancellation and a new activation onto the same basis on the same day
 * ({@link #aChangeIsNotACancellation});</li>
 * <li>one change and two ({@link #twoChangesInARowCarryTheFirstDay});</li>
 * <li>a balance, which is not changed on the row, and its cancellation ({@link
 * #aBalanceIsNotChangedAndItsCancellationStartsAgain});</li>
 * <li>the season: a member who holds the running season and the next one, changed in the window
 * ({@link #inTheWindowOnlyTheSeasonChangedCarries});</li>
 * <li>the exemption from before its trail, which has no moment, beside a row with a known one
 * ({@link #theExemptionWithNoMomentCarriesThatItHasNone});</li>
 * <li>a booking refused and a second press ({@link #aRefusedBookingAndASecondPressMoveNothing});</li>
 * <li>and the three readers of the right ({@link #everyReaderAsksTheCarriedDay}).</li>
 * </ul>
 *
 * <p><b>The day of the first activation is never the day of the change</b>, in any case here, and
 * the member changed is never the first written nor the only one: a bystander comes first and is
 * touched by nothing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AChangeOfBasisKeepsTheFirstActivationTest {

	private static final Instant MARCH_5 = Instant.parse("2027-03-05T10:00:00Z");

	private static final Instant MARCH_20 = Instant.parse("2027-03-20T10:00:00Z");

	private static final Instant MARCH_21 = Instant.parse("2027-03-21T10:00:00Z");

	private static final Instant MARCH_25 = Instant.parse("2027-03-25T10:00:00Z");

	private static final Instant APRIL_15 = Instant.parse("2027-04-15T10:00:00Z");

	private static final Instant MAY_20 = Instant.parse("2027-05-20T10:00:00Z");

	private static final Instant JUNE_10 = Instant.parse("2027-06-10T10:00:00Z");

	private static final Instant JUNE_15 = Instant.parse("2027-06-15T10:00:00Z");

	private static final String OVER_THE_MEMBERS = "moderator-clanovi-prvi-dan@primer.rs";

	private static final String TO_AN_EXEMPTION = "{\"from\": \"payment\", \"to\": \"feeExempt\"}";

	private static final String TO_A_PAYMENT =
			"{\"from\": \"feeExempt\", \"to\": \"payment\", \"received\": 38, \"method\": \"paypal\"}";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	private String session;

	private long bystander;

	@BeforeEach
	void aBystanderAndTheAdministration() {
		clock.moveTo(MARCH_5);

		bystander = member("000300");
		HeldOn.season(db, bystander, 2027, "payment", MARCH_5);

		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Mira', 'Clanovic', ?, (select id from role where code = 'moderator'))")
				.param(OVER_THE_MEMBERS).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'entity:members')")
				.param(OVER_THE_MEMBERS).update();

		SecretToken token = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(OVER_THE_MEMBERS, token.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		session = token.secret();
	}

	/* ------------------------------------------------------------------------------------
	   THE FIXTURE
	   ------------------------------------------------------------------------------------ */

	private long member(String number) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, active,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Ime', 'Prezime', 'M', date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027, true,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, "00112233" + number + "bb")
				.query(Long.class).single();
	}

	private MockHttpServletResponse sent(MockHttpServletRequestBuilder asks, String json) throws Exception {
		return http.perform(asks.with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json)
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	/** The change of basis, on the day the clock is moved to, answered 200. */
	private void changed(String number, String json, Instant when) throws Exception {
		clock.moveTo(when);

		MockHttpServletResponse answer = sent(put("/api/members/" + number + "/membership"), json);

		assertThat(answer.getStatus()).as(answer.getContentAsString(StandardCharsets.UTF_8)).isEqualTo(200);
	}

	/** The owner's „storno", then the season granted free of the fee again, both on that day. */
	private void cancelledAndGrantedAgain(String number, String basis, Instant when) throws Exception {
		clock.moveTo(when);

		assertThat(sent(delete("/api/members/" + number + "/membership"), "{\"basis\": \"" + basis + "\"}")
				.getStatus()).isEqualTo(200);
		assertThat(sent(post("/api/members/" + number + "/membership"), "{\"basis\": \"feeExempt\"}")
				.getStatus()).isEqualTo(201);
	}

	/** The moment the season is read as activated at, as every reader of the right reads it. */
	private Instant activated(long member, int season) {
		Timestamp at = db.sql("select " + WhenASeasonWasActivated.of("m") + " from membership m"
						+ " where m.competitor_id = ? and m.season = ?")
				.params(member, season)
				.query((row, i) -> row.getTimestamp(1))
				.list()
				.getFirst();

		return at == null ? null : at.toInstant();
	}

	private boolean ranks(long member, int season) {
		Instant at = activated(member, season);

		return WhenASeasonWasActivated.ranks(season, at == null ? null : Timestamp.from(at));
	}

	private boolean carried(long member, int season) {
		return Boolean.TRUE.equals(db.sql("select first_activation_carried from membership"
						+ " where competitor_id = ? and season = ?")
				.params(member, season).query(Boolean.class).single());
	}

	private String basis(long member, int season) {
		return db.sql("select basis from membership where competitor_id = ? and season = ?")
				.params(member, season).query(String.class).single();
	}

	private JsonNode answer(String path, boolean signedIn) throws Exception {
		MockHttpServletRequestBuilder asks = get(path);

		return mapper.readTree(http.perform(signedIn ? asks.cookie(new Cookie(SessionCookie.NAME, session)) : asks)
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
	}

	/* ------------------------------------------------------------------------------------
	   THE CASES
	   ------------------------------------------------------------------------------------ */

	@Test
	void aChangeAfter31MarchKeepsTheFirstDayInBothDirections() throws Exception {
		long paid = member("000301");
		long freed = member("000302");
		HeldOn.season(db, paid, 2027, "payment", MARCH_20);
		HeldOn.season(db, freed, 2027, "feeExempt", MARCH_21);

		changed("000301", TO_AN_EXEMPTION, MAY_20);
		changed("000302", TO_A_PAYMENT, MAY_20);

		assertThat(basis(paid, 2027)).isEqualTo("feeExempt");
		assertThat(basis(freed, 2027)).isEqualTo("payment");
		assertThat(activated(paid, 2027)).as("the payment's day, not the day of the change").isEqualTo(MARCH_20);
		assertThat(activated(freed, 2027)).as("the exemption's day, not the day of the change").isEqualTo(MARCH_21);
		assertThat(ranks(paid, 2027)).isTrue();
		assertThat(ranks(freed, 2027)).isTrue();

		assertThat(activated(bystander, 2027)).as("nobody else's day moves").isEqualTo(MARCH_5);
		assertThat(carried(bystander, 2027)).isFalse();
	}

	/** Both outcomes rank here, so only the moment can tell the first day from the day of the change. */
	@Test
	void aChangeBefore31MarchKeepsTheFirstDayToo() throws Exception {
		long paid = member("000303");
		HeldOn.season(db, paid, 2027, "payment", MARCH_20);

		changed("000303", TO_AN_EXEMPTION, MARCH_25);

		assertThat(activated(paid, 2027)).isEqualTo(MARCH_20);
		assertThat(ranks(paid, 2027)).isTrue();
	}

	/** The change carries a day and decides nothing: a first day after 31 March stays without the right. */
	@Test
	void aFirstActivationAfter31MarchStaysWithoutTheRight() throws Exception {
		long late = member("000304");
		HeldOn.season(db, late, 2027, "payment", APRIL_15);

		changed("000304", TO_AN_EXEMPTION, MAY_20);

		assertThat(activated(late, 2027)).isEqualTo(APRIL_15);
		assertThat(ranks(late, 2027)).isFalse();
	}

	/**
	 * „Promena osnova nije storno": the same first day, the same day of the act and the same basis at
	 * the end, and the two acts part on the right.
	 */
	@Test
	void aChangeIsNotACancellation() throws Exception {
		long changed = member("000305");
		long cancelled = member("000306");
		HeldOn.season(db, changed, 2027, "payment", MARCH_20);
		HeldOn.season(db, cancelled, 2027, "payment", MARCH_20);

		changed("000305", TO_AN_EXEMPTION, MAY_20);
		cancelledAndGrantedAgain("000306", "payment", MAY_20);

		assertThat(basis(changed, 2027)).isEqualTo("feeExempt");
		assertThat(basis(cancelled, 2027)).isEqualTo("feeExempt");

		assertThat(activated(changed, 2027)).isEqualTo(MARCH_20);
		assertThat(ranks(changed, 2027)).isTrue();

		assertThat(carried(cancelled, 2027)).as("a season activated again after a cancellation carries nothing")
				.isFalse();
		assertThat(activated(cancelled, 2027)).isEqualTo(MAY_20);
		assertThat(ranks(cancelled, 2027)).isFalse();
	}

	@Test
	void twoChangesInARowCarryTheFirstDay() throws Exception {
		long twice = member("000307");
		HeldOn.season(db, twice, 2027, "payment", MARCH_20);

		changed("000307", TO_AN_EXEMPTION, MAY_20);

		assertThat(activated(twice, 2027)).isEqualTo(MARCH_20);

		changed("000307", TO_A_PAYMENT, JUNE_10);

		assertThat(basis(twice, 2027)).isEqualTo("payment");
		assertThat(activated(twice, 2027)).as("the first day, not the day of the first change").isEqualTo(MARCH_20);
		assertThat(ranks(twice, 2027)).isTrue();
	}

	/**
	 * „Iz aktivacije iz balansa se na redu ne prelazi direktno u uplatu ni u oslobođenje: storno (balans
	 * se vraća protivstavkom), pa nova radnja." So the change is refused and moves nothing, and the way
	 * there is a cancellation, which starts the day again.
	 */
	@Test
	void aBalanceIsNotChangedAndItsCancellationStartsAgain() throws Exception {
		long fromTheBalance = member("000308");
		HeldOn.season(db, fromTheBalance, 2027, "balance", MARCH_20);

		clock.moveTo(MAY_20);
		MockHttpServletResponse refused = sent(put("/api/members/000308/membership"),
				"{\"from\": \"balance\", \"to\": \"feeExempt\"}");

		assertThat(refused.getStatus()).isEqualTo(400);
		assertThat(refused.getContentAsString(StandardCharsets.UTF_8)).contains("thisChangeIsNotOffered");
		assertThat(activated(fromTheBalance, 2027)).isEqualTo(MARCH_20);
		assertThat(carried(fromTheBalance, 2027)).isFalse();

		cancelledAndGrantedAgain("000308", "balance", MAY_20);

		assertThat(carried(fromTheBalance, 2027)).isFalse();
		assertThat(activated(fromTheBalance, 2027)).isEqualTo(MAY_20);
		assertThat(ranks(fromTheBalance, 2027)).isFalse();
	}

	/**
	 * ON 20 NOVEMBER 2027 THE SEASON ON SALE IS 2028, and the member holds both: 2027 from 20 March, 2028
	 * from 12 November. The change is of 2028, so 2027 keeps the day it has and is not handed the one
	 * 2028 carries, which would take its right away.
	 */
	@Test
	void inTheWindowOnlyTheSeasonChangedCarries() throws Exception {
		Instant november12 = Instant.parse("2027-11-12T10:00:00Z");
		long both = member("000309");
		HeldOn.season(db, both, 2027, "payment", MARCH_20);
		HeldOn.season(db, both, 2028, "payment", november12);

		changed("000309", TO_AN_EXEMPTION, Instant.parse("2027-11-20T10:00:00Z"));

		assertThat(basis(both, 2028)).isEqualTo("feeExempt");
		assertThat(activated(both, 2028)).isEqualTo(november12);
		assertThat(basis(both, 2027)).isEqualTo("payment");
		assertThat(carried(both, 2027)).isFalse();
		assertThat(activated(both, 2027)).isEqualTo(MARCH_20);
		assertThat(ranks(both, 2027)).isTrue();
	}

	/**
	 * THE EXEMPTION FROM BEFORE ITS TRAIL HAS NO MOMENT AND RANKS (btl/CLAUDE.md, section 11; V35 adds its
	 * checks {@code not valid} for that one row), so a change over it carries THAT: the flag with no day,
	 * and the row that replaces it ranks rather than answering the day of the change. Beside it a row with
	 * a known day carries its day. Written by dropping V35's two checks inside this case, the shape the
	 * row has on the server and nothing else can write.
	 */
	@Test
	void theExemptionWithNoMomentCarriesThatItHasNone() throws Exception {
		db.sql("alter table membership drop constraint membership_free_of_the_fee_says_who").update();
		db.sql("alter table membership drop constraint membership_free_of_the_fee_says_when").update();

		long beforeTheTrail = member("000310");
		long known = member("000311");
		db.sql("insert into membership (competitor_id, season, basis) values (?, 2027, 'feeExempt')")
				.param(beforeTheTrail).update();
		HeldOn.season(db, known, 2027, "feeExempt", MARCH_20);

		assertThat(activated(beforeTheTrail, 2027)).isNull();
		assertThat(ranks(beforeTheTrail, 2027)).isTrue();

		changed("000310", TO_A_PAYMENT, MAY_20);
		changed("000311", TO_A_PAYMENT, MAY_20);

		assertThat(carried(beforeTheTrail, 2027)).isTrue();
		assertThat(activated(beforeTheTrail, 2027)).as("no moment, carried as none").isNull();
		assertThat(ranks(beforeTheTrail, 2027)).isTrue();

		assertThat(carried(known, 2027)).isTrue();
		assertThat(activated(known, 2027)).isEqualTo(MARCH_20);

		changed("000310", TO_AN_EXEMPTION, JUNE_10);

		assertThat(activated(beforeTheTrail, 2027)).as("and carried as none again").isNull();
		assertThat(ranks(beforeTheTrail, 2027)).isTrue();
	}

	/** A booking the price list refuses leaves the row as it was, carried day included; a repeat moves nothing. */
	@Test
	void aRefusedBookingAndASecondPressMoveNothing() throws Exception {
		long member = member("000312");
		HeldOn.season(db, member, 2027, "payment", MARCH_20);

		changed("000312", TO_AN_EXEMPTION, MAY_20);
		changed("000312", TO_AN_EXEMPTION, JUNE_10);

		assertThat(activated(member, 2027)).isEqualTo(MARCH_20);
		assertThat(db.sql("select count(*) from membership_change where competitor_id = ?")
				.param(member).query(Long.class).single()).as("the second press writes nothing").isOne();

		db.sql("update price_row set eur = 0, rsd = 0 where kind = 'period'").update();
		clock.moveTo(JUNE_15);

		assertThat(sent(put("/api/members/000312/membership"), TO_A_PAYMENT).getStatus()).isEqualTo(409);
		assertThat(basis(member, 2027)).isEqualTo("feeExempt");
		assertThat(carried(member, 2027)).isTrue();
		assertThat(activated(member, 2027)).isEqualTo(MARCH_20);
	}

	/**
	 * THE THREE READERS OF THE RIGHT ASK THE SAME DAY: the administration's list of seasons
	 * ({@link MembersApi}), the public list's table of the season ({@link CategoryOfASeason}) and the
	 * standings of a run ({@link ResultApi}). One member changed after 31 March keeps the right, one
	 * cancelled and activated again that day does not.
	 */
	@Test
	void everyReaderAsksTheCarriedDay() throws Exception {
		long changed = member("000313");
		long cancelled = member("000314");
		HeldOn.season(db, changed, 2027, "payment", MARCH_20);
		HeldOn.season(db, cancelled, 2027, "payment", MARCH_20);

		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
						+ " description, link) values ('letnja-2027', 'letnja-2027', date '2027-06-01', null,"
						+ " 'Kraljevo', (select id from country where code = 'RS'), 'race', false, '', '')")
				.update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
						+ " descent_m) values ((select id from btl_event where slug = 'letnja-2027'), 'Letnja',"
						+ " false, date '2027-06-01', 'length', 0, 10, 0, 0)")
				.update();

		for (long one : List.of(changed, cancelled)) {
			db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
							+ " seconds, points) values (?, (select id from race where name = 'Letnja'),"
							+ " date '2027-06-01', 10, 0, 0, 3000, 11.00)")
					.param(one).update();
		}

		changed("000313", TO_AN_EXEMPTION, MAY_20);
		cancelledAndGrantedAgain("000314", "payment", MAY_20);

		clock.moveTo(JUNE_15);

		int listed = 0;

		for (JsonNode row : answer("/api/members", true)) {
			String number = row.path("memberNumber").asString();

			if (number.equals("000313") || number.equals("000314")) {
				listed++;
				assertThat(row.path("seasons").get(0).path("ranked").asBoolean())
						.as("the administration on " + number).isEqualTo(number.equals("000313"));
			}
		}

		assertThat(listed).as("both are on the administration's list").isEqualTo(2);

		int onThePublicList = 0;

		for (JsonNode one : answer("/api/competitors", false)) {
			String number = one.path("memberNumber").asString();
			boolean stands = false;

			for (JsonNode category : one.path("categories")) {
				stands |= category.path("season").asInt() == 2027;
			}

			if (number.equals("000313") || number.equals("000314")) {
				onThePublicList++;
				assertThat(stands).as("the table of 2027 on " + number).isEqualTo(number.equals("000313"));
			}
		}

		assertThat(onThePublicList).as("both are on the public list").isEqualTo(2);

		int seen = 0;

		for (JsonNode run : answer("/api/results", false)) {
			String number = run.path("memberNumber").asString();

			if (number.equals("000313") || number.equals("000314")) {
				seen++;
				assertThat(run.path("inItsStanding").asBoolean())
						.as("the standing of the run of " + number).isEqualTo(number.equals("000313"));
			}
		}

		assertThat(seen).as("both runs are served, so the standing was asked of both").isEqualTo(2);
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
			return new AClockTheCaseMoves(MARCH_5);
		}
	}
}
