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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHO READS A HIDDEN PROFILE, ASKED ON EVERY DOOR ONE FACT OF IT OPENS, OVER ONE FIXTURE.
 *
 * <p>PDL P23, 03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan član ni administracija,
 * nikad prema aktivnom članu":
 * a profile its member hides is read by a member whose fee is standing and by the administration,
 * and a free account and a member whose fee has lapsed are answered what a visitor is. It
 * replaced a rule that read „anybody with a session", written four times over (the three
 * routes below, and the screen). {@link ActiveMemberOrAdministration} is the one home of the
 * answer now, and this class is the one place where all three routes are asked it of the same
 * ten readers, because the three are decided by three calls and what has to hold between them is
 * that they never disagree about one reader.
 *
 * <p><b>Six doors, each its own assertion, so that taking the rule back to {@code signedIn} at
 * ONE of them is a different failure from taking it back at another</b>: the biography, the
 * link to the team (both halves of it, {@code teamId} and {@code teamSince}), the portrait and
 * its square, {@code alsoInTheTeam} on the team, and the bytes behind the address. The list and
 * the bytes are also asked against each other for every reader, because the digest IS the whole
 * permission: a reader the list hands it to and the route refuses, or the other way round, is a
 * capability and not an access.
 *
 * <p><b>The shape is the precedent's</b> ({@code AttendanceApiTest}): a visitor and eight
 * accounts that tell the two questions of {@link ActiveMemberOrAdministration} apart, and one
 * more here, the hidden member himself, who is the one reader that is also the subject. A
 * member with a row in {@code membership} and none active, an active member with no row, a
 * registrant who never paid, an account naming no member, a moderator naming none, a moderator
 * whose own fee has lapsed, the superadmin, and the superadmin the settings name by an address
 * while his row says {@code competitor}.
 */
