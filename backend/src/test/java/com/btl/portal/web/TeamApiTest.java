package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.Location;
import org.flywaydb.core.api.MigrationInfo;
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

import java.io.InputStream;
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

	/**
	 * Founded the team that comes back FIRST, which is the source the next one separates,
	 * AND SINCE 21.09.2026 THE MODERATOR WHO HOLDS THE RIGHT OVER THE TEAMS.
	 *
	 * <p><b>One account in two roles on purpose, and it is the case the owner asked for
	 * by name.</b> {@code foundedByMe} exists only for a signed in founder and the seat
	 * exists only for the administration, so somebody who is both is the only caller
	 * whose answer carries them together. Written as two accounts, „both arrive" would
	 * be a sentence nothing in the suite ever measured, and the two fields would be free
	 * to be one another's condition without anything noticing.
	 *
	 * <p><b>He is a FOUNDER and not merely a member, which is what makes the
	 * substitution measurable.</b> His own number sits in a seat - the first team's - so
	 * a resource answering the caller's own number across every record is answering a
	 * number that really is in the database and really is somebody's seat, and only the
	 * OTHER two teams tell it apart from the truth.
	 */
	private static final String FOUNDED_THE_FIRST_TEAM_AND_ADMINISTERS_THEM = "jelena@primer.rs";

	/** Founded the team that comes back SECOND, so „mine" and „the first" are two places. */
	private static final String FOUNDED_THE_SECOND_TEAM = "dusan@primer.rs";

	/** In a team and founded none, which is the substitution „is in it" would make. */
	private static final String FOUNDED_NOTHING = "ana@primer.rs";

	/**
	 * Signed in, no member behind the account at all, AND A MODERATOR WHO HOLDS NOTHING
	 * OVER THE TEAMS.
	 *
	 * <p>He is the state of „who is asking" that is easiest to miss and the one the rule
	 * is really about: PDL P13, 31.07.2026, gives the seat to „Superadmin ili moderator
	 * sa pravom nad timovima", so a moderator WITHOUT that tick is on the far side of the
	 * line while looking like somebody on the near one. He is deliberately ticked for
	 * something else, so what refuses him is the right this resource asks for and not the
	 * absence of any right at all - {@code AdminRights.mayDoAnything} would answer yes
	 * about him.
	 */
	private static final String RACES_FOR_NOBODY = "moderator@primer.rs";

	/** And the other half of „Superadmin ili moderator sa pravom", who races for nobody. */
	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	/**
	 * THE FIVE STATES OF „WHO IS ASKING", SPLIT BY THE ONE LINE PDL P13 DRAWS.
	 *
	 * <p>Written out rather than derived, because what each account IS is the thing the
	 * fixture decides and nothing can read back. What IS derived is that the split is
	 * complete: {@code everyAccountInTheFixtureIsOnOneSideOfTheLineOrTheOther} reads
	 * every address out of {@code account} and requires these two lists to be exactly
	 * that set, so a sixth account added tomorrow has to be put on a side rather than
	 * quietly measured by nothing. The visitor is the {@code null} below, which is the
	 * same request without the cookie and is not an account.
	 */
	private static final List<String> NOBODY_WHO_MAY_SEE_THE_SEAT =
			java.util.Arrays.asList(null, FOUNDED_THE_SECOND_TEAM, FOUNDED_NOTHING,
					RACES_FOR_NOBODY);

	/** And the two PDL P13 names, „Superadmin ili moderator sa pravom nad timovima". */
	private static final List<String> THE_ADMINISTRATION =
			List.of(FOUNDED_THE_FIRST_TEAM_AND_ADMINISTERS_THEM, THE_SUPERADMIN);

	/** What a team whose seat names nobody answers the administration with (V11). */
	private static final String NOBODY_IS_NAMED_TO_THIS_SEAT = "";

	/**
	 * THE WHOLE COMMENT V11 WRITES OVER {@code team.admin_id}, AS GOLDEN TEXT.
	 *
	 * <p>It is a value and not a sentence in a comment, and that is the whole reason it
	 * is here: a quotation drifts from the document it quotes, and nothing can check a
	 * comment. {@code theV11CommentThisFileKeepsIsStillWhatTheMigrationSays} reads the
	 * migration through Flyway and compares the two, so this string is the one home of
	 * that comment in this file and the javadoc below points at it rather than retyping
	 * it.
	 *
	 * <p><b>The WHOLE comment and not the clause the seat case cares about</b>, which is
	 * the correction of the third round. Held as a fragment, it was compared by finding
	 * its own opening words in the migration and matching from there to the end, so
	 * cutting the fragment's HEAD moved the place the comparison started and the whole
	 * thing stayed green: the text could be cut to seven of its forty four words and
	 * nothing failed. That is the shape ADL A33's addition of 07.09.2026 is about, a
	 * reading that has to anchor or filter and therefore has no bottom, and the answer
	 * written there is this one: compare the whole text with a golden copy. There is no
	 * anchor left to move.
	 *
	 * <p><b>The cost is named rather than discovered:</b> every change to that comment in
	 * V11 now has to be made here too. That is deliberate and it falls exactly where the
	 * decision is, because a migration is immutable once merged (ADL A2), so the day
	 * this has to change is the day somebody is doing something that deserves to be
	 * read.
	 */
	private static final String V11_ON_THE_ADMIN_ID_COLUMN =
			"Who administers it. The founder to begin with (owner, 04.09.2026), and a"
					+ " moderator may hand it to somebody else. It EMPTIES rather than blocking"
					+ " anything: when the seat is vacant the portal reads the member who has been"
					+ " in the team longest, and that is a query, not a column. So this says who"
					+ " was NAMED, and nothing here pretends it is always somebody.";


	private final Map<String, SecretToken> sessions = new HashMap<>();

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/** Asked where its migrations live and what the applied script is called (V11 above). */
	@Autowired
	private Flyway flyway;

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
		/* AND HE IS THE MODERATOR WITH THE RIGHT OVER THE TEAMS, which makes him the one
		   caller whose answer carries both conditional fields. See the note on the
		   constant for why the two roles are one account rather than two. */
		account(FOUNDED_THE_FIRST_TEAM_AND_ADMINISTERS_THEM, "moderator");
		belongsTo(FOUNDED_THE_FIRST_TEAM_AND_ADMINISTERS_THEM, "000001");
		/* THE BOX IS TICKED WITH THE WORD V5 WRITES AND NOT WITH THE CONSTANT THE
		   RESOURCE ASKS BY, and that is the difference between measuring two things and
		   measuring one twice. Taken from `TeamApi.OVER_THE_TEAMS`, a misspelt constant
		   would tick the misspelt box and this moderator would be answered exactly the
		   same either way - one value in two roles, so right and wrong give the same
		   list. Written out, the two are independent: a constant that drifts leaves this
		   tick where it is, the moderator is refused and the SUPERADMIN is let through,
		   and that is the leak `RightIsNeeded` describes. Its own floor is
		   `account_admin_right_right_fk`, which refuses a word `admin_right` does not
		   hold. */
		ticked(FOUNDED_THE_FIRST_TEAM_AND_ADMINISTERS_THEM, "entity:teams");
		account(FOUNDED_THE_SECOND_TEAM, "competitor");
		belongsTo(FOUNDED_THE_SECOND_TEAM, "000003");
		account(FOUNDED_NOTHING, "competitor");
		belongsTo(FOUNDED_NOTHING, "000004");
		/* V23 leaves `account.competitor_id` empty for an account that does not race
		   (owner, 14.09.2026), which is the case that keeps „signed in" and „is a
		   member" from being one question. */
		account(RACES_FOR_NOBODY, "moderator");
		/* AND HE HOLDS A RIGHT, just not this one, so what refuses him is the right this
		   resource asks for rather than his holding nothing at all. The scope matters as
		   much as the target here: `queue:teams` is a right over the teams SOMEBODY
		   PROPOSED and would be the near miss, but it is measured by
		   `theRightRefusedIsTheOneOverTheTeamsAndNotSomeOtherWord` rather than by this
		   tick, which is deliberately about a different thing altogether. */
		ticked(RACES_FOR_NOBODY, "entity:events");

		/* AND THE OTHER HALF OF „Superadmin ili moderator sa pravom", who races for
		   nobody. He is the case that catches a condition written against the caller's
		   MEMBER rather than against his account: with no member at all he would be
		   answered nothing, and he is exactly the account PDL P13 names first. */
		account(THE_SUPERADMIN, "superadmin");
	}

	/** One box of the matrix, ticked for one named account (V18). */
	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
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

	/**
	 * A PERSON WHO REGISTERED AND IS NOT A MEMBER, which V16 made a row that can exist
	 * and nothing since has kept out of a team's seat.
	 *
	 * <p>Written as its own helper rather than as a null passed to {@link #member} so
	 * that the two are not one call with a flag: a member and a registrant differ in the
	 * one column this whole increment turns on, and a reader of the fixture has to see
	 * which one he is looking at. He is {@code active = false} for the same reason the
	 * column is empty - he has not paid - which is the state {@code CompetitorApi} keeps
	 * off its list anyway.
	 *
	 * @return his {@code competitor.id}, which is what a seat is filled by
	 */
	private long registrant(String first, String last, String referralCode) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, city, country_id, first_season,"
						+ " first_season_2027, active, membership_basis, referral_code, bio,"
						+ " profile_hidden, birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at, photo_id)"
						+ " values (null, ?, ?, 'M', date '1990-01-01',"
						+ " (select id from place where name = 'Beograd'), null, null,"
						+ " 2027, false, false, 'payment', ?, '', false, 'none', 'Otac',"
						+ " 'Ulica 2', 'L', timestamptz '2026-09-01 10:00:00+00', null)"
						+ " returning id")
				.params(first, last, referralCode).query(Long.class).single();
	}

	/** Puts somebody in a team's seat by KEY, which is what {@code team.admin_id} is. */
	private void sits(long competitorId, String slug) {
		db.sql("update team set admin_id = ? where slug = ?").params(competitorId, slug).update();
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
	 * EVERY FIELD THE PORTAL READS IS ANSWERED TO THE VISITOR, EXCEPT THE ONE THAT IS
	 * NOT HIS TO SEE, and it is named here with the reason.
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
	 * <p><b>Since 21.09.2026 it is an omission from THIS answer and not from every
	 * one</b>, which is what {@code theAdministrationsRecordCarriesNothingNobodyNamed}
	 * asks from the other end: the same floor over the answer of the two PDL P13 names,
	 * where the field is not an omission at all. The two together are the whole
	 * sentence, and neither half says it alone.
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
	 *
	 * <p><b>SINCE 21.09.2026 IT IS ASKED OF THE FOUR CALLERS THE SEAT DOES NOT LEAVE
	 * TO, and of the administration it asks the half that is still true.</b> The seat
	 * does leave to „Superadmin ili moderator sa pravom nad timovima" (PDL P13), so for
	 * those two „no member number at all" is no longer the sentence. What is still the
	 * sentence, and is the one that matters, is that the ROSTER does not leave to
	 * anybody: every member who is in no team's seat is absent from their answer too.
	 * The fixture holds exactly such a member - 000002, who is in a team and sits in no
	 * seat - so that half is measured by a value and not by an empty set.
	 */
	@Test
	void noMemberNumberLeavesTheServer() throws Exception {
		/* The rows that HAVE one, which is what this case is about. V16 made the column
		   nullable, so „every member number in the database" and „every row in
		   `competitor`" stopped being the same question, and a null read into the loop
		   below would ask `doesNotContain(null)` rather than asking anything. */
		List<String> numbers = db.sql("select member_number from competitor"
				+ " where member_number is not null").query(String.class).list();
		assertThat(numbers).as("no member number was read out of the database, so the loops below"
				+ " assert nothing").hasSize(4);

		for (String nobody : NOBODY_WHO_MAY_SEE_THE_SEAT) {
			String whole = whole(nobody);

			assertThat(whole).as("the answer to %s carries nothing at all, so it says nothing"
							+ " about what it leaves out", nobody)
					.contains("vardarski-krug", "novosadski-trkaci", "klub-lovcen");

			for (String number : numbers) {
				assertThat(whole).as("a member number (%s) left the server with a team, to %s, who"
								+ " is not the administration. Clan 73 makes the team public and"
								+ " names no role inside one: who is in which team is"
								+ " /api/competitors' one answer, and who administers one is a"
								+ " right rather than a standing", number, nobody)
						.doesNotContain(number);
			}
		}

		List<String> inNoSeat = db.sql("select member_number from competitor where id not in"
				+ " (select admin_id from team where admin_id is not null)"
				+ " and member_number is not null").query(String.class).list();
		assertThat(inNoSeat).as("every member in the fixture sits in a seat, so the loop below"
				+ " asserts nothing about the roster").isNotEmpty();

		for (String administration : THE_ADMINISTRATION) {
			String whole = whole(administration);

			for (String number : inNoSeat) {
				assertThat(whole).as("a member number (%s) that sits in no team's seat left the"
								+ " server to %s. The seat is what PDL P13 lets the administration"
								+ " read; who is IN a team is still /api/competitors' one answer,"
								+ " and a join to team_membership is what answers it twice",
								number, administration)
						.doesNotContain(number);
			}
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
	 * <p>The one omission is still an omission - the seat, because a member is not the
	 * administration and Article 73 makes no role inside a team public - and the one
	 * thing added is named, with {@code Answers} checking that the portal really does
	 * not serve that name. The mark left this list on 21.09.2026 in the same commit that
	 * gave it an address, and both halves of the floor above say why it could not have
	 * been left behind.
	 *
	 * <p><b>This caller founded a team and is still refused the seat</b>, which is the
	 * sharp end of PDL P13: being the one IN the seat is not being one of the two who
	 * may read who is. What he gets instead is {@code foundedByMe}, and it is his own
	 * fact and nobody else's.
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

		assertThat(mineAccordingTo(FOUNDED_THE_FIRST_TEAM_AND_ADMINISTERS_THEM))
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
				.as("a team whose seat names nobody answered a signed in member with nothing at"
						+ " all, which is what a visitor is told; the two must not read alike")
				.contains(WHETHER_THE_SEAT_IS_MINE);
		assertThat(noSeat.path(WHETHER_THE_SEAT_IS_MINE).asBoolean())
				.as("a team whose seat names nobody was answered as the caller's own")
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
	 *
	 * <p><b>He is also a moderator holding no right over the teams, and since
	 * 21.09.2026 that is the half of him this case has to say out loud.</b> Without the
	 * line below, ticking that box for him tomorrow would turn the sentence above into
	 * a different one and nothing would say so: he would be answered more than a
	 * visitor for a reason that has nothing to do with racing for nobody.
	 */
	@Test
	void anAccountThatRacesForNobodyIsAnsweredWhatAVisitorIs() throws Exception {
		assertThat(db.sql("select competitor_id from account where email = ?")
				.param(RACES_FOR_NOBODY).query(Long.class).list().get(0))
				.as("the account names a member after all, so this case measures the wrong thing")
				.isNull();

		/* The word and not `TeamApi.OVER_THE_TEAMS`, for the reason written beside the
		   tick in the fixture: this is a sentence about the FIXTURE, and read through the
		   constant it would go on passing while the constant drifted. */
		assertThat(db.sql("select count(*) from account_admin_right"
						+ " where account_id = (select id from account where email = ?)"
						+ " and right_code = ?")
				.params(RACES_FOR_NOBODY, "entity:teams").query(Integer.class).single())
				.as("this moderator holds the right over the teams after all, so he is no longer"
						+ " answered what a visitor is for a reason that has nothing to do with"
						+ " racing for nobody")
				.isZero();

		assertThat(whole(RACES_FOR_NOBODY))
				.as("an account with no member behind it was told something about a seat")
				.isEqualTo(whole(null));
	}

	/**
	 * THE ADMINISTRATION IS THE ONLY ONE TOLD WHO SITS IN THE SEAT, AND EVERYBODY ELSE
	 * IS TOLD ON NO RECORD - THEIR OWN TEAM INCLUDED.
	 *
	 * <p>PDL P13, 13.09.2026: „Sa druge strane granice stoji sve sto o timu govori kroz
	 * njegove ljude: <b>ko ga vodi</b> ({@code admin_id}), ko je u njemu... To ne
	 * izlazi." ADL of the same day says where it goes instead: „javno je ono sto Clan 73
	 * nabraja, i nista vise. Sve ostalo ceka resurs koji zna ko pita." And who it waits
	 * for is the owner's own list: „Administratora tima postavlja Superadmin ili
	 * moderator sa pravom nad timovima" (PDL P13, 31.07.2026).
	 *
	 * <p><b>Five kinds of caller and not two, and the moderator WITHOUT the right is
	 * the one this case exists for.</b> He is signed in, he is a moderator, he holds a
	 * right - and he is on the far side of the line. A resource that asked „is he
	 * staff" instead of „may he" answers him, and nothing about that reads wrong.
	 *
	 * <p><b>Asked over EVERY record and by KEY rather than by value.</b> A key carrying
	 * the empty string says „nobody is named to this seat" to a screen that reads it,
	 * and it would say that about every team in the league; that is the difference
	 * between absent and empty and it is the whole of this field's shape.
	 */
	@Test
	void theAdministrationIsTheOnlyOneToldWhoSitsInTheSeat() throws Exception {
		for (String nobody : NOBODY_WHO_MAY_SEE_THE_SEAT) {
			for (JsonNode one : new ObjectMapper().readTree(whole(nobody))) {
				assertThat(Answers.fieldsOf(one))
						.as("%s was told who administers a team, on the record of %s; PDL P13"
								+ " names the superadmin and a moderator with the right over the"
								+ " teams, and nobody else", nobody, one.path("slug").asString())
						.doesNotContain(WHO_ADMINISTERS_THE_TEAM);
			}
		}

		for (String administration : THE_ADMINISTRATION) {
			JsonNode answer = new ObjectMapper().readTree(whole(administration));

			assertThat(StreamSupport.stream(answer.spliterator(), false)
					.filter(one -> !Answers.fieldsOf(one).contains(WHO_ADMINISTERS_THE_TEAM))
					.map(one -> one.path("slug").asString()).toList())
					.as("%s is the administration and a record of his answer does not say who"
							+ " administers that team", administration)
					.isEmpty();

			assertThat(answer).as("%s was answered an empty list, so the check above compared"
					+ " nothing", administration).isNotEmpty();
		}
	}

	/**
	 * AND THE NUMBER HE IS TOLD IS THE ONE IN THAT TEAM'S SEAT, NOT HIS OWN AND NOT THE
	 * ONE IN THE FIRST SEAT.
	 *
	 * <p><b>This is the substitution {@code foundedByMe}'s own shape invites.</b> The
	 * field beside this one is answered {@code case when t.admin_id = :me}, and the same
	 * line copied onto this one would hand a moderator his own team and nothing else -
	 * or, worse, his own number written across every record. The fixture refuses both by
	 * a VALUE and not by a length: the caller who holds the right founded the FIRST team,
	 * so his own number really is in a seat and really is in the answer, and only the
	 * other two teams tell the truth from the copy.
	 *
	 * <p><b>What is compared is read out of the database</b>, so a fixture changed
	 * tomorrow is measured without anybody remembering this case - and the map is
	 * compared whole, which holds the pairing as well as the numbers. A resource
	 * answering the right numbers against the wrong teams passes a check on the set and
	 * fails this one.
	 *
	 * <p><b>And it is pinned first that no two seats agree</b>, because over a fixture
	 * where every team had the same administrator a constant would satisfy all of it.
	 */
	@Test
	void theAdministrationIsToldWhoSitsInEverySeat() throws Exception {
		Map<String, String> inTheSeats = new HashMap<>();

		for (Map.Entry<String, String> row : db.sql("select t.slug,"
						+ " coalesce(seat.member_number, '') from team t"
						+ " left join competitor seat on seat.id = t.admin_id")
				.query((one, number) -> Map.entry(one.getString(1), one.getString(2))).list()) {
			inTheSeats.put(row.getKey(), row.getValue());
		}

		assertThat(inTheSeats.values().stream().distinct().toList())
				.as("every team in the fixture is administered by the same member, so answering"
						+ " with a constant would satisfy this case")
				.hasSizeGreaterThan(1);

		String his = db.sql("select member_number from competitor where id ="
						+ " (select competitor_id from account where email = ?)")
				.param(FOUNDED_THE_FIRST_TEAM_AND_ADMINISTERS_THEM).query(String.class).single();

		assertThat(inTheSeats).as("the caller's own number stands in no seat, so this case cannot"
				+ " tell his own from the team's").containsValue(his);

		assertThat(inTheSeats.values().stream().filter(one -> !one.equals(his)).toList())
				.as("no team the moderator looks at is administered by anybody but himself (%s),"
						+ " so serving him his own across the whole answer would pass", his)
				.isNotEmpty();

		for (String administration : THE_ADMINISTRATION) {
			Map<String, String> answered = new HashMap<>();

			for (JsonNode one : new ObjectMapper().readTree(whole(administration))) {
				answered.put(one.path("slug").asString(),
						one.path(WHO_ADMINISTERS_THE_TEAM).asString());
			}

			assertThat(answered)
					.as("%s was told a number that is not the one in that team's seat; the"
							+ " caller's own is %s", administration, his)
					.isEqualTo(inTheSeats);
		}
	}

	/**
	 * A SEAT THAT NAMES NOBODY IS ANSWERED EMPTY AND NEVER ABSENT, which is the third
	 * sentence this field has to say and the one a boolean field never needs.
	 *
	 * <p>V11 made {@code team.admin_id} nullable on purpose, and what it writes over that
	 * column is {@link #V11_ON_THE_ADMIN_ID_COLUMN}, kept there once instead of being
	 * retyped here so that {@code theV11CommentThisFileKeepsIsStillWhatTheMigrationSays}
	 * can hold it against the migration itself. So the answer has three things to say: „I am not
	 * telling you", „nobody is named to this seat", and a number. Absent is the first
	 * and the empty string is the second, which is also the shape the portal already
	 * reads: the served file writes {@code ""} for the team that has none and
	 * {@code frontend/src/data/types.ts} types the field {@code string}, not
	 * {@code string | null}.
	 *
	 * <p><b>Answered null the second would arrive spelt as the first</b>, because
	 * {@code @JsonInclude} takes the key out - and the administration would be told „you
	 * may not see this" about the one team whose seat it is there to fill. Both halves
	 * are asked: the key is THERE, and what is in it is the empty string.
	 */
	@Test
	void aSeatThatNamesNobodyIsAnsweredEmptyAndNeverAbsent() throws Exception {
		assertThat(db.sql("select count(*) from team where admin_id is null")
				.query(Integer.class).single())
				.as("no team in the fixture has an empty seat, so this case asserts nothing")
				.isEqualTo(1);

		for (String administration : THE_ADMINISTRATION) {
			JsonNode vacant = StreamSupport.stream(
							new ObjectMapper().readTree(whole(administration)).spliterator(), false)
					.filter(one -> one.path("slug").asString().equals("vardarski-krug"))
					.findFirst().orElseThrow();

			assertThat(Answers.fieldsOf(vacant))
					.as("a team whose seat names nobody answered %s with no key at all, which is"
							+ " what somebody who may not see it is told; „I am not telling you"
							+ " who administers this" + " "
							+ "and „nobody is named to this seat" + " "
							+ "must not read alike", administration)
					.contains(WHO_ADMINISTERS_THE_TEAM);

			/* ASKED OF THE NODE, because `asString()` reads a null node back as the EMPTY
			   STRING and this case is named for telling those two apart. Measured on the
			   spisak of 21.09.2026: written `path(...).asString()` it sat green through a
			   query answering null for every empty seat, which is one of the four states
			   wearing another one's clothes - the very thing the case exists to refuse. */
			JsonNode seat = vacant.get(WHO_ADMINISTERS_THE_TEAM);

			assertThat(seat.isNull() ? null : seat.asString())
					.as("a team whose seat names nobody answered %s with somebody, or with the"
							+ " null that means „somebody holds it and I cannot name him\"",
							administration)
					.isEqualTo(NOBODY_IS_NAMED_TO_THIS_SEAT);
		}
	}

	/**
	 * AND THE COMMENT THE CASE ABOVE LEANS ON IS STILL WHAT THE MIGRATION SAYS.
	 *
	 * <p><b>Written because that claim had no floor.</b> The case above reads V11 and
	 * says what it reads is whole; until this one existed a line could be taken out of
	 * {@link #V11_ON_THE_ADMIN_ID_COLUMN} and the whole suite stayed green. That is the
	 * very defect the text is about: what stood there until 21.09.2026 stopped at the
	 * colon, one clause short of the sentence that overturns it, and nothing said so.
	 *
	 * <p><b>WHOLE TEXT AND NOT A FRAGMENT, which is the correction of the third round.</b>
	 * The first two drafts held only the clause the seat cares about and found it in the
	 * migration by its own opening words, matching from there to the end. Cutting the
	 * fragment's HEAD moved the place the match began, so the comparison still succeeded:
	 * measured, the text could be cut to seven of its forty four words and the case
	 * stayed green. ADL A33's addition of 07.09.2026 names that shape - a reading that
	 * has to anchor or filter has no bottom, and every round closes one direction and
	 * leaves the next open - and prescribes this: compare the whole text with a golden
	 * copy. Nothing here anchors on the constant any more, so there is no head to cut.
	 *
	 * <p><b>Flyway is asked where the migration lives and what the applied script is
	 * called.</b> Only the VERSION is named here, because the version is the fact this
	 * case is about; a path written out would be a second copy of two Flyway settings,
	 * and a setting written down twice is a setting that moves in one of the two places.
	 * The form is {@code DatabaseTest.migrationSql}'s, which does exactly this.
	 *
	 * <p><b>Whitespace is flattened on both sides</b>, because the migration wraps the
	 * comment over four lines inside a comment frame and this file wraps it again. A
	 * text is not a different text for being broken differently.
	 */
	@Test
	void theV11CommentThisFileKeepsIsStillWhatTheMigrationSays() throws Exception {
		String version = "11";

		MigrationInfo applied = java.util.Arrays.stream(flyway.info().applied())
				.filter(one -> one.getVersion() != null
						&& version.equals(one.getVersion().getVersion()))
				.findFirst()
				.orElseThrow(() -> new AssertionError("no migration " + version + " was applied"));

		String folder = java.util.Arrays.stream(flyway.getConfiguration().getLocations())
				.map(Location::getPath)
				.findFirst()
				.orElseThrow(() -> new AssertionError("Flyway is configured with no location"));

		String sql;
		try (InputStream open = getClass().getClassLoader()
				.getResourceAsStream(folder + "/" + applied.getScript())) {
			assertThat(open).as("%s is not under %s, where Flyway says its migrations are, so this"
					+ " case compares nothing", applied.getScript(), folder).isNotNull();
			sql = new String(open.readAllBytes(), StandardCharsets.UTF_8);
		}

		int column = sql.indexOf("admin_id");
		assertThat(column).as("%s no longer names an admin_id column, so there is no comment on"
				+ " one to compare", applied.getScript()).isNotNegative();

		String above = sql.substring(0, column);
		int closes = above.lastIndexOf("*/");
		int opens = above.lastIndexOf("/*", closes);
		assertThat(opens).as("the admin_id column of %s no longer carries a comment above it, so"
				+ " there is nothing there to compare", applied.getScript()).isNotNegative();

		assertThat(above.substring(opens + 2, closes).replaceAll("\\s+", " ").trim())
				.as("the comment over admin_id in %s and the golden copy of it in this file have"
						+ " come apart. Whichever moved, the seat case above is reasoning from a"
						+ " sentence the database no longer carries, and that is how the cut quote"
						+ " of 21.09.2026 survived in the first place", applied.getScript())
				.isEqualTo(V11_ON_THE_ADMIN_ID_COLUMN);
	}

	/**
	 * AND A SEAT HELD BY SOMEBODY WHO IS NOT A MEMBER IS NOT AN EMPTY SEAT, which is a
	 * FOURTH sentence and was being spelt as the second until 21.09.2026.
	 *
	 * <p><b>The row can exist and nothing keeps it out of the seat, which is measured
	 * here rather than assumed.</b> V16 dropped {@code not null} from
	 * {@code competitor.member_number} and named the trap itself - „a row in
	 * {@code competitor} is a PERSON WHO REGISTERED. A MEMBER is a row whose
	 * {@code member_number} is there. Any query that counted members by counting rows
	 * now counts applicants too" - and {@code team_admin_fk} (V11) points at
	 * {@code competitor (id)} with no condition on it. The case does not argue that: it
	 * writes such a row, seats it, and asks.
	 *
	 * <p><b>Written {@code coalesce(seat.member_number, '')} the answer said „nobody
	 * holds this seat" about a seat that is HELD</b>, and the administration's own
	 * screen draws a free chair off exactly that string - so a moderator would hand the
	 * team to somebody else without ever being told there was anyone there.
	 *
	 * <p><b>And the contradiction is inside ONE record, which is why this is a state and
	 * not a taste.</b> The caller here is the registrant himself AND holds the right over
	 * the teams, so one record of his answer carries both fields: {@code foundedByMe}
	 * compares {@code t.admin_id} to his KEY and answers true, and the field beside it
	 * used to answer „nobody founded this". One record cannot say both. That pairing is
	 * what makes a fourth shape necessary rather than merely tidier, and it is asserted
	 * rather than described.
	 *
	 * <p><b>Three states are pinned before the fourth is asked about</b>, because over a
	 * fixture where the empty seat had gone, or where every seat were this one, „the
	 * answer is null everywhere" would satisfy all of it.
	 */
	@Test
	void aSeatHeldByARegistrantIsNotAnEmptySeat() throws Exception {
		long registrant = registrant("Petar", "Nikolic", "9f8e7d6c5b4a3021");
		sits(registrant, "klub-lovcen");

		/* HE IS THE ADMINISTRATION AS WELL AS THE MAN IN THE SEAT, so the two fields meet
		   on one record. Role „moderator" and the tick V5 writes, the same way the fixture
		   ticks the other one. */
		String him = "petar@primer.rs";
		account(him, "moderator");
		db.sql("update account set competitor_id = ? where email = ?").params(registrant, him)
				.update();
		ticked(him, "entity:teams");

		assertThat(db.sql("select count(*) from team t join competitor seat on seat.id = t.admin_id"
						+ " where seat.member_number is null").query(Integer.class).single())
				.as("no seat in the fixture is held by somebody without a member number, so this"
						+ " case is about nothing")
				.isEqualTo(1);
		assertThat(db.sql("select count(*) from team where admin_id is null")
				.query(Integer.class).single())
				.as("no team has an empty seat any more, so „held by a registrant\" and „empty\""
						+ " cannot be told apart by this case")
				.isEqualTo(1);
		assertThat(db.sql("select count(*) from team t join competitor seat on seat.id = t.admin_id"
						+ " where seat.member_number is not null").query(Integer.class).single())
				.as("no seat is held by a member any more, so the third shape is not in the answer"
						+ " to compare against")
				.isEqualTo(1);

		for (String administration : List.of(THE_SUPERADMIN, him)) {
			JsonNode held = StreamSupport.stream(
							new ObjectMapper().readTree(whole(administration)).spliterator(), false)
					.filter(one -> one.path("slug").asString().equals("klub-lovcen"))
					.findFirst().orElseThrow();

			assertThat(Answers.fieldsOf(held))
					.as("the seat of a team held by somebody with no member number answered %s"
							+ " with no key at all, which is what somebody who may not see it is"
							+ " told", administration)
					.contains(WHO_ADMINISTERS_THE_TEAM);

			assertThat(held.path(WHO_ADMINISTERS_THE_TEAM).isNull())
					.as("a seat HELD by somebody with no member number read to %s exactly like a"
							+ " seat that names nobody (%s). The administration's screen draws a"
							+ " free chair off that string and would hand the team away over somebody"
							+ " sitting in it", administration,
							held.path(WHO_ADMINISTERS_THE_TEAM))
					.isTrue();
		}

		JsonNode his = StreamSupport.stream(new ObjectMapper().readTree(whole(him)).spliterator(),
						false).filter(one -> one.path("slug").asString().equals("klub-lovcen"))
				.findFirst().orElseThrow();

		assertThat(his.path(WHETHER_THE_SEAT_IS_MINE).asBoolean())
				.as("the man in the seat was not told the team is his, so the two fields on this"
						+ " record cannot contradict one another and the case measures half of"
						+ " what it says")
				.isTrue();
		/* ASKED OF THE NODE AND NOT THROUGH `asString()`, which is the trap this whole
		   field is about in miniature: a null node reads back as the empty string, so the
		   two shapes this case exists to keep apart arrive as one the moment anybody
		   flattens them. */
		JsonNode seat = his.get(WHO_ADMINISTERS_THE_TEAM);

		assertThat(seat.isNull() ? null : seat.asString())
				.as("one record told him „you founded this team\" and „nobody is named to this"
						+ " seat\" at once")
				.isNotEqualTo(NOBODY_IS_NAMED_TO_THIS_SEAT);
	}

	/**
	 * AND THE FOUR STATES OF THE SEAT ARE FOUR DIFFERENT SHAPES ON THE WIRE, asked of
	 * the shapes themselves rather than of any one of them.
	 *
	 * <p>The three cases above each hold one sentence. This one holds the thing they
	 * cannot: that no two of the four READ ALIKE. It is the check that fails the day
	 * somebody makes two of them agree by making the answer simpler - which is exactly
	 * how the fourth state came to be spelt as the second.
	 *
	 * <p><b>Read off the TEXT and not off a mapper</b>, because that is where the
	 * difference lives: „the key is not there", „the key is there and holds null", „the
	 * key is there and holds the empty string" and „the key is there and holds a number"
	 * are four spellings, and a tree read back through {@code asString()} flattens the
	 * first three into one.
	 *
	 * <p><b>And it is one answer for three of them</b>, so the comparison is between
	 * records of a single request and not between four requests that could each have
	 * been right about a different thing.
	 */
	@Test
	void theFourStatesOfTheSeatAreFourDifferentShapes() throws Exception {
		sits(registrant("Petar", "Nikolic", "9f8e7d6c5b4a3021"), "klub-lovcen");

		JsonNode answer = new ObjectMapper().readTree(whole(THE_SUPERADMIN));

		Map<String, String> shapes = new HashMap<>();

		for (JsonNode one : answer) {
			String slug = one.path("slug").asString();
			JsonNode seat = one.get(WHO_ADMINISTERS_THE_TEAM);

			shapes.put(slug, seat == null ? "no key at all"
					: seat.isNull() ? "the key holding null"
							: "the key holding \"" + seat.asString() + "\"");
		}

		assertThat(shapes).as("the administration was not answered the three teams this case"
				+ " compares").containsOnlyKeys("vardarski-krug", "klub-lovcen",
						"novosadski-trkaci");

		assertThat(shapes.values()).as("two of the three seats the administration can see read"
						+ " alike: %s. An empty seat, a seat held by somebody with no member"
						+ " number, and a seat held by a member are three facts and have to be"
						+ " three shapes", shapes)
				.doesNotHaveDuplicates();

		/* AND THE FOURTH, which is not in this answer because it is the answer somebody
		   else gets: the key absent altogether. Taken from the member who founded the
		   second team, who is on the far side of PDL P13's line. */
		assertThat(Answers.fieldsOf(StreamSupport.stream(
						new ObjectMapper().readTree(whole(FOUNDED_THE_SECOND_TEAM)).spliterator(),
						false).findFirst().orElseThrow()))
				.as("somebody who may not see the seat was answered a key, so „I am not telling"
						+ " you\" is not a shape of its own and the three above are all there are")
				.doesNotContain(WHO_ADMINISTERS_THE_TEAM);
	}

	/**
	 * AND THE SEAT MAY NAME A MEMBER THE ADMINISTRATION'S OWN LIST DOES NOT CARRY, which
	 * is pinned here because it is the owner's to decide and not this resource's.
	 *
	 * <p><b>Both lists are asked with the SAME cookie of the SAME caller</b>, which is
	 * the whole of the case: a difference between two callers would be authorisation
	 * working, and a difference between one caller's two lists is two rules disagreeing.
	 * {@code CompetitorApi} ends on {@code where c.active} by the owner's decision of
	 * 13.09.2026 (PDL P11, „ko nije platio, ne vidi se nigde"); this resource answers
	 * the seat whatever the fee has done. So {@code AdminTeams.tsx} is handed a number
	 * and {@code teamAdmin.ts} finds nobody in the roster to match it.
	 *
	 * <p><b>Nothing is decided by this case and that is deliberate.</b> The owner's rule
	 * of 13.09.2026 for a field in doubt is to leave it out and name the omission, and
	 * the field is already answered - taking it back out is one of the two costs he has
	 * to weigh, not a repair this increment may make on its own. What the case does is
	 * make the disagreement fail loudly on the day somebody closes it from either end,
	 * so that the decision is taken rather than drifted into.
	 *
	 * <p><b>Pinned on a lapsed member who really is in a seat</b>, and the pin is read
	 * out of the database so a fixture changed tomorrow is measured without anybody
	 * remembering this case.
	 */
	@Test
	void theSeatMayNameAMemberTheAdministrationsOwnListDoesNotCarry() throws Exception {
		String lapsed = db.sql("select seat.member_number from team t"
						+ " join competitor seat on seat.id = t.admin_id where not seat.active")
				.query(String.class).single();

		String teams = whole(THE_SUPERADMIN);
		String members = http.perform(get("/api/competitors")
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(THE_SUPERADMIN)
								.secret())))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

		assertThat(members).as("the superadmin was answered no members at all, so the comparison"
				+ " below is between a list and nothing").contains("000001");

		assertThat(teams).as("the seat of a team is no longer answered with the member whose fee"
						+ " has lapsed (%s), so the two lists no longer disagree and this case"
						+ " measures nothing. If that was decided, this case is what says so",
						lapsed)
				.contains(lapsed);

		assertThat(members).as("/api/competitors now carries the member whose fee has lapsed (%s),"
						+ " so the number the seat answers can be looked up after all. That is PDL"
						+ " P11 reopened for this audience, and it is a decision rather than a"
						+ " tidy-up: if it was taken, this case is what has to be rewritten",
						lapsed)
				.doesNotContain(lapsed);
	}

	/**
	 * AND THE ADMINISTRATION'S ANSWER IS THE VISITOR'S WITH THE TWO CONDITIONAL KEYS
	 * ADDED, which is the half no check on a name can measure.
	 *
	 * <p>The same sentence {@code theVisitorsAnswerHasNotMoved} holds from the other
	 * end: it keeps the number of teams, their order and every other value in them, so a
	 * condition written as a join - and this increment adds one, to
	 * {@code competitor} - fails here although every name is still right. A team joined
	 * to a member who is in it rather than to the one in its seat is the shape that
	 * gives a team as many rows as it has members, and the fixture has a team with
	 * three.
	 *
	 * <p><b>Cut on the TEXT and not on the parsed tree</b>, for the reason
	 * {@code theVisitorsAnswerHasNotMoved} writes out: the crop is {@code numeric(9,8)}
	 * and comes out as {@code 0.62000000}, which survives being parsed but not being
	 * written back, so a comparison of two serialisations measures the writer and not
	 * the answer.
	 *
	 * <p><b>Both of the administration are asked, and they differ by the other field.</b>
	 * The superadmin races for nobody, so his answer is the visitor's with ONE key
	 * added; the moderator founded a team, so his has both - and that is the case the
	 * owner asked for by name, measured here rather than assumed: the two fields arrive
	 * together, and neither is the other's condition.
	 */
	@Test
	void theAdministrationsAnswerIsTheVisitorsWithTheSeatAdded() throws Exception {
		for (String administration : THE_ADMINISTRATION) {
			String whole = whole(administration);

			for (JsonNode one : new ObjectMapper().readTree(whole)) {
				whole = whole.replace(",\"" + WHO_ADMINISTERS_THE_TEAM + "\":\""
						+ one.path(WHO_ADMINISTERS_THE_TEAM).asString() + "\"", "");
			}

			assertThat(whole.replace(",\"" + WHETHER_THE_SEAT_IS_MINE + "\":true", "")
					.replace(",\"" + WHETHER_THE_SEAT_IS_MINE + "\":false", ""))
					.as("%s was answered something other than the visitor's answer with the seat"
							+ " added: the list itself moved, or a key nobody named arrived with"
							+ " it", administration)
					.isEqualTo(whole(null));
		}

		JsonNode both = StreamSupport.stream(new ObjectMapper()
						.readTree(whole(FOUNDED_THE_FIRST_TEAM_AND_ADMINISTERS_THEM)).spliterator(),
				false).filter(one -> one.path("slug").asString().equals("novosadski-trkaci"))
				.findFirst().orElseThrow();

		assertThat(Answers.fieldsOf(both))
				.as("the caller who is BOTH the founder of this team and the administration was"
						+ " not answered both fields; each is the other's condition somewhere, and"
						+ " that is what this case exists to refuse")
				.contains(WHETHER_THE_SEAT_IS_MINE, WHO_ADMINISTERS_THE_TEAM);
		assertThat(both.path(WHETHER_THE_SEAT_IS_MINE).asBoolean())
				.as("the founder of this team was not told it is his").isTrue();
	}

	/**
	 * AND THE ADMINISTRATION'S RECORD CARRIES NOTHING NOBODY NAMED EITHER.
	 *
	 * <p>The same floor the visitor's answer and the member's stand on, moved onto the
	 * third audience - and here it has NO omission left to name, which is the whole of
	 * this increment as that floor sees it. {@code Answers} requires every name the
	 * portal serves to be answered and every name answered to be one somebody named, so
	 * the seat leaving this list is not a tidy-up: left in, it would fail the moment the
	 * field arrived.
	 *
	 * <p>The superadmin races for nobody, so his record is the served shape exactly; the
	 * moderator founded a team, so his carries the one extra name, and it is named.
	 */
	@Test
	void theAdministrationsRecordCarriesNothingNobodyNamed() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/teams asked by the superadmin",
				new ObjectMapper().readTree(whole(THE_SUPERADMIN)), "teams.json");

		Answers.everyFieldThePortalReadsIsAnswered(
				"/api/teams asked by a moderator over the teams",
				new ObjectMapper().readTree(whole(FOUNDED_THE_FIRST_TEAM_AND_ADMINISTERS_THEM)),
				"teams.json", java.util.Set.of(WHETHER_THE_SEAT_IS_MINE));
	}

	/**
	 * THE RIGHT THIS RESOURCE ASKS FOR IS ONE THE MATRIX REALLY HOLDS.
	 *
	 * <p><b>A floor and not a spelling check.</b> {@code RightIsNeeded} writes out what
	 * a misspelt right costs: every moderator is refused it and the SUPERADMIN is let
	 * through, because his mode answers yes to any string there is. So a typo here is a
	 * door that reads shut in every case written with a moderator and stands open for
	 * the one account that can do the most damage.
	 *
	 * <p><b>It is asked of {@code admin_right} because the annotations' own floor
	 * cannot see this one.</b> {@code everyRightARouteAsksForIsOneTheMatrixHolds} reads
	 * what the dispatcher declares; this route declares nothing, because it is open to
	 * everybody and only one field of its answer is guarded.
	 */
	@Test
	void theRightThisResourceAsksForIsOneTheMatrixHolds() {
		List<String> held = db.sql("select code from admin_right").query(String.class).list();

		assertThat(held).as("the matrix holds no rights at all, so anything would be in it")
				.isNotEmpty();

		assertThat(held)
				.as("this resource guards its field with a right the matrix does not hold; every"
						+ " moderator is refused it and the superadmin is let through, because his"
						+ " mode answers yes to any string there is")
				.contains(TeamApi.OVER_THE_TEAMS);
	}

	/**
	 * AND IT IS THE RIGHT OVER THE TEAMS THEMSELVES AND NOT THE ONE OVER THE TEAMS
	 * SOMEBODY PROPOSED, which is the near miss the matrix is built to allow.
	 *
	 * <p>V5 writes {@code ('entity', 'teams')} and {@code ('queue', 'teams')} as two
	 * rows, and {@code frontend/src/pages/admin/rights.ts} says why in as many words:
	 * „Leagues and teams do, both of them, so &quot;teams&quot; on its own would mean
	 * either editing the league or approving one somebody proposed, which are not
	 * remotely the same permission." A moderator trusted to let a PROPOSED team through
	 * is not thereby trusted with the teams that exist, and the screens that read this
	 * field are the entity form's.
	 *
	 * <p><b>Measured as behaviour and not as a comparison of two strings.</b> The
	 * moderator who holds the other one is answered the seat or he is not, and a
	 * resource asking for the wrong scope answers him - which no assertion about
	 * spelling would ever catch, because both words are in the matrix and both are
	 * spelt right.
	 */
	@Test
	void theRightRefusedIsTheOneOverTheTeamsAndNotSomeOtherWord() throws Exception {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:teams')")
				.param(RACES_FOR_NOBODY).update();

		assertThat(db.sql("select count(*) from account_admin_right"
						+ " where account_id = (select id from account where email = ?)")
				.param(RACES_FOR_NOBODY).query(Integer.class).single())
				.as("the ticks were not written, so this case measures nothing").isEqualTo(2);

		assertThat(whole(RACES_FOR_NOBODY))
				.as("a moderator holding the right over the QUEUE of proposed teams was told who"
						+ " administers the teams that exist; the two are different permissions"
						+ " and V5 writes them as two rows")
				.isEqualTo(whole(null));
	}

	/**
	 * AND EVERY ACCOUNT IN THE FIXTURE IS ON ONE SIDE OF THAT LINE OR THE OTHER.
	 *
	 * <p><b>The floor under the two lists at the head of this class</b>, and the reason
	 * they may be written by hand at all: what an account IS cannot be read back, but
	 * WHICH accounts exist can. A sixth added tomorrow has to be put on a side, and
	 * until it is, this case says so instead of the two lists quietly measuring four
	 * callers out of five.
	 */
	@Test
	void everyAccountInTheFixtureIsOnOneSideOfTheLineOrTheOther() {
		List<String> split = new java.util.ArrayList<>(THE_ADMINISTRATION);
		NOBODY_WHO_MAY_SEE_THE_SEAT.stream().filter(one -> one != null).forEach(split::add);

		assertThat(db.sql("select email from account").query(String.class).list())
				.as("an account in the fixture is on neither side of the line PDL P13 draws, so"
						+ " nothing measures what this resource answers it")
				.containsExactlyInAnyOrderElementsOf(split);
	}

}
