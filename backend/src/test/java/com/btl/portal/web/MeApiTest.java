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
 * <p><b>Five people and never two, and none of them is the first row of anything.</b>
 * Every field this route answers with is a field some OTHER row in this fixture also
 * carries a value for, and no two of them carry the same one. So „his own record" and
 * „the first record", „his own record" and „the record of whoever signed in first", and
 * „his own record" and „any record at all" are five different places rather than one, and
 * a query that reached the wrong one is caught by the value rather than by its absence.
 *
 * <p><b>The caller is deliberately not the first competitor and not the first account.</b>
 * {@link #ME} is the third row written to {@code competitor} and the first written to
 * {@code account}, so the two keys that a wrong query could confuse - his member's id and
 * his account's id - are different numbers. That they really are different is not assumed:
 * {@link #theTwoKeysThatCouldBeConfusedAreDifferentNumbers} reads both out of the database
 * and says so, because every case below rests on it.
 *
 * <p><b>Two fields the member's own screen reads are NOT answered here, and both
 * omissions are measured rather than described.</b> The basis a membership is held on is
 * refused by PDL P8 and the referral code has a home already; the two cases at the end of
 * this class ask the whole answer as TEXT, which is what a name-by-name check cannot do:
 * a field withheld under one name and served under another looks the same to a name.
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
	 * codebook, and the one who brought another member in.
	 */
	private static final String ME = "000012";

	/** Another member, so every field of the caller's has a neighbour that differs. */
	private static final String ABROAD = "000045";

	/**
	 * AND ONE WHOSE FEE HAS LAPSED, which is the axis {@link CompetitorApi} cannot answer
	 * on: he is off its list entirely (owner, 13.09.2026), so the screens of the very
	 * member who has to renew have nothing to read. He pays rather than being freed, which
	 * is the second state of the basis, and he is the one this route must still answer.
	 */
	private static final String LAPSED = "000031";

	/**
	 * AND ONE WHO HAS REGISTERED AND HAS NO NUMBER YET. ADL A44, owner 11.09.2026: „Osoba
	 * je `competitor` od registracije, a clan postaje kad dobije broj." He is in no team
	 * either, so one case can separate two absences only by naming both.
	 */
	private static final String NOT_A_MEMBER_YET = null;

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
	 * FOUR COMPETITORS, FIVE ACCOUNTS, TWO TEAMS AND TWO COUNTRIES.
	 *
	 * <p>Written so that no value this route answers with is shared by two rows: four
	 * different first seasons, four different member numbers (one of them none at all),
	 * two countries reached by the two different roads V7 allows, and two teams of which
	 * the caller is in the one he moved TO rather than the one he came from.
	 */
	@BeforeEach
	void fourCompetitorsAndFiveAccounts() {
		/* Not the caller, and written first so that „the first row" is somebody else. His
		   country is reached through the codebook, like the caller's, because the road is
		   not what separates these two - the country itself is. */
		competitor(LAPSED, "Nenad", "Ilic", "(select id from place where rank = 1)", "null",
				"null", 2015, false, "payment", "null");
		/* Abroad, and reached by the OTHER road V7 allows: a typed town naming its own
		   country. Exactly one of the two roads is open on any row, so the order inside the
		   `coalesce` changes no answer at all - what this row measures is that the second
		   road is read AT ALL, which is a case and not a comment. */
		competitor(ABROAD, "Strahinja", "Vukicevic", "null", "'Podgorica'",
				"(select id from country where code = 'ME')", 2027, true, "payment", "null");
		/* THE CALLER, third. Freed of the fee, which is the other half of the basis: the
		   two cases about the basis ask his answer and a payer's, so „the word never leaves"
		   is said of both states and not of one. */
		competitor(ME, "Milica", "Djurisic", A_SERBIAN_TOWN, "null",
				"null", 2014, false, "feeExempt", "null");
		/* Registered, no number, no team (A44). Brought in by the caller, which is the
		   second thing this fixture separates: the caller HAS brought somebody in, so a
		   route answering a referral count would have something to answer, and the case
		   that says it does not is measuring a decision rather than an empty database. */
		competitor(NOT_A_MEMBER_YET, "Tek", "Stigao", "(select id from place where rank = 2)",
				"null", "null", 2027, true, "payment",
				"(select id from competitor where member_number = '" + ME + "')");

		team("probni-tim", "Probni tim", LAPSED);
		team("drugi-tim", "Drugi tim", ABROAD);

		/* The caller LEFT the first team and is in the second, so a join that forgot
		   `season_to is null` has two rows to choose from and one of them is wrong. */
		membership(ME, "probni-tim", 2027, "2027", "'Presao u drugi tim'");
		membership(ME, "drugi-tim", 2028, "null", "null");
		/* And the member whose fee has lapsed is in the team the caller left, so „his team"
		   and „the caller's team" are different teams as well as different rows. */
		membership(LAPSED, "probni-tim", 2027, "null", "null");

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
	 * <p>All four fields at once and each compared with what the database has for HIM,
	 * never with a value typed here twice: the member number, the country his town is in,
	 * the season he started in and the team he is in now. Every one of them is a value no
	 * other row in this fixture carries, so a query that answered off somebody else's row
	 * is wrong in the value rather than merely in the count.
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
	 * AND A MEMBER WHOSE TOWN WAS TYPED IS HANDED ITS COUNTRY TOO.
	 *
	 * <p>V7 leaves exactly two roads to a country open and closes the other two
	 * ({@code competitor_town_is_from_the_codebook_or_typed}, {@code competitor_typed_town_names_its_country}):
	 * a town out of the codebook carries its own country, and a town somebody typed names
	 * one beside it. The case above rides the first road. <b>Without this one the second is
	 * live code nothing measures</b> - and the coverage figure cannot say so, because the
	 * choice between them is made in SQL, where a Java branch counter sees nothing at all.
	 *
	 * <p>The member here lives abroad, so this also says the country is HIS and not the one
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
	 * AND NOTHING OF ANYBODY ELSE'S.
	 *
	 * <p>Asked of the whole answer as text, because the fields are the four above and a
	 * wrong row fills every one of them with something that looks right. What is looked for
	 * is the OTHER members' own values: another number, another season and another country.
	 * A resource answering the first row, or the row of whoever signed in first, or every
	 * row, fails here on the value.
	 *
	 * <p><b>WHICH OF THE FOUR IS ASKED OF THE TEXT AND WHICH OF THE FIELD IS ITSELF
	 * MEASURED, and the line between them is whether a bare number can collide.</b> A member
	 * number is six digits with leading zeroes and cannot be anything else in this answer, so
	 * it is looked for in the text and would catch a second record leaking under any name at
	 * all. A season and a team key are bare whole numbers sitting beside {@code "account":N},
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
				.doesNotContain(ABROAD, LAPSED);
		assertThat(mine.path("firstSeason").asInt())
				.as("the season another member started in was answered as his")
				.isNotIn(2015, 2027);
		assertThat(mine.path("country").asString())
				.as("the country another member lives in was answered as his").isNotEqualTo("ME");
		assertThat(mine.path("teamId").asLong())
				.as("the team of the OTHER member in a team was answered as his")
				.isNotEqualTo(teamIdOf("probni-tim"));
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
	 * is THERE - he is a competitor and the portal knows his town and his season - and the
	 * number inside it is not. Both halves are asked, because a resource that answered him
	 * the way it answers a moderator would pass on the second half alone.
	 *
	 * <p>He is in no team either, so this is also the second state of {@code teamId}, and
	 * the two absences are named separately rather than as „the record is small".
	 */
	@Test
	void aPersonWithNoNumberYetIsStillACompetitor() throws Exception {
		JsonNode answer = answerFor(THE_ACCOUNT_WITH_NO_NUMBER);

		assertThat(answer.has("member"))
				.as("a registered person was answered as though he raced for nobody, which is the"
						+ " moderator's answer and not his").isTrue();
		assertThat(answer.path("member").path("firstSeason").asInt())
				.as("his record came back empty, so the two absences below say nothing").isEqualTo(2027);
		assertThat(answer.path("member").has("memberNumber"))
				.as("a number was answered for somebody who has none").isFalse();
		assertThat(answer.path("member").has("teamId"))
				.as("a team was answered for somebody in none").isFalse();
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
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsStillHandedHisOwnRecord() throws Exception {
		assertThat(http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8))
				.as("the public list carries him after all, so this route is not the only door"
						+ " and this case is measuring nothing")
				.doesNotContain(LAPSED);

		assertThat(answerFor(THE_LAPSED_ACCOUNT).path("member").path("memberNumber").asString())
				.as("the one member who cannot be read off the public list cannot be read off this"
						+ " route either, so nothing in the portal can draw his own screens")
				.isEqualTo(LAPSED);
	}

	/**
	 * AND NOTHING HERE SAYS WHO PAYS AND WHO DOES NOT.
	 *
	 * <p>PDL P8, 28.07.2026: „Osnov clanstva se nikad ne prikazuje javno. Ni na profilu, ni
	 * u tabelama, nigde. <b>Vide ga samo Superadmin i moderatori sa pravom nad clanovima.</b>"
	 * The member is not on that list. Against it stands a measurement rather than a decision
	 * (PDL, 06.09.2026: „nosi oslobodjenje od clanarine, i clanu i administraciji"), so this
	 * is the meaning of a term and the owner decides it - and until he does, ADL P-javno of
	 * 13.09.2026 says which way the omission falls: „Kad je sporno, polje se IZOSTAVLJA."
	 *
	 * <p><b>The words are read off the schema, not written here</b>, the same way
	 * {@code CompetitorApiTest} reads them: which words exist is a CHECK on the column, so a
	 * third basis added tomorrow grows this case with it. And it is asked of BOTH states -
	 * the caller is freed of the fee and the lapsed member pays - because a route answering
	 * only one of the two words would pass a case that asked only the other.
	 *
	 * <p><b>The boundary, named rather than left to a review:</b> this refuses the WORDS. It
	 * does not refuse the same fact answered as a boolean under a neutral name. What refuses
	 * that is the shape of {@code MyOwnRecord}, which has four components and no fifth.
	 */
	@Test
	void nothingAboutTheMembershipFeeLeavesThisRouteEither() throws Exception {
		String rule = db.sql("select pg_get_constraintdef(oid) from pg_constraint"
						+ " where conname = ?").param("competitor_membership_basis_known")
				.query(String.class).single();
		List<String> everyBasis = Pattern.compile("'([a-zA-Z]+)'").matcher(rule).results()
				.map(one -> one.group(1)).toList();
		assertThat(everyBasis).as("the schema named no basis at all, so the loop below asserts"
				+ " nothing; the rule it read was: %s", rule).hasSizeGreaterThan(1);

		for (String email : List.of(MY_ACCOUNT, THE_LAPSED_ACCOUNT)) {
			String whole = whole(email);

			assertThat(whole).as("the answer to %s carries nothing at all, so it says nothing"
					+ " about what it leaves out", email).contains("\"account\"");

			for (String basis : everyBasis) {
				assertThat(whole).as("the basis a membership is held on (%s) left through the"
						+ " member's own door, and PDL P8 names who may see it: the superadmin and"
						+ " moderators with the right over members", basis).doesNotContain(basis);
			}
		}
	}

	/**
	 * AND NO REFERRAL CODE LEAVES HERE, BECAUSE THAT FACT HAS A HOME ALREADY.
	 *
	 * <p>Not withheld: ANSWERED, by {@link CompetitorApi} since 20.09.2026, on the caller's
	 * own row and nobody else's, as {@code referralCode} beside {@code referredCount}. Two
	 * homes for one fact is what lets two answers disagree, and the second one is always the
	 * one nobody remembers to change.
	 *
	 * <p><b>This case is a decision and the day the owner moves that fact here it has to be
	 * deleted on purpose</b>, which is the whole reason it is written down rather than left
	 * as an absence somebody would fill in without noticing.
	 *
	 * <p>Asked of the text and of every code in the database rather than of a field name, for
	 * the reason {@code CompetitorApiTest} measured: a review swapped one field for another
	 * under the old name and the whole suite stayed green, because the omission was guarded
	 * by that name alone. The caller has brought somebody in, so a count is not nought here
	 * either and its absence is a decision rather than an empty table.
	 */
	@Test
	void noReferralCodeLeavesThisRouteEither() throws Exception {
		String whole = whole(MY_ACCOUNT);

		assertThat(whole).as("the answer carries nothing at all, so it says nothing about what it"
				+ " leaves out").contains(ME);

		assertThat(db.sql("select count(*) from competitor where referred_by ="
						+ " (select id from competitor where member_number = ?)").param(ME)
				.query(Integer.class).single())
				.as("the caller brought nobody in, so an answer carrying no count of them would"
						+ " look the same whether the count was withheld or simply nought")
				.isPositive();

		List<String> codes = db.sql("select referral_code from competitor").query(String.class)
				.list();
		assertThat(codes).as("no code was read out of the database, so the loop below asserts"
				+ " nothing").hasSize(4);

		for (String code : codes) {
			assertThat(whole).as("a referral code (%s) left through this door, and the member's own"
					+ " code is already answered by /api/competitors on his own row: a fact with two"
					+ " homes is a fact that can disagree with itself", code).doesNotContain(code);
		}
	}

	private String whole(String email) throws Exception {
		return http.perform(asking(email)).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	private JsonNode answerFor(String email) throws Exception {
		return new ObjectMapper().readTree(whole(email));
	}

	private MockHttpServletRequestBuilder asking(String email) {
		return get(PATH).cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private long competitorIdOf(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	private long accountIdOf(String email) {
		return db.sql("select id from account where email = ?").param(email)
				.query(Long.class).single();
	}

	private long teamIdOf(String slug) {
		return db.sql("select id from team where slug = ?").param(slug).query(Long.class).single();
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

	private void membership(String number, String slug, int from, String to, String leftReason) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to,"
						+ " left_reason) values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?, " + to + ", " + leftReason + ")")
				.params(number, slug, from).update();
	}
}
