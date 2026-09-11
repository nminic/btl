package com.btl.portal.domain.ranking;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.function.ToLongFunction;

/**
 * Where somebody stands in the general standing of a season, and why.
 *
 * <p>The ladder is Pravilnik Član 49 and PDL P12, and its principle is one
 * sentence: volume is rewarded, efficiency never. Nothing on the portal hands a
 * place to whoever did less of something.
 *
 * <p><b>There is no shared place.</b> Places run 1, 2, 3 with nothing skipped
 * and nothing given twice (owner, 31.07.2026, confirmed 11.08.2026). Until then
 * two level rows shared a number and the next was skipped, so a shared first
 * place read 1, 1, 3 and the trophy was handed out twice. The ladder therefore
 * always ends somewhere, and its last rung is the member number: lower goes
 * ahead. That is not a way of ordering people by seniority but a way of making
 * sure the table and the list of awards can never disagree in public.
 */
public final class Standing {

	/**
	 * One rung of a ladder, named as the rulebook names it.
	 *
	 * <p>The phrase is Serbian because it is a QUOTATION: the rulebook is a page
	 * the portal publishes, and this is the text a reader sees on it. Holding it
	 * here is what lets {@code LaddersMatchTheRulebookTest} ask whether the two
	 * still say the same thing, instead of somebody remembering that they do.
	 *
	 * <p>Every rung is "more is better", which is the principle of Član 49 rather
	 * than a coincidence of these four: a rung where less wins would be a rung
	 * rewarding efficiency.
	 */
	public enum Rung {

		POINTS("bodovi", Totals::points, null),
		KILOMETERS("kilometri", Totals::kilometers, null),
		RACES("više trka", null, totals -> totals.races()),
		VERTICAL("više vertikale", null, Totals::vertical);

		private final String inTheRulebook;
		private final Comparator<Totals> moreFirst;

		Rung(String inTheRulebook, java.util.function.Function<Totals, java.math.BigDecimal> decimal,
				ToLongFunction<Totals> whole) {
			this.inTheRulebook = inTheRulebook;
			this.moreFirst = decimal != null
					? (left, right) -> decimal.apply(right).compareTo(decimal.apply(left))
					: (left, right) -> Long.compare(whole.applyAsLong(right), whole.applyAsLong(left));
		}

		/** The words the published rulebook uses for this rung. */
		public String inTheRulebook() {
			return inTheRulebook;
		}

		/** More of it first, which is what every rung of every ladder means. */
		public Comparator<Totals> moreFirst() {
			return moreFirst;
		}
	}

	/**
	 * The ladder of the general standing: points, kilometres, more races, more
	 * vertical, and then the member number, which {@link #places} adds.
	 *
	 * <p>Points carry two decimals and rarely tie on their own. When they do, the
	 * one with more kilometres wins, and so on down; time on course is a total
	 * this standing shows and never orders by, because ordering by it would seat
	 * whoever was slower over the same course ahead.
	 */
	public static final List<Rung> GENERAL = List.of(Rung.POINTS, Rung.KILOMETERS, Rung.RACES, Rung.VERTICAL);

	/**
	 * The rung every ladder in the rulebook ends on, and the reason none of them
	 * can end level.
	 *
	 * <p>It is not a {@link Rung} because it is not a measure of a season: it is
	 * what the row IS, and {@link #places} asks for it separately. Kept here so
	 * the floor over the rulebook can account for the whole published row rather
	 * than for all of it but the last word.
	 */
	public static final String LAST_RUNG_IN_THE_RULEBOOK = "niži članski broj";

	private Standing() {
	}

	/** The rungs one after another, each only consulted where the one above left
	 *  the two level. */
	public static Comparator<Totals> ladder(List<Rung> rungs) {
		Objects.requireNonNull(rungs, "rungs");

		if (rungs.isEmpty()) {
			throw new IllegalArgumentException("a ladder with no rungs orders nothing");
		}

		Comparator<Totals> built = rungs.get(0).moreFirst();

		for (Rung next : rungs.subList(1, rungs.size())) {
			built = built.thenComparing(next.moreFirst());
		}

		return built;
	}

	/**
	 * Numbers an ordered list 1, 2, 3, with nothing skipped and nothing given
	 * twice.
	 *
	 * <p>The rows are handed in unsorted and come back sorted: sorting them first
	 * by the same ladder is a second pass for the same answer. They are copied on
	 * the way, because a caller that still uses its own list would otherwise find
	 * it reordered underneath.
	 *
	 * <p><b>The last rung is a number, not a string.</b> „Niži članski broj"
	 * means the lower NUMBER, and a member number is six digits written with
	 * leading zeros. Compared as text that works only for as long as every one of
	 * them is exactly six characters wide; the day one is written without its
	 * padding, "1000" sorts ahead of "999" and the table is wrong in a way nobody
	 * would look for. Asked for as a {@code long} the question cannot be got
	 * wrong, and the same rung serves the two ladders whose last word is not a
	 * member number at all: a team's own identifier, and a pair's sum of two.
	 *
	 * @param lastRung what the row is, one row one value and the same value
	 *                 tomorrow, which is all a last rung has to do
	 */
	public static <T> List<Placed<T>> places(Collection<T> rows, Comparator<T> ladder, ToLongFunction<T> lastRung) {
		Objects.requireNonNull(rows, "rows");
		Objects.requireNonNull(ladder, "ladder");
		Objects.requireNonNull(lastRung, "lastRung");

		List<T> ordered = new ArrayList<>(rows);
		ordered.sort(ladder.thenComparing(
				(left, right) -> Long.compare(lastRung.applyAsLong(left), lastRung.applyAsLong(right))));

		List<Placed<T>> placed = new ArrayList<>(ordered.size());

		for (int index = 0; index < ordered.size(); index++) {
			placed.add(new Placed<>(ordered.get(index), index + 1));
		}

		return List.copyOf(placed);
	}
}
