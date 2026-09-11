package com.btl.portal.domain.ranking;

import java.util.Objects;

/**
 * A row once it knows which place it holds.
 *
 * <p>The place is carried beside the row rather than written into it, because a
 * row has one set of totals and as many places as there are lists it appears on:
 * the same season makes somebody fourth in the general standing, first in his
 * age band, and nowhere at all on a board of ten.
 *
 * @param row      what was ranked, untouched
 * @param position 1 for the first, and never shared (owner, 31.07.2026)
 */
public record Placed<T>(T row, int position) {

	public Placed {
		Objects.requireNonNull(row, "row");

		if (position < 1) {
			throw new IllegalArgumentException("a place starts at 1, never at " + position);
		}
	}
}
