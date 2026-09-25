package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;

/**
 * DELETING A MEMBER, END TO END: what goes with him, what stays and says it was his, who is
 * told, and what the portal refuses to do at all.
 *
 * <p><b>NOTHING IN THIS FIXTURE IS THE ONLY ONE OF ITS KIND</b>, on every axis an assertion
 * below reads a value along. The rule this keeps is the one measured on 06.09.2026: „Imenuj
 * drugi izvor iste vrednosti - odakle bi ova ista vrednost mogla da stigne da je kod
 * pogresan?"
 *
 * <ul>
 * <li><b>Twelve members, and the one who is deleted is written THIRD</b>, so „the member
 * asked about" and „the first member" are different rows.
 * <li><b>FOUR teams, and all four states of „what is left in it" are among them.</b>
 * {@link #TEAM_THAT_EMPTIES} has nobody but him; {@link #TEAM_KEPT_BY_AN_OPEN_ROW} keeps a
 * membership that has not ended; {@link #TEAM_KEPT_BY_AN_ENDED_ROW} keeps one that HAS
 * ended, which is the axis the whole rule turns on; and {@link #A_TEAM_WITH_NOBODY} has no
 * membership at all and has nothing to do with him. A sweep that asks „has this team an OPEN
 * membership" takes the third; a sweep that asks the whole table takes the fourth.
 * <li><b>TWO pairs of his and a THIRD that is not his</b>, so „every pair he is in" is never
 * „every pair" and never „the first pair". His two are in two different seasons, which is
 * PDL P13's „Od 1. januara clan sme da drzi dva".
 * <li><b>Both sexes are deleted, in two cases</b>, because the word that replaces the name
 * differs by sex and a fixture of one sex measures one of the two.
 * <li><b>Both halves of „his account administers" separately.</b>
 * {@link #A_MODERATOR_WHO_RACES} has the role and NO ticked box;
 * {@link #A_TICKED_COMPETITOR} has the boxes and an ordinary role. A condition over one of
 * the two lets the other through.
 * <li><b>The account's name is NOT the member's name.</b> Two different strings, so a scan
 * that finds one has found the row it thinks it has.
 * <li><b>Somebody else wrote a message and a comment too</b>, and both must come out of the
 * deletion untouched, which is what an {@code update} that lost its {@code where} cannot do.
 * </ul>
 *
 * <p><b>AND A SUPERADMIN'S ADDRESS IS NAMED IN THE SETTINGS, WHICH IS WHAT MAKES THIS ONE OF
 * THE FEW CLASSES THAT NEEDS ITS OWN {@code btl.superadmin.email}.</b> A round on 25.09.2026
 * probed a named-and-confirmed account through this route and read back 204 where PDL P21
 * requires a refusal - „nema radnje kroz portal koja bi superadmina obrisala ili razvlastila".
 * {@link #SUPERADMIN_EMAIL} is made up for exactly {@link SuperadminIsNamedByAnAddressTest}'s
 * own reason: what these cases need is that ONE address is named and every other is not.
 *
 * <p><b>A PHOTOS FOLDER OF THIS RUN'S OWN, for the same reason {@code MePhotoApiTest} keeps
 * one.</b> The setting's default is shared by every run on the machine, and a file here is
 * named by a {@code bigserial} that starts again at one in every fresh Testcontainers
 * database - so two runs sharing the default would meet each other's files under the same
 * name.
 */