@SpringBootTest(properties = "btl.superadmin.email="
		+ TheSameReadersReadAHiddenProfileOnEveryDoorTest.NAMED_BY_AN_ADDRESS)
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TheSameReadersReadAHiddenProfileOnEveryDoorTest {

	/** A member whose fee is standing and who has announced nothing: he is nobody's subject. */
	private static final String ACTIVE = "aktivan-clan@primer.rs";

	/** The member who hides his profile, signed in as himself: the reader who is the subject. */
	private static final String THE_ONE_WHO_HIDES = "skriveni@primer.rs";

	/** A member whose fee has lapsed, holding a row of {@code membership} for 2027. */
	private static final String LAPSED = "istekla-clanarina@primer.rs";

	/** Somebody who registered and has never paid: a record with no number, never active. */
	private static final String NEVER_PAID = "nikad-placeno@primer.rs";

	/** A competitor's account that races for nobody, which V23 allows. */
	private static final String NO_MEMBER = "bez-clana@primer.rs";

	/** A moderator with no box ticked and no member behind him. */
	private static final String MODERATOR = "moderator@primer.rs";

	/** A moderator whose own membership has lapsed. */
	private static final String MODERATOR_LAPSED = "moderator-istekla@primer.rs";

	private static final String SUPERADMIN = "superadmin@primer.rs";

	/** Named superadmin by the settings above, and a competitor by his row. */
	static final String NAMED_BY_AN_ADDRESS = "b220-imenovani@primer.rs";

	/**
	 * THE READERS THE RULE LETS IN, written out rather than derived, because what each account IS is
	 * the thing the fixture decides and nothing can read it back. What IS derived is that the two
	 * lists are complete: {@link #everyAccountOfTheFixtureIsOnOneSideOfTheLineOrTheOther} reads
	 * every address out of {@code account}.
	 */
	private static final List<String> THOSE_WHO_READ = List.of(ACTIVE, THE_ONE_WHO_HIDES, MODERATOR,
			MODERATOR_LAPSED, SUPERADMIN, NAMED_BY_AN_ADDRESS);

	/** And the ones it does not, the visitor first: {@code null} is the same request without a cookie. */
	private static final List<String> THOSE_WHO_DO_NOT = Arrays.asList(null, NO_MEMBER, NEVER_PAID, LAPSED);

	private static final List<String> EVERY_KIND_OF_READER = Stream
			.concat(THOSE_WHO_READ.stream(), THOSE_WHO_DO_NOT.stream()).toList();

	/**
	 * THE MEMBER WHO HIDES, AND THE OTHER WHO DOES NOT, with a fact of each door apiece. Every value
	 * of the hiding one is chosen to be a value no other row of the fixture holds, so an answer that
	 * read the wrong member's is a different answer.
	 */
	private static final String THE_HIDING_ONE = "000101";

	private static final String THE_OPEN_ONE = "000102";

	private static final String HIS_BIOGRAPHY = "Trcim od skrivenog doba.";

	private static final String HER_BIOGRAPHY = "Trcim otvoreno.";

	private static final int HE_IS_IN_HIS_TEAM_SINCE = 2029;

	private static final int SHE_IS_IN_HERS_SINCE = 2028;

	private static final String HIS_PORTRAIT = "71".repeat(32);

	private static final byte[] HIS_PORTRAIT_BYTES = {'h', 'i', 'd', 'd', 'e', 'n', (byte) 0xD8, (byte) 0xFF};

	private static final String HER_PORTRAIT = "72".repeat(32);

	private static final byte[] HER_PORTRAIT_BYTES = {'o', 'p', 'e', 'n', (byte) 0x89, 'P', 'N', 'G'};

	/** The shape of a digest, belonging to no row at all. */
	private static final String NOBODY_WROTE = "73".repeat(32);

	private static final String HIS_TEAM = "skrivenog-tim";

	private static final String HER_TEAM = "otvorenog-tim";

	private static final Path FOLDER = aFolderOfItsOwn();

	@DynamicPropertySource
	static void whereThePicturesAre(DynamicPropertyRegistry settings) {
		settings.add("btl.photos.folder", FOLDER::toString);
	}

	private static Path aFolderOfItsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-readers");
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/** Feeds the sixteen lowercase hexadecimal characters {@code referral_code} needs (V7). */
	private int issued;

	/**
	 * TWO MEMBERS WHO ARE THE SUBJECT, AND TEN WHO READ.
	 *
	 * <p>Both subjects have a written biography, a portrait whose file is on disk, and a team
	 * membership that has NOT ended, in a team of their own, from a season no other source holds
	 * (the hiding one's is 2029, the other's 2028): a null for one of them would otherwise be the
	 * answer of a member who has none of it. The readers are the ten of the note on this class.
	 */
	@BeforeEach
	void twoSubjectsAndTenReaders() {
		long hisPhoto = aPicture(HIS_PORTRAIT, "image/jpeg", HIS_PORTRAIT_BYTES);
		long herPhoto = aPicture(HER_PORTRAIT, "image/png", HER_PORTRAIT_BYTES);

		member(THE_HIDING_ONE, "Skriveni", "Clan", true, true, HIS_BIOGRAPHY, hisPhoto);
		member(THE_OPEN_ONE, "Otvorena", "Clanica", true, false, HER_BIOGRAPHY, herPhoto);
		team(HIS_TEAM);
		team(HER_TEAM);
		standingIn(THE_HIDING_ONE, HIS_TEAM, HE_IS_IN_HIS_TEAM_SINCE);
		standingIn(THE_OPEN_ONE, HER_TEAM, SHE_IS_IN_HERS_SINCE);

		member("000110", "Aktivan", "Clan", true, false, "", null);
		account(ACTIVE, "competitor");
		belongsTo(ACTIVE, "000110");

		account(THE_ONE_WHO_HIDES, "competitor");
		belongsTo(THE_ONE_WHO_HIDES, THE_HIDING_ONE);

		/* A ROW OF membership IS NOT THE FACT BEING ASKED: this reader holds one and is not active,
		   and the active reader above holds none, so reading „has he a membership row" answers both
		   of them the wrong way round. */
		member("000111", "Istekao", "Clan", false, false, "", null);
		exemptFor("000111", 2027);
		account(LAPSED, "competitor");
		belongsTo(LAPSED, "000111");

		long unpaid = member(null, "Nikad", "Placeno", false, false, "", null);
		account(NEVER_PAID, "competitor");
		db.sql("update account set competitor_id = ? where email = ?").params(unpaid, NEVER_PAID).update();

		account(NO_MEMBER, "competitor");
		account(MODERATOR, "moderator");

		member("000112", "Moderatorka", "Istekla", false, false, "", null);
		account(MODERATOR_LAPSED, "moderator");
		belongsTo(MODERATOR_LAPSED, "000112");

		account(SUPERADMIN, "superadmin");

		account(NAMED_BY_AN_ADDRESS, "competitor");
		db.sql("update account set email_confirmed_at = ? where email = ?")
				.params(Timestamp.from(Instant.now()), NAMED_BY_AN_ADDRESS).update();
	}

	@AfterEach
	void theFolderIsLeftEmpty() throws IOException {
		try (Stream<Path> left = Files.walk(FOLDER)) {
			for (Path one : left.sorted(java.util.Comparator.reverseOrder()).toList()) {
				if (!one.equals(FOLDER)) {
					Files.delete(one);
				}
			}
		}
	}

	/**
	 * EVERY ACCOUNT OF THE FIXTURE IS ON ONE SIDE OF THE LINE OR THE OTHER, and a seventh one
	 * written tomorrow has to be put on a side rather than quietly measured by nothing.
	 */
	@Test
	void everyAccountOfTheFixtureIsOnOneSideOfTheLineOrTheOther() {
		List<String> written = db.sql("select email from account order by email")
				.query(String.class).list();
		List<String> listed = EVERY_KIND_OF_READER.stream().filter(one -> one != null).sorted().toList();

		assertThat(written)
				.as("an account of the fixture is on neither list of readers, or a list names one the"
						+ " fixture does not have")
				.isEqualTo(listed);
		assertThat(EVERY_KIND_OF_READER)
				.as("a reader is on both sides of the line, or twice on one")
				.doesNotHaveDuplicates()
				.hasSize(10);
	}

	/**
	 * THE READERS ARE WHAT THEY ARE CALLED, asked of the database and not of the lists above.
	 *
	 * <p>Every case below is about which side of the line a reader stands on, so a reader who is not
	 * what his name says would make a case green for the wrong reason: the lapsed one holds a row of
	 * {@code membership} and is not active, the active one holds no row and is, the registrant has no
	 * number, the moderators hold no box, and the named superadmin is a competitor by his row.
	 */
	@Test
	void theReadersAreWhatTheyAreCalled() {
		assertThat(facts("select c.active, (select count(*) from membership m where m.competitor_id = c.id)"
				+ " from account a join competitor c on c.id = a.competitor_id where a.email = ?", LAPSED))
				.as("the lapsed reader is active, or holds no membership row, so the fact and the row"
						+ " cannot be told apart by him")
				.isEqualTo("false 1");
		assertThat(facts("select c.active, (select count(*) from membership m where m.competitor_id = c.id)"
				+ " from account a join competitor c on c.id = a.competitor_id where a.email = ?", ACTIVE))
				.as("the active reader is not active, or holds a membership row, so the lapsed reader's"
						+ " row is not the only difference between the two")
				.isEqualTo("true 0");
		assertThat(facts("select c.member_number is null, c.active"
				+ " from account a join competitor c on c.id = a.competitor_id where a.email = ?", NEVER_PAID))
				.as("the registrant has a number or is active")
				.isEqualTo("true false");
		assertThat(facts("select a.competitor_id is null, r.code from account a join role r on r.id = a.role_id"
				+ " where a.email = ?", NO_MEMBER))
				.as("the account that names no member names one, or is not a competitor's")
				.isEqualTo("true competitor");
		assertThat(facts("select count(*) from account_admin_right r join account a on a.id = r.account_id"
				+ " where a.email in (?, ?)", MODERATOR, MODERATOR_LAPSED))
				.as("a moderator of the fixture holds a box, so he would not be the administration for"
						+ " being a moderator alone")
				.isEqualTo("0");
		assertThat(facts("select c.active from account a join competitor c on c.id = a.competitor_id"
				+ " where a.email = ?", MODERATOR_LAPSED))
				.as("the moderator whose fee has lapsed is active")
				.isEqualTo("false");
		assertThat(facts("select r.code = 'competitor' and a.competitor_id is null"
				+ " and a.email_confirmed_at is not null from account a join role r on r.id = a.role_id"
				+ " where a.email = ?", NAMED_BY_AN_ADDRESS))
				.as("the named superadmin's row is not a confirmed competitor with no member, so the"
						+ " role decided for the request cannot be told from the row's")
				.isEqualTo("true");
		assertThat(facts("select a.competitor_id = h.id from account a, competitor h"
				+ " where a.email = ? and h.member_number = ?", THE_ONE_WHO_HIDES, THE_HIDING_ONE))
				.as("the hiding member's account is not his own")
				.isEqualTo("true");
		assertThat(facts("select c.profile_hidden, c.active, c.photo_id is not null, c.bio <> ''"
				+ ", (select count(*) from team_membership m where m.competitor_id = c.id"
				+ " and m.season_to is null) from competitor c where c.member_number = ?", THE_HIDING_ONE))
				.as("the subject is not hiding, or is not active, or has no portrait, no biography or no"
						+ " membership of a team that has not ended, so a null for him withholds nothing")
				.isEqualTo("true true true true 1");
		assertThat(facts("select c.profile_hidden from competitor c where c.member_number = ?", THE_OPEN_ONE))
				.as("the anchor hides her profile, so what is withheld would be the session's and not the hiding's")
				.isEqualTo("false");
	}

	/**
	 * THE LIST GIVES A HIDDEN MEMBER'S BIOGRAPHY, TEAM AND PORTRAIT TO THE SIX WHO READ, AND THE
	 * VISITOR'S ANSWER, WHOLE, TO THE FOUR WHO DO NOT.
	 *
	 * <p>Four doors on one route, each its own assertion: {@code bio}, {@code teamId},
	 * {@code teamSince} (half of the link, which a half-done change would leave behind) and the
	 * portrait with its square. The other member is asked as the anchor on every one of them: hers
	 * reach everybody, so what is withheld is the hiding and not a reader's session.
	 *
	 * <p><b>The four are compared with the visitor's answer as TEXT and with nothing excused</b>:
	 * the old rule excused the fields hiding moves for anybody signed in
	 * ({@code CompetitorApiTest.answersAgreeExceptForWhatHidingOrTheBasisMayChange}), and a free
	 * account or a lapsed member is, by the owner's choice of 03.10.2026, answered what a visitor
	 * is. The comparison first requires that the visitor's answer and an active member's really DO
	 * differ, so it cannot pass by comparing an answer with itself.
	 */
	@Test
	void aHiddenMemberIsReadOnTheListByTheOnesWhoMayAndAsAVisitorByTheRest() throws Exception {
		String visitors = whole(null, "/api/competitors");

		assertThat(whole(ACTIVE, "/api/competitors"))
				.as("an active member is answered what a visitor is, so nothing below tells a reader who"
						+ " may from one who may not")
				.isNotEqualTo(visitors);

		for (String asking : EVERY_KIND_OF_READER) {
			assertThat(answer(asking, "/api/competitors").getStatus())
					.as("%s was not answered the list of members", who(asking))
					.isEqualTo(200);

			JsonNode list = new ObjectMapper().readTree(whole(asking, "/api/competitors"));
			JsonNode his = recordOf(list, THE_HIDING_ONE);
			JsonNode hers = recordOf(list, THE_OPEN_ONE);

			if (reads(asking)) {
				assertThat(his.path("bio").asString())
						.as("%s may read a hidden profile and was not answered the biography of one", who(asking))
						.isEqualTo(HIS_BIOGRAPHY);
				assertThat(his.path("teamId").asLong())
						.as("%s may read a hidden profile and was not answered his team", who(asking))
						.isEqualTo(idOfTeam(HIS_TEAM));
				assertThat(his.path("teamSince").asInt())
						.as("%s may read a hidden profile and was not answered the season he is in his team"
								+ " from", who(asking))
						.isEqualTo(HE_IS_IN_HIS_TEAM_SINCE);
				assertThat(his.path("photo").asString())
						.as("%s may read a hidden profile and was not answered his portrait", who(asking))
						.isEqualTo("/api/photos/" + HIS_PORTRAIT);
				assertThat(his.path("crop").path("size").decimalValue())
						.as("%s was answered a portrait without its square", who(asking))
						.isEqualByComparingTo(new BigDecimal("0.40"));
			} else {
				assertThat(his.path("bio").isNull())
						.as("%s may not read a hidden profile and was answered the biography of one", who(asking))
						.isTrue();
				assertThat(his.path("teamId").isNull())
						.as("%s may not read a hidden profile and was answered his team", who(asking))
						.isTrue();
				assertThat(his.path("teamSince").isNull())
						.as("%s may not read a hidden profile and was answered the season he is in his team"
								+ " from, which is half of the link", who(asking))
						.isTrue();
				assertThat(his.path("photo").isNull() && his.path("crop").isNull())
						.as("%s may not read a hidden profile and was answered his portrait", who(asking))
						.isTrue();
				assertThat(whole(asking, "/api/competitors"))
						.as("%s may not read a hidden profile and was answered something other than what a"
								+ " visitor is, to the byte", who(asking))
						.isEqualTo(visitors);
			}

			assertThat(List.of(hers.path("bio").asString(), hers.path("teamId").asLong(),
					hers.path("teamSince").asInt(), hers.path("photo").asString()))
					.as("%s was not answered the biography, team and portrait of a member who does NOT"
							+ " hide, so what is withheld is the reader and not the hiding", who(asking))
					.isEqualTo(List.of(HER_BIOGRAPHY, idOfTeam(HER_TEAM), SHE_IS_IN_HERS_SINCE,
							"/api/photos/" + HER_PORTRAIT));
		}
	}

	/**
	 * THE TEAM NAMES A HIDDEN MEMBER TO EXACTLY THE READERS HIS OWN RECORD WITHHOLDS HIM FROM, SO
	 * EVERY STANDING MEMBERSHIP IS NAMED ONCE, TO EVERY READER.
	 *
	 * <p>PDL P23, 27.09.2026, „Skrivanje krije i tim: tim se zadržava od posetioca": the link goes
	 * from the record and the team does not lose him. The door is {@code alsoInTheTeam}, asked by
	 * the same condition turned over, and the floor is that the two doors together name every
	 * standing membership exactly once for each of the ten, so that a link is never lost between
	 * them and never stands on both. The other member's team is the anchor: it owes nobody anybody.
	 */
	@Test
	void theTeamNamesAHiddenMemberToExactlyTheReadersTheListWithholdsHimFrom() throws Exception {
		List<String> standing = db.sql("select c.member_number || ' ' || t.slug || ' ' || m.season_from"
						+ " from team_membership m join competitor c on c.id = m.competitor_id"
						+ " join team t on t.id = m.team_id where m.season_to is null and c.active")
				.query(String.class).list();

		assertThat(standing)
				.as("the fixture has no standing membership of a hiding member beside one of a member who"
						+ " does not, so the two doors are not both asked")
				.containsExactlyInAnyOrder(THE_HIDING_ONE + " " + HIS_TEAM + " " + HE_IS_IN_HIS_TEAM_SINCE,
						THE_OPEN_ONE + " " + HER_TEAM + " " + SHE_IS_IN_HERS_SINCE);

		Map<Long, String> slugs = new HashMap<>();
		db.sql("select id, slug from team").query((row, one) -> slugs.put(row.getLong(1), row.getString(2))).list();

		for (String asking : EVERY_KIND_OF_READER) {
			assertThat(answer(asking, "/api/teams").getStatus())
					.as("%s was not answered the list of teams", who(asking))
					.isEqualTo(200);

			List<String> named = new ArrayList<>();

			for (JsonNode one : new ObjectMapper().readTree(whole(asking, "/api/competitors"))) {
				if (!one.path("teamId").isNull()) {
					named.add(one.path("memberNumber").asString() + " " + slugs.get(one.path("teamId").asLong())
							+ " " + one.path("teamSince").asInt());
				}
			}

			Map<String, List<String>> owed = new HashMap<>();

			for (JsonNode team : new ObjectMapper().readTree(whole(asking, "/api/teams"))) {
				List<String> here = new ArrayList<>();

				for (JsonNode also : team.path("alsoInTheTeam")) {
					here.add(also.path("memberNumber").asString() + " " + also.path("since").asInt());
					named.add(also.path("memberNumber").asString() + " " + team.path("slug").asString()
							+ " " + also.path("since").asInt());
				}

				owed.put(team.path("slug").asString(), here);
			}

			assertThat(owed.get(HIS_TEAM))
					.as("%s was %s told on his team that the hiding member is in it", who(asking),
							reads(asking) ? "wrongly" : "not")
					.isEqualTo(reads(asking) ? List.of() : List.of(THE_HIDING_ONE + " " + HE_IS_IN_HIS_TEAM_SINCE));
			assertThat(owed.get(HER_TEAM))
					.as("%s was told on her team about a member who does not hide", who(asking))
					.isEmpty();
			assertThat(named)
					.as("to %s the two doors together did not name every standing membership exactly once:"
							+ " one was lost between them, or stood on both", who(asking))
					.containsExactlyInAnyOrderElementsOf(standing);
		}
	}

	/**
	 * THE BYTES OF A HIDDEN MEMBER'S PORTRAIT GO TO EXACTLY THE READERS THE LIST HANDS THE ADDRESS TO.
	 *
	 * <p>For each reader the list is asked whether it gives the digest and the route whether it
	 * serves the bytes, and the two must be the same answer: the digest IS the whole permission, so a
	 * reader given it by one door and refused by the other holds a capability and not an access. The
	 * refusal is the one every address nobody wrote is answered, compared whole (status, body, type,
	 * the names of the headers), because told apart it would say „this digest names a member who is
	 * hiding". The other member's portrait is the anchor: served to everybody.
	 */
	@Test
	void thePortraitBytesGoToExactlyTheReadersTheListHandsTheAddressTo() throws Exception {
		assertThat(FOLDER.resolve(String.valueOf(idOfPhoto(HIS_PORTRAIT))))
				.as("the hiding member's picture has no file, so a refusal below could be about a row whose"
						+ " file has gone")
				.exists();

		for (String asking : EVERY_KIND_OF_READER) {
			JsonNode his = recordOf(new ObjectMapper().readTree(whole(asking, "/api/competitors")), THE_HIDING_ONE);
			boolean theListGivesIt = !his.path("photo").isNull();

			MockHttpServletResponse bytes = answer(asking, "/api/photos/" + HIS_PORTRAIT);
			MockHttpServletResponse nobodyWroteIt = answer(asking, "/api/photos/" + NOBODY_WROTE);
			boolean theRouteServesIt = bytes.getStatus() == 200;

			assertThat(theRouteServesIt)
					.as("%s: the route %s the bytes of a hidden member's portrait", who(asking),
							theRouteServesIt ? "served" : "refused")
					.isEqualTo(reads(asking));
			assertThat(theRouteServesIt)
					.as("%s: the list and the route disagree about a hidden member's portrait", who(asking))
					.isEqualTo(theListGivesIt);

			if (theRouteServesIt) {
				assertThat(bytes.getContentAsByteArray())
						.as("%s was served another picture than the hiding member's own", who(asking))
						.isEqualTo(HIS_PORTRAIT_BYTES);
				assertThat(bytes.getContentType()).isEqualTo("image/jpeg");
			} else {
				assertThat(nobodyWroteIt.getStatus()).isEqualTo(404);
				assertThat(bytes.getStatus())
						.as("%s was refused a hidden member's portrait with something other than 404", who(asking))
						.isEqualTo(404);
				assertThat(bytes.getContentAsByteArray())
						.as("the refusal and the answer to a digest nobody wrote do not carry the same body")
						.isEqualTo(nobodyWroteIt.getContentAsByteArray());
				assertThat(bytes.getContentType()).isEqualTo(nobodyWroteIt.getContentType());
				assertThat(bytes.getHeaderNames())
						.as("one refusal carries a header the other does not, which is the difference that says"
								+ " a member is hiding")
						.containsExactlyInAnyOrderElementsOf(nobodyWroteIt.getHeaderNames());
			}

			MockHttpServletResponse hers = answer(asking, "/api/photos/" + HER_PORTRAIT);

			assertThat(hers.getStatus())
					.as("%s was refused the portrait of a member who does NOT hide, so the refusal above is"
							+ " about the reader and not about the hiding", who(asking))
					.isEqualTo(200);
			assertThat(hers.getContentAsByteArray()).isEqualTo(HER_PORTRAIT_BYTES);
		}
	}

	/**
	 * A READER WHOSE FEE LAPSES IS ANSWERED AS A VISITOR AT ONCE, AND AS A READER AGAIN WHEN IT IS RESTORED.
	 *
	 * <p>The price the owner was shown and accepted (PDL P23, 03.10.2026): a member who does not
	 * renew stops seeing hidden profiles until he pays. One session cookie throughout and one
	 * column changed between the requests, so what answers differently is the fact and not the
	 * account, the cookie or a session somebody kept: every request asks {@code competitor.active}
	 * afresh.
	 */
	@Test
	void aReaderWhoseFeeLapsesIsAnsweredAsAVisitorAtOnceAndAsAReaderAgainWhenItIsRestored() throws Exception {
		assertThat(bioOf(ACTIVE)).as("the member is not answered the biography while his fee stands")
				.isEqualTo(HIS_BIOGRAPHY);

		db.sql("update competitor set active = false where member_number = '000110'").update();

		assertThat(whole(ACTIVE, "/api/competitors"))
				.as("a member whose fee lapsed a moment ago is still answered what a member is")
				.isEqualTo(whole(null, "/api/competitors"));
		assertThat(answer(ACTIVE, "/api/photos/" + HIS_PORTRAIT).getStatus())
				.as("a member whose fee lapsed a moment ago is still served the bytes")
				.isEqualTo(404);
		assertThat(named(ACTIVE, HIS_TEAM))
				.as("a member whose fee lapsed a moment ago is still not told on the team who is in it")
				.containsExactly(THE_HIDING_ONE);

		db.sql("update competitor set active = true where member_number = '000110'").update();

		assertThat(bioOf(ACTIVE)).as("the member is not answered the biography again once his fee stands")
				.isEqualTo(HIS_BIOGRAPHY);
		assertThat(named(ACTIVE, HIS_TEAM)).isEmpty();
	}

	/**
	 * NO ANSWER THAT DEPENDS ON WHO IS READING MAY BE KEPT BY A SHARED CACHE.
	 *
	 * <p>What these three routes answer now depends on whether the reader is an active member, so a
	 * shared cache that kept one answer would hand it to a reader it was not made for. Measured on
	 * 04.10.2026 over the three routes for every reader: the two lists answer {@code no-cache,
	 * no-store, max-age=0, must-revalidate} to all of them, a picture's bytes {@code max-age=86400,
	 * private} and a refusal {@code no-store}. No {@code Vary} is sent and none is needed while
	 * neither is shareable. Asked of the answers rather than of the code, so the day somebody offers
	 * one of them to a shared cache for a day this fails with the reader named.
	 */
	@Test
	void noAnswerThatDependsOnTheReaderMayBeKeptByASharedCache() throws Exception {
		for (String asking : EVERY_KIND_OF_READER) {
			for (String path : List.of("/api/competitors", "/api/teams", "/api/photos/" + HIS_PORTRAIT,
					"/api/photos/" + HER_PORTRAIT, "/api/photos/" + NOBODY_WROTE)) {
				String kept = answer(asking, path).getHeader(HttpHeaders.CACHE_CONTROL);

				assertThat(kept)
						.as("%s was answered %s with no Cache-Control at all", who(asking), path)
						.isNotNull();
				assertThat(kept)
						.as("%s was answered %s in a way a shared cache may keep: %s", who(asking), path, kept)
						.doesNotContain("public")
						.matches(value -> value.contains("no-store") || value.contains("private"));
			}
		}
	}

	private boolean reads(String email) {
		return email != null && THOSE_WHO_READ.contains(email);
	}

	private static String who(String email) {
		return email == null ? "a visitor" : email;
	}

	private MockHttpServletRequestBuilder as(String email, MockHttpServletRequestBuilder asks) {
		return email == null ? asks
				: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private MockHttpServletResponse answer(String email, String path) throws Exception {
		return http.perform(as(email, get(path))).andReturn().getResponse();
	}

	private String whole(String email, String path) throws Exception {
		return answer(email, path).getContentAsString(StandardCharsets.UTF_8);
	}

	private static JsonNode recordOf(JsonNode list, String memberNumber) {
		for (JsonNode one : list) {
			if (one.path("memberNumber").asString().equals(memberNumber)) {
				return one;
			}
		}

		throw new AssertionError("the list answers no member numbered " + memberNumber);
	}

	private String bioOf(String email) throws Exception {
		return recordOf(new ObjectMapper().readTree(whole(email, "/api/competitors")), THE_HIDING_ONE)
				.path("bio").asString();
	}

	/** The members a team's own answer names to this reader, as numbers. */
	private List<String> named(String email, String slug) throws Exception {
		List<String> numbers = new ArrayList<>();

		for (JsonNode team : new ObjectMapper().readTree(whole(email, "/api/teams"))) {
			if (team.path("slug").asString().equals(slug)) {
				for (JsonNode also : team.path("alsoInTheTeam")) {
					numbers.add(also.path("memberNumber").asString());
				}
			}
		}

		return numbers;
	}

	/** One row of one query as a single line, so that a case reads the facts it is built on. */
	private String facts(String sql, Object... params) {
		return db.sql(sql).params(params).query((row, one) -> {
			List<String> cells = new ArrayList<>();

			for (int at = 1; at <= row.getMetaData().getColumnCount(); at++) {
				cells.add(String.valueOf(row.getObject(at)));
			}

			return String.join(" ", cells);
		}).single();
	}

	private long idOfTeam(String slug) {
		return db.sql("select id from team where slug = ?").param(slug).query(Long.class).single();
	}

	private long idOfPhoto(String digest) {
		return db.sql("select id from photo where digest = ?").param(digest).query(Long.class).single();
	}

	private long aPicture(String digest, String mediaType, byte[] bytes) {
		long id = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values (?, ?, ?, ?, ?, ?) returning id")
				.params(mediaType, bytes.length, digest, new BigDecimal("0.25"), new BigDecimal("0.75"),
						new BigDecimal("0.40"))
				.query(Long.class).single();

		try {
			Files.write(FOLDER.resolve(String.valueOf(id)), bytes);
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}

		return id;
	}

	/** @param number null for somebody who registered and has not paid (V16); the key is returned */
	private long member(String number, String first, String last, boolean active, boolean hidden,
			String bio, Long photo) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at, photo_id)"
						+ " values (?, ?, ?, 'M', date '1990-01-01', (select id from place where rank = 1),"
						+ " 2027, false, ?, 'payment', ?, ?, ?, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00', ?) returning id")
				.params(number, first, last, active, String.format("%016x", ++issued), bio, hidden, photo)
				.query(Long.class).single();
	}

	private void team(String slug) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, first_season, admin_id)"
						+ " values (?, ?, '', '', (select id from place where rank = 1), null, null, 2027, null)")
				.params(slug, "Tim " + slug).update();
	}

	private void standingIn(String memberNumber, String slug, int from) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?, null, null)")
				.params(memberNumber, slug, from).update();
	}

	/** A membership row for one season, given free of the fee, which needs no payment to name. */
	private void exemptFor(String memberNumber, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(memberNumber, season).update();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', ?,"
				+ " (select id from role where code = ?))").params(email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** Ties an account to the member it races as (V23). */
	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}
}
