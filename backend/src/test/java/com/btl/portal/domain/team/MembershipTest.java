package com.btl.portal.domain.team;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** How long somebody was in a team, and what is not a membership at all. */
class MembershipTest {

	private static final long A_TEAM = 7L;

	/**
	 * Both ends belong to the membership, and the last season is the last one he is
	 * IN.
	 *
	 * <p>Not the first he is out of, which is the other way a range of seasons can
	 * be written and the way that would put somebody in a team for a season he
	 * left. The row for 2028 against a membership ending in 2028 is the one that
	 * separates the two readings.
	 */
	@ParameterizedTest(name = "{0} to {1} covers {2}: {3}")
	@CsvSource({
			"2027, 2028, 2026, false",
			"2027, 2028, 2027, true",
			"2027, 2028, 2028, true",
			"2027, 2028, 2029, false",
			"2027, 2027, 2027, true",
	})
	void bothEndsBelongToTheMembership(int from, int to, int season, boolean covers) {
		assertThat(new Membership(A_TEAM, from, to, "presao").covers(season)).isEqualTo(covers);
	}

	/** And an open membership has no far end, so every season from its first one is
	 *  inside it. */
	@Test
	void anOpenMembershipRunsOn() {
		Membership still = Membership.open(A_TEAM, 2027);

		assertThat(still.isOpen()).isTrue();
		assertThat(still.covers(2026)).isFalse();
		assertThat(still.covers(2027)).isTrue();
		assertThat(still.covers(2099))
				.as("an open membership stopped somewhere, and it has nowhere to stop")
				.isTrue();
	}

	/**
	 * Leaving is a season and a reason together.
	 *
	 * <p>One without the other is a row saying he left and will not say when, or
	 * that he is still in and left for a reason.
	 * {@code team_membership_leaving_says_why} refuses both in the schema; refused
	 * here as well, because this type does not have to come from the schema.
	 */
	@Test
	void leavingIsASeasonAndAReasonTogether() {
		assertThatThrownBy(() -> new Membership(A_TEAM, 2027, 2028, null))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("one without the other");
		assertThatThrownBy(() -> new Membership(A_TEAM, 2027, null, "presao"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("one without the other");
		assertThatThrownBy(() -> new Membership(A_TEAM, 2027, 2028, "  "))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("a reason nobody wrote");
	}

	/** And ending one keeps the two halves together, which is the whole reason it
	 *  is named rather than built by hand. */
	@Test
	void endingAMembershipKeepsBothHalvesTogether() {
		Membership ended = Membership.open(A_TEAM, 2027).ended(2028, "raspao se tim");

		assertThat(ended.isOpen()).isFalse();
		assertThat(ended.seasonTo()).isEqualTo(2028);
		assertThat(ended.leftReason()).isEqualTo("raspao se tim");
		assertThat(ended.teamId()).as("ending a membership moved it to another team").isEqualTo(A_TEAM);
		assertThat(ended.seasonFrom()).isEqualTo(2027);

		assertThatThrownBy(() -> Membership.open(A_TEAM, 2027).ended(2028, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("why");
	}

	@Test
	void nobodyLeftATeamBeforeJoiningIt() {
		assertThatThrownBy(() -> new Membership(A_TEAM, 2028, 2027, "presao"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("before joining");
	}

	@Test
	void theLeagueHasNoSeasonBeforeItsFirst() {
		assertThat(Membership.open(A_TEAM, Membership.FIRST_SEASON).seasonFrom())
				.isEqualTo(Membership.FIRST_SEASON);

		assertThatThrownBy(() -> Membership.open(A_TEAM, Membership.FIRST_SEASON - 1))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("no season 2026");
	}
}
