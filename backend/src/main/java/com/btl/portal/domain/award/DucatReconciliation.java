package com.btl.portal.domain.award;

import com.btl.portal.domain.award.DucatInstances.Family;
import com.btl.portal.domain.award.DucatInstances.Instance;
import com.btl.portal.domain.award.DucatInstances.Period;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * WHICH DUCATS ONE MEMBER SHOULD HOLD, GIVEN WHAT HE HOLDS: what is missing, what is too much, and which
 * row that stays has to be told again which race carried it over.
 *
 * <p><b>The owner, 08.11.2026</b> (PDL, „[ODLUKE 08.11.2026, vlasnik, plan „Dukate dodeljuje verifikacija
 * rezultata”"): „Pri brisanju ili ispravci odlučuje uslov, ne pojedinačni rezultat: „10 maratona” se
 * oduzima kad ih ostane 9, i ostaje kad se obriše baš deseti a kasnije trke ga i dalje drže na 10 (tada
 * se dan trke tiho prepisuje, a ne prikazuje se nigde)." So a row is never judged by the result it points
 * at. It is measured again, every time, against the condition it carries.
 *
 * <p><b>Against ITS OWN snapshot, never today's definition.</b> PDL: „Naknadna izmena uslova ne skida već
 * dodeljene dukate", and ADL A12: „izmena definicije ne dira već dodeljene". A row carries the kind, the
 * threshold and the period it was won under (V15, A36 O13), and those are what it is measured by. A
 * threshold the definition no longer has is a different instance (the threshold is part of
 * {@code ducat_award_won_once}), so the instance of today's definition is written beside it when it is
 * met, and the old row stays for as long as its own condition holds.
 *
 * <p><b>The year he was not a member.</b> The owner, 08.11.2026: „Član bez prava rangiranja dobija i
 * mesečni i sezonski dukat; u godini u kojoj nije bio član dobija samo trajne dukate, kao istorija pre
 * 2027." A ducat of a month or a season is met only in a season he holds a membership of, whatever the
 * right to rank says, and that is the same test for a row he already holds: a membership cancelled for a
 * season that has not frozen takes that season's ducats with it (derived by the coordinator from that
 * sentence and „Stornirana uplata: … član postaje neaktivan za tu sezonu").
 *
 * <p><b>THE FROZEN SEASON IS NOT DECIDED HERE, and that is on purpose.</b> The owner: a monthly or
 * seasonal ducat of a frozen season is neither given nor taken away, „jer zamrznuta tabela taj rezultat i
 * dalje pokazuje". Whether a season has frozen is a row of {@code season_frozen}, and it is asked by the
 * very statement that writes, deletes or rewrites, so it has one home and the freshest answer the
 * database has. A plan made here may therefore name a row the statement then leaves alone.
 */
public final class DucatReconciliation {

	private static final int REACHED_DECIMALS = 2;

	private static final Comparator<Run> IN_THE_ORDER_THEY_WERE_RUN = Comparator
			.comparing((Run one) -> one.race().on()).thenComparingLong(Run::resultId);

	private DucatReconciliation() {
	}

	/** One result of his, and the race as the badge rules see it. */
	public record Run(long resultId, RaceDone race) {

		public Run {
			Objects.requireNonNull(race, "race");
		}
	}

	/**
	 * The result whose race carried him over the threshold for the first time, its day, and how much of
	 * the quantity he had once it had, in the two decimals {@code ducat_award.reached} keeps (rounded down,
	 * the direction {@link DucatKind#TOTAL_TIME} rounds in, so it is never written below the threshold).
	 */
	public record Crossing(long resultId, LocalDate on, BigDecimal reached) {
	}

	/** One row of {@code ducat_award} as it stands, snapshot and pointer. */
	public record Held(long id, long ducatId, DucatKind kind, BigDecimal threshold, Period period, Integer season,
			Integer month, Long resultId, LocalDate wonOn, BigDecimal reached) {

		Instance asInstance() {
			return new Instance(ducatId, "", kind, threshold, period, season, month, 1);
		}
	}

	/** An instance he meets and does not hold. */
	public record Award(Instance instance, Crossing crossing) {
	}

	/** A row that stays, and what its pointer, day and reach have to become. */
	public record Rewrite(long id, Crossing crossing) {
	}

	/** Everything the reconciliation of one member asks for. */
	public record Plan(List<Award> toWrite, List<Long> toTakeAway, List<Rewrite> toRewrite) {
	}

	/**
	 * The plan for one member.
	 *
	 * @param families      every family there is, in the order the rulebook lists them
	 * @param held          every row of his in {@code ducat_award}
	 * @param runs          every result of his, in any order
	 * @param seasonsHeld   the seasons he holds a membership of
	 * @param today         the day, in the league's zone, which decides which instances exist yet
	 */
	public static Plan of(List<Family> families, List<Held> held, List<Run> runs, Set<Integer> seasonsHeld,
			LocalDate today) {
		Map<Key, Held> byKey = new HashMap<>();

		for (Held one : held) {
			byKey.put(Key.of(one.asInstance()), one);
		}

		List<Award> toWrite = new ArrayList<>();

		for (Family family : families) {
			for (Instance instance : DucatInstances.existingBy(family, today)) {
				if (!byKey.containsKey(Key.of(instance))) {
					crossing(instance, seasonsHeld, runs).ifPresent(at -> toWrite.add(new Award(instance, at)));
				}
			}
		}

		List<Long> toTakeAway = new ArrayList<>();
		List<Rewrite> toRewrite = new ArrayList<>();

		for (Held one : held) {
			Optional<Crossing> now = crossing(one.asInstance(), seasonsHeld, runs);

			if (now.isEmpty()) {
				toTakeAway.add(one.id());
			}
			else if (!saysTheSame(one, now.get())) {
				toRewrite.add(new Rewrite(one.id(), now.get()));
			}
		}

		return new Plan(List.copyOf(toWrite), List.copyOf(toTakeAway), List.copyOf(toRewrite));
	}

	/**
	 * Where the instance's condition is met for the first time, in the order the races were run (the day
	 * of the race, then the result's key, so the road a verification takes and the job at night answer
	 * alike), or nothing when it is not met at all.
	 */
	public static Optional<Crossing> crossing(Instance instance, Set<Integer> seasonsHeld, List<Run> runs) {
		if (instance.period() != Period.ALWAYS && !seasonsHeld.contains(instance.season())) {
			return Optional.empty();
		}

		List<Run> inside = runs.stream()
				.filter(one -> one.race().inside(instance.from(), instance.to()))
				.sorted(IN_THE_ORDER_THEY_WERE_RUN)
				.toList();

		if (!instance.kind().reached(races(inside), instance.threshold())) {
			return Optional.empty();
		}

		/* Every one of the eleven quantities only grows as races are added (a count, a sum of numbers no
		   result may make negative, hours rounded down, and distinct countries), so "reached within the
		   first k" is false and then true, and the first k where it turns is found by halving. */
		int low = 1;
		int high = inside.size();

		while (low < high) {
			int middle = (low + high) >>> 1;

			if (instance.kind().reached(races(inside.subList(0, middle)), instance.threshold())) {
				high = middle;
			}
			else {
				low = middle + 1;
			}
		}

		Run carried = inside.get(low - 1);
		BigDecimal reached = instance.kind().over(races(inside.subList(0, low)))
				.setScale(REACHED_DECIMALS, RoundingMode.DOWN);

		return Optional.of(new Crossing(carried.resultId(), carried.race().on(), reached));
	}

	private static boolean saysTheSame(Held one, Crossing now) {
		return Objects.equals(one.resultId(), now.resultId()) && now.on().equals(one.wonOn())
				&& now.reached().compareTo(one.reached()) == 0;
	}

	private static List<RaceDone> races(List<Run> runs) {
		return runs.stream().map(Run::race).toList();
	}

	/**
	 * The four columns {@code ducat_award_won_once} keys a member's ducat by, besides the member. The
	 * threshold without its trailing zeros, because {@code 100} and {@code 100.00} are one threshold and
	 * two {@link BigDecimal}s.
	 */
	private record Key(long ducatId, BigDecimal threshold, Integer season, Integer month) {

		static Key of(Instance instance) {
			return new Key(instance.ducatId(), instance.threshold().stripTrailingZeros(), instance.season(),
					instance.month());
		}
	}
}
