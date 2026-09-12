package com.btl.portal.domain.pair;

import com.btl.portal.domain.ranking.Totals;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * What a pair did together, which is the only thing the board of pairs ranks.
 *
 * <p><b>The same RACE, not the same meeting</b> (PDL P12, owner): "Zajednička
 * trka za par znači ista trka, ne samo isti događaj. Ako on trči maraton a ona
 * polumaraton na istoj manifestaciji, to nije zajednička trka i ne ulazi u
 * poredak parova." A meeting with a marathon and a half is two races, and a
 * couple who ran one each ran nothing together.
 *
 * <p><b>The numbers are BOTH of them, and the count is the RACES.</b> Points,
 * kilometres, climbing and time on course are what the two of them did added
 * together; the count is how many races they shared, not how many results those
 * races produced, and results come two to a race. Counting results would put a
 * pair who ran four races together level with a runner who ran eight alone, on
 * a board whose whole subject is running together.
 */
public final class SharedRacing {

	private SharedRacing() {
	}

	/**
	 * Every race both of them ran, in the order his were given.
	 *
	 * <p>The order is his rather than either's or neither's, so the answer is the
	 * same list tomorrow: a set with no order would still add up to the same
	 * totals, but anything that ever shows a pair's races would shuffle them on
	 * every reading.
	 */
	public static List<Long> racesBothRan(List<RanRace> his, List<RanRace> hers) {
		Objects.requireNonNull(his, "his");
		Objects.requireNonNull(hers, "hers");

		Set<Long> hersById = new LinkedHashSet<>();

		for (RanRace one : hers) {
			hersById.add(one.raceId());
		}

		Set<Long> shared = new LinkedHashSet<>();

		for (RanRace one : his) {
			if (hersById.contains(one.raceId())) {
				shared.add(one.raceId());
			}
		}

		return List.copyOf(shared);
	}

	/**
	 * What the pair is ranked by: the two of them added up over the races they
	 * shared.
	 *
	 * <p>The count is put back by hand after the adding, and that line is the whole
	 * point of this method: {@link Totals#plus} counts races, so adding his race
	 * and her race on the SAME race gives two. The pair ran one.
	 */
	public static Totals together(List<RanRace> his, List<RanRace> hers) {
		List<Long> shared = racesBothRan(his, hers);

		Totals added = Totals.EMPTY;

		for (RanRace one : his) {
			if (shared.contains(one.raceId())) {
				added = added.plus(one.totals());
			}
		}

		for (RanRace one : hers) {
			if (shared.contains(one.raceId())) {
				added = added.plus(one.totals());
			}
		}

		return new Totals(shared.size(), added.kilometers(), added.ascent(), added.descent(),
				added.seconds(), added.points());
	}
}
