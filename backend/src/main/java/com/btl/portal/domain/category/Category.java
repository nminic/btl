package com.btl.portal.domain.category;

/**
 * Which category somebody competes in, for one season.
 *
 * <p>Four age bands per gender and a beginners' category on top of them, and
 * nothing else: no band under eighteen, none over sixty-five, no separate walkers
 * (PDL P7).
 *
 * <p><strong>Age is decided once, on 1 January, and does not move.</strong> This
 * changed from the 2017 rulebook, where the band changed on the birthday itself
 * and points moved category in the middle of a season. Now somebody who turns
 * forty in November is in the 40-54 band from the first of that January, and every
 * point he scores that year belongs to it. That is why this takes a YEAR of birth
 * and a season rather than a date and a day: the day is not part of the question,
 * and taking it would invite somebody to use it.
 *
 * <p><strong>The beginners' category replaces the age band; it does not sit beside
 * it.</strong> Owner, 03.08.2026: "Clanovi u PS plasmanu ne mogu tokom godine preci
 * u uzrasnu, niti biti paralelno u dve kategorije." So a member is in one or the
 * other, never both, and crossing the threshold moves him from the NEXT season.
 */
public final class Category {

	/** The four bands, in the order the tables list them. */
	public enum AgeBand {
		UNDER_25("24-"),
		TWENTY_FIVE_TO_39("25-39"),
		FORTY_TO_54("40-54"),
		FIFTY_FIVE_AND_OVER("55+");

		private final String code;

		AgeBand(String code) {
			this.code = code;
		}

		/** What the portal writes, and what a filter is keyed on. */
		public String code() {
			return code;
		}
	}

	/**
	 * The letter the beginners' category carries instead of a band.
	 *
	 * <p>{@code R} for rookie, chosen by the owner on 11.08.2026 over {@code PS}
	 * (for "Prva sezona") the same day he first saw it. In Serbian the two are
	 * written as whole words, {@code Pocetnici} and {@code Pocetnice}, because the
	 * word already carries the gender - and that is a matter for the dictionary the
	 * screen looks the code up in, not for this.
	 */
	public static final String FIRST_SEASON_BAND = "R";

	/**
	 * The points at which somebody leaves the beginners' category, and it is one way
	 * only.
	 *
	 * <p>The same number is also what a participation medal is worth (P16). One
	 * threshold in two roles, not a number copied twice.
	 */
	public static final int FIRST_SEASON_POINTS = 12;

	private Category() {
	}

	/**
	 * The band for a season.
	 *
	 * @param birthYear the year, not the date: see the note on this class
	 * @param season    the season being asked about
	 */
	public static AgeBand ageBandFor(int birthYear, int season) {
		int age = season - birthYear;

		if (age <= 24) {
			return AgeBand.UNDER_25;
		}
		if (age <= 39) {
			return AgeBand.TWENTY_FIVE_TO_39;
		}
		return age <= 54 ? AgeBand.FORTY_TO_54 : AgeBand.FIFTY_FIVE_AND_OVER;
	}

	/**
	 * The code shown on a profile and in the tables.
	 *
	 * <p>It is an IDENTIFIER and not a sentence: a filter, a column and a frozen
	 * season row are all keyed on it, so it is the same string on the server as on
	 * the screen, {@code Z} included. What that identifier is CALLED in a language is
	 * the dictionary's, and is not here.
	 *
	 * @param gender      as the schema holds it, {@code M} or {@code F}
	 * @param firstSeason whether he is in the beginners' category this season
	 */
	public static String codeFor(String gender, int birthYear, int season, boolean firstSeason) {
		String mark = genderMark(gender);
		return firstSeason ? mark + " " + FIRST_SEASON_BAND : mark + ageBandFor(birthYear, season).code();
	}

	/**
	 * The letter a category code begins with.
	 *
	 * @throws IllegalArgumentException on anything but the two the schema allows,
	 *                                  because {@code competitor_gender_known} says
	 *                                  there are two and a third is a schema that has
	 *                                  moved without this moving with it
	 */
	public static String genderMark(String gender) {
		return switch (gender) {
			case "M" -> "M";
			case "F" -> "Ž";
			case null -> throw new IllegalArgumentException("a member with no gender at all");
			default -> throw new IllegalArgumentException("unknown gender: " + gender);
		};
	}

	/**
	 * Whether the beginners' category is still open to somebody.
	 *
	 * <p><strong>What is passed in is the BEST SINGLE official season, never a sum of
	 * several.</strong> That is the whole of the rule and it is where the portal got
	 * it wrong once already: on 15.08.2026 the check summed points across all time,
	 * which in this portal is the imported history, and it closed the category to
	 * thirty of thirty-two members for races run before the league existed. Nothing
	 * before 2027 counts at all.
	 *
	 * <p>Leaving is one way only: a bad season never puts anybody back.
	 */
	public static boolean firstSeasonAllowed(int bestOfficialSeasonPoints) {
		return bestOfficialSeasonPoints < FIRST_SEASON_POINTS;
	}
}
