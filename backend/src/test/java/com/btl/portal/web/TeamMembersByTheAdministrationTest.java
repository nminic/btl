package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.team.Membership;
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
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * THE ADMINISTRATION ADDING A MEMBER TO A TEAM AND TAKING ONE OUT, END TO END.
 *
 * <p>PDL P13, „[ODLUKA 23.11.2026 ...] Administracija dodaje i izbacuje članove tima direktno”: „Važe ista
 * pravila kao inače (plaćena članarina, jedan tim u isto vreme, prelazni rok), a član dobija poruku na
 * portalu.” Every case asks the DATABASE - the memberships, the seat, the teams and the inbox - and never
 * only the status.
 *
 * <p><b>THE AXES, each with both of its states in the cases below:</b>
 *
 * <ul>
 * <li>the season he would join paid ({@link #FREE}) or not ({@link #FREE_BUT_UNPAID});
 * <li>in no team ({@link #FREE}), in another ({@link #ELSEWHERE}), or already in this one
 * ({@link #THE_LEADER});
 * <li>inside the transfer window or outside it, for both routes;
 * <li>the one taken out sits in the seat ({@link #THE_LEADER}) or does not ({@link #BEGUN});
 * <li>the one taken out is the last of his team ({@link #ALONE}, in {@link #FIRST_TEAM}) or is not;
 * <li>a membership that has begun ({@link #BEGUN}, from the season being run) or one that has not
 * ({@link #AHEAD}, from the next);
 * <li>the message reaches the member and nobody else: not the caller - one of the administrations
 * below is a moderator who is himself a member ({@link #THE_RACING_MODERATOR}) - not the whole league
 * ({@code to_id} empty) and not a third member;
 * <li>the team the address names is neither the first nor the last key, so a statement that lost its
 * condition writes into the wrong team where it can be seen.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TeamMembersByTheAdministrationTest {

	/** 12:00 in Belgrade on 15 June 2027: the transfer window is shut. */
	private static final Instant OUTSIDE_THE_WINDOW = Instant.parse("2027-06-15T10:00:00Z");

	/** 11:00 in Belgrade on 30 November 2027: the window is open, 2027 is being run, 2028 is next. */
	private static final Instant INSIDE_THE_WINDOW = Instant.parse("2027-11-30T10:00:00Z");

	private static final int THE_SEASON_BEING_RUN = 2027;

	private static final int THE_NEXT_SEASON = 2028;

	/** Written first, and {@link #ALONE} is all there is of it. */
	private static final String FIRST_TEAM = "prvi-tim";

	/** The team the cases add to and take out of, written second. */
	private static final String THE_TEAM = "dunavski-trkaci";

	private static final String THE_TEAMS_NAME = "Dunavski trkači";

	/** Written third: {@link #ELSEWHERE} runs it, and it has invited {@link #FREE}. */
	private static final String ANOTHER_TEAM = "savski-trkaci";

	/** Written last, with nobody in it. */
	private static final String AN_EMPTY_TEAM = "prazan-tim";

	/** Sits in the seat of {@link #THE_TEAM}, in it since the season being run. */
	private static final String THE_LEADER = "000210";

	/** In {@link #THE_TEAM} since the season being run, and sits in nothing. */
	private static final String BEGUN = "000220";

	/** In {@link #THE_TEAM} from the next season, which nobody has run yet. */
	private static final String AHEAD = "000230";

	/** In {@link #THE_TEAM} on the record, and his fee has lapsed. */
	private static final String LAPSED = "000235";

	/** Runs {@link #ANOTHER_TEAM}, and holds the next season. */
	private static final String ELSEWHERE = "000240";

	/** In no team, holds the next season, and {@link #ANOTHER_TEAM} has invited him. */
	private static final String FREE = "000250";

	/** In no team, and does not hold the next season. */
	private static final String FREE_BUT_UNPAID = "000260";

	/** The one member of {@link #FIRST_TEAM}, from the next season. */
	private static final String ALONE = "000270";

	/** A moderator with the right over the teams whose account is a member, in no team. */
	private static final String THE_RACING_MODERATORS_NUMBER = "000290";

	private static final String NOBODY_HAS_IT = "999999";

	private static final String MODERATOR_OVER_TEAMS = "timovi@primer.rs";

	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	private static final String THE_RACING_MODERATOR = "trkac-moderator@primer.rs";

	private static final String MODERATOR_OVER_THE_QUEUE = "red-timova@primer.rs";

	private static final String THE_TEAMS_OWN_ADMINISTRATOR = "vodja@primer.rs";

	private static final String A_PLAIN_MEMBER = "clan@primer.rs";

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

	private long theTeamsKey;

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
			return new AClockTheCaseMoves(INSIDE_THE_WINDOW);
		}
	}

	@BeforeEach
	void fourTeamsAndEveryoneWhoMightBeMoved() {
		clock.moveTo(INSIDE_THE_WINDOW);

		team(FIRST_TEAM, "Prvi tim");
		team(THE_TEAM, THE_TEAMS_NAME);
		team(ANOTHER_TEAM, "Savski trkači");
		team(AN_EMPTY_TEAM, "Prazan tim");

		theTeamsKey = teamKey(THE_TEAM);

		competitor(THE_LEADER, "Vesna", "Vodić", "F");
		competitor(BEGUN, "Bojan", "Begović", "M");
		competitor(AHEAD, "Ana", "Unapred", "F");
		competitor(LAPSED, "Luka", "Istekli", "M");
		competitor(ELSEWHERE, "Sava", "Savić", "M");
		competitor(FREE, "Filip", "Slobodni", "M");
		competitor(FREE_BUT_UNPAID, "Nina", "Neplatila", "F");
		competitor(ALONE, "Sam", "Samić", "M");
		competitor(THE_RACING_MODERATORS_NUMBER, "Mira", "Moderatorka", "F");

		db.sql("delete from membership where competitor_id = ?").param(competitorId(LAPSED)).update();

		for (String number : List.of(THE_LEADER, ELSEWHERE, FREE)) {
			HeldOn.season(db, competitorId(number), THE_NEXT_SEASON, "payment");
		}

		inATeam(THE_LEADER, THE_TEAM, THE_SEASON_BEING_RUN);
		inATeam(BEGUN, THE_TEAM, THE_SEASON_BEING_RUN);
		inATeam(AHEAD, THE_TEAM, THE_NEXT_SEASON);
		inATeam(LAPSED, THE_TEAM, THE_SEASON_BEING_RUN);
		inATeam(ELSEWHERE, ANOTHER_TEAM, THE_SEASON_BEING_RUN);
		inATeam(ALONE, FIRST_TEAM, THE_NEXT_SEASON);

		db.sql("update team set admin_id = ? where slug = ?").params(competitorId(THE_LEADER), THE_TEAM).update();

		db.sql("insert into team_invitation (team_id, competitor_id, season) values (?, ?, ?)")
				.params(teamKey(ANOTHER_TEAM), competitorId(FREE), THE_NEXT_SEASON).update();

		moderator(MODERATOR_OVER_TEAMS, null);
		ticked(MODERATOR_OVER_TEAMS, TeamApi.OVER_THE_TEAMS);

		moderator(THE_RACING_MODERATOR, THE_RACING_MODERATORS_NUMBER);
		ticked(THE_RACING_MODERATOR, TeamApi.OVER_THE_TEAMS);

		moderator(MODERATOR_OVER_THE_QUEUE, null);
		ticked(MODERATOR_OVER_THE_QUEUE, "queue:teams");

		superadmin(THE_SUPERADMIN);

		member(THE_TEAMS_OWN_ADMINISTRATOR, THE_LEADER);
		member(A_PLAIN_MEMBER, BEGUN);
	}

	@Test
	void theFixtureSeparatesTheAxesItSaysItSeparates() {
		assertThat(theTeamsKey)
				.isNotEqualTo(db.sql("select min(id) from team").query(Long.class).single())
				.isNotEqualTo(db.sql("select max(id) from team").query(Long.class).single());

		ZonedDateTime now = INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE);

		assertThat(List.of(SeasonClock.transferWindowOpen(now),
				SeasonClock.transferWindowOpen(OUTSIDE_THE_WINDOW.atZone(SeasonClock.ZONE)),
				SeasonClock.seasonBeingRun(now), SeasonClock.transfersTakeEffect(now)))
				.isEqualTo(List.of(true, false, THE_SEASON_BEING_RUN, THE_NEXT_SEASON));

		assertThat(db.sql("with standing as (" + TeamApi.whoStandsInATeam(now) + ")"
						+ " select s.member_number from standing s where s.team_id = ? order by s.member_number")
				.param(theTeamsKey).query(String.class).list())
				.as("who stands in the team: the lapsed member must not, the three others must")
				.containsExactly(THE_LEADER, BEGUN, AHEAD);

		assertThat(theMessages()).as("somebody's inbox is not empty before any case").isEmpty();
	}

	/*
	 * „DODAJ ČLANA”.
	 */

	@ParameterizedTest
	@ValueSource(strings = {MODERATOR_OVER_TEAMS, THE_SUPERADMIN, THE_RACING_MODERATOR})
	void theAdministrationAddsAFreeMemberWhoHoldsTheSeasonAndOnlyHeIsTold(String who) throws Exception {
		MockHttpServletResponse answer = add(who, theTeamsKey, "  " + FREE + "  ");

		assertThat(answer.getStatus()).as("%s could not add a member", who).isEqualTo(204);
		assertThat(membershipsOf(FREE))
				.as("he is not in the team from the season a change of team takes effect in")
				.containsExactly(THE_TEAM + " " + THE_NEXT_SEASON + " null null");

		assertThat(theMessages())
				.as("he is not the one told, or the team that had invited him is not told, or somebody"
						+ " else - the caller, the whole league, a third member - is")
				.containsExactlyInAnyOrder(
						FREE + "|Administracija|Administracija te je dodala u tim \"Dunavski trkači\"|"
								+ "Administracija BTL-a te je dodala u tim \"Dunavski trkači\". Za ovaj tim"
								+ " trčiš od sezone 2028. Tim vodi Vesna Vodić.",
						ELSEWHERE + "|" + PairWriteApi.THE_LEAGUE + "|"
								+ TeamJoiningWriteApi.THE_INVITATION_WAS_MISSED + "|"
								+ "Filip Slobodni je u međuvremenu ušao u tim \"Dunavski trkači\".");
	}

	/** A team with nobody else in it is led by him, so the sentence about who leads it is not written. */
	@Test
	void aMemberAddedToATeamNobodyElseLeadsIsNotToldHeLeadsIt() throws Exception {
		assertThat(add(MODERATOR_OVER_TEAMS, teamKey(AN_EMPTY_TEAM), FREE).getStatus()).isEqualTo(204);

		assertThat(theMessages()).filteredOn(one -> one.startsWith(FREE + "|"))
				.containsExactly(FREE + "|Administracija|Administracija te je dodala u tim \"Prazan tim\"|"
						+ "Administracija BTL-a te je dodala u tim \"Prazan tim\". Za ovaj tim trčiš od sezone"
						+ " 2028.");
	}

	@ParameterizedTest
	@CsvSource({
			ELSEWHERE + ", heIsAlreadyInATeam",
			THE_LEADER + ", heIsAlreadyInATeam",
			AHEAD + ", heIsAlreadyInATeam",
			FREE_BUT_UNPAID + ", theSeasonIsNotPaid",
			NOBODY_HAS_IT + ", theMemberIsNotKnown"})
	void aMemberTheRulesDoNotLetInIsRefusedAndNothingIsWritten(String number, String reason) throws Exception {
		List<String> before = everyMembership();

		MockHttpServletResponse answer = add(MODERATOR_OVER_TEAMS, theTeamsKey, number);

		assertThat(List.of(answer.getStatus(), reasonIn(answer))).isEqualTo(List.of(409, reason));
		assertThat(everyMembership()).isEqualTo(before);
		assertThat(theMessages()).isEmpty();
	}

	@ParameterizedTest
	@ValueSource(strings = {"", "   "})
	void aBoxLeftEmptyIsAFormNotFilledIn(String number) throws Exception {
		MockHttpServletResponse answer = add(MODERATOR_OVER_TEAMS, theTeamsKey, number);

		assertThat(List.of(answer.getStatus(), reasonIn(answer))).isEqualTo(List.of(400, "theFormIsNotComplete"));
	}

	@Test
	void outsideTheWindowNobodyIsAddedAndTheWindowIsSaid() throws Exception {
		clock.moveTo(OUTSIDE_THE_WINDOW);
		List<String> before = everyMembership();

		MockHttpServletResponse answer = add(MODERATOR_OVER_TEAMS, theTeamsKey, FREE);

		assertThat(List.of(answer.getStatus(), reasonIn(answer))).isEqualTo(List.of(409, "theWindowIsShut"));
		assertThat(everyMembership()).isEqualTo(before);
		assertThat(theMessages()).isEmpty();
	}

	@Test
	void aTeamThatIsNotThereIsNotFound() throws Exception {
		assertThat(add(MODERATOR_OVER_TEAMS, 9_999_999L, FREE).getStatus()).isEqualTo(404);
		assertThat(remove(MODERATOR_OVER_TEAMS, 9_999_999L, BEGUN).getStatus()).isEqualTo(404);
	}

	/*
	 * „IZBACI”.
	 */

	@ParameterizedTest
	@ValueSource(strings = {MODERATOR_OVER_TEAMS, THE_SUPERADMIN, THE_RACING_MODERATOR})
	void aMembershipThatHasBegunIsEndedWithTheSeasonBeingRunAndOnlyHeIsTold(String who) throws Exception {
		assertThat(remove(who, theTeamsKey, BEGUN).getStatus()).as("%s could not take a member out", who)
				.isEqualTo(204);

		assertThat(membershipsOf(BEGUN))
				.containsExactly(THE_TEAM + " " + THE_SEASON_BEING_RUN + " " + THE_SEASON_BEING_RUN + " "
						+ Membership.TAKEN_OUT_BY_THE_ADMINISTRATION);
		assertThat(theMessages()).containsExactly(BEGUN + "|Administracija|Izlazak iz tima \"Dunavski trkači\"|"
				+ "Administracija BTL-a te je izvela iz tima \"Dunavski trkači\". Od sezone 2028 više ne trčiš"
				+ " za ovaj tim.");
		assertThat(seatOf(THE_TEAM)).as("taking out somebody else emptied the seat").isEqualTo(competitorId(THE_LEADER));
	}

	@Test
	void aMembershipThatHasNotBegunIsRemoved() throws Exception {
		assertThat(remove(MODERATOR_OVER_TEAMS, theTeamsKey, AHEAD).getStatus()).isEqualTo(204);

		assertThat(membershipsOf(AHEAD)).isEmpty();
		assertThat(theMessages()).extracting(one -> one.substring(0, 6)).containsExactly(AHEAD);
	}

	@Test
	void theOneInTheSeatLeavesItEmptyAndTheTeamStands() throws Exception {
		assertThat(remove(MODERATOR_OVER_TEAMS, theTeamsKey, THE_LEADER).getStatus()).isEqualTo(204);

		assertThat(seatOf(THE_TEAM)).isNull();
		assertThat(membershipsOf(BEGUN)).containsExactly(THE_TEAM + " " + THE_SEASON_BEING_RUN + " null null");
	}

	@Test
	void theLastOfATeamTakesTheTeamWithHimAndIsStillTold() throws Exception {
		assertThat(remove(MODERATOR_OVER_TEAMS, teamKey(FIRST_TEAM), ALONE).getStatus()).isEqualTo(204);

		assertThat(db.sql("select slug from team order by id").query(String.class).list())
				.containsExactly(THE_TEAM, ANOTHER_TEAM, AN_EMPTY_TEAM);
		assertThat(theMessages()).containsExactly(ALONE + "|Administracija|Izlazak iz tima \"Prvi tim\"|"
				+ "Administracija BTL-a te je izvela iz tima \"Prvi tim\". Od sezone 2028 više ne trčiš za ovaj tim.");
	}

	/** His fee is not asked: it is a question about who may press „Izađi iz tima”, not about the team. */
	@Test
	void aMemberWhoseFeeHasLapsedIsTakenOutAsWell() throws Exception {
		assertThat(remove(MODERATOR_OVER_TEAMS, theTeamsKey, LAPSED).getStatus()).isEqualTo(204);

		assertThat(membershipsOf(LAPSED)).containsExactly(THE_TEAM + " " + THE_SEASON_BEING_RUN + " "
				+ THE_SEASON_BEING_RUN + " " + Membership.TAKEN_OUT_BY_THE_ADMINISTRATION);
	}

	@ParameterizedTest
	@ValueSource(strings = {ELSEWHERE, FREE, NOBODY_HAS_IT})
	void somebodyWhoIsNotInThisTeamIsNotTakenOutOfAnything(String number) throws Exception {
		List<String> before = everyMembership();

		MockHttpServletResponse answer = remove(MODERATOR_OVER_TEAMS, theTeamsKey, number);

		assertThat(List.of(answer.getStatus(), reasonIn(answer))).isEqualTo(List.of(409, "heIsNotInTheTeam"));
		assertThat(everyMembership()).isEqualTo(before);
		assertThat(theMessages()).isEmpty();
	}

	@Test
	void outsideTheWindowNobodyIsTakenOutAndTheWindowIsSaid() throws Exception {
		clock.moveTo(OUTSIDE_THE_WINDOW);
		List<String> before = everyMembership();

		MockHttpServletResponse answer = remove(MODERATOR_OVER_TEAMS, theTeamsKey, BEGUN);

		assertThat(List.of(answer.getStatus(), reasonIn(answer))).isEqualTo(List.of(409, "theWindowIsShut"));
		assertThat(everyMembership()).isEqualTo(before);
		assertThat(theMessages()).isEmpty();
	}

	/*
	 * THE DOOR, for both routes: the moderator of the very queue where teams are proposed, the team's own
	 * administrator - for whom the decision of 05.09.2026 still stands - and a plain member of the team.
	 */

	@ParameterizedTest
	@ValueSource(strings = {MODERATOR_OVER_THE_QUEUE, THE_TEAMS_OWN_ADMINISTRATOR, A_PLAIN_MEMBER})
	void nobodyButTheAdministrationGetsPastTheDoor(String who) throws Exception {
		List<String> before = everyMembership();

		assertThat(List.of(add(who, theTeamsKey, FREE).getStatus(), remove(who, theTeamsKey, AHEAD).getStatus()))
				.as("%s moved a member", who)
				.isEqualTo(List.of(404, 404));
		assertThat(everyMembership()).isEqualTo(before);
		assertThat(theMessages()).isEmpty();
	}

	@Test
	void somebodyWhoIsNotSignedInIsAskedToSignIn() throws Exception {
		assertThat(List.of(add(null, theTeamsKey, FREE).getStatus(), remove(null, theTeamsKey, AHEAD).getStatus()))
				.isEqualTo(List.of(401, 401));
	}

	/* WHAT THE CASES SEND AND READ. */

	private MockHttpServletResponse add(String email, long team, String number) throws Exception {
		return send(post("/api/teams/" + team + "/members").contentType(MediaType.APPLICATION_JSON)
				.content(mapper.writeValueAsString(Map.of("memberNumber", number))), email);
	}

	private MockHttpServletResponse remove(String email, long team, String number) throws Exception {
		return send(delete("/api/teams/" + team + "/members/" + number), email);
	}

	private MockHttpServletResponse send(MockHttpServletRequestBuilder asking, String email) throws Exception {
		asking.with(csrf());

		return http.perform(email == null ? asking
						: asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse();
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	/** Every message there is, as „whom|from|subject|body”, whom being the member's number or „league”. */
	private List<String> theMessages() {
		return db.sql("select coalesce(c.member_number, 'league') || '|' || m.from_name || '|' || m.subject"
						+ " || '|' || m.body from message m left join competitor c on c.id = m.to_id order by m.id")
				.query(String.class).list();
	}

	/** One member's memberships: the team, the seasons and the reason he left, if he did. */
	private List<String> membershipsOf(String number) {
		return db.sql("select t.slug || ' ' || m.season_from || ' ' || coalesce(m.season_to::text, 'null')"
						+ " || ' ' || coalesce(m.left_reason, 'null') from team_membership m"
						+ " join team t on t.id = m.team_id where m.competitor_id = ? order by m.id")
				.param(competitorId(number)).query(String.class).list();
	}

	private List<String> everyMembership() {
		return db.sql("select m.competitor_id || ' ' || m.team_id || ' ' || m.season_from || ' '"
						+ " || coalesce(m.season_to::text, 'null') from team_membership m order by m.id")
				.query(String.class).list();
	}

	private Long seatOf(String slug) {
		return db.sql("select admin_id from team where slug = ?").param(slug)
				.query((row, one) -> row.getObject(1, Long.class)).list().get(0);
	}

	private long teamKey(String slug) {
		return db.sql("select id from team where slug = ?").param(slug).query(Long.class).single();
	}

	private long competitorId(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number)
				.query(Long.class).single();
	}

	private void team(String slug, String name) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
						+ " admin_id) values (?, ?, '', '', (select id from place where rank = 1), null, null,"
						+ " null, 2027, null)")
				.params(slug, name).update();
	}

	private void competitor(String number, String first, String last, String gender) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '1990-01-01', (select id from place where rank = 1), 2027,"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-01-01 10:00:00+00')")
				.params(number, first, last, gender, String.format("%016x", ++issued))
				.update();

		HeldOn.activeAt(db, number, INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE));
	}

	private void inATeam(String number, String slug, int seasonFrom) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, ?)")
				.params(competitorId(number), teamKey(slug), seasonFrom).update();
	}

	private void member(String email, String number) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'), ?)")
				.params(email, competitorId(number)).update();

		openSession(email);
	}

	/** A moderator's account, naming a member or, as V23 calls the ordinary case, none. */
	private void moderator(String email, String number) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Moderator', 'Probni', ?, (select id from role where code = 'moderator'), ?)")
				.params(email, number == null ? null : competitorId(number)).update();

		openSession(email);
	}

	private void superadmin(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Vrhovni', 'Bezimeni', ?, (select id from role where code = 'superadmin'))")
				.param(email).update();

		openSession(email);
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
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
