package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * WHAT A TEAM IS SHOWN OF ITS OWN QUEUE, AND WHO IS SHOWN IT.
 *
 * <p><b>NOTHING IN THIS FIXTURE IS THE ONLY ONE OF ITS KIND</b>, on every axis an assertion
 * below reads a value along. Each of these exists because a route answering from the WRONG
 * source would otherwise pass:
 *
 * <ul>
 * <li><b>Never one team, and never the first one.</b> Five teams, and the one every case is
 * about is neither the lowest key ({@link #A_FIRST_TEAM}) nor the only one with a queue -
 * {@link #THE_OTHER_TEAM} and {@link #A_THIRD_TEAM} carry questions of the identical shape,
 * so „the team named in the path" is told from „the first team there is" and from „every
 * team".
 * <li><b>Never one question.</b> Four applications and four invitations stand on
 * {@link #THE_TEAM} at once, so „this row" is told from „the only row".
 * <li><b>Never one member in the team, and never two.</b> Three stand in {@link #THE_TEAM}
 * and only one leads it, so „not the administrator" is not satisfied by whichever of two is
 * left, and BOTH non-administrators are asked.
 * <li><b>Never one season.</b> {@link #LEADER} joined a season already running and
 * {@link #PLAIN} one still to come, so a seat resolved by the season and a seat resolved by
 * the member number are two different answers here.
 * <li><b>Never one day, and never today.</b> Every row carries a written
 * {@code asked_at}/{@code sent_at} and NONE of them falls on the day the clock stands, so a
 * route answering {@code current_date} answers four wrong days. On each list two pairs of rows
 * share an instant, so the order is total or it is not; and one pair of each list stands at half
 * past eleven at night UTC, so a day read in the machine's zone is off by one.
 * <li><b>Never an order that anything but the clause could produce (ADL A52).</b> A list read with
 * no {@code order by} at all comes back in whatever order the query planner finds the rows, and a
 * tie settled by any column but the key comes back in that column's order. So each list is built
 * from TWO pairs of rows that share an instant, the rows are WRITTEN in the reverse of the order
 * they are expected in, and the two pairs are built to OPPOSITE polarity, because one pair cannot
 * tell the key from a second column in both directions: when the row with the lower key is also
 * the first by member number and by name, a tie settled by either of them is the key's order, and
 * when it is the last, the same two turned round are.
 * <ul>
 * <li>In the pair at 08:00 UTC the lower key belongs to the member with the LARGER number and the
 * later name, whose competitor row is made AFTER his twin's and whose own row is written again
 * afterwards (an update puts the new version of a row behind the others in PostgreSQL). So a tie
 * settled by member number, last name, competitor key or referral code, each ascending, comes out
 * with the twin first, and so does a list with the key dropped, whether the plan reads the queue
 * table or the competitor table.
 * <li>In the pair at the night before the lower key belongs to the member with the SMALLER number
 * and the earlier name, whose competitor row is made BEFORE his twin's, so the same four, each
 * descending, come out with the twin first.
 * </ul>
 * <b>Measured by mutation on 02.10.2026, in the review of this very fixture, and not argued.</b>
 * Written with one pair per list and the lower key on the smaller number, ordering the tie by member
 * number or by last name stayed green on both lists (the review's finding), and so did the
 * competitor key and the referral code turned round. Repaired as first asked, with the lower key
 * on the larger number in every pair, the four ascending ones fell and all four of their
 * descending twins stayed green on both lists: the hole had moved and was not closed. With the two
 * pairs as they are now every one of those eight falls on each list, and so do the first fourteen
 * of this fixture's mutations (the clause deleted whole, the key deleted, the key turned round, the
 * time turned round, the key alone, member number alone, competitor key alone).
 * <li><b>Never one reader.</b> Eight, and four of them are refused: whoever leads the team, a
 * member who merely stands in it, a member who leads ANOTHER team, a member with no team at
 * all, the administration, a moderator holding no right, an account naming no member, and
 * nobody.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, TeamJoiningApiTest.TheClockTheseCasesUse.class})
@Transactional
class TeamJoiningApiTest {

	/**
	 * WRITTEN FIRST AND ABOUT NOTHING, so that the member and the team every case is about
	 * are never the lowest key in their table.
	 */
	private static final String FIRST_WRITTEN = "000100";

	/** Leads {@link #THE_TEAM}, having joined a season that is already being run. */
	private static final String LEADER = "000300";

	/**
	 * Stands in {@link #THE_TEAM} and does not lead it, from a season still to come.
	 *
	 * <p>His member number is the LARGER, so „longest in the team" and „smallest number"
	 * would name two different men; which of the two decides is {@code TeamApiTest}'s
	 * question, and what matters here is only that he is refused.
	 */
	private static final String PLAIN = "000500";

	/** A THIRD member of {@link #THE_TEAM} who does not lead it either. */
	private static final String ANOTHER_PLAIN = "001100";

	/** Leads {@link #THE_OTHER_TEAM}: somebody who leads A team, but not this one. */
	private static final String OUTSIDER = "000600";

	/** Leads {@link #A_THIRD_TEAM}, so „another team" is never one team. */
	private static final String THIRD = "000700";

	/** A member in no team and in no queue: the third party with no side. */
	private static final String UNRELATED = "001200";

	/* --------------------------------------------------- who asked THE_TEAM to take him */

	private static final String APPLICANT = "000800";

	private static final String ANOTHER_APPLICANT = "000900";

	/**
	 * HIS PROFILE IS HIDDEN AND HIS APPLICATION IS LISTED ALL THE SAME.
	 *
	 * <p>{@code profile_hidden} hides a member from everybody who is neither an active member
	 * nor the administration, and every caller of this resource is one of the two by
	 * construction ({@code TeamJoiningApi} says why). Hidden from the one team that has to
	 * answer him, a member could apply and never be read.
	 */
	private static final String HIDDEN_PROFILE = "001000";

	/**
	 * HE APPLIED AND HAS SINCE GOT A TEAM THAT IS ALREADY RUNNING - the decision of
	 * 06.09.2026, and the first of the two states it has.
	 */
	private static final String GOT_A_TEAM_TODAY = "001300";

	/**
	 * AND THE SECOND STATE OF THE SAME AXIS: his membership has not begun yet.
	 *
	 * <p>{@code Membership.standsInTheWayOfJoiningIn} answers TRUE for an open membership
	 * whatever season it starts in, so a route asking „is he in a team today" would list him
	 * and „Primi u tim" would pull him out of a squad he has already been written into.
	 */
	private static final String JOINS_NEXT_SEASON = "001400";

	/**
	 * AND THE THIRD STATE, WHICH IS THE ONE THAT MUST STILL BE LISTED: he was in a team and
	 * left it, in a season that is over.
	 *
	 * <p>Without him „hidden when he has a membership row" and „hidden when a membership
	 * stands in the way" are one answer, and the rule really is the second.
	 */
	private static final String LEFT_A_TEAM_LONG_AGO = "001500";

	/** He applied to {@link #THE_TEAM} and his fee has since lapsed. */
	private static final String LAPSED_APPLICANT = "001600";

	/** He applied to {@link #THE_OTHER_TEAM}: the row that measures the team in the path. */
	private static final String APPLIED_ELSEWHERE = "001700";

	/* ------------------------------------------------------ whom THE_TEAM has asked in */

	private static final String INVITED = "001800";

	private static final String ANOTHER_INVITED = "001900";

	/**
	 * INVITED, AND HIS FEE HAS SINCE LAPSED. His row stays and his NUMBER goes.
	 *
	 * <p>The two halves are measured separately below, because dropping the row and dropping
	 * the name are two different mistakes with two different costs.
	 */
	private static final String LAPSED_INVITED = "002000";

	/**
	 * INVITED, AND HE HAS SINCE JOINED A TEAM - AND HIS ROW IS STILL LISTED.
	 *
	 * <p>This is where the two lists part, and it is read off the write half rather than
	 * chosen: {@code thisTeamHasAskedHim} asks {@code team_id} and {@code competitor_id} and
	 * nothing else, so this row goes on refusing a second invitation for ever. Dropped from
	 * the list, the screen would show an empty place, the team would ask again, and the
	 * server would refuse - which is the broken button the hiding of a stale APPLICATION
	 * exists to prevent, arriving from the other side.
	 */
	private static final String INVITED_WHO_GOT_A_TEAM = "002100";

	/** Invited by {@link #THE_OTHER_TEAM}, which measures the team in the path again. */
	private static final String INVITED_BY_ANOTHER_TEAM = "002200";

	private static final String A_FIRST_TEAM = "prvi-tim";

	private static final String THE_TEAM = "sava-runners";

	private static final String THE_OTHER_TEAM = "timocki-tim";

	private static final String A_THIRD_TEAM = "dunavski-tim";

	/** Nobody stands in it, so „a team with no leader" is not the same row as „no team". */
	private static final String AN_EMPTY_TEAM = "pusti-tim";

	private static final String MODERATOR_OVER_THE_TEAMS = "moderator-timovi@primer.rs";

	private static final String MODERATOR_WITH_NO_RIGHT = "moderator-bez-prava@primer.rs";

	/**
	 * THE DAY THE CLOCK STANDS ON, and no row in this fixture was written on it.
	 *
	 * <p>In 2027 and not in 2026: through 2026 every method answering „which season"
	 * returns 2027, so an assertion about a season would be satisfied by a constant.
	 */
	private static final Instant TODAY = Instant.parse("2027-10-15T09:00:00Z");

	/**
	 * HALF PAST ELEVEN AT NIGHT IN UTC, WHICH IS THE NEXT DAY IN BELGRADE.
	 *
	 * <p>The only instant that measures WHERE the day is read. A route reading it in the
	 * machine's zone answers 1 October; the league's own zone answers 2 October. It is also the
	 * instant a pair of applications and a pair of invitations share, so the order of those rows
	 * is settled by the key too.
	 */
	private static final Instant THE_NIGHT_BEFORE = Instant.parse("2027-10-01T23:30:00Z");

	/** The day {@link #THE_NIGHT_BEFORE} falls on in the league's own time. */
	private static final String THE_MORNING_AFTER = "2027-10-02";

	/** One instant shared by two applications, so the order has to be settled by the key. */
	private static final Instant ONE_INSTANT_TWO_ROWS = Instant.parse("2027-10-05T08:00:00Z");

	private static final String THAT_DAY = "2027-10-05";

	/** One instant shared by two INVITATIONS, so the order of the second list is settled by the key. */
	private static final Instant ONE_INSTANT_TWO_INVITATIONS = Instant.parse("2027-10-06T08:00:00Z");

	private static final String THAT_OTHER_DAY = "2027-10-06";

	private static final int A_SEASON_ALREADY_RUNNING = 2027;

	private static final int A_SEASON_STILL_TO_COME = 2029;

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/**
	 * A clock reporting UTC on purpose, so that whoever asks which day a row falls on has to
	 * re-read the instant in the league's own time. The shape {@code TeamJoiningWriteApiTest}
	 * uses, for the same reason.
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

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(TODAY);
		}
	}

	@BeforeEach
	void fiveTeamsAndTwoQueues() {
		clock.moveTo(TODAY);

		competitor(FIRST_WRITTEN, true, false);
		competitor(LEADER, true, false);
		competitor(PLAIN, true, false);
		competitor(ANOTHER_PLAIN, true, false);
		competitor(OUTSIDER, true, false);
		competitor(THIRD, true, false);
		competitor(UNRELATED, true, false);
		/* THE FOUR APPLICANTS THE FIRST LIST SHOWS, MADE IN AN ORDER CHOSEN AGAINST EVERY ORDER BUT
		   THE KEY'S (ADL A52; the class note says why there are two pairs and why they differ):

		     - the pair at 08:00 UTC: the lower key is HIDDEN_PROFILE's, the LARGER number (001000)
		       and the later name, and his competitor is made AFTER his twin APPLICANT's;
		     - the pair at the night before: the lower key is ANOTHER_APPLICANT's, the SMALLER
		       number (000900) and the earlier name, and his competitor is made BEFORE his twin
		       LEFT_A_TEAM_LONG_AGO's (001500).

		   A plan that reads the lists from the competitor table, and a tie settled by member
		   number, last name, competitor key or referral code (the last two are the order the
		   competitors were made in), each in either direction, comes out the wrong way round in one
		   pair or in the other. The three withheld applicants and the other team's are made after
		   them, where they cannot be mistaken for any of it. */
		competitor(APPLICANT, true, false);
		competitor(HIDDEN_PROFILE, true, true);
		competitor(ANOTHER_APPLICANT, true, false);
		competitor(LEFT_A_TEAM_LONG_AGO, true, false);
		competitor(GOT_A_TEAM_TODAY, true, false);
		competitor(JOINS_NEXT_SEASON, true, false);
		competitor(LAPSED_APPLICANT, false, false);
		competitor(APPLIED_ELSEWHERE, true, false);

		/* AND THE FOUR INVITEES THE SECOND LIST SHOWS, the same way over: in the pair at 08:00 UTC the
		   lower key is INVITED_WHO_GOT_A_TEAM's (002100, the larger number), made AFTER his twin
		   LAPSED_INVITED (002000); in the pair at the night before it is INVITED's (001800, the
		   smaller), made BEFORE his twin ANOTHER_INVITED (001900). */
		competitor(LAPSED_INVITED, false, false);
		competitor(INVITED_WHO_GOT_A_TEAM, true, false);
		competitor(INVITED, true, false);
		competitor(ANOTHER_INVITED, true, false);
		competitor(INVITED_BY_ANOTHER_TEAM, true, false);

		team(A_FIRST_TEAM, "Prvi tim");
		team(THE_TEAM, "Sava Runners");
		team(THE_OTHER_TEAM, "Timočki tim");
		team(A_THIRD_TEAM, "Dunavski trkači");
		team(AN_EMPTY_TEAM, "Pusti tim");

		inATeam(FIRST_WRITTEN, A_FIRST_TEAM, A_SEASON_ALREADY_RUNNING);
		inATeam(LEADER, THE_TEAM, A_SEASON_ALREADY_RUNNING);
		inATeam(PLAIN, THE_TEAM, A_SEASON_STILL_TO_COME);
		inATeam(ANOTHER_PLAIN, THE_TEAM, A_SEASON_STILL_TO_COME + 1);
		inATeam(OUTSIDER, THE_OTHER_TEAM, A_SEASON_ALREADY_RUNNING);
		inATeam(THIRD, A_THIRD_TEAM, A_SEASON_ALREADY_RUNNING);

		/* THE THREE STATES OF „HAS HE A TEAM ALREADY", which is one axis with three values
		   and not a flag. Two of them hide a row and the third does not. */
		inATeam(GOT_A_TEAM_TODAY, A_THIRD_TEAM, A_SEASON_ALREADY_RUNNING);
		inATeam(JOINS_NEXT_SEASON, A_FIRST_TEAM, A_SEASON_STILL_TO_COME);
		wasInATeam(LEFT_A_TEAM_LONG_AGO, A_FIRST_TEAM, A_SEASON_ALREADY_RUNNING,
				A_SEASON_ALREADY_RUNNING);
		inATeam(INVITED_WHO_GOT_A_TEAM, A_THIRD_TEAM, A_SEASON_ALREADY_RUNNING);

		account("prvi@primer.rs", FIRST_WRITTEN);
		account("vodja@primer.rs", LEADER);
		account("clan@primer.rs", PLAIN);
		account("treci-clan@primer.rs", ANOTHER_PLAIN);
		account("sa-strane@primer.rs", OUTSIDER);
		account("treci@primer.rs", THIRD);
		account("bez-veze@primer.rs", UNRELATED);
		account("molilac@primer.rs", APPLICANT);
		moderator(MODERATOR_OVER_THE_TEAMS, true);
		moderator(MODERATOR_WITH_NO_RIGHT, false);

		/* EVERY ROW CARRIES A WRITTEN DAY AND NONE OF THEM IS TODAY.

		   AND THEY ARE WRITTEN IN THE REVERSE OF THE ORDER THE FIRST LIST IS EXPECTED IN (ADL
		   A52, 14.09.2026): the list reads oldest first, so the pair at 08:00 UTC is written before
		   the pair at the night before. Inside a pair the order cannot be reversed by writing - a
		   key follows the writing - so it is decided by who gets the lower key, and in the pair
		   whose lower key is on the larger number that row is written again after everything else:
		   in PostgreSQL an update puts the new version of a row at the END of the table, so a scan
		   with no order, or with the key dropped, puts it behind its twin, which is not where the
		   key puts it. The class note has what was measured, round by round. */
		applicationOf(HIDDEN_PROFILE, THE_TEAM, ONE_INSTANT_TWO_ROWS);
		applicationOf(APPLICANT, THE_TEAM, ONE_INSTANT_TWO_ROWS);
		applicationOf(ANOTHER_APPLICANT, THE_TEAM, THE_NIGHT_BEFORE);
		applicationOf(LEFT_A_TEAM_LONG_AGO, THE_TEAM, THE_NIGHT_BEFORE);
		applicationOf(JOINS_NEXT_SEASON, THE_TEAM, Instant.parse("2027-10-07T08:00:00Z"));
		applicationOf(GOT_A_TEAM_TODAY, THE_TEAM, Instant.parse("2027-10-06T08:00:00Z"));
		applicationOf(LAPSED_APPLICANT, THE_TEAM, Instant.parse("2027-10-03T08:00:00Z"));
		writtenAgain("team_application", "asked_at", HIDDEN_PROFILE, THE_TEAM);

		/* AND QUESTIONS OF THE IDENTICAL SHAPE ON TWO OTHER TEAMS. */
		applicationOf(APPLIED_ELSEWHERE, THE_OTHER_TEAM, Instant.parse("2027-10-04T08:00:00Z"));
		applicationOf(UNRELATED, A_THIRD_TEAM, Instant.parse("2027-10-04T09:00:00Z"));

		/* THE SECOND LIST THE SAME WAY, AND WITH TWO PAIRS THAT SHARE AN INSTANT OF ITS OWN: until
		   02.10.2026 no two invitations did, so how a tie between them is settled was held by
		   nothing - the key could be turned round or dropped and every case stayed green. */
		invitationTo(INVITED_WHO_GOT_A_TEAM, THE_TEAM, ONE_INSTANT_TWO_INVITATIONS);
		invitationTo(LAPSED_INVITED, THE_TEAM, ONE_INSTANT_TWO_INVITATIONS);
		invitationTo(INVITED, THE_TEAM, THE_NIGHT_BEFORE);
		invitationTo(ANOTHER_INVITED, THE_TEAM, THE_NIGHT_BEFORE);
		writtenAgain("team_invitation", "sent_at", INVITED_WHO_GOT_A_TEAM, THE_TEAM);

		invitationTo(INVITED_BY_ANOTHER_TEAM, THE_OTHER_TEAM, Instant.parse("2027-10-05T09:00:00Z"));
		invitationTo(UNRELATED, A_THIRD_TEAM, Instant.parse("2027-10-05T10:00:00Z"));
	}

	/* ------------------------------------------------------------------- what is listed */

	/**
	 * THE ORDINARY READING OF THE FIRST LIST, and it is the whole answer rather than a
	 * contains.
	 *
	 * <p>Four rows and not seven: three of the seven applications standing on this team are
	 * withheld, each for its own reason and each measured on its own below. The order is
	 * oldest first with the key last, and the two PAIRS of rows sharing one instant prove the
	 * second half - one pair with its lower key on the larger member number and one on the
	 * smaller, which is the only way to tell the key from a second column in both directions
	 * (the class note has the measurement).
	 */
	@Test
	void whoeverLeadsTheTeamReadsEveryApplicationAddressedToItOldestFirst() throws Exception {
		assertThat(applicationsOf(THE_TEAM, LEADER))
				.containsExactly(
						ANOTHER_APPLICANT + " on " + THE_MORNING_AFTER,
						LEFT_A_TEAM_LONG_AGO + " on " + THE_MORNING_AFTER,
						HIDDEN_PROFILE + " on " + THAT_DAY,
						APPLICANT + " on " + THAT_DAY);
	}

	/**
	 * AND THE SECOND LIST, WHICH WITHHOLDS NOBODY'S ROW.
	 *
	 * <p>The only thing missing from any record here is a NAME, and it is missing from
	 * exactly one. The order is oldest first with the key last, in two pairs that share an
	 * instant and are built to opposite polarity, like the first list's.
	 */
	@Test
	void whoeverLeadsTheTeamReadsEveryInvitationItSentOldestFirst() throws Exception {
		assertThat(invitationsOf(THE_TEAM, LEADER))
				.containsExactly(
						INVITED + " on " + THE_MORNING_AFTER,
						ANOTHER_INVITED + " on " + THE_MORNING_AFTER,
						INVITED_WHO_GOT_A_TEAM + " on " + THAT_OTHER_DAY,
						"null on " + THAT_OTHER_DAY);
	}

	/**
	 * THE ROW IS THE TEAM'S OWN AND NOT EVERY TEAM'S, ON BOTH PATHS.
	 *
	 * <p>The member each of these names applied to, or was asked by, ANOTHER team; read
	 * without the team from the path, both lists would carry him.
	 */
	@Test
	void anotherTeamsQueueIsNotThisTeamsOnEitherPath() throws Exception {
		assertThat(applicationsOf(THE_TEAM, LEADER))
				.noneMatch(one -> one.startsWith(APPLIED_ELSEWHERE));
		assertThat(invitationsOf(THE_TEAM, LEADER))
				.noneMatch(one -> one.startsWith(INVITED_BY_ANOTHER_TEAM));

		/* AND THE SAME ROWS REALLY ARE SOMEWHERE, so „missing" is telling one team from
		   another and not telling a row that exists from one that does not. */
		assertThat(applicationsOf(THE_OTHER_TEAM, OUTSIDER))
				.containsExactly(APPLIED_ELSEWHERE + " on 2027-10-04");
		assertThat(invitationsOf(THE_OTHER_TEAM, OUTSIDER))
				.containsExactly(INVITED_BY_ANOTHER_TEAM + " on 2027-10-05");
	}

	/** Neither list answers with the other's rows, which one shared helper would. */
	@Test
	void theTwoListsDoNotCrossOver() throws Exception {
		assertThat(applicationsOf(THE_TEAM, LEADER))
				.noneMatch(one -> one.startsWith(INVITED) || one.startsWith(ANOTHER_INVITED));
		assertThat(invitationsOf(THE_TEAM, LEADER))
				.noneMatch(one -> one.startsWith(APPLICANT) || one.startsWith(ANOTHER_APPLICANT));
	}

	/* ------------------------------------------------------ the three states of „has a team" */

	/**
	 * PDL, 06.09.2026: „Prijava člana koji je u međuvremenu dobio tim se timu ne prikazuje."
	 *
	 * <p><b>BOTH states of the rule, and the state that is NOT it.</b> A membership already
	 * running and one that has not begun both hide the row; one that ENDED before the season
	 * an acceptance would write does not. Written as „has he any membership row", the third
	 * man would vanish too and the case above would still pass.
	 */
	@ParameterizedTest
	@CsvSource({
			GOT_A_TEAM_TODAY + ",false",
			JOINS_NEXT_SEASON + ",false",
			LEFT_A_TEAM_LONG_AGO + ",true"})
	void anApplicantIsHiddenExactlyWhenATeamHeHasStandsInTheWay(String who, boolean listed)
			throws Exception {

		assertThat(applicationsOf(THE_TEAM, LEADER).stream().anyMatch(one -> one.startsWith(who)))
				.as("%s was %slisted", who, listed ? "not " : "")
				.isEqualTo(listed);
	}

	/**
	 * AND THE ROW IS STILL HIS TO WITHDRAW, which is the other half of the same decision:
	 * „[IZVEDENO] Prijava u oba slučaja ostaje njegova da je povuče, pa i dalje ima kraj koji
	 * ne zavisi ni od koga drugog."
	 *
	 * <p>Read here rather than taken on trust, because „hidden" and „gone" are the two things
	 * this decision is between: the row {@link #THE_TEAM} is not shown is still in the table
	 * and still names him.
	 */
	@Test
	void theRowTheTeamIsNotShownIsStillStandingForTheApplicant() {
		assertThat(db.sql("select count(*) from team_application a"
						+ " join competitor c on c.id = a.competitor_id"
						+ " where c.member_number in (?, ?)")
				.params(GOT_A_TEAM_TODAY, JOINS_NEXT_SEASON)
				.query(Long.class).single())
				.as("the team not seeing the row was carried out by deleting it")
				.isEqualTo(2);
	}

	/**
	 * AN INVITATION TO SOMEBODY WHO HAS SINCE JOINED A TEAM IS LISTED, and this is the axis
	 * on which the two lists genuinely differ.
	 *
	 * <p>Measured against the write route in the same case rather than asserted: the same
	 * team is still refused a second invitation to the same man, so a list that dropped the
	 * row would be showing an empty place in front of a door that is shut.
	 */
	@Test
	void anInvitationToSomebodyWhoHasSinceJoinedATeamIsStillTheTeamsToSee() throws Exception {
		assertThat(invitationsOf(THE_TEAM, LEADER))
				.anyMatch(one -> one.startsWith(INVITED_WHO_GOT_A_TEAM));

		assertThat(db.sql("select count(*) from team_invitation i"
						+ " join competitor c on c.id = i.competitor_id"
						+ " join team t on t.id = i.team_id"
						+ " where c.member_number = ? and t.slug = ?")
				.params(INVITED_WHO_GOT_A_TEAM, THE_TEAM)
				.query(Long.class).single())
				.as("the row that refuses a second invitation is not there, so this case measures"
						+ " nothing about why the first one is listed")
				.isEqualTo(1);
	}

	/* ------------------------------------------------------------------------- the fee */

	/**
	 * A LAPSED APPLICANT IS NOT LISTED, AND THE REASON IS THE WRITE ROUTE.
	 *
	 * <p>{@code applicationHeMayDecide} carries {@code c.active}, so the team cannot answer
	 * him either way; listed, the screen would offer a button the server refuses. The row is
	 * still in the table, so „not listed" is again told from „not there".
	 */
	@Test
	void anApplicantWhoseFeeHasLapsedIsNotListedAndHisRowIsStillThere() throws Exception {
		assertThat(applicationsOf(THE_TEAM, LEADER))
				.noneMatch(one -> one.startsWith(LAPSED_APPLICANT));

		assertThat(db.sql("select count(*) from team_application a"
						+ " join competitor c on c.id = a.competitor_id"
						+ " where c.member_number = ?")
				.param(LAPSED_APPLICANT)
				.query(Long.class).single())
				.isEqualTo(1);
	}

	/**
	 * A LAPSED INVITEE KEEPS HIS ROW AND LOSES HIS NAME, WHICH IS TWO ASSERTIONS BECAUSE IT
	 * IS TWO MISTAKES.
	 *
	 * <p>Dropping the row would show the team an empty place in front of a shut door;
	 * carrying the number would name a member whose fee has lapsed, which PDL forbids „NI
	 * POSREDNO" (13.09.2026) - {@code /api/competitors} stops carrying him the same day, and a
	 * number that is here and missing there is itself the answer.
	 */
	@Test
	void aLapsedInviteeIsStillARowAndIsNoLongerANumber() throws Exception {
		JsonNode listed = answer(get("/api/teams/{id}/invitations", keyOf(THE_TEAM)), LEADER);

		JsonNode his = one(listed, invitationOf(LAPSED_INVITED, THE_TEAM));

		assertThat(his.isMissingNode())
				.as("the whole row went, so the team would ask him again and be refused")
				.isFalse();
		assertThat(his.path("memberNumber").isNull())
				.as("a member whose fee has lapsed was named")
				.isTrue();
		assertThat(listed.toString())
				.as("his number reached the answer under some other name")
				.doesNotContain(LAPSED_INVITED);
	}

	/**
	 * AND A HIDDEN PROFILE IS NAMED, which is the opposite direction of the same axis.
	 *
	 * <p>{@code profile_hidden} hides a member from everybody who is neither an active member nor
	 * the administration (PDL P23, 03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan član
	 * ni administracija"), and every caller here is one of the two: whoever leads a team is a member
	 * whose fee is standing, and the administration is the administration. Read as „hidden from
	 * everybody", a team would never learn who applied to it.
	 */
	@Test
	void aHiddenProfileIsNamedToTheTeamHeAppliedTo() throws Exception {
		assertThat(applicationsOf(THE_TEAM, LEADER))
				.anyMatch(one -> one.startsWith(HIDDEN_PROFILE));

		assertThat(db.sql("select profile_hidden from competitor where member_number = ?")
				.param(HIDDEN_PROFILE).query(Boolean.class).single())
				.as("his profile is not hidden after all, so this case measures nothing")
				.isTrue();
	}

	/* ---------------------------------------------------------------------- who may read */

	/**
	 * FOUR READERS ARE REFUSED AND EVERY ONE OF THEM IS A DIFFERENT NEAR MISS.
	 *
	 * <p>A member who merely stands in the team, a SECOND such member so that „not the
	 * administrator" is not one row, a member who leads ANOTHER team, and a member with no
	 * team at all. Each is answered 404 and not 403: ADL A8, and the owner of 05.09.2026 -
	 * „adresa koju član ne sme da otvori nije strana sa objašnjenjem nego adresa koje za
	 * njega nema".
	 */
	@ParameterizedTest
	@ValueSource(strings = {PLAIN, ANOTHER_PLAIN, OUTSIDER, UNRELATED, APPLICANT})
	void nobodyButWhoeverLeadsTheTeamReadsItsQueue(String who) throws Exception {
		assertThat(ask(get("/api/teams/{id}/applications", keyOf(THE_TEAM)), who).getStatus())
				.isEqualTo(404);
		assertThat(ask(get("/api/teams/{id}/invitations", keyOf(THE_TEAM)), who).getStatus())
				.isEqualTo(404);
	}

	/**
	 * THE ADMINISTRATION READS IT, AND A MODERATOR WITHOUT THE RIGHT DOES NOT.
	 *
	 * <p>Both race for nobody, so the difference between them is the tick and nothing else -
	 * with one moderator only, „the administration" and „a moderator" would be one row and a
	 * route that let every moderator in would pass.
	 */
	@Test
	void theAdministrationReadsItAndAModeratorWithoutTheRightDoesNot() throws Exception {
		assertThat(applicationsOf(THE_TEAM, MODERATOR_OVER_THE_TEAMS))
				.isEqualTo(applicationsOf(THE_TEAM, LEADER));
		assertThat(invitationsOf(THE_TEAM, MODERATOR_OVER_THE_TEAMS))
				.isEqualTo(invitationsOf(THE_TEAM, LEADER));

		assertThat(ask(get("/api/teams/{id}/applications", keyOf(THE_TEAM)),
				MODERATOR_WITH_NO_RIGHT).getStatus()).isEqualTo(404);
		assertThat(ask(get("/api/teams/{id}/invitations", keyOf(THE_TEAM)),
				MODERATOR_WITH_NO_RIGHT).getStatus()).isEqualTo(404);
	}

	/**
	 * A TEAM THAT DOES NOT EXIST IS 404 AND NEVER AN EMPTY LIST - FOR THE ADMINISTRATION TOO.
	 *
	 * <p>Answered with {@code []}, „no such team" and „a team with nothing waiting" would be
	 * one answer, and the empty team below is exactly the row that tells them apart.
	 */
	@ParameterizedTest
	@ValueSource(strings = {LEADER, MODERATOR_OVER_THE_TEAMS})
	void ateamThatDoesNotExistIsNotAnEmptyQueue(String who) throws Exception {
		long noSuchTeam = db.sql("select max(id) + 1 from team").query(Long.class).single();

		assertThat(ask(get("/api/teams/{id}/applications", noSuchTeam), who).getStatus())
				.isEqualTo(404);
		assertThat(ask(get("/api/teams/{id}/invitations", noSuchTeam), who).getStatus())
				.isEqualTo(404);

		/* AND A TEAM THAT DOES EXIST WITH NOTHING WAITING IS 200 AND EMPTY, which is what
		   makes the two above a claim. */
		assertThat(ask(get("/api/teams/{id}/applications", keyOf(AN_EMPTY_TEAM)),
				MODERATOR_OVER_THE_TEAMS).getStatus()).isEqualTo(200);
		assertThat(applicationsOf(AN_EMPTY_TEAM, MODERATOR_OVER_THE_TEAMS)).isEmpty();
		assertThat(invitationsOf(AN_EMPTY_TEAM, MODERATOR_OVER_THE_TEAMS)).isEmpty();
	}

	/**
	 * NOBODY SIGNED IN READS EITHER LIST, AND THE NUMBER IS 401.
	 *
	 * <p>Neither path is on {@code READ_BY_ANYBODY}: that list holds whole addresses and
	 * opens {@code /api/teams} for reading, so no sub-path of it reaches {@code permitAll}.
	 */
	@Test
	void nobodySignedInReadsEitherList() throws Exception {
		assertThat(ask(get("/api/teams/{id}/applications", keyOf(THE_TEAM)), null).getStatus())
				.isEqualTo(401);
		assertThat(ask(get("/api/teams/{id}/invitations", keyOf(THE_TEAM)), null).getStatus())
				.isEqualTo(401);
	}

	/* ------------------------------------------------------------- what the record carries */

	/**
	 * THE KEY IN EVERY RECORD IS THE ROW'S OWN, and it is measured by USING it.
	 *
	 * <p>An index, a count or the applicant's own key would all come back as plausible
	 * numbers. What makes this a claim is that the id answered here is handed back to the
	 * route that decides the row, which then answers about the man this list named.
	 */
	@Test
	void theKeyAnsweredIsTheRowsOwnAndTheDecidingRouteAgreesWithIt() throws Exception {
		JsonNode said = one(answer(get("/api/teams/{id}/applications", keyOf(THE_TEAM)), LEADER),
				applicationOf(APPLICANT, THE_TEAM));

		assertThat(said.path("id").asLong()).isEqualTo(applicationOf(APPLICANT, THE_TEAM));

		MockHttpServletResponse decided = ask(
				put("/api/teams/{id}/applications/{application}", keyOf(THE_TEAM),
						said.path("id").asLong())
						.contentType(MediaType.APPLICATION_JSON).content("{\"accepted\":false}"),
				LEADER);

		assertThat(decided.getStatus())
				.as("the key this list answered is not one the team may act on")
				.isEqualTo(204);

		assertThat(applicationsOf(THE_TEAM, LEADER))
				.as("answering the row the list named removed a different row")
				.noneMatch(one -> one.startsWith(APPLICANT));
	}

	/**
	 * AND A ROW THAT HAS BEEN ANSWERED LEAVES THE LIST, because an answer is not a column.
	 *
	 * <p>V12 keeps no state on either table on purpose - accepting, refusing and withdrawing
	 * all DELETE the row - so „still waiting" is the row's existence and there is no third
	 * state to filter out. The case above already answered one; this one reads what the list
	 * says afterwards, which is one fewer and the same rest.
	 */
	@Test
	void anAnsweredApplicationIsAbsentRatherThanMarked() throws Exception {
		List<String> before = applicationsOf(THE_TEAM, LEADER);

		ask(put("/api/teams/{id}/applications/{application}", keyOf(THE_TEAM),
				applicationOf(ANOTHER_APPLICANT, THE_TEAM))
				.contentType(MediaType.APPLICATION_JSON).content("{\"accepted\":false}"), LEADER);

		assertThat(applicationsOf(THE_TEAM, LEADER))
				.isEqualTo(before.subList(1, before.size()));
	}

	/**
	 * NO FIELD OF EITHER LIST IS THE SAME IN EVERY RECORD OF IT.
	 *
	 * <p>The second floor every resource of this API stands on: a field the fixture never
	 * varies is a field a constant would answer, and the two read alike in every case above.
	 */
	@Test
	void noFieldOfEitherListIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/teams/{id}/applications",
				answer(get("/api/teams/{id}/applications", keyOf(THE_TEAM)), LEADER));
		Answers.noFieldIsTheSameInEveryRecord("/api/teams/{id}/invitations",
				answer(get("/api/teams/{id}/invitations", keyOf(THE_TEAM)), LEADER));
	}

	/**
	 * A RECORD CARRIES THREE FIELDS AND NAMES NOBODY'S INTERNAL KEY.
	 *
	 * <p>A member is answered by his number and by nothing else, the rule every resource in
	 * this package keeps; {@code competitor.id} is read inside this class to ask the rule of
	 * 06.09.2026 and must not leave with the answer.
	 */
	@Test
	void aRecordNamesAMemberByHisNumberAndNeverByHisKey() throws Exception {
		JsonNode applications = answer(get("/api/teams/{id}/applications", keyOf(THE_TEAM)), LEADER);
		JsonNode invitations = answer(get("/api/teams/{id}/invitations", keyOf(THE_TEAM)), LEADER);

		assertThat(Answers.fieldsOf(applications.get(0)))
				.containsExactlyInAnyOrder("id", "memberNumber", "date");
		assertThat(Answers.fieldsOf(invitations.get(0)))
				.containsExactlyInAnyOrder("id", "memberNumber", "date");

		List<String> applicants = List.of(ANOTHER_APPLICANT, LEFT_A_TEAM_LONG_AGO, HIDDEN_PROFILE,
				APPLICANT);
		List<String> invitees = List.of(INVITED, ANOTHER_INVITED, INVITED_WHO_GOT_A_TEAM,
				LAPSED_INVITED);

		noMemberKeyIsAValueOf(applications, applicants,
				applicants.stream().map(one -> applicationOf(one, THE_TEAM)).toList());
		noMemberKeyIsAValueOf(invitations, invitees,
				invitees.stream().map(one -> invitationOf(one, THE_TEAM)).toList());
	}

	/**
	 * NO VALUE OF THE ANSWER IS THE KEY OF A MEMBER IT NAMES - and the one place a number the same
	 * as such a key may stand, a record's own {@code id}, is asked of that record's own key instead.
	 *
	 * <p><b>This replaces a question about TEXT with one about VALUES, and loses nothing.</b> It used
	 * to ask whether the applicant's {@code competitor.id} appeared anywhere in the answer as
	 * characters, which is a question about every digit of every field: a key is a short number and
	 * a member number a longer one that can contain it, so whether a key collided depended on how
	 * many rows earlier cases had written, and it did on 02.10.2026, the moment the competitors were
	 * made in another order (key 150 inside member number 001500). Asked of values, that coincidence
	 * is gone and the intent is whole: the key of a member listed leaves in NO field of NO record.
	 *
	 * <p><b>The one exception is the one that cannot be a leak.</b> The application's own key and a
	 * competitor's key come from two different sequences and can be the same number, so asked of every
	 * value an {@code id} equal to somebody's competitor key would fail a correct answer on some
	 * future day. The {@code id} is therefore held to its own question - it is the key of THE ROW in
	 * the table, read for the same member and the same team, in the order the list gives them - and a
	 * competitor's key standing there instead is caught by that, unless it is by chance the same
	 * number, in which case nothing has leaked that could be told apart.
	 *
	 * <p>The mutations this holds against, none of which the field list alone sees: the member
	 * number replaced by the member's key, the {@code id} replaced by it, and, where a field
	 * is added, the field list as well.
	 *
	 * @param members the members the list names, in the order it names them
	 * @param ownKeys the key of each record in the table, in that same order
	 */
	private void noMemberKeyIsAValueOf(JsonNode list, List<String> members, List<Long> ownKeys) {
		List<String> theirKeys = members.stream().map(one -> String.valueOf(keyOfMember(one)))
				.toList();

		assertThat(list.valueStream().map(row -> row.path("id").asLong()).toList())
				.as("a record's id is not the key of that record's own row, so it is a number from"
						+ " somewhere else - a member's key among the candidates")
				.isEqualTo(ownKeys);

		list.valueStream().forEach(row -> Answers.fieldsOf(row).stream()
				.filter(name -> !"id".equals(name))
				.forEach(name -> assertThat(row.path(name).asString("null"))
						.as("the field %s of a record carries the key of a member it names", name)
						.isNotIn(theirKeys)));
	}

	/**
	 * THE DAY IS THE ROW'S OWN DAY IN BELGRADE, WHICH IS TWO CLAIMS IN ONE INSTANT.
	 *
	 * <p>It is not TODAY - no row in this fixture was written on the day the clock stands, so
	 * {@code current_date} answers four wrong days - and it is not the day the machine is in:
	 * half past eleven at night on 1 October in UTC is half past one on the morning of 2
	 * October in the league's own zone, and the clock this suite installs reports UTC on
	 * purpose.
	 */
	@Test
	void theDayIsTheRowsOwnReadInTheLeaguesZoneAndNeverTheDayItIsRead() throws Exception {
		assertThat(one(answer(get("/api/teams/{id}/applications", keyOf(THE_TEAM)), LEADER),
				applicationOf(ANOTHER_APPLICANT, THE_TEAM)).path("date").asString())
				.isEqualTo(THE_MORNING_AFTER);

		assertThat(one(answer(get("/api/teams/{id}/invitations", keyOf(THE_TEAM)), LEADER),
				invitationOf(ANOTHER_INVITED, THE_TEAM)).path("date").asString())
				.isEqualTo(THE_MORNING_AFTER);

		assertThat(THE_MORNING_AFTER)
				.as("the written instant already falls on this day in UTC, so the zone is not"
						+ " what this case measures")
				.isNotEqualTo(THE_NIGHT_BEFORE.toString().substring(0, 10));
	}

	/* ------------------------------------------------------------------------- helpers */

	private List<String> applicationsOf(String teamSlug, String as) throws Exception {
		return said(answer(get("/api/teams/{id}/applications", keyOf(teamSlug)), as));
	}

	private List<String> invitationsOf(String teamSlug, String as) throws Exception {
		return said(answer(get("/api/teams/{id}/invitations", keyOf(teamSlug)), as));
	}

	/** One line per record, in the order the answer holds them. */
	private static List<String> said(JsonNode answered) {
		return answered.valueStream()
				.map(one -> one.path("memberNumber").asString("null") + " on "
						+ one.path("date").asString())
				.toList();
	}

	private static JsonNode one(JsonNode answered, long id) {
		return answered.valueStream().filter(row -> row.path("id").asLong() == id)
				.findFirst()
				.orElse(tools.jackson.databind.node.MissingNode.getInstance());
	}

	private JsonNode answer(MockHttpServletRequestBuilder asking, String as) throws Exception {
		MockHttpServletResponse answered = ask(asking, as);

		assertThat(answered.getStatus())
				.as("this reader was refused, so nothing below measures what he was shown")
				.isEqualTo(200);

		return mapper.readTree(answered.getContentAsString());
	}

	private MockHttpServletResponse ask(MockHttpServletRequestBuilder asking, String as)
			throws Exception {

		MockHttpServletRequestBuilder with = asking.with(csrf());

		return http.perform(as == null ? with : with.cookie(cookieOf(as)))
				.andReturn().getResponse();
	}

	/**
	 * A session cookie, looked up by member number for a member and by address for a
	 * moderator who races for nobody.
	 */
	private Cookie cookieOf(String who) {
		String email = who.contains("@") ? who
				: db.sql("select a.email from account a join competitor c on c.id = a.competitor_id"
						+ " where c.member_number = ?").param(who).query(String.class).single();

		return new Cookie(SessionCookie.NAME, sessions.get(email).secret());
	}

	private long keyOf(String teamSlug) {
		return db.sql("select id from team where slug = ?").param(teamSlug)
				.query(Long.class).single();
	}

	private long keyOfMember(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	private long applicationOf(String memberNumber, String teamSlug) {
		return db.sql("select a.id from team_application a where a.competitor_id = " + who()
						+ " and a.team_id = " + which())
				.params(memberNumber, teamSlug)
				.query(Long.class).single();
	}

	private long invitationOf(String memberNumber, String teamSlug) {
		return db.sql("select i.id from team_invitation i where i.competitor_id = " + who()
						+ " and i.team_id = " + which())
				.params(memberNumber, teamSlug)
				.query(Long.class).single();
	}

	private void competitor(String number, boolean active, boolean hidden) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', ?, 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, '', ?, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, "Probić" + number, active, String.format("%016x", ++issued), hidden)
				.update();
	}

	private void team(String slug, String name) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id)"
						+ " values (?, ?, '', '', (select id from place where rank = 1), null, null,"
						+ " null, 2027, null)")
				.params(slug, name).update();
	}

	private void inATeam(String memberNumber, String teamSlug, int seasonFrom) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from)"
						+ " values (" + who() + ", " + which() + ", ?)")
				.params(memberNumber, teamSlug, seasonFrom)
				.update();
	}

	/** A membership he has already left, which is the third state of the „has a team" axis. */
	private void wasInATeam(String memberNumber, String teamSlug, int seasonFrom, int seasonTo) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to,"
						+ " left_reason) values (" + who() + ", " + which() + ", ?, ?, 'izašao iz tima')")
				.params(memberNumber, teamSlug, seasonFrom, seasonTo)
				.update();
	}

	private void applicationOf(String memberNumber, String teamSlug, Instant when) {
		db.sql("insert into team_application (competitor_id, team_id, season, asked_at)"
						+ " values (" + who() + ", " + which() + ", 2028, ?)")
				.params(memberNumber, teamSlug, Timestamp.from(when))
				.update();
	}

	/**
	 * A ROW WRITTEN AGAIN, UNCHANGED.
	 *
	 * <p>PostgreSQL does not skip an update that changes nothing: it writes a new version of the
	 * row and the new version stands behind every row that was already there. That is the whole
	 * point of this method (ADL A52): the key of the row does not move, its place on the disk
	 * does, so a read that asks for no order, or that drops the key, no longer agrees with it.
	 * It is NOT what tells the key from another column - member number, last name, competitor
	 * key - and the class note says what does.
	 */
	private void writtenAgain(String table, String column, String memberNumber, String teamSlug) {
		db.sql("update " + table + " set " + column + " = " + column
						+ " where competitor_id = " + who() + " and team_id = " + which())
				.params(memberNumber, teamSlug).update();
	}

	private void invitationTo(String memberNumber, String teamSlug, Instant when) {
		db.sql("insert into team_invitation (team_id, competitor_id, season, sent_at)"
						+ " values (" + which() + ", " + who() + ", 2028, ?)")
				.params(teamSlug, memberNumber, Timestamp.from(when))
				.update();
	}

	private static String who() {
		return "(select id from competitor where member_number = ?)";
	}

	private static String which() {
		return "(select id from team where slug = ?)";
	}

	private void account(String email, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probić', ?, (select id from role where code = 'competitor'),"
						+ " " + who() + ")")
				.params(email, memberNumber).update();

		openSession(email);
	}

	/**
	 * A moderator who races for nobody, with the right over the teams or without it.
	 *
	 * <p>The box is ticked with the word V5 writes and not with {@code TeamApi.OVER_THE_TEAMS},
	 * for the reason {@code TeamApiTest} gives beside its own tick: read through the constant,
	 * a constant that drifted would tick the drifted box and this moderator would be answered
	 * exactly the same either way.
	 */
	private void moderator(String email, boolean overTheTeams) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?, (select id from role where code = 'moderator'))")
				.param(email).update();

		if (overTheTeams) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), 'entity:teams')")
					.param(email).update();
		}

		openSession(email);
	}

	private void openSession(String email) {
		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}
}
