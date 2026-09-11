package com.btl.portal.domain.award;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Objects;

/**
 * One race somebody has run, as the badge rules see it.
 *
 * <p>Not the same thing as a season's totals and deliberately not built out of
 * them: a badge asks questions a sum cannot answer. "A hundred marathons" needs
 * the length band of each race, "ten countries" needs where each one was, and
 * every badge with a period needs the day. A total has none of the three,
 * because a total is what is left after they have been added away.
 *
 * <p><b>The band is read and never worked out here.</b> {@code result.category}
 * is a generated column: the schema decides what counts as a marathon, at the
 * exact boundaries PDL P5 draws, and this carries its answer. Working it out
 * again in Java would be the same rule written twice, and the day somebody moved
 * a boundary the badges and the tables would disagree about the same race.
 *
 * @param on         the day of the RACE, never the day the result was entered
 *                   (ADL A12, 2c)
 * @param category   what the schema calls its length: short, half, long,
 *                   marathon, ultra
 * @param country    where it was run, or null when that is not known - an
 *                   unknown country counts towards nothing, because a badge once
 *                   given is never taken away (ADL A12, 4) and so the safe
 *                   direction is the only one
 * @param kilometers what that runner actually covered
 *
 * <p><b>There is no descent here, and that is not an oversight.</b> The schema's
 * codebook of badge quantities holds eleven and none of them is measured in
 * metres descended; a field nothing reads is a field that can be wrong for years
 * without anything noticing. The day a badge for descending is struck, it
 * arrives as a migration adding the quantity and a line adding the field, and
 * {@code AwardRulesMatchTheSchemaTest} is what asks for both.
 */
public record RaceDone(LocalDate on, String category, String country, BigDecimal kilometers, int ascent,
		long seconds, BigDecimal points) {

	public RaceDone {
		Objects.requireNonNull(on, "on");
		Objects.requireNonNull(category, "category");
		Objects.requireNonNull(kilometers, "kilometers");
		Objects.requireNonNull(points, "points");

		if (category.isBlank()) {
			throw new IllegalArgumentException("a race without a length band counts towards no badge");
		}

		/* THE SAME FOUR THE SCHEMA REFUSES, and refused here because this type does not
		   have to come from the schema: a round on 11.09.2026 built one with every number
		   negative and it went through, at which point a race SUBTRACTED five kilometres
		   from a member's total. `result_distance_positive`, `result_ascent_not_negative`,
		   `result_seconds_positive` and `result_points_not_negative` say the same in SQL,
		   and that guard stops at the edge of the database. */
		positive(kilometers, "kilometers");
		notNegative(points, "points");
		positive(seconds, "seconds");

		if (ascent < 0) {
			throw new IllegalArgumentException("a race cannot have climbed less than nothing: " + ascent);
		}
	}

	private static void positive(BigDecimal value, String named) {
		if (value.signum() <= 0) {
			throw new IllegalArgumentException("a race with no " + named + " is not a race: " + value);
		}
	}

	private static void notNegative(BigDecimal value, String named) {
		if (value.signum() < 0) {
			throw new IllegalArgumentException(named + " cannot be negative: " + value);
		}
	}

	private static void positive(long value, String named) {
		if (value <= 0) {
			throw new IllegalArgumentException("a race with no " + named + " is not a race: " + value);
		}
	}

	/** Whether this race falls inside a period, either end of which may be open. */
	public boolean inside(LocalDate from, LocalDate to) {
		return (from == null || !on.isBefore(from)) && (to == null || !on.isAfter(to));
	}
}
