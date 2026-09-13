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

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** The teams of the league, and the two things that do not leave with them. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TeamApiTest {

	/** Named here with the reason, because a lost field and a withheld one look alike. */
	private static final String THE_TEAMS_MARK = "logo";
	private static final String WHO_ADMINISTERS_THE_TEAM = "organizerMemberNumber";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/**
	 * Three teams, and no two of them alike in anything the answer carries.
	 *
	 * <p>One takes its town from the codebook and one has it typed, which are the two
	 * shapes V11 allows, and the third is a codebook town in a third country. One has
	 * a mark and a crop, one has another mark and another crop, one has neither. One
	 * says nothing about itself and two do. A field that is the same in every record
	 * is a field the server could answer with a constant, and {@code Answers} refuses
	 * that.
	 *
	 * <p><b>AND NO TWO OF THEM SHARE AN ORDER</b>, because a fixture where two
	 * behaviours give the same list measures neither of them. The answer comes back in
	 * NAME order, so every other order a wrong query could take is a different list:
	 *
	 * <ul>
	 * <li><b>The row order.</b> They are written Vardarski, Dunavski, Njegosevi, so
	 * the order they are written in is neither the name order nor its reverse.</li>
	 * <li><b>The address.</b> Nothing in the schema ties a team's address to its name,
	 * and here they deliberately disagree: the addresses sort Klub Lovcen, Novosadski,
	 * Vardarski, which is a third order again. Written as the name spelt out, this
	 * fixture would let {@code order by t.slug} pass for {@code order by t.name}.</li>
	 * <li><b>The town, the country and the first season.</b> Towns sort Cetinje, Novi
	 * Sad, Skoplje; countries sort MK, ME, RS; seasons are 2027, 2029, 2028 in the
	 * order they are written. Each gives the three teams a different sequence and none
	 * of them is the name order.</li>
	 * <li><b>The mark.</b> The team with no mark is the LAST by name, so an order that
	 * follows the picture instead - nulls last - is the reverse of the address order
	 * and not the name order. And the marks are handed out crosswise: the first mark
	 * written belongs to the last team written, so a crop read off the wrong row is a
	 * different crop and not the same one.</li>
	 * </ul>
	 *
	 * <p><b>And there is a crop in the fixture that no team may answer with</b>: a
	 * member's own profile picture, written FIRST, so a query that reaches the picture
	 * through a member rather than through the team answers with numbers that are in
	 * the database and in nobody's team.
	 *
	 * <p><b>The members are here although the answer carries none of them</b>, and
	 * that is what the two cases about them measure. One team has three members and
	 * one has one, so a join to {@code team_membership} would give the first team
	 * three rows; two of the members are named as administrators, and one of those two
	 * is a member whose fee has lapsed, whom {@code /api/competitors} does not carry at
	 * all.
	 */
	@BeforeEach
	void threeTeams() {
		/* Written first on purpose: it belongs to a member and to no team, so it is
		   the crop a wrong join lands on. */
		long theMembersOwnPicture = photo("1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a"
				+ "1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a", "0.11", "0.22", "0.33");
		/* And the two marks, crosswise: this one goes to the team written LAST. */
		long theLovcenMark = photo("2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b"
				+ "2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b", "0.25", "0.75", "0.40");
		long theDunavMark = photo("3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c"
				+ "3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c", "0.62", "0.18", "0.85");

		member("000001", "Jelena", "Simic", "F", true, "0a2b4c6d8e0f1102",
				String.valueOf(theMembersOwnPicture));
		member("000002", "Marko", "Ostojic", "M", true, "5f4e3d2c1b0a9903", "null");
		/* His fee has lapsed, and he is in a team and named on one. Owner, 13.09.2026:
		   such a member is not on the public list of members at all, so a member number
		   answered here and absent there would say by subtraction what that decision
		   shut. */
		member("000003", "Dusan", "Radic", "M", false, "b7f3a1c2d4e50601", "null");
		member("000004", "Ana", "Vukotic", "F", true, "c3d2e1f0a9b87704", "null");

		team("vardarski-krug", "Vardarski krug", "", inTheCodebook("Skoplje"), 2027, null, null);
		team("novosadski-trkaci", "Dunavski trkači", "Okupljamo se sredom uvece na Strandu.",
				inTheCodebook("Novi Sad"), 2029, theDunavMark, "000001");
		team("klub-lovcen", "Njegoševi trkači", "Trcimo uz Lovcen.", typed("Cetinje", "ME"), 2028,
				theLovcenMark, "000003");

		membership("000001", "novosadski-trkaci", 2027);
		membership("000002", "novosadski-trkaci", 2028);
		membership("000003", "novosadski-trkaci", 2029);
		membership("000004", "klub-lovcen", 2027);
	}

	private long photo(String digest, String x, String y, String diameter) {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/png', 2048, ?, ?, ?, ?) returning id")
				.params(digest, new BigDecimal(x), new BigDecimal(y), new BigDecimal(diameter))
				.query(Long.class).single();
	}

	private void member(String number, String first, String last, String gender, boolean active,
			String referralCode, String photo) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at, photo_id)"
						+ " values (?, ?, ?, ?, date '1985-04-17',"
						+ " (select id from place where name = 'Beograd'), null, null,"
						+ " 2027, false, ?, 'payment', ?, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00', " + photo + ")")
				.params(number, first, last, gender, active, referralCode).update();
	}

	/** The town out of the codebook, which is one of the two shapes V11 allows. */
	private static String inTheCodebook(String name) {
		return "(select id from place where name = '" + name + "'), null, null";
	}

	/** And the other: typed in, with the country typed beside it. */
	private static String typed(String name, String country) {
		return "null, '" + name + "', (select id from country where code = '" + country + "')";
	}

	private void team(String slug, String name, String bio, String town, int firstSeason,
			Long mark, String adminNumber) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, first_season,"
						+ " logo_id, admin_id) values (?, ?, ?, '', " + town + ", ?, "
						+ (mark == null ? "null" : String.valueOf(mark)) + ", "
						+ (adminNumber == null ? "null"
								: "(select id from competitor where member_number = '"
										+ adminNumber + "')")
						+ ")")
				.params(slug, name, bio, firstSeason).update();
	}

	private void membership(String number, String slug, int from) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from) values"
						+ " ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?)")
				.params(number, slug, from).update();
	}

	private String whole() throws Exception {
		return http.perform(get("/api/teams")).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(whole());
	}

	private List<String> addresses() throws Exception {
		return StreamSupport.stream(answer().spliterator(), false)
				.map(one -> one.path("slug").asString()).toList();
	}

	private JsonNode answerFor(String slug) throws Exception {
		List<JsonNode> found = StreamSupport.stream(answer().spliterator(), false)
				.filter(one -> one.path("slug").asString().equals(slug)).toList();

		assertThat(found).as("%s did not come back exactly once, so nothing below is about it", slug)
				.hasSize(1);

		return found.getFirst();
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ANSWERED, EXCEPT THE TWO THAT ARE NOT THIS
	 * RESOURCE'S TO ANSWER, and those are named here with the reason.
	 *
	 * <ul>
	 * <li><b>Who administers the team.</b> Article 73 makes „Tim" public, which is
	 * which team a member runs for; it makes no ROLE inside a team public. Measured
	 * before this was written: the one public screen that reads the field
	 * ({@code pages/TeamDetail.tsx}) never draws it - all three uses are conditions
	 * deciding whether the READER may edit the team and answer applications, which is
	 * a question for the resource that knows who is asking. And the member it names
	 * may be one whose fee has lapsed, whom the owner's decision of 13.09.2026 keeps
	 * off {@code /api/competitors} entirely.</li>
	 * <li><b>The mark.</b> The portal reads it as a path to a picture and this schema
	 * has none: a {@code photo} row carries a media type, a byte size, a digest and
	 * the crop (V8, V21), and nothing points at bytes. No route serves a picture;
	 * pictures are F5. An address invented here would be a broken circle beside every
	 * team that has a mark.</li>
	 * </ul>
	 *
	 * <p>{@code Answers} checks each name against the file the portal serves, so a
	 * name left here after the portal stopped serving it cannot quietly excuse a field
	 * that went missing for another reason, and it checks the answer really does leave
	 * them out. It also refuses any name the portal does NOT read, which is what says
	 * the team's link, its first season and its administrator did not arrive under
	 * another word.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/teams", answer(), "teams.json",
				THE_TEAMS_MARK, WHO_ADMINISTERS_THE_TEAM);
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/teams", answer());
	}

	/**
	 * AND NO MEMBER NUMBER LEAVES THE SERVER WITH A TEAM, whatever it is called.
	 *
	 * <p>This is both decisions in one case. Who administers the team is left out, and
	 * so is who is IN it - the second although Article 73 makes it public, because it
	 * is already answered once by {@code /api/competitors} and the second home would
	 * be the worse of the two: built out of {@code team_membership} it carries the
	 * members whose fee has lapsed, and filtered to those whose fee is standing it is
	 * the first list inverted and kept in a second place.
	 *
	 * <p><b>Asked of the whole answer as TEXT and not of a field name</b>, for the
	 * reason the competitors' resource learnt on a review: an omission guarded by a
	 * name is an omission until somebody answers the same fact under another one. Two
	 * of the four members in the fixture are named administrators and three are in a
	 * team, so both doors are measured at once.
	 */
	@Test
	void noMemberNumberLeavesTheServer() throws Exception {
		String whole = whole();

		assertThat(whole).as("the answer carries nothing at all, so it says nothing about what it"
						+ " leaves out")
				.contains("vardarski-krug", "novosadski-trkaci", "klub-lovcen");

		List<String> numbers = db.sql("select member_number from competitor").query(String.class)
				.list();
		assertThat(numbers).as("no member number was read out of the database, so the loop below"
				+ " asserts nothing").hasSize(4);

		for (String number : numbers) {
			assertThat(whole).as("a member number (%s) left the server with a team. Clan 73 makes"
							+ " the team public and this resource still answers with nobody: who is"
							+ " in which team is /api/competitors' one answer, and who administers"
							+ " one is a right rather than a standing", number)
					.doesNotContain(number);
		}
	}

	/**
	 * AND A TEAM COMES BACK ONCE, HOWEVER MANY MEMBERS IT HAS.
	 *
	 * <p>The other half of the same decision, and the one a name cannot say: nothing
	 * here is joined to {@code team_membership}, so the team with three members is one
	 * row and not three. Without a team of more than one member in the fixture, a
	 * query that joined the memberships would answer exactly the same list.
	 */
	@Test
	void aTeamComesBackOnceHoweverManyMembersItHas() throws Exception {
		assertThat(db.sql("select count(*) from team_membership where team_id ="
						+ " (select id from team where slug = 'novosadski-trkaci')")
				.query(Integer.class).single())
				.as("no team in the fixture has more than one member, so this case asserts nothing")
				.isEqualTo(3);

		assertThat(addresses()).as("a team came back more than once, which is what a join to the"
						+ " memberships does")
				.doesNotHaveDuplicates().hasSize(3);
	}

	/**
	 * IN NAME ORDER, which is the order the table of teams is read down.
	 *
	 * <p>Asked by ADDRESS rather than by name, so that what is measured is which ROW
	 * came where: read back off the field it was sorted by, this case would go green
	 * on a server that sorted the names and handed out the wrong rows beside them.
	 *
	 * <p>The fixture separates every other order a wrong query could take - the order
	 * the rows were written, the address, the town, the country, the first season and
	 * the picture - and the head of this class says which sequence each of them gives.
	 */
	@Test
	void theTeamsComeBackInNameOrder() throws Exception {
		assertThat(addresses())
				.as("the teams came back in some order other than by their name")
				.containsExactly("novosadski-trkaci", "klub-lovcen", "vardarski-krug");
	}

	/**
	 * THE TOWN IS THE ONE THE TEAM NAMED, in whichever of the two shapes it named it.
	 *
	 * <p>V11 gives a team the same three columns a member has: a town out of the
	 * codebook, or a town typed in with its country typed beside it. Both are here,
	 * and the country follows the town rather than the other column: two teams take
	 * theirs from the codebook and one from what was typed, so dropping either source
	 * empties a different team's country instead of all of them.
	 */
	@Test
	void theTownIsTheOneTheTeamNamed() throws Exception {
		assertThat(db.sql("select count(*) from team where city is not null").query(Integer.class)
				.single())
				.as("no team in the fixture typed its town in, so only one of the two shapes is"
						+ " being measured")
				.isEqualTo(1);

		assertThat(answerFor("vardarski-krug").path("city").asString()).isEqualTo("Skoplje");
		assertThat(answerFor("vardarski-krug").path("country").asString()).isEqualTo("MK");

		assertThat(answerFor("novosadski-trkaci").path("city").asString()).isEqualTo("Novi Sad");
		assertThat(answerFor("novosadski-trkaci").path("country").asString()).isEqualTo("RS");

		assertThat(answerFor("klub-lovcen").path("city").asString()).isEqualTo("Cetinje");
		assertThat(answerFor("klub-lovcen").path("country").asString()).isEqualTo("ME");
	}

	/**
	 * THE CROP IS THE SQUARE THAT TEAM'S MARK WAS CUT TO, and a team with no mark has
	 * none.
	 *
	 * <p>The two marks carry different numbers in all three places and are handed out
	 * crosswise - the first written belongs to the team written last - so a crop read
	 * off the other team's picture is a different crop and not the same one.
	 *
	 * <p><b>And the names are the portal's.</b> {@code cropIn}
	 * ({@code components/crop.ts}) asks for {@code x}, {@code y} and {@code size}, and
	 * quietly answers „the whole picture" for a record that has no {@code size} at
	 * all. The column is {@code crop_diameter} since V21 and the difference in the
	 * word is a recorded open item; answered the schema's way round, every crop on the
	 * portal would be lost without one error anywhere.
	 */
	@Test
	void theCropIsTheSquareThatTeamsMarkWasCutTo() throws Exception {
		JsonNode dunav = answerFor("novosadski-trkaci").path("crop");
		assertThat(dunav.path("x").decimalValue()).isEqualByComparingTo("0.62");
		assertThat(dunav.path("y").decimalValue()).isEqualByComparingTo("0.18");
		assertThat(dunav.path("size").decimalValue()).isEqualByComparingTo("0.85");

		JsonNode lovcen = answerFor("klub-lovcen").path("crop");
		assertThat(lovcen.path("x").decimalValue()).isEqualByComparingTo("0.25");
		assertThat(lovcen.path("y").decimalValue()).isEqualByComparingTo("0.75");
		assertThat(lovcen.path("size").decimalValue()).isEqualByComparingTo("0.40");

		assertThat(db.sql("select count(*) from team where logo_id is null").query(Integer.class)
				.single())
				.as("every team in the fixture has a mark, so the claim below is about nothing")
				.isEqualTo(1);
		assertThat(answerFor("vardarski-krug").path("crop").isNull())
				.as("a team with no mark came back with a square of one")
				.isTrue();
	}

	/**
	 * AND NO CROP OF ANYBODY'S PROFILE PICTURE LEAVES WITH A TEAM.
	 *
	 * <p>A team's mark and a member's face are rows of one table (V8), cut the same
	 * way, so „the picture" is a question with two answers and a join that reaches it
	 * through the member instead of through the team is answered by the database
	 * without complaining. The member's three numbers are in the fixture and in no
	 * team.
	 *
	 * <p><b>The numbers are read off the database and not written here</b>, in the
	 * spelling the column itself gives them, and the marks are looked for BEFORE the
	 * face is looked against: without that first half this case would pass just as
	 * happily if the answer carried no crops at all, or carried them in a spelling
	 * neither loop would ever match.
	 */
	@Test
	void noCropOfAnybodysProfilePictureLeavesWithATeam() throws Exception {
		String whole = whole();

		List<String> marks = db.sql("select unnest(array[crop_x::text, crop_y::text,"
						+ " crop_diameter::text]) from photo"
						+ " where id in (select logo_id from team where logo_id is not null)")
				.query(String.class).list();
		assertThat(marks).as("no mark was read out of the database, so this case compares nothing")
				.hasSize(6);

		for (String number : marks) {
			assertThat(whole).as("the answer does not carry the crop (%s) the column holds, so the"
							+ " loop below would pass over an answer with no crops in it at all",
							number)
					.contains(number);
		}

		List<String> theFace = db.sql("select unnest(array[crop_x::text, crop_y::text,"
						+ " crop_diameter::text]) from photo where id ="
						+ " (select photo_id from competitor where member_number = '000001')")
				.query(String.class).list();
		assertThat(theFace).as("the member has no picture, so the loop below asserts nothing")
				.hasSize(3);

		for (String number : theFace) {
			assertThat(whole).as("a number (%s) off a member's own profile picture left the server"
							+ " with a team, which is the crop of a face and not of a mark", number)
					.doesNotContain(number);
		}
	}

	@Test
	void nobodyHasToSignInToSeeTheTeams() throws Exception {
		assertThat(http.perform(get("/api/teams")).andReturn().getResponse().getStatus())
				.as("/api/teams asked a visitor to sign in")
				.isEqualTo(200);
	}

}
