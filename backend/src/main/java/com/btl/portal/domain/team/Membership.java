package com.btl.portal.domain.team;

import com.btl.portal.domain.season.SeasonClock;

import java.util.Objects;

/**
 * How long somebody was in a team: from a season, and until one or still.
 *
 * <p>The seasons are inclusive at both ends, which is how the schema writes them:
 * {@code season_to} is the LAST season he is in, not the first he is out of. An
 * open membership has none.
 *
 * <p><b>Leaving is a season and a reason together.</b> One without the other is a
 * row saying he left and will not say when, or that he is still in and left for
 * a reason; {@code team_membership_leaving_says_why} refuses both in the schema
 * and so does this.
 *
 * @param seasonTo   the last season he is in it, or null while he still is
 * @param leftReason why he left, and only then
 */
public record Membership(long teamId, int seasonFrom, Integer seasonTo, String leftReason) {

	/**
	 * The first season the league has, and it is READ rather than repeated.
	 *
	 * <p>This carried its own 2027 until a round on 12.09.2026 moved
	 * {@link SeasonClock#FIRST_SEASON} to another year and measured what happened
	 * here: nothing. All ten cases stayed green while this class went on accepting a
	 * season the rest of the portal had stopped having. One fact, two homes, and the
	 * copy does not follow.
	 */
	public static final int FIRST_SEASON = SeasonClock.FIRST_SEASON;

	public Membership {
		if (seasonFrom < FIRST_SEASON) {
			throw new IllegalArgumentException("the league has no season " + seasonFrom);
		}

		if (seasonTo != null && seasonTo < seasonFrom) {
			throw new IllegalArgumentException("nobody left a team before joining it: " + seasonTo
					+ " is before " + seasonFrom);
		}

		if ((seasonTo == null) != (leftReason == null)) {
			throw new IllegalArgumentException(
					"leaving is a season and a reason together, and this has one without the other");
		}

		if (leftReason != null && leftReason.isBlank()) {
			throw new IllegalArgumentException("a reason nobody wrote is not a reason");
		}
	}

	/** Somebody who is still in the team, which is what an empty end means. */
	public static Membership open(long teamId, int seasonFrom) {
		return new Membership(teamId, seasonFrom, null, null);
	}

	/** Whether this membership is running in that season. */
	public boolean covers(int season) {
		return season >= seasonFrom && (seasonTo == null || season <= seasonTo);
	}

	/**
	 * Whether this membership stands in the way of a new OPEN one starting then.
	 *
	 * <p>Not the same question as {@link #covers}, and a round on 12.09.2026 showed
	 * why. Joining a team writes a membership with no end, so the schema sees the
	 * range from that season to the largest integer there is, and
	 * {@code team_membership_one_team_at_a_time} refuses anything that touches it.
	 * A membership written AHEAD - say for 2029, while somebody joins for 2028 -
	 * does not cover 2028 and does collide with it.
	 *
	 * <p>Asking the narrower question let this class answer yes where the database
	 * would then answer with a constraint violation, which is the one thing it
	 * exists to prevent. So the question is the schema's: does this end at or after
	 * the season the new one begins.
	 */
	public boolean standsInTheWayOfJoiningIn(int season) {
		return seasonTo == null || seasonTo >= season;
	}

	/** Whether he is still in the team. */
	public boolean isOpen() {
		return seasonTo == null;
	}

	/**
	 * The same membership, ended.
	 *
	 * <p>Named rather than built by hand at every call site, because the two halves
	 * of leaving belong together and the constructor is the only thing that would
	 * otherwise say so.
	 */
	public Membership ended(int season, String why) {
		Objects.requireNonNull(why, "why");

		return new Membership(teamId, seasonFrom, season, why);
	}
}
