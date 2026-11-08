package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * EVERY DOOR THAT MOVES A MEMBER'S RESULTS RECONCILES HIS DUCATS AFTER ITS COMMIT, AND ONLY AN APPROVAL OR
 * AN ENTRY BY THE LEAGUE TELLS HIM WHAT IT WON ({@link DucatsFollowTheResults}).
 *
 * <p><b>Committed, not rolled back.</b> The reconciliation runs in a transaction of its own and sees only
 * what is committed, so a case whose request ran inside the case's transaction would reconcile nothing and
 * prove nothing. Every row is written in auto-commit and {@link #everythingThisWroteGoes} takes it away.
 *
 * <p><b>A lock waits four seconds here and then fails</b> ({@code lock_timeout} on every connection of this
 * context), so a reconciliation called from INSIDE a door's transaction - which waits on the very row that
 * transaction holds {@code for update} - ends in a failure the step logs, and the case fails on its
 * assertion about the ducat instead of hanging. The same setting is how {@link
 * #aReconciliationThatFailsIsLoggedAndTheResultStands} makes the step fail on purpose.
 *
 * <p><b>THE AXES, AND WHERE EACH STATE STANDS.</b>
 * <ul>
 * <li><b>Whose:</b> Ana is the member the act is about. Bojan has run enough for a ducat of May and holds
 * none, so a door that reconciled the wrong member, or everybody, writes him one. Vera is written FIRST of
 * the three, so she has the lowest key, and is on the same race as Ana where a door moves more than one
 * member.
 * <li><b>The act:</b> approval (new and correction) and the league's two entries tell; the league's change
 * and deletion, the member's own deletion, a race and an event changed or deleted, and a cancelled season
 * do not.
 * <li><b>What the reconciliation did:</b> wrote a ducat, took one away, or met a row another writer wrote
 * first ({@link #aDucatSomebodyElseWroteFirstIsNotAnnounced}).
 * <li><b>One ducat or several in one act:</b> singular and plural words.
 * <li><b>The period:</b> a month, a season, for ever.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = "spring.datasource.hikari.connection-init-sql=set lock_timeout = '4s'")
class DucatsFollowTheResultsTest {

	/** 15.06.2027: the first season is running, May is behind it and June is the month of the clock. */
	private static final Instant IN_JUNE = Instant.parse("2027-06-15T10:00:00Z");

	private static final String VERA = "000971";

	private static final String ANA = "000972";

	private static final String BOJAN = "000973";

	private static final String THE_SUPERADMIN = "superadmin@okidac.rs";

	private static final String ANAS_ADDRESS = "ana@okidac.rs";

	private static final String THE_MONTHLY = "duk-mesecni-km";

	private static final String THE_SUBJECT = "Osvojili ste dukat";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private DataSource pool;

	@Autowired
	private AwardingDucats ducats;

	private SecretToken superadmin;

	private SecretToken anas;

	private int issued;

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		Clock theMiddleOfJune() {
			return Clock.fixed(IN_JUNE, ZoneOffset.UTC);
		}
	}

	@BeforeEach
	void threeMembersOfTheSeason() {
		member(VERA);
		member(ANA);
		member(BOJAN);
		membership(VERA);
		membership(ANA);
		membership(BOJAN);
		superadmin = account(THE_SUPERADMIN, "superadmin", null);
		anas = account(ANAS_ADDRESS, "competitor", ANA);

		/* AN EVENT WITH NO RACE FIRST, so no event shares its key with a race of this fixture, and a door that
		   asked for a race by the event's key, or the other way round, finds nobody. */
		event("dukat-okidac-bez-trke", "Bez trke", LocalDate.of(2027, 5, 1));

		/* BOJAN MEETS THE DUCAT OF MAY AND HOLDS NONE: whoever reconciles him by mistake writes it. */
		long bojans = race("dukat-okidac-bojan", "Bojanova trka", LocalDate.of(2027, 5, 9));

		result(BOJAN, bojans, "130");
	}

	@AfterEach
	void everythingThisWroteGoes() {
		/* THE MONEY AND THE SEASONS FIRST, because they do not go with the member (V79, ON DELETE SET NULL),
		   and the account before him, which he may not outlive (`account_competitor_fk`, restrict). */
		String ours = "(select id from competitor where member_number in ('" + VERA + "', '" + ANA + "', '"
				+ BOJAN + "'))";

		db.sql("delete from membership_change where competitor_id in " + ours).update();
		db.sql("delete from balance_entry where competitor_id in " + ours).update();
		db.sql("delete from membership where competitor_id in " + ours).update();
		db.sql("delete from payment where competitor_id in " + ours).update();
		db.sql("delete from account where email like '%@okidac.rs'").update();
		db.sql("delete from competitor where member_number in (?, ?, ?)").params(VERA, ANA, BOJAN).update();
		db.sql("delete from btl_event where slug like 'dukat-okidac-%'").update();
	}

	/* ===================================================================== the doors that tell */

	@Test
	void anApprovedRunWritesTheDucatItWonAndTellsHimInTheLeaguesName() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");

		long item = waiting(ANA, second, "30", null);

		assertThat(decided(item).getStatus()).isEqualTo(200);

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/5");
		assertThat(ducatMessagesTo(ANA)).containsExactly("Balkanska trkačka liga | " + THE_SUBJECT + " | "
				+ "Odobren vam je rezultat sa trke Majska trka od 20.05.2027, i njime ste osvojili dukat"
				+ " „Mesečni kilometri” za maj 2027. Dukat stoji na vašem profilu.");
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	@Test
	void anApprovedCorrectionWritesTheDucatItWonAndTellsHim() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");

		long corrected = result(ANA, second, "20");

		ducats.forMember(id(ANA));
		assertThat(ducatsOf(ANA)).as("120 km in May is short of the ducat").isEmpty();

		long item = waiting(ANA, second, "30", corrected);

		assertThat(decided(item).getStatus()).isEqualTo(200);

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/5");
		assertThat(ducatMessagesTo(ANA)).singleElement().asString()
				.contains("Odobren vam je rezultat sa trke Majska trka od 20.05.2027");
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	@Test
	void aRunTheLeagueEntersTellsHimInItsOwnWordsAndAnotherOnTheSameSaveIsReconciledToo() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");
		/* VERA HAS 110 KM IN MAY ALREADY, so the 20 the same save gives her carries her over too, and a
		   save that reconciled only its first row, or only Ana, leaves her without it. */
		result(VERA, first, "110");

		MockHttpServletResponse answer = http.perform(asking(THE_SUPERADMIN, post("/api/races/" + second
						+ "/results")).contentType(MediaType.APPLICATION_JSON)
						.content("{\"rows\":[" + row(VERA, "20") + "," + row(ANA, "30") + "]}"))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/5");
		assertThat(ducatsOf(VERA)).containsExactly(THE_MONTHLY + " 2027/5");
		assertThat(ducatMessagesTo(ANA)).containsExactly("Balkanska trkačka liga | " + THE_SUBJECT + " | "
				+ "Liga vam je unela rezultat sa trke Majska trka od 20.05.2027, i njime ste osvojili dukat"
				+ " „Mesečni kilometri” za maj 2027. Dukat stoji na vašem profilu.");
		assertThat(ducatMessagesTo(VERA)).hasSize(1);
		assertThat(ducatsOf(BOJAN)).isEmpty();
	}

	@Test
	void aRunTheLeagueEntersOnARaceOfAnEventTellsHimToo() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long event = event("dukat-okidac-dogadjaj", "Majski dogadjaj", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");

		MockHttpServletResponse answer = http.perform(asking(THE_SUPERADMIN,
						post("/api/results/on-a-race-of-an-event")).contentType(MediaType.APPLICATION_JSON)
						.content("{\"event\":{\"id\":" + event + "},\"race\":{\"name\":\"Nova majska\","
								+ "\"date\":\"2027-05-20\",\"kind\":\"free\",\"distanceKm\":0,\"ascentM\":0,"
								+ "\"descentM\":0,\"limitSeconds\":0},\"rows\":[" + row(ANA, "30") + "]}"))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/5");
		assertThat(ducatMessagesTo(ANA)).singleElement().asString()
				.contains("Liga vam je unela rezultat sa trke Nova majska od 20.05.2027");
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	/**
	 * SEVERAL DUCATS OF ONE ACT ARE ONE MESSAGE, in the plural, each with its period: a month, a season,
	 * and none for a ducat that stands for ever. Ana's long run of May was never reconciled, so the entry
	 * writes all five at once (the owner's choice of 08.11.2026, a message for every row it writes).
	 */
	@Test
	void severalDucatsOfOneActAreOneMessageEachWithItsPeriod() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
						+ " seconds, points) values (?, ?, date '2027-05-02', 1000, 100000, 0, 720000, 700)")
				.params(id(ANA), first).update();

		assertThat(http.perform(asking(THE_SUPERADMIN, post("/api/races/" + second + "/results"))
						.contentType(MediaType.APPLICATION_JSON).content("{\"rows\":[" + row(ANA, "10") + "]}"))
				.andReturn().getResponse().getStatus()).isEqualTo(201);

		assertThat(ducatMessagesTo(ANA)).containsExactly("Balkanska trkačka liga | " + THE_SUBJECT + " | "
				+ "Liga vam je unela rezultat sa trke Majska trka od 20.05.2027, i njime ste osvojili dukate"
				+ " „Mesečni kilometri” za maj 2027, „Mesečni sati” za maj 2027, „Sezonski kilometri” za"
				+ " sezonu 2027, „Sezonski sati” za sezonu 2027 i „Karmanov uspon”."
				+ " Dukati stoje na vašem profilu.");
	}

	/**
	 * A DUCAT ANOTHER WRITER PUT IN FIRST IS HIS TO ANNOUNCE: the reconciliation after the approval meets the
	 * row at its insert, waits for it, writes nothing and reports nothing, so no second message.
	 */
	@Test
	void aDucatSomebodyElseWroteFirstIsNotAnnounced() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");

		long item = waiting(ANA, second, "30", null);
		ExecutorService one = Executors.newSingleThreadExecutor();

		try (AHeldTransaction another = new AHeldTransaction(pool)) {
			another.db().sql("insert into ducat_award (competitor_id, ducat_id, awarded_at, kind, threshold,"
							+ " reached, period, season, month, tier, won_on, result_id)"
							+ " select ?, d.id, now(), d.kind, d.threshold, 125, d.period, 2027, 5, d.tier,"
							+ " date '2027-05-02', null from ducat d where d.code = ?")
					.params(id(ANA), THE_MONTHLY).update();

			Future<MockHttpServletResponse> deciding = one.submit(() -> decided(item));

			another.untilBehind(1, List.of(deciding));
			another.commit();

			assertThat(deciding).succeedsWithin(Duration.ofSeconds(30))
					.satisfies(answer -> assertThat(answer.getStatus()).isEqualTo(200));
		}
		finally {
			one.shutdownNow();
		}

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/5");
		assertThat(ducatMessagesTo(ANA)).as("a ducat this reconciliation did not write was announced").isEmpty();
	}

	/* ===================================================================== the doors that do not tell */

	/** A CHANGE BY THE LEAGUE THAT CARRIES HIM OVER writes the ducat, and says nothing of it. */
	@Test
	void aChangeByTheLeagueWritesTheDucatInSilence() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");

		long changed = result(ANA, second, "20");

		ducats.forMember(id(ANA));

		assertThat(http.perform(asking(THE_SUPERADMIN, put("/api/races/" + second + "/results/" + changed))
						.contentType(MediaType.APPLICATION_JSON).content(figures("30")))
				.andReturn().getResponse().getStatus()).isEqualTo(204);

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/5");
		assertThat(ducatMessagesTo(ANA)).isEmpty();
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	@Test
	void aDeletionByTheLeagueTakesTheDucatAwayInSilence() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");

		long gone = result(ANA, second, "30");

		reconciled(ANA);
		anAprilHeWasNeverReconciledFor();

		assertThat(http.perform(asking(THE_SUPERADMIN, delete("/api/races/" + second + "/results/" + gone)))
				.andReturn().getResponse().getStatus()).isEqualTo(204);

		assertThat(ducatsOf(ANA))
				.as("the reconciliation after a deletion writes what he meets and does not hold, in silence")
				.containsExactly(THE_MONTHLY + " 2027/4");
		assertThat(ducatMessagesTo(ANA)).isEmpty();
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	@Test
	void aMemberWhoDeletesHisOwnResultLosesTheDucatInSilence() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");

		long gone = result(ANA, second, "30");

		reconciled(ANA);
		anAprilHeWasNeverReconciledFor();

		assertThat(http.perform(delete("/api/results/" + gone).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, anas.secret())))
				.andReturn().getResponse().getStatus()).isEqualTo(204);

		assertThat(ducatsOf(ANA))
				.as("the reconciliation after a deletion writes what he meets and does not hold, in silence")
				.containsExactly(THE_MONTHLY + " 2027/4");
		assertThat(ducatMessagesTo(ANA)).isEmpty();
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	/**
	 * A RACE MOVED INTO JUNE TAKES ITS RUNS WITH IT: the ducat of May goes and one of June is written, for
	 * both members who ran it, and nobody is told. Nothing the race fixes moved, so the recount writes no
	 * row: what moved is the day, by the cascade.
	 */
	@Test
	void aRaceMovedIntoAnotherMonthMovesTheDucatsOfEveryoneWhoRanItInSilence() throws Exception {
		long race = race("dukat-okidac-prva", "Majska trka", LocalDate.of(2027, 5, 20));

		result(VERA, race, "130");
		result(ANA, race, "130");
		reconciled(VERA);
		reconciled(ANA);

		MockHttpServletResponse moved = http.perform(asking(THE_SUPERADMIN, put("/api/races/" + race))
						.contentType(MediaType.APPLICATION_JSON).content(aFreeRace(eventOf(race), "Majska trka",
								"2027-06-03")))
				.andReturn().getResponse();

		assertThat(moved.getStatus()).as(moved.getContentAsString()).isEqualTo(200);

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/6");
		assertThat(ducatsOf(VERA)).containsExactly(THE_MONTHLY + " 2027/6");
		assertThat(ducatMessagesTo(ANA)).isEmpty();
		assertThat(ducatMessagesTo(VERA)).isEmpty();
		assertThat(ducatsOf(BOJAN)).isEmpty();
	}

	@Test
	void aRaceDeletedTakesTheDucatsOfEveryoneWhoRanItInSilence() throws Exception {
		long race = race("dukat-okidac-prva", "Majska trka", LocalDate.of(2027, 5, 20));

		result(VERA, race, "130");
		result(ANA, race, "130");
		reconciled(VERA);
		reconciled(ANA);

		assertThat(http.perform(asking(THE_SUPERADMIN, delete("/api/races/" + race))).andReturn().getResponse()
				.getStatus()).isEqualTo(204);

		assertThat(ducatsOf(ANA)).isEmpty();
		assertThat(ducatsOf(VERA)).isEmpty();
		assertThat(ducatsOf(BOJAN)).isEmpty();
	}

	/** AN EVENT MOVED INTO JUNE MOVES ITS RACES, AND THEIR RUNS, WITH IT (`EventWriteApi.change`). */
	@Test
	void anEventMovedIntoAnotherMonthMovesTheDucatsOfEveryoneWhoRanAtItInSilence() throws Exception {
		long race = race("dukat-okidac-prva", "Majska trka", LocalDate.of(2027, 5, 20));

		/* VERA RAN THE OTHER RACE OF THE SAME EVENT, so a door that asked one race instead of the event
		   reaches one of the two and not both. */
		result(VERA, aSecondRaceOn(eventOf(race), "Majska polovina", LocalDate.of(2027, 5, 20)), "130");
		result(ANA, race, "130");
		reconciled(VERA);
		reconciled(ANA);

		MockHttpServletResponse moved = http.perform(asking(THE_SUPERADMIN, put("/api/events/" + eventOf(race)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"name\":\"Dogadjaj dukat-okidac-prva\",\"date\":\"2027-06-03\","
								+ "\"placeId\":" + theFirstTown() + ",\"kind\":\"race\",\"featured\":false,"
								+ "\"description\":\"\",\"link\":\"\"}"))
				.andReturn().getResponse();

		assertThat(moved.getStatus()).as(moved.getContentAsString()).isEqualTo(200);

		assertThat(db.sql("select r.race_date from result r join race on race.id = r.race_id"
						+ " where race.event_id = ? order by r.id").param(eventOf(race))
				.query(LocalDate.class).list())
				.as("the runs did not move with the event's races")
				.containsExactly(LocalDate.of(2027, 6, 3), LocalDate.of(2027, 6, 3));
		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/6");
		assertThat(ducatsOf(VERA)).containsExactly(THE_MONTHLY + " 2027/6");
		assertThat(ducatMessagesTo(ANA)).isEmpty();
		assertThat(ducatsOf(BOJAN)).isEmpty();
	}

	@Test
	void anEventDeletedTakesTheDucatsOfEveryoneWhoRanAtItInSilence() throws Exception {
		long race = race("dukat-okidac-prva", "Majska trka", LocalDate.of(2027, 5, 20));

		/* VERA RAN THE OTHER RACE OF THE SAME EVENT, so a door that asked one race instead of the event
		   reaches one of the two and not both. */
		result(VERA, aSecondRaceOn(eventOf(race), "Majska polovina", LocalDate.of(2027, 5, 20)), "130");
		result(ANA, race, "130");
		reconciled(VERA);
		reconciled(ANA);

		assertThat(http.perform(asking(THE_SUPERADMIN, delete("/api/events/" + eventOf(race)))).andReturn()
				.getResponse().getStatus()).isEqualTo(204);

		assertThat(ducatsOf(ANA)).isEmpty();
		assertThat(ducatsOf(VERA)).isEmpty();
		assertThat(ducatsOf(BOJAN)).isEmpty();
	}

	/**
	 * A SEASON CANCELLED TAKES ITS DUCATS OF A MONTH AND OF A SEASON, AND LEAVES THE ONE THAT STANDS FOR EVER
	 * („u godini u kojoj nije bio član dobija samo trajne dukate”), in silence.
	 */
	@Test
	void aSeasonCancelledTakesItsMonthlyAndSeasonalDucatsAndLeavesThePermanentOne() throws Exception {
		long race = race("dukat-okidac-prva", "Majska trka", LocalDate.of(2027, 5, 20));

		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
						+ " seconds, points) values (?, ?, date '2027-05-20', 1000, 100000, 0, 720000, 700)")
				.params(id(ANA), race).update();
		reconciled(ANA);

		assertThat(ducatsOf(ANA)).hasSize(5);

		assertThat(http.perform(asking(THE_SUPERADMIN, delete("/api/members/" + ANA + "/membership"))
						.contentType(MediaType.APPLICATION_JSON).content("{\"basis\":\"feeExempt\"}"))
				.andReturn().getResponse().getStatus()).isEqualTo(200);

		assertThat(ducatsOf(ANA)).containsExactly("duk-uspon always");
		assertThat(ducatMessagesTo(ANA)).isEmpty();
	}

	/* ===================================================================== a failure of its own */

	/**
	 * A RECONCILIATION THAT CANNOT RUN IS LOGGED, AND THE ANSWER IS THE ONE THE SAVE EARNED: another holds
	 * Ana's turn, so the reconciliation after the league's entry waits past {@code lock_timeout} and fails.
	 * The result is written all the same, and nothing is announced.
	 */
	@Test
	void aReconciliationThatFailsIsLoggedAndTheResultStands() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");

		MockHttpServletResponse answer;

		try (AHeldTransaction turn = new AHeldTransaction(pool)) {
			turn.db().sql("select pg_advisory_xact_lock(hashtextextended(?, 0))::text").param("ducats:" + id(ANA))
					.query(String.class).single();

			answer = http.perform(asking(THE_SUPERADMIN, post("/api/races/" + second + "/results"))
							.contentType(MediaType.APPLICATION_JSON).content("{\"rows\":[" + row(ANA, "30") + "]}"))
					.andReturn().getResponse();
		}

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(db.sql("select count(*) from result where competitor_id = ?").param(id(ANA))
				.query(Integer.class).single()).isEqualTo(2);
		assertThat(ducatsOf(ANA)).isEmpty();
		assertThat(ducatMessagesTo(ANA)).isEmpty();
	}

	// ----- the fixture -----------------------------------------------------------------

	private MockHttpServletResponse decided(long item) throws Exception {
		return http.perform(asking(THE_SUPERADMIN, post("/api/verification/" + item + "/decision"))
						.contentType(MediaType.APPLICATION_JSON).content("{\"approved\":true}"))
				.andReturn().getResponse();
	}

	private MockHttpServletRequestBuilder asking(String email, MockHttpServletRequestBuilder what) {
		what.with(csrf());

		return what.cookie(new Cookie(SessionCookie.NAME,
				(THE_SUPERADMIN.equals(email) ? superadmin : anas).secret()));
	}

	private static String row(String number, String km) {
		return "{\"memberNumber\":\"" + number + "\"," + figuresOnly(km) + "}";
	}

	private static String figures(String km) {
		return "{" + figuresOnly(km) + "}";
	}

	private static String figuresOnly(String km) {
		return "\"distanceKm\":" + km + ",\"ascentM\":0,\"descentM\":0,\"seconds\":3600";
	}

	private static String aFreeRace(long event, String name, String date) {
		return "{\"eventId\":" + event + ",\"name\":\"" + name + "\",\"renamed\":false,\"date\":\"" + date
				+ "\",\"kind\":\"free\",\"ascentM\":0,\"descentM\":0}";
	}

	/** His ducats as „code season/month”, „code season” or „code always”, by code and period. */
	private List<String> ducatsOf(String number) {
		return db.sql("select d.code || ' ' || case when a.month is not null then a.season || '/' || a.month"
						+ " when a.season is not null then a.season::text else 'always' end"
						+ " from ducat_award a join ducat d on d.id = a.ducat_id where a.competitor_id = ?"
						+ " order by d.id, a.season, a.month")
				.param(id(number)).query(String.class).list();
	}

	/** Every line in his inbox about a ducat, as „sender | subject | body”. */
	private List<String> ducatMessagesTo(String number) {
		return db.sql("select from_name || ' | ' || subject || ' | ' || body from message"
						+ " where to_id = ? and subject = ? order by id")
				.params(id(number), THE_SUBJECT).query(String.class).list();
	}

	/** Bojan, who meets a ducat and was never reconciled, still holds none, and nobody else was told. */
	private boolean nobodyElseGotADucat() {
		return ducatsOf(BOJAN).isEmpty() && db.sql("select count(*) from message where subject = ?"
						+ " and (to_id is null or to_id <> ?)")
				.params(THE_SUBJECT, id(ANA)).query(Integer.class).single() == 0;
	}

	/**
	 * 130 KM IN APRIL, ADDED AFTER HIS LAST RECONCILIATION: the reconciliation that follows a deletion
	 * writes that ducat, so a door that is meant to stay silent is seen to stay silent over a ducat it
	 * WROTE, and not only over one it took away (which is never announced by construction).
	 */
	private void anAprilHeWasNeverReconciledFor() {
		result(ANA, race("dukat-okidac-april", "Aprilska trka", LocalDate.of(2027, 4, 11)), "130");
	}

	private void reconciled(String number) {
		ducats.forMember(id(number));
	}

	private long id(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number).query(Long.class)
				.single();
	}

	private long theFirstTown() {
		return db.sql("select geonames_id from place where rank = 1").query(Long.class).single();
	}

	private long eventOf(long race) {
		return db.sql("select event_id from race where id = ?").param(race).query(Long.class).single();
	}

	private void member(String number) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Ime', 'Prezime', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, ?, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, String.format("%016x", 0x9700L + ++issued))
				.update();
	}

	private void membership(String number) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, 2027, 'feeExempt', 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.param(id(number)).update();
	}

	private SecretToken account(String email, String role, String member) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, role, member).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session;
	}

	private long event(String slug, String name, LocalDate date) {
		return db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values (?, ?, ?, (select id from place where rank = 1), 'race', false, '', '')"
						+ " returning id")
				.params(slug, name, date).query(Long.class).single();
	}

	/** A free race, alone on an event of its own, so the runner's figures are what count. */
	private long race(String slug, String name, LocalDate day) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values (?, ?, false, ?, 'free', 0, 0, 0, 0) returning id")
				.params(event(slug, "Dogadjaj " + slug, day), name, day).query(Long.class).single();
	}

	/** Another free race on an event that already has one, the day it is run on given. */
	private long aSecondRaceOn(long event, String name, LocalDate day) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values (?, ?, false, ?, 'free', 0, 0, 0, 0) returning id")
				.params(event, name, day).query(Long.class).single();
	}

	private long result(String number, long race, String km) {
		return db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
						+ " seconds, points) select ?, id, date, cast(? as numeric), 0, 0, 3600, 50 from race"
						+ " where id = ? returning id")
				.params(id(number), km, race).query(Long.class).single();
	}

	/** A run waiting for the moderator, or a correction of {@code amends}. */
	private long waiting(String number, long race, String km, Long amends) {
		long submission = db.sql("insert into result_submission (competitor_id, race_id, race_date,"
						+ " distance_km, ascent_m, descent_m, seconds, link, comment, amends_result_id)"
						+ " select ?, id, date, cast(? as numeric), 0, 0, 3600, 'https://primer.rs/rezultati', '', ?"
						+ " from race where id = ? returning id")
				.params(id(number), km, amends, race).query(Long.class).single();

		return db.sql("insert into verification (queue, competitor_id, subject, body, result_submission_id)"
						+ " values ('results', ?, 'Rezultat', '', ?) returning id")
				.params(id(number), submission).query(Long.class).single();
	}
}
