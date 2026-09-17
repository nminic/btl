package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;

/**
 * EVERYTHING THE ASKER IS WAITING TO HEAR BACK ABOUT, and only his own.
 *
 * <p><b>A route under {@code /api/me} and a class of its own, not a method on
 * {@link MeApi}.</b> This repository keeps one class per resource, and this is a
 * different resource from "who the portal thinks is asking": that one is read by
 * every request whether or not the screen wants it, and adding four joins to it
 * would be a cost every caller of {@code /api/me} pays for a question only one
 * screen asks.
 *
 * <p><b>FOUR TABLES, BECAUSE V11 AND V12 ALREADY SAY THEY ARE FOUR DIFFERENT
 * FACTS.</b> {@code PDL.md:2218}: "Ucanjenje ide u oba smera kroz portal: takmicar
 * salje administratoru tima zahtev na odobrenje, ili administrator salje
 * takmicaru poziv" - an application is a member offering himself, an invitation is
 * a team offering itself, and V12's own note says a single table with a direction
 * column would make every reader remember which way to look. A proposed team is a
 * third fact again (V11: naming a team that does not exist yet, or a change to one
 * that does), and a racing pair's open question is a fourth (V12: symmetric,
 * neither a member nor a team on either side). Four tables, four lists.
 *
 * <p><b>NOTHING HERE IS PUBLIC, AND THE REASON IS NARROWER THAN ARTICLE 73's.</b>
 * ADL P-javno, the owner, 13.09.2026: "javno je ono sto Clan 73 nabraja, i nista
 * vise. Sve ostalo ceka resurs koji zna ko pita." This is that resource: it does
 * not withhold a field because Clan 73 leaves it out, it withholds the WHOLE
 * ANSWER from everybody except the one competitor it is about, the same closedness
 * {@link CommentApi} and {@link AttendanceApi} have. So this route is absent from
 * {@link ApiSecurity#READ_BY_ANYBODY} - a visitor is refused 401 before this class
 * ever runs - and it carries no {@link RightIsNeeded} either, because reading what
 * you yourself are waiting on is not a moderator's action: every signed in
 * account may call it, a plain competitor included, which is why it stands beside
 * {@code /api/me} and {@code /api/attendance} in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}.
 *
 * <p><b>A MODERATOR WHO DOES NOT RACE GETS FOUR EMPTY LISTS, NOT A REFUSAL.</b>
 * V23 lets {@code account.competitor_id} be null - "the moderator who does not
 * race has no record in competitor at all, which is the ordinary case" - and
 * none of the four tables this class reads can ever name a competitor who does
 * not exist. There is nothing to wait on, and an empty answer says exactly that,
 * the same shape {@link ModeratorApi} and {@link VerificationApi} already use for
 * "nothing waiting": an empty list is not a broken record. This is not the 404
 * {@link VerificationApi} answers a moderator with no queue - that 404 hides the
 * EXISTENCE of an administrative screen from somebody who may not open it; this
 * route is open to every signed in account and the honest answer for one with no
 * racing record is that he is waiting on nothing.
 *
 * <p><b>TEAM APPLICATIONS AND INVITATIONS ARE READ BY EXISTENCE ALONE, WITH NO
 * STATE COLUMN TO FILTER ON, BECAUSE V12 SAYS THERE IS NONE ON PURPOSE.</b> "An
 * answer is not a column here: accepting an application writes a row in
 * {@code team_membership} and removes this one, refusing removes it... A state
 * column would be a second answer to 'is he in the team'." {@code PDL.md:6265} is
 * the product side of the same fact: "Ni prijava ni poziv ne idu u moderatorski
 * red za verifikaciju" - neither ever touches {@code verification} at all. So a
 * row in {@code team_application} or {@code team_invitation} naming this
 * competitor IS a waiting question; there is no third state to exclude and
 * nothing to join.
 *
 * <p><b>A TEAM PROPOSAL IS THE OPPOSITE CASE, AND CONFUSING THE TWO IS THE
 * MISTAKE THIS CLASS EXISTS TO NOT MAKE.</b> {@code team_proposal} carries no
 * state of its own either, but V11 queues every one of them through
 * {@code verification} with {@code queue = 'teams'}, and ADL A42 (11.09.2026)
 * decided that a decided {@code verification} row "stands for ever, approved and
 * refused alike... nothing here is deleted on a schedule." So a proposal that was
 * approved or refused WEEKS ago still has a row in {@code team_proposal} exactly
 * as it always did - nothing deletes it either way - and reading that table alone
 * would answer with every proposal this competitor has ever sent, resolved or
 * not. What actually says "still waiting" is {@code verification.state =
 * 'waiting'}, the identical column
 * {@link VerificationApi} filters on for the moderator's own side of the same
 * row, and this class joins to it for exactly that reason. Left out, this is the
 * one mutation named in this class's test that a merely-scrambled fixture cannot
 * catch by accident: it takes a proposal that has genuinely been decided, still
 * sitting in the table as V9 and A42 say it must.
 *
 * <p><b>A PAIR INVITATION IS ONE TABLE FOR BOTH DIRECTIONS, SO IT IS ONE LIST FOR
 * BOTH DIRECTIONS.</b> {@code pair_invite} has no "application" and "invitation"
 * split the way team membership does - V12: "svako sme da posalje zahtev
 * svakome" - one competitor asks another and either may have been the one who
 * asked. Both are genuinely waiting to be resolved from the asker's side: the one
 * who sent it is waiting for an answer, and the one who received it is waiting to
 * give one. Splitting it into two lists would invent a distinction the schema
 * does not draw; {@code sentByMe} says which one this row is without pretending
 * there are two tables.
 *
 * <p><b>AND {@code sentByMe} IS COMPUTED HERE RATHER THAN LEFT FOR THE CALLER TO
 * WORK OUT, BECAUSE THE CALLER HAS NOTHING TO WORK IT OUT WITH.</b> The mock
 * prototype's own {@code PairInvite} carries {@code from} and {@code to} as
 * member numbers and lets the screen compare them with its own, but that screen
 * reads its own number out of browser state that only exists because there is no
 * real sign in yet. {@link MeApi} answers a signed in account's role and id, and
 * says at length why it does not yet answer a member number: "nothing has asked
 * for it." This class would be the first caller that did, only to turn straight
 * around and compare it with one of two columns it already has open in the same
 * query - so the comparison is made once, in the query itself, and the caller is
 * simply told the answer instead of being handed the two halves to compare.
 *
 * <p><b>NOBODY'S INTERNAL ROW ID LEAVES EXCEPT THIS COMPETITOR'S OWN AND A
 * TEAM'S.</b> The other side of a pair invitation is a PERSON, and every other
 * resource in this package answers a person by {@code member_number} and never by
 * {@code competitor.id} ({@link PairApi}, {@link AttendanceApi},
 * {@link VerificationApi}); this class joins {@code pair_invite} back to
 * {@code competitor} for exactly that translation. A team is not a person and
 * this repository already answers it by its own {@code bigserial}
 * ({@link TeamApi}'s {@code id}), so {@code teamId} here is that same raw key and
 * the caller resolves the rest against the already-public {@code /api/teams}
 * rather than this class repeating a team's name, town or logo a second place.
 *
 * <p><b>WHOSE PROPOSAL COMES BACK NAMES ONLY THE TEAM AND THE PROPOSED NAME,
 * NEVER THE PROSE.</b> {@code team_proposal} also carries {@code bio}, {@code
 * link}, {@code city}, {@code country} and {@code logoId} - what the form asked
 * for - but nothing on this portal today shows a member their own waiting
 * proposal at all ({@code ProposeTeam.tsx}: "There is no list of what a member
 * has put forward... it says the team is not visible anywhere"). Serving the
 * full form back would be answering a screen that does not exist with fields
 * chosen by guessing what it might someday read; {@code name} is kept because it
 * is the one thing a NEW proposal cannot otherwise be told apart by (a fresh
 * proposal's {@code teamId} is null), and {@code teamId} is kept because an
 * EDIT's identity is nothing else. Nothing beyond those two is invented here.
 *
 * <p><b>ONE DECISION NAMED RATHER THAN SILENTLY COPIED: {@code PDL.md:6410}
 * ("Prijava clana koji je u medjuvremenu dobio tim se timu ne prikazuje") DOES
 * NOT REACH THIS CLASS, AND THE LINE RIGHT AFTER IT IS WHY.</b> That decision
 * hides a stale application from the TEAM'S queue, because a team admin accepting
 * it would pull the member out of a squad he has since joined without asking him
 * - a safeguard on the door the team's own future resource opens. {@code
 * PDL.md:6413} draws the boundary in as many words: "Prijava u oba slucaja ostaje
 * NJEGOVA DA JE POVUCE, pa i dalje ima kraj koji ne zavisi ni od koga drugog" -
 * the application stays HIS to withdraw either way, with an ending that depends
 * on nobody else. So the row is hidden from the team and left standing for the
 * applicant, which is exactly this resource's reader. A row in
 * {@code team_application} still naming this competitor is, in the plain sense
 * V12 gives the table, still a question nobody has answered - accepted, refused
 * and withdrawn all delete the row - so it is reported here whether or not he has
 * since joined somewhere else.
 *
 * <p><b>THE DAY IS THE DAY IN BELGRADE, read off each table's own timestamp the
 * way {@link VerificationApi} reads {@code raised_at} and {@link CommentApi}
 * reads {@code published_at}</b> - never the machine's own zone, and never
 * {@code current_date}.
 *
 * <p><b>EVERY LIST IS OLDEST FIRST, WITH THE KEY LAST SO THE ORDER IS TOTAL</b> -
 * the identical shape {@link VerificationApi}, {@link AttendanceApi} and
 * {@link PairApi} already settle their own lists by, so two rows raised in the
 * same instant still come back in one order and not in whatever order the table
 * happens to hold them.
 */
