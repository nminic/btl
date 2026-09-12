package com.btl.portal.domain.pair;

import com.btl.portal.domain.ranking.Totals;

import java.util.Objects;

/**
 * One race one member ran, kept beside the race it was.
 *
 * <p>The identity is what makes a pair a pair: two people are a pair on a race
 * only when it is the SAME race, and a race is what they entered rather than the
 * meeting it belonged to.
 *
 * @param totals what that one race was worth to him, so {@code races} is one
 */
public record RanRace(long raceId, Totals totals) {

	public RanRace {
		Objects.requireNonNull(totals, "totals");

		if (totals.races() != 1) {
			throw new IllegalArgumentException("one race is one race, and this is " + totals.races());
		}
	}
}
