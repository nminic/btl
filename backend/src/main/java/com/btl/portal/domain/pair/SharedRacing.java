package com.btl.portal.domain.pair;

import com.btl.portal.domain.ranking.Totals;

import java.util.HashSet;
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
	 *
	 * <p><b>A race counts once for each of them, the first result given for it.</b>
	 * V65 ({@code result_one_per_member_on_a_race}) refuses a second result of one member on
	 * one race - the owner: "član ne može da ima dva rezultata na istoj trci" - so a list read
	 * from the database never holds the same race twice. V7 carried over one hundred and sixty
	 * five pairs that occurred twice, and this check is the defence for a list that does not
	 * come from there: it keeps a duplicate from putting kilometres and points on the board
	 * for a race {@link #racesBothRan} has already counted as one. Which of the two is kept is
	 * the order of the list it stands in, and nothing cleverer.
	 */
	public static Totals together(List<RanRace> his, List<RanRace> hers) {
		List<Long> shared = racesBothRan(his, hers);

		Totals added = Totals.EMPTY;

		for (List<RanRace> side : List.of(his, hers)) {
			Set<Long> alreadyAdded = new HashSet<>();

			for (RanRace one : side) {
				if (shared.contains(one.raceId()) && alreadyAdded.add(one.raceId())) {
					added = added.plus(one.totals());
				}
			}
		}

		return new Totals(shared.size(), added.kilometers(), added.ascent(), added.descent(),
				added.seconds(), added.points());
	}
}