@RestController
class MyApplicationsApi {

	private final JdbcClient db;

	MyApplicationsApi(JdbcClient db) {
		this.db = db;
	}

	/** A team this competitor asked to join, waiting for the team to answer. */
	record TeamApplication(long id, long teamId, LocalDate date) {
	}

	/** A team asking this competitor to join, waiting for him to answer. */
	record TeamInvitation(long id, long teamId, LocalDate date) {
	}

	/**
	 * A team this competitor put forward, still standing in the moderator's queue.
	 *
	 * @param teamId null for a brand new team, which has no address yet; filled
	 *               for a proposed change to a team that already exists
	 */
	record TeamProposal(long id, Long teamId, String name, LocalDate date) {
	}

	/**
	 * An open question about racing together, from either side.
	 *
	 * @param memberNumber the OTHER competitor, never this one
	 * @param sentByMe      true where this competitor asked, false where he was asked
	 */
	record PairInvite(long id, String memberNumber, boolean sentByMe, LocalDate date) {
	}

	/** Everything this competitor is waiting to hear back about, in four parts. */
	record Waiting(List<TeamApplication> teamApplications, List<TeamInvitation> teamInvitations,
			List<TeamProposal> teamProposals, List<PairInvite> pairInvites) {
	}

	/**
	 * @param member never null here: the chain answers 401 before this method runs
	 *               (the same guarantee {@link MeApi} rests on), so there is no
	 *               branch for "nobody" and no case measuring one
	 */
	@GetMapping("/api/me/applications")
	Waiting applications(@AuthenticationPrincipal WhoIsAsking.Member member) {
		Long me = competitorIdOf(member.account());

		/* THE MODERATOR WHO DOES NOT RACE, see the class note: nothing in any of the
		   four tables can name a competitor who does not exist, so four empty lists
		   is the honest answer and not a placeholder for one this class chose not
		   to compute. */
		if (me == null) {
			return new Waiting(List.of(), List.of(), List.of(), List.of());
		}

		return new Waiting(teamApplications(me), teamInvitations(me), teamProposals(me), pairInvites(me));
	}

