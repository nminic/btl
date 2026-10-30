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
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE CATEGORY IS KEPT PER SEASON, AND EVERY DOOR ANSWERS THE CATEGORY OF THE SEASON IT SPEAKS OF.
 *
 * <p>The decisions, all of 30.10.2026 (PDL, the answers to the questions of PR 664):
 * <ul>
 * <li>„Hocu strukturalno ovo da resim, zasto se kategorije ne cuvaju po sezoni vec sad?" - the wish is a row
 * per member and season (V81);</li>
 * <li>„dok traje trenutna sezona, prikazuje se kategorija u trenutnoj sezoni. Ukoliko clan nije clan
 * trenutne sezone nego naredne, prikazuje se na njegovom profilu da je clan te buduce kategorije. Ukoliko
 * clan jeste clan i tekuce i naredne sezone, 1.1. se njegova kategorija automatski menja, a prethodna
 * sezona ostaje zamrznuta sa njegovom starom kategorijom" - the card;</li>
 * <li>„poredak svake sezone prikazuje kategoriju te sezone" and „Prikazuj u proslim" - the list of
 * categories per season;</li>
 * <li>„Za sezonu bez prava rangiranja server u javnom odgovoru ne šalje ni kategoriju ni oznaku da je član
 * bez prava" - nothing for such a season, on the list or on a runner;</li>
 * <li>„Izbor kategorije za novu sezonu nasleđuje poslednji raniji izbor" - a season with no row reads the
 * last one before it, and the age category where there is none at all.</li>
 * </ul>
 *
 * <p><b>THE AXES, AND WHERE EACH STATE STANDS.</b> The clock stands at {@link #IN_THE_WINDOW}, 20 November
 * 2027: 2027 is running and 2028 is on sale, so the two seasons are told apart by every rule.
 * <ul>
 * <li>{@link #BOTH} holds 2027 and 2028 and wants different things for them (the beginners' category in
 * 2027, his age in 2028), and he crosses from {@code 24-} to {@code 25-39} between them: the wish and the
 * band of one season can never be read for the other without the answer changing.</li>
 * <li>{@link #ONLY_NEXT} holds 2028 alone, so his card speaks of 2028; {@link #ONLY_RUNNING} holds 2027
 * alone and has no wish written at all, so he is in his age category.</li>
 * <li>{@link #WITHOUT_THE_RIGHT} holds 2027 activated on 2 April and 2028 as well: his card speaks of 2028
 * as the card of a member of 2028 alone does (PDL, 30.10.2026), and 2027 is on no list of his, while 2028
 * is. {@link #WITHOUT_THE_RIGHT_AND_NOTHING_AFTER} holds 2027 activated late and nothing else: his card
 * says nothing.</li>
 * <li>{@link #CLOSED_BY_HIS_OWN} wants the beginners' category in 2027 and has 13 points IN 2027: the season
 * that is still being decided cannot close itself, and closes 2028, which inherits the wish.</li>
 * <li>{@link #INHERITS} wrote his wish for 2027 alone and holds 2028 too, with no points: 2028 reads the
 * 2027 row.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TheCategoryOfEachSeasonTest {

	/** 20 November 2027 at noon: 2027 runs, 2028 is on sale. */
	private static final Instant IN_THE_WINDOW = Instant.parse("2027-11-20T11:00:00Z");

	/** The last second of 2027 in Belgrade, and the first of 2028. */
	private static final Instant THE_LAST_SECOND_OF_2027 = Instant.parse("2027-12-31T22:59:59Z");

	private static final Instant THE_FIRST_SECOND_OF_2028 = Instant.parse("2027-12-31T23:00:00Z");

	/** 2027 frozen (1 January 2028 at 16:00), 2028 running. */
	private static final Instant IN_FEBRUARY_2028 = Instant.parse("2028-02-15T11:00:00Z");

	/** The day before 2028 goes on sale (11 November): the running season is the only one there is. */
	private static final Instant THE_DAY_BEFORE_THE_WINDOW = Instant.parse("2027-11-10T11:00:00Z");

	private static final Instant ACTIVATED_IN_TIME = Instant.parse("2026-10-20T10:00:00Z");

	/** After 31 March 2027, so 2027 held from that day has no right to rank (PDL, 28.10.2026). */
	private static final Instant ACTIVATED_LATE = Instant.parse("2027-04-02T10:00:00Z");

	private static final Instant SOLD_IN_NOVEMBER = Instant.parse("2027-11-15T10:00:00Z");

	private static final String BOTH = "000201";

	private static final String ONLY_NEXT = "000202";

	private static final String ONLY_RUNNING = "000203";

	private static final String WITHOUT_THE_RIGHT = "000204";

	private static final String CLOSED_BY_HIS_OWN = "000205";

	private static final String INHERITS = "000206";

	/** On the list (his fee stands) and holding no row of either season: the card falls back to the running one. */
	private static final String HOLDS_NEITHER = "000207";

	/** Holds 2027 activated late and nothing for 2028: the one whose card stays empty. */
	private static final String WITHOUT_THE_RIGHT_AND_NOTHING_AFTER = "000208";

	/** A row no member's life produces (a 2028 membership activated after 31 March 2028 is read on 20 November 2027). */
	private static final String BOTH_WITHOUT_THE_RIGHT = "000209";

	private static final String THE_ADMINISTRATION = "moderator-clanovi@primer.rs";

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
			return new AClockTheCaseMoves(IN_THE_WINDOW);
		}
	}

	@BeforeEach
	void sixMembersAndTwoSeasons() {
		clock.moveTo(IN_THE_WINDOW);

		long both = competitor(BOTH, "M", "2003-03-03");
		held(both, 2027, ACTIVATED_IN_TIME);
		held(both, 2028, SOLD_IN_NOVEMBER);
		wish(both, 2027, true);
		wish(both, 2028, false);

		long onlyNext = competitor(ONLY_NEXT, "M", "1980-03-03");
		held(onlyNext, 2028, SOLD_IN_NOVEMBER);
		wish(onlyNext, 2028, true);

		long onlyRunning = competitor(ONLY_RUNNING, "F", "1970-03-03");
		held(onlyRunning, 2027, ACTIVATED_IN_TIME);

		long withoutTheRight = competitor(WITHOUT_THE_RIGHT, "M", "1990-03-03");
		held(withoutTheRight, 2027, ACTIVATED_LATE);
		held(withoutTheRight, 2028, SOLD_IN_NOVEMBER);
		wish(withoutTheRight, 2027, true);
		wish(withoutTheRight, 2028, false);

		long closedByHisOwn = competitor(CLOSED_BY_HIS_OWN, "F", "1990-03-03");
		held(closedByHisOwn, 2027, ACTIVATED_IN_TIME);
		held(closedByHisOwn, 2028, SOLD_IN_NOVEMBER);
		wish(closedByHisOwn, 2027, true);

		competitor(HOLDS_NEITHER, "F", "2000-03-03");

		long bothWithoutTheRight = competitor(BOTH_WITHOUT_THE_RIGHT, "M", "1990-03-03");
		held(bothWithoutTheRight, 2027, ACTIVATED_LATE);
		held(bothWithoutTheRight, 2028, Instant.parse("2028-04-02T10:00:00Z"));

		long withoutTheRightAndNothingAfter = competitor(WITHOUT_THE_RIGHT_AND_NOTHING_AFTER, "M", "1990-03-03");
		held(withoutTheRightAndNothingAfter, 2027, ACTIVATED_LATE);
		wish(withoutTheRightAndNothingAfter, 2027, true);

		long inherits = competitor(INHERITS, "M", "1995-03-03");
		held(inherits, 2027, ACTIVATED_IN_TIME);
		held(inherits, 2028, SOLD_IN_NOVEMBER);
		wish(inherits, 2027, true);

		aRace("trka-2027", "Trka 2027", "2027-05-10");
		aRace("trka-2028", "Trka 2028", "2028-05-10");
		aRun(CLOSED_BY_HIS_OWN, "Trka 2027", "2027-05-10", "13.00");
		aRun(BOTH, "Trka 2027", "2027-05-10", "3.00");
		aRun(WITHOUT_THE_RIGHT, "Trka 2027", "2027-05-10", "4.00");

		for (String number : List.of(BOTH, ONLY_NEXT, WITHOUT_THE_RIGHT)) {
			account(number + "@primer.rs", "competitor", number);
		}
		account(THE_ADMINISTRATION, "moderator", null);
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'entity:members')")
				.param(THE_ADMINISTRATION).update();
	}

	/* ------------------------------------------------------------------------ the card */

	@Test
	void theCardOfAMemberOfBothSeasonsSpeaksOfTheRunningOneUntilNewYear() throws Exception {
		assertThat(card(BOTH)).isEqualTo("2027 24- beginner");

		clock.moveTo(THE_LAST_SECOND_OF_2027);
		assertThat(card(BOTH)).as("the card moved before New Year in Belgrade").isEqualTo("2027 24- beginner");

		clock.moveTo(THE_FIRST_SECOND_OF_2028);
		assertThat(card(BOTH))
				.as("1.1. se njegova kategorija automatski menja: the card still speaks of 2027 after midnight")
				.isEqualTo("2028 25-39 age");
	}

	@Test
	void theCardOfAMemberOfTheNextSeasonAloneSpeaksOfIt() throws Exception {
		assertThat(card(ONLY_NEXT)).isEqualTo("2028 40-54 beginner");
		assertThat(card(ONLY_RUNNING)).as("no wish at all is the age category").isEqualTo("2027 55+ age");
	}

	/**
	 * A MEMBER ON THE LIST WITH NO ROW OF EITHER SEASON, which the list itself treats as somebody whose fee
	 * stands: his card speaks of the running season (my derivation from the decision, which names the two
	 * seasons he may hold and not this), and he stands in no table, so no season is on his list.
	 */
	@Test
	void aMemberWhoHoldsNeitherSeasonIsCardedForTheRunningOneAndStandsInNoTable() throws Exception {
		assertThat(card(HOLDS_NEITHER)).isEqualTo("2027 25-39 age");
		assertThat(seasonsOf(recordOf(null, HOLDS_NEITHER))).isEmpty();
	}

	@Test
	void aSeasonHeldWithoutTheRightCarriesNoCategoryAndNoMark() throws Exception {
		JsonNode his = recordOf(null, WITHOUT_THE_RIGHT);

		/* THREE STATES OF ONE FIELD. (a) holds 2027 without the right and 2028 as well, (b) holds 2028 alone,
		   (c) holds 2027 without the right and nothing else. PDL, 30.10.2026: (a) is carded exactly as (b). */
		JsonNode alone = recordOf(null, ONLY_NEXT).path("category");
		assertThat(his.path("category").isNull())
				.as("(a) is the only member of the public list with no category, which says he is without the"
						+ " right: his card names no category although he holds 2028")
				.isFalse();
		assertThat(card(WITHOUT_THE_RIGHT))
				.as("(a) is carded for 2027, the season he holds without the right, which hands out his choice")
				.isEqualTo("2028 25-39 age");
		assertThat(new ArrayList<>(his.path("category").propertyNames()))
				.as("(a) carries a card of another shape than (b)")
				.isEqualTo(new ArrayList<>(alone.propertyNames()));
		assertThat(recordOf(null, WITHOUT_THE_RIGHT_AND_NOTHING_AFTER).path("category").isNull())
				.as("(c) holds 2027 without the right and no 2028, so his card has nothing to carry")
				.isTrue();
		assertThat(recordOf(null, BOTH_WITHOUT_THE_RIGHT).path("category").isNull())
				.as("(d) holds both seasons without the right: a season without it carries nothing, whichever it is")
				.isTrue();

		clock.moveTo(THE_DAY_BEFORE_THE_WINDOW);
		assertThat(recordOf(null, WITHOUT_THE_RIGHT).path("category").isNull())
				.as("(a) before 11 November, when 2028 is not on sale yet and the running season is the only one")
				.isTrue();
		clock.moveTo(IN_THE_WINDOW);
		assertThat(seasonsOf(his)).as("2027 is on his list although he holds it without the right")
				.containsExactly("2028 25-39 age");
		assertThat(whole("/api/competitors", null)).as("a mark of „without the right” left the server")
				.doesNotContain("unranked");

		clock.moveTo(THE_FIRST_SECOND_OF_2028);
		assertThat(card(WITHOUT_THE_RIGHT)).isEqualTo("2028 25-39 age");
	}

	@Test
	void heIsToldHisOwnCategoryAndSoIsTheAdministration() throws Exception {
		JsonNode mine = mapper.readTree(whole("/api/me", WITHOUT_THE_RIGHT + "@primer.rs")).path("member");

		assertThat(mine.path("categorySeason").asInt() + " " + mine.path("ageBand").asString() + " "
				+ mine.path("beginner").asBoolean())
				.as("/api/me withheld his own category of a season he holds without the right")
				.isEqualTo("2027 25-39 true");

		JsonNode row = StreamSupport.stream(mapper.readTree(whole("/api/members", THE_ADMINISTRATION)).spliterator(),
						false)
				.filter(one -> one.path("memberNumber").asString().equals(WITHOUT_THE_RIGHT)).findFirst().orElseThrow();

		assertThat(row.path("ageBand").asString() + " " + row.path("beginner").asBoolean())
				.as("the administration was not told his category").isEqualTo("25-39 true");
	}

	/* -------------------------------------------------------------- the list of seasons */

	@Test
	void everySeasonHeStandsInCarriesThatSeasonsBandAndWish() throws Exception {
		assertThat(seasonsOf(recordOf(null, BOTH)))
				.as("one season's wish or band was read for the other")
				.containsExactly("2027 24- beginner", "2028 25-39 age");
		assertThat(seasonsOf(recordOf(null, ONLY_RUNNING))).containsExactly("2027 55+ age");
		assertThat(seasonsOf(recordOf(null, ONLY_NEXT))).containsExactly("2028 40-54 beginner");
	}

	@Test
	void aSeasonWithNoWishReadsTheLastOneBeforeIt() throws Exception {
		assertThat(seasonsOf(recordOf(null, INHERITS)))
				.as("Izbor kategorije za novu sezonu nasleđuje poslednji raniji izbor")
				.containsExactly("2027 25-39 beginner", "2028 25-39 beginner");
	}

	@Test
	void theSeasonBeingDecidedNeverClosesItselfAndClosesTheNextOne() throws Exception {
		assertThat(seasonsOf(recordOf(null, CLOSED_BY_HIS_OWN)))
				.as("13 points in 2027 closed 2027 itself, or left 2028 open")
				.containsExactly("2027 25-39 beginner", "2028 25-39 age");
	}

	@Test
	void aFrozenSeasonKeepsItsCategoryWhenTheNextOneBegins() throws Exception {
		clock.moveTo(IN_FEBRUARY_2028);

		assertThat(seasonsOf(recordOf(null, BOTH)))
				.as("prethodna sezona ostaje zamrznuta sa njegovom starom kategorijom")
				.containsExactly("2027 24- beginner", "2028 25-39 age");
	}

	/* ---------------------------------------------------------------------- the runner */

	@Test
	void aRunnerCarriesTheCategoryOfTheSeasonOfHisRunAndNoneWhereHeHasNoRight() throws Exception {
		Map<String, JsonNode> runners = new HashMap<>();
		mapper.readTree(whole("/api/results", null))
				.forEach(one -> runners.put(one.path("memberNumber").asString(), one.path("runner")));

		assertThat(runners.get(BOTH).path("ageBand").asString() + " " + runners.get(BOTH).path("beginner").asBoolean())
				.as("the runner of 2027 carries a category of another season").isEqualTo("24- true");
		assertThat(runners.get(WITHOUT_THE_RIGHT).path("ageBand").isNull()
				&& runners.get(WITHOUT_THE_RIGHT).path("beginner").isNull())
				.as("a run of a season held without the right carries a category").isTrue();
		assertThat(runners.get(WITHOUT_THE_RIGHT).path("firstName").asString())
				.as("and his name stays, because he stands on the list of the race").isEqualTo("Probni");
	}

	@Test
	void aRunBeforeTheFirstSeasonIsToldFromTheMembershipOfTheSeasonItsBandIsWorkedOutFor() throws Exception {
		/* A run of 2026 is banded for 2027 (the first season the league has), and nobody holds a 2026. The right
		   to rank is asked of the same 2027 the category is worked out for, so the one who holds 2027 late has
		   none here either and the one who holds it in time has it, and two members of one run, one season. */
		aRace("trka-2026", "Trka 2026", "2026-05-10");
		aRun(WITHOUT_THE_RIGHT, "Trka 2026", "2026-05-10", "5.00");
		aRun(BOTH, "Trka 2026", "2026-05-10", "6.00");

		Map<String, JsonNode> runners = new HashMap<>();
		mapper.readTree(whole("/api/results", null))
				.forEach(one -> runners.put(one.path("memberNumber").asString() + " " + one.path("date").asString(),
						one.path("runner")));

		JsonNode withoutTheRight = runners.get(WITHOUT_THE_RIGHT + " 2026-05-10");
		assertThat(withoutTheRight.path("ageBand").isNull() && withoutTheRight.path("beginner").isNull())
				.as("a run of 2026 told the category of 2027 to a member who holds 2027 without the right to rank")
				.isTrue();
		assertThat(withoutTheRight.path("firstName").asString()).as("and his name stays").isEqualTo("Probni");
		JsonNode hisRunOf2027 = runners.get(WITHOUT_THE_RIGHT + " 2027-05-10");
		assertThat(hisRunOf2027.path("ageBand").isNull() && hisRunOf2027.path("beginner").isNull())
				.as("his run of 2027 itself, which is held without the right").isTrue();
		JsonNode bothOf2026 = runners.get(BOTH + " 2026-05-10");
		assertThat(bothOf2026.path("ageBand").asString() + " " + bothOf2026.path("beginner").asBoolean())
				.as("a run of 2026 of a member who holds 2027 with the right carries the category of 2027")
				.isEqualTo("24- true");
	}

	/* ------------------------------------------------------------------------ the write */

	@Test
	void aWishForTheNextSeasonChangesTheNextSeasonAlone() throws Exception {
		assertThat(sent(BOTH, "{\"firstSeason\":true}")).isEqualTo(200);

		assertThat(wishes(BOTH)).as("the wish for 2028 was written over 2027's, or for no season at all")
				.containsExactly("2027 true", "2028 true");
		assertThat(seasonsOf(recordOf(null, BOTH))).containsExactly("2027 24- beginner", "2028 25-39 beginner");
		assertThat(card(BOTH)).as("a choice for 2028 moved the card of 2027").isEqualTo("2027 24- beginner");
	}

	@Test
	void theFirstWishForANewSeasonIsARowOfItsOwn() throws Exception {
		assertThat(sent(INHERITS, "{\"firstSeason\":false}")).isEqualTo(200);

		assertThat(wishes(INHERITS)).as("the inherited row of 2027 was changed instead of a row for 2028")
				.containsExactly("2027 true", "2028 false");
	}

	/* ---------------------------------------------------------------------- the fixture */

	private long competitor(String number, String gender, String born) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
						+ " first_season, active, referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at) values (?, 'Probni', ?, ?, cast(? as date),"
						+ " (select id from place where rank = 1), 2027, true, ?, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, "Clan" + number, gender, born, String.format("00aa%012x", ++issued))
				.query(Long.class).single();
	}

	private void held(long member, int season, Instant activated) {
		HeldOn.season(db, member, season, "feeExempt", activated);
	}

	private void wish(long member, int season, boolean beginner) {
		db.sql("insert into category_wish (competitor_id, season, beginner) values (?, ?, ?)")
				.params(member, season, beginner).update();
	}

	private void aRace(String slug, String name, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description,"
						+ " link) values (?, ?, cast(? as date), (select id from place where rank = 1), null, null,"
						+ " 'race', false, '', '')")
				.params(slug, name, day).update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
						+ " descent_m) values ((select id from btl_event where slug = ?), ?, false, cast(? as date),"
						+ " 'length', 0, 10.00, 0, 0)")
				.params(slug, name, day).update();
	}

	private void aRun(String number, String race, String day, String points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds,"
						+ " points) values ((select id from competitor where member_number = ?),"
						+ " (select id from race where name = ?), cast(? as date), 10.00, 0, 0, 3600,"
						+ " cast(? as numeric))")
				.params(number, race, day, points).update();
	}

	private void account(String email, String role, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

		if (memberNumber != null) {
			db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
							+ " where email = ?")
					.params(memberNumber, email).update();
		}

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))), Timestamp.from(now),
						Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/* ---------------------------------------------------------------------- the answers */

	private String whole(String path, String email) throws Exception {
		MockHttpServletRequestBuilder asking = get(path);

		return http.perform(email == null ? asking
						: asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	private JsonNode recordOf(String email, String number) throws Exception {
		return StreamSupport.stream(mapper.readTree(whole("/api/competitors", email)).spliterator(), false)
				.filter(one -> one.path("memberNumber").asString().equals(number))
				.findFirst().orElseThrow();
	}

	private static String said(JsonNode category) {
		return category.path("season").asInt() + " " + category.path("ageBand").asString() + " "
				+ (category.path("beginner").asBoolean() ? "beginner" : "age");
	}

	private String card(String number) throws Exception {
		JsonNode card = recordOf(null, number).path("category");

		return card.isNull() ? "none" : said(card);
	}

	private static List<String> seasonsOf(JsonNode record) {
		List<String> seasons = new ArrayList<>();
		record.path("categories").forEach(one -> seasons.add(said(one)));

		return seasons;
	}

	private List<String> wishes(String number) {
		return db.sql("select w.season || ' ' || w.beginner from category_wish w join competitor c"
						+ " on c.id = w.competitor_id where c.member_number = ? order by w.season")
				.param(number).query(String.class).list();
	}

	private int sent(String number, String body) throws Exception {
		if (!sessions.containsKey(number + "@primer.rs")) {
			account(number + "@primer.rs", "competitor", number);
		}

		return http.perform(put("/api/me/category").with(csrf()).contentType(MediaType.APPLICATION_JSON)
						.content(body).cookie(new Cookie(SessionCookie.NAME,
								sessions.get(number + "@primer.rs").secret())))
				.andReturn().getResponse().getStatus();
	}
}