@SpringBootTest(properties = "btl.superadmin.email=" + CompetitorWriteApiTest.SUPERADMIN_EMAIL)
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CompetitorWriteApiTest {

	/**
	 * Named in the settings, made up for the same reason
	 * {@link SuperadminIsNamedByAnAddressTest#NAMED} is: it is not a secret, and what these
	 * cases need is only that some address is named.
	 */
	static final String SUPERADMIN_EMAIL = "superadmin-brise@primer.rs";

	/**
	 * A FOLDER OF THIS RUN'S OWN. See {@code MePhotoApiTest.PHOTOS} for the fault this avoids:
	 * a shared default directory meeting a same-named file from another run or another
	 * worktree, which is the fixed-resource class of fault {@code CLAUDE.md} records for a
	 * port on 18.09.2026.
	 */
	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-competitor-write-");
		}
		catch (java.io.IOException noFolder) {
			throw new IllegalStateException("no temporary folder to keep pictures in", noFolder);
		}
	}

	@org.springframework.test.context.DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(
			org.springframework.test.context.DynamicPropertyRegistry registry) {

		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	/** Written first, asked about by nothing, and the one who receives his message. */
	private static final String FIRST_WRITTEN = "000100";

	/** In {@link #TEAM_KEPT_BY_AN_ENDED_ROW}, and his membership has ENDED. */
	private static final String A_MATE_WHO_HAS_LEFT = "000200";

	/** The member almost every case deletes, written third. */
	private static final String THE_TARGET = "000300";

	/** In {@link #TEAM_KEPT_BY_AN_OPEN_ROW}, and his membership is OPEN. */
	private static final String A_MATE_WHO_IS_STILL_IN = "000400";

	/** The other half of his pair for the season being run. */
	private static final String HIS_FIRST_PARTNER = "000500";

	/** And of the pair made for the season after it, which goes with him too. */
	private static final String HIS_SECOND_PARTNER = "000600";

	/** Deleted by her own case, so that the woman's replacement word is measured. */
	private static final String THE_WOMAN_DELETED = "000700";

	/** Her partner, who is told, and whose pair is not {@link #THE_TARGET}'s. */
	private static final String HER_PARTNER = "000800";

	/** A member whose account carries the moderator's role and not one ticked box. */
	private static final String A_MODERATOR_WHO_RACES = "000900";

	/** And one whose account carries an ordinary role and a ticked box. */
	private static final String A_TICKED_COMPETITOR = "001000";

	/** A member with no account row at all, which is a row nothing has to decide about. */
	private static final String NO_ACCOUNT_AT_ALL = "001100";

	/** A member whose fee has lapsed, whom the administration may still delete. */
	private static final String A_LAPSED_MEMBER = "001200";

	/** Empty the moment he goes, because nobody else ever had a row in it. */
	private static final String TEAM_THAT_EMPTIES = "tim-koji-nestaje";

	/** Kept by a membership that has not ended. */
	private static final String TEAM_KEPT_BY_AN_OPEN_ROW = "tim-sa-otvorenim";

	/**
	 * Kept by a membership that HAS ended, which is the case the whole rule turns on.
	 *
	 * <p>V11 stores „the last season he is in it", so a member who left in October is in the
	 * team until 31 December and his row is still there. Asked as „has an open membership"
	 * this team would be deleted the day he left.
	 */
	private static final String TEAM_KEPT_BY_AN_ENDED_ROW = "tim-sa-zavrsenim";

	/** Never had a member, and nothing about this member may reach it. */
	private static final String A_TEAM_WITH_NOBODY = "tim-bez-clanova";

	/** The league his frozen standing belongs to. It has no seat: V19 dropped
	 *  {@code league.admin_id}, so a team's is the only seat a member can sit in. */
	private static final String HIS_LEAGUE = "liga-jedna";

	private static final String AN_EVENT = "trka-jedna";

	/** The season his frozen row belongs to, and the one his first pair runs in. */
	private static final int A_SEASON_BEING_RUN = 2027;

	/** The season after it, so „his pair" is never „the pair of this season". */
	private static final int THE_SEASON_AFTER = 2028;

	/** The season his OPEN membership begins in, which no other number in the fixture is. */
	private static final int A_SEASON_STILL_TO_COME = 2029;

	/** His surname, which nothing else in the database carries. */
	private static final String HIS_SURNAME = "Brisivić";

	/** And his given name, for the same reason. */
	private static final String HIS_GIVEN_NAME = "Brisoje";

	/**
	 * The surname on his ACCOUNT, and it is deliberately not his own.
	 *
	 * <p>Written the same, a scan that found one of them could not say which, and the two
	 * columns live in two tables that go by two different roads - the account by a statement
	 * and the member by a cascade.
	 */
	private static final String HIS_ACCOUNT_SURNAME = "Nalogović";

	private static final String HIS_EMAIL = "brisivic@primer.rs";

	/** Somebody else's name, which must come out of every case exactly as it went in. */
	private static final String ANOTHER_NAME = "Prvi Napisani";

	/** The moderator every case deletes with, who is not a competitor at all. */
	private static final String THE_DELETER = "brise@primer.rs";

	private static final String A_MODERATOR_WITH_NO_RIGHTS = "bez-prava@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Value("${btl.photos.folder}")
	private String folder;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	@BeforeEach
	void twelveMembersFourTeamsAndThreePairs() {
		man(FIRST_WRITTEN, "Prvi", "Napisani");
		man(A_MATE_WHO_HAS_LEFT, "Drugi", "Ostavljeni");
		man(THE_TARGET, HIS_GIVEN_NAME, HIS_SURNAME);
		man(A_MATE_WHO_IS_STILL_IN, "Cetvrti", "Ostali");
		woman(HIS_FIRST_PARTNER, "Prva", "Partnerka");
		woman(HIS_SECOND_PARTNER, "Druga", "Partnerka");
		woman(THE_WOMAN_DELETED, "Treca", "Obrisana");
		man(HER_PARTNER, "Osmi", "Ostavljeni");
		man(A_MODERATOR_WHO_RACES, "Deveti", "Moderator");
		man(A_TICKED_COMPETITOR, "Deseti", "Kvacica");
		man(NO_ACCOUNT_AT_ALL, "Jedanaesti", "Beznaloga");
		man(A_LAPSED_MEMBER, "Dvanaesti", "Neobnovljeni");

		db.sql("update competitor set active = false where member_number = ?")
				.param(A_LAPSED_MEMBER).update();

		team(TEAM_THAT_EMPTIES);
		team(TEAM_KEPT_BY_AN_OPEN_ROW);
		team(TEAM_KEPT_BY_AN_ENDED_ROW);
		team(A_TEAM_WITH_NOBODY);

		/* THREE MEMBERSHIPS FOR ONE MEMBER, IN THREE SEASONS THAT DO NOT OVERLAP, which
		   `team_membership_one_team_at_a_time` demands and which is also the axis: a member
		   can empty more than one team at once, and a route that looked only at the open one
		   would leave the other two standing. */
		inATeam(THE_TARGET, TEAM_THAT_EMPTIES, A_SEASON_BEING_RUN, A_SEASON_BEING_RUN);
		inATeam(THE_TARGET, TEAM_KEPT_BY_AN_OPEN_ROW, THE_SEASON_AFTER, THE_SEASON_AFTER);
		inATeam(THE_TARGET, TEAM_KEPT_BY_AN_ENDED_ROW, A_SEASON_STILL_TO_COME, null);

		inATeam(A_MATE_WHO_IS_STILL_IN, TEAM_KEPT_BY_AN_OPEN_ROW, A_SEASON_BEING_RUN, null);
		inATeam(A_MATE_WHO_HAS_LEFT, TEAM_KEPT_BY_AN_ENDED_ROW, A_SEASON_BEING_RUN,
				A_SEASON_BEING_RUN);

		sitsInTheSeatOf(THE_TARGET, TEAM_KEPT_BY_AN_OPEN_ROW);
		league(HIS_LEAGUE);

		/* AND SOMEBODY HE BROUGHT IN, which is the second `on delete set null` at
		   `competitor` and the only one that points the table at itself (V7). */
		referredBy(FIRST_WRITTEN, THE_TARGET);

		pair(A_SEASON_BEING_RUN, THE_TARGET, HIS_FIRST_PARTNER);
		pair(THE_SEASON_AFTER, THE_TARGET, HIS_SECOND_PARTNER);
		/* A THIRD PAIR THAT IS NOT HIS, so „the pairs that went" is never „every pair". */
		pair(A_SEASON_BEING_RUN, HER_PARTNER, THE_WOMAN_DELETED);

		anEvent();
		comment(THE_TARGET, HIS_GIVEN_NAME + " " + HIS_SURNAME);
		comment(FIRST_WRITTEN, ANOTHER_NAME);

		wrote(THE_TARGET, HIS_GIVEN_NAME + " " + HIS_SURNAME, FIRST_WRITTEN);
		wrote(FIRST_WRITTEN, ANOTHER_NAME, A_MATE_WHO_IS_STILL_IN);
		wrote(FIRST_WRITTEN, ANOTHER_NAME, THE_TARGET);

		frozen(1, THE_TARGET, HIS_GIVEN_NAME + " " + HIS_SURNAME, "M");
		frozen(2, FIRST_WRITTEN, ANOTHER_NAME, "M");

		account(HIS_EMAIL, THE_TARGET, "competitor", "Nalog", HIS_ACCOUNT_SURNAME);
		account("prvi@primer.rs", FIRST_WRITTEN, "competitor", "Prvi", "Napisani");
		account("zena@primer.rs", THE_WOMAN_DELETED, "competitor", "Treca", "Obrisana");
		account("moderator-trkac@primer.rs", A_MODERATOR_WHO_RACES, "moderator", "Deveti",
				"Moderator");
		account("kvacica@primer.rs", A_TICKED_COMPETITOR, "competitor", "Deseti", "Kvacica");
		account("neobnovljeni@primer.rs", A_LAPSED_MEMBER, "competitor", "Dvanaesti",
				"Neobnovljeni");
		ticked("kvacica@primer.rs", CompetitorApi.OVER_THE_MEMBERS);

		moderator(THE_DELETER);
		ticked(THE_DELETER, CompetitorApi.OVER_THE_MEMBERS);
		moderator(A_MODERATOR_WITH_NO_RIGHTS);
	}

	/**
	 * THE FIXTURE SEPARATES THE AXES IT SAYS IT SEPARATES.
	 *
	 * <p>Every case below rests on one of these being true, and a fixture that quietly stops
	 * holding one of them turns a green case into a case about nothing. This is the floor
	 * under the class note, and it reads the database rather than the list of constants.
	 */
	@Test
	void theFixtureSeparatesTheAxesItSaysItSeparates() {
		assertThat(db.sql("select count(*) || ' of ' || count(season_to)"
						+ " from team_membership where competitor_id = ?")
				.param(competitorId(THE_TARGET)).query(String.class).single())
				.as("he does not hold three memberships of which exactly one is open, so the"
						+ " team cases rest on rows that are not there")
				.isEqualTo("3 of 2");

		assertThat(teamsThatExist())
				.as("the four states of what a team is left with are not four teams")
				.containsExactlyInAnyOrder(TEAM_THAT_EMPTIES, TEAM_KEPT_BY_AN_OPEN_ROW,
						TEAM_KEPT_BY_AN_ENDED_ROW, A_TEAM_WITH_NOBODY);

		assertThat(db.sql("select count(*) from team_membership m join team t on t.id = m.team_id"
						+ " where t.slug = ?")
				.param(A_TEAM_WITH_NOBODY).query(Long.class).single())
				.as("the team nobody is in has somebody in it")
				.isZero();

		assertThat(db.sql("select count(*) from racing_pair").query(Long.class).single())
				.as("the third pair, the one that is not his, is missing")
				.isEqualTo(3);

		assertThat(db.sql("select a.last_name from account a join competitor c"
						+ " on c.id = a.competitor_id where c.member_number = ?")
				.param(THE_TARGET).query(String.class).single())
				.as("the name on the account and the name on the member are the same string,"
						+ " so a scan that finds one cannot say which it found")
				.isNotEqualTo(HIS_SURNAME)
				.isEqualTo(HIS_ACCOUNT_SURNAME);
	}

	/**
	 * A MEMBER GOES, AND SO DOES EVERYTHING THAT WAS HIS.
	 *
	 * <p>The cascade is the schema's and not this route's, and that is exactly why it is
	 * measured through the door: V23 sorted every key at {@code competitor} into „his" and
	 * „somebody else's" and nothing had ever pulled the lever.
	 */
	@Test
	void theMemberAndEverythingThatWasHisGoTogether() throws Exception {
		assertThat(deleteAs(THE_DELETER, THE_TARGET, "delete").getStatus()).isEqualTo(204);

		assertThat(membersThatExist())
				.as("the member asked about is still there, or somebody else went with him")
				.containsExactlyInAnyOrder(FIRST_WRITTEN, A_MATE_WHO_HAS_LEFT,
						A_MATE_WHO_IS_STILL_IN, HIS_FIRST_PARTNER, HIS_SECOND_PARTNER,
						THE_WOMAN_DELETED, HER_PARTNER, A_MODERATOR_WHO_RACES,
						A_TICKED_COMPETITOR, NO_ACCOUNT_AT_ALL, A_LAPSED_MEMBER);

		assertThat(db.sql("select count(*) from account where email = ?")
				.param(HIS_EMAIL).query(Long.class).single())
				.as("his account outlived him, which `account_competitor_fk` exists to refuse")
				.isZero();

		assertThat(db.sql("select count(*) from account").query(Long.class).single())
				.as("somebody else's account went with his")
				.isEqualTo(7);
	}

	/**
	 * AND WHAT MERELY NAMED HIM KEEPS ITS OWN EXISTENCE AND LOSES THE POINTER.
	 *
	 * <p>The other half of V23's sorting, and the two are measured apart: a cascade where a
	 * {@code set null} belongs deletes a team's seat along with the man in it.
	 */
	@Test
	void whatMerelyNamedHimKeepsItsOwnExistence() throws Exception {
		assertThat(deleteAs(THE_DELETER, THE_TARGET, "delete").getStatus()).isEqualTo(204);

		assertThat(seatOf(TEAM_KEPT_BY_AN_OPEN_ROW))
				.as("the team went with the man in its seat, or its seat still names him")
				.isEqualTo("nobody");

		assertThat(db.sql("select coalesce(r.member_number, 'nobody') from competitor c"
						+ " left join competitor r on r.id = c.referred_by"
						+ " where c.member_number = ?")
				.param(FIRST_WRITTEN).query(String.class).single())
				.as("the member he brought in went with him, or still says who brought him")
				.isEqualTo("nobody");
	}

	/**
	 * HIS NAME GOES WITH HIM OUT OF EVERY COLUMN THAT KEPT IT BESIDE A POINTER.
	 *
	 * <p>PDL P23: „Ako igde ostane zapis da je 000127 bio odredjena osoba, nista nije
	 * obrisano nego samo sakriveno, a to je i dalje licni podatak." Until V33 two columns
	 * kept it - {@code message.from_name} and {@code event_comment.who} - because a key can
	 * empty a pointer and not a second column.
	 *
	 * <p><b>Somebody else's message and somebody else's comment are read in the same
	 * breath</b>, which is what an {@code update} that lost its {@code where} cannot
	 * survive.
	 */
	@Test
	void hisNameLeavesTheMessageAndTheCommentAndNobodyElsesDoes() throws Exception {
		assertThat(deleteAs(THE_DELETER, THE_TARGET, "delete").getStatus()).isEqualTo(204);

		assertThat(sendersOfEveryMessage())
				.as("the sender of a message he wrote, and of one somebody else wrote")
				.containsExactly(CompetitorWriteApi.A_DELETED_MAN + " (no pointer)",
						ANOTHER_NAME + " (" + FIRST_WRITTEN + ")");

		assertThat(authorsOfEveryComment())
				.as("the author of the comment he wrote, and of one somebody else wrote")
				.containsExactly(CompetitorWriteApi.A_DELETED_MAN + " (no pointer)",
						ANOTHER_NAME + " (" + FIRST_WRITTEN + ")");
	}

	/**
	 * AND THE ONE HE WAS WRITTEN TO GOES WITH HIM, which is the other direction of the same
	 * table and a different key ({@code message_to_fk} is {@code on delete cascade}).
	 *
	 * <p>Read in the same case as the sender, a route that emptied the whole table would pass
	 * both halves; counted apart, the message he RECEIVED is gone and the one he SENT stands.
	 */
	@Test
	void theMessagesWrittenToHimGoAndTheOnesHeWroteStay() throws Exception {
		assertThat(howManyMessages())
				.as("the fixture does not hold the three messages this case reads")
				.isEqualTo(3);

		assertThat(deleteAs(THE_DELETER, THE_TARGET, "delete").getStatus()).isEqualTo(204);

		assertThat(howManyMessages())
				.as("his inbox stayed behind him, or his outbox went with him. Two of the"
						+ " three stay and two are written, so this is four")
				.isEqualTo(4);
	}

	/**
	 * THE FROZEN SEASON KEEPS ITS ROW AND FORGETS HIS NAME, WHICH IS V17'S TRIGGER STILL
	 * DOING WHAT IT DID.
	 *
	 * <p>V33 replaces that function, and the rule of 05.09.2026 applies to a trigger as much
	 * as to any other guard: „Cuvar se ne brise dok njegove mutacije ne padnu na onome sto ga
	 * menja." {@code FrozenSeasonConstraintsTest} holds the cases it was written with and
	 * they run against the new function unchanged; this is the same fact seen from the door,
	 * beside the two columns V33 adds, so that „the trigger ran" and „the trigger ran over
	 * all four tables" are one answer.
	 */
	@Test
	void theFrozenSeasonKeepsItsRowAndForgetsHisName() throws Exception {
		assertThat(deleteAs(THE_DELETER, THE_TARGET, "delete").getStatus()).isEqualTo(204);

		assertThat(db.sql("select position || '/' || coalesce(who, 'forgotten') || '/'"
						+ " || coalesce(competitor_id::text, 'no pointer') || '/' || points"
						+ " from season_competitor order by position")
				.query(String.class).list())
				.as("the frozen season lost his row, kept his name, or forgot somebody else's")
				.containsExactly("1/forgotten/no pointer/10.00",
						"2/" + ANOTHER_NAME + "/" + competitorId(FIRST_WRITTEN) + "/10.00");

		assertThat(db.sql("select coalesce(who, 'forgotten') from season_league_standing")
				.query(String.class).list())
				.as("the league's frozen standing kept his name")
				.containsExactly("forgotten");
	}

	/**
	 * NOT ONE ROW ANYWHERE IN THE DATABASE STILL SAYS WHO HE WAS, AND THIS ASKS EVERY COLUMN
	 * THERE IS RATHER THAN THE ONES I THOUGHT OF.
	 *
	 * <p><b>This is the floor under every assertion above and it holds no list of its
	 * own.</b> The tables and the columns come out of {@code information_schema}, so a column
	 * added tomorrow that keeps a member's name is inside this case on the day it is added,
	 * without anybody remembering to put it here. The rule of 05.09.2026: „Pod koji i sam
	 * nosi spisak nije pod."
	 *
	 * <p><b>Five needles and not one</b>, because „his name" is four different values in
	 * three tables and the member number is a fifth: his given name, his surname, the
	 * DIFFERENT surname on his account, the address he signed in with, and the number PDL P23
	 * names in as many words („Ako igde ostane zapis da je 000127 bio odredjena osoba").
	 *
	 * <p><b>And it is run twice</b>, once before the deletion and once after, because a scan
	 * that finds nothing proves nothing until it has been shown to find something. Before, it
	 * must find every one of the five.
	 */
	@Test
	void nothingAnywhereStillSaysWhoHeWas() throws Exception {
		List<String> needles = List.of(HIS_GIVEN_NAME, HIS_SURNAME, HIS_ACCOUNT_SURNAME,
				HIS_EMAIL, THE_TARGET);

		for (String needle : needles) {
			assertThat(everyColumnHolding(needle))
					.as("the scan cannot find %s even before he is deleted, so finding"
							+ " nothing afterwards would say nothing at all", needle)
					.isNotEmpty();
		}

		assertThat(deleteAs(THE_DELETER, THE_TARGET, "delete").getStatus()).isEqualTo(204);

		for (String needle : needles) {
			assertThat(everyColumnHolding(needle))
					.as("%s is still written somewhere after he was deleted, which PDL P23"
							+ " calls „nista nije obrisano nego samo sakriveno“", needle)
					.isEmpty();
		}
	}

	/**
	 * A TEAM HE WAS THE LAST OF GOES WITH HIM, AND A TEAM THAT STILL HAS SOMEBODY DOES NOT.
	 *
	 * <p>Owner, PDL P13a, 25.09.2026: „I tim (ako nema više ni jednog člana) i par (ako nema
	 * bar jednog člana) nestaju sa spiska", choosing out of three that the team goes of its
	 * own accord.
	 *
	 * <p><b>Three teams are read at once and each of them is a different answer.</b>
	 * {@link #TEAM_KEPT_BY_AN_ENDED_ROW} is the one that matters: what is left in it is a
	 * membership with {@code season_to} set, which is a man who is in the team until 31
	 * December. Asked as „has an open membership" - the question all three of
	 * {@code CompetitorApi}, {@code MeApi} and {@code TeamApi} ask about a member - that team
	 * goes today and takes a team-mate's row with it.
	 */
	@Test
	void theTeamHeWasTheLastOfGoesAndTheOthersStay() throws Exception {
		assertThat(deleteAs(THE_DELETER, THE_TARGET, "delete").getStatus()).isEqualTo(204);

		assertThat(teamsThatExist())
				.as("the team he was the last of, the two that still have somebody, and the"
						+ " one that never had anybody")
				.containsExactlyInAnyOrder(TEAM_KEPT_BY_AN_OPEN_ROW, TEAM_KEPT_BY_AN_ENDED_ROW,
						A_TEAM_WITH_NOBODY);

		assertThat(db.sql("select count(*) from team_membership").query(Long.class).single())
				.as("a team that went took somebody else's membership with it")
				.isEqualTo(2);
	}

	/**
	 * HIS PROFILE PICTURE GOES WITH HIM, ROW AND FILE, WHETHER OR NOT ITS FILE IS STILL ON DISK.
	 *
	 * <p>Measured 25.09.2026: {@code competitor.photo_id} points AT {@code photo}, not the
	 * other way round, so nothing in the schema's own cascades ever touches the row or the file
	 * a deleted member's portrait leaves behind - a probe found the row still there,
	 * {@code select count(*) from photo} answering one where it should answer zero. PDL P21:
	 * „jedina fotografija clana je njegova profilna, koja odlazi sa profilom."
	 *
	 * <p><b>Three members and three photos: a file actually on disk, no file at all, and a file
	 * that cannot be removed</b>, because {@code takeAwayThePhoto} has three ways through it -
	 * the ordinary one where the file is there and goes, the one where it is already gone and
	 * only a warning is logged, and the one where removing it throws and is caught and logged
	 * instead of stopping the deletion. A fixture missing any one of the three leaves that line
	 * looking covered by one of the others passing.
	 *
	 * <p><b>THE THIRD IS FORCED THE WAY {@code TheRemovalStandsEvenWhenTheFileWontGoTest} forces
	 * it for {@code MePhotoApi}</b>: a non-empty directory where the file should be.
	 * {@code Files.deleteIfExists} refuses a directory that still holds something, which is a
	 * real filesystem property and not a mock standing in for one.
	 */
	@Test
	void hisProfilePictureGoesWithHimWhetherOrNotItsFileIsStillOnDisk() throws Exception {
		long withFile = photo();
		long withoutFile = photo();
		long withBlockedFile = photo();

		db.sql("update competitor set photo_id = ? where member_number = ?")
				.params(withFile, THE_TARGET).update();
		db.sql("update competitor set photo_id = ? where member_number = ?")
				.params(withoutFile, NO_ACCOUNT_AT_ALL).update();
		db.sql("update competitor set photo_id = ? where member_number = ?")
				.params(withBlockedFile, A_LAPSED_MEMBER).update();

		Files.createDirectories(Path.of(folder));
		Path file = Path.of(folder).resolve(String.valueOf(withFile));
		Files.write(file, "bajtovi slike koja stoji".getBytes());

		Path blocked = Path.of(folder).resolve(String.valueOf(withBlockedFile));
		Files.createDirectory(blocked);
		Files.writeString(blocked.resolve("nemoguce-obrisati.txt"), "x");

		assertThat(deleteAs(THE_DELETER, THE_TARGET, "delete").getStatus()).isEqualTo(204);
		assertThat(deleteAs(THE_DELETER, NO_ACCOUNT_AT_ALL, "delete").getStatus()).isEqualTo(204);
		assertThat(deleteAs(THE_DELETER, A_LAPSED_MEMBER, "delete").getStatus())
				.as("a fault removing his picture's file stopped a deletion the owner calls final")
				.isEqualTo(204);

		assertThat(photoRowExists(withFile))
				.as("his profile picture's row survived the member it belonged to")
				.isFalse();
		assertThat(Files.exists(file))
				.as("his profile picture's file survived the member it belonged to")
				.isFalse();
		assertThat(photoRowExists(withoutFile))
				.as("a photo row survived even though its file was already gone from disk")
				.isFalse();
		assertThat(photoRowExists(withBlockedFile))
				.as("a photo row survived even though its file could not be removed from disk")
				.isFalse();
	}

	/**
	 * THE EMPTIED TEAM'S LOGO GOES WITH IT, ROW AND FILE, AND THE TEAM THAT STAYS KEEPS ITS OWN.
	 *
	 * <p>This is {@link ATeamGoesWithItsLastMember}'s own reasoning rather than a decision - no
	 * entry in either journal names a team's logo - and it is measured here through the same
	 * door {@link #theTeamHeWasTheLastOfGoesAndTheOthersStay} already proves empties
	 * {@link #TEAM_THAT_EMPTIES} and keeps {@link #TEAM_KEPT_BY_AN_OPEN_ROW} standing.
	 *
	 * <p><b>Two teams and two logos</b>, so „the logo that went" is never „the only logo" and a
	 * statement that swept every row in {@code photo} could not pass this and fail the
	 * assertion below it.
	 */
	@Test
	void theEmptiedTeamsLogoGoesWithItAndTheKeptTeamsLogoStays() throws Exception {
		long goneLogo = photo();
		long keptLogo = photo();

		db.sql("update team set logo_id = ? where slug = ?").params(goneLogo, TEAM_THAT_EMPTIES)
				.update();
		db.sql("update team set logo_id = ? where slug = ?")
				.params(keptLogo, TEAM_KEPT_BY_AN_OPEN_ROW).update();

		assertThat(deleteAs(THE_DELETER, THE_TARGET, "delete").getStatus()).isEqualTo(204);

		assertThat(photoRowExists(goneLogo))
				.as("the emptied team's logo survived the team it belonged to")
				.isFalse();
		assertThat(photoRowExists(keptLogo))
				.as("a team that is still standing lost the logo of the team that went")
				.isTrue();
	}

	/**
	 * EVERY HALF HE LEAVES BEHIND IS TOLD, AND NOBODY ELSE IS.
	 *
	 * <p>PDL P13, 07.09.2026: „„Raskini" obavestava drugu polovinu... promena pogadja clana
	 * koji nista nije pritisnuo, pa se obavestava odmah. Bez toga je portal javljao kroz
	 * jedna vrata a cutao kroz druga." Deleting a member is a third door onto the same act
	 * and the pairs go by cascade, saying nothing.
	 *
	 * <p><b>Two pairs of his and one that is not his</b>, so „everybody was told" and „his
	 * partners were told" are different answers, and „the first pair" is not „his pair".
	 *
	 * <p><b>And the message carries the replacement text rather than his name</b>, which is
	 * the one place this class writes a name at all: the sentence is the portal's own
	 * ({@code PairWriteApi.theBrokenPairReads}) and what goes into it is ADL A37's
	 * {@code <Obrisani član>}. Written with his name, the message would be a row created
	 * BY the deletion that says who was deleted.
	 */
	@Test
	void bothHalvesHeLeavesBehindAreToldAndNobodyElseIs() throws Exception {
		assertThat(deleteAs(THE_DELETER, THE_TARGET, "delete").getStatus()).isEqualTo(204);

		assertThat(whatTheLeagueWrote())
				.as("who was told a pair of his had ended, and what they read")
				.containsExactly(
						HIS_FIRST_PARTNER + ": Trkački par sa " + CompetitorWriteApi.A_DELETED_MAN
								+ " za sezonu " + A_SEASON_BEING_RUN + " je raskinut.",
						HIS_SECOND_PARTNER + ": Trkački par sa "
								+ CompetitorWriteApi.A_DELETED_MAN + " za sezonu "
								+ THE_SEASON_AFTER + " je raskinut.");

		assertThat(db.sql("select count(*) from racing_pair").query(Long.class).single())
				.as("the pair that is not his went with the two that are")
				.isOne();
	}

	/**
	 * AND WHEN IT IS A WOMAN WHO GOES, THE OTHER WORD IS THE ONE THAT IS WRITTEN.
	 *
	 * <p>ADL A37, owner, 06.09.2026: „Zamenski tekst je <Obrisani clan>, odnosno <Obrisana
	 * clanica>, sa uglastim zagradama." A fixture of one sex measures one of the two, and the
	 * branch that picks between them is read off the column the recipient is NOT in.
	 *
	 * <p>Her comment and her message are not in the fixture, so the trigger's own choice
	 * between the two words is measured separately and in the same case: the frozen season
	 * keeps a gender column for exactly this and her row has none, which leaves the pair.
	 */
	@Test
	void aDeletedWomanIsTheOtherWord() throws Exception {
		assertThat(deleteAs(THE_DELETER, THE_WOMAN_DELETED, "delete").getStatus()).isEqualTo(204);

		assertThat(whatTheLeagueWrote())
				.as("her partner was told with the man's word, or was not told at all")
				.containsExactly(HER_PARTNER + ": Trkački par sa "
						+ CompetitorWriteApi.A_DELETED_WOMAN + " za sezonu " + A_SEASON_BEING_RUN
						+ " je raskinut.");

		assertThat(db.sql("select count(*) from racing_pair").query(Long.class).single())
				.as("the two pairs that are not hers went with hers")
				.isEqualTo(2);
	}

	/**
	 * A MEMBER WITH NO ACCOUNT IS DELETED JUST THE SAME.
	 *
	 * <p>{@code account.competitor_id} is nullable and unique, so a member hangs off at most
	 * one account and may hang off none - a row entered before anybody claimed it, or one
	 * whose account has already gone. The statement that removes the account touches no row
	 * and nothing refuses.
	 */
	@Test
	void aMemberWithNoAccountIsDeletedJustTheSame() throws Exception {
		assertThat(deleteAs(THE_DELETER, NO_ACCOUNT_AT_ALL, "delete").getStatus()).isEqualTo(204);

		assertThat(membersThatExist())
				.as("a member with no account could not be deleted")
				.doesNotContain(NO_ACCOUNT_AT_ALL);
	}

	/**
	 * AND SO IS ONE WHOSE FEE HAS LAPSED, WHICH IS THE ONE ROUTE THAT MUST NOT ASK.
	 *
	 * <p>Owner, 19.09.2026: „Clan kome je istekla clanarina dopire samo do strane za obnovu...
	 * jer se sve akcije za njega brane." That rule is about what a MEMBER may do with his own
	 * things. This is the administration acting ON him, and a member whose fee has lapsed is
	 * exactly the one an administrator is likely to be deleting - so a {@code c.active}
	 * copied from the six resources that do read it would serve only members in good
	 * standing.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsDeletedJustTheSame() throws Exception {
		assertThat(deleteAs(THE_DELETER, A_LAPSED_MEMBER, "delete").getStatus()).isEqualTo(204);

		assertThat(membersThatExist())
				.as("a member whose fee had lapsed could not be deleted")
				.doesNotContain(A_LAPSED_MEMBER);
	}

	/**
	 * A MEMBER WHOSE ACCOUNT ADMINISTERS THE PORTAL IS REFUSED, AND BOTH WAYS OF
	 * ADMINISTERING ARE ASKED.
	 *
	 * <p>PDL P23, 14.09.2026, naming the case that produced the {@code restrict}: „moderator
	 * koji i trci ima JEDAN nalog za oboje. Ako mu se obrise takmicarski zapis, on i dalje
	 * treba da administrira portal." Neither of the owner's two outcomes fits him and he has
	 * not said what does, so the portal refuses rather than guesses.
	 *
	 * <p><b>The role and the ticked box are two states of one axis</b>, and
	 * {@link ModeratorWriteApi} says why they come apart: a moderator with every box removed
	 * is still a moderator, and the boxes outlive the role. One of the two in the condition
	 * lets the other through.
	 *
	 * @param who      a member whose account administers in one of the two ways
	 * @param how      what makes him administer, for the message
	 */
	@ParameterizedTest
	@CsvSource({"000900, the moderator's role and not one ticked box",
			"001000, an ordinary role and a ticked box"})
	void aMemberWhoseAccountAdministersIsRefused(String who, String how) throws Exception {
		MockHttpServletResponse answer = deleteAs(THE_DELETER, who, "delete");

		assertThat(answer.getStatus())
				.as("%s: the member was deleted although his account administers", how)
				.isEqualTo(409);

		assertThat(reasonIn(answer))
				.as("%s: he was refused without being told what stopped it", how)
				.isEqualTo(CompetitorWriteApi.THE_ACCOUNT_ADMINISTERS);

		assertThat(membersThatExist())
				.as("%s: he was refused and deleted anyway", how)
				.contains(who);
	}

	/**
	 * THE SUPERADMIN ADMINISTERS TOO, AND NEITHER HALF OF THE EXISTING CONDITION CAN SEE HIM.
	 *
	 * <p>Measured 25.09.2026: his row carries {@code competitor} and zero ticks, precisely the
	 * shape {@link #aMemberWhoseAccountAdministersIsRefused} already proves is let through by
	 * design when nobody administers - so a role check and a ticked-box check both answer him
	 * "no", and only a third source, {@link com.btl.portal.domain.rights.TheNamedSuperadmin},
	 * can refuse him. PDL P21, 14.09.2026: „nema radnje kroz portal koja bi superadmina obrisala
	 * ili razvlastila."
	 *
	 * <p><b>Deleted by SOMEBODY ELSE</b>, so this is not a case about a caller acting on
	 * himself - {@link #theSuperadminCannotDeleteHimselfEither} is that one.
	 */
	@Test
	void theSuperadminCannotBeDeletedByAnotherModerator() throws Exception {
		man("001300", "Super", "Adminovic");
		account(SUPERADMIN_EMAIL, "001300", "competitor", "Super", "Adminovic");
		confirm(SUPERADMIN_EMAIL);

		MockHttpServletResponse answer = deleteAs(THE_DELETER, "001300", "delete");

		assertThat(answer.getStatus())
				.as("the named and confirmed superadmin was deleted by another moderator")
				.isEqualTo(409);

		assertThat(reasonIn(answer))
				.as("he was refused without being told what stopped it")
				.isEqualTo(CompetitorWriteApi.THE_ACCOUNT_ADMINISTERS);

		assertThat(membersThatExist())
				.as("he was refused and deleted anyway")
				.contains("001300");
	}

	/**
	 * AND HE CANNOT DELETE HIMSELF EITHER, WHICH THE DOOR ALONE COULD NOT REFUSE.
	 *
	 * <p>{@link WhoIsAsking} hands the superadmin every right there is, so the gate in front of
	 * this route lets him through to ask about his own number exactly as it would for anybody
	 * else he may delete - the only thing standing between him and a 204 is the read inside
	 * {@code hisAccountAdministers}, over the very row the request names. A check written the
	 * other way round, over the caller's own session rather than the row being deleted, would
	 * refuse nothing here.
	 */
	@Test
	void theSuperadminCannotDeleteHimselfEither() throws Exception {
		man("001300", "Super", "Adminovic");
		account(SUPERADMIN_EMAIL, "001300", "competitor", "Super", "Adminovic");
		confirm(SUPERADMIN_EMAIL);

		MockHttpServletResponse answer = deleteAs(SUPERADMIN_EMAIL, "001300", "delete");

		assertThat(answer.getStatus())
				.as("the superadmin deleted his own member row")
				.isEqualTo(409);

		assertThat(membersThatExist())
				.as("he deleted himself despite the refusal")
				.contains("001300");
	}

	/**
	 * AN ADDRESS THE SETTINGS NAME BUT NOBODY HAS CONFIRMED IS NOT THE SUPERADMIN, AND IS
	 * DELETED JUST THE SAME.
	 *
	 * <p>The mutation this is written against: a check that reads the address alone and drops
	 * the confirmation half of {@code TheNamedSuperadmin.covers}. „Nalog sa tom adresom, KAD JE
	 * ADRESA POTVRDJENA, nosi ulogu superadmina" (PDL P21) is two conditions and not one; a
	 * registration that merely claims the address must not be able to make itself
	 * undeletable.
	 */
	@Test
	void anAddressNamedButNotConfirmedIsNotTheSuperadminAndIsDeletedJustTheSame() throws Exception {
		man("001300", "Super", "Adminovic");
		account(SUPERADMIN_EMAIL, "001300", "competitor", "Super", "Adminovic");

		assertThat(deleteAs(THE_DELETER, "001300", "delete").getStatus())
				.as("an unconfirmed claim on the named address was treated as the superadmin")
				.isEqualTo(204);

		assertThat(membersThatExist())
				.as("he was answered 204 and kept his row anyway")
				.doesNotContain("001300");
	}

	/**
	 * AND THE REQUEST HAS TO SAY WHAT BECOMES OF THE ACCOUNT, WHICH IS THE OWNER'S „TWO
	 * STEPS" ARRIVING AS A SENTENCE RATHER THAN AS A CRASH.
	 *
	 * <p>PDL P23, 14.09.2026: „Prvo se odluci sta sa nalogom (anonimizuje se ili se brise),
	 * pa tek onda clan moze da ode." Two decisions and not two doors: without the word the
	 * portal would either guess or fall over on {@code account_competitor_fk}, and a 500 is
	 * not a thing to answer an administrator with.
	 *
	 * <p><b>Anonymising is the owner's other outcome and it is refused with its own
	 * sentence</b> rather than lumped in with a word nobody decided. It is not written: the
	 * columns it would have to fill ({@code email} with its shape and its unique index, and
	 * two names that refuse a blank) are values nobody has chosen, and the one case it exists
	 * for is refused above whatever this parameter says.
	 *
	 * @param said     what the request says about the account, or nothing at all
	 * @param expected the status, and with it which of the two sentences comes back
	 */
	@ParameterizedTest
	@CsvSource({", 400, nothing was said about the account",
			"'', 400, an empty word was sent", "obrisi, 400, a word nobody decided",
			"Delete, 400, the right word in the wrong case",
			"anonymise, 409, the owner's other outcome"})
	void theRequestHasToSayWhatBecomesOfTheAccount(String said, int expected, String what)
			throws Exception {

		MockHttpServletResponse answer = deleteAs(THE_DELETER, THE_TARGET, said);

		assertThat(answer.getStatus())
				.as("%s: answered wrongly", what)
				.isEqualTo(expected);

		assertThat(reasonIn(answer))
				.as("%s: refused without being told what was missing", what)
				.isEqualTo(expected == 409 ? CompetitorWriteApi.ANONYMISING_IS_NOT_WRITTEN_YET
						: CompetitorWriteApi.THE_ACCOUNT_MUST_BE_DECIDED);

		assertThat(membersThatExist())
				.as("%s: the member was refused and deleted anyway", what)
				.contains(THE_TARGET);

		assertThat(teamsThatExist())
				.as("%s: nothing was deleted and a team went anyway", what)
				.hasSize(4);
	}

	/**
	 * A NUMBER NOBODY HAS IS ANSWERED THE SAME AS AN ADDRESS THAT IS NOT THERE, AND BEFORE
	 * ANYTHING ELSE IS LOOKED AT.
	 *
	 * <p>Asked after the parameter, a caller who sent no word would be told what is wrong
	 * with his request about a member who does not exist; asked after the account, the
	 * portal would read a second table for a key it has nothing behind.
	 *
	 * <p><b>The number sent is a well formed one</b>, six digits like every other, so this is
	 * „nobody has it" and not „the shape is wrong".
	 */
	@Test
	void aNumberNobodyHasIsAnsweredLikeAnAddressThatIsNotThere() throws Exception {
		MockHttpServletResponse answer = deleteAs(THE_DELETER, "009999", null);

		assertThat(answer.getStatus())
				.as("a number nobody has was answered something other than 404")
				.isEqualTo(404);

		assertThat(answer.getContentAsString())
				.as("the 404 for a key nobody has carries a sentence about the request")
				.isEmpty();
	}

	/**
	 * AND WITHOUT THE RIGHT OVER MEMBERS, NOTHING HAPPENS AND NOTHING IS LEARNED.
	 *
	 * <p>ADL A8, owner, 13.09.2026: „neprijavljen dobija 401, a prijavljen kome pravo
	 * nedostaje dobija 404, isti odgovor kao da adresa ne postoji, jer ne sme ni da sazna da
	 * radnja postoji."
	 *
	 * <p><b>{@code RightsAtTheDoorTest} sweeps every route for the rule; this is the same
	 * rule measured with the DATABASE read afterwards</b>, which that sweep does not do. A
	 * door that answered 404 and deleted the member anyway would pass it.
	 */
	@Test
	void aModeratorWithoutTheRightOverMembersDeletesNothing() throws Exception {
		assertThat(deleteAs(A_MODERATOR_WITH_NO_RIGHTS, THE_TARGET, "delete").getStatus())
				.as("a moderator with no right over members was let in")
				.isEqualTo(404);

		assertThat(membersThatExist())
				.as("he was answered 404 and the member went anyway")
				.contains(THE_TARGET);
	}

	/** And nobody at all is answered 401 by the chain, before the handler is reached. */
	@Test
	void somebodyWhoIsNotSignedInDeletesNothing() throws Exception {
		assertThat(http.perform(delete("/api/competitors/" + THE_TARGET)
						.param("account", "delete").with(csrf()))
				.andReturn().getResponse().getStatus())
				.as("a stranger reached the handler")
				.isEqualTo(401);

		assertThat(membersThatExist()).contains(THE_TARGET);
	}

	private MockHttpServletResponse deleteAs(String email, String memberNumber, String account)
			throws Exception {

		MockHttpServletRequestBuilder asking = delete("/api/competitors/" + memberNumber)
				.with(csrf())
				.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));

		return http.perform(account == null ? asking : asking.param("account", account))
				.andReturn().getResponse();
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	/**
	 * EVERY COLUMN OF EVERY TABLE THAT HOLDS THIS TEXT, ASKED OF THE CATALOGUE.
	 *
	 * <p>The list of tables and the list of columns are both {@code information_schema}'s, so
	 * there is no list here to go short. Views are left out by asking for base tables: a view
	 * holding the text holds it because a table does, and it would be reported twice.
	 *
	 * @return {@code table.column} for each place the text stands, which is what a failure
	 *         has to name in order to be actionable
	 */
	private List<String> everyColumnHolding(String needle) {
		List<String> found = new ArrayList<>();

		List<String> columns = db.sql("select c.table_name || '.' || c.column_name"
						+ " from information_schema.columns c"
						+ " join information_schema.tables t on t.table_schema = c.table_schema"
						+ "   and t.table_name = c.table_name"
						+ " where c.table_schema = 'public' and t.table_type = 'BASE TABLE'"
						+ " and c.data_type in ('text', 'character varying', 'character')"
						+ " order by c.table_name, c.column_name")
				.query(String.class).list();

		for (String each : columns) {
			String table = each.substring(0, each.indexOf('.'));
			String column = each.substring(each.indexOf('.') + 1);

			boolean holds = Boolean.TRUE.equals(db.sql("select exists(select 1 from \"" + table
							+ "\" where \"" + column + "\" like ?)")
					.param("%" + needle + "%")
					.query(Boolean.class).single());

			if (holds) {
				found.add(each);
			}
		}

		return found;
	}

	private void man(String number, String first, String last) {
		competitor(number, first, last, "M");
	}

	private void woman(String number, String first, String last) {
		competitor(number, first, last, "F");
	}

	private void competitor(String number, String first, String last, String gender) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, first, last, gender, String.format("%016x", ++issued))
				.update();
	}

	private void team(String slug) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id)"
						+ " values (?, ?, '', '', (select id from place where rank = 1), null,"
						+ " null, null, 2030, null)")
				.params(slug, "Tim " + slug).update();
	}

	/** @param seasonTo null while he is still in it, which is V11's „the last season" */
	private void inATeam(String memberNumber, String teamSlug, int seasonFrom, Integer seasonTo) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to,"
						+ " left_reason)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?, ?, ?)")
				.params(memberNumber, teamSlug, seasonFrom, seasonTo,
						seasonTo == null ? null : "izašao iz tima")
				.update();
	}

	private void sitsInTheSeatOf(String memberNumber, String slug) {
		db.sql("update team set admin_id = (select id from competitor where member_number = ?)"
						+ " where slug = ?")
				.params(memberNumber, slug).update();
	}

	private void league(String slug) {
		db.sql("insert into league (slug, name, season, rules, prizes)"
						+ " values (?, 'Liga', ?, '', '')")
				.params(slug, A_SEASON_BEING_RUN).update();
	}

	private void referredBy(String memberNumber, String referrer) {
		db.sql("update competitor set referred_by ="
						+ " (select id from competitor where member_number = ?)"
						+ " where member_number = ?")
				.params(referrer, memberNumber).update();
	}

	private void pair(int season, String manNumber, String womanNumber) {
		db.sql("insert into racing_pair (season, man_id, woman_id)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(season, manNumber, womanNumber).update();
	}

	private void anEvent() {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, 'Dogadjaj', date '2027-05-01',"
						+ " (select id from place where rank = 1), null, null, 'race', false,"
						+ " '', '')")
				.param(AN_EVENT).update();
	}

	private void comment(String memberNumber, String who) {
		db.sql("insert into event_comment (event_id, competitor_id, who, published_at,"
						+ " rating_organisation, rating_value, rating_ambience, body)"
						+ " values ((select id from btl_event where slug = ?),"
						+ " (select id from competitor where member_number = ?), ?,"
						+ " timestamptz '2027-05-02 10:00:00+00', 5, 5, 5, 'Bilo je dobro.')")
				.params(AN_EVENT, memberNumber, who).update();
	}

	private void wrote(String fromNumber, String fromName, String toNumber) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?), ?,"
						+ " 'Pitanje', 'Telo poruke.')")
				.params(toNumber, fromNumber, fromName).update();
	}

	private void frozen(int position, String memberNumber, String who, String gender) {
		db.sql("insert into season_competitor (season, position, competitor_id, who, gender,"
						+ " category, points, races)"
						+ " values (?, ?, (select id from competitor where member_number = ?), ?,"
						+ " ?, 'Seniori', 10.00, 3)")
				.params(A_SEASON_BEING_RUN, position, memberNumber, who, gender).update();

		if (position == 1) {
			db.sql("insert into season_league_standing (season, league_id, league_name, position,"
							+ " competitor_id, who, gender, points)"
							+ " values (?, (select id from league where slug = ?), 'Liga', 1,"
							+ " (select id from competitor where member_number = ?), ?, ?, 10.00)")
					.params(A_SEASON_BEING_RUN, HIS_LEAGUE, memberNumber, who, gender).update();
		}
	}

	private void account(String email, String memberNumber, String role, String first,
			String last) {

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values (?, ?, ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(first, last, email, role, memberNumber).update();

		openSession(email);
	}

	private void moderator(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?,"
						+ " (select id from role where code = 'moderator'))")
				.param(email).update();

		openSession(email);
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	/** Marks the address confirmed, which is the second half of PDL P21's sentence. */
	private void confirm(String email) {
		db.sql("update account set email_confirmed_at = ? where email = ?")
				.params(Timestamp.from(Instant.now()), email).update();
	}

	/** A fresh, valid picture row, standing for nobody until a case points something at it. */
	private long photo() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 100, ?, 0.5, 0.5, 1) returning id")
				.param("a".repeat(64))
				.query(Long.class)
				.single();
	}

	private boolean photoRowExists(long photo) {
		return db.sql("select exists(select 1 from photo where id = ?)").param(photo)
				.query(Boolean.class).single();
	}

	private void openSession(String email) {
		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?,"
						+ " ?)")
				.params(email, session.hash(),
						Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt),
						Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private long competitorId(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?")
				.param(memberNumber).query(Long.class).single();
	}

	private List<String> membersThatExist() {
		return db.sql("select member_number from competitor order by member_number")
				.query(String.class).list();
	}

	private List<String> teamsThatExist() {
		return db.sql("select slug from team order by slug").query(String.class).list();
	}

	private long howManyMessages() {
		return db.sql("select count(*) from message").query(Long.class).single();
	}

	/** Who every message says it is from, name and pointer together, oldest key first. */
	private List<String> sendersOfEveryMessage() {
		return db.sql("select m.from_name || ' (' || coalesce(c.member_number, 'no pointer')"
						+ " || ')' from message m"
						+ " left join competitor c on c.id = m.from_id"
						/* THE LEAGUE'S OWN MESSAGES ARE LEFT OUT, because they are written BY
						   the deletion and are read by their own case. What this asks about
						   is the two that were there before it. */
						+ " where m.from_name <> ? order by m.id")
				.param(PairWriteApi.THE_LEAGUE)
				.query(String.class).list();
	}

	/** And who every comment says it is by, the same two things in the same shape. */
	private List<String> authorsOfEveryComment() {
		return db.sql("select e.who || ' (' || coalesce(c.member_number, 'no pointer') || ')'"
						+ " from event_comment e"
						+ " left join competitor c on c.id = e.competitor_id order by e.id")
				.query(String.class).list();
	}

	/** Every message the portal itself wrote, addressed and read, in the order it wrote them. */
	private List<String> whatTheLeagueWrote() {
		return db.sql("select c.member_number || ': ' || m.body from message m"
						+ " join competitor c on c.id = m.to_id"
						+ " where m.from_name = ? and m.from_id is null order by m.id")
				.param(PairWriteApi.THE_LEAGUE)
				.query(String.class).list();
	}

	private String seatOf(String slug) {
		return db.sql("select coalesce(c.member_number, 'nobody') from team t"
						+ " left join competitor c on c.id = t.admin_id where t.slug = ?")
				.param(slug)
				.query(String.class).single();
	}
}
