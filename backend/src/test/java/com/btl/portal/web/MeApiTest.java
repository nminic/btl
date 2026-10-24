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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.method.HandlerMethod;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /api/me: WHO IS ASKING, AND THE CALLER'S OWN RECORD.
 *
 * <p><b>Seven people and never two, and none of them is the first row of anything.</b>
 * Every field this route answers with is a field some OTHER row in this fixture also
 * carries a value for, and no two of them carry the same one. So „his own record" and
 * „the first record", „his own record" and „the record of whoever signed in first", and
 * „his own record" and „any record at all" are seven different places rather than one, and
 * a query that reached the wrong one is caught by the value rather than by its absence.
 * <b>That sentence is a FLOOR rather than a claim</b>, and it is
 * {@link #andNothingOfAnybodyElses}: every row here is behind an account, every field the
 * route can answer is on the caller's record, and the sweep compares the two records field
 * by field. It is written that way because the hand-written lists it replaced could be made
 * stale and green in one stroke - two rows handed the caller's own season and country
 * passed - and because an eighth field added to the record tomorrow joins the sweep by
 * itself instead of waiting to be noticed.
 *
 * <p><b>The caller is deliberately not the first competitor and not the first account.</b>
 * {@link #ME} is the second row written to {@code competitor} and the first written to
 * {@code account}, so the two keys that a wrong query could confuse - his member's id and
 * his account's id - are different numbers. That they really are different is not assumed:
 * {@link #theTwoKeysThatCouldBeConfusedAreDifferentNumbers} reads both out of the database
 * and says so, because every case below rests on it. He is second rather than third because
 * {@link #LAPSED} has to be written before the two people HE brought in, and the caller has
 * to be written before him; what the position is for is measured by that case and not by the
 * number.
 *
 * <p><b>AND EVERY ABSENCE SITS ON ITS OWN ROW, which is what the fixture before this one
 * got wrong.</b> One row had no member number AND no team, so „he has no number" and „he
 * is in no team" were one fact in two sentences and either clause could be tied to the
 * other with the suite staying green. They are two rows now: {@link #ABROAD} has a number
 * and no team, {@link #NOT_A_MEMBER_YET} has a team and no number.
 *
 * <p><b>AND EVERY ROW IS A STATE THE PORTAL REALLY WRITES, which the fixture before this
 * one also got wrong.</b> {@link #NOT_A_MEMBER_YET} used to be {@code active} with no member
 * number, and nothing in the portal writes that: {@code PaymentApi} is the only writer of
 * {@code active = true} and it either draws the number in the same statement or is renewing
 * somebody who already has one, {@code RegistrationApi} writes {@code active = false} with no
 * number, and no migration writes a competitor at all. A difference measured on a state
 * production cannot produce is a difference nobody will ever see, so
 * {@link #everyRowHereIsAStateThePortalCanWrite} refuses it.
 *
 * <p><b>AND THREE PEOPLE WERE BROUGHT IN BY THE CALLER, TWO MORE BY THE MEMBER WHOSE FEE HAS
 * LAPSED, because a count is the one field here that is not read off a row.</b> Two of the
 * caller's three are active and one is not, so „whom he brought" and „whom he brought whose
 * fee stands" are different numbers; and somebody else's recruits make „whom he brought"
 * different from „whoever was brought by anybody". His count is 2, and each of the four
 * queries that could have answered it by accident gives 1, 3, 3 or 5.
 *
 * <p><b>AND THE LAPSED MEMBER'S OWN COUNT IS 1, which is the half of that the fixture before
 * this one could not see.</b> He had brought nobody in, so his true count was 0 and his lost
 * count was 0 as well: the very clause this route exists to keep out - {@link CompetitorApi}'s
 * {@code where c.active}, carried in as {@code case when c.active then ... end} - could be
 * written into the counting clause here and the suite stayed green. He brings two people in
 * now, one whose fee stands and one who never got a number, so his count is 1: different from
 * 0 (the clause carried in), different from 2 (the caller's own, and the caller's season), and
 * different from the 2 a query that forgot „whose fee stands" would give him.
 *
 * <p><b>AND THE CALLER IS THE ONE ROW OF HIS KIND IN EVERY FIELD THE PROFILE ADDED</b>, which a
 * field with two values turns from an accident into a decision. The sweep in
 * {@link #andNothingOfAnybodyElses} asks of every OTHER row whether it carries the very value
 * the caller was answered, and a letter or a boolean cannot differ on seven rows: so the fixture
 * writes him as the odd one of each, in one place ({@link #giveTheCallerWhatNoOtherRowHas}).
 * There is one woman here and it is he, one row in the oldest band, one row in the beginners'
 * category, one that hides its profile, one that shows its whole birthday, one with a biography,
 * one with a portrait, and one who is in a team from 2028. Gender is not worked out from the given
 * name: the names were chosen for the other fields and this one needed exactly one of each.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MeApiTest {

	private static final String PATH = "/api/me";

	/**
	 * AUTUMN 2026, WHICH IS A DAY WITH NO SEASON RUNNING AT ALL, and that is why the cases stand on
	 * it by default: the league begins in 2027 (PDL P2), so the calendar answers a season the portal
	 * does not have and every band below is answered through the floor and not around it. It is also
	 * why the bands do not drift as the real years go by: a case that stood on the machine's own
	 * clock would see the 1990 rows move into the next band in 2030.
	 */
	private static final Instant AUTUMN_2026 = Instant.parse("2026-09-21T10:00:00Z");

	/** The first season the league has, while it is running. */
	private static final Instant DURING_2027 = Instant.parse("2027-06-15T12:00:00Z");

	/**
	 * MID OCTOBER OF 2027, the one kind of moment where „which season" has two answers: from the
	 * transfer window on, {@code seasonBeingPaidFor} answers NEXT year while the season being RUN is
	 * still this one, and the band moves on the second and never on the first (PDL P7).
	 */
	private static final Instant MID_OCTOBER_2027 = Instant.parse("2027-10-15T12:00:00Z");

	/**
	 * The night the year turns, the instant {@code CompetitorApiTest} and {@code ResultApiTest} stand
	 * on: the clock this fixture hands the server reports UTC, as a container's does, so a door that
	 * reads the server's zone instead of the league's calls this night 2027 while Belgrade is already
	 * in 2028.
	 */
	private static final Instant NEW_YEARS_NIGHT_INTO_2028 = Instant.parse("2027-12-31T23:30:00Z");

	/**
	 * THE CALLER. Second competitor written, first account written, so neither „the first
	 * member" nor „the first account" is him. Freed of the fee, holding a closed membership
	 * in one team and an open one in another, racing since 2014, living in a town out of the
	 * codebook, and the one who brought three others in.
	 */
	private static final String ME = "000012";

	/**
	 * Another member, so every field of the caller's has a neighbour that differs. <b>She
	 * has a member number and is in no team</b>, which is one half of the pair of absences
	 * this fixture keeps apart; she administers a team without racing for it, and that is a
	 * different fact from membership (V11).
	 */
	private static final String ABROAD = "000045";

	/**
	 * AND ONE WHOSE FEE HAS LAPSED, which is the axis {@link CompetitorApi} cannot answer
	 * on: he is off its list entirely (owner, 13.09.2026), so the screens of the very
	 * member who has to renew have nothing to read. He pays rather than being freed, which
	 * is the second state of the basis, and <b>the caller brought him in</b>, which is what
	 * makes the count's „whose fee stands" a clause and not a decoration.
	 *
	 * <p><b>AND HE BROUGHT TWO PEOPLE IN HIMSELF, which is what makes his own count worth
	 * asking for.</b> While his count was 0 it was the same number a route that had carried
	 * {@link CompetitorApi}'s {@code where c.active} into the counting clause would have
	 * answered him, and the same number a route that counted nobody at all would: right and
	 * wrong were one value, so nothing was measured. One of his two has a standing fee and
	 * one never got a number, so what he is answered is 1 - not 0, not the 2 that is the
	 * caller's, and not the 2 that forgetting „whose fee stands" would give him.
	 */
	private static final String LAPSED = "000031";

	/**
	 * AND ONE WHO HAS REGISTERED AND HAS NO NUMBER YET. ADL A44, owner 11.09.2026: „Osoba
	 * je `competitor` od registracije, a clan postaje kad dobije broj." <b>He IS in a
	 * team</b>, which is the other half of the pair of absences: having no number and being
	 * in no team are two facts and they sit on two rows.
	 *
	 * <p><b>And his fee does not stand, because the portal cannot write him any other way:</b>
	 * {@code RegistrationApi} writes him {@code active = false} and {@code PaymentApi} is what
	 * turns that around, in the same statement that gives him a number. He is therefore the
	 * lapsed member's recruit who „ne donosi nista" (PDL, 13.08.2026) rather than one of the
	 * caller's, which is what keeps the caller's own three recruits at three.
	 */
	private static final String NOT_A_MEMBER_YET = null;

	/**
	 * AND ONE THE CALLER DID NOT BRING IN, brought by {@link #LAPSED} instead. Without him
	 * „the members the caller brought in" and „the members anybody brought in" are the same
	 * set, and a count over the second would answer the first correctly by accident. He is
	 * also the one recruit of the lapsed member whose fee stands, so that member's own count
	 * is 1 rather than 0.
	 */
	private static final String BROUGHT_BY_ANOTHER = "000077";

	/**
	 * AND THE FIRST OF THE TWO THE CALLER BROUGHT IN WHOSE FEE STANDS.
	 */
	private static final String ALSO_BROUGHT_BY_ME = "000063";

	/**
	 * AND THE SECOND OF THEM, so the caller's count is 2 rather than 1. One is the answer to
	 * too many other questions in this fixture - how many teams he is in now, how many rows
	 * have no member number, how many rows are himself, how many the lapsed member brought in
	 * whose fee stands - to be worth asserting.
	 */
	private static final String THE_SECOND_BROUGHT_BY_ME = "000089";

	private static final String MY_ACCOUNT = "ja@primer.rs";

	private static final String HER_ACCOUNT = "ona@primer.rs";

	private static final String THE_LAPSED_ACCOUNT = "nenad@primer.rs";

	private static final String THE_ACCOUNT_WITH_NO_NUMBER = "tek.stigao@primer.rs";

	/**
	 * AND AN ACCOUNT FOR EVERY REMAINING ROW, because {@link #andNothingOfAnybodyElses}
	 * compares the caller's record with the record of every OTHER row, and a row that is
	 * behind no account has no record to compare. That every row really is behind one is the
	 * first thing that case measures rather than something these three names promise.
	 */
	private static final String THE_THIRD_PARTYS_ACCOUNT = "jovana@primer.rs";

	private static final String THE_FIRST_RECRUITS_ACCOUNT = "dusan@primer.rs";

	private static final String THE_SECOND_RECRUITS_ACCOUNT = "petar@primer.rs";

	/**
	 * Signed in and racing for nobody: V23 leaves {@code account.competitor_id} empty for
	 * an account that does not race, which is the ordinary case for a moderator (owner,
	 * 14.09.2026). He is what separates „signed in" from „is a competitor".
	 */
	private static final String RACES_FOR_NOBODY = "mod@primer.rs";

	/**
	 * A TOWN OUT OF THE CODEBOOK THAT IS REALLY IN SERBIA, named by its country rather than
	 * by its rank.
	 *
	 * <p>{@code place} is the world's codebook ordered by population (V3), so {@code rank = 1}
	 * is a town in China and the fixture that used it read {@code "CN"} back. That is the
	 * query working and the expectation being wrong, but it is worth a constant rather than a
	 * corrected number: a rank is a position in a file and not a fact about a town, and the
	 * only thing this case wants of the town is which country it is in.
	 */
	private static final String A_SERBIAN_TOWN = "(select id from place where country_id ="
			+ " (select id from country where code = 'RS') order by rank limit 1)";

	/**
	 * WHERE A PICTURE IS ASKED FOR, written out here rather than taken from {@link MeApi}.
	 *
	 * <p>Taken from the constant, a rename would rename both and every case below would go on
	 * passing while the portal asked for an address nothing answers - one value in two roles.
	 * What proves the two equal is {@link #thePortraitIsTheAddressOfHisOwnPicture}, which hands
	 * the address to the dispatcher instead of comparing spellings.
	 */
	private static final String A_PICTURE_IS_ASKED_FOR_AT = "/api/photos/";

	/**
	 * THE CALLER'S PORTRAIT, SPELT IN LETTERS ALONE, and that is a measurement. A digest is sixty
	 * four characters of {@code [0-9a-f]} (V8, {@code photo_digest_shape}), so one carrying
	 * digits may spell a four digit year by accident, and {@link #onlyHisOwnDateOfBirthLeavesHisOwnDoor}
	 * reads the answer as text and asks it for every year of birth. Letters cannot spell one.
	 */
	private static final String HIS_PORTRAIT = "ab".repeat(32);

	/**
	 * AND THE LAPSED MEMBER'S, a different pair so that no two pictures here share a digest and
	 * „his portrait" is never satisfied by another member's.
	 */
	private static final String THE_LAPSED_MEMBERS_PORTRAIT = "cd".repeat(32);

	/** What the caller has written about himself, in letters alone for the same reason. */
	private static final String HIS_BIOGRAPHY = "Trci od detinjstva i o tome pise.";

	/**
	 * THE CALLER'S POSTAL ADDRESS AND TELEPHONE, each a value no other row carries (every other row
	 * is written with {@code 'Ulica 1'} and no telephone at all). Spelt with no run of four digits,
	 * for the reason the portrait is spelt in letters: {@link #onlyHisOwnDateOfBirthLeavesHisOwnDoor} reads
	 * the whole answer as text and asks it for a year, and a telephone number is exactly the sort of
	 * thing that spells one by accident.
	 */
	private static final String HIS_ADDRESS = "Bulevar Pupina 10";

	private static final String HIS_TELEPHONE = "+381 60 123 456";

	/**
	 * THE WORDS OF THE CALLER'S THAT WAIT FOR A MODERATOR, and of nobody else's: another member's
	 * text waits too, with other words, so "his" is never "the first" and never "any".
	 */
	private static final String HIS_WAITING_WORDS = "Ispravljene reci koje cekaju moderatora.";

	private static final String ANOTHERS_WAITING_WORDS = "Tudje reci koje takodje cekaju.";

	/** And the lapsed member's address, so an address answered to him is his and not the caller's. */
	private static final String THE_LAPSED_MEMBERS_ADDRESS = "Vojvode Stepe 5";

	/** And the lapsed member's, so a biography answered to him is his and nobody else's. */
	private static final String THE_LAPSED_MEMBERS_BIOGRAPHY = "Prestao je da trci ali nije prestao da pise.";

	/**
	 * THE CALLER'S DATE OF BIRTH, which is the one datum on the table that must not leave in any
	 * spelling (section 3 of the privacy policy: „Datum rodjenja se nikada ne prikazuje, ni u
	 * punom ni u skracenom obliku"). Every other row is born on {@code 1990-01-01}, so the two
	 * years in the table are far apart and neither is a season in this fixture.
	 */
	private static final String HIS_DATE_OF_BIRTH = "1957-06-15";

	/**
	 * THE THREE HE IS ANSWERED LOCKED ON HIS OWN CARD since 24.10.2026 (PDL, "clan ga vidi ali je
	 * disabled za menjanje. Moze samo da trazi od admina"), each a value no other row carries: every
	 * other row's father is {@code 'Otac'}. Spelt in letters alone, for the reason the portrait is:
	 * {@link #onlyHisOwnDateOfBirthLeavesHisOwnDoor} reads the answer as text and asks it for years.
	 */
	private static final String HIS_FATHER = "Svetozar";

	private static final String HIS_DOCUMENT = "KARTICAMILICE";

	/** And the lapsed member's, so "his" is never "the caller's" and never "whoever is first". */
	private static final String THE_LAPSED_MEMBERS_FATHER = "Milovan";

	private static final String THE_LAPSED_MEMBERS_DOCUMENT = "KARTICANENADA";

	private static final String THE_LAPSED_MEMBERS_DATE_OF_BIRTH = "1988-03-04";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/**
	 * SEVEN COMPETITORS, EIGHT ACCOUNTS, THREE TEAMS AND SEVEN COUNTRIES.
	 *
	 * <p>Written so that no value this route answers with is shared by two rows: seven
	 * different first seasons, seven different member numbers (one of them none at all),
	 * seven countries reached by the two different roads V7 allows, and three teams of which
	 * the caller is in the one he moved TO rather than the one he came from.
	 *
	 * <p><b>Every one of the seven is behind an account</b>, which is what lets
	 * {@link #andNothingOfAnybodyElses} ask the route itself for every other row's record
	 * instead of holding a list of the values they carry. A list of values goes stale the day
	 * a row changes and says nothing at all about a field added tomorrow; the sweep goes red
	 * in both cases. The eighth account races for nobody and is the moderator.
	 *
	 * <p><b>The order is not arrangement but arithmetic:</b> a row can only be brought in by
	 * somebody already written, the caller has to come after somebody so that „the first row"
	 * is not his, and {@link #LAPSED} has to come after the caller and before the two he
	 * brought in.
	 */
	@BeforeEach
	void sevenCompetitorsAndEightAccounts() {
		clock.moveTo(AUTUMN_2026);

		/* Not the caller, and written first so that „the first row" is somebody else. Her
		   town was TYPED and names its own country, which is the second of the two roads V7
		   leaves open; the caller rides the first. */
		competitor(ABROAD, "Strahinja", "Vukicevic", "null", "'Podgorica'",
				"(select id from country where code = 'ME')", 2019, false, "payment", "null");
		/* THE CALLER, second. Freed of the fee, which is the other half of the basis: the
		   case about the basis asks his answer and a payer's, so „his own and not the other
		   word" is said of both states and not of one. */
		competitor(ME, "Milica", "Djurisic", A_SERBIAN_TOWN, "null",
				"null", 2014, true, "feeExempt", "null");
		/* THE ONE WHOSE FEE HAS LAPSED, brought in by the caller. He is what makes „whose fee
		   stands" a clause that can be removed and measured: without the clause the caller's
		   count is 3 rather than 2. And he is written here, before the two people HE brought
		   in, because `referred_by` names a row that has to exist already. */
		competitor(LAPSED, "Nenad", "Ilic", "(select id from place where rank = 1)", "null",
				"null", 2015, false, null, broughtBy(ME));
		/* Brought in by HIM and not by the caller, and active, so „brought in by the caller"
		   and „brought in by anybody" are two different counts - and the lapsed member's own
		   count is 1 rather than 0, which is the only way a clause carried into it from
		   `CompetitorApi` can be told from the right one. */
		competitor(BROUGHT_BY_ANOTHER, "Jovana", "Popovic", "null", "'Sarajevo'",
				"(select id from country where code = 'BA')", 2024, false, "balance",
				broughtBy(LAPSED));
		/* Registered, no number (A44), IN A TEAM - which is what keeps „he has no number"
		   from resting on the same row as „he is in no team" - and brought in by the lapsed
		   member, so that member's count of 1 also carries the „whose fee stands" clause
		   rather than only the caller's count of 2. */
		competitor(NOT_A_MEMBER_YET, "Tek", "Stigao", "null", "'Skoplje'",
				"(select id from country where code = 'MK')", 2027, false, null,
				broughtBy(LAPSED));
		/* The caller's first recruit whose fee stands. */
		competitor(ALSO_BROUGHT_BY_ME, "Dusan", "Maric", "null", "'Tirana'",
				"(select id from country where code = 'AL')", 2022, false, "payment",
				broughtBy(ME));
		/* And his second, so his count is 2: a number that is not the count of anybody else
		   here, not the number of rows that are himself, and not the lapsed member's 1. */
		competitor(THE_SECOND_BROUGHT_BY_ME, "Petar", "Nikolic", "null", "'Zagreb'",
				"(select id from country where code = 'HR')", 2021, false, "payment",
				broughtBy(ME));

		team("probni-tim", "Probni tim", LAPSED);
		team("drugi-tim", "Drugi tim", ABROAD);
		team("treci-tim", "Treci tim", BROUGHT_BY_ANOTHER);

		/* The caller LEFT the first team and is in the second, so a join that forgot
		   `season_to is null` has two rows to choose from and one of them is wrong. */
		membership(competitorIdOf(ME), "probni-tim", 2027, "2027", "'Presao u drugi tim'");
		membership(competitorIdOf(ME), "drugi-tim", 2028, "null", "null");
		/* And the member whose fee has lapsed is in the team the caller left, so „his team"
		   and „the caller's team" are different teams as well as different rows. */
		membership(competitorIdOf(LAPSED), "probni-tim", 2027, "null", "null");
		/* And the one with no number is in a third team, so his team is his own value and
		   not one he shares with whoever else is in a team. */
		membership(theOneWithNoNumber(), "treci-tim", 2027, "null", "null");

		/* THE CALLER'S ACCOUNT IS THE FIRST ONE, while his member is the second row of
		   `competitor`. That is what makes his account's key and his member's key two
		   different numbers rather than one; see the case that measures it. */
		account(MY_ACCOUNT, "competitor");
		belongsTo(MY_ACCOUNT, ME);
		account(HER_ACCOUNT, "competitor");
		belongsTo(HER_ACCOUNT, ABROAD);
		account(THE_LAPSED_ACCOUNT, "competitor");
		belongsTo(THE_LAPSED_ACCOUNT, LAPSED);
		account(THE_ACCOUNT_WITH_NO_NUMBER, "competitor");
		belongsToTheOneWithNoNumber(THE_ACCOUNT_WITH_NO_NUMBER);
		account(THE_THIRD_PARTYS_ACCOUNT, "competitor");
		belongsTo(THE_THIRD_PARTYS_ACCOUNT, BROUGHT_BY_ANOTHER);
		account(THE_FIRST_RECRUITS_ACCOUNT, "competitor");
		belongsTo(THE_FIRST_RECRUITS_ACCOUNT, ALSO_BROUGHT_BY_ME);
		account(THE_SECOND_RECRUITS_ACCOUNT, "competitor");
		belongsTo(THE_SECOND_RECRUITS_ACCOUNT, THE_SECOND_BROUGHT_BY_ME);
		account(RACES_FOR_NOBODY, "moderator");

		giveTheCallerWhatNoOtherRowHas();
	}

	/**
	 * THE FLOOR EVERY CASE BELOW STANDS ON, and it is read out of the database rather than
	 * arranged by hand.
	 *
	 * <p>What this route is handed is {@code account.id} and what it must answer from is
	 * {@code competitor.id}. Those are two {@code bigserial} sequences and nothing makes
	 * them disagree on their own, so a resource that passed the wrong one would be green
	 * on any fixture where the caller happens to sit at the same offset in both tables.
	 * This says he does not. If it ever goes red, no case below is measuring what it says
	 * it measures, and the fixture wants a row inserted before his in one of the two
	 * tables rather than this case relaxed.
	 */
	@Test
	void theTwoKeysThatCouldBeConfusedAreDifferentNumbers() {
		assertThat(competitorIdOf(ME))
				.as("the caller's member and his account carry the same key, so a query handed"
						+ " the account's id where the member's belongs would answer correctly by"
						+ " accident and every case in this class would say nothing")
				.isNotEqualTo(accountIdOf(MY_ACCOUNT));
	}

	/**
	 * AND EVERY ROW HERE IS A STATE THE PORTAL CAN ACTUALLY WRITE.
	 *
	 * <p>A fixture is allowed to arrange anything the schema permits, and that is exactly the
	 * trap: a difference measured on a state production never reaches is a difference nobody
	 * will ever see, and the case resting on it reads as though it held something. The row
	 * before this one was {@code active} with no member number, and nothing in the portal
	 * writes that - {@code PaymentApi} is the only writer of {@code active = true} and it
	 * either draws the number in the same statement or is renewing somebody who already has
	 * one, {@code RegistrationApi} writes {@code active = false} with no number at all, and no
	 * migration writes a {@code competitor} row. The schema does not forbid it; this does.
	 *
	 * <p><b>And it is asked in three directions rather than one</b>, because „nobody is active
	 * without a number" is satisfied for free by a fixture where everybody has one and
	 * everybody is active. There is a row with no number, and there is a row that has a number
	 * and is not active, so both of the states the portal really does write are here and the
	 * refusal above is a refusal rather than a tautology.
	 *
	 * <p><b>AND THE BOUNDARY, WHICH IS REAL AND IS NAMED HERE RATHER THAN LEFT FOR A REVIEW TO
	 * FIND: this refuses what the portal cannot write to {@code competitor}, and says nothing
	 * about {@code team} or {@code team_membership}.</b> It cannot, because <b>nothing on this
	 * portal writes either of them yet</b> - {@link TeamWriteApi} writes {@code team_proposal}
	 * and says so in its own words, „nothing writes {@code team_membership} at all", and no
	 * migration seeds a team. So the three teams and the four memberships below are states no
	 * route can produce TODAY, and a refusal in the shape of the one above would have to refuse
	 * the fixture outright and take the {@code teamId} measurement with it.
	 *
	 * <p>That is a different thing from the state this case does refuse, and the difference is
	 * worth being exact about. An {@code active} row with no member number is a state the
	 * portal <b>writes the other way round</b> and will never write, so a case leaning on it
	 * measures a difference nobody will ever see. A membership row is a state <b>nothing writes
	 * yet</b>: the schema holds it, the constraints govern it
	 * ({@code team_membership_one_team_at_a_time}), {@link CompetitorApi} reads it through the
	 * identical clause, and the approval that will write it is one increment away. The day
	 * something does write one, this fixture is what that writer has to agree with.
	 */
	@Test
	void everyRowHereIsAStateThePortalCanWrite() {
		assertThat(howMany("active and member_number is null"))
				.as("a row here is active and has no member number, which nothing in the portal"
						+ " writes: PaymentApi assigns the number in the same statement that sets"
						+ " active, RegistrationApi writes active = false, and no migration writes"
						+ " a competitor at all. Whatever a case tells apart on that row, it tells"
						+ " apart on a state production cannot produce")
				.isZero();
		assertThat(howMany("member_number is null"))
				.as("every row here has a member number, so the refusal above holds for free and"
						+ " ADL A44 - a person is a competitor from registration and a member when"
						+ " he is given a number - is unmeasured")
				.isEqualTo(1);
		assertThat(howMany("member_number is not null and not active"))
				.as("no row here has a number and a lapsed fee, so the second state the portal"
						+ " writes is missing and the refusal above could be met by making every"
						+ " row active")
				.isPositive();
	}

	/**
	 * A MEMBER IS HANDED HIS OWN RECORD.
	 *
	 * <p>The four fields section 3 of the privacy policy makes public at once and each compared with what the
	 * database has for HIM, never with a value typed here twice: the member number, the
	 * country his town is in, the season he started in and the team he is in now. Every one
	 * of them is a value no other row in this fixture carries, so a query that answered off
	 * somebody else's row is wrong in the value rather than merely in the count. The three
	 * that are HIS OWN BUSINESS have three cases of their own below.
	 */
	@Test
	void aMemberIsHandedHisOwnRecord() throws Exception {
		JsonNode mine = answerFor(MY_ACCOUNT).path("member");

		assertThat(mine.path("memberNumber").asString()).isEqualTo(ME);
		assertThat(mine.path("country").asString())
				.as("the country of the town he lives in, which is not the country of the member"
						+ " who lives abroad").isEqualTo("RS");
		assertThat(mine.path("firstSeason").asInt())
				.as("the season HE started in, and no two members here started in the same one")
				.isEqualTo(2014);
		assertThat(mine.path("teamId").asLong())
				/* THE MEMBERSHIP THAT HAS NOT ENDED, and the sentence is worth getting right
				   because the first draft of it said „the team he is in NOW" and that is a
				   different fact. V11 calls `season_to` „the last season he is in it", PDL of
				   20.08.2026 lets a member leave „od 1. januara naredne godine", and
				   `SeasonClock.transfersTakeEffect` always answers next year. So this member is
				   in `probni-tim` through 2027 and in `drugi-tim` from 2028, and what the route
				   answers is the second. It is `CompetitorApi`'s clause word for word; the
				   difference between the two questions is named on `MyOwnRecord.teamId` and
				   belongs to one increment over both resources. */
				.as("the membership that has not ended is the one he left, so the clause that"
						+ " picks it is gone and any of his rows will do")
				.isEqualTo(teamIdOf("drugi-tim"));
	}

	/**
	 * AND HIS OWN MEMBERSHIP BASIS, WHICH IS THE ONE THAT LEAVES HERE AND NOBODY ELSE'S.
	 *
	 * <p>Owner, 20.09.2026, asked outright with three outcomes offered: „Clan vidi SVOJ
	 * osnov clanstva; tudji ne vidi niko osim administracije." PDL P8 of 28.07.2026 - „Osnov
	 * clanstva se nikad ne prikazuje javno" - is about somebody else's, and his reason for
	 * saying so is that a man who is not being charged has to know it, „inace ne razume zasto
	 * mu portal ne trazi uplatu".
	 *
	 * <p><b>EVERY STATE IS ASKED AND THE SCHEMA SAYS THERE ARE THREE</b>, which is the floor
	 * this case stands on rather than a sentence about it: the words are read out of
	 * {@code membership_basis_known} itself, the one rule about a basis since V62, so a fourth
	 * basis added tomorrow turns this case red and asks for a fourth caller instead of being
	 * quietly unmeasured. And a fourth state that is no word at all: a member who holds no row
	 * for the season on sale is answered no basis, which is the member whose fee has lapsed.
	 *
	 * <p><b>And each caller is the ONLY row of the season on sale held on his word</b>, except
	 * the payers, which is what makes „feeExempt" and „balance" their own values: a route that
	 * answered off any other row in this fixture - the first, the last, the one that signed in
	 * first - answers another word and fails here.
	 */
	@Test
	void aMemberIsHandedHisOwnBasisAndTheOtherWordIsNotIt() throws Exception {
		String rule = db.sql("select pg_get_constraintdef(oid) from pg_constraint"
						+ " where conname = ?").param("membership_basis_known")
				.query(String.class).single();
		List<String> everyBasis = Pattern.compile("'([a-zA-Z]+)'").matcher(rule).results()
				.map(one -> one.group(1)).toList();
		assertThat(everyBasis).as("the schema knows a basis this case never asks anybody about,"
				+ " so one of the answers below is unmeasured; the rule it read was: %s", rule)
				.containsExactlyInAnyOrder("feeExempt", "payment", "balance");

		for (String alone : List.of("feeExempt", "balance")) {
			assertThat(db.sql("select count(*) from membership where season = ? and basis = ?")
					.params(THE_SEASON_ON_SALE, alone).query(Integer.class).single())
					.as("more than one row of the season on sale here is held on %s, so that word"
							+ " coming back would not say the answer was read off HIS row", alone)
					.isEqualTo(1);
		}

		for (String[] who : new String[][] {{MY_ACCOUNT, ME, "feeExempt"},
				{HER_ACCOUNT, ABROAD, "payment"}, {THE_THIRD_PARTYS_ACCOUNT, BROUGHT_BY_ANOTHER, "balance"}}) {
			JsonNode one = answerFor(who[0]).path("member");
			assertThat(one.path("memberNumber").asString())
					.as("this is not his record at all, so the basis below says nothing")
					.isEqualTo(who[1]);
			assertThat(one.path("membershipBasis").asString())
					.as("%s holds the season on sale on %s and was not told so, which is the whole of"
							+ " the owner's reason: he cannot understand why a payment is or is not"
							+ " being asked of him", who[1], who[2])
					.isEqualTo(who[2]);
			assertThat(one.path("membershipSeason").asInt())
					.as("%s was told his basis without the season it is the basis of", who[1])
					.isEqualTo(THE_SEASON_ON_SALE);
		}

		/* AND THE MEMBER WHOSE FEE HAS LAPSED HOLDS NO ROW FOR THE SEASON ON SALE, so he is answered
		   no basis and no season: absent, never a word in their place. Until V62 he was answered
		   „payment" off the per-person column, a basis for a season nobody had given him. */
		JsonNode his = answerFor(THE_LAPSED_ACCOUNT).path("member");
		assertThat(his.path("memberNumber").asString())
				.as("this is not his record at all, so the absence below says nothing")
				.isEqualTo(LAPSED);
		assertThat(his.has("membershipBasis") || his.has("membershipSeason"))
				.as("a member who holds no row for the season on sale was answered a basis for it")
				.isFalse();
	}

	/**
	 * AND HIS OWN REFERRAL CODE, AND NO OTHER CODE IN THE DATABASE ANYWHERE IN THE ANSWER.
	 *
	 * <p>Asked of the text and of every code the database holds rather than of a field name,
	 * for the reason {@code CompetitorApiTest} measured: a review swapped one field for
	 * another under the old name and the whole suite stayed green, because what guarded the
	 * field was the name alone. A code served under any name at all fails here.
	 *
	 * <p>His own is compared with what the database has for HIM. {@code referral_code} is
	 * UNIQUE (V7), so the value that comes back names one row, and this says which.
	 */
	@Test
	void aMemberIsHandedHisOwnReferralCodeAndNobodyElsesEver() throws Exception {
		String whole = whole(MY_ACCOUNT);

		assertThat(whole).as("the answer carries nothing at all, so it says nothing about what is"
				+ " in it or out of it").contains(ME);
		assertThat(answerFor(MY_ACCOUNT).path("member").path("referralCode").asString())
				.as("the caller's own link is what V24 section 6 promises him on the page Moja"
						+ " clanarina, and the public list cannot give it to him the day his fee"
						+ " lapses").isEqualTo(referralCodeOf(ME));

		List<String> everybodyElses = db.sql("select referral_code from competitor"
						+ " where member_number is distinct from ?").param(ME)
				.query(String.class).list();
		assertThat(everybodyElses).as("not every other row's code was read out of the database, so"
				+ " the loop below leaves somebody's unasked").hasSize(howMany("true") - 1);

		for (String code : everybodyElses) {
			assertThat(whole).as("somebody else's referral code (%s) left through the caller's own"
					+ " door, and a link is the one thing on a member's page that is a credential"
					+ " rather than a fact about running", code).doesNotContain(code);
		}
	}

	/**
	 * AND HOW MANY HE HAS BROUGHT IN, COUNTED OVER HIS OWN RECRUITS AND ONLY THOSE WHOSE
	 * FEE STANDS.
	 *
	 * <p>PDL, 13.08.2026: „Zbir je broj clanova koje je taj clan doveo <b>i kojima je
	 * clanarina aktivirana</b> ... Ko se registrovao preko linka a clanarina mu nikad nije
	 * aktivirana, ne donosi nista." So the count has two clauses and this fixture has a row
	 * that breaks each of them.
	 *
	 * <p><b>The three floors below are what makes the number 2 mean anything</b>, and each
	 * is read out of the database rather than described: somebody was brought in by a third
	 * party, one of the caller's own recruits has let his fee lapse, and there are more
	 * active members than he brought. Without the first, „whom he brought" and „whom anybody
	 * brought" are the same set; without the second the „whose fee stands" clause can be
	 * deleted with the suite green; without the third the count is „everybody".
	 */
	@Test
	void andHowManyHeBroughtInWhoseFeeStands() throws Exception {
		assertThat(howMany("referred_by = ? and not active", competitorIdOf(ME)))
				.as("nobody the caller brought in has let his fee lapse, so the clause that counts"
						+ " only standing fees can be deleted and this case stays green")
				.isPositive();
		assertThat(howMany("referred_by is not null and referred_by <> ? and active",
				competitorIdOf(ME)))
				.as("nobody was brought in by anybody but the caller, so a count over EVERY member"
						+ " with a referrer answers his own number by accident").isPositive();
		assertThat(howMany("active and id <> ?", competitorIdOf(ME)))
				.as("there are no other active members, so a count over the whole table answers"
						+ " his own number by accident").isGreaterThan(2);

		JsonNode mine = answerFor(MY_ACCOUNT).path("member");
		assertThat(mine.path("memberNumber").asString())
				.as("this is not his record at all, so the count below says nothing").isEqualTo(ME);
		assertThat(mine.path("referredCount").asInt())
				.as("the count is not of the members HE brought in whose fee stands. Counting his"
						+ " lapsed recruit too would answer 3, counting everybody anybody brought"
						+ " in would answer 3, counting every active member would answer 5, and"
						+ " counting himself would answer 1").isEqualTo(2);
	}

	/**
	 * AND THE OTHER DOOR ANSWERS NEITHER OF THEM, TO HIM OR TO ANYBODY.
	 *
	 * <p><b>This case held the opposite claim between 21.09.2026 and 25.09.2026 and is
	 * REPLACED rather than deleted, because the thing it was about has changed sides.</b>
	 * It read: „the two doors hand the same member two different links, and the one nobody
	 * remembers to change is always the second". {@link CompetitorApi} answered both facts
	 * on the caller's own row, this route answered them on his record, and two homes for
	 * one fact is the shape that lets two answers disagree - so the case compared them, one
	 * request apart, until the owner said which door keeps the fact.
	 *
	 * <p><b>He said it on 25.09.2026 (PDL P26a): the link „se sklanja sa javne liste
	 * takmicara" and stays only on „Moja clanarina".</b> There is no second answer left to
	 * agree with, so the only thing worth asking of the other door is that it really has
	 * stopped - and asked of the CALLER'S OWN ROW, which is the row that carried them.
	 *
	 * <p><b>Why the old case did not simply go.</b> The rule is that a guard is not deleted
	 * until its own mutations have been run against what replaces it. Three were, on
	 * 25.09.2026: dropping {@code and brought.active} from either door's counting clause,
	 * and answering the member number in place of {@code c.referral_code} here. Each was
	 * caught by TWO cases of this class that are nothing to do with the other door
	 * ({@code andHowManyHeBroughtInWhoseFeeStands},
	 * {@code aMemberIsHandedHisOwnReferralCodeAndNobodyElsesEver},
	 * {@code aMemberWhoseFeeHasLapsedIsStillHandedHisOwnRecord}), so what this case held
	 * that is still true is held twice over without it.
	 *
	 * <p>Asked of a member whose fee IS standing, because he is the only kind of member the
	 * other door has a row for at all - which is the whole reason the field could not stay
	 * there.
	 */
	@Test
	void theOtherDoorAnswersNeitherOfThemAnyMore() throws Exception {
		JsonNode mine = answerFor(MY_ACCOUNT).path("member");
		JsonNode onTheList = rowOnThePublicList(MY_ACCOUNT, ME);

		assertThat(onTheList.path("memberNumber").asString())
				.as("the public list has no row for the caller at all, so the two assertions"
						+ " below are asked of nothing and would pass whatever it answered")
				.isEqualTo(ME);
		assertThat(mine.path("referralCode").asString())
				.as("this door stopped answering the code, so the comparison below no longer"
						+ " says the fact moved rather than vanished")
				.isEqualTo(referralCodeOf(ME));

		assertThat(Answers.fieldsOf(onTheList))
				.as("the public list still hands the caller his own link or his own count on his"
						+ " own row; P26a gives both facts ONE home and it is this route, which"
						+ " is the only one that answers the member whose fee has lapsed")
				.doesNotContain("referralCode", "referredCount");
	}

	/**
	 * AND A MEMBER WHOSE TOWN WAS TYPED IS HANDED ITS COUNTRY TOO.
	 *
	 * <p>V7 leaves exactly two roads to a country open and closes the other two
	 * ({@code competitor_town_is_from_the_codebook_or_typed}, {@code competitor_typed_town_names_its_country}):
	 * a town out of the codebook carries its own country, and a town somebody typed names
	 * one beside it. The case above rides the first road. <b>Without this one the second is
	 * live code nothing measures</b> - and the coverage figure cannot say so, because the
	 * choice between them is made in SQL, where a Java branch counter sees nothing at all.
	 *
	 * <p>The member here lives abroad, so this also says the country is HERS and not the one
	 * every other row happens to carry.
	 */
	@Test
	void aMemberWhoseTownWasTypedIsHandedItsCountry() throws Exception {
		assertThat(answerFor(HER_ACCOUNT).path("member").path("country").asString())
				.as("the country a typed town names did not come back, which is one of the two"
						+ " roads every member's country arrives by")
				.isEqualTo("ME");
	}

	/**
	 * AND A MEMBER WHO HAS A NUMBER AND IS IN NO TEAM IS HANDED THE FIRST AND NOT THE SECOND.
	 *
	 * <p><b>This case and {@link #aPersonWithNoNumberYetIsStillACompetitor} are the two
	 * halves of one repair.</b> Until 21.09.2026 one row carried both absences, so „no
	 * number" and „no team" were one fact wearing two names: tying the member number to the
	 * existence of a team, or the team to the existence of a number, left the whole suite
	 * green. Two rows now, and each says one thing.
	 *
	 * <p>She administers {@code drugi-tim} without racing for it, which is a different fact
	 * from membership (V11) and is why the team exists at all for a member with no
	 * membership row.
	 */
	@Test
	void aMemberWithANumberAndNoTeamIsHandedNoTeam() throws Exception {
		JsonNode hers = answerFor(HER_ACCOUNT).path("member");

		assertThat(hers.path("memberNumber").asString())
				.as("a member number was not answered for somebody who has one, so the absent team"
						+ " below could be the absence of the whole record").isEqualTo(ABROAD);
		assertThat(hers.has("teamId"))
				.as("a team was answered for a member who is in none. Administering a team is not"
						+ " being in one (V11), and the two are the same key")
				.isFalse();
	}

	/**
	 * AND NOTHING OF ANYBODY ELSE'S, ASKED OF EVERY FIELD AND OF EVERY OTHER ROW.
	 *
	 * <p>This is also THE FLOOR the whole class stands on. Every case above compares the
	 * caller's answer with one value and means „and no other row carries it"; this is where
	 * that second half is measured. It replaces four hand-written lists of other people's
	 * seasons, countries, numbers and teams, and the reason is not tidiness: those lists were
	 * a second copy of the fixture, so a row handed the caller's own season and country made
	 * them stale and green in the same stroke, and a field added to the record tomorrow would
	 * have joined none of them.
	 *
	 * <p><b>Nothing here is listed. Three things are derived and each closes one way the sweep
	 * could be empty and still pass:</b> every {@code competitor} row is behind an account, so
	 * asking the route for every account really is asking about every row; the caller's own
	 * record carries as many fields as {@link MeApi.MyOwnRecord} has components, so no field
	 * the route can answer sits outside the comparison; and the number of records swept is the
	 * number of rows less his own, so a fixture that quietly lost an account cannot turn this
	 * into an empty loop.
	 *
	 * <p><b>The member number is asked of the TEXT as well as of the field, and the line is
	 * whether a bare number can collide.</b> A member number is six digits with leading zeroes
	 * and cannot be anything else in this answer, so it would catch a second record leaking
	 * under any name at all. A season and a team key are bare whole numbers sitting beside
	 * {@code "account":N}, whose {@code bigserial} climbs through the whole suite because a
	 * sequence does not roll back: {@code "account":2027} is a matter of time, not of code, and
	 * a case that went red on it would be a case nobody could fix. Those are compared on the
	 * field.
	 */
	@Test
	void andNothingOfAnybodyElses() throws Exception {
		assertThat(howMany("not exists (select 1 from account a where a.competitor_id ="
				+ " competitor.id)"))
				.as("a row here is behind no account, so the route is never asked for its record"
						+ " and it may carry the caller's own season, country or team with nothing"
						+ " going red")
				.isZero();

		String whole = whole(MY_ACCOUNT);
		JsonNode mine = answerFor(MY_ACCOUNT).path("member");
		assertThat(mine.size())
				.as("the caller's own record does not carry every field the route can answer, so"
						+ " at least one field is outside the comparison below rather than measured"
						+ " by it")
				.isEqualTo(MeApi.MyOwnRecord.class.getRecordComponents().length);
		assertThat(whole).as("his own record is not in the answer at all, so what follows says"
				+ " nothing about what is left out").contains(ME);

		int swept = 0;
		for (String email : sessions.keySet()) {
			if (email.equals(MY_ACCOUNT)) {
				continue;
			}
			JsonNode his = answerFor(email).path("member");
			if (his.isMissingNode()) {
				continue;
			}
			swept++;
			for (RecordComponent field : MeApi.MyOwnRecord.class.getRecordComponents()) {
				/* THE ONE FIELD THAT CANNOT BE THE CALLER'S ALONE, and it is named rather than
				   skipped quietly. Whether a fee stands is a yes or a no, and the portal writes
				   it as the number does (`competitor(...)` below): five of the seven rows stand,
				   so the caller cannot be the odd one out of it the way he is in the gender or the
				   switch that hides a profile. What this sweep exists to catch - another member's
				   value leaving through the caller's door - cannot be caught on a flag that most
				   of the rows share, and is caught on the other nineteen; that the flag itself is
				   read off HIS row is `andWhetherHisFeeStandsWhichTheNumberAloneCannotSay`, which
				   asks it of rows chosen so that each wrong source gives a different answer. */
				if (field.getName().equals("active")) {
					continue;
				}
				/* AND THE SEASON OF THE BASIS, for the same kind of reason: it is the season on
				   sale, which on any one day is one number for every member who holds a basis at
				   all, so four of the seven rows share it with the caller by construction. That it
				   is HIS is said by the basis beside it, which is his alone here, and
				   `TheBasisOfTheSeasonOnSaleTest` asks the season of rows chosen so that every wrong
				   season gives a different answer. */
				if (field.getName().equals("membershipSeason")) {
					continue;
				}
				assertThat(his.path(field.getName()).toString())
						.as("the record behind %s carries the very value the caller was answered"
								+ " for %s, so on that field his own record and somebody else's"
								+ " cannot be told apart and every case that reads it says nothing",
								email, field.getName())
						.isNotEqualTo(mine.path(field.getName()).toString());
			}
			if (his.has("memberNumber")) {
				assertThat(whole).as("another member's number (%s) left through the caller's own"
						+ " door, under this field name or any other",
						his.path("memberNumber").asString())
						.doesNotContain(his.path("memberNumber").asString());
			}
		}
		assertThat(swept).as("fewer records were swept than there are rows beside his own, so some"
				+ " row went uncompared")
				.isEqualTo(howMany("true") - 1);
	}

	/**
	 * AN ACCOUNT THAT RACES FOR NOBODY HAS NO RECORD AT ALL, AND THAT IS NOT AN EMPTY ONE.
	 *
	 * <p>The distinction is the whole shape of this answer, so it is asked in both
	 * directions at once: the moderator is really signed in (his role and his account are
	 * there, and 200 rather than 401), and the key {@code member} is MISSING rather than
	 * present and empty. A record of nulls would say „I am a competitor with nothing filled
	 * in", which is a different person from „I am not a competitor", and the screen that
	 * draws an administration off this answer has to be able to tell them apart.
	 */
	@Test
	void anAccountThatRacesForNobodyHasNoRecordAtAll() throws Exception {
		JsonNode answer = answerFor(RACES_FOR_NOBODY);

		assertThat(answer.path("role").asString())
				.as("he is not signed in at all, so the missing record below says nothing")
				.isEqualTo("moderator");
		assertThat(answer.has("member"))
				.as("an account that races for nobody was answered with a record, empty or not."
						+ " Having no record and having an empty one are two different facts, and"
						+ " this answer has to be the first of them")
				.isFalse();
	}

	/**
	 * THE ANSWER CARRIES THE LANGUAGE OF HIS OWN ACCOUNT'S MAIL, AND OF NOBODY ELSE'S.
	 *
	 * <p>V59, and the screen that changes it starts from it (JM-B). Every other account is put in
	 * the other language each time, once in each direction, so an answer that read the language of
	 * another row than the caller's account, or that was a constant, is wrong in one of the two.
	 * And a moderator who races for nobody is handed his too: it is the account's setting (PDL,
	 * „Odgovori vlasnika 17.10.2026, jezik pošte").
	 */
	@Test
	void theAnswerCarriesTheLanguageOfHisOwnAccountsMailAndOfNobodyElses() throws Exception {
		db.sql("update account set mail_language = 'en' where email <> ?").param(MY_ACCOUNT).update();

		assertThat(answerFor(MY_ACCOUNT).path("mailLanguage").asString()).isEqualTo("sr");

		db.sql("update account set mail_language = case when email = ? then 'en' else 'sr' end")
				.param(MY_ACCOUNT).update();

		assertThat(answerFor(MY_ACCOUNT).path("mailLanguage").asString()).isEqualTo("en");
		assertThat(answerFor(HER_ACCOUNT).path("mailLanguage").asString()).isEqualTo("sr");

		db.sql("update account set mail_language = 'en' where email = ?").param(RACES_FOR_NOBODY)
				.update();

		assertThat(answerFor(RACES_FOR_NOBODY).path("mailLanguage").asString()).isEqualTo("en");
	}

	/**
	 * AND A PERSON WHO HAS REGISTERED AND HAS NO NUMBER YET IS STILL A COMPETITOR.
	 *
	 * <p>ADL A44, owner 11.09.2026: „`member_number` postaje neobavezan na `competitor`.
	 * Osoba je `competitor` od registracije, a clan postaje kad dobije broj." So the record
	 * is THERE - he is a competitor and the portal knows his town, his season and his team -
	 * and the number inside it is not. Both halves are asked, because a resource that
	 * answered him the way it answers a moderator would pass on the second half alone.
	 *
	 * <p><b>He IS in a team, and that is the point of the row.</b> The other half of this
	 * pair is {@link #aMemberWithANumberAndNoTeamIsHandedNoTeam}: with both absences on one
	 * row, a query that tied the number to the team would have been green either way.
	 */
	@Test
	void aPersonWithNoNumberYetIsStillACompetitor() throws Exception {
		JsonNode answer = answerFor(THE_ACCOUNT_WITH_NO_NUMBER);

		assertThat(answer.has("member"))
				.as("a registered person was answered as though he raced for nobody, which is the"
						+ " moderator's answer and not his").isTrue();
		assertThat(answer.path("member").path("firstSeason").asInt())
				.as("his record came back empty, so the absent number below says nothing")
				.isEqualTo(2027);
		assertThat(answer.path("member").has("memberNumber"))
				.as("a number was answered for somebody who has none").isFalse();
		assertThat(answer.path("member").path("teamId").asLong())
				.as("the team of somebody who has no member number did not come back, so the"
						+ " absent number above is being read as an absent team")
				.isEqualTo(teamIdOf("treci-tim"));
	}

	/**
	 * AND A MEMBER WHOSE FEE HAS LAPSED IS ANSWERED, WHICH IS WHY THIS ROUTE EXISTS.
	 *
	 * <p>{@link CompetitorApi} leaves him off its list entirely - owner, 13.09.2026, asked
	 * which shape PDL P11 takes on the server - and says so in its own javadoc: „the profile
	 * and the historical tables of a member whose fee has lapsed need a resource that knows
	 * them, and it is not this one."
	 *
	 * <p>Both halves are measured rather than one: that the public list really does drop him
	 * (read off that route, not asserted about it) and that this one really does not. A case
	 * that only asked the second would stay green the day the first changed, and would then
	 * be holding a claim about a resource that no longer behaves that way.
	 *
	 * <p><b>AND HIS REFERRAL CODE IS ASKED OF BOTH DOORS, because that is the measurement
	 * that overturned „answered already".</b> The other route computes it inside a query
	 * ending {@code where c.active}, so his row never reaches the {@code case} that would
	 * fill it in: signed in with his own cookie he gets no code from it at all. V24 section
	 * 6 promises that code on „Moja clanarina", which is the page he opens to renew.
	 *
	 * <p><b>AND HIS COUNT, WHICH IS THE OTHER HALF OF THAT AND WAS MISSING UNTIL 21.09.2026.</b>
	 * The code had this case and the count had none, and a count is the harder of the two to
	 * leave unmeasured by accident: while he had brought nobody in, his right answer was 0 and
	 * every wrong one was 0 as well. {@link CompetitorApi}'s {@code where c.active} written
	 * into the counting clause here as {@code case when c.active then ... end} answers him 0
	 * and is caught by nothing; so is a clause tied to the caller's own row. He brings two
	 * people in now and is answered 1, and the three floors below say what each wrong query
	 * would have answered instead.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsStillHandedHisOwnRecord() throws Exception {
		assertThat(howMany("referred_by = ? and active", competitorIdOf(LAPSED)))
				.as("the member whose fee has lapsed brought nobody in whose fee stands, so his"
						+ " true count is zero - and so is the count a clause gated on his own"
						+ " standing fee gives him, and so is the count of nobody at all. Right and"
						+ " wrong are one number and the count below measures neither")
				.isPositive();
		assertThat(howMany("referred_by = ? and not active", competitorIdOf(LAPSED)))
				.as("nobody he brought in has let his fee lapse, so the clause that counts only"
						+ " standing fees can be struck out and his number does not move")
				.isPositive();
		assertThat(howMany("referred_by = ? and active", competitorIdOf(LAPSED)))
				.as("he and the caller were brought the same number of standing fees, so a count"
						+ " computed off the CALLER's row answers him correctly by accident")
				.isNotEqualTo(howMany("referred_by = ? and active", competitorIdOf(ME)));

		String publicList = whatThePublicListSays(THE_LAPSED_ACCOUNT);

		assertThat(publicList)
				.as("the public list carries him after all, so this route is not the only door"
						+ " and this case is measuring nothing")
				.doesNotContain(LAPSED);
		assertThat(publicList)
				.as("the public list hands him his own referral code after all, so the sentence"
						+ " this route was refused with - answered already, by CompetitorApi - is"
						+ " true and the field here is a second home for nothing")
				.doesNotContain(referralCodeOf(LAPSED));

		JsonNode his = answerFor(THE_LAPSED_ACCOUNT).path("member");
		assertThat(his.path("memberNumber").asString())
				.as("the one member who cannot be read off the public list cannot be read off this"
						+ " route either, so nothing in the portal can draw his own screens")
				.isEqualTo(LAPSED);
		assertThat(his.path("referralCode").asString())
				.as("the member who has to renew is the one member the portal cannot hand a"
						+ " referral link, and V24 section 6 promises it to him on exactly the page"
						+ " he opens to renew")
				.isEqualTo(referralCodeOf(LAPSED));
		assertThat(his.path("referredCount").asInt())
				.as("the count is not of the members HE brought in whose fee stands. A clause gated"
						+ " on his own standing fee - CompetitorApi's where c.active, carried in as"
						+ " a case - would answer 0, counting his recruit who never got a number"
						+ " too would answer 2, counting off the caller's row would answer 2,"
						+ " counting everybody anybody brought in would answer 3, and counting every"
						+ " active member would answer 5")
				.isEqualTo(1);
	}

	/**
	 * AND HE IS TOLD WHETHER HIS FEE STANDS, WHICH IS WHAT TELLS A LAPSED MEMBER FROM A STANDING
	 * ONE AND IS ASKED OF THREE PEOPLE WHO ARE NOT ALL ALIKE.
	 *
	 * <p>Measured on 11.10.2026 before the flag existed: a standing member and one whose fee has
	 * lapsed were answered the same names, and nothing in either said which was which. PDL P8
	 * (the entry „Šta sme neplaćen član", 10.10.2026, and its addition of 11.10.2026) treats the
	 * two differently - the one who never paid may change his data and his password, the one
	 * whose fee has lapsed is answered 404 on both - so the screens that draw those two forms
	 * have to be able to tell.
	 *
	 * <p><b>Every expectation is read out of the database, never typed here</b>, and the rows are
	 * chosen so that each wrong way of answering is a different value on one of them:
	 * {@code true} always is wrong on the lapsed member and on the one with no number,
	 * {@code false} always is wrong on the caller and on her, and "he has a number" is wrong on
	 * the lapsed member alone. <b>Her row is the one that separates the flag from the basis</b>:
	 * the caller is freed of the fee, so a flag worked out from {@code feeExempt} would answer him
	 * right, but she pays and her fee stands, so it would answer her wrong.
	 *
	 * <p><b>And the flag does not tell the lapsed member from the one who never paid, which is the
	 * reason the number is asked beside it and not instead of it.</b> Both are {@code false}; what
	 * parts them is whether the answer has a number in it. That is asserted here rather than
	 * left to a comment, because a reader who decides "never paid" by the flag alone would hand a
	 * lapsed member a screen for somebody who has no number.
	 */
	@Test
	void andWhetherHisFeeStandsWhichTheNumberAloneCannotSay() throws Exception {
		JsonNode standing = answerFor(MY_ACCOUNT).path("member");
		JsonNode alsoStanding = answerFor(HER_ACCOUNT).path("member");
		JsonNode lapsed = answerFor(THE_LAPSED_ACCOUNT).path("member");
		JsonNode neverPaid = answerFor(THE_ACCOUNT_WITH_NO_NUMBER).path("member");

		for (JsonNode one : List.of(standing, alsoStanding, lapsed, neverPaid)) {
			assertThat(one.path("active").isBoolean())
					.as("the flag is missing or is not a yes or a no in an answer, so what follows"
							+ " compares nothing: %s", one)
					.isTrue();
		}

		assertThat(standing.path("active").asBoolean())
				.as("the caller's fee stands and he was told it does not")
				.isEqualTo(Boolean.parseBoolean(columnOf("active", ME)))
				.isTrue();
		assertThat(alsoStanding.path("active").asBoolean())
				.as("she pays and her fee stands, and a flag worked out from the basis (the caller is"
						+ " freed of the fee, she is not) was handed back to her instead")
				.isEqualTo(Boolean.parseBoolean(columnOf("active", ABROAD)))
				.isTrue();
		assertThat(basisOf(ABROAD))
				.as("she is freed of the fee after all, so the row that separates the flag from the"
						+ " basis does not")
				.isEqualTo("payment");
		assertThat(lapsed.path("active").asBoolean())
				.as("a member whose fee has lapsed was told it stands, which is what the portal could"
						+ " not tell him from a standing one until this flag existed")
				.isEqualTo(Boolean.parseBoolean(columnOf("active", LAPSED)))
				.isFalse();
		assertThat(neverPaid.path("active").asBoolean())
				.as("somebody who registered and never paid was told his fee stands")
				.isEqualTo(Boolean.parseBoolean(
						db.sql("select active::text from competitor where member_number is null")
								.query(String.class).single()))
				.isFalse();

		/* The pair that tells three people apart, asked of the answers themselves. The lapsed
		   member has a number and the one who never paid has none; the flag is false for both. */
		assertThat(lapsed.has("memberNumber"))
				.as("a member whose fee has lapsed lost his number, so the number cannot be what tells"
						+ " him from somebody who never paid")
				.isTrue();
		assertThat(neverPaid.has("memberNumber"))
				.as("somebody who never paid was handed a number")
				.isFalse();
		assertThat(lapsed.path("active").asBoolean())
				.as("the flag parts the lapsed member from the standing one, and does not part him from"
						+ " the one who never paid")
				.isEqualTo(neverPaid.path("active").asBoolean());
	}

	/**
	 * A MEMBER IS HANDED THE PROFILE HIS OWN PAGE IS DRAWN FROM, EACH FACT COMPARED WITH WHAT
	 * THE DATABASE HAS FOR HIM.
	 *
	 * <p>PDL P8, 25.09.2026, „Treba da moze da otvori svoj profil dokle god postoji" - and a
	 * page headed by a name needs the name, none of which reached a member who is on no row of
	 * the public list.
	 *
	 * <p><b>Every expectation is read out of the database or is a constant defined once above</b>,
	 * and every one is a value no other row here carries (the class note, and the sweep in
	 * {@link #andNothingOfAnybodyElses}), so a query that reached the wrong row is wrong in the
	 * value. <b>The two booleans are both {@code true} for him</b>, so a swap of the two would
	 * pass here; it is {@link #aMemberWhoseFeeHasLapsedAndHidesHisProfileIsHandedAllOfIt} that
	 * writes them differently and asks.
	 */
	@Test
	void aMemberIsHandedHisOwnProfile() throws Exception {
		JsonNode mine = answerFor(MY_ACCOUNT).path("member");

		assertThat(mine.path("memberNumber").asString())
				.as("this is not his record at all, so the profile below says nothing").isEqualTo(ME);
		assertThat(mine.path("firstName").asString()).as("his given name")
				.isEqualTo(columnOf("first_name", ME)).isEqualTo("Milica");
		assertThat(mine.path("lastName").asString()).as("his family name")
				.isEqualTo(columnOf("last_name", ME)).isEqualTo("Djurisic");
		assertThat(mine.path("gender").asString())
				.as("his gender, the one value in this fixture that only he carries")
				.isEqualTo(columnOf("gender", ME)).isEqualTo("F");
		assertThat(mine.path("city").asString())
				.as("the NAME of the town he lives in, out of the codebook, and not the empty typed"
						+ " column beside it")
				.isEqualTo(townOf(ME));
		assertThat(mine.path("ageBand").asString())
				.as("the band the rulebook puts him in for the season that is running: born in 1957 he"
						+ " is the one row of the fixture that is 55 or more, and the year itself is not"
						+ " an answer (the case on the year of birth)")
				.isEqualTo("55+");
		assertThat(mine.path("firstSeason2027").asBoolean())
				.as("whether he runs in the beginners' category").isTrue();
		assertThat(mine.path("teamSince").asInt())
				.as("the season the membership that has NOT ended began in, which is the one he"
						+ " moved to and not the one he left")
				.isEqualTo(seasonThatMembershipBeganIn(ME)).isEqualTo(2028);
		assertThat(mine.path("bio").asString()).as("the biography a moderator approved")
				.isEqualTo(columnOf("bio", ME)).isEqualTo(HIS_BIOGRAPHY);
		assertThat(mine.path("profileHidden").asBoolean())
				.as("whether he has hidden his page, which is answered to HIM as well").isTrue();
		assertThat(mine.path("birthdayShown").asString()).as("what he chose about his birthday")
				.isEqualTo(columnOf("birthday_shown", ME)).isEqualTo("full");
		assertThat(mine.path("photo").asString())
				.as("the address of his approved portrait, which is built out of the DIGEST of the"
						+ " picture and never out of its key")
				.isEqualTo(A_PICTURE_IS_ASKED_FOR_AT + HIS_PORTRAIT);
		assertThat(new BigDecimal(mine.path("crop").path("x").asString()))
				.as("the left edge of the square of his portrait").isEqualByComparingTo("0.125");
		assertThat(new BigDecimal(mine.path("crop").path("y").asString()))
				.as("the top edge of it").isEqualByComparingTo("0.25");
		assertThat(new BigDecimal(mine.path("crop").path("size").asString()))
				.as("and its diameter, which this resource names `size` as the public list does")
				.isEqualByComparingTo("0.5");
	}

	/**
	 * HIS POSTAL ADDRESS AND HIS TELEPHONE ARE HIS OWN, and a member who has no telephone is
	 * answered no key for it.
	 *
	 * <p>Measured on QA on 18.10.2026: the owner saved both, was told so, refreshed and found the
	 * boxes empty, because this answer carried neither. <b>The sources are separated on three axes
	 * rather than one.</b> The caller's values are carried by nobody else (the fixture, and the
	 * sweep in {@link #andNothingOfAnybodyElses}); the lapsed member is given an address of his
	 * own and no telephone, so „the caller's" and „whoever is asking" are two answers and „a
	 * telephone" and „his telephone" are two answers; and the person with no number has the
	 * fixture's shared address and no telephone, which is the third state of the pair.
	 *
	 * <p><b>And neither value leaves through anybody else's door</b>, read off the whole text of
	 * every other answer: the caller's address and number are in the caller's answer and in no
	 * other, however they are spelt.
	 */
	/**
	 * HIS SHIRT SIZE, OFF HIS OWN ROW AND NOBODY ELSE'S (23.10.2026, the card „Podaci" opens with it).
	 * Two members with two different sizes, so the size of the first row, or of the caller of some
	 * other request, cannot pass for his.
	 */
	@Test
	void hisShirtSizeIsHisOwn() throws Exception {
		db.sql("update competitor set shirt_size = 'XL' where member_number = ?").param(ME).update();
		db.sql("update competitor set shirt_size = 'XS' where member_number = ?").param(LAPSED).update();

		assertThat(answerFor(MY_ACCOUNT).path("member").path("shirtSize").asString()).isEqualTo("XL");
		assertThat(answerFor(THE_LAPSED_ACCOUNT).path("member").path("shirtSize").asString()).isEqualTo("XS");
	}

	@Test
	void hisPostalAddressAndHisTelephoneAreHisOwn() throws Exception {
		db.sql("update competitor set address = ? where member_number = ?")
				.params(THE_LAPSED_MEMBERS_ADDRESS, LAPSED).update();

		JsonNode mine = answerFor(MY_ACCOUNT).path("member");
		assertThat(mine.path("address").asString())
				.as("the postal address in his own record is not the one on his own row")
				.isEqualTo(columnOf("address", ME)).isEqualTo(HIS_ADDRESS);
		assertThat(mine.path("phone").asString())
				.as("the telephone in his own record is not the one on his own row")
				.isEqualTo(columnOf("phone", ME)).isEqualTo(HIS_TELEPHONE);

		JsonNode lapsed = answerFor(THE_LAPSED_ACCOUNT).path("member");
		assertThat(lapsed.path("address").asString())
				.as("a member whose fee has lapsed is not handed his own postal address")
				.isEqualTo(columnOf("address", LAPSED)).isEqualTo(THE_LAPSED_MEMBERS_ADDRESS);
		assertThat(lapsed.has("phone"))
				.as("a member with no telephone was answered one, or a null instead of no key")
				.isFalse();
		assertThat(db.sql("select phone is null from competitor where member_number = ?")
				.param(LAPSED).query(Boolean.class).single())
				.as("the fixture gave him a telephone").isTrue();

		JsonNode nobodyYet = answerFor(THE_ACCOUNT_WITH_NO_NUMBER).path("member");
		assertThat(nobodyYet.path("address").asString())
				.as("somebody who registered and has no number yet is not handed his postal address")
				.isEqualTo(db.sql("select address from competitor where member_number is null")
						.query(String.class).single()).isEqualTo("Ulica 1");
		assertThat(nobodyYet.has("phone")).isFalse();

		for (String email : sessions.keySet()) {
			if (email.equals(MY_ACCOUNT)) {
				continue;
			}
			assertThat(whole(email))
					.as("the caller's postal address or telephone left through the door of %s", email)
					.doesNotContain(HIS_ADDRESS).doesNotContain(HIS_TELEPHONE);
		}
	}

	/**
	 * THE WORDS HE HAS SENT AND A MODERATOR HAS NOT DECIDED ARE HANDED TO HIM, AS A FIELD OF THEIR OWN.
	 *
	 * <p>PDL P11, 18.10.2026: „Dok tekst o sebi čeka odobrenje, član ga vidi u Podešavanjima sa
	 * oznakom da čeka"; the profile keeps the approved words. So {@code bio} is the biography a
	 * moderator approved and {@code bioWaiting} is what waits, and the two are different strings here.
	 * The cases that follow tell the clause apart from its wrong versions: a text that was DECIDED,
	 * a picture that waits, a row of another tab and another member's text are each a row of the same
	 * table that must not be his words that wait.
	 */
	@Test
	void theWordsThatWaitAreHandedToHimAndAreNotTheApprovedOnes() throws Exception {
		JsonNode mine = answerFor(MY_ACCOUNT).path("member");

		assertThat(mine.path("bioWaiting").asString())
				.as("the words he sent and nobody has decided are not what his own record hands him")
				.isEqualTo(HIS_WAITING_WORDS);
		assertThat(mine.path("bio").asString())
				.as("the words that wait took the place of the approved ones")
				.isEqualTo(HIS_BIOGRAPHY).isNotEqualTo(HIS_WAITING_WORDS);
		assertThat(answerFor(HER_ACCOUNT).path("member").path("bioWaiting").asString())
				.as("somebody else's words that wait are handed to the wrong member")
				.isEqualTo(ANOTHERS_WAITING_WORDS);
		assertThat(answerFor(THE_LAPSED_ACCOUNT).path("member").has("bioWaiting"))
				.as("a member with nothing waiting is handed words that wait")
				.isFalse();

		for (String email : sessions.keySet()) {
			if (!email.equals(MY_ACCOUNT)) {
				assertThat(whole(email))
						.as("the words he sent left through the door of %s", email)
						.doesNotContain(HIS_WAITING_WORDS);
			}
		}
	}

	/**
	 * A TEXT THAT WAS DECIDED, A PICTURE THAT WAITS AND A ROW OF ANOTHER TAB ARE NOT HIS WORDS THAT WAIT.
	 *
	 * <p>Each is written for a member who has no text waiting, so the wrong clause (any row of his, any
	 * waiting row, any row of the tab) answers a value where the right one answers nothing.
	 */
	@Test
	void onlyAWaitingTextIsHisWordsThatWait() throws Exception {
		long lapsed = competitorIdOf(LAPSED);

		db.sql("insert into verification (queue, competitor_id, subject, body, state, decided_at,"
						+ " decided_by_name) values ('profiles', ?, 'Nenad Ilic', 'Odlucen tekst.',"
						+ " 'approved', timestamptz '2026-09-01 10:00:00+00', 'Moderator')")
				.param(lapsed).update();
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values ('profiles', ?, 'Nenad Ilic', 'Slika koja ceka.', ?)")
				.params(lapsed, aPortrait("ef".repeat(32), "0.1", "0.1", "0.5")).update();
		db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('teams', ?, 'Nenad Ilic', 'Red drugog taba.')")
				.param(lapsed).update();

		assertThat(answerFor(THE_LAPSED_ACCOUNT).path("member").has("bioWaiting"))
				.as("a text decided, a picture that waits or a row of another tab was handed back as"
						+ " the words that wait")
				.isFalse();
	}

	/**
	 * AND A TOWN THAT WAS TYPED ANSWERS ITS OWN NAME, with the keys that belong to a member who
	 * has no portrait and no team left out altogether.
	 *
	 * <p>The case above rides the codebook road to a town and this rides the typed one: the
	 * {@code coalesce} between them is made in SQL, where a Java branch counter sees nothing.
	 * <b>Absent and not null</b>, which is {@code teamId}'s own precedent on this record and the
	 * reason the frontend reads a missing key and a null as one answer; the public list says null
	 * where this says nothing, and {@link #theTwoDoorsAnswerTheSameMemberFieldForField} compares
	 * the two on the VALUE for that reason.
	 */
	@Test
	void aMemberWithATypedTownAndNoPortraitAndNoTeamIsHandedHisTownAndNothingMore() throws Exception {
		JsonNode hers = answerFor(HER_ACCOUNT).path("member");

		assertThat(hers.path("memberNumber").asString())
				.as("this is not her record at all, so the keys left out below say nothing")
				.isEqualTo(ABROAD);
		assertThat(hers.path("city").asString())
				.as("the town somebody TYPED did not come back, which is the second road to a name")
				.isEqualTo("Podgorica");
		assertThat(hers.path("gender").asString())
				.as("she shares the gender of every row but one, and it is not the caller's")
				.isEqualTo("M");
		assertThat(hers.path("firstSeason2027").asBoolean()).isFalse();
		assertThat(hers.path("profileHidden").asBoolean()).isFalse();
		assertThat(hers.path("birthdayShown").asString()).isEqualTo("none");
		assertThat(hers.path("bio").asString())
				.as("a member who has written nothing is answered the empty text and not nothing")
				.isEmpty();
		assertThat(hers.has("bio")).isTrue();

		for (String key : List.of("photo", "crop", "teamSince", "teamId")) {
			assertThat(hers.has(key))
					.as("%s was answered for a member who has none, and it is a key that is left out"
							+ " of the record rather than carried as null", key)
					.isFalse();
		}
	}

	/**
	 * AND A PERSON WHO HAS REGISTERED AND HAS NO NUMBER YET IS HANDED HIS PROFILE TOO.
	 *
	 * <p>He is a competitor from registration (ADL A44), so he has a name and a town and a team
	 * long before he has a number. The frontend does not draw a profile for him, because there is
	 * no address to ask it at; but a record that answered him the profile of a moderator, which is
	 * nothing, would be the same fault as an answer that forgot he has a team.
	 */
	@Test
	void aPersonWithNoNumberYetIsHandedHisProfileToo() throws Exception {
		JsonNode his = answerFor(THE_ACCOUNT_WITH_NO_NUMBER).path("member");

		assertThat(his.has("memberNumber")).as("a number was answered for somebody who has none")
				.isFalse();
		assertThat(his.path("firstName").asString()).isEqualTo("Tek");
		assertThat(his.path("lastName").asString()).isEqualTo("Stigao");
		assertThat(his.path("city").asString()).isEqualTo("Skoplje");
		assertThat(his.path("teamSince").asInt())
				.as("the season his membership of the third team began in")
				.isEqualTo(2027);
		assertThat(his.path("firstSeason2027").asBoolean()).isFalse();
		assertThat(his.path("profileHidden").asBoolean()).isFalse();
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED AND WHO HIDES HIS PROFILE IS HANDED ALL OF IT, which is the
	 * one place the two doors differ on purpose.
	 *
	 * <p>{@link CompetitorApi} holds a hidden profile's biography, portrait and link to its team
	 * back from a reader who is neither an active member nor the administration, and a member
	 * whose fee has lapsed is such a reader (PDL P23, 03.10.2026, „Skrivanje deluje prema svakome
	 * ko nije aktivan član ni administracija, nikad prema aktivnom članu"). Of his OWN page he is
	 * not: PDL P8, 25.09.2026, „Treba da moze da otvori svoj profil dokle god postoji" - the
	 * record gives the reason in its own sentence, that when a member looks at himself nothing
	 * about himself is hidden from him. A route that carried that withholding in, as
	 * {@code case when THE_PROFILE_IS_OPEN_TO_THE_CALLER then c.bio end}, would answer him the
	 * empty profile of a stranger.
	 *
	 * <p><b>The floor is read off the other door and not assumed</b>: he really is a reader the
	 * public list withholds a hidden member's biography from (it asks the caller, and he is
	 * neither), so that the full answer below is a difference that was available to be got wrong.
	 * <b>And his two booleans are written DIFFERENTLY</b> (hidden, and not in the beginners'
	 * category), so a swap of the two is wrong in a value.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedAndHidesHisProfileIsHandedAllOfIt() throws Exception {
		long portrait = aPortrait(THE_LAPSED_MEMBERS_PORTRAIT, "0.37500000", "0.62500000",
				"0.25000000");
		db.sql("update competitor set profile_hidden = true, bio = ?, photo_id = ?"
						+ " where member_number = ?")
				.params(THE_LAPSED_MEMBERS_BIOGRAPHY, portrait, LAPSED).update();

		assertThat(whatThePublicListSays(THE_LAPSED_ACCOUNT))
				.as("the public list carries him after all, so he is not the lapsed member this case"
						+ " is about")
				.doesNotContain(LAPSED);
		JsonNode whatHeIsToldOfTheCaller = rowOnThePublicList(THE_LAPSED_ACCOUNT, ME);
		assertThat(whatHeIsToldOfTheCaller.path("profileHidden").asBoolean())
				.as("the caller does not hide his profile, so there is nothing for the public list to"
						+ " withhold from the lapsed member")
				.isTrue();
		assertThat(whatHeIsToldOfTheCaller.path("bio").isNull())
				.as("the public list hands the lapsed member a hidden profile's biography, so he is"
						+ " not a reader it withholds from and the answer below proves nothing")
				.isTrue();

		JsonNode his = answerFor(THE_LAPSED_ACCOUNT).path("member");

		assertThat(his.path("memberNumber").asString())
				.as("this is not his record at all, so the profile below says nothing")
				.isEqualTo(LAPSED);
		assertThat(his.path("profileHidden").asBoolean()).isTrue();
		assertThat(his.path("firstSeason2027").asBoolean()).isFalse();
		assertThat(his.path("bio").asString())
				.as("his biography was held back from him, as the public list holds a hidden one back"
						+ " from a reader whose fee has lapsed. Of his own page nothing is hidden")
				.isEqualTo(THE_LAPSED_MEMBERS_BIOGRAPHY);
		assertThat(his.path("photo").asString())
				.as("his portrait was held back from him")
				.isEqualTo(A_PICTURE_IS_ASKED_FOR_AT + THE_LAPSED_MEMBERS_PORTRAIT);
		assertThat(new BigDecimal(his.path("crop").path("x").asString()))
				.as("and the square of it").isEqualByComparingTo("0.375");
		assertThat(his.path("teamId").asLong())
				.as("the link to his team was held back from him")
				.isEqualTo(teamIdOf("probni-tim"));
		assertThat(his.path("teamSince").asInt())
				.as("and the season it began in, which leaves with the team")
				.isEqualTo(2027);
		assertThat(his.path("city").asString())
				.as("the name of a codebook town that is not the caller's")
				.isEqualTo(townOf(LAPSED)).isNotEqualTo(townOf(ME));
	}

	/**
	 * AND THE OTHER POLARITY OF HIS TWO CHOICES, WITH EVERY NAME HE HAS, for the same member whose
	 * fee has lapsed.
	 *
	 * <p>The case above writes him hiding his profile and outside the beginners' category, which
	 * keeps a swap of the two flags wrong in a value. It cannot also tell a flag that was gated on
	 * his standing fee from the flag itself: a gated {@code boolean} reads back as {@code false},
	 * which is exactly the value that case gives him for the beginners' category, so right and wrong
	 * are one number (the fault the lapsed member's COUNT had until 21.09.2026). So he is written
	 * the other way round here - in the beginners' category and not hiding - with a birthday shown
	 * to the year and the other gender than the one the fixture gives him, and asked the facts the
	 * case above leaves unasked: his two names, his gender and his birthday. Each is a value a gate
	 * on his standing fee would turn into nothing.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsHandedEveryNameAndBothChoicesOfHisProfileToo() throws Exception {
		db.sql("update competitor set first_season_2027 = true, profile_hidden = false,"
						+ " birthday_shown = 'year', gender = 'F' where member_number = ?")
				.param(LAPSED).update();

		JsonNode his = answerFor(THE_LAPSED_ACCOUNT).path("member");

		assertThat(his.path("memberNumber").asString())
				.as("this is not his record at all, so the profile below says nothing")
				.isEqualTo(LAPSED);
		assertThat(his.path("firstName").asString()).as("his given name")
				.isEqualTo(columnOf("first_name", LAPSED)).isEqualTo("Nenad");
		assertThat(his.path("lastName").asString()).as("his family name")
				.isEqualTo(columnOf("last_name", LAPSED)).isEqualTo("Ilic");
		assertThat(his.path("gender").asString()).as("his gender")
				.isEqualTo(columnOf("gender", LAPSED)).isEqualTo("F");
		assertThat(his.path("ageBand").asString())
				.as("his band, which a lapsed fee does not take from him: born in 1990 he is in the band"
						+ " every other row of the fixture is in, and the year a band is worked out from"
						+ " is read off his row and not off the fee")
				.isEqualTo("25-39");
		assertThat(his.path("birthdayShown").asString()).as("what he chose about his birthday")
				.isEqualTo("year");
		assertThat(his.path("firstSeason2027").asBoolean())
				.as("whether he runs in the beginners' category, which a lapsed fee does not take"
						+ " from him")
				.isTrue();
		assertThat(his.path("profileHidden").asBoolean())
				.as("he does not hide his page, and the answer must say it as a value of his own"
						+ " and not as the absence of one")
				.isFalse();
	}

	/**
	 * A TEXT THAT IS STILL WAITING FOR A MODERATOR IS NOT HIS BIOGRAPHY, and does not replace the
	 * one he has. The text twin of {@link #aPictureThatWaitsIsNotHisPortraitAndDoesNotReplaceTheOneHeHas}.
	 *
	 * <p>A member's biography is {@code competitor.bio} once a moderator has approved it, and until
	 * then the text sits in {@code verification} (ADL A60 makes only the first public). A query that
	 * read the queue's text, or took it when the member's own was empty, would answer HER words
	 * nobody has looked at and would answer HIM the wrong ones. <b>Both members have a text waiting
	 * here</b>, written by the fixture ({@link #giveTheCallerWhatNoOtherRowHas}): she has written nothing
	 * approved and so must be answered the empty text, and he has a biography and so must be answered
	 * that one.
	 */
	@Test
	void aBiographyThatWaitsIsNotHisBiographyAndDoesNotReplaceTheOneHeHas() throws Exception {
		JsonNode hers = answerFor(HER_ACCOUNT).path("member");
		JsonNode mine = answerFor(MY_ACCOUNT).path("member");

		assertThat(hers.path("memberNumber").asString())
				.as("this is not her record at all, so the empty text says nothing")
				.isEqualTo(ABROAD);
		assertThat(hers.path("bio").asString())
				.as("a text nobody has approved was answered as her biography")
				.isEmpty();
		assertThat(mine.path("bio").asString())
				.as("the text that waits replaced the biography a moderator approved")
				.isEqualTo(HIS_BIOGRAPHY);
	}

	/**
	 * THE ADDRESS OF HIS PORTRAIT REALLY REACHES THE ROUTE THAT SERVES A PICTURE.
	 *
	 * <p>{@code CompetitorApiTest} and {@code TeamApiTest} do the same for their copies of the
	 * string, and the reason is written there: a constant copied is only ever as good as what
	 * proves it equal. This hands the address back to the DISPATCHER, so a rename of
	 * {@code /api/photos/{name}} that left this copy behind is caught by the route and not by a
	 * comparison of two spellings. The HANDLER is asked for and not the status, because no file
	 * stands behind the row on this machine and a 404 says „no mapping" and „no file" in one number.
	 */
	@Test
	void thePortraitIsTheAddressOfHisOwnPicture() throws Exception {
		String address = answerFor(MY_ACCOUNT).path("member").path("photo").asString();

		assertThat(address)
				.as("the answer carries no portrait at all, so there is no address to walk")
				.isNotEmpty();
		assertThat(http.perform(get(address)).andReturn().getHandler())
				.as("the address answered (%s) is not one the portal maps to a picture, so it is a"
						+ " circle that will never draw", address)
				.isInstanceOfSatisfying(HandlerMethod.class,
						one -> assertThat(one.getBeanType()).isEqualTo(PhotoApi.class));
	}

	/**
	 * A PICTURE THAT IS STILL WAITING FOR A MODERATOR IS NOT HIS PORTRAIT, and does not replace
	 * the one he has.
	 *
	 * <p>It is the second source of the same value: a member's portrait is {@code competitor.photo_id}
	 * once a moderator has approved it, and until then the picture sits in {@code verification}
	 * (ADL A60 makes only the first public). A query that read the queue's column, or took the
	 * queue's when the member's own was empty, would answer HER a portrait nobody has looked at
	 * and would answer HIM the wrong one. <b>Both members have a picture waiting here</b>: she has
	 * no portrait and so must be answered none, and he has one and so must be answered that one.
	 */
	@Test
	void aPictureThatWaitsIsNotHisPortraitAndDoesNotReplaceTheOneHeHas() throws Exception {
		isHavingModerated(ABROAD, aPortrait("ef".repeat(32), "0.50000000", "0.50000000", "0.50000000"));
		isHavingModerated(ME, aPortrait("ba".repeat(32), "0.75000000", "0.75000000", "0.25000000"));

		JsonNode hers = answerFor(HER_ACCOUNT).path("member");
		JsonNode mine = answerFor(MY_ACCOUNT).path("member");

		assertThat(hers.path("memberNumber").asString())
				.as("this is not her record at all, so the missing portrait says nothing")
				.isEqualTo(ABROAD);
		assertThat(hers.has("photo")).as("a picture nobody has approved was answered as her portrait")
				.isFalse();
		assertThat(hers.has("crop")).as("and its square with it").isFalse();
		assertThat(mine.path("photo").asString())
				.as("the picture that waits replaced the portrait a moderator approved")
				.isEqualTo(A_PICTURE_IS_ASKED_FOR_AT + HIS_PORTRAIT);
		assertThat(new BigDecimal(mine.path("crop").path("x").asString())).isEqualByComparingTo("0.125");
	}

	/**
	 * ONLY HIS OWN DATE OF BIRTH LEAVES THIS DOOR, to him, and nobody else's, and no year of any
	 * row anywhere else in the answer.
	 *
	 * <p>Section 3 of the privacy policy: "Datum rodjenja se nikada ne prikazuje, ni u punom ni u
	 * skracenom obliku." {@link CompetitorApiTest#noYearOfBirthLeavesTheServer} holds it for the
	 * public list. THIS door answers a member his own date since 24.10.2026, as a LOCKED box on his own
	 * card (PDL, "clan ga vidi ali je disabled za menjanje. Moze samo da trazi od admina", and the
	 * owner's choice that the same holds for the gender, the father's name and the number of his
	 * document). That is the narrowing of the sentence above and not its end: the date is his, whole,
	 * under {@code birthDate}, and everything else in the answer is asked as it always was.
	 *
	 * <p><b>Asked of the answer as TEXT and not of a field name</b>, because a year is a year whatever
	 * it is called: with the one key that is allowed to carry it taken out, no year of any row (his
	 * own included) and no day of any row is anywhere in what is left. <b>And the value is his and
	 * not another row's</b>: the lapsed member's date is a third year, and the answer is asked for the
	 * caller's date exactly. The four whole numbers an answer legitimately carries are taken out
	 * first - the season he started in, the key of his team, the season he joined it and his count -
	 * because a key out of a {@code bigserial} that happens to read 1990 is a coincidence and not a
	 * leak, and a case that went red on it would be one nobody could fix.
	 */
	@Test
	void onlyHisOwnDateOfBirthLeavesHisOwnDoor() throws Exception {
		ObjectNode mine = (ObjectNode) answerFor(MY_ACCOUNT).path("member").deepCopy();

		assertThat(mine.path("memberNumber").asString())
				.as("this is not his record at all, so the text below says nothing about what is"
						+ " left out of it")
				.isEqualTo(ME);
		assertThat(mine.path("birthDate").asString())
				.as("his own date, spelt as the table spells it")
				.isEqualTo(HIS_DATE_OF_BIRTH);
		mine.remove("birthDate");
		for (String number : List.of("firstSeason", "teamId", "teamSince", "referredCount")) {
			assertThat(mine.has(number)).as("%s is a whole number he is answered", number).isTrue();
			mine.remove(number);
		}
		String text = mine.toString();

		List<String> years = db.sql("select distinct to_char(birth_date, 'YYYY') from competitor")
				.query(String.class).list();
		List<String> days = db.sql("select distinct to_char(birth_date, '-MM-DD') from competitor")
				.query(String.class).list();
		assertThat(years).as("the years were not read out of the database, so the loop asserts"
				+ " nothing").hasSize(3);
		assertThat(days).as("the days were not read out of the database").hasSize(3);

		for (String year : years) {
			assertThat(text).as("a year of birth (%s) left the server outside birthDate", year)
					.doesNotContain(year);
		}
		for (String day : days) {
			assertThat(text).as("a whole date of birth (%s) left the server outside birthDate", day)
					.doesNotContain(day);
		}
		assertThat(text).as("his own date, spelt as the table spells it")
				.doesNotContain(HIS_DATE_OF_BIRTH);
	}

	/**
	 * HIS FATHER'S NAME, HIS DATE OF BIRTH AND THE NUMBER OF HIS DOCUMENT ARE HIS OWN, off his own row
	 * and the one document that is his (PDL 24.10.2026, the locked boxes of his card).
	 *
	 * <p>Two members with three different values each, so a source that reads the first row, the
	 * caller of some other request or the wrong member's document is told from the right one. And a
	 * member with <b>no document at all</b> is answered no key, not an empty string and not a
	 * neighbour's number: {@code competitor_document} is optional.
	 */
	@Test
	void hisFatherHisDateAndHisDocumentAreHisOwn() throws Exception {
		JsonNode mine = answerFor(MY_ACCOUNT).path("member");

		assertThat(mine.path("fatherName").asString()).isEqualTo(columnOf("father_name", ME))
				.isEqualTo(HIS_FATHER);
		assertThat(mine.path("birthDate").asString()).isEqualTo(HIS_DATE_OF_BIRTH);
		assertThat(mine.path("idNumber").asString()).isEqualTo(HIS_DOCUMENT);

		JsonNode lapsed = answerFor(THE_LAPSED_ACCOUNT).path("member");

		assertThat(lapsed.path("fatherName").asString())
				.as("a member whose fee has lapsed is handed his own father's name")
				.isEqualTo(THE_LAPSED_MEMBERS_FATHER);
		assertThat(lapsed.path("birthDate").asString()).isEqualTo(THE_LAPSED_MEMBERS_DATE_OF_BIRTH);
		assertThat(lapsed.path("idNumber").asString()).isEqualTo(THE_LAPSED_MEMBERS_DOCUMENT);

		JsonNode noDocument = answerFor(HER_ACCOUNT).path("member");

		assertThat(noDocument.path("fatherName").asString()).isEqualTo("Otac");
		assertThat(noDocument.has("idNumber"))
				.as("a member with no document row was answered one (a neighbour's, an empty string or"
						+ " a null) instead of no key")
				.isFalse();
		assertThat(db.sql("select count(*) from competitor_document d join competitor c on"
						+ " c.id = d.competitor_id where c.member_number = ?")
				.param(ABROAD).query(Long.class).single())
				.as("the fixture gave her a document after all, so the absence above is not a fact")
				.isZero();
	}

	/**
	 * AND NO OTHER DOOR SERVES THEM TO HIM: not the public list, which is read here as the caller and
	 * as two other members and answers none of the three for anybody (it never carried any), and not
	 * the administration's read of a member's data, which is behind a right he does not hold and
	 * answers him as an address that is not there.
	 *
	 * <p>Asked of the whole text of each answer, for every value the caller and the lapsed member
	 * hold, so a field added to the list under another name is caught as the year is.
	 */
	@Test
	void noOtherDoorServesTheFatherTheDateOrTheDocument() throws Exception {
		for (String email : List.of(MY_ACCOUNT, THE_LAPSED_ACCOUNT, HER_ACCOUNT)) {
			String list = whatThePublicListSays(email);

			assertThat(list).as("the public list read as %s", email).isNotEmpty();
			for (String value : List.of(HIS_FATHER, HIS_DOCUMENT, THE_LAPSED_MEMBERS_FATHER,
					THE_LAPSED_MEMBERS_DOCUMENT, HIS_DATE_OF_BIRTH, THE_LAPSED_MEMBERS_DATE_OF_BIRTH)) {
				assertThat(list).as("%s left through the public list read as %s", value, email)
						.doesNotContain(value);
			}
		}

		http.perform(get("/api/members/" + ME + "/data")
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(MY_ACCOUNT).secret())))
				.andExpect(status().isNotFound());
	}

	/**
	 * THE SEASONS HE MAY SEND A RUN OF ARE ANSWERED OFF THE CLOCK, IN THE LEAGUE'S HOUR: NONE BEFORE THE
	 * LEAGUE, THE YEAR HE IS IN, AND ON NEW YEAR'S NIGHT UNTIL TEN THE YEAR JUST ENDED AS WELL.
	 *
	 * <p>PDL P9, owner, 19.10.2026, „Član prijavljuje samo rezultate aktuelne sezone" and „Pre 2027
	 * forma i predlozi ne nude ništa". The window's own edges are {@code SeasonClockTest}'s; what this
	 * holds is that the answer is read off the clock the route is handed, at the moment it is asked, and
	 * in the league's zone: the night the year turns is a year apart in UTC and in Belgrade, so an
	 * answer worked out in the server's zone names one season there.
	 */
	@Test
	void theSeasonsARunMayBeReportedForAreTheClocksInTheLeaguesHourForEveryAccount() throws Exception {
		Object[][] moments = {
				{AUTUMN_2026, List.of()},
				{DURING_2027, List.of(2027)},
				{NEW_YEARS_NIGHT_INTO_2028, List.of(2027, 2028)},
				{Instant.parse("2028-01-01T09:00:00Z"), List.of(2028)}};

		for (Object[] moment : moments) {
			clock.moveTo((Instant) moment[0]);

			/* ON THE ACCOUNT, for a member and for a moderator who races for nobody alike, since
			   20.10.2026: the moderator's screen „Unos rezultata za događaj” offered the same seasons
			   (owner, „NE NUDE SE STARIJI DOGAĐAJI VAN TEKUĆE SEZONE!"; it takes any year up to
			   today since 21.10.2026 and reads none). And NOT in `member` any more, so the answer
			   has one home for it. */
			for (String account : List.of(MY_ACCOUNT, RACES_FOR_NOBODY)) {
				JsonNode answer = answerFor(account);
				List<Integer> open = new ArrayList<>();

				answer.path("seasonsOpenForAReport").forEach(one -> open.add(one.asInt()));

				assertThat(answer.path("seasonsOpenForAReport").isArray()).as("%s at %s", account, moment[0])
						.isTrue();
				assertThat(open).as("%s at %s", account, moment[0]).isEqualTo(moment[1]);
				assertThat(answer.path("member").has("seasonsOpenForAReport"))
						.as("a second home for the seasons in the member's record").isFalse();
			}
		}
	}

	/**
	 * THE BAND MOVES WITH THE SEASON THAT IS RUNNING, ON THIS DOOR AS ON THE OTHER, and at no other
	 * moment.
	 *
	 * <p>The rulebook's bands are settled once, on 1 January of the season (PDL P7), and
	 * {@code /api/competitors} and this route both answer one. They ask the same function for the
	 * season ({@code SeasonClock.seasonTheBandIsWorkedOutFor}), and what holds them to it is this
	 * case, which asks BOTH doors about the very same member at four moments and requires the answers
	 * to be equal and to be the literal band the rulebook gives.
	 *
	 * <p><b>The three members are each one year short of a boundary at the start of 2027</b> (24, 39
	 * and 54), so a season too many moves every one of them, a season too few moves none of them
	 * back, and the year does not need to be known to see it. <b>The four moments are the four ways
	 * a door can read the season wrongly</b>: before the league has a season at all (the floor), in
	 * the middle of a season, in the autumn when next year's membership is on sale (the renewal
	 * screen's question is not this one), and on the night the year turns (the league's zone and not
	 * the server's). Each is a case the other three cannot tell from the right answer, which is why
	 * none of them is dropped.
	 *
	 * <p><b>Both preconditions are asked of the code and not remembered</b>: the zones still disagree
	 * on that night and the two seasons still disagree in that October. If either stops being true the
	 * moment measures nothing, and the case says so instead of passing.
	 */
	@Test
	void theBandMovesWithTheSeasonThatIsRunningAndIsTheSameOnBothDoors() throws Exception {
		bornOn(ME, "2003-06-01");
		bornOn(ABROAD, "1988-06-01");
		bornOn(LAPSED, "1973-06-01");

		assertThat(NEW_YEARS_NIGHT_INTO_2028.atZone(clock.getZone()).getYear())
				.as("the server's clock already reads this moment in the league's own year, so the"
						+ " answers below are the same whether a door re-reads the zone or not, and the"
						+ " zone is not measured")
				.isNotEqualTo(NEW_YEARS_NIGHT_INTO_2028.atZone(SeasonClock.ZONE).getYear());
		assertThat(SeasonClock.seasonBeingPaidFor(MID_OCTOBER_2027.atZone(SeasonClock.ZONE)))
				.as("the season being paid for and the season being run agree at this moment, so"
						+ " swapping one for the other cannot be seen")
				.isEqualTo(2028);

		/* when, then the band he is in at that moment: born 2003, born 1988, born 1973 (the lapsed one). */
		Object[][] moments = {
				{"autumn 2026, before the league has a season", AUTUMN_2026, "24-", "25-39", "40-54"},
				{"June 2027, the first season running", DURING_2027, "24-", "25-39", "40-54"},
				{"mid October 2027, with next year on sale", MID_OCTOBER_2027, "24-", "25-39", "40-54"},
				{"the night the year turns into 2028", NEW_YEARS_NIGHT_INTO_2028, "25-39", "40-54", "55+"},
		};

		for (Object[] moment : moments) {
			String when = (String) moment[0];

			clock.moveTo((Instant) moment[1]);

			String his = answerFor(MY_ACCOUNT).path("member").path("ageBand").asString();
			String hers = answerFor(HER_ACCOUNT).path("member").path("ageBand").asString();
			String theLapsed = answerFor(THE_LAPSED_ACCOUNT).path("member").path("ageBand").asString();

			assertThat(his).as("%s: the member born in 2003", when).isEqualTo(moment[2]);
			assertThat(hers).as("%s: the member born in 1988", when).isEqualTo(moment[3]);
			assertThat(theLapsed).as("%s: the member born in 1973, whose fee has lapsed", when)
					.isEqualTo(moment[4]);
			assertThat(rowOnThePublicList(MY_ACCOUNT, ME).path("ageBand").asString())
					.as("%s: the two doors name two bands for the member born in 2003", when)
					.isEqualTo(his);
			assertThat(rowOnThePublicList(HER_ACCOUNT, ABROAD).path("ageBand").asString())
					.as("%s: the two doors name two bands for the member born in 1988", when)
					.isEqualTo(hers);
		}
	}

	/**
	 * BUT NEVER FOR A SEASON THE LEAGUE DOES NOT HAVE.
	 *
	 * <p>The calendar through 2026 answers 2026 and there is no season 2026 (PDL P2), so a band
	 * worked out for it is a band for nothing. <b>The member is chosen so that the floor is the only
	 * thing between two answers</b>: born in 2002 he is 24 in 2026 and 25 in 2027, one on each side of a
	 * boundary, so a door without the floor does not name a different number, it names a different
	 * band. Without him the case above passes either way (its three members are in the same band in
	 * 2026 as in 2027), which is how a floor gets deleted in a tidy-up. The other door is asked as
	 * well, because the floor is the one thing the two could stop sharing.
	 */
	@Test
	void theBandIsNeverWorkedOutForASeasonTheLeagueDoesNotHave() throws Exception {
		bornOn(ME, "2002-06-01");

		assertThat(SeasonClock.FIRST_SEASON)
				.as("the league's first season moved, so the clock below no longer stands before it and"
						+ " this case measures nothing")
				.isGreaterThan(AUTUMN_2026.atZone(SeasonClock.ZONE).getYear());

		assertThat(answerFor(MY_ACCOUNT).path("member").path("ageBand").asString())
				.as("the band was worked out for the calendar year 2026, a season the league does not"
						+ " have, instead of for its first")
				.isEqualTo("25-39");
		assertThat(rowOnThePublicList(MY_ACCOUNT, ME).path("ageBand").asString())
				.as("the other door names another band for the same member")
				.isEqualTo("25-39");
	}

	/**
	 * THE TWO DOORS ANSWER THE SAME MEMBER THE SAME WAY, name by name.
	 *
	 * <p>{@link CompetitorApi} and this route both say a member's name, town, biography and
	 * portrait, and two homes for one fact are the shape that lets two answers disagree. The
	 * precedent on this class is to write each clause where it is read and to hold the twins
	 * together with a case rather than with a shared helper, and this is that case: it asks both
	 * doors about the same member, AS that member, and compares every name they share.
	 *
	 * <p><b>The names they share are worked out and not listed</b> - the components of the two
	 * records - and the ones that are NOT compared are four, each with a reason: his referral code
	 * and his count left the public list for good (PDL P26a, 25.09.2026), the basis is the
	 * administration's to read there and his own to read here ("Clan vidi SVOJ osnov clanstva;
	 * tudj ne vidi niko osim administracije", owner, 20.09.2026), and since 11.10.2026 the flag
	 * that says whether his fee stands, whose twin on the public list is the presence of the row
	 * itself (that list ends {@code where c.active}). A fifth fact on this record that the public
	 * one does not carry fails the first assertion; it has to be named here with its reason or
	 * given a twin.
	 *
	 * <p><b>Absent and null are one answer here</b> and the value is what is compared: the list
	 * says {@code null} where this route says nothing, by each one's own precedent.
	 */
	@Test
	void theTwoDoorsAnswerTheSameMemberFieldForField() throws Exception {
		Set<String> mine = Arrays.stream(MeApi.MyOwnRecord.class.getRecordComponents())
				.map(RecordComponent::getName).collect(Collectors.toSet());
		Set<String> theirs = Arrays.stream(CompetitorApi.Competitor.class.getRecordComponents())
				.map(RecordComponent::getName).collect(Collectors.toSet());
		Set<String> shared = mine.stream().filter(theirs::contains).collect(Collectors.toSet());

		assertThat(mine)
				.as("one of the names this case excuses is not on this record at all, so the"
						+ " excuse is for nothing")
				.containsAll(Set.of("referralCode", "referredCount", "membershipBasis",
						"membershipSeason", "active", "address", "phone", "bioWaiting", "shirtSize",
						"fatherName", "birthDate", "idNumber"));
		/* THE PUBLIC LIST CARRIES NONE OF THESE, and that is a decision and not a gap:
		   PDL „Uvek privatno: mejl, telefon i adresa", and the size of the shirt since 23.10.2026,
		   which section 3 of the privacy policy lists among what is never shown. Asked of the record's components so that a
		   field added to it tomorrow under either name is a red case on the day it is written. */
		assertThat(theirs)
				.as("the public list carries a member's postal address, telephone or words that"
						+ " wait, which are private (PDL) and are handed to him alone through this route")
				.doesNotContain("address", "phone", "bioWaiting", "shirtSize", "fatherName", "birthDate",
						"idNumber");
		/* `active` IS THE FOURTH, since 11.10.2026, AND ITS TWIN IS THE ROW ITSELF. The public
		   list is `where c.active`, so on it the fact is not a field but the presence of the
		   member (`frontend/src/data/types.ts`: "it is the PRESENCE OF THE ROW"), and a lapsed
		   member is absent from it by the owner's decision of 13.09.2026. There is nothing to
		   compare it with by name; what holds the two together is that both read one column. */
		assertThat(mine.stream().filter(name -> !theirs.contains(name)).collect(Collectors.toSet()))
				.as("a fact this record carries has no twin on the public list and is not one of the"
						+ " four named for it: give it a twin, or name it here with its reason")
				.containsExactlyInAnyOrder("referralCode", "referredCount", "active", "address",
						"phone", "bioWaiting", "shirtSize", "fatherName", "birthDate", "idNumber");
		shared.remove("membershipBasis");
		/* And the season beside it, which leaves with the basis and is withheld with it. */
		shared.remove("membershipSeason");

		assertThat(shared)
				.as("the two doors share almost nothing, so the comparison below is asked of a few"
						+ " names and says little")
				.contains("firstName", "lastName", "gender", "city", "ageBand", "firstSeason2027", "teamSince",
						"bio", "profileHidden", "birthdayShown", "photo", "crop", "memberNumber",
						"country", "firstSeason", "teamId");

		for (String[] who : new String[][] {{MY_ACCOUNT, ME}, {HER_ACCOUNT, ABROAD}}) {
			JsonNode here = answerFor(who[0]).path("member");
			JsonNode there = rowOnThePublicList(who[0], who[1]);

			for (String name : shared) {
				assertThat(valueOf(here.path(name)))
						.as("%s is answered one way by /api/me and another by /api/competitors for"
								+ " the very same member (%s)", name, who[1])
						.isEqualTo(valueOf(there.path(name)));
			}
		}
	}

	/** An answer's value, with „absent" and „null" being one: the two doors spell it differently. */
	private static String valueOf(JsonNode node) {
		return node.isMissingNode() || node.isNull() ? "null" : node.toString();
	}

	/** When he was born, which is the one datum a band is worked out from and no answer carries. */
	private void bornOn(String memberNumber, String date) {
		db.sql("update competitor set birth_date = date '" + date + "' where member_number = ?")
				.param(memberNumber).update();
	}

	/** The basis of his membership of the season on sale, off the one home it has since V62. */
	private String basisOf(String memberNumber) {
		return db.sql("select m.basis from membership m join competitor c on c.id = m.competitor_id"
						+ " where m.season = ? and c.member_number = ?")
				.params(THE_SEASON_ON_SALE, memberNumber).query(String.class).optional().orElse(null);
	}

	private String columnOf(String column, String memberNumber) {
		return db.sql("select " + column + "::text from competitor where member_number = ?")
				.param(memberNumber).query(String.class).single();
	}

	/** The name of the town: the codebook's when the town came from it, the typed one otherwise. */
	private String townOf(String memberNumber) {
		return db.sql("select coalesce(p.name, c.city) from competitor c"
						+ " left join place p on p.id = c.place_id where c.member_number = ?")
				.param(memberNumber).query(String.class).single();
	}

	private int seasonThatMembershipBeganIn(String memberNumber) {
		return db.sql("select season_from from team_membership where season_to is null"
						+ " and competitor_id = ?")
				.param(competitorIdOf(memberNumber)).query(Integer.class).single();
	}

	private String whole(String email) throws Exception {
		return http.perform(asking(email)).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	private JsonNode answerFor(String email) throws Exception {
		return new ObjectMapper().readTree(whole(email));
	}

	/** What {@code /api/competitors} answers THIS caller, cookie and all. */
	private String whatThePublicListSays(String email) throws Exception {
		return http.perform(get("/api/competitors")
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	private JsonNode rowOnThePublicList(String email, String memberNumber) throws Exception {
		for (JsonNode one : new ObjectMapper().readTree(whatThePublicListSays(email))) {
			if (memberNumber.equals(one.path("memberNumber").asString())) {
				return one;
			}
		}
		throw new AssertionError("the public list does not carry " + memberNumber + " at all, so"
				+ " the two doors cannot be compared on him");
	}

	private MockHttpServletRequestBuilder asking(String email) {
		return get(PATH).cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private long competitorIdOf(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	private long theOneWithNoNumber() {
		return db.sql("select id from competitor where member_number is null")
				.query(Long.class).single();
	}

	private String referralCodeOf(String memberNumber) {
		return db.sql("select referral_code from competitor where member_number = ?")
				.param(memberNumber).query(String.class).single();
	}

	/** How many competitors the given condition holds for, with the caller's key as {@code ?}. */
	private int howMany(String condition, long me) {
		return db.sql("select count(*) from competitor where " + condition).param(me)
				.query(Integer.class).single();
	}

	/**
	 * The same, for a condition that names no key. {@code howMany("true")} is how many rows
	 * this fixture wrote, asked of the table rather than counted in a comment.
	 */
	private int howMany(String condition) {
		return db.sql("select count(*) from competitor where " + condition)
				.query(Integer.class).single();
	}

	private long accountIdOf(String email) {
		return db.sql("select id from account where email = ?").param(email)
				.query(Long.class).single();
	}

	private long teamIdOf(String slug) {
		return db.sql("select id from team where slug = ?").param(slug).query(Long.class).single();
	}

	/** The key of the member who brought somebody in, as a fragment the insert can carry. */
	private static String broughtBy(String memberNumber) {
		return "(select id from competitor where member_number = '" + memberNumber + "')";
	}

	/**
	 * @param number null for somebody who has registered and has no number yet (A44)
	 * @param basis  the basis of his membership of THE SEASON ON SALE, which since V62 is a
	 *               {@code membership} row of that season and nothing on {@code competitor}; null
	 *               for somebody who holds no row for it, which is the member whose fee has lapsed
	 *               and the one who never paid
	 */
	private void competitor(String number, String first, String last, String place, String city,
			String country, int firstSeason, boolean firstSeason2027, String basis,
			String broughtBy) {
		long id = db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, city, country_id, first_season, first_season_2027,"
						+ " active, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'M', date '1990-01-01', " + place + ", " + city + ", "
						+ country + ", ?, ?, ?, ?, " + broughtBy + ", '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				/* ACTIVE FOLLOWS THE NUMBER, and is worked out here rather than passed in because
				   the portal does not let the two be chosen separately: `PaymentApi` is the only
				   writer of `active = true` and it either draws the number in the same statement
				   or is renewing somebody who already has one, and `RegistrationApi` writes
				   `active = false` with no number at all. So a row with no number is never
				   active, and the one whose fee has LAPSED is the second state the portal really
				   does write - a number, and not active. Both halves are measured by
				   `everyRowHereIsAStateThePortalCanWrite` rather than promised by this comment. */
				.params(number, first, last, firstSeason, firstSeason2027,
						number != null && !LAPSED.equals(number),
						String.format("%016x", ++issued))
				.query(Long.class).single();

		if (basis != null) {
			HeldOn.season(db, id, THE_SEASON_ON_SALE, basis);
		}
	}

	/**
	 * What {@code SeasonClock.seasonBeingPaidFor} answers at {@link #AUTUMN_2026}: the calendar says
	 * 2026, which the league does not have, so it is the first season.
	 */
	private static final int THE_SEASON_ON_SALE = 2027;

	/**
	 * THE CALLER, WRITTEN AS THE ONE ROW OF HIS KIND IN EVERY FIELD THE PROFILE ADDED (see the
	 * note on the class), over the row {@link #competitor} wrote: the only woman, the only one
	 * who hides his profile and the only one who shows the whole of his birthday, with a
	 * biography, a portrait with its square, and a date of birth no other row shares.
	 *
	 * <p>He hides his profile ON PURPOSE, and it is not decoration: the page of a member who
	 * hides it is exactly the one {@link CompetitorApi} withholds a biography, a portrait and a
	 * team from, so a member who is answered all three of his own is answered them ALONE of
	 * every row here. {@link #aMemberWhoseFeeHasLapsedAndHidesHisProfileIsHandedAllOfIt} asks the
	 * same of the member who also has no fee standing.
	 */
	private void giveTheCallerWhatNoOtherRowHas() {
		long portrait = aPortrait(HIS_PORTRAIT, "0.12500000", "0.25000000", "0.50000000");

		db.sql("update competitor set gender = 'F', bio = ?, profile_hidden = true,"
						+ " birthday_shown = 'full', birth_date = date '" + HIS_DATE_OF_BIRTH + "',"
						+ " photo_id = ?, address = ?, phone = ?, shirt_size = 'XXXL', father_name = ?"
						+ " where member_number = ?")
				.params(HIS_BIOGRAPHY, portrait, HIS_ADDRESS, HIS_TELEPHONE, HIS_FATHER, ME).update();
		hasADocument(ME, HIS_DOCUMENT);

		/* AND THE LAPSED MEMBER'S OWN THREE, so a source that reads the wrong row gives a value that
		   is somebody's and not the caller's: the sweep of `andNothingOfAnybodyElses` asks that no
		   other row is answered the caller's value, and this keeps the two apart on all three. */
		db.sql("update competitor set father_name = ?, birth_date = date '"
						+ THE_LAPSED_MEMBERS_DATE_OF_BIRTH + "' where member_number = ?")
				.params(THE_LAPSED_MEMBERS_FATHER, LAPSED).update();
		hasADocument(LAPSED, THE_LAPSED_MEMBERS_DOCUMENT);

		/* HIS WORDS THAT WAIT, and another member's beside them (PDL P11, 18.10.2026). Written by the
		   statement `MeWriteApi` queues a text with, so the fixture is the state the portal writes. */
		isWaitingWithText(ME, HIS_WAITING_WORDS);
		isWaitingWithText(ABROAD, ANOTHERS_WAITING_WORDS);
	}

	/**
	 * A picture SENT AND NOT YET DECIDED, which is the only state a picture in the queue can be
	 * in: V9's {@code verification_decided_keeps_no_photo} refuses a decided row that still holds
	 * one. The queue is {@code profiles} and the subject is the member's own name, which is what
	 * {@code MePhotoApi} writes when a member really sends one.
	 */
	private void isHavingModerated(String memberNumber, long photo) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, state)"
						+ " select 'profiles', c.id, c.first_name || ' ' || c.last_name, '', ?,"
						+ " 'waiting' from competitor c where c.member_number = ?")
				.params(photo, memberNumber).update();
	}

	/**
	 * A text SENT AND NOT YET DECIDED: the same queue and the same subject as the picture above,
	 * with the words in {@code body} and no picture, which is what {@code MeWriteApi} writes when a
	 * member really sends one (V53 allows one such text per member at a time).
	 */
	private void isWaitingWithText(String memberNumber, String text) {
		db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " select 'profiles', c.id, c.first_name || ' ' || c.last_name, ?"
						+ " from competitor c where c.member_number = ?")
				.params(text, memberNumber).update();
	}

	/** The number of a member's identity document, in the table of its own (ADL A12). */
	private void hasADocument(String memberNumber, String number) {
		db.sql("insert into competitor_document (competitor_id, document_number)"
						+ " select c.id, ? from competitor c where c.member_number = ?")
				.params(number, memberNumber).update();
	}

	/** A picture a moderator has APPROVED is a {@code photo} row; the member's column names it. */
	private long aPortrait(String digest, String x, String y, String size) {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/png', 1024, ?, ?, ?, ?) returning id")
				.params(digest, new BigDecimal(x), new BigDecimal(y), new BigDecimal(size))
				.query(Long.class).single();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?))")
				.params(email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** The link V23 wrote down: this account IS that member. */
	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}

	/** The same link, to the one row that cannot be named by a number because it has none. */
	private void belongsToTheOneWithNoNumber(String email) {
		db.sql("update account set competitor_id = (select id from competitor"
				+ " where member_number is null) where email = ?").param(email).update();
	}

	private void team(String slug, String name, String adminNumber) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, first_season,"
						+ " admin_id) values (?, ?, '', '',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " (select id from competitor where member_number = ?))")
				.params(slug, name, adminNumber).update();
	}

	/** Named by KEY rather than by member number, because one of the six members has none. */
	private void membership(long competitor, String slug, int from, String to, String leftReason) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to,"
						+ " left_reason) values (?, (select id from team where slug = ?), ?, "
						+ to + ", " + leftReason + ")")
				.params(competitor, slug, from).update();
	}

	/**
	 * A CLOCK THE CASE MOVES, standing in for the server's own: copied in shape from
	 * {@code CompetitorApiTest}, including the reason it reports UTC. Whoever asks what season it is
	 * has to re-read the instant in the league's own time, and a door that reads this zone instead
	 * answers 2027 on a night that is already 2028 in Belgrade.
	 */
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

	/** And it stands in for the server's own clock, which is the point of that bean. */
	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(AUTUMN_2026);
		}

	}
}