	/** V23: at most one member per account, and null for a moderator who has none. */
	private Long competitorIdOf(long account) {
		return db.sql("select competitor_id from account where id = ?").param(account)
				.query(Long.class).optional().orElse(null);
	}

	private List<TeamApplication> teamApplications(long me) {
		return db.sql("select id, team_id, asked_at from team_application"
						+ " where competitor_id = ?"
						+ " order by asked_at, id")
				.param(me)
				.query((row, n) -> new TeamApplication(row.getLong(1), row.getLong(2),
						belgradeDayOf(row.getTimestamp(3))))
				.list();
	}

	private List<TeamInvitation> teamInvitations(long me) {
		return db.sql("select id, team_id, sent_at from team_invitation"
						+ " where competitor_id = ?"
						+ " order by sent_at, id")
				.param(me)
				.query((row, n) -> new TeamInvitation(row.getLong(1), row.getLong(2),
						belgradeDayOf(row.getTimestamp(3))))
				.list();
	}

	private List<TeamProposal> teamProposals(long me) {
		return db.sql("select tp.id, tp.team_id, tp.name, v.raised_at"
						+ " from team_proposal tp"
						/* INNER, on purpose: V11 queues every proposal through verification with
						   `queue = 'teams'`, and a proposal with no queue row is not a state this
						   schema is written to produce. Left as an inner join, a proposal that
						   somehow arrived without one is left out rather than reported as waiting
						   with no day to report. */
						+ " join verification v on v.team_proposal_id = tp.id"
						+ " where tp.competitor_id = ?"
						/* ADL A42: a decided row stands for ever, so without this a proposal
						   settled months ago would answer as waiting for ever too. */
						+ " and v.state = 'waiting'"
						+ " order by v.raised_at, tp.id")
				.param(me)
				.query((row, n) -> new TeamProposal(row.getLong(1), row.getObject(2, Long.class),
						row.getString(3), belgradeDayOf(row.getTimestamp(4))))
				.list();
	}

