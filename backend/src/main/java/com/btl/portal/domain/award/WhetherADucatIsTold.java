package com.btl.portal.domain.award;

import com.btl.portal.domain.award.DucatInstances.Instance;
import com.btl.portal.domain.award.DucatReconciliation.Crossing;
import com.btl.portal.domain.award.DucatReconciliation.Run;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * WHETHER A DUCAT JUST WRITTEN IS TOLD TO HIM, OR WRITTEN IN SILENCE.
 *
 * <p><b>The owner, 12.11.2026</b>: „Tiho ostaje samo ono što dolazi iz rezultata odobrenih pre početka dodele.”
 * And „Svaka vrata javljaju”: an approval and the league's entry are told alike, so „odobren” below means either
 * (derived by the coordinator, PDL, 16.11.2026).
 *
 * <p><b>The owner, 16.11.2026</b>, chosen between the options offered: the ducats an import brings are „Potpuno
 * tiho”, and „Dukat se javlja samo ako je prag preveo odobren rezultat i nijedan uvezen rezultat među
 * prebrojanim nije stigao posle njega.” So a ducat is told when, and only when, all three hold:
 * <ol>
 * <li>the result that carried him over was approved or entered, not imported;
 * <li>it was brought in at or after the start of awarding, so not the history, which has no moment at all;
 * <li>no imported result among the ones counted up to it ({@link DucatReconciliation#counted}) was brought in
 * strictly after it. An import that came before the approval did not carry him over: the approval did, and it
 * is told. An import that came after it is what made the old races count, and it is silent.
 * </ol>
 *
 * <p>The frozen season is not asked here. A ducat of a month or a season of a frozen season is never written
 * (the statement that writes asks {@code season_frozen}), so there is nothing to tell or to keep silent.
 */
public final class WhetherADucatIsTold {

	private WhetherADucatIsTold() {
	}

	/**
	 * How one result came in: whether the import tool wrote it, and the moment, which the history has not.
	 *
	 * @param imported whether {@code result.brought_by} says {@code import}
	 * @param at       {@code result.brought_at}, empty for the history; an import always has one
	 *                 ({@code result_brought_at_and_by_together}, V97)
	 */
	public record Arrival(boolean imported, Instant at) {

		public Arrival {
			if (imported && at == null) {
				throw new IllegalArgumentException("an imported result always says when it was imported");
			}
		}
	}

	/**
	 * Whether the ducat of this instance, carried over at {@code crossing}, is told.
	 *
	 * @param runs           every result of his, the ones the crossing was found among
	 * @param arrivals       how each of them came in, by the result's key
	 * @param awardingBegan  the start of awarding, the moment before which nothing is told
	 */
	public static boolean told(Instance instance, Crossing crossing, List<Run> runs, Map<Long, Arrival> arrivals,
			Instant awardingBegan) {
		Arrival carried = arrivalOf(crossing.resultId(), arrivals);

		if (carried.imported() || carried.at() == null || carried.at().isBefore(awardingBegan)) {
			return false;
		}

		for (Run one : DucatReconciliation.counted(instance, crossing, runs)) {
			Arrival counted = arrivalOf(one.resultId(), arrivals);

			if (counted.imported() && counted.at().isAfter(carried.at())) {
				return false;
			}
		}

		return true;
	}

	private static Arrival arrivalOf(long resultId, Map<Long, Arrival> arrivals) {
		return Objects.requireNonNull(arrivals.get(resultId), () -> "how result " + resultId + " came in is not known");
	}
}
