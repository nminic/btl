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
 * EVERY DOOR THAT MOVES A MEMBER'S RESULTS RECONCILES HIS DUCATS AFTER ITS COMMIT, AND HE IS TOLD OF A DUCAT
 * IT WRITES EXACTLY WHEN THE RESULT THAT CARRIED HIM OVER WAS BROUGHT IN FROM THE START OF AWARDING
 * ({@link DucatsFollowTheResults}, {@link AwardingDucats}; PDL, owner, 12.11.2026: „Poruka „Osvojili ste
 * dukat” nabraja samo dukate iz rezultata odobrenih od početka dodele, i piše se u istoj transakciji sa
 * dukatom”).
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
 * <li><b>When the result that carried him over came in:</b> approved or entered by a door of this context,
 * whose clock is in June 2027 and so after the start of awarding (told), or written straight into the table
 * with no moment, which is the history (silent). The boundary itself, a moment just before the start and
 * one exactly at it, is {@code DucatsAreReconciledAtNightTest}'s.
 * <li><b>Which result carried him over:</b> the one the act brought in, or another one of his. A ducat of a
 * month is crossed by the run that reaches its threshold in the order the races were run, so a run approved
 * now on an EARLIER day than a run of the history leaves the history's run as the one that carried him over
 * ({@link #anApprovedRunThatIsNotTheOneCarryingHimOverTellsNothingWhenThatOneIsHistory}), and a run approved
 * now on an earlier day than another run brought in since the start makes the message name THAT run's race,
 * day and way in ({@link #theMessageNamesTheResultThatCarriedHimOverAndNotTheOneTheActBrought}).
 * <li><b>The act:</b> approval (new and correction), the league's two entries, the league's change, and the
 * deletions and moves that can write a ducat another run left unwritten; whether a ducat is told is the same
 * rule behind every one of them.
 * <li><b>What the reconciliation did:</b> wrote a ducat, took one away (never told), or met a row another
 * writer wrote first ({@link #aDucatSomebodyElseWroteFirstIsNotAnnounced}).
 * <li><b>The message and the ducat are one transaction:</b> a message the database refuses takes the ducat
 * back with it, and the next run writes both
 * ({@link #aMessageThatCannotBeWrittenTakesItsDucatBackAndTheNextRunWritesBoth}).
 * <li><b>One ducat or several:</b> several of one result are one message in the plural; ducats of two
 * results are a message each.
 * <li><b>The period:</b> a month, a season, for ever; and a frozen season, which writes and tells only the
 * ducat that stands for ever.
 * <li><b>The recipient:</b> Ana, never the whole league and never Bojan ({@link #nobodyElseGotADucat}).
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

	/** Whether this case froze 2027, so that only then is the freeze taken away again. */
	private boolean frozeIt;

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

		/* AND THE FROZEN SEASON, only where this case froze it and nobody before it had. */
		if (frozeIt) {
			db.sql("delete from season_frozen where season = 2027").update();
			frozeIt = false;
		}
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
				+ " \"Mesečni kilometri\" za maj 2027. Dukat stoji na vašem profilu.");
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

	/**
	 * AN APPROVED CORRECTION IS AN APPROVAL, OF A RESULT THE LEAGUE ENTERED TOO: the correction gives the result
	 * its own moment and the word „approval”, so the ducat it carries him over to is told as an approval and not
	 * as the league's entry the row said before. A correction that kept the moment and the way the row already
	 * had would say „Liga vam je unela”.
	 */
	@Test
	void anApprovedCorrectionOfAResultTheLeagueEnteredIsToldAsAnApproval() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");

		long corrected = result(ANA, second, "20");

		db.sql("update result set brought_at = ?, brought_by = 'league' where id = ?")
				.params(Timestamp.from(IN_JUNE.minus(Duration.ofDays(10))), corrected).update();
		reconciled(ANA);
		assertThat(ducatsOf(ANA)).as("120 km in May is short of the ducat").isEmpty();

		long item = waiting(ANA, second, "30", corrected);

		assertThat(decided(item).getStatus()).isEqualTo(200);

		assertThat(db.sql("select brought_by || ' ' || brought_at from result where id = ?").param(corrected)
				.query(String.class).single()).as("the correction kept the moment and the way of the entry")
				.isEqualTo("approval " + db.sql("select ?::timestamptz::text").param(Timestamp.from(IN_JUNE))
						.query(String.class).single());
		assertThat(ducatMessagesTo(ANA)).singleElement().asString()
				.startsWith("Balkanska trkačka liga | " + THE_SUBJECT + " | Odobren vam je rezultat sa trke Majska trka"
						+ " od 20.05.2027");
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
				+ " \"Mesečni kilometri\" za maj 2027. Dukat stoji na vašem profilu.");
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
	 * WHAT REVIEW OF PR 709 MEASURED, AND THE OWNER REFUSED ON 12.11.2026 („Poruka u sanduče ide samo za dukat
	 * koji donese rezultat odobren od sada”; refused: „poruka za svaki dukat”). Ana's 130 km of May and her
	 * climb of 2025 are history and were never reconciled; a run of 5 km in June is approved, and the
	 * reconciliation after it writes the ducat of May and „Karmanov uspon”. Neither was carried over by a
	 * result brought in since the start of awarding, so both are written and nothing is told, where the
	 * reconciliation used to write „…njime ste osvojili dukate "Mesečni kilometri" za maj 2027 i "Karmanov
	 * uspon"” of a 5 km run.
	 */
	@Test
	void ducatsTheHistoryCarriedHimOverAreWrittenInSilenceAfterAnApprovalOfSomethingElse() throws Exception {
		long may = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long climb = race("dukat-okidac-uspon", "Uspon 2025", LocalDate.of(2025, 8, 9));
		long june = race("dukat-okidac-jun", "Junska petica", LocalDate.of(2027, 6, 5));

		result(ANA, may, "130");
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
						+ " seconds, points) values (?, ?, date '2025-08-09', 40, 100000, 0, 36000, 50)")
				.params(id(ANA), climb).update();

		long item = waiting(ANA, june, "5", null);

		assertThat(decided(item).getStatus()).isEqualTo(200);

		assertThat(ducatsOf(ANA)).as("the reconciliation after the approval did not write the history's ducats")
				.containsExactly(THE_MONTHLY + " 2027/5", "duk-uspon always");
		assertThat(ducatMessagesTo(ANA)).as("a ducat the history carried him over to was announced").isEmpty();
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	/**
	 * SEVERAL DUCATS ONE RESULT CARRIED HIM OVER TO ARE ONE MESSAGE, in the plural, each with its period: a
	 * month, a season, and none for a ducat that stands for ever. The long run of May was approved since the
	 * start and its step never ran (written here with its moment, as the approval writes it), so the run that
	 * follows writes all five at once and tells them in that run's name.
	 */
	@Test
	void severalDucatsOfOneResultAreOneMessageEachWithItsPeriod() {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));

		long theLongRun = db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) values (?, ?, date '2027-05-02', 1000, 100000, 0, 720000, 700)"
						+ " returning id")
				.params(id(ANA), first).query(Long.class).single();

		broughtIn(theLongRun, "approval");
		reconciled(ANA);

		assertThat(ducatMessagesTo(ANA)).containsExactly("Balkanska trkačka liga | " + THE_SUBJECT + " | "
				+ "Odobren vam je rezultat sa trke Prva majska od 02.05.2027, i njime ste osvojili dukate"
				+ " \"Mesečni kilometri\" za maj 2027, \"Mesečni sati\" za maj 2027, \"Sezonski kilometri\" za"
				+ " sezonu 2027, \"Sezonski sati\" za sezonu 2027 i \"Karmanov uspon\"."
				+ " Dukati stoje na vašem profilu.");
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	/**
	 * A FROZEN SEASON WRITES AND TELLS ONLY THE DUCAT THAT STANDS FOR EVER (PDL, 08.11.2026: „Rezultat unet ili
	 * ispravljen posle zamrzavanja svoje sezone donosi samo trajne dukate”). The same run as above, with 2027
	 * frozen: the four ducats of May and of the season are neither written nor named, and the climb is both.
	 * The other direction, a season still open, is every other case here.
	 */
	@Test
	void aFrozenSeasonTellsOnlyTheDucatThatStandsForEver() {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));

		long theLongRun = db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) values (?, ?, date '2027-05-02', 1000, 100000, 0, 720000, 700)"
						+ " returning id")
				.params(id(ANA), first).query(Long.class).single();

		broughtIn(theLongRun, "approval");

		assertThat(db.sql("insert into season_frozen (season, frozen_at) values (2027, ?) on conflict do nothing")
				.param(Timestamp.from(IN_JUNE)).update()).as("2027 was frozen already by somebody else").isEqualTo(1);
		frozeIt = true;

		reconciled(ANA);

		assertThat(ducatsOf(ANA)).containsExactly("duk-uspon always");
		assertThat(ducatMessagesTo(ANA)).containsExactly("Balkanska trkačka liga | " + THE_SUBJECT + " | "
				+ "Odobren vam je rezultat sa trke Prva majska od 02.05.2027, i njime ste osvojili dukat"
				+ " \"Karmanov uspon\". Dukat stoji na vašem profilu.");
	}

	/**
	 * THE RESULT THAT CARRIED HIM OVER IS THE HISTORY'S, though the act was an approval: Ana's 100 km of the
	 * history stand on 20 May and the 30 km approved now on 2 May, so in the order the races were run she
	 * reaches 125 km on the 20th, with the history's run. The ducat is written and nothing is told; a message
	 * tied to the result the act brought in would tell it.
	 */
	@Test
	void anApprovedRunThatIsNotTheOneCarryingHimOverTellsNothingWhenThatOneIsHistory() throws Exception {
		long early = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long late = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, late, "100");

		long item = waiting(ANA, early, "30", null);

		assertThat(decided(item).getStatus()).isEqualTo(200);

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/5");
		assertThat(db.sql("select won_on from ducat_award where competitor_id = ?").param(id(ANA))
				.query(LocalDate.class).single()).as("the history's run is not the one that carried her over")
				.isEqualTo(LocalDate.of(2027, 5, 20));
		assertThat(ducatMessagesTo(ANA)).isEmpty();
	}

	/**
	 * THE MESSAGE NAMES THE RESULT THAT CARRIED HIM OVER, ITS RACE, ITS DAY AND THE WAY IT CAME IN, AND NOT THE
	 * ONE THE ACT BROUGHT. The league entered Ana's 100 km of 20 May since the start, and that left her short;
	 * the run approved now is of 2 May, so the run of the 20th is still the one that reaches 125 km. The
	 * message is the league's entry of the 20th, not an approval of the 2nd.
	 */
	@Test
	void theMessageNamesTheResultThatCarriedHimOverAndNotTheOneTheActBrought() throws Exception {
		long early = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long late = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		broughtIn(result(ANA, late, "100"), "league");
		reconciled(ANA);
		assertThat(ducatsOf(ANA)).as("100 km in May is short of the ducat").isEmpty();

		long item = waiting(ANA, early, "30", null);

		assertThat(decided(item).getStatus()).isEqualTo(200);

		assertThat(ducatMessagesTo(ANA)).containsExactly("Balkanska trkačka liga | " + THE_SUBJECT + " | "
				+ "Liga vam je unela rezultat sa trke Majska trka od 20.05.2027, i njime ste osvojili dukat"
				+ " \"Mesečni kilometri\" za maj 2027. Dukat stoji na vašem profilu.");
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	/**
	 * A DUCAT OF ANOTHER RESULT BROUGHT IN SINCE THE START IS TOLD TOO, IN ITS OWN MESSAGE (the owner refused
	 * on 12.11.2026 „poruka samo za dukat kome je baš taj rezultat prešao prag”). The league's entry of
	 * Ana's 130 km of May was never followed by a reconciliation; she has 100 km of June from the history, and a
	 * run of 30 km on 12 June is approved. The run after it writes both ducats and tells each in the name of the
	 * result that carried her over, the May one first because its result has the lower key.
	 */
	@Test
	void ducatsOfTwoResultsBroughtInSinceTheStartAreAMessageEach() throws Exception {
		long may = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long earlyJune = race("dukat-okidac-jun-prva", "Prva junska", LocalDate.of(2027, 6, 2));
		long june = race("dukat-okidac-jun", "Junska trka", LocalDate.of(2027, 6, 12));

		broughtIn(result(ANA, may, "130"), "league");
		result(ANA, earlyJune, "100");

		long item = waiting(ANA, june, "30", null);

		assertThat(decided(item).getStatus()).isEqualTo(200);

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/5", THE_MONTHLY + " 2027/6");
		assertThat(ducatMessagesTo(ANA)).containsExactly(
				"Balkanska trkačka liga | " + THE_SUBJECT + " | Liga vam je unela rezultat sa trke Prva majska od"
						+ " 02.05.2027, i njime ste osvojili dukat \"Mesečni kilometri\" za maj 2027. Dukat stoji"
						+ " na vašem profilu.",
				"Balkanska trkačka liga | " + THE_SUBJECT + " | Odobren vam je rezultat sa trke Junska trka od"
						+ " 12.06.2027, i njime ste osvojili dukat \"Mesečni kilometri\" za jun 2027. Dukat stoji"
						+ " na vašem profilu.");
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	/**
	 * THE MESSAGE AND ITS DUCAT ARE ONE TRANSACTION (PDL, 12.11.2026: „i piše se u istoj transakciji sa
	 * dukatom”). The database refuses the message; the ducat goes back with it, so nothing is left standing
	 * that the next run would find already written and never tell. Once the refusal is gone, the next run
	 * writes the ducat and its message together.
	 */
	@Test
	void aMessageThatCannotBeWrittenTakesItsDucatBackAndTheNextRunWritesBoth() {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");
		broughtIn(result(ANA, second, "30"), "approval");

		Throwable thrown = null;

		try (AFailureOnlyTheDatabaseCanCause refused = AFailureOnlyTheDatabaseCanCause.on(db, "message", "subject",
				THE_SUBJECT)) {
			try {
				reconciled(ANA);
			}
			catch (RuntimeException failed) {
				thrown = failed;
			}

			assertThat(refused.wentOffIn(thrown)).as("the message was not refused, so this measures nothing")
					.isTrue();
		}

		assertThat(ducatsOf(ANA)).as("the ducat stood without its message").isEmpty();
		assertThat(ducatMessagesTo(ANA)).isEmpty();

		reconciled(ANA);

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/5");
		assertThat(ducatMessagesTo(ANA)).singleElement().asString()
				.contains("Odobren vam je rezultat sa trke Majska trka od 20.05.2027");
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

	/* ===================================================================== the doors that move a result */

	/**
	 * A CHANGE BY THE LEAGUE THAT CARRIES HIM OVER, OF A RESULT THE LEAGUE ENTERED SINCE THE START, writes the
	 * ducat and tells it: whether a ducat is told is the result's and not the door's (PDL, 12.11.2026, „Tiho
	 * ostaje samo ono što dolazi iz rezultata odobrenih pre početka dodele”). The change keeps the moment and
	 * the way the result came in, so the message is the entry's.
	 */
	@Test
	void aChangeByTheLeagueOfAResultBroughtInSinceTheStartTellsTheDucatItWrites() throws Exception {
		long first = race("dukat-okidac-prva", "Prva majska", LocalDate.of(2027, 5, 2));
		long second = race("dukat-okidac-druga", "Majska trka", LocalDate.of(2027, 5, 20));

		result(ANA, first, "100");

		assertThat(http.perform(asking(THE_SUPERADMIN, post("/api/races/" + second + "/results"))
						.contentType(MediaType.APPLICATION_JSON).content("{\"rows\":[" + row(ANA, "20") + "]}"))
				.andReturn().getResponse().getStatus()).isEqualTo(201);
		assertThat(ducatsOf(ANA)).as("120 km in May is short of the ducat").isEmpty();

		long changed = db.sql("select id from result where competitor_id = ? and race_id = ?")
				.params(id(ANA), second).query(Long.class).single();

		assertThat(http.perform(asking(THE_SUPERADMIN, put("/api/races/" + second + "/results/" + changed))
						.contentType(MediaType.APPLICATION_JSON).content(figures("30")))
				.andReturn().getResponse().getStatus()).isEqualTo(204);

		assertThat(ducatsOf(ANA)).containsExactly(THE_MONTHLY + " 2027/5");
		assertThat(ducatMessagesTo(ANA)).containsExactly("Balkanska trkačka liga | " + THE_SUBJECT + " | "
				+ "Liga vam je unela rezultat sa trke Majska trka od 20.05.2027, i njime ste osvojili dukat"
				+ " \"Mesečni kilometri\" za maj 2027. Dukat stoji na vašem profilu.");
		assertThat(nobodyElseGotADucat()).isTrue();
	}

	/** A CHANGE BY THE LEAGUE THAT CARRIES HIM OVER, OF A RESULT OF THE HISTORY, writes the ducat in silence. */
	@Test
	void aChangeByTheLeagueOfAResultOfTheHistoryWritesTheDucatInSilence() throws Exception {
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
	 * 130 KM IN APRIL, OF THE HISTORY, ADDED AFTER HIS LAST RECONCILIATION: the reconciliation that follows a
	 * deletion writes that ducat, so the door is seen to stay silent over a ducat it WROTE of the history, and
	 * not only over one it took away (which is never announced by construction).
	 */
	private void anAprilHeWasNeverReconciledFor() {
		result(ANA, race("dukat-okidac-april", "Aprilska trka", LocalDate.of(2027, 4, 11)), "130");
	}

	private void reconciled(String number) {
		ducats.forMember(id(number));
	}

	/**
	 * The moment and the way a result came in, as the approval ({@code approval}) or the league's entry
	 * ({@code league}) writes them: the clock of this context, which is after the start of awarding.
	 */
	private void broughtIn(long result, String by) {
		db.sql("update result set brought_at = ?, brought_by = ? where id = ?")
				.params(Timestamp.from(IN_JUNE), by, result).update();
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
