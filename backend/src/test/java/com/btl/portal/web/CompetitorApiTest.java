package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Who runs in the league, and the one thing that must never leave with them. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CompetitorApiTest {

	/** Named here with the reason, because a lost field and a withheld one look alike. */
	private static final String THE_YEAR_OF_BIRTH = "birthYear";
	private static final String THE_REFERRAL_CODE = "referralCode";
	private static final String WHO_HANDED_OUT_THE_CODE = "referredBy";
	private static final String HOW_THE_MEMBERSHIP_IS_HELD = "membershipBasis";
	private static final String WHETHER_THE_FEE_IS_STANDING = "active";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/**
	 * Three members, and no two of them alike in anything the answer carries.
	 *
	 * <p>One takes her town from the codebook and one has it typed, which are the two
	 * shapes V7 allows. One is in a team and two are not, one was brought in by
	 * another and two were not, one hides his profile, and all three answer the
	 * birthday question differently. A field that is the same in every record is a
	 * field the server could answer with a constant, and `Answers` refuses that.
	 *
	 * <p><b>AND NO TWO OF THEM SHARE AN ORDER OR A FLAG</b>, because a fixture where
	 * two behaviours give the same list measures neither of them. Every axis below is
	 * separated on purpose and each line says which wrong answer it refuses:
	 *
	 * <ul>
	 * <li><b>The order.</b> They are written 000012, 000045, 000007, so the row order
	 * is not the number order and neither is its reverse. Surname, given name, day of
	 * birth, first season and referral code each sort them differently again, so
	 * ordering by any of those is a different list.</li>
	 * <li><b>The three flags on the row.</b> Hidden is 000007, not active is 000012,
	 * first season 2027 is 000045. Each is exactly one member and never the same one,
	 * so answering with the wrong column answers with the wrong member.</li>
	 * <li><b>The team.</b> The member in a team is 000045, who is neither the hidden
	 * one nor the inactive one. He ran for one team in 2027, left it, and joined the
	 * other in 2028, and 000007 left a team in 2027 and is in none now. So dropping
	 * the condition that the membership has not ended does two visible things at once:
	 * it gives 000007 a team he left, and it gives 000045 a second row.</li>
	 * <li><b>The season the membership started in</b> is 2028, which is neither the
	 * season the team started in (2027) nor either end of the membership he left.</li>
	 * </ul>
	 *
	 * <p>What is deliberately NOT separated: sex lines up with the inactive member,
	 * and „has no team" lines up with „was brought in by nobody". Neither is a
	 * substitution a wrong query could make, and three members cannot keep every set
	 * of them distinct at once.
	 */
	@BeforeEach
	void fourMembers() {
		member("000012", "Milica", "Djurisic", "F", "1968-03-11",
				"(select id from place where rank = 1)", "null", "null",
				2014, false, true, "feeExempt", "Trcim od 2014.", "0a2b4c6d8e0f1102", "null",
				false, "none");
		member("000045", "Strahinja", "Vukicevic", "M", "2007-01-30",
				"(select id from place where rank = 2)", "null", "null",
				2027, true, true, "payment", "Prva sezona.", "5f4e3d2c1b0a9903", "null",
				false, "full");
		member("000007", "Milos", "Pavlovic", "M", "1991-07-02",
				"null", "'Krusevac'", "(select id from country where code = 'RS')",
				2020, false, true, "payment", "", "b7f3a1c2d4e50601",
				"(select id from competitor where member_number = '000012')", true, "year");

		/* AND THE FOURTH, WHOSE FEE HAS LAPSED. His number sorts BETWEEN two of the
		   three, so a list that lets him through is wrong in its order as well as in
		   its length, and everything else about him is ordinary: he is not hidden, he
		   is in no team, and he pays like two of the others. The only thing that keeps
		   him out is the one thing being measured. */
		member("000031", "Nenad", "Ilic", "M", "1979-05-20",
				"(select id from place where rank = 1)", "null", "null",
				2015, false, false, "payment", "Pauziram.", "c3d2e1f0a9b87704", "null",
				false, "none");

		team("probni-tim", "Probni tim", "000012");
		team("drugi-tim", "Drugi tim", "000045");

		membership("000012", "drugi-tim", 2027, "2027", "'Presao u drugi tim'");
		membership("000012", "probni-tim", 2028, "null", "null");
		membership("000007", "probni-tim", 2027, "2027", "'Prestao da trci za tim'");
	}

	private void member(String number, String first, String last, String gender, String born,
			String place, String city, String country, int firstSeason, boolean firstSeason2027,
			boolean active, String basis, String bio, String referralCode, String broughtBy,
			boolean hidden, String birthdayShown) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '" + born + "', " + place + ", " + city + ", "
						+ country + ", ?, ?, ?, ?, ?, " + broughtBy + ", ?, ?, ?, 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, firstSeason, firstSeason2027, active, basis,
						referralCode, bio, hidden, birthdayShown)
				.update();
	}

	/** Both teams start in 2027, so the season a membership starts in is never the team's. */
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

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(
				http.perform(get("/api/competitors")).andReturn().getResponse().getContentAsString());
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ANSWERED, EXCEPT THE FOUR THAT ARE NOT ITS
	 * BUSINESS, and those are named here with the reason.
	 *
	 * <p><b>These four are the whole reason this resource exists.</b> PDL, 06.09.2026,
	 * measured and named exactly them as the fields that cannot leave the public file
	 * „dok portal nema bekend", because one file was serving the public side, the
	 * member's own screens and the administration at once. This is that backend.
	 *
	 * <ul>
	 * <li><b>The year of birth</b> and <b>how the membership is held</b>: Article 74
	 * says a date of birth is never shown „ni u punom ni u skracenom obliku", and the
	 * year is the shortened form; the same sentence goes on „Isto vazi za adresu
	 * elektronske poste, adresu, sve u vezi sa clanarinom i privatne poruke", and the
	 * basis says who is exempt from paying.</li>
	 * <li><b>The referral code</b> and <b>who handed it out</b>: Article 73 lists what
	 * is public and neither is on it. The second one hides behind its name: the portal
	 * reads `referredBy` as the CODE, not as a member number, so answering with either
	 * is wrong in its own way.</li>
	 * </ul>
	 *
	 * <p>`Answers` checks each name against the file the portal serves, so a name left
	 * here after the portal stopped serving it cannot quietly excuse a field that went
	 * missing for another reason, and it checks the answer really does leave them out.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/competitors", answer(), "competitors.json",
				THE_YEAR_OF_BIRTH, THE_REFERRAL_CODE, WHO_HANDED_OUT_THE_CODE,
				HOW_THE_MEMBERSHIP_IS_HELD, WHETHER_THE_FEE_IS_STANDING);
	}

	/**
	 * AND NOTHING IN THE ANSWER IS A REFERRAL CODE, whatever it is called.
	 *
	 * <p>Asked of the whole answer as TEXT and not of a field name, for the same reason
	 * the year of birth is: the review that found this measured that swapping the member
	 * number for the code under the name `referredBy` passed the whole suite, because the
	 * omission was guarded by that name alone. A code is sixteen hexadecimal characters
	 * and every member in the fixture carries a different one.
	 */
	@Test
	void noReferralCodeLeavesTheServer() throws Exception {
		String whole = http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString();

		assertThat(whole).as("the answer carries nothing at all, so it says nothing about what it"
				+ " leaves out").contains("000007", "000012", "000045");

		List<String> codes = db.sql("select referral_code from competitor").query(String.class).list();
		assertThat(codes).as("no code was read out of the database, so the loop below asserts nothing")
				.hasSize(4);

		for (String code : codes) {
			assertThat(whole).as("a referral code (%s) left the server, which Clan 73 does not make"
					+ " public: it is the member's to hand out, not the portal's to publish", code)
					.doesNotContain(code);
		}
	}

	/**
	 * AND NOTHING IN THE ANSWER SAYS WHO PAYS AND WHO DOES NOT.
	 *
	 * <p>Asked of the text and not of a field name, because the basis is a short word
	 * that could arrive under any name at all.
	 *
	 * <p><b>The words are read off the schema, not written here.</b> Which words exist
	 * is a CHECK on the column, so the day a third basis is added the rule grows and this
	 * case grows with it. A list written by hand would have stayed two words long and
	 * said nothing about the third.
	 *
	 * <p><b>The boundary, measured and written down rather than left to a review:</b> it
	 * refuses the WORDS. It does not refuse the same fact answered as a boolean under a
	 * neutral name, because a boolean carries no word to look for. What refuses that is
	 * `Answers`: a name the portal does not read cannot be in the answer at all, whatever
	 * type it carries.
	 */
	@Test
	void nothingAboutTheMembershipFeeLeavesTheServer() throws Exception {
		String whole = http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString();

		assertThat(whole).as("the answer carries nothing at all, so it says nothing about what it"
				+ " leaves out").contains("000007", "000012", "000045");

		String rule = db.sql("select pg_get_constraintdef(oid) from pg_constraint"
						+ " where conname = ?").param("competitor_membership_basis_known")
				.query(String.class).single();
		List<String> everyBasis = Pattern.compile("'([a-zA-Z]+)'").matcher(rule).results()
				.map(one -> one.group(1)).toList();
		assertThat(everyBasis).as("the schema named no basis at all, so the loop below asserts"
				+ " nothing; the rule it read was: %s", rule).hasSizeGreaterThan(1);

		for (String basis : everyBasis) {
			assertThat(whole).as("the basis a membership is held on (%s) left the server, and Clan 74"
					+ " puts everything to do with the fee beside the date of birth", basis)
					.doesNotContain(basis);
		}
	}

	/**
	 * AND A MEMBER WHOSE FEE HAS LAPSED IS NOT ON THE LIST AT ALL.
	 *
	 * <p>PDL P11: „Status clanarine se ne prikazuje na profilu. Prisustvo clana na sajtu
	 * u tekucoj godini samo po sebi znaci da je clanarina aktivna; ko nije platio, ne vidi
	 * se nigde osim u istorijskim godinama." Asked on 13.09.2026 which of the two shapes
	 * that takes on the server, the owner chose this one over serving the flag: off the
	 * list, rather than on it with the flag withheld.
	 *
	 * <p>His number sorts BETWEEN two of the three who are on it, so letting him through
	 * is wrong in the order as well as in the length, and two cases go red instead of one.
	 * Nothing else about him is unusual: not hidden, in no team, paying like two others.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsNotOnTheList() throws Exception {
		assertThat(db.sql("select count(*) from competitor where not active")
				.query(Integer.class).single())
				.as("the fixture has nobody whose fee has lapsed, so this case asserts nothing")
				.isEqualTo(1);

		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a member whose fee has lapsed came back on the public list of members")
				.doesNotContain("000031");
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/competitors", answer());
	}

	/**
	 * AND NOTHING IN THE ANSWER IS A DATE OF BIRTH, in any spelling.
	 *
	 * <p>This is the case the resource exists for and the reason it was written before
	 * the easier ones: what the portal serves today carries the year for all thirty
	 * two members, and the policy that forbids it takes effect on 15.09.2026.
	 *
	 * <p>Asked of the whole answer as TEXT rather than of a field name, because a year
	 * is a year whatever it is called: a field renamed to `born`, or a year folded into
	 * the biography, would walk past a check that only reads names. The three years in
	 * the fixture are far apart and none of them is also a season in it, so finding one
	 * is finding a date of birth and not something else.
	 *
	 * <p><b>The boundary, written here rather than left for somebody to find:</b> this
	 * refuses the four digit year and the whole date. It does NOT refuse the age as a
	 * number, nor a two digit year, both of which name the year of birth to within a
	 * year. The next increment answers with the age CATEGORY, which is a band of fifteen
	 * years and is what Article 74 makes public in the same sentence; the difference
	 * between that band and an age is one character in a query, so whoever writes it
	 * must say which of the two they are writing.
	 */
	@Test
	void noYearOfBirthLeavesTheServer() throws Exception {
		String whole = http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString();

		assertThat(whole)
				.as("the answer carries nothing at all, so it says nothing about what it leaves out")
				.contains("000007", "000012", "000045");

		/* Read out of the database rather than written here, so that a member added to the
		   fixture tomorrow is measured without anybody remembering to add their year. */
		List<String> years = db.sql("select distinct to_char(birth_date, 'YYYY') from competitor")
				.query(String.class).list();
		List<String> days = db.sql("select distinct to_char(birth_date, '-MM-DD') from competitor")
				.query(String.class).list();
		assertThat(years).as("no year was read out of the database, so the loops below assert"
				+ " nothing").hasSize(4);
		assertThat(days).as("no day was read out of the database").hasSize(4);

		for (String year : years) {
			assertThat(whole)
					.as("a year of birth (%s) left the server, which Clan 74 and the privacy policy"
							+ " both forbid in full and in short", year)
					.doesNotContain(year);
		}

		for (String day : days) {
			assertThat(whole).as("a whole date of birth (%s) left the server", day)
					.doesNotContain(day);
		}
	}

	/** In member number order, which is the one order a member is spoken of in. */
	@Test
	void theListComesBackInMemberNumberOrder() throws Exception {
		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("the members came back in some order other than by their number")
				.containsExactly("000007", "000012", "000045");
	}

	/**
	 * A MEMBER WHO HIDES HIS PROFILE IS STILL ON THE LIST, because the list is not the
	 * page.
	 *
	 * <p>PDL P23 hides the profile PAGE from a visitor who is not signed in. The member
	 * number, the name and the standing stay public (Article 73), and the portal needs
	 * the flag in order to know what to draw. Taking him off here would empty a league
	 * table instead of hiding a page.
	 */
	@Test
	void hidingAProfileDoesNotTakeTheMemberOffTheList() throws Exception {
		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("profileHidden").asBoolean())
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("the member who hides his profile fell off the list of members")
				.containsExactly("000007");
	}

	/**
	 * AND THE TEAM COMES OFF THE MEMBERSHIP THAT HAS NOT ENDED.
	 *
	 * <p>A member is in one team at a time (V11) and the season it started in is what
	 * the portal draws beside the club. Both halves are here: the one who is in a team
	 * carries it with the season, and the two who are not carry neither.
	 *
	 * <p><b>A membership that ended is in the fixture on both sides</b>, which is what
	 * makes this measure the condition rather than the join. 000045 left one team and
	 * joined another, so ignoring the condition would give him two rows and the wrong
	 * season; 000007 left a team and joined none, so it would give him a club he is not
	 * in. The list of members in no team is checked as a whole for that second half.
	 */
	@Test
	void theTeamIsTheOneTheMembershipHasNotEnded() throws Exception {
		List<JsonNode> theOneInATeam = StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("memberNumber").asString().equals("000012")).toList();

		assertThat(theOneInATeam)
				.as("the member who left one team and joined another came back more than once")
				.hasSize(1);
		assertThat(theOneInATeam.getFirst().path("teamSince").asInt())
				.as("the answer names a season other than the one the standing membership began in")
				.isEqualTo(2028);
		assertThat(theOneInATeam.getFirst().path("teamId").isNull())
				.as("the member is in a team and the answer says nothing")
				.isFalse();

		assertThat(StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("teamId").isNull())
				.map(one -> one.path("memberNumber").asString()).toList())
				.as("a member who is in no team came back in one")
				.containsExactly("000007", "000045");
	}

	@Test
	void nobodyHasToSignInToSeeWhoRuns() throws Exception {
		assertThat(http.perform(get("/api/competitors")).andReturn().getResponse().getStatus())
				.as("/api/competitors asked a visitor to sign in")
				.isEqualTo(200);
	}

}