	private List<PairInvite> pairInvites(long me) {
		return db.sql("select pi.id, pi.sent_at,"
						/* THE OTHER ONE, whichever side this competitor stands on - AND ONLY
						   WHILE HE IS STILL A MEMBER. The inner CASE is the sixth place this
						   portal answers one question, and it answers it the way the other five
						   do: `CompetitorApi` with `where c.active`, `AttendanceApi` with
						   `and c.active`, `PairApi` with `where man.active and woman.active`,
						   `CommentApi` with this very shape - `case when author.active then
						   author.member_number end`.

						   Why it is not merely tidy: `/api/competitors` stops carrying a member
						   the day his fee lapses, so a number that is HERE and missing THERE is
						   the difference between two answers, and that difference says he did
						   not renew. Article 74 shuts everything about the fee, and the owner,
						   13.09.2026: „Kad je sporno, polje se IZOSTAVLJA i izostavljanje se
						   imenuje sa razlogom." The invite row itself stays - it is his own, and
						   he is the one who withdraws it - but the person behind it stops being
						   named. */
						+ " case when (case when pi.from_id = :me then to_c.active else from_c.active end)"
						+ "      then (case when pi.from_id = :me then to_c.member_number else from_c.member_number end)"
						+ " end,"
						+ " pi.from_id = :me"
						+ " from pair_invite pi"
						+ " join competitor from_c on from_c.id = pi.from_id"
						+ " join competitor to_c on to_c.id = pi.to_id"
						/* BOTH DIRECTIONS: he is waiting for an answer on one he sent, and owes
						   an answer on one he received. Neither is the exclusive case. */
						+ " where pi.from_id = :me or pi.to_id = :me"
						+ " order by pi.sent_at, pi.id")
				.param("me", me)
				.query((row, n) -> new PairInvite(row.getLong(1), row.getString(3), row.getBoolean(4),
						belgradeDayOf(row.getTimestamp(2))))
				.list();
	}

	/**
	 * The calendar day a technical instant falls on in the league's own zone, the
	 * shape {@link VerificationApi} reads {@code raised_at} by and {@link CommentApi}
	 * reads {@code published_at} by, for the identical reason: a server kept in UTC
	 * is still living in yesterday for the first hours of a Belgrade day.
	 */
	private static LocalDate belgradeDayOf(Timestamp at) {
		return at.toInstant().atZone(SeasonClock.ZONE).toLocalDate();
	}
}
