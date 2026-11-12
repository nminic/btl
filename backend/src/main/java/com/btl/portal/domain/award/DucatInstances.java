package com.btl.portal.domain.award;

import com.btl.portal.domain.season.SeasonClock;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * EVERY DUCAT OF A FAMILY THAT EXISTS BY A GIVEN DAY: the periods that have begun, times the thresholds
 * of the run.
 *
 * <p>The server's copy of {@code instancesOf} and {@code tierOf} in {@code frontend/src/data/ducatRule.ts},
 * with the same two edges: a family that repeats by month or by season begins in the league's first
 * season ({@link SeasonClock#FIRST_SEASON}) and runs to the end of the month or the season the day falls
 * in, while a family that stands for ever has one instance per threshold and reads every race on a
 * profile, including the ones run before the league existed (PDL P16, „Petnaest ugrađenih porodica
 * primenjuje se i na uvezenu istoriju").
 *
 * <p>Worked out and never stored, for the reason the portal's file gives: the list grows by itself, two
 * ducats a month and four a season, and a table somebody fills in would lie about what can be won until
 * somebody remembered to type it (ADL A12, 7).
 */
public final class DucatInstances {

	private DucatInstances() {
	}

	/** The three shapes of time a family repeats through, as {@code ducat_period_known} (V15) names them. */
	public enum Period {

		MONTH("month"),
		SEASON("season"),
		ALWAYS("always");

		private final String code;

		Period(String code) {
			this.code = code;
		}

		/** What the schema calls it. */
		public String code() {
			return code;
		}

		/** The period known by that code. */
		public static Period named(String code) {
			for (Period period : values()) {
				if (period.code.equals(code)) {
					return period;
				}
			}

			throw new IllegalArgumentException("no ducat repeats by '" + code + "'");
		}
	}

	/**
	 * One family as the {@code ducat} table holds it (V15): the condition, what meeting it is worth, and
	 * the run of thresholds when there is one ({@code step} of nought means there is not).
	 */
	public record Family(long id, String code, DucatKind kind, BigDecimal threshold, Period period, int tier,
			BigDecimal step, BigDecimal last, BigDecimal tierUpFrom) {

		public Family {
			Objects.requireNonNull(code, "code");
			Objects.requireNonNull(kind, "kind");
			Objects.requireNonNull(threshold, "threshold");
			Objects.requireNonNull(period, "period");
			Objects.requireNonNull(step, "step");
			Objects.requireNonNull(last, "last");
			Objects.requireNonNull(tierUpFrom, "tierUpFrom");
		}
	}

	/**
	 * One ducat a member can hold. {@code season} is empty exactly for a family that stands for ever, and
	 * {@code month} (1 to 12, as {@code ducat_award.month} has it) exactly for one that repeats by month:
	 * the two checks {@code ducat_award_a_period_says_its_season} and
	 * {@code ducat_award_only_a_month_says_its_month} say the same.
	 */
	public record Instance(long ducatId, String code, DucatKind kind, BigDecimal threshold, Period period,
			Integer season, Integer month, int tier) {

		public Instance {
			Objects.requireNonNull(code, "code");
			Objects.requireNonNull(kind, "kind");
			Objects.requireNonNull(threshold, "threshold");
			Objects.requireNonNull(period, "period");
		}

		/** The first day the period counts a race on, or null when it is open. Both ends are inclusive. */
		public LocalDate from() {
			return switch (period) {
				case ALWAYS -> null;
				case SEASON -> LocalDate.of(season, 1, 1);
				case MONTH -> LocalDate.of(season, month, 1);
			};
		}

		/** The last day the period counts a race on, or null when it is open. */
		public LocalDate to() {
			return switch (period) {
				case ALWAYS -> null;
				case SEASON -> LocalDate.of(season, 12, 31);
				case MONTH -> YearMonth.of(season, month).atEndOfMonth();
			};
		}
	}

	/**
	 * Every instance of the family that exists on that day, in the order the portal lists them: period by
	 * period, and inside a period threshold by threshold.
	 */
	public static List<Instance> existingBy(Family family, LocalDate today) {
		Objects.requireNonNull(family, "family");
		Objects.requireNonNull(today, "today");

		List<BigDecimal> thresholds = thresholdsOf(family);
		List<Instance> out = new ArrayList<>();

		if (family.period() == Period.ALWAYS) {
			add(out, family, thresholds, null, null);

			return out;
		}

		for (int season = SeasonClock.FIRST_SEASON; season <= today.getYear(); season++) {
			if (family.period() == Period.SEASON) {
				add(out, family, thresholds, season, null);
				continue;
			}

			int until = season == today.getYear() ? today.getMonthValue() : 12;

			for (int month = 1; month <= until; month++) {
				add(out, family, thresholds, season, month);
			}
		}

		return out;
	}

	/**
	 * The value of one ducat of a family: the family's own, one higher from the threshold at which the
	 * owner said the run stops being ordinary (V15, {@code tier_up_from}), and the fifth is the top.
	 */
	public static int tierOf(Family family, BigDecimal value) {
		boolean higher = family.tierUpFrom().signum() > 0 && value.compareTo(family.tierUpFrom()) >= 0;

		return higher ? Math.min(family.tier() + 1, 5) : family.tier();
	}

	private static List<BigDecimal> thresholdsOf(Family family) {
		List<BigDecimal> thresholds = new ArrayList<>();

		if (family.step().signum() == 0) {
			thresholds.add(family.threshold());

			return thresholds;
		}

		for (BigDecimal value = family.threshold(); value.compareTo(family.last()) <= 0;
				value = value.add(family.step())) {
			thresholds.add(value);
		}

		return thresholds;
	}

	private static void add(List<Instance> out, Family family, List<BigDecimal> thresholds, Integer season,
			Integer month) {
		for (BigDecimal value : thresholds) {
			out.add(new Instance(family.id(), family.code(), family.kind(), value, family.period(), season, month,
					tierOf(family, value)));
		}
	}
}
