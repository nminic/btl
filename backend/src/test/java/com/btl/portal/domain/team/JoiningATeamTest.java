package com.btl.portal.domain.team;

import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.team.JoiningATeam.Answer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Whether somebody may join a team, and which season he would join. */
class JoiningATeamTest {

	/** Inside the window: October of 2027, so the season joined is 2028. */
	private static final ZonedDateTime IN_THE_WINDOW =
			ZonedDateTime.of(2027, 10, 25, 12, 0, 0, 0, SeasonClock.ZONE);

	/** Outside it: September of the same year, which is the season that is running. */
	private static final ZonedDateTime WINDOW_SHUT =
			ZonedDateTime.of(2027, 9, 30, 12, 0, 0, 0, SeasonClock.ZONE);

	private static final long A_TEAM = 7L;

	private static final long ANOTHER_TEAM = 9L;

	@Test
	void joiningIsForTheSeasonTheFeeIsBoughtFor() {
		assertThat(JoiningATeam.seasonHeWouldJoin(IN_THE_WINDOW))
				.as("the season joined is not the season paid for, so somebody is in a team he has not paid")
				.isEqualTo(SeasonClock.seasonBeingPaidFor(IN_THE_WINDOW))
				.isEqualTo(2028);
	}

	@Test
	void nobodyMovesWhileTheWindowIsShut() {
		assertThat(JoiningATeam.mayJoin(List.of(), WINDOW_SHUT)).isEqualTo(Answer.THE_WINDOW_IS_SHUT);
	}

	@Test
	void somebodyInNoTeamMayJoinWhileItIsOpen() {
		assertThat(JoiningATeam.mayJoin(List.of(), IN_THE_WINDOW)).isEqualTo(Answer.YES);
	}

	/**
	 * A membership that ENDS AT OR AFTER the season he would join stands in the way,
	 * and one that ended before it does not.
	 *
	 * <p><b>Ending at or after, not merely covering, and a round on 12.09.2026 is
	 * why.</b> Joining writes a membership with no end, so the schema sees the range
	 * from that season to the largest integer there is and
	 * {@code team_membership_one_team_at_a_time} refuses anything that touches it.
	 * The last row is the one that showed it: a membership written AHEAD for 2029,
	 * while somebody joins for 2028, does not COVER 2028 and does collide with it.
	 * This class answered yes and the database would then have answered with a
	 * constraint violation - the one thing it exists to prevent.
	 *
	 * <p>The five rows are the shapes a history can take around one season: still in
	 * a team; left before it; left during it; left in it; and written ahead of it.
	 * The last three are what a rule looking only at "is he in a team today" gets
	 * wrong, and they are why the whole history is asked for.
	 */
	@ParameterizedTest(name = "{0} to {1}: {2}")
	@CsvSource({
			"2027, , ALREADY_IN_A_TEAM",
			"2027, 2027, YES",
			"2027, 2028, ALREADY_IN_A_TEAM",
			"2028, 2028, ALREADY_IN_A_TEAM",
			"2029, 2029, ALREADY_IN_A_TEAM",
	})
	void aMembershipEndingAtOrAfterThatSeasonStandsInTheWay(int from, Integer to, Answer expected) {
		Membership his = to == null
				? Membership.open(A_TEAM, from)
				: new Membership(A_TEAM, from, to, "presao u drugi tim");

		assertThat(JoiningATeam.mayJoin(List.of(his), IN_THE_WINDOW)).isEqualTo(expected);
	}

	/**
	 * And a membership that ended BEFORE that season stands in the way of nothing.
	 *
	 * <p>The other side of the table above: widening the question from "covers" to
	 * "ends at or after" must not widen it into refusing everybody who was ever in
	 * a team.
	 */
	@Test
	void aMembershipThatEndedBeforeThatSeasonStandsInTheWayOfNothing() {
		assertThat(JoiningATeam.mayJoin(
				List.of(new Membership(A_TEAM, 2027, 2027, "raspao se tim")), IN_THE_WINDOW))
				.as("a membership over and done with kept somebody out of a team")
				.isEqualTo(Answer.YES);
	}

	/**
	 * And it is asked of EVERY membership, not of the first.
	 *
	 * <p>The one in the way is second on the list and the harmless one is first, so
	 * a version looking at one membership answers YES. Written the other way round
	 * the case would pass whether the rest of the list were read or not.
	 */
	@Test
	void everyMembershipIsAskedAndNotTheFirst() {
		List<Membership> his = List.of(
				new Membership(A_TEAM, 2027, 2027, "raspao se tim"),
				Membership.open(ANOTHER_TEAM, 2028));

		assertThat(JoiningATeam.mayJoin(his, IN_THE_WINDOW))
				.as("only the first membership was looked at, so a second team went unnoticed")
				.isEqualTo(Answer.ALREADY_IN_A_TEAM);
	}

	/**
	 * The window is asked BEFORE the history, which is what the member is owed.
	 *
	 * <p>Somebody already in a team, asked in September, is told the window is shut
	 * rather than that he is in a team: the first is what he can do something
	 * about, in October, and the second would be true in every month of the year
	 * and tell him nothing.
	 */
	@Test
	void aShutWindowIsTheAnswerEvenToSomebodyAlreadyInATeam() {
		assertThat(JoiningATeam.mayJoin(List.of(Membership.open(A_TEAM, 2027)), WINDOW_SHUT))
				.isEqualTo(Answer.THE_WINDOW_IS_SHUT);
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> JoiningATeam.mayJoin(null, IN_THE_WINDOW))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("his");
		assertThatThrownBy(() -> JoiningATeam.mayJoin(List.of(), null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("at");
	}
}
