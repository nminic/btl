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
import org.springframework.web.method.HandlerMethod;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** The teams of the league, the mark that leaves with them, and the one thing that does not. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TeamApiTest {

	/**
	 * Where a team's picture is asked for, which this resource answers with since
	 * 21.09.2026 and named as an omission before that.
	 */
	private static final String THE_TEAMS_MARK = "logo";

	/** Named here with the reason, because a lost field and a withheld one look alike. */
	private static final String WHO_ADMINISTERS_THE_TEAM = "organizerMemberNumber";

	/** What the seat is answered AS, once the resource knows who is asking. */
	private static final String WHETHER_THE_SEAT_IS_MINE = "foundedByMe";

	/** Founded the team that comes back FIRST, which is the source the next one separates. */
	private static final String FOUNDED_THE_FIRST_TEAM = "jelena@primer.rs";

	/** Founded the team that comes back SECOND, so „mine" and „the first" are two places. */
	private static final String FOUNDED_THE_SECOND_TEAM = "dusan@primer.rs";

	/** In a team and founded none, which is the substitution „is in it" would make. */
	private static final String FOUNDED_NOTHING = "ana@primer.rs";

	/** Signed in, and no member behind the account at all. */
	private static final String RACES_FOR_NOBODY = "moderator@primer.rs";

	private final Map<String, SecretToken> sessions = new HashMap<>();

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
	 * <p><b>And there is a whole picture in the fixture that no team may answer with</b>:
	 * a member's own portrait, written FIRST, with a digest and a crop of its own, so a
	 * query that reaches a picture through a member rather than through the team answers
	 * with values that are in the database and in nobody's team. Both of its halves are
	 * measured, and since 21.09.2026 the digest is the half that matters more: a digest
	 * answered here is the address that portrait is served at.
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

		/* AND FOUR WAYS OF ASKING, because the answer now depends on who asks. The
		   teams come back in name order - Dunavski trkaci, Njegosevi trkaci, Vardarski
		   krug - so the two founders are the first record and the SECOND, and „the team
		   that is mine" is never the same place twice. */
		account(FOUNDED_THE_FIRST_TEAM, "competitor");
		belongsTo(FOUNDED_THE_FIRST_TEAM, "000001");
		account(FOUNDED_THE_SECOND_TEAM, "competitor");
		belongsTo(FOUNDED_THE_SECOND_TEAM, "000003");
		account(FOUNDED_NOTHING, "competitor");
		belongsTo(FOUNDED_NOTHING, "000004");
		/* V23 leaves `account.competitor_id` empty for an account that does not race
		   (owner, 14.09.2026), which is the case that keeps „signed in" and „is a
		   member" from being one question. */
		account(RACES_FOR_NOBODY, "moderator");
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

	/** @param email null for the visitor, which is the same request without the cookie */
	private MockHttpServletRequestBuilder asking(String email) {
		MockHttpServletRequestBuilder asks = get("/api/teams");
		return email == null ? asks
				: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private String whole(String email) throws Exception {
		return http.perform(asking(email)).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	/** The addresses this caller is told are his to run, in the order they came back. */
	private List<String> mineAccordingTo(String email) throws Exception {
		return StreamSupport.stream(new ObjectMapper().readTree(whole(email)).spliterator(), false)
				.filter(one -> one.path(WHETHER_THE_SEAT_IS_MINE).asBoolean())
				.map(one -> one.path("slug").asString()).toList();
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ANSWERED, EXCEPT THE ONE THAT IS NOT THIS
	 * RESOURCE'S TO ANSWER, and it is named here with the reason.
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
	 * </ul>
	 *
	 * <p><b>The mark was the second such name until 21.09.2026 and is not one any
	 * more</b>, which is the whole of this increment as this floor sees it. It was left
	 * out because the schema had no address for a picture and no route served one; PR
	 * 327 wrote that route, so the reason went and the name went with it. Taking it out
	 * of this call is not a tidy-up: {@code Answers} requires a name listed here to be
	 * ABSENT from the answer, so leaving it would fail the moment the field arrived.
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
				WHO_ADMINISTERS_THE_TEAM);
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
	 * AND NO PART OF ANYBODY'S PROFILE PICTURE LEAVES WITH A TEAM, neither the square
	 * it is cut to nor the address it is asked for at.
	 *
	 * <p>A team's mark and a member's face are rows of one table (V8), cut the same
	 * way, so „the picture" is a question with two answers and a join that reaches it
	 * through the member instead of through the team is answered by the database
	 * without complaining. The member's three numbers and his digest are in the fixture
	 * and in no team.
	 *
	 * <p><b>The digest half was added on 21.09.2026 with the address</b>, and it is the
	 * more serious of the two: a crop off the wrong row draws a picture badly, while a
	 * digest off the wrong row IS that picture, asked for by anybody. ADL A60 leaves one
	 * boundary open - {@code competitor.photo_id} counts as public whatever
	 * {@code profile_hidden} says - and what keeps it shut today is that no resource
	 * publishes a portrait's digest. This is the case that says so, and it is asked over
	 * the whole TEXT rather than over a field name, because an omission guarded by a name
	 * lasts until somebody answers the same fact under another one.
	 *
	 * <p><b>The values are read off the database and not written here</b>, in the
	 * spelling the column itself gives them, and the marks are looked FOR before the
	 * face is looked against: without that first half this case would pass just as
	 * happily if the answer carried no crops and no addresses at all, or carried them in
	 * a spelling neither loop would ever match.
	 */
	@Test
	void noPartOfAnybodysProfilePictureLeavesWithATeam() throws Exception {
		String whole = whole();

		List<String> marks = db.sql("select unnest(array[digest, crop_x::text, crop_y::text,"
						+ " crop_diameter::text]) from photo"
						+ " where id in (select logo_id from team where logo_id is not null)")
				.query(String.class).list();
		assertThat(marks).as("no mark was read out of the database, so this case compares nothing")
				.hasSize(8);

		for (String value : marks) {
			assertThat(whole).as("the answer does not carry the value (%s) the mark's own row"
							+ " holds, so the loop below would pass over an answer carrying"
							+ " nothing of any picture at all", value)
					.contains(value);
		}

		List<String> theFace = db.sql("select unnest(array[digest, crop_x::text, crop_y::text,"
						+ " crop_diameter::text]) from photo where id ="
						+ " (select photo_id from competitor where member_number = '000001')")
				.query(String.class).list();
		assertThat(theFace).as("the member has no picture, so the loop below asserts nothing")
				.hasSize(4);

		for (String value : theFace) {
			assertThat(whole).as("a value (%s) off a member's own profile picture left the server"
							+ " with a team: that is the face of a member answered as the mark of"
							+ " a team, and a digest is the address the picture itself is at",
							value)
					.doesNotContain(value);
		}
	}

	/**
	 * THE MARK IS THE ADDRESS OF THAT TEAM'S OWN PICTURE, and a team that has none has
	 * no address at all.
	 *
	 * <p><b>The digest is read back out of the row the fixture itself wrote, through the
	 * team</b>, and never off a constant in this file. Written against a constant, the
	 * case would be satisfied by a server answering the string this file happens to know,
	 * which is one string written twice and not a measurement; read through
	 * {@code team.logo_id}, the only thing that produces it is the join the resource
	 * makes. Both teams that have a mark are asked, because the marks are handed out
	 * crosswise in the fixture, so an address read off the other team's picture is a
	 * different string and not the same one.
	 *
	 * <p><b>The WHOLE address and never a substring.</b> An address built out of
	 * {@code mark.id} still begins with the same prefix and still ends in a name, so
	 * {@code contains} would pass on it; compared whole, anything but the digest is a
	 * different string. The key is what {@link PhotoApi} refuses to be addressed by (ADL
	 * A60, PDL:6165: a key is countable and a digest is not), so this is the decision and
	 * not the spelling.
	 *
	 * <p><b>AND THE ADDRESS IS HANDED BACK TO THE DISPATCHER, which is the floor under
	 * the literal in {@link TeamApi}.</b> The prefix is written out there, and that is a
	 * third home for one route beside {@code PhotoApi}'s mapping and
	 * {@code ApiSecurity}'s open list. Two strings written in this repository and
	 * compared with each other say nothing the day both of them move together; asked of
	 * the application, the question stops being about spelling. Either the address a team
	 * answers with is one the portal maps to the pictures, or it is an address nothing
	 * serves. Nothing about the BYTES is asked here and nothing needs to be: what this
	 * resource owes is an address, and what is behind it is {@code PhotoApiTest}'s to
	 * owe.
	 */
	@Test
	void theMarkIsTheAddressOfThatTeamsOwnPicture() throws Exception {
		assertThat(db.sql("select count(*) from team where logo_id is not null")
				.query(Integer.class).single())
				.as("fewer than two teams in the fixture have a mark, so an address read off the"
						+ " wrong row could still be the right one")
				.isEqualTo(2);

		for (String slug : List.of("novosadski-trkaci", "klub-lovcen")) {
			String digest = db.sql("select p.digest from photo p join team t on t.logo_id = p.id"
					+ " where t.slug = ?").param(slug).query(String.class).single();

			String address = answerFor(slug).path(THE_TEAMS_MARK).asString();

			assertThat(address)
					.as("%s did not come back with the address of its own picture. The name in it"
							+ " is the digest of the content and never the key of the row", slug)
					.isEqualTo("/api/photos/" + digest);

			assertThat(http.perform(get(address)).andReturn().getHandler())
					.as("the address %s answered with (%s) is not one the portal maps to a"
							+ " picture, so it is a circle that will never draw", slug, address)
					.isInstanceOfSatisfying(HandlerMethod.class,
							one -> assertThat(one.getBeanType()).isEqualTo(PhotoApi.class));
		}

		assertThat(answerFor("vardarski-krug").path(THE_TEAMS_MARK).isNull())
				.as("a team with no mark answered with something rather than with null. An empty"
						+ " path is an address a browser asks for, and frontend/src/data/types.ts"
						+ " reads the two apart in as many words: a team that has none is not a"
						+ " team whose logo is the empty path")
				.isTrue();
	}

	/**
	 * A TEAM ANSWERS WITH BOTH HALVES OF ITS MARK OR WITH NEITHER, which is the thing
	 * this increment really introduces.
	 *
	 * <p>Until the picture had an address the answer could carry a square and no
	 * picture, which is the square of nothing: three fractions saying which part of an
	 * image to draw, beside no image. The two are one row and every column of
	 * {@code photo} is NOT NULL, so the sentence is that they leave together or not at
	 * all.
	 *
	 * <p><b>Asked as a property of every record and not as a list of the records this
	 * fixture happens to hold.</b> A list has to be right about teams nobody has written
	 * yet and is wrong the day one arrives; „these two are null together" is right or
	 * wrong once per record and has no direction in which it can be incomplete.
	 *
	 * <p><b>And the property is pinned before it is asserted</b>, because it is vacuous
	 * over an answer where every team has a mark and equally vacuous over one where none
	 * has: both states are read off the answer first.
	 */
	@Test
	void aTeamAnswersWithBothHalvesOfItsMarkOrNeither() throws Exception {
		JsonNode teams = answer();

		List<Boolean> hasAMark = StreamSupport.stream(teams.spliterator(), false)
				.map(one -> !one.path(THE_TEAMS_MARK).isNull()).toList();

		assertThat(hasAMark)
				.as("the answer does not hold both states of the mark (%s), so the claim below is"
						+ " about nothing", hasAMark)
				.contains(true, false);

		for (JsonNode one : teams) {
			assertThat(one.path(THE_TEAMS_MARK).isNull())
					.as("%s answered with one half of its mark and not the other - logo %s, crop"
							+ " %s. The picture and the square it is cut to are one row, so a"
							+ " square with no picture is the square of nothing and a picture"
							+ " with no square is one nobody chose",
							one.path("slug").asString(), one.path(THE_TEAMS_MARK),
							one.path("crop"))
					.isEqualTo(one.path("crop").isNull());
		}
	}

	@Test
	void nobodyHasToSignInToSeeTheTeams() throws Exception {
		assertThat(http.perform(get("/api/teams")).andReturn().getResponse().getStatus())
				.as("/api/teams asked a visitor to sign in")
				.isEqualTo(200);
	}

	/**
	 * THE VISITOR'S ANSWER HAS NOT MOVED, AND THAT IS THE FIRST THING THIS INCREMENT
	 * WAS MEASURED BY.
	 *
	 * <p>Asked in the two ways that fail differently: the name is nowhere in any
	 * record of the visitor's answer, and the visitor's answer is a member's answer
	 * with exactly that one key taken out. The second half is what a check on names
	 * cannot do - it holds the number of teams, their order and every value in them,
	 * so a condition written as a join would fail here with every name still right.
	 *
	 * <p><b>The second half is done on the TEXT and not on the parsed tree, and that
	 * is measured rather than preferred.</b> Written as „parse the member's answer,
	 * drop the key, write it out again and compare", it failed on an answer nothing
	 * was wrong with: the crop is {@code numeric(9,8)} and comes out as
	 * {@code 0.62000000}, which survives being parsed but not being written back, so
	 * the comparison was between two SERIALISATIONS rather than between two answers.
	 * Cutting the one substring the field adds leaves every other byte exactly as the
	 * server wrote it.
	 */
	@Test
	void theVisitorsAnswerHasNotMoved() throws Exception {
		for (JsonNode one : new ObjectMapper().readTree(whole(null))) {
			assertThat(Answers.fieldsOf(one))
					.as("a visitor was told something about a seat, on the record of %s",
							one.path("slug").asString())
					.doesNotContain(WHETHER_THE_SEAT_IS_MINE);
		}

		assertThat(whole(FOUNDED_THE_SECOND_TEAM)
				.replace(",\"" + WHETHER_THE_SEAT_IS_MINE + "\":true", "")
				.replace(",\"" + WHETHER_THE_SEAT_IS_MINE + "\":false", ""))
				.as("signing in changed something other than the one field it was allowed to")
				.isEqualTo(whole(null));
	}

	/**
	 * AND THE MEMBER'S ANSWER CARRIES NOTHING NOBODY NAMED, which is the same floor
	 * the visitor's answer stands on, asked of the answer that differs.
	 *
	 * <p>The one omission is still an omission - the seat, because Article 73 makes no
	 * role inside a team public - and the one thing added is named, with
	 * {@code Answers} checking that the portal really does not serve that name. The
	 * mark left this list on 21.09.2026 in the same commit that gave it an address, and
	 * both halves of the floor above say why it could not have been left behind.
	 */
	@Test
	void theMembersAnswerCarriesNothingNobodyNamed() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/teams asked by a member",
				new ObjectMapper().readTree(whole(FOUNDED_THE_SECOND_TEAM)), "teams.json",
				java.util.Set.of(WHETHER_THE_SEAT_IS_MINE), WHO_ADMINISTERS_THE_TEAM);
	}

	/**
	 * A MEMBER IS TOLD WHICH TEAM IS HIS TO RUN, AND IS TOLD NOTHING ABOUT ANYBODY
	 * ELSE'S.
	 *
	 * <p>Article 73 makes „Tim" public and makes no role inside one public, so the
	 * seat does not leave as a member number (the case above this one holds that over
	 * the whole text). What every screen that read the number actually asked was
	 * whether the READER holds the seat - {@code runs === memberNumber} three times in
	 * {@code pages/TeamDetail.tsx}, and a guard in {@code pages/member/EditTeam.tsx} -
	 * and that is what comes back.
	 *
	 * <p><b>Four callers, because one answer can be right for three wrong reasons.</b>
	 *
	 * <ul>
	 * <li><b>The founder of the SECOND team</b> is asked first and on purpose. The
	 * teams come back in name order, so a resource that marked the first record, or
	 * the caller's own record, or simply the first team a member is in, would all
	 * agree with the right answer for the founder of the first one.</li>
	 * <li><b>The founder of the FIRST team</b>, so the two are not the same place.</li>
	 * <li><b>A member who is IN a team and founded none</b> is told nothing is his,
	 * which is the substitution a query joining {@code team_membership} would
	 * make.</li>
	 * <li><b>And a team whose seat is empty</b> answers FALSE rather than nothing,
	 * which is the difference between „you did not found this" and „I do not know who
	 * you are". Without it the two sentences are one and a visitor cannot be told
	 * apart from a stranger.</li>
	 * </ul>
	 */
	@Test
	void aMemberIsToldWhichTeamIsHisToRunAndNothingAboutTheRest() throws Exception {
		assertThat(addresses()).as("the teams no longer come back in this order, so „the second"
						+ " team" + " " + "is not the second record and this case measures nothing")
				.containsExactly("novosadski-trkaci", "klub-lovcen", "vardarski-krug");

		assertThat(mineAccordingTo(FOUNDED_THE_SECOND_TEAM))
				.as("the member who founded the SECOND team was not told it is his, or was told"
						+ " somebody else's is")
				.containsExactly("klub-lovcen");

		assertThat(mineAccordingTo(FOUNDED_THE_FIRST_TEAM))
				.as("the member who founded the FIRST team was not told it is his, or was told"
						+ " somebody else's is")
				.containsExactly("novosadski-trkaci");

		assertThat(mineAccordingTo(FOUNDED_NOTHING))
				.as("a member who is in a team but founded none was told a team is his to run,"
						+ " so the answer is about being in it rather than about the seat")
				.isEmpty();

		assertThat(db.sql("select count(*) from team where admin_id is null")
				.query(Integer.class).single())
				.as("no team in the fixture has an empty seat, so the claim below asserts nothing")
				.isEqualTo(1);

		JsonNode noSeat = StreamSupport.stream(
						new ObjectMapper().readTree(whole(FOUNDED_NOTHING)).spliterator(), false)
				.filter(one -> one.path("slug").asString().equals("vardarski-krug"))
				.findFirst().orElseThrow();

		assertThat(Answers.fieldsOf(noSeat))
				.as("a team whose seat nobody holds answered a signed in member with nothing at"
						+ " all, which is what a visitor is told; the two must not read alike")
				.contains(WHETHER_THE_SEAT_IS_MINE);
		assertThat(noSeat.path(WHETHER_THE_SEAT_IS_MINE).asBoolean())
				.as("a team whose seat nobody holds was answered as the caller's own")
				.isFalse();
	}

	/**
	 * AND AN ACCOUNT THAT RACES FOR NOBODY IS ANSWERED WHAT A VISITOR IS, TO THE BYTE.
	 *
	 * <p>V23 leaves {@code account.competitor_id} empty for an account that does not
	 * race (owner, 14.09.2026), so being signed in and being a member are two
	 * questions. A resource that compared the seat with the ACCOUNT rather than with
	 * the member would hand this caller a team belonging to whoever holds that key,
	 * and the keys of two different tables agreeing by accident is how that reads
	 * right in a fixture.
	 */
	@Test
	void anAccountThatRacesForNobodyIsAnsweredWhatAVisitorIs() throws Exception {
		assertThat(db.sql("select competitor_id from account where email = ?")
				.param(RACES_FOR_NOBODY).query(Long.class).list().get(0))
				.as("the account names a member after all, so this case measures the wrong thing")
				.isNull();

		assertThat(whole(RACES_FOR_NOBODY))
				.as("an account with no member behind it was told something about a seat")
				.isEqualTo(whole(null));
	}

}
