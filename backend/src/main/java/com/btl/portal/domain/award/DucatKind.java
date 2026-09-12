package com.btl.portal.domain.award;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

/**
 * The quantity a badge is measured in, and how to measure it.
 *
 * <p>Eleven of them, and they are the eleven the schema's {@code ducat_kind}
 * codebook holds. The rule of a badge is DATA and is interpreted, never executed
 * (ADL A12): a badge says "at least this much of this quantity, inside this
 * period", so the only thing code has to know is how to measure each quantity.
 * One place for all eleven means a twelfth is a line here and a migration, and
 * nothing else anywhere.
 *
 * <p>Everything comes back as {@link BigDecimal} because the threshold it is
 * compared against is {@code numeric(12,2)}, and a count compared against a
 * decimal through a {@code double} is a comparison that can go wrong at the
 * boundary - which is the one place a badge is decided.
 */
public enum DucatKind {

	RACE_COUNT("raceCount", races -> whole(races.size())),
	SHORT_COUNT("shortCount", inBand("short")),
	HALF_COUNT("halfCount", inBand("half")),
	LONG_COUNT("longCount", inBand("long")),
	MARATHON_COUNT("marathonCount", inBand("marathon")),
	ULTRA_COUNT("ultraCount", inBand("ultra")),

	TOTAL_KM("totalKm", races -> sum(races, RaceDone::kilometers)),
	TOTAL_ASCENT("totalAscent", races -> sum(races, one -> BigDecimal.valueOf(one.ascent()))),
	POINTS("points", races -> sum(races, RaceDone::points)),

	/**
	 * Hours, because that is what a time badge writes its threshold in.
	 *
	 * <p>Rounded DOWN, and the direction is the decision: seconds do not divide
	 * into hours exactly, and a badge once given is never taken away (ADL A12, 4),
	 * so a badge given wrongly is given for ever. Rounded down, somebody one
	 * second short of a hundred hours does not get it; rounded up he would, and
	 * nothing could undo that. Six decimals is finer than any threshold, which
	 * carries two.
	 */
	TOTAL_TIME("totalTime", DucatKind::hours),

	/**
	 * How many different countries, which the portal itself cannot answer.
	 *
	 * <p>A result does not carry the country; the event its race belongs to does,
	 * and the browser does not load the events, so in the portal this is nought
	 * and the badge of countries can be earned by nobody (ADL A12, 8, recorded as
	 * owed). The server joins through the race to the event and can answer it, so
	 * here it does.
	 *
	 * <p>A race whose country is not known counts towards nothing rather than
	 * towards a country of its own - the same safe direction as the rounding
	 * above, and for the same reason.
	 */
	COUNTRY_COUNT("countryCount", races -> whole(distinctCountries(races).size()));

	private static final BigDecimal SECONDS_IN_AN_HOUR = BigDecimal.valueOf(3600);

	private static final int HOUR_DECIMALS = 6;

	private final String code;

	private final Function<List<RaceDone>, BigDecimal> measure;

	DucatKind(String code, Function<List<RaceDone>, BigDecimal> measure) {
		this.code = code;
		this.measure = measure;
	}

	/** What the codebook and the portal both call it. */
	public String code() {
		return code;
	}

	/** How much of this quantity the races given add up to. */
	public BigDecimal over(List<RaceDone> races) {
		Objects.requireNonNull(races, "races");

		return measure.apply(races);
	}

	/**
	 * Whether these races earn a badge asking for that much of this quantity.
	 *
	 * <p>Always "at least", never "exactly" and never "more than": that is what
	 * the rule of a badge means, and the boundary belongs to whoever reached it.
	 */
	public boolean reached(List<RaceDone> races, BigDecimal threshold) {
		Objects.requireNonNull(threshold, "threshold");

		/* A threshold of nought is reached by somebody who has never raced, and a
		   negative one by everybody alive. Neither is a badge, which is what
		   `ducat_threshold_positive` says in the schema; refused here too because the
		   rule of a badge is interpreted here and the schema's guard stops at its own
		   edge. Found by a round on 11.09.2026, which asked for nought races and was
		   told the badge was won. */
		if (threshold.signum() <= 0) {
			throw new IllegalArgumentException(
					"a badge nobody has to do anything for is not a badge: " + threshold);
		}

		return over(races).compareTo(threshold) >= 0;
	}

	/** The badge quantity known by that code, if the codebook and this agree. */
	public static DucatKind named(String code) {
		for (DucatKind kind : values()) {
			if (kind.code.equals(code)) {
				return kind;
			}
		}

		throw new IllegalArgumentException("no badge is measured in '" + code + "'");
	}

	/** Every code this knows, in the order they are written above. */
	public static Set<String> codes() {
		Set<String> all = new LinkedHashSet<>();

		for (DucatKind kind : values()) {
			all.add(kind.code);
		}

		return Set.copyOf(all);
	}

	/**
	 * Every length band a badge counts by name.
	 *
	 * <p>Its floor is {@code AwardRulesMatchTheSchemaTest}, which asks PostgreSQL
	 * what its own generated column can produce rather than taking this list's
	 * word for it.
	 */
	public static Set<String> bandsCounted() {
		return Set.of("short", "half", "long", "marathon", "ultra");
	}

	private static Function<List<RaceDone>, BigDecimal> inBand(String band) {
		return races -> whole((int) races.stream().filter(one -> band.equals(one.category())).count());
	}

	private static BigDecimal sum(List<RaceDone> races, Function<RaceDone, BigDecimal> of) {
		return races.stream().map(of).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	private static Collection<String> distinctCountries(List<RaceDone> races) {
		Set<String> seen = new LinkedHashSet<>();

		for (RaceDone one : races) {
			if (one.country() != null && !one.country().isBlank()) {
				seen.add(one.country());
			}
		}

		return seen;
	}

	/* A method and not a lambda over the two constants below, because an enum constant
	   may not read a field declared after it - and moving them above the eleven
	   constants would put the arithmetic before the eleven quantities that are the
	   subject of this file. */
	private static BigDecimal hours(List<RaceDone> races) {
		return BigDecimal.valueOf(races.stream().mapToLong(RaceDone::seconds).sum())
				.divide(SECONDS_IN_AN_HOUR, HOUR_DECIMALS, RoundingMode.DOWN);
	}

	private static BigDecimal whole(int howMany) {
		return BigDecimal.valueOf(howMany);
	}
}
