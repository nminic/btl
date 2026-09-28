package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
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

import java.nio.file.Files;
import java.nio.file.Path;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * GETTING INTO A TEAM, BOTH WAYS, END TO END.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND</b>, on every axis an assertion
 * below reads a value along. Each of these was chosen because a route that answered from the
 * WRONG source would otherwise pass:
 *
 * <ul>
 * <li><b>Never the first row.</b> {@link #FIRST_WRITTEN} and {@link #A_FIRST_TEAM} exist only
 * so that the member and the team every case is about are neither the lowest key nor the only
 * one, which is what tells „the team named in the path" from „the first team there is".
 * <li><b>Never one question.</b> Every case that answers or withdraws one has a SECOND
 * question of the identical shape standing beside it - {@link #NOBODY_ELSE}'s application to
 * the same team, and invitations to one member from three different teams - so „the row named"
 * is told from „his row" and from „every row of that kind".
 * <li><b>Never one season, and both sides of the rule.</b> A standing membership from a season
 * already running ({@link #LEADER}) stands beside one from a season still to come
 * ({@link #PLAIN}), because a condition reading the season instead of the record answers one
 * correctly and the other not.
 * <li><b>Never one clock.</b> {@link #INSIDE_THE_WINDOW} and {@link #OUTSIDE_THE_WINDOW} are
 * both asked of every act, because three of the five acts are bound by the window and three
 * are not, and a route that bound all five would pass a fixture that only ever asked in
 * October.
 * <li><b>AND NEVER THE CLAMPED YEAR.</b> The clock stands in 2027 and not in 2026, which is
 * measured rather than tidy: through 2026 {@code transfersTakeEffect},
 * {@code seasonBeingPaidFor} and {@link SeasonClock#FIRST_SEASON} are all 2027, so every
 * assertion about the season a membership begins in would have been satisfied by a constant.
 * In 2027 the season written is <b>2028</b>, which is neither the season being run (2027) nor
 * either season this fixture writes by hand (2027 and 2029).
 * <li><b>Never one recipient.</b> Every message this suite reads is asserted to have reached
 * one named inbox and NOT the league as a whole, and the team a member joins is asserted NOT
 * to be written to while two others are.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TeamJoiningWriteApiTest {

	/** Exists so that nobody a case is about is the first row of {@code competitor}. */
	private static final String FIRST_WRITTEN = "000100";

	/** The one who asks and the one who is asked, in a team nowhere. */
	private static final String ME = "000300";

	/** Stands in {@link #THE_TEAM} from a season already running, and therefore leads it. */
	private static final String LEADER = "000400";

	/**
	 * ALSO STANDS IN {@link #THE_TEAM} AND DOES NOT LEAD IT, which is the axis between standing
	 * in a team and holding its seat: he may do <b>neither</b> of the two acts that belong to
	 * the seat, so he decides no application and sends no invitation.
	 *
	 * <p><b>He used to be the axis of the opposite pair</b> - „may invite, may not decide" -
	 * which was the owner's parenthesis „(bilo koji clan)" of 05.09.2026, and he
	 * <b>overturned it on 27.09.2026</b> in favour of Article 53 of the rulebook. Both halves
	 * are now one rule read twice, and what this member measures is that the rule is asked on
	 * both routes rather than on one: {@code aMemberOfTheTeamWhoDoesNotLeadItDecidesNothing}
	 * and {@link #aMemberOfTheTeamWhoDoesNotLeadItAsksNobodyIn} demand 404 from him on either
	 * side of the same window.
	 *
	 * <p>His membership begins in a season still to come, so {@code WHO_ADMINISTERS_IT}'s
	 * „longest in it" picks {@link #LEADER} by the season and never by the tie-break - and his
	 * member number is the LARGER of the two, so a route that settled it by number alone would
	 * still name the same man and the case would measure nothing. The two orders agree here on
	 * purpose; which of them decides is {@code TeamApiTest}'s question and not this file's.
	 */
	private static final String PLAIN = "000500";

	/** Stands in {@link #THE_OTHER_TEAM} and leads it: a member of somebody else's team. */
	private static final String OUTSIDER = "000600";

	/** Stands in {@link #A_THIRD_TEAM} and leads it, so „the other teams" is never one. */
	private static final String THIRD = "000700";

	/**
	 * A THIRD STANDING MEMBER OF {@link #THE_TEAM}, AND THE FIXTURE HAS THREE ON PURPOSE.
	 *
	 * <p>With two, "the administrator" and "a member who is not" are one row each, so "not the
	 * administrator" is satisfied by whichever of the two is left - and a route reading "the
	 * member with the larger number", or "the second row of the team", would answer exactly as
	 * one reading the seat. A third non-administrator separates the seat from any ordering, and
	 * BOTH non-administrators are asked, so no single row can stand in for the rule.
	 *
	 * <p>He joins later than {@link #PLAIN}, so the order by season is total and
	 * {@code WHO_ADMINISTERS_IT} never reaches its tie-break here.
	 */
	private static final String ANOTHER_PLAIN = "001000";

	/** In no team, and the one whose question of the identical shape must be left alone. */
	private static final String NOBODY_ELSE = "000800";

	/** In no team and no longer a member: {@code competitor.active} is false. */
	private static final String LAPSED = "000900";

	private static final String A_FIRST_TEAM = "prvi-tim";

	private static final String THE_TEAM = "sava-runners";

	private static final String THE_OTHER_TEAM = "timocki-tim";

	private static final String A_THIRD_TEAM = "dunavski-tim";

	/**
	 * A TEAM WITH NOBODY STANDING IN IT, which is a state V11 allows and PDL names twice.
	 *
	 * <p>PDL.md ("Tim koji nema nijednog člana ne dobija poruku"): „Tim koji nema nijednog
	 * člana ne dobija poruku, jer nema kome.
	 * Isti razlog iz kog se takvom timu ne nudi ni prijava." It is deliberately NOT the first
	 * team either, so „empty" and „lowest key" are two different rows.
	 */
	private static final String AN_EMPTY_TEAM = "pusti-tim";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator-bez-clana@primer.rs";

	/**
	 * A DAY INSIDE THE TRANSFER WINDOW, IN 2027 AND NOT IN 2026.
	 *
	 * <p>See the class note: in 2026 every method that answers „which season" returns 2027 and
	 * an assertion about the season would be satisfied by a constant.
	 */
	private static final Instant INSIDE_THE_WINDOW = Instant.parse("2027-10-15T09:00:00Z");

	/** And a day outside it, when three of the five acts must still work. */
	private static final Instant OUTSIDE_THE_WINDOW = Instant.parse("2027-06-15T09:00:00Z");

	/**
	 * THE INSTANT THE TWO ZONES DISAGREE ABOUT, which is the only thing that measures where
	 * the window is read.
	 *
	 * <p>Half past eleven at night on 30 September in UTC is half past one on the morning of 1
	 * October in Belgrade, so the window is OPEN here and shut for anybody who reads the
	 * month off the machine. {@link SeasonClock#transferWindowOpen} reads it in
	 * {@link SeasonClock#ZONE}, which is ADL A36 O2.
	 */
	private static final Instant THE_NIGHT_THE_WINDOW_OPENS = Instant.parse("2027-09-30T23:30:00Z");

	/** What the standing members of this fixture joined in: a season already being run. */
	private static final int A_SEASON_ALREADY_RUNNING = 2027;

	/** And what {@link #PLAIN} joined in: one that has not begun. */
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
	 * A clock the case moves, reporting UTC on purpose so that whoever asks about the window
	 * has to re-read the instant in the league's own time. The shape {@code TeamWriteApiTest}
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
			return new AClockTheCaseMoves(INSIDE_THE_WINDOW);
		}
	}

	@BeforeEach
	void fiveTeamsAndEightMembers() {
		clock.moveTo(INSIDE_THE_WINDOW);

		competitor(FIRST_WRITTEN, true);
		competitor(ME, true);
		competitor(LEADER, true);
		competitor(PLAIN, true);
		competitor(OUTSIDER, true);
		competitor(THIRD, true);
		competitor(ANOTHER_PLAIN, true);
		competitor(NOBODY_ELSE, true);
		competitor(LAPSED, false);

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

		account("prvi@primer.rs", FIRST_WRITTEN);
		account("ja@primer.rs", ME);
		account("vodja@primer.rs", LEADER);
		account("clan@primer.rs", PLAIN);
		account("treci-clan@primer.rs", ANOTHER_PLAIN);
		account("sa-strane@primer.rs", OUTSIDER);
		account("treci@primer.rs", THIRD);
		account("neko-drugi@primer.rs", NOBODY_ELSE);
		account("istekla@primer.rs", LAPSED);
		moderatorWithNoCompetitor(MODERATOR_WHO_DOES_NOT_RACE);

		/* A QUESTION OF THE IDENTICAL SHAPE THAT NO CASE IS ABOUT, so that every assertion
		   which counts rows is telling „the one named" from „all of them". */
		applicationOf(NOBODY_ELSE, THE_TEAM);
	}

	private void competitor(String number, boolean active) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', ?, 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, "Probić" + number, active, String.format("%016x", ++issued))
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

	/** A membership he has already left, which is the other half of the season axis. */
	private void wasInATeam(String memberNumber, String teamSlug, int seasonFrom, int seasonTo) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to,"
						+ " left_reason) values (" + who() + ", " + which() + ", ?, ?, 'izašao iz tima')")
				.params(memberNumber, teamSlug, seasonFrom, seasonTo)
				.update();
	}

	private long applicationOf(String memberNumber, String teamSlug) {
		return db.sql("insert into team_application (competitor_id, team_id, season)"
						+ " values (" + who() + ", " + which() + ", 2028) returning id")
				.params(memberNumber, teamSlug)
				.query(Long.class)
				.single();
	}

	/** A question the fixture already wrote, read back rather than written a second time. */
	private long theApplicationOf(String memberNumber, String teamSlug) {
		return db.sql("select a.id from team_application a"
						+ " where a.competitor_id = " + who() + " and a.team_id = " + which())
				.params(memberNumber, teamSlug)
				.query(Long.class)
				.single();
	}

	private long invitationTo(String memberNumber, String teamSlug, int season) {
		return db.sql("insert into team_invitation (team_id, competitor_id, season)"
						+ " values (" + which() + ", " + who() + ", ?) returning id")
				.params(teamSlug, memberNumber, season)
				.query(Long.class)
				.single();
	}

	/**
	 * THE MESSAGE THAT CARRIED A QUESTION INTO SOMEBODY'S INBOX, which is the row the
	 * cascade of {@code message_team_invitation_fk} would take away with the invitation.
	 */
	private long messageCarrying(String memberNumber, long invitation) {
		return db.sql("insert into message (to_id, from_id, from_name, subject, body,"
						+ " team_invitation_id) values (" + who() + ", null, 'Balkanska trkačka liga',"
						+ " 'Poziv u tim', 'Tekst.', ?) returning id")
				.params(memberNumber, invitation)
				.query(Long.class)
				.single();
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

	private void moderatorWithNoCompetitor(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?, (select id from role where code = 'moderator'))")
				.param(email).update();

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

	private Cookie cookieOf(String memberNumber) {
		return new Cookie(SessionCookie.NAME, sessions.get(db.sql("select a.email from account a"
						+ " join competitor c on c.id = a.competitor_id where c.member_number = ?")
				.param(memberNumber).query(String.class).single()).secret());
	}

	private long keyOf(String teamSlug) {
		return db.sql("select id from team where slug = ?").param(teamSlug)
				.query(Long.class).single();
	}

	private long keyOfMember(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	private MockHttpServletResponse send(MockHttpServletRequestBuilder asking, String as)
			throws Exception {

		MockHttpServletRequestBuilder with = asking.with(csrf());

		return http.perform(as == null ? with : with.cookie(cookieOf(as))).andReturn().getResponse();
	}

	private MockHttpServletResponse applyTo(String teamSlug, String as) throws Exception {
		return send(post("/api/teams/{id}/applications", keyOf(teamSlug)), as);
	}

	private MockHttpServletResponse decide(String teamSlug, long application, String body, String as)
			throws Exception {

		return send(put("/api/teams/{id}/applications/{application}", keyOf(teamSlug), application)
				.contentType(MediaType.APPLICATION_JSON).content(body), as);
	}

	private MockHttpServletResponse withdraw(String teamSlug, long application, String as)
			throws Exception {

		return send(delete("/api/teams/{id}/applications/{application}", keyOf(teamSlug),
				application), as);
	}

	private MockHttpServletResponse invite(String teamSlug, String body, String as) throws Exception {
		return send(post("/api/teams/{id}/invitations", keyOf(teamSlug))
				.contentType(MediaType.APPLICATION_JSON).content(body), as);
	}

	private MockHttpServletResponse answer(String teamSlug, long invitation, String body, String as)
			throws Exception {

		return send(put("/api/teams/{id}/invitations/{invitation}", keyOf(teamSlug), invitation)
				.contentType(MediaType.APPLICATION_JSON).content(body), as);
	}

	private MockHttpServletResponse takeBack(String teamSlug, long invitation, String as)
			throws Exception {

		return send(delete("/api/teams/{id}/invitations/{invitation}", keyOf(teamSlug), invitation),
				as);
	}

	private String asking(String memberNumber) {
		return mapper.writeValueAsString(new TeamJoiningWriteApi.Asked(memberNumber));
	}

	private String answered(Boolean accepted) {
		return mapper.writeValueAsString(new TeamJoiningWriteApi.Answered(accepted));
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	private long howManyApplications() {
		return db.sql("select count(*) from team_application").query(Long.class).single();
	}

	private long howManyInvitations() {
		return db.sql("select count(*) from team_invitation").query(Long.class).single();
	}

	private boolean applicationStands(long application) {
		return db.sql("select exists(select 1 from team_application where id = ?)")
				.param(application).query(Boolean.class).single();
	}

	private boolean invitationStands(long invitation) {
		return db.sql("select exists(select 1 from team_invitation where id = ?)")
				.param(invitation).query(Boolean.class).single();
	}

	/** Which team he is in and from which season, as the table holds it. */
	private List<String> membershipsOf(String memberNumber) {
		return db.sql("select t.slug || ' from ' || m.season_from"
						+ " || coalesce(' to ' || m.season_to, '')"
						+ " from team_membership m join team t on t.id = m.team_id"
						+ " where m.competitor_id = " + who() + " order by m.season_from, t.slug")
				.param(memberNumber)
				.query(String.class)
				.list();
	}

	/** Every line in one named inbox, subject and body, oldest first. */
	private List<String> inboxOf(String memberNumber) {
		return db.sql("select m.subject || ' | ' || m.body from message m"
						+ " where m.to_id = " + who() + " order by m.sent_at, m.id")
				.param(memberNumber)
				.query(String.class)
				.list();
	}

	/** Messages addressed to nobody, which V13 says reach the WHOLE LEAGUE. */
	private long howManyWentToTheLeague() {
		return db.sql("select count(*) from message where to_id is null")
				.query(Long.class).single();
	}

	private long howManyMessages() {
		return db.sql("select count(*) from message").query(Long.class).single();
	}

	private Long pointerOf(long message) {
		return db.sql("select team_invitation_id from message where id = ?").param(message)
				.query(Long.class).optional().orElse(null);
	}

	private boolean messageStands(long message) {
		return db.sql("select exists(select 1 from message where id = ?)").param(message)
				.query(Boolean.class).single();
	}

	/* ---------------------------------------------------------------- applying */

	/**
	 * THE ORDINARY USE OF THE FIRST DOOR, and the season it writes is the whole of what this
	 * case is for.
	 *
	 * <p>{@code season} is read back off the row rather than off the answer, and it is
	 * <b>2028</b>: {@link SeasonClock#transfersTakeEffect} at a moment in 2027. The
	 * {@code teamId} in the answer is read off the stored row by the route itself, so what
	 * comes back is a claim about the table and not an echo of the path.
	 *
	 * <p><b>And nobody is written to</b>, which is the owner's decision of 06.09.2026 that an
	 * application is a record about a TEAM and not a letter to a person.
	 */
	@Test
	void aMemberWithNoTeamAsksATeamToTakeHimAndTheSeasonAskedAboutIsTheNextOne() throws Exception {
		long before = howManyMessages();

		MockHttpServletResponse answer = applyTo(THE_TEAM, ME);

		assertThat(answer.getStatus()).isEqualTo(201);

		JsonNode said = mapper.readTree(answer.getContentAsString());

		assertThat(said.path("teamId").asLong()).isEqualTo(keyOf(THE_TEAM));

		assertThat(db.sql("select a.season from team_application a where a.id = ?")
				.param(said.path("id").asLong()).query(Integer.class).single())
				.as("the season being asked about is the one a change agreed now takes effect in")
				.isEqualTo(SeasonClock.transfersTakeEffect(INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE)))
				.isEqualTo(2028);

		assertThat(membershipsOf(ME)).as("asking is not joining").isEmpty();
		assertThat(howManyMessages()).as("an application writes to nobody").isEqualTo(before);
	}

	/**
	 * THE WINDOW IS READ IN BELGRADE AND NOWHERE ELSE, which only this instant measures.
	 *
	 * <p>Half past eleven at night in UTC on 30 September is already 1 October in Belgrade.
	 * Read off the machine's own month this is refused; read in {@link SeasonClock#ZONE} it is
	 * the first hour the door is open. The mutation this case exists for is a replacement of
	 * the zone, not a deleted assertion.
	 */
	@Test
	void theWindowOpensAtMidnightInBelgradeAndNotAtMidnightWhereTheServerStands() throws Exception {
		clock.moveTo(THE_NIGHT_THE_WINDOW_OPENS);

		assertThat(applyTo(THE_TEAM, ME).getStatus()).isEqualTo(201);
	}

	/**
	 * FOUR CALLERS ARE TOLD THE SAME NOTHING, and the owner deleted the sentence that used to
	 * explain the second of them ({@code PDL.md}, 05.09.2026: „adresa koju član ne sme da
	 * otvori nije strana sa objašnjenjem nego adresa koje za njega nema").
	 */
	@Test
	void aMemberWhoAlreadyHasATeamIsSentAwayWithoutAWord() throws Exception {
		MockHttpServletResponse answer = applyTo(THE_TEAM, OUTSIDER);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString()).isEmpty();
		assertThat(howManyApplications()).isOne();
	}

	/**
	 * AND A MEMBERSHIP THAT HAS NOT BEGUN IS A TEAM HE HAS, which is the owner's own reading
	 * ({@code PDL.md}, „Inkrement 133", 05.09.2026: „„Nema tim" se čita sa zapisa, ne po
	 * sezoni") and the half a condition over the season would let through.
	 */
	@Test
	void aMembershipThatBeginsNextSeasonIsStillATeamHeHas() throws Exception {
		assertThat(applyTo(THE_OTHER_TEAM, PLAIN).getStatus()).isEqualTo(404);
		assertThat(howManyApplications()).isOne();
	}

	/**
	 * BOTH SIDES OF THE ENDED MEMBERSHIP, which is the axis that tells
	 * {@code standsInTheWayOfJoiningIn} from „has an open membership".
	 *
	 * <p>A membership ended with the season being run (2027) is behind him and does not stand
	 * in the way of 2028; one ended with 2028 itself does. Read as „is he in a team today" both
	 * would pass, and a member who left inside the window would be refused the team he left
	 * for.
	 *
	 * @param seasonTo the last season he was in his old team
	 * @param status   what this door then answers him
	 */
	@ParameterizedTest
	@CsvSource({ "2027,201", "2028,404" })
	void aMembershipHeHasEndedStandsInTheWayOnlyWhenItReachesTheSeasonHeWouldJoin(int seasonTo,
			int status) throws Exception {

		wasInATeam(ME, A_FIRST_TEAM, A_SEASON_ALREADY_RUNNING, seasonTo);

		assertThat(applyTo(THE_TEAM, ME).getStatus()).isEqualTo(status);
	}

	@Test
	void outsideTheTransferWindowNobodyAsksAnything() throws Exception {
		clock.moveTo(OUTSIDE_THE_WINDOW);

		MockHttpServletResponse answer = applyTo(THE_TEAM, ME);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString())
				.as("the window and a team he already has are one answer here")
				.isEmpty();
		assertThat(howManyApplications()).isOne();
	}

	/** PDL, owner, 19.09.2026: „sve akcije za njega brane". */
	@Test
	void aMemberWhoseFeeHasLapsedAsksNothing() throws Exception {
		assertThat(applyTo(THE_TEAM, LAPSED).getStatus()).isEqualTo(404);
		assertThat(howManyApplications()).isOne();
	}

	/**
	 * A TEAM NOBODY STANDS IN IS NOT OFFERED AN APPLICATION, PDL.md
	 * ("Tim koji nema nijednog člana ne dobija poruku"), and the
	 * fault it prevents is the one the owner's entry of 06.09.2026 describes: „prijava koju
	 * niko ne može da odgovori čekala je zauvek i držala člana van svih timova."
	 */
	@Test
	void aTeamWithNobodyToAnswerForItTakesNoApplication() throws Exception {
		assertThat(applyTo(AN_EMPTY_TEAM, ME).getStatus()).isEqualTo(404);
		assertThat(howManyApplications()).isOne();
	}

	@Test
	void aTeamThatIsNotThereTakesNoApplication() throws Exception {
		assertThat(send(post("/api/teams/{id}/applications", 999999L), ME).getStatus())
				.isEqualTo(404);
	}

	@Test
	void anAccountNamingNoMemberAsksNothing() throws Exception {
		assertThat(http.perform(post("/api/teams/{id}/applications", keyOf(THE_TEAM)).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret())))
				.andReturn().getResponse().getStatus())
				.isEqualTo(404);
	}

	/**
	 * ONE QUESTION IN FLIGHT ACROSS EVERY TEAM, PDL.md ("Prijava ne može da se umnoži"),
	 * AND THE SECOND TEAM IS
	 * THE POINT OF THIS CASE.
	 *
	 * <p>{@code team_application_asked_once} is over {@code (competitor_id, team_id, season)},
	 * so the database would take this row without complaint; asked about ANOTHER team, the
	 * refusal can only come from the route. A condition written per team would pass a fixture
	 * that asked the same team twice.
	 */
	@Test
	void aMemberWhoAlreadyAskedOneTeamMayNotAskAnother() throws Exception {
		applicationOf(ME, A_THIRD_TEAM);

		MockHttpServletResponse answer = applyTo(THE_TEAM, ME);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(TeamJoiningWriteApi.A_QUESTION_ALREADY_STANDS);
		assertThat(howManyApplications()).isEqualTo(2);
	}

	@Test
	void nobodySignedInAsksAnything() throws Exception {
		assertThat(send(post("/api/teams/{id}/applications", keyOf(THE_TEAM)), null).getStatus())
				.isEqualTo(401);
	}

	/* ------------------------------------------------------- deciding about one */

	/**
	 * THE TEAM TAKES HIM IN, AND EVERYTHING THAT FOLLOWS FROM IT IS READ OFF THE DATABASE.
	 *
	 * <p>The membership begins in 2028, the question is gone, the applicant reads the portal's
	 * own two sentences in his own inbox, and the two OTHER teams that had asked him are told -
	 * while the team he joined is not
	 * (PDL.md ("doneo odluku ili je njegov poziv prihvaćen")) and the team nobody stands in is
	 * not either. Nothing reaches the league as a whole.
	 *
	 * <p><b>AND A TEAM THAT IS HOLDING AN INVITATION TO SOMEBODY ELSE IS NOT TOLD ANYTHING,
	 * WHICH IS AN AXIS THIS CASE WAS MISSING AND A MUTATION FOUND.</b> Every invitation in
	 * this suite named {@link #ME}, so „the teams that asked HIM" and „every team holding any
	 * invitation at all" were the same list and the condition {@code i.competitor_id = ?} could
	 * be dropped without a single case changing its answer. The two invitations of
	 * {@link #NOBODY_ELSE} in the class note are to the ANSWER route and never reach this
	 * statement - they are cases that end 404 one line earlier - so the axis has to be
	 * separated here, where the statement actually runs. In production the dropped condition
	 * would write „X has joined team Y, so your invitation no longer stands" to whoever leads
	 * every team holding any open invitation, about a man that team never asked for.
	 */
	@Test
	void whoeverLeadsTheTeamTakesHimInAndTheOtherTeamsThatAskedHimAreTold() throws Exception {
		long application = applicationOf(ME, THE_TEAM);
		long fromTheOther = invitationTo(ME, THE_OTHER_TEAM, 2028);
		long fromTheThird = invitationTo(ME, A_THIRD_TEAM, 2028);
		invitationTo(ME, AN_EMPTY_TEAM, 2028);

		/* AND A TEAM WHOSE OPEN QUESTION IS ABOUT A DIFFERENT MAN, so „whose invitation" is
		   told from „anybody's invitation". {@link #FIRST_WRITTEN} leads it and is the one
		   inbox in this fixture that must stay empty. */
		long aboutSomebodyElse = invitationTo(NOBODY_ELSE, A_FIRST_TEAM, 2028);

		/* AND THE TEAM HE IS JOINING HAS ALSO ASKED HIM, which is what makes „not the team he
		   joined" a condition rather than a sentence. A mutation found this: with no invitation
		   from THE_TEAM in the fixture there was nothing for that condition to exclude, so
		   dropping it changed no answer and this case passed over it. It is the ordinary case
		   too - the owner's „(ko god da je poslao poziv)" is about exactly this man, asked by
		   one team and taken in by it through the other door. */
		invitationTo(ME, THE_TEAM, 2028);

		assertThat(decide(THE_TEAM, application, answered(true), LEADER).getStatus()).isEqualTo(204);

		assertThat(membershipsOf(ME)).containsExactly(THE_TEAM + " from 2028");
		assertThat(applicationStands(application)).isFalse();
		assertThat(howManyApplications()).as("somebody else's question is left alone").isOne();

		assertThat(inboxOf(ME)).containsExactly(
				TeamJoiningWriteApi.heIsInTheTeamReads("Sava Runners") + " | "
						+ TeamJoiningWriteApi.theSeasonHeRunsFromReads("Sava Runners"));

		String missed = TeamJoiningWriteApi.THE_INVITATION_WAS_MISSED + " | "
				+ TeamJoiningWriteApi.theMissedInvitationReads("Probni Probić" + ME, "Sava Runners");

		assertThat(inboxOf(OUTSIDER)).as("the team whose invitation is now dead").containsExactly(missed);
		assertThat(inboxOf(THIRD)).as("and the second such team, so this is never one")
				.containsExactly(missed);
		assertThat(inboxOf(LEADER)).as("the team he joined already knows").isEmpty();
		assertThat(inboxOf(FIRST_WRITTEN))
				.as("a team holding an invitation to somebody else was told about a man it never"
						+ " asked for")
				.isEmpty();
		assertThat(howManyWentToTheLeague()).isZero();

		assertThat(invitationStands(fromTheOther)).as("PDL.md's 'Poziv se ne pamti kao"
				+ " odgovoren' entry, the row is not remembered as"
				+ " answered and is not deleted either").isTrue();
		assertThat(invitationStands(fromTheThird)).isTrue();
		assertThat(invitationStands(aboutSomebodyElse))
				.as("somebody else's open question was closed by this answer")
				.isTrue();
	}

	/**
	 * AND THE MESSAGE TO A TEAM NOBODY STANDS IN IS NOT WRITTEN AT ALL, rather than written to
	 * nobody.
	 *
	 * <p>V13 makes {@code message.to_id} empty mean the WHOLE LEAGUE, so a row about a team
	 * with no leader would post one team's private news to every member of the portal. Counted
	 * rather than argued: the empty team invited him too, in the case above and in this one.
	 */
	@Test
	void aTeamWithNobodyInItIsNotWrittenToAndNothingGoesToTheLeague() throws Exception {
		long application = applicationOf(ME, THE_TEAM);
		invitationTo(ME, AN_EMPTY_TEAM, 2028);

		assertThat(decide(THE_TEAM, application, answered(true), LEADER).getStatus()).isEqualTo(204);

		assertThat(howManyWentToTheLeague()).isZero();
		assertThat(inboxOf(ME)).hasSize(1);
	}

	/** „Odbij": the question ends, nothing about a squad is written, and he is told. */
	@Test
	void theTeamRefusesHimAndHeReadsWhyInHisOwnInbox() throws Exception {
		long application = applicationOf(ME, THE_TEAM);

		assertThat(decide(THE_TEAM, application, answered(false), LEADER).getStatus()).isEqualTo(204);

		assertThat(applicationStands(application)).isFalse();
		assertThat(membershipsOf(ME)).isEmpty();
		assertThat(inboxOf(ME)).containsExactly(
				TeamJoiningWriteApi.theApplicationWasRefusedReads("Sava Runners") + " | "
						+ TeamJoiningWriteApi.theRefusalReads("Sava Runners"));
		assertThat(howManyWentToTheLeague()).isZero();
	}

	/**
	 * „PRIHVATI" NEEDS THE WINDOW AND „ODBIJ" DOES NOT, PDL.md ("traži prelazni rok"), and
	 * this is the
	 * asymmetry a fixture that only ever asked in October cannot see.
	 *
	 * <p>The owner's reason, in his entry: „član pozvan 30. decembra ne bi mogao ni da prihvati
	 * ni da se oslobodi pitanja do sledećeg oktobra."
	 */
	@Test
	void outsideTheWindowHeMayStillBeRefusedButNotTakenIn() throws Exception {
		long application = applicationOf(ME, THE_TEAM);
		clock.moveTo(OUTSIDE_THE_WINDOW);

		MockHttpServletResponse refused = decide(THE_TEAM, application, answered(true), LEADER);

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(reasonIn(refused)).isEqualTo(TeamJoiningWriteApi.THE_WINDOW_IS_SHUT);
		assertThat(applicationStands(application)).as("a refused acceptance leaves the question")
				.isTrue();
		assertThat(membershipsOf(ME)).isEmpty();

		assertThat(decide(THE_TEAM, application, answered(false), LEADER).getStatus())
				.as("a refusal is not bound by the window")
				.isEqualTo(204);
		assertThat(applicationStands(application)).isFalse();
	}

	/**
	 * A MEMBER OF THE TEAM WHO DOES NOT LEAD IT DECIDES NOTHING, which is one half of a rule
	 * whose other half is now the same answer.
	 *
	 * <p>{@link #PLAIN} may not send an invitation either, since the owner's reversal of
	 * 27.09.2026, and {@link #aMemberOfTheTeamWhoDoesNotLeadItAsksNobodyIn} demands 404 of him
	 * there. So a route reading „is he in the team" instead of „does he hold its seat" would
	 * fail <b>both</b> of them and not one, and what keeps the two honest is that they read the
	 * same {@link TeamApi#WHO_ADMINISTERS_IT} rather than a case each.
	 *
	 * <p><b>Written this way round on purpose:</b> until that day this paragraph said he may
	 * invite and may not decide, and cited a case that no longer exists to prove the first
	 * half. Sentences like that are how an overturned decision gets put back.
	 */
	@Test
	void aMemberOfTheTeamWhoDoesNotLeadItDecidesNothing() throws Exception {
		long application = applicationOf(ME, THE_TEAM);

		assertThat(decide(THE_TEAM, application, answered(true), PLAIN).getStatus()).isEqualTo(404);
		assertThat(applicationStands(application)).isTrue();
		assertThat(membershipsOf(ME)).isEmpty();
	}

	/** Somebody else's team leader is nobody here either. */
	@Test
	void theLeaderOfAnotherTeamDecidesNothing() throws Exception {
		long application = applicationOf(ME, THE_TEAM);

		assertThat(decide(THE_TEAM, application, answered(true), OUTSIDER).getStatus())
				.isEqualTo(404);
		assertThat(applicationStands(application)).isTrue();
	}

	/**
	 * THE KEY IN THE PATH AND THE ROW MUST NAME ONE TEAM, which is the axis that cannot be
	 * seen with one team in the fixture.
	 *
	 * <p>{@link #THIRD} really does lead {@link #A_THIRD_TEAM} and the application really does
	 * exist, so both halves are true separately and only their agreement is false. A route
	 * reading the row by key alone answers 204 and moves a member into a team that never
	 * asked for him.
	 */
	@Test
	void anApplicationOfAnotherTeamIsNotThisTeamsToDecide() throws Exception {
		long toTheThird = applicationOf(ME, A_THIRD_TEAM);

		assertThat(decide(THE_TEAM, toTheThird, answered(true), LEADER).getStatus()).isEqualTo(404);
		assertThat(decide(A_THIRD_TEAM, toTheThird, answered(true), LEADER).getStatus())
				.as("and the leader of THE_TEAM does not lead A_THIRD_TEAM either")
				.isEqualTo(404);
		assertThat(applicationStands(toTheThird)).isTrue();
		assertThat(membershipsOf(ME)).isEmpty();
	}

	/**
	 * AN APPLICANT WHO HAS SINCE GOT A TEAM IS INVISIBLE TO THE TEAM, PDL.md
	 * ("Prijava člana koji je u međuvremenu dobio tim se timu ne prikazuje"), AND
	 * FOR BOTH ANSWERS.
	 *
	 * <p>„Prikazana, „Primi u tim" bi ga izvukla iz tog tima bez ijednog pitanja, a P13 to
	 * zabranjuje svuda drugde." Refusing is in the same bucket because „se timu ne prikazuje"
	 * is about the row and not about one of the buttons; what stays open is his own way out,
	 * which the case below presses.
	 *
	 * @param accepted which button the team presses
	 */
	@ParameterizedTest
	@ValueSource(booleans = { true, false })
	void anApplicantWhoHasSinceGotATeamIsHiddenFromTheTeamEitherWay(boolean accepted)
			throws Exception {

		long application = applicationOf(ME, THE_TEAM);
		inATeam(ME, A_THIRD_TEAM, 2028);

		assertThat(decide(THE_TEAM, application, answered(accepted), LEADER).getStatus())
				.isEqualTo(404);
		assertThat(applicationStands(application)).as("and it is left for him to withdraw").isTrue();
		assertThat(inboxOf(ME)).isEmpty();
	}

	/** „Isto važi i za člana koga je administracija obrisala" reaches the lapsed fee too. */
	@Test
	void anApplicantWhoseFeeHasLapsedIsHiddenFromTheTeam() throws Exception {
		long application = applicationOf(LAPSED, THE_TEAM);

		assertThat(decide(THE_TEAM, application, answered(true), LEADER).getStatus()).isEqualTo(404);
		assertThat(applicationStands(application)).isTrue();
	}

	/**
	 * A BODY THAT NAMES NO ANSWER IS A FORM THAT WAS NOT FILLED IN, and the field is boxed so
	 * that its absence cannot read as „Odbij" and close somebody's question for him.
	 */
	@Test
	void aBodyThatNamesNoAnswerDecidesNothing() throws Exception {
		long application = applicationOf(ME, THE_TEAM);

		MockHttpServletResponse answer = decide(THE_TEAM, application, answered(null), LEADER);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(TeamJoiningWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(applicationStands(application)).isTrue();
	}

	@Test
	void anAccountNamingNoMemberDecidesNothing() throws Exception {
		long application = applicationOf(ME, THE_TEAM);

		assertThat(http.perform(put("/api/teams/{id}/applications/{application}", keyOf(THE_TEAM),
								application).with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(answered(true))
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret())))
				.andReturn().getResponse().getStatus())
				.isEqualTo(404);
		assertThat(applicationStands(application)).isTrue();
	}

	@Test
	void nobodySignedInDecidesAnything() throws Exception {
		long application = applicationOf(ME, THE_TEAM);

		assertThat(send(put("/api/teams/{id}/applications/{application}", keyOf(THE_TEAM),
				application).contentType(MediaType.APPLICATION_JSON).content(answered(true)), null)
				.getStatus()).isEqualTo(401);
	}

	/* -------------------------------------------------------------- withdrawing */

	/**
	 * HIS OWN QUESTION IS HIS TO TAKE BACK, AND THE ONE THAT GOES IS THE ONE NAMED.
	 *
	 * <p>{@link #NOBODY_ELSE}'s application to the same team stands in the fixture, so „the
	 * row named" is told from „every application of that team"; nothing is written to anybody.
	 */
	@Test
	void hisOwnApplicationIsHisToTakeBack() throws Exception {
		long mine = applicationOf(ME, THE_TEAM);
		long before = howManyMessages();

		assertThat(withdraw(THE_TEAM, mine, ME).getStatus()).isEqualTo(204);

		assertThat(applicationStands(mine)).isFalse();
		assertThat(howManyApplications()).as("somebody else's is left standing").isOne();
		assertThat(howManyMessages()).as("nobody is told: no sentence for it exists").isEqualTo(before);
	}

	/**
	 * AND IT IS HIS TO TAKE BACK IN BOTH THE CASES THAT HIDE IT FROM THE TEAM
	 * (PDL.md ("ostaje njegova da je povuče"): „Prijava u oba slučaja ostaje njegova da je
	 * povuče"), and on a day
	 * the window is shut.
	 */
	@Test
	void heTakesItBackEvenWhenTheTeamCanNoLongerSeeItAndEvenOutsideTheWindow() throws Exception {
		long mine = applicationOf(ME, THE_TEAM);
		inATeam(ME, A_THIRD_TEAM, 2028);
		clock.moveTo(OUTSIDE_THE_WINDOW);

		assertThat(withdraw(THE_TEAM, mine, ME).getStatus()).isEqualTo(204);
		assertThat(applicationStands(mine)).isFalse();
	}

	/**
	 * It reads the question the fixture already holds rather than writing a second one, which
	 * {@code team_application_asked_once} refuses outright - and that refusal is itself worth
	 * knowing: the schema keeps one member from asking one team twice for one season, so this
	 * case is about a row that was there before it, exactly as it would be in life.
	 */
	@Test
	void nobodyTakesBackSomebodyElsesApplication() throws Exception {
		long his = theApplicationOf(NOBODY_ELSE, THE_TEAM);

		assertThat(withdraw(THE_TEAM, his, ME).getStatus()).isEqualTo(404);
		assertThat(withdraw(THE_TEAM, his, LEADER).getStatus())
				.as("not even whoever leads the team")
				.isEqualTo(404);
		assertThat(applicationStands(his)).isTrue();
	}

	@Test
	void theTeamInThePathMustBeTheOneTheApplicationNames() throws Exception {
		long mine = applicationOf(ME, A_THIRD_TEAM);

		assertThat(withdraw(THE_TEAM, mine, ME).getStatus()).isEqualTo(404);
		assertThat(applicationStands(mine)).isTrue();
	}

	@Test
	void aMemberWhoseFeeHasLapsedTakesNothingBack() throws Exception {
		long his = applicationOf(LAPSED, THE_TEAM);

		assertThat(withdraw(THE_TEAM, his, LAPSED).getStatus()).isEqualTo(404);
		assertThat(applicationStands(his)).isTrue();
	}

	@Test
	void anAccountNamingNoMemberTakesNothingBack() throws Exception {
		long mine = applicationOf(ME, THE_TEAM);

		assertThat(http.perform(delete("/api/teams/{id}/applications/{application}", keyOf(THE_TEAM),
								mine).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret())))
				.andReturn().getResponse().getStatus())
				.isEqualTo(404);
	}

	@Test
	void nobodySignedInTakesAnythingBack() throws Exception {
		long mine = applicationOf(ME, THE_TEAM);

		assertThat(send(delete("/api/teams/{id}/applications/{application}", keyOf(THE_TEAM), mine),
				null).getStatus()).isEqualTo(401);
	}

	/* ------------------------------------------------------------------ inviting */

	/**
	 * WHOEVER LEADS THE TEAM ASKS SOMEBODY IN, AND THE QUESTION ARRIVES AS A QUESTION.
	 *
	 * <p>PDL.md ("samo administrator tog tima"), the owner of 27.09.2026: „Poziv u tim salje
	 * **samo administrator
	 * tog tima**", taken off Article 53 of the rulebook ({@code V24__static_pages.sql:811}) and
	 * overturning his own decision of 05.09.2026.
	 *
	 * <p><b>This case USED TO RUN TWICE - as the leader and as a member who is not - and demanded
	 * 201 from both.</b> It is turned round rather than deleted: the run that asserted a plain
	 * member may invite is now {@link #aMemberOfTheTeamWhoDoesNotLeadItAsksNobodyIn}, which
	 * demands 404 from two different plain members.
	 *
	 * <p>The message that carries it points at the invitation, which is what V13 built
	 * {@code message.team_invitation_id} for and what puts two buttons under it.
	 */
	@Test
	void whoeverLeadsTheTeamAsksSomebodyInAndTheQuestionArrivesAsAQuestion() throws Exception {
		MockHttpServletResponse answer = invite(THE_TEAM, asking(ME), LEADER);

		assertThat(answer.getStatus()).isEqualTo(201);

		JsonNode said = mapper.readTree(answer.getContentAsString());

		assertThat(said.path("memberNumber").stringValue())
				.as("whom the stored question really reaches, read back off the row")
				.isEqualTo(ME);

		long invitation = said.path("id").asLong();

		assertThat(db.sql("select season from team_invitation where id = ?").param(invitation)
				.query(Integer.class).single())
				.isEqualTo(SeasonClock.transfersTakeEffect(INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE)))
				.isEqualTo(2028);

		assertThat(inboxOf(ME)).containsExactly(
				TeamJoiningWriteApi.theInvitationReads("Sava Runners") + " | "
						+ TeamJoiningWriteApi.theInvitationBodyReads("Sava Runners"));

		assertThat(db.sql("select count(*) from message where team_invitation_id = ?")
				.param(invitation).query(Long.class).single())
				.as("V13: the pointer is what puts two buttons under a message")
				.isOne();
		assertThat(howManyWentToTheLeague()).isZero();
		assertThat(membershipsOf(ME)).as("asking is not joining").isEmpty();
	}

	/**
	 * A MEMBER OF THE TEAM WHO DOES NOT LEAD IT ASKS NOBODY IN, which is the owner's reversal of
	 * 27.09.2026 and the half of the old case that demanded 201.
	 *
	 * <p>PDL.md ("samo administrator tog tima"). Until that day PDL.md
	 * ("obara pretpostavku da poziv šalje administrator") said the opposite in as many
	 * words, with his parenthesis „(bilo koji clan)" recorded as explicitly overturning the
	 * obvious reading. The conflict was found by reading Article 53 of the rulebook in order to
	 * translate it, and he chose the rulebook.
	 *
	 * <p><b>Both non-administrators of the team are asked, which is why the fixture has
	 * three</b> ({@link #ANOTHER_PLAIN}).
	 *
	 * @param as a member standing in {@link #THE_TEAM} who is not the one who leads it
	 */
	@ParameterizedTest
	@ValueSource(strings = { PLAIN, ANOTHER_PLAIN })
	void aMemberOfTheTeamWhoDoesNotLeadItAsksNobodyIn(String as) throws Exception {
		MockHttpServletResponse answer = invite(THE_TEAM, asking(ME), as);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString())
				.as("an address this member may not use carries no explanation")
				.isEmpty();
		assertThat(howManyInvitations()).isZero();
		assertThat(inboxOf(ME)).isEmpty();
	}

	@Test
	void aMemberOfAnotherTeamAsksNobodyIntoThisOne() throws Exception {
		assertThat(invite(THE_TEAM, asking(ME), OUTSIDER).getStatus()).isEqualTo(404);
		assertThat(howManyInvitations()).isZero();
	}

	/** PDL.md ("Ko nema tim, taj nema koga da pozove"): „Ko nema tim, taj nema koga da pozove." */
	@Test
	void aMemberWithNoTeamAsksNobodyIn() throws Exception {
		assertThat(invite(THE_TEAM, asking(NOBODY_ELSE), ME).getStatus()).isEqualTo(404);
		assertThat(howManyInvitations()).isZero();
	}

	/**
	 * THE WINDOW IS ANSWERED BEFORE THE NUMBER IS RESOLVED, so on a day nothing may be written
	 * no request learns anything about who carries which number.
	 *
	 * <p>The reason is carried here rather than hidden, for the line
	 * {@link TeamJoiningWriteApi#THE_WINDOW_IS_SHUT} draws: the only caller who reaches it is
	 * somebody the portal has already agreed stands in this team.
	 */
	@Test
	void outsideTheWindowNoTeamAsksAnybodyIn() throws Exception {
		clock.moveTo(OUTSIDE_THE_WINDOW);

		MockHttpServletResponse answer = invite(THE_TEAM, asking(ME), LEADER);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(TeamJoiningWriteApi.THE_WINDOW_IS_SHUT);

		MockHttpServletResponse nobody = invite(THE_TEAM, asking("000999"), LEADER);

		assertThat(nobody.getStatus())
				.as("a number nobody carries is answered the same on a day nothing is written")
				.isEqualTo(409);
		assertThat(howManyInvitations()).isZero();
	}

	/**
	 * THREE SHAPES OF AN EMPTY FIELD ARE ONE ANSWER: JSON has a null, a form has an empty box
	 * and a person has a space bar.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "{}", "{\"memberNumber\":\"\"}", "{\"memberNumber\":\"   \"}" })
	void aQuestionThatNamesNobodyIsAFormThatWasNotFilledIn(String body) throws Exception {
		MockHttpServletResponse answer = invite(THE_TEAM, body, LEADER);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(TeamJoiningWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(howManyInvitations()).isZero();
	}

	/**
	 * THREE PEOPLE GET ONE EMPTY 404, and the lapsed member is one of them for PDL's rule of
	 * 13.09.2026: told apart from a number nobody carries, the difference between two answers
	 * over consecutive numbers would be a list of who has not paid.
	 */
	@ParameterizedTest
	@CsvSource({ "000999", LAPSED, LEADER })
	void aNumberNobodyCarriesALapsedMemberAndHimselfAreOneAnswer(String number) throws Exception {
		MockHttpServletResponse answer = invite(THE_TEAM, asking(number), LEADER);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString()).isEmpty();
		assertThat(howManyInvitations()).isZero();
	}

	/**
	 * SOMEBODY WHO ALREADY HAS A TEAM IS NOT ASKED - P13's single-team rule, PDL.md
	 * ("je član u jednom timu") - and the reason names
	 * it because a squad is public.
	 *
	 * @param whom a member standing in a team from a season already running, and one from a
	 *             season still to come
	 */
	@ParameterizedTest
	@ValueSource(strings = { OUTSIDER, PLAIN })
	void somebodyWhoAlreadyHasATeamIsNotAsked(String whom) throws Exception {
		MockHttpServletResponse answer = invite(A_THIRD_TEAM, asking(whom), THIRD);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(TeamJoiningWriteApi.HE_IS_ALREADY_IN_A_TEAM);
		assertThat(howManyInvitations()).isZero();
	}

	/**
	 * ONE TEAM ASKS ONE MAN ONCE, IN ANY SEASON, PDL.md
	 * ("Isti tim ne poziva istog čoveka dvaput") - AND THE SEASON IS THE
	 * POINT OF THIS CASE.
	 *
	 * <p>{@code team_invitation_sent_once} is per season, so a row for 2029 leaves the key free
	 * for 2028 and the database would take the second question. The refusal can only come from
	 * the route, and a condition carrying the season would let a team fill somebody's inbox one
	 * year at a time.
	 *
	 * @param standing the season of the invitation already standing
	 */
	@ParameterizedTest
	@ValueSource(ints = { 2028, 2029 })
	void aTeamThatHasAlreadyAskedHimDoesNotAskAgainWhateverSeasonStands(int standing)
			throws Exception {

		invitationTo(ME, THE_TEAM, standing);

		MockHttpServletResponse answer = invite(THE_TEAM, asking(ME), LEADER);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(TeamJoiningWriteApi.HE_HAS_ALREADY_BEEN_ASKED);
		assertThat(howManyInvitations()).isOne();
	}

	/**
	 * BUT ANOTHER TEAM HAVING ASKED HIM REFUSES NOTHING, which is PDL.md
	 * ("pa tri tima mogu pozvati istog čoveka"): „Poziv
	 * može [da se umnoži]... tri tima mogu pozvati istog čoveka istog dana, i nijedan ne zna za
	 * ostale." A condition written over the member alone would turn this into a 409.
	 */
	@Test
	void aTeamMayAskSomebodyAnotherTeamHasAlreadyAsked() throws Exception {
		invitationTo(ME, A_THIRD_TEAM, 2028);

		assertThat(invite(THE_TEAM, asking(ME), LEADER).getStatus()).isEqualTo(201);
		assertThat(howManyInvitations()).isEqualTo(2);
	}

	/**
	 * AN ACCOUNT NAMING NO MEMBER ASKS NOBODY IN EITHER, which is the sixth door of one rule
	 * and the only one this suite had left out.
	 *
	 * <p>V23 lets {@code account.competitor_id} be null for „a moderator who does not race,
	 * which is the ordinary case and not a fault", and such an account stands in no team, so
	 * there is no team for it to invite anybody into. <b>Found by the coverage threshold rather
	 * than by reading:</b> the full gate came back at 0.99 with all 3107 cases green, and the
	 * one line nothing reached was this route's own {@code away()}. Every other route here had
	 * the case; a mutation could not have found it, because a mutation measures whether
	 * something that runs has a guard and not whether something runs at all.
	 */
	@Test
	void anAccountNamingNoMemberAsksNobodyIn() throws Exception {
		assertThat(http.perform(post("/api/teams/{id}/invitations", keyOf(THE_TEAM)).with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(asking(ME))
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret())))
				.andReturn().getResponse().getStatus())
				.isEqualTo(404);
		assertThat(howManyInvitations()).isZero();
	}

	@Test
	void nobodySignedInAsksAnybodyIn() throws Exception {
		assertThat(send(post("/api/teams/{id}/invitations", keyOf(THE_TEAM))
				.contentType(MediaType.APPLICATION_JSON).content(asking(ME)), null).getStatus())
				.isEqualTo(401);
	}

	/* ------------------------------------------------------- answering an invitation */

	/**
	 * HE ACCEPTS, AND THE MESSAGE THAT ASKED HIM STAYS IN HIS INBOX.
	 *
	 * <p><b>This is the case the schema would have failed.</b>
	 * {@code message_team_invitation_fk} is {@code on delete cascade} (V13), so deleting the
	 * row takes the message with it, and the owner decided the opposite on 06.09.2026
	 * (PDL.md ("Poruka sa pozivom ostaje u sandučetu, sa razlogom umesto dugmadi")):
	 * „Poruka sa pozivom ostaje u sandučetu... Ne briše se: brisanje
	 * poruke iz tuđeg sandučeta je brisanje istorije." What goes is the POINTER, which is what
	 * made it a question - V13's own reason for the cascade („the row would offer a button that
	 * does nothing") without its side effect.
	 *
	 * <p>The other two teams keep their rows and are told, and the season is 2028.
	 */
	@Test
	void heAcceptsAndTheMessageThatAskedHimStaysBehindWithoutItsButtons() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);
		long asked = messageCarrying(ME, invitation);
		invitationTo(ME, THE_OTHER_TEAM, 2028);
		invitationTo(ME, A_THIRD_TEAM, 2028);

		assertThat(answer(THE_TEAM, invitation, answered(true), ME).getStatus()).isEqualTo(204);

		assertThat(membershipsOf(ME)).containsExactly(THE_TEAM + " from 2028");
		assertThat(invitationStands(invitation)).isFalse();
		assertThat(howManyInvitations()).as("the other two are not remembered as answered")
				.isEqualTo(2);

		assertThat(messageStands(asked))
				.as("a message in somebody's inbox is history and is not deleted")
				.isTrue();
		assertThat(pointerOf(asked))
				.as("and it is no longer a question, which is what the cascade was for")
				.isNull();

		String missed = TeamJoiningWriteApi.THE_INVITATION_WAS_MISSED + " | "
				+ TeamJoiningWriteApi.theMissedInvitationReads("Probni Probić" + ME, "Sava Runners");

		assertThat(inboxOf(OUTSIDER)).containsExactly(missed);
		assertThat(inboxOf(THIRD)).containsExactly(missed);
		assertThat(inboxOf(LEADER)).as("no sentence exists for an acceptance reported back to the team").isEmpty();
		assertThat(howManyWentToTheLeague()).isZero();
	}

	/** „Odbij": the question ends, his message stays, and nothing about a squad is written. */
	@Test
	void heRefusesAndNothingAboutASquadIsWritten() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);
		long asked = messageCarrying(ME, invitation);
		long before = howManyMessages();

		assertThat(answer(THE_TEAM, invitation, answered(false), ME).getStatus()).isEqualTo(204);

		assertThat(invitationStands(invitation)).isFalse();
		assertThat(membershipsOf(ME)).isEmpty();
		assertThat(messageStands(asked)).isTrue();
		assertThat(pointerOf(asked)).isNull();
		assertThat(howManyMessages())
				.as("no sentence exists for a refusal reported back to the team")
				.isEqualTo(before);
	}

	/** PDL.md ("traži prelazni rok") from the other side of the same door. */
	@Test
	void outsideTheWindowHeMayRefuseAndMayNotAccept() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);
		clock.moveTo(OUTSIDE_THE_WINDOW);

		MockHttpServletResponse refused = answer(THE_TEAM, invitation, answered(true), ME);

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(reasonIn(refused)).isEqualTo(TeamJoiningWriteApi.THE_WINDOW_IS_SHUT);
		assertThat(invitationStands(invitation))
				.as("PDL.md's 'Poziv van roka čeka, ne propada' entry: an invitation outside the"
					+ " window waits and does not lapse")
				.isTrue();
		assertThat(membershipsOf(ME)).isEmpty();

		assertThat(answer(THE_TEAM, invitation, answered(false), ME).getStatus()).isEqualTo(204);
		assertThat(invitationStands(invitation)).isFalse();
	}

	/**
	 * ONCE HE HAS A TEAM NO OTHER INVITATION OFFERS „PRIHVATI", PDL.md
	 * ("Poziv se ne pamti kao odgovoren"), and the
	 * reason names his own squad because it is public and it is about him.
	 */
	@Test
	void onceHeHasATeamNoOtherInvitationMayBeAccepted() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);
		inATeam(ME, A_THIRD_TEAM, 2028);

		MockHttpServletResponse answer = answer(THE_TEAM, invitation, answered(true), ME);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(TeamJoiningWriteApi.HE_IS_ALREADY_IN_A_TEAM);
		assertThat(invitationStands(invitation)).isTrue();
		assertThat(membershipsOf(ME)).containsExactly(A_THIRD_TEAM + " from 2028");
	}

	/** Nobody answers a question addressed to somebody else, whatever team he is in. */
	@Test
	void nobodyAnswersAQuestionAddressedToSomebodyElse() throws Exception {
		long his = invitationTo(NOBODY_ELSE, THE_TEAM, 2028);

		assertThat(answer(THE_TEAM, his, answered(true), ME).getStatus()).isEqualTo(404);
		assertThat(answer(THE_TEAM, his, answered(true), LEADER).getStatus())
				.as("not even the team that sent it")
				.isEqualTo(404);
		assertThat(invitationStands(his)).isTrue();
		assertThat(membershipsOf(NOBODY_ELSE)).isEmpty();
	}

	@Test
	void theTeamInThePathMustBeTheOneTheInvitationNames() throws Exception {
		long fromTheThird = invitationTo(ME, A_THIRD_TEAM, 2028);

		assertThat(answer(THE_TEAM, fromTheThird, answered(true), ME).getStatus()).isEqualTo(404);
		assertThat(invitationStands(fromTheThird)).isTrue();
		assertThat(membershipsOf(ME)).isEmpty();
	}

	@Test
	void aMemberWhoseFeeHasLapsedAnswersNothing() throws Exception {
		long his = invitationTo(LAPSED, THE_TEAM, 2028);

		assertThat(answer(THE_TEAM, his, answered(true), LAPSED).getStatus()).isEqualTo(404);
		assertThat(invitationStands(his)).isTrue();
	}

	@Test
	void aBodyThatNamesNoAnswerAnswersNothing() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);

		MockHttpServletResponse answer = answer(THE_TEAM, invitation, answered(null), ME);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(TeamJoiningWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(invitationStands(invitation)).isTrue();
	}

	@Test
	void anAccountNamingNoMemberAnswersNothing() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);

		assertThat(http.perform(put("/api/teams/{id}/invitations/{invitation}", keyOf(THE_TEAM),
								invitation).with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(answered(true))
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret())))
				.andReturn().getResponse().getStatus())
				.isEqualTo(404);
	}

	@Test
	void nobodySignedInAnswersAnything() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);

		assertThat(send(put("/api/teams/{id}/invitations/{invitation}", keyOf(THE_TEAM), invitation)
				.contentType(MediaType.APPLICATION_JSON).content(answered(true)), null).getStatus())
				.isEqualTo(401);
	}

	/* ------------------------------------------------- taking an invitation back */

	/**
	 * THE TEAM TAKES ITS OWN QUESTION BACK, AND ONLY WHOEVER LEADS IT MAY.
	 *
	 * <p><b>Owner, 27.09.2026: „Hoću da može da povuče poziv."</b> That it is the
	 * administrator's alone is PDL.md ("Povlacenje poziva takodje sme samo administrator"),
	 * marked in the journal as derived from the
	 * decision above rather than as a sentence of his: the right to take a question back follows
	 * the right to send it.
	 *
	 * <p><b>This case USED TO RUN TWICE and demanded 204 from a plain member as well.</b> Turned
	 * round rather than deleted: that run is now
	 * {@link #aMemberOfTheTeamWhoDoesNotLeadItTakesNothingBack}.
	 *
	 * <p>The invited member keeps the message, and the SECOND invitation to him is left
	 * standing, so „the row named" is told from „every invitation he has".
	 */
	@Test
	void whoeverLeadsTheTeamTakesItsInvitationBackAndTheMessageStays() throws Exception {
		String as = LEADER;
		long invitation = invitationTo(ME, THE_TEAM, 2028);
		long asked = messageCarrying(ME, invitation);
		long fromTheThird = invitationTo(ME, A_THIRD_TEAM, 2028);
		long before = howManyMessages();

		assertThat(takeBack(THE_TEAM, invitation, as).getStatus()).isEqualTo(204);

		assertThat(invitationStands(invitation)).isFalse();
		assertThat(invitationStands(fromTheThird)).as("another team's question is left alone")
				.isTrue();
		assertThat(messageStands(asked)).isTrue();
		assertThat(pointerOf(asked)).isNull();
		assertThat(howManyMessages())
				.as("no sentence exists for an invitation taken back")
				.isEqualTo(before);
		assertThat(membershipsOf(ME)).isEmpty();
	}

	/**
	 * AND THE WHOLE POINT OF IT: AFTER TAKING IT BACK THE TEAM MAY ASK HIM AGAIN.
	 *
	 * <p>{@code team_invitation_sent_once} is over {@code (team_id, competitor_id, season)} and
	 * both questions are for 2028, so a withdrawal that left the row behind - or one that
	 * emptied the pointer and stopped there - would meet that key on the second question and
	 * answer 500. This is the case that says the function does what it was asked for.
	 */
	@Test
	void afterTakingItBackTheSameTeamAsksTheSameManAgain() throws Exception {
		long first = invitationTo(ME, THE_TEAM, 2028);
		messageCarrying(ME, first);

		assertThat(takeBack(THE_TEAM, first, LEADER).getStatus()).isEqualTo(204);

		MockHttpServletResponse again = invite(THE_TEAM, asking(ME), LEADER);

		assertThat(again.getStatus()).isEqualTo(201);
		assertThat(mapper.readTree(again.getContentAsString()).path("id").asLong())
				.as("a second question and not the one that was taken back")
				.isNotEqualTo(first);
	}

	/** It writes nothing about a squad, so it is not bound by the window. */
	@Test
	void aTeamTakesItsInvitationBackOutsideTheWindowToo() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);
		clock.moveTo(OUTSIDE_THE_WINDOW);

		assertThat(takeBack(THE_TEAM, invitation, LEADER).getStatus()).isEqualTo(204);
		assertThat(invitationStands(invitation)).isFalse();
	}

	/**
	 * THE INVITED MEMBER DOES NOT TAKE IT BACK, HE REFUSES IT, and the two are told apart by
	 * who may cause them rather than by the row that is missing afterwards.
	 */
	@Test
	void theInvitedMemberDoesNotTakeTheInvitationBack() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);

		assertThat(takeBack(THE_TEAM, invitation, ME).getStatus()).isEqualTo(404);
		assertThat(invitationStands(invitation)).isTrue();
	}

	/**
	 * AND A MEMBER OF THE TEAM WHO DOES NOT LEAD IT TAKES NOTHING BACK, which is
	 * PDL.md ("Povlacenje poziva takodje sme samo administrator") and the half of the old
	 * case that demanded 204.
	 *
	 * <p>Both non-administrators are asked, for the reason {@link #ANOTHER_PLAIN} gives, and the
	 * message is asserted to KEEP its pointer: a refused request must leave the question a
	 * question, which is the half a status code alone would not say.
	 *
	 * @param as a member standing in {@link #THE_TEAM} who is not the one who leads it
	 */
	@ParameterizedTest
	@ValueSource(strings = { PLAIN, ANOTHER_PLAIN })
	void aMemberOfTheTeamWhoDoesNotLeadItTakesNothingBack(String as) throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);
		long asked = messageCarrying(ME, invitation);

		assertThat(takeBack(THE_TEAM, invitation, as).getStatus()).isEqualTo(404);

		assertThat(invitationStands(invitation)).isTrue();
		assertThat(pointerOf(asked))
				.as("a refused request must leave the question a question")
				.isEqualTo(invitation);
	}

	@Test
	void aMemberOfAnotherTeamTakesNothingBack() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);

		assertThat(takeBack(THE_TEAM, invitation, OUTSIDER).getStatus()).isEqualTo(404);
		assertThat(invitationStands(invitation)).isTrue();
	}

	@Test
	void theTeamInThePathMustNameTheInvitationBeingTakenBack() throws Exception {
		long fromTheThird = invitationTo(ME, A_THIRD_TEAM, 2028);

		assertThat(takeBack(THE_TEAM, fromTheThird, LEADER).getStatus()).isEqualTo(404);
		assertThat(invitationStands(fromTheThird)).isTrue();
	}

	@Test
	void anAccountNamingNoMemberTakesNoInvitationBack() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);

		assertThat(http.perform(delete("/api/teams/{id}/invitations/{invitation}", keyOf(THE_TEAM),
								invitation).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret())))
				.andReturn().getResponse().getStatus())
				.isEqualTo(404);
		assertThat(invitationStands(invitation)).isTrue();
	}

	@Test
	void nobodySignedInTakesAnyInvitationBack() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);

		assertThat(send(delete("/api/teams/{id}/invitations/{invitation}", keyOf(THE_TEAM),
				invitation), null).getStatus()).isEqualTo(401);
	}

	/* ------------------------------------- what he is waiting on, read back */

	/**
	 * AN INVITATION HE CAN NO LONGER ACCEPT SAYS SO, AND A SHUT WINDOW IS NOT THAT.
	 *
	 * <p>This is PDL.md ("Poziv se ne pamti kao odgovoren") carried out on the reading
	 * side: „pravo na odgovor se
	 * računa u trenutku iscrtavanja". The two states the portal draws two different sentences
	 * for are separated here by the clock and by a membership, one axis at a time:
	 *
	 * <ul>
	 * <li>no team, window open - {@code overtaken} false, and he may accept;
	 * <li>no team, window shut - still false, because {@code teams.inviteWaits} („Poziv čeka")
	 * is a different sentence from {@code teams.inviteOvertaken}. <b>This is the half a
	 * condition carrying the window would get wrong for nine months of the year</b>;
	 * <li>a team, either day - true.
	 * </ul>
	 *
	 * @param when     the moment the answer is read at
	 * @param hasATeam whether a membership of his stands in the way by then
	 */
	@ParameterizedTest
	@CsvSource({ "inside,false,false", "outside,false,false", "inside,true,true",
			"outside,true,true" })
	void theAnswerSaysWhetherAnInvitationMayStillBeAcceptedAndTheWindowIsNotWhatDecides(String when,
			boolean hasATeam, boolean alreadyInATeam) throws Exception {

		invitationTo(ME, THE_TEAM, 2028);
		invitationTo(ME, A_THIRD_TEAM, 2028);

		if (hasATeam) {
			inATeam(ME, A_FIRST_TEAM, 2028);
		}

		clock.moveTo("inside".equals(when) ? INSIDE_THE_WINDOW : OUTSIDE_THE_WINDOW);

		JsonNode waiting = mapper.readTree(http.perform(get("/api/me/applications")
				.cookie(cookieOf(ME))).andReturn().getResponse().getContentAsString());

		assertThat(waiting.path("teamInvitations").size())
				.as("both of his invitations come back whichever way this reads")
				.isEqualTo(2);

		assertThat(waiting.path("alreadyInATeam").asBoolean())
				.as("read on a day the window is %s, with a team: %s", when, hasATeam)
				.isEqualTo(alreadyInATeam);
	}

	/**
	 * AND THE ROUTE THAT REFUSES AN ACCEPTANCE AND THE FIELD THAT REPORTS IT CANNOT COME
	 * APART, because they ask one object.
	 *
	 * <p>Without this the screen could offer a button the server refuses, or hide one it would
	 * have taken. Both halves are read over one fixture and one moment, which is the shape
	 * {@code PairWriteApiTest.theReaderAndThisRouteAgreeOnWhichPairsStillHold} already holds.
	 */
	@Test
	void theFieldAndTheRefusalAgreeOverOneFixture() throws Exception {
		long invitation = invitationTo(ME, THE_TEAM, 2028);
		inATeam(ME, A_THIRD_TEAM, 2028);

		JsonNode waiting = mapper.readTree(http.perform(get("/api/me/applications")
				.cookie(cookieOf(ME))).andReturn().getResponse().getContentAsString());

		assertThat(waiting.path("alreadyInATeam").asBoolean()).isTrue();
		assertThat(reasonIn(answer(THE_TEAM, invitation, answered(true), ME)))
				.isEqualTo(TeamJoiningWriteApi.HE_IS_ALREADY_IN_A_TEAM);
	}

	/* ------------------------------------------------------------ the dictionary */

	/**
	 * EVERY SENTENCE THIS CLASS WRITES IS THE PORTAL'S OWN, TIED TO THE DICTIONARY BY A CASE
	 * AND NOT BY A COMMENT.
	 *
	 * <p>Two homes for one Serbian sentence and nothing between them is how the server and the
	 * screen drift apart, and a member then reads one thing in his inbox and another on the
	 * screen about one act. The substitution is the dictionary's own convention - the portal
	 * writes {@code {team}} and its {@code t()} replaces it - which is why this reads the
	 * template and fills it in rather than comparing prose.
	 *
	 * <p>The shape is {@code PairWriteApiTest.theTwoSentencesAreThePortalsOwnWords}, and the
	 * path is this package's own way of reaching the other half of the repository.
	 */
	@Test
	void theSentencesAreThePortalsOwnWords() {
		JsonNode teams = theDictionary().get("teams");
		String team = "Sava Runners";
		String name = "Petar Petrović";

		assertThat(filled(teams, "joinDoneSubject", team, name))
				.isEqualTo(TeamJoiningWriteApi.heIsInTheTeamReads(team));
		assertThat(filled(teams, "joinDoneBody", team, name))
				.isEqualTo(TeamJoiningWriteApi.theSeasonHeRunsFromReads(team));
		assertThat(filled(teams, "joinNoSubject", team, name))
				.isEqualTo(TeamJoiningWriteApi.theApplicationWasRefusedReads(team));
		assertThat(filled(teams, "joinNoBody", team, name))
				.isEqualTo(TeamJoiningWriteApi.theRefusalReads(team));
		assertThat(filled(teams, "inviteSubject", team, name))
				.isEqualTo(TeamJoiningWriteApi.theInvitationReads(team));
		assertThat(filled(teams, "inviteBody", team, name))
				.isEqualTo(TeamJoiningWriteApi.theInvitationBodyReads(team));
		assertThat(filled(teams, "inviteMissedSubject", team, name))
				.isEqualTo(TeamJoiningWriteApi.THE_INVITATION_WAS_MISSED);
		assertThat(filled(teams, "inviteMissedBody", team, name))
				.isEqualTo(TeamJoiningWriteApi.theMissedInvitationReads(name, team));

		assertThat(theDictionary().get("app").get("name").stringValue())
				.as("the portal signs its own message with a name it calls itself elsewhere")
				.isEqualTo(PairWriteApi.THE_LEAGUE);
	}

	private static String filled(JsonNode teams, String key, String team, String name) {
		return teams.get(key).stringValue().replace("{team}", team).replace("{name}", name);
	}

	/**
	 * The portal's dictionary, read off the working tree rather than described, and never
	 * skipped when it is not there: a floor that steps aside when it cannot find its source
	 * goes quiet on exactly the day the dictionary moved.
	 */
	private static JsonNode theDictionary() {
		Path source = Path.of("..", "frontend", "src", "i18n", "sr.json");

		assertThat(Files.isRegularFile(source)).as("dictionary %s", source.toAbsolutePath()).isTrue();

		return new ObjectMapper().readTree(source);
	}

	/**
	 * AND THE KEY A MEMBER IS NAMED BY NEVER LEAVES THROUGH THESE ROUTES.
	 *
	 * <p>Every answer here names a member by {@code member_number} and a team by its own key,
	 * which is what the rest of this package already does ({@link PairApi},
	 * {@link MyApplicationsApi}). This reads the one answer that names a person and requires
	 * it to be the number rather than the row key, so a route handing back
	 * {@code competitor.id} fails here rather than in a screen.
	 */
	@Test
	void theAnswerNamesAMemberByHisNumberAndNeverByHisKey() throws Exception {
		MockHttpServletResponse answer = invite(THE_TEAM, asking(ME), LEADER);

		assertThat(mapper.readTree(answer.getContentAsString()).path("memberNumber").stringValue())
				.isEqualTo(ME)
				.isNotEqualTo(String.valueOf(keyOfMember(ME)));
	}
}
