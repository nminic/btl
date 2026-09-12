package com.btl.portal.domain.team;

import com.btl.portal.domain.season.SeasonClock;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Objects;

/**
 * Whether somebody may join a team right now, and which season he would join.
 *
 * <p><b>Why this exists when the schema already refuses the bad row.</b>
 * {@code team_membership_one_team_at_a_time} is an exclusion constraint and it is
 * the last word: two memberships of one member whose season ranges touch cannot
 * both be written, whatever any service believes. What it cannot do is answer
 * BEFORE the row is written. A member pressing "join" is owed a sentence about
 * why not, and a constraint violation is not a sentence; it arrives after the
 * decision, in the language of the database, and it says nothing about the
 * transfer window at all.
 *
 * <p>So this answers the same question one moment earlier, and the schema stays
 * behind it. Where the two could disagree, the schema wins and the member sees
 * an error, which is the safe direction: this refusing something the schema
 * would have allowed costs a member one season in a team, and the other way
 * round costs the league a table nobody can explain.
 *
 * <p><b>Joining happens in the transfer window and is for the NEXT season.</b>
 * A team founded during a season stands in the table of new teams below the
 * standings, "tek toliko da neko može da se prijavi u njega za narednu godinu u
 * prelaznom roku" (owner). Which season that is is not decided here: it is
 * {@link SeasonClock#seasonBeingPaidFor}, so the season somebody joins for is the
 * same NUMBER the membership fee would be bought for.
 *
 * <p><b>That is a number, not a check.</b> This says nothing about whether the
 * member has paid, and cannot: it is handed a history of memberships and a
 * moment, and no fee appears in either. This sentence used to claim the
 * consequence - "so a member cannot be in a team for a season he has not paid" -
 * and a round on 12.09.2026 pointed out what that costs: a reader who believes it
 * never writes the check at the place where it belongs. Whether a member has paid
 * is the service layer's question, and it is still open.
 */
public final class JoiningATeam {

	/** Why somebody may not join, or that he may. */
	public enum Answer {

		/** He may, for the season {@link JoiningATeam#seasonHeWouldJoin} names. */
		YES,

		/** Outside the transfer window nobody moves, which is what a window is. */
		THE_WINDOW_IS_SHUT,

		/** He is already in a team for that season, and one team at a time is the rule. */
		ALREADY_IN_A_TEAM
	}

	private JoiningATeam() {
	}

	/** Which season he would be joining for, asked at that moment. */
	public static int seasonHeWouldJoin(ZonedDateTime at) {
		return SeasonClock.seasonBeingPaidFor(at);
	}

	/**
	 * Whether he may join, given every membership he has ever had.
	 *
	 * <p>All of them and not only the open one: a membership he ended LAST season
	 * does not stand in the way of next, and one somebody wrote ahead for a season
	 * still to come does. Asked with the whole history, the question is about the
	 * season rather than about today.
	 */
	public static Answer mayJoin(List<Membership> his, ZonedDateTime at) {
		Objects.requireNonNull(his, "his");
		Objects.requireNonNull(at, "at");

		if (!SeasonClock.transferWindowOpen(at)) {
			return Answer.THE_WINDOW_IS_SHUT;
		}

		int season = seasonHeWouldJoin(at);

		return his.stream().anyMatch(one -> one.standsInTheWayOfJoiningIn(season))
				? Answer.ALREADY_IN_A_TEAM
				: Answer.YES;
	}
}
