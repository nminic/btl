package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * GET /api/me: WHO IS ASKING, AND THE CALLER'S OWN RECORD.
 *
 * <p><b>Six people and never two, and none of them is the first row of anything.</b>
 * Every field this route answers with is a field some OTHER row in this fixture also
 * carries a value for, and no two of them carry the same one. So „his own record" and
 * „the first record", „his own record" and „the record of whoever signed in first", and
 * „his own record" and „any record at all" are six different places rather than one, and
 * a query that reached the wrong one is caught by the value rather than by its absence.
 *
 * <p><b>The caller is deliberately not the first competitor and not the first account.</b>
 * {@link #ME} is the third row written to {@code competitor} and the first written to
 * {@code account}, so the two keys that a wrong query could confuse - his member's id and
 * his account's id - are different numbers. That they really are different is not assumed:
 * {@link #theTwoKeysThatCouldBeConfusedAreDifferentNumbers} reads both out of the database
 * and says so, because every case below rests on it.
 *
 * <p><b>AND EVERY ABSENCE SITS ON ITS OWN ROW, which is what the fixture before this one
 * got wrong.</b> One row had no member number AND no team, so „he has no number" and „he
 * is in no team" were one fact in two sentences and either clause could be tied to the
 * other with the suite staying green. They are two rows now: {@link #ABROAD} has a number
 * and no team, {@link #NOT_A_MEMBER_YET} has a team and no number.
 *
 * <p><b>AND THREE PEOPLE WERE BROUGHT IN BY THE CALLER AND A FOURTH BY SOMEBODY ELSE,
 * because a count is the one field here that is not read off a row.</b> Two of the
 * caller's three are active and one is not, so „whom he brought" and „whom he brought
 * whose fee stands" are different numbers; and somebody else's recruit makes „whom he
 * brought" different from „whoever was brought by anybody". The count is 2, and each of
 * the four queries that could have answered it by accident gives 1, 3, 3 or 5.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MeApiTest {

	private static final String PATH = "/api/me";

	/**
	 * THE CALLER. Third competitor written, first account written, so neither „the first
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
	 */
	private static final String LAPSED = "000031";

	/**
	 * AND ONE WHO HAS REGISTERED AND HAS NO NUMBER YET. ADL A44, owner 11.09.2026: „Osoba
	 * je `competitor` od registracije, a clan postaje kad dobije broj." <b>He IS in a
	 * team</b>, which is the other half of the pair of absences: having no number and being
	 * in no team are two facts and they sit on two rows.
	 */
	private static final String NOT_A_MEMBER_YET = null;

	/**
	 * AND ONE THE CALLER DID NOT BRING IN, brought by {@link #ABROAD} instead. Without him
	 * „the members the caller brought in" and „the members anybody brought in" are the same
	 * set, and a count over the second would answer the first correctly by accident.
	 */
	private static final String BROUGHT_BY_ANOTHER = "000077";

	/**
	 * AND THE SECOND ONE THE CALLER BROUGHT IN WHOSE FEE STANDS, so his count is 2 rather
	 * than 1. One is the answer to too many other questions in this fixture - how many teams
	 * he is in now, how many rows have no member number, how many rows are himself - to be
	 * worth asserting.
	 */
	private static final String ALSO_BROUGHT_BY_ME = "000063";

	private static final String MY_ACCOUNT = "ja@primer.rs";

	private static final String HER_ACCOUNT = "ona@primer.rs";

	private static final String THE_LAPSED_ACCOUNT = "nenad@primer.rs";

	private static final String THE_ACCOUNT_WITH_NO_NUMBER = "tek.stigao@primer.rs";

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

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/**
	 * SIX COMPETITORS, FIVE ACCOUNTS, THREE TEAMS AND SIX COUNTRIES.
	 *
	 * <p>Written so that no value this route answers with is shared by two rows: six
	 * different first seasons, six different member numbers (one of them none at all), six
	 * countries reached by the two different roads V7 allows, and three teams of which the
	 * caller is in the one he moved TO rather than the one he came from.
	 *
	 * <p>Two of the six have no account and are never the caller. They are here to be
	 * COUNTED and to be reachable by a wrong query, which is a job a row does without ever
	 * signing in.
	 */
	@BeforeEach
	void sixCompetitorsAndFiveAccounts() {
		/* Not the caller, and written first so that „the first row" is somebody else. Her
		   town was TYPED and names its own country, which is the second of the two roads V7
		   leaves open; the caller rides the first. */
		competitor(ABROAD, "Strahinja", "Vukicevic", "null", "'Podgorica'",
				"(select id from country where code = 'ME')", 2019, false, "payment", "null");
		/* Brought in by HER and not by the caller, and active, so „brought in by the caller"
		   and „brought in by anybody" are two different counts. Written second, before the
		   caller exists, which is the whole reason the order of this method is what it is. */
		competitor(BROUGHT_BY_ANOTHER, "Jovana", "Popovic", "null", "'Sarajevo'",
				"(select id from country where code = 'BA')", 2024, false, "payment",
				broughtBy(ABROAD));
		/* THE CALLER, third. Freed of the fee, which is the other half of the basis: the
		   case about the basis asks his answer and a payer's, so „his own and not the other
		   word" is said of both states and not of one. */
		competitor(ME, "Milica", "Djurisic", A_SERBIAN_TOWN, "null",
				"null", 2014, false, "feeExempt", "null");
		/* Registered, no number (A44), brought in by the caller, and IN A TEAM - which is
		   what keeps „he has no number" from resting on the same row as „he is in no team". */
		competitor(NOT_A_MEMBER_YET, "Tek", "Stigao", "null", "'Skoplje'",
				"(select id from country where code = 'MK')", 2027, true, "payment",
				broughtBy(ME));
		/* The caller's second recruit whose fee stands, so his count is 2. */
		competitor(ALSO_BROUGHT_BY_ME, "Dusan", "Maric", "null", "'Tirana'",
				"(select id from country where code = 'AL')", 2022, false, "payment",
				broughtBy(ME));
		/* And his third, the one whose fee has LAPSED. He is what makes „whose fee stands"
		   a clause that can be removed and measured: without the clause the caller's count
		   is 3 rather than 2. */
		competitor(LAPSED, "Nenad", "Ilic", "(select id from place where rank = 1)", "null",
				"null", 2015, false, "payment", broughtBy(ME));

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

		/* THE CALLER'S ACCOUNT IS THE FIRST ONE, while his member is the third row of
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
		account(RACES_FOR_NOBODY, "moderator");
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
	 * A MEMBER IS HANDED HIS OWN RECORD.
	 *
	 * <p>The four fields Article 73 makes public at once and each compared with what the
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
	 * <p><b>BOTH STATES ARE ASKED AND THE SCHEMA SAYS THERE ARE TWO</b>, which is the floor
	 * this case stands on rather than a sentence about it: the words are read out of
	 * {@code competitor_membership_basis_known} itself, so a third basis added tomorrow turns
	 * this case red and asks for a third caller instead of being quietly unmeasured.
	 *
	 * <p><b>And the caller is the ONLY row freed of the fee</b>, which is what makes
	 * „feeExempt" his own value: a route that answered off any other row in this fixture -
	 * the first, the last, the one that signed in first - answers „payment" and fails here.
	 * The lapsed member's „payment" is a word five rows carry, so what separates HIS answer
	 * from theirs is the number asserted beside it and not the word.
	 */
	@Test
	void aMemberIsHandedHisOwnBasisAndTheOtherWordIsNotIt() throws Exception {
		String rule = db.sql("select pg_get_constraintdef(oid) from pg_constraint"
						+ " where conname = ?").param("competitor_membership_basis_known")
				.query(String.class).single();
		List<String> everyBasis = Pattern.compile("'([a-zA-Z]+)'").matcher(rule).results()
				.map(one -> one.group(1)).toList();
		assertThat(everyBasis).as("the schema knows a basis this case never asks anybody about,"
				+ " so one of the two answers below is unmeasured; the rule it read was: %s", rule)
				.containsExactlyInAnyOrder("feeExempt", "payment");

		assertThat(db.sql("select count(*) from competitor where membership_basis = 'feeExempt'")
				.query(Integer.class).single())
				.as("more than one row here is freed of the fee, so that word coming back would"
						+ " not say the answer was read off HIS row").isEqualTo(1);

		JsonNode mine = answerFor(MY_ACCOUNT).path("member");
		assertThat(mine.path("memberNumber").asString())
				.as("this is not his record at all, so the basis below says nothing").isEqualTo(ME);
		assertThat(mine.path("membershipBasis").asString())
				.as("the caller is freed of the fee and the portal did not tell him so, which is"
						+ " the whole of the owner's reason: he cannot understand why no payment is"
						+ " being asked of him").isEqualTo("feeExempt");

		JsonNode his = answerFor(THE_LAPSED_ACCOUNT).path("member");
		assertThat(his.path("memberNumber").asString())
				.as("this is not his record at all, so the basis below says nothing")
				.isEqualTo(LAPSED);
		assertThat(his.path("membershipBasis").asString())
				.as("a member who pays was answered the other word, so only one of the two states"
						+ " the schema knows is really served").isEqualTo("payment");
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
		assertThat(everybodyElses).as("no other code was read out of the database, so the loop"
				+ " below asserts nothing").hasSize(5);

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
	 * AND THE OTHER DOOR STILL ANSWERS THE SAME TWO FACTS, WHICH IS THE PRICE OF TWO HOMES.
	 *
	 * <p>{@link CompetitorApi} has handed the caller his own {@code referralCode} and
	 * {@code referredCount} since 20.09.2026, on his own row and nobody else's, and this
	 * route now hands him both as well - because that one ends {@code where c.active} and
	 * therefore cannot hand them to the member whose fee has lapsed, who is exactly the
	 * member who needs his link. <b>Two homes for one fact is the shape that lets two
	 * answers disagree</b>, and until the owner decides which door keeps it, this is what
	 * stops them: the same member, both doors, one request apart.
	 *
	 * <p>Asked of a member whose fee IS standing, because he is the only kind of member both
	 * doors can answer at all.
	 */
	@Test
	void theOtherDoorStillAnswersTheSameTwoFacts() throws Exception {
		JsonNode mine = answerFor(MY_ACCOUNT).path("member");
		JsonNode onTheList = rowOnThePublicList(MY_ACCOUNT, ME);

		assertThat(mine.path("referralCode").asString())
				.as("this door answered no code at all, so the comparison below is empty against"
						+ " empty").isEqualTo(referralCodeOf(ME));
		assertThat(onTheList.path("referralCode").asString())
				.as("the two doors hand the same member two different links, and the one nobody"
						+ " remembers to change is always the second")
				.isEqualTo(mine.path("referralCode").asString());
		assertThat(onTheList.path("referredCount").asInt())
				.as("the two doors hand the same member two different counts of whom he brought"
						+ " in, so one of the two counting clauses has moved")
				.isEqualTo(mine.path("referredCount").asInt());
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
	 * AND NOTHING OF ANYBODY ELSE'S.
	 *
	 * <p>Asked of the whole answer as text, because the fields are the ones above and a
	 * wrong row fills every one of them with something that looks right. What is looked for
	 * is the OTHER members' own values: another number, another season and another country.
	 * A resource answering the first row, or the row of whoever signed in first, or every
	 * row, fails here on the value.
	 *
	 * <p><b>WHICH OF THEM IS ASKED OF THE TEXT AND WHICH OF THE FIELD IS ITSELF MEASURED,
	 * and the line between them is whether a bare number can collide.</b> A member number is
	 * six digits with leading zeroes and cannot be anything else in this answer, so it is
	 * looked for in the text and would catch a second record leaking under any name at all.
	 * A season and a team key are bare whole numbers sitting beside {@code "account":N},
	 * whose {@code bigserial} climbs through the whole suite because a sequence does not roll
	 * back: {@code "account":2027} is a matter of time, not of code, and a case that went red
	 * on it would be a case nobody could fix. Those two are compared on the field.
	 */
	@Test
	void andNothingOfAnybodyElses() throws Exception {
		JsonNode mine = answerFor(MY_ACCOUNT).path("member");

		assertThat(whole(MY_ACCOUNT)).as("his own record is not in the answer at all, so what"
				+ " follows says nothing about what is left out").contains(ME);

		assertThat(whole(MY_ACCOUNT)).as("another member's number left with his")
				.doesNotContain(ABROAD, LAPSED, BROUGHT_BY_ANOTHER, ALSO_BROUGHT_BY_ME);
		assertThat(mine.path("firstSeason").asInt())
				.as("the season another member started in was answered as his")
				.isNotIn(2015, 2019, 2022, 2024, 2027);
		assertThat(mine.path("country").asString())
				.as("the country another member lives in was answered as his")
				.isNotIn("ME", "CN", "MK", "BA", "AL");
		assertThat(mine.path("teamId").asLong())
				.as("the team of one of the OTHER members in a team was answered as his")
				.isNotIn(teamIdOf("probni-tim"), teamIdOf("treci-tim"));
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
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsStillHandedHisOwnRecord() throws Exception {
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

	/** @param number null for somebody who has registered and has no number yet (A44) */
	private void competitor(String number, String first, String last, String place, String city,
			String country, int firstSeason, boolean firstSeason2027, String basis,
			String broughtBy) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01', " + place + ", " + city + ", "
						+ country + ", ?, ?, ?, ?, ?, " + broughtBy + ", '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				/* ACTIVE FOR EVERYBODY BUT THE ONE WHOSE FEE HAS LAPSED, and worked out from the
				   number rather than passed in: he is the only row this fixture wants inactive
				   and the two facts move together. */
				.params(number, first, last, firstSeason, firstSeason2027,
						!LAPSED.equals(number), basis, String.format("%016x", ++issued))
				.update();
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
}
