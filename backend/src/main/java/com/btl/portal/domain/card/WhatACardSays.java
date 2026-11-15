package com.btl.portal.domain.card;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * EVERY WORD THE SHARED CARD OF A PROFILE PRINTS, IN THE TWO LANGUAGES THE PORTAL SPEAKS.
 *
 * <p><b>A second home of words the portal already has, on purpose, and held to the first.</b> The
 * card is drawn on the server, which has no copy of {@code frontend/src/i18n/sr.json} at run time,
 * so the words it needs are written here. Each of them is the word the profile already prints for
 * the same thing, and {@code WhatACardSaysTest} reads both dictionaries of the frontend and fails
 * the day one of them says something else: the word under a count of a length
 * ({@code profile.categoryWord.*}), under a count of unscored races
 * ({@code profile.unscoredRingWord}), under the count of all races ({@code profile.racesWord}) and
 * the four pieces a category is written with ({@code category.markMale}, {@code markFemale},
 * {@code rookieMale}, {@code rookieFemale}).
 *
 * <p><b>The words are declined the way the profile declines them</b>, by the plural rules
 * {@code Intl.PluralRules} applies to {@code sr-Latn} and {@code en-GB} ({@code i18n/translate.ts}).
 * Owner, 15.11.2026: „Obrati pažnju na labele tako da sve stanu", and on the model that settled it:
 * 81 kraća trka, 84 polumaratona, 4 nebodovane. The rules are written out in {@link #formOf} for
 * whole numbers, which is all a count is, and {@code frontend/src/components/shareCard.cases.json}
 * holds the counts both sides are measured against.
 *
 * <p><b>Numbers as the portal writes them</b> ({@code i18n/format.ts}, {@code formatNumber}): the
 * Serbian of {@code sr-Latn}, a point between thousands and a comma before the decimals, and the
 * English of {@code en-GB}, the other way round. Kilometres always with two decimals, as the model
 * of 15.11.2026 shows them (8.465,94).
 *
 * <p><b>One sentence here is nobody's word yet:</b> {@link #firstRaceYetToCome()}, which the card
 * prints instead of the figures for a member with no race at all, so that it never says „0 trka".
 * It is the UX proposal the owner did not turn down, and it is marked as such in the PR.
 */
public enum WhatACardSays {

	SERBIAN("sr", '.', ',', "M", "Ž", "Početnici", "Početnice",
			new Forms("trka", "trke", "trka"),
			Map.of(
					"short", new Forms("kraća trka", "kraće trke", "kraćih trka"),
					"half", new Forms("polumaraton", "polumaratona", "polumaratona"),
					"long", new Forms("duža trka", "duže trke", "dužih trka"),
					"marathon", new Forms("maraton", "maratona", "maratona"),
					"ultra", new Forms("ultramaraton", "ultramaratona", "ultramaratona"),
					"unscored", new Forms("nebodovana", "nebodovane", "nebodovanih")),
			"Prva trka na profilu tek dolazi."),

	ENGLISH("en", ',', '.', "M", "F", "M Rookies", "F Rookies",
			new Forms("race", "races", "races"),
			Map.of(
					"short", new Forms("short race", "short races", "short races"),
					"half", new Forms("half marathon", "half marathons", "half marathons"),
					"long", new Forms("long race", "long races", "long races"),
					"marathon", new Forms("marathon", "marathons", "marathons"),
					"ultra", new Forms("ultramarathon", "ultramarathons", "ultramarathons"),
					"unscored", new Forms("unscored", "unscored", "unscored")),
			"The first race on the profile is yet to come.");

	/**
	 * THE SIX KINDS OF THE RING, IN THE ORDER IT GOES ROUND: the five lengths shortest to longest
	 * ({@code CATEGORIES} in {@code frontend/src/data/derive.ts}) and then the races the league does
	 * not score ({@code KINDS} in {@code components/CategoryDonut.tsx}).
	 */
	public static final List<String> KINDS = List.of("short", "half", "long", "marathon", "ultra",
			"unscored");

	/** The word beside the kilometres, the same in both languages. */
	public static final String KILOMETRES = "km";

	/** All that stands at the foot of the card (owner, 15.11.2026: „dole treba da stoji samo link"). */
	public static final String ADDRESS = "balkanskatrkackaliga.net";

	/** The three forms of a word by a count, as the dictionaries of the frontend key them. */
	public record Forms(String one, String few, String other) {
	}

	private final String code;
	private final char thousands;
	private final char decimals;
	private final String markMale;
	private final String markFemale;
	private final String rookieMale;
	private final String rookieFemale;
	private final Forms races;
	private final Map<String, Forms> kinds;
	private final String firstRaceYetToCome;

	WhatACardSays(String code, char thousands, char decimals, String markMale, String markFemale,
			String rookieMale, String rookieFemale, Forms races, Map<String, Forms> kinds,
			String firstRaceYetToCome) {
		this.code = code;
		this.thousands = thousands;
		this.decimals = decimals;
		this.markMale = markMale;
		this.markFemale = markFemale;
		this.rookieMale = rookieMale;
		this.rookieFemale = rookieFemale;
		this.races = races;
		this.kinds = kinds;
		this.firstRaceYetToCome = firstRaceYetToCome;
	}

	/** The language a code names, {@code sr} or {@code en}, and nothing for any other. */
	public static Optional<WhatACardSays> of(String code) {
		Objects.requireNonNull(code, "code");
		return Arrays.stream(values()).filter(one -> one.code.equals(code)).findFirst();
	}

	public String code() {
		return code;
	}

	/**
	 * WHICH OF THE THREE FORMS A WHOLE NUMBER TAKES, by the rules of CLDR that
	 * {@code Intl.PluralRules} applies. Serbian: one when it ends in 1 but not in 11, few when it
	 * ends in 2, 3 or 4 but not in 12, 13 or 14, other for the rest. English: one for 1, other for
	 * the rest, and English has no few.
	 */
	public String formOf(long count) {
		if (this == ENGLISH) {
			return count == 1 ? "one" : "other";
		}

		long last = count % 10;
		long lastTwo = count % 100;

		if (last == 1 && lastTwo != 11) {
			return "one";
		}

		return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "few" : "other";
	}

	/** The word under the count of all races, declined for the count. */
	public String racesWord(long count) {
		return declined(races, count);
	}

	/** The word under the count of one kind of the ring, declined for the count. */
	public String kindWord(String kind, long count) {
		return declined(Objects.requireNonNull(kinds.get(kind), kind), count);
	}

	private String declined(Forms forms, long count) {
		String form = formOf(count);

		if (form.equals("one")) {
			return forms.one();
		}

		return form.equals("few") ? forms.few() : forms.other();
	}

	/** A count written as the portal writes a whole number: {@code 1.234} or {@code 1,234}. */
	public String count(long count) {
		return format("#,##0").format(count);
	}

	/** Kilometres with two decimals, rounded half away from nought as {@code Intl} rounds. */
	public String kilometres(BigDecimal kilometres) {
		return format("#,##0.00").format(kilometres.setScale(2, RoundingMode.HALF_UP));
	}

	private DecimalFormat format(String pattern) {
		DecimalFormatSymbols symbols = new DecimalFormatSymbols();
		symbols.setGroupingSeparator(thousands);
		symbols.setDecimalSeparator(decimals);

		DecimalFormat format = new DecimalFormat(pattern, symbols);
		format.setRoundingMode(RoundingMode.HALF_UP);
		return format;
	}

	/**
	 * THE CATEGORY AS THE PORTAL WRITES IT ON A PROFILE, which is {@code categoryLabel} over
	 * {@code categoryCodeFor} ({@code frontend/src/data/categories.ts}): the beginners' category by
	 * its word ({@code Početnici}, {@code M Rookies}), and an age band with a space after the letter
	 * of the gender ({@code M 40-54}, owner, 18.10.2026, PDL P7). Owner, 15.11.2026: „M40 nije naziv
	 * kategorije nego je M40-54 ili kako već", and „kako već" is answered by the portal's own way.
	 *
	 * @param gender {@code M} for a man and anything else for a woman, as {@code genderMark} reads it
	 */
	public String category(String gender, String ageBand, boolean beginner) {
		boolean man = "M".equals(gender);

		if (beginner) {
			return man ? rookieMale : rookieFemale;
		}

		return (man ? markMale : markFemale) + " " + ageBand;
	}

	/** What the card says instead of its figures when the member has no race yet. */
	public String firstRaceYetToCome() {
		return firstRaceYetToCome;
	}
}
