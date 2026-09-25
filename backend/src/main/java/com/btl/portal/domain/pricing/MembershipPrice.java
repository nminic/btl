package com.btl.portal.domain.pricing;

import java.time.MonthDay;
import java.util.List;

/**
 * What a membership costs on the day it is paid for.
 *
 * <p>The price list is V4's seven rows and nothing here repeats them: an amount
 * written into code is what ADL A12 forbids and what the owner has changed twice
 * already. What this holds is the RULE for reading them, which is three sentences
 * (PDL P8):
 *
 * <ul>
 *   <li>four periods, and which one a day falls in decides the price;
 *   <li>a junior price that ignores the date entirely and replaces whichever period
 *       applies;
 *   <li>a processing fee of three euro, charged on euro payments and never on
 *       dinar ones, because it covers an intermediary the dinar account does not
 *       have.
 * </ul>
 *
 * <p><strong>The day is a day of the YEAR, not a date.</strong> The price list is a
 * yearly cycle rather than a list of one season's dates - the owner's own words on
 * 30.07.2026: "Registracija za BTL sezonu 2027. istice 30.9.2027. i onda se
 * automatski otvara identican ciklus cenama za prijave za 2028. godinu. I tako svake
 * godine." So the rows carry {@code MM-DD} and this takes a {@link MonthDay}. A year
 * has no place in the question, and taking one would invite somebody to put the
 * wrong one in.
 */
public final class MembershipPrice {

	/** One row of the price list, exactly as V4 holds it. */
	public record Row(String key, String kind, String dayFrom, String dayTo,
			java.math.BigDecimal eur, java.math.BigDecimal rsd, Boolean ranking) {
	}

	/** What somebody owes: the row it came from, the amount, and the fee beside it. */
	public record Price(String key, java.math.BigDecimal amount, java.math.BigDecimal fee, boolean ranking) {
	}

	/** The key of the row that carries the junior price. */
	public static final String JUNIOR = "junior";

	/** The key of the row that carries the processing fee. */
	public static final String PROCESSING = "processing";

	/**
	 * The oldest somebody may be in a season and still pay the junior price.
	 *
	 * <p>FIFTEEN, and that is not a mistake for fourteen. The price list says "uzrast
	 * do 14 godina", and the owner was asked about exactly this on 13.08.2026: "Ko
	 * puni 15, a ima bar dan 14 u novoj sezoni, OK je da placa juniorsku." The junior
	 * price is an upper bound measured across the WHOLE season rather than on one day,
	 * which is the one place the portal does not fix an age on 1 January - and it is
	 * deliberate, because this is a bound and not a sorting.
	 */
	public static final int OLDEST_JUNIOR_IN_A_SEASON = 15;

	/**
	 * How much of an amount the price list keeps, which is {@code numeric(10,2)} (V4).
	 *
	 * <p>Held here rather than written into whoever is asking, and held against the
	 * catalogue rather than believed: {@code AnAmountMatchesTheSchemaTest} reads the
	 * precision and the scale of EVERY numeric column of {@code price_row} out of
	 * {@code information_schema} and rebuilds both numbers below from them, so a migration
	 * that widens a price fails there instead of leaving this class refusing something the
	 * table would have kept. The precedent is {@code WhatARaceCarries}, which was moved by
	 * exactly such a migration (V25) in the same commit that widened the column.
	 */
	private static final int DIGITS_KEPT_AFTER_THE_POINT = 2;

	/** Eight digits before the point and two after it, which is what {@code numeric(10,2)} holds. */
	private static final java.math.BigDecimal MOST_AN_AMOUNT_CAN_BE =
			new java.math.BigDecimal("99999999.99");

	private MembershipPrice() {
	}

	/**
	 * WHETHER THE PRICE LIST WOULD KEEP THIS AMOUNT AS IT WAS TYPED.
	 *
	 * <p><b>The half a constraint cannot say.</b> {@code price_row_eur_not_negative} refuses
	 * a negative price and PostgreSQL refuses a number too big for the column, but an amount
	 * with more para than the column keeps is refused by nothing at all - it is silently
	 * ROUNDED. 41.125 entered would be stored as 41.13, and the portal would have changed a
	 * price by a para that nobody typed, on the one number that is a promise to a member.
	 * The same question {@code WhatARaceCarries.distanceIsKeptExactly} asks for a distance,
	 * and for the same reason.
	 *
	 * <p>All three halves are here rather than two of them being left to the database,
	 * because the answer to each is otherwise a 500 landing on an administrator who has just
	 * filled in a form - which is the sentence {@code EventWriteApi} has carried since it was
	 * written.
	 *
	 * <p><b>Zero is a real answer and is not judged.</b> {@code price_row_eur_not_negative}
	 * allows it, and a price list in which something is free is a decision rather than a
	 * fault; whether any particular row may be nought is nobody's rule today.
	 *
	 * <p><b>And the ceiling is not the form's.</b> {@code admin-cena.form.json} stops at 1000
	 * EUR and 200000 RSD, which are a screen's guard against a typo. What is asked here is
	 * what the COLUMN keeps, which is the question {@code LeagueWriteApi} asks of an address
	 * and the only one this side can answer without inventing a rule nobody decided.
	 */
	public static boolean amountIsKeptExactly(java.math.BigDecimal amount) {
		return amount.signum() >= 0
				&& amount.stripTrailingZeros().scale() <= DIGITS_KEPT_AFTER_THE_POINT
				&& amount.compareTo(MOST_AN_AMOUNT_CAN_BE) <= 0;
	}

	/** The scale itself, for the floor that rebuilds it out of the catalogue. */
	public static int digitsKeptAfterThePoint() {
		return DIGITS_KEPT_AFTER_THE_POINT;
	}

	/** The ceiling itself, for the same floor. */
	public static java.math.BigDecimal mostAnAmountCanBe() {
		return MOST_AN_AMOUNT_CAN_BE;
	}

	/**
	 * Whether somebody pays the junior price for a season.
	 */
	public static boolean juniorFor(int birthYear, int season) {
		return season - birthYear <= OLDEST_JUNIOR_IN_A_SEASON;
	}

	/**
	 * What is owed, for one day of the year and one member.
	 *
	 * @param rows      the price list as V4 holds it, all seven
	 * @param day       the day the membership is being paid for
	 * @param birthYear the member's year of birth
	 * @param season    the season being paid for
	 * @param euro      whether he is paying in euro, which is what the fee hangs on
	 */
	public static Price on(List<Row> rows, MonthDay day, int birthYear, int season, boolean euro) {
		Row period = periodFor(rows, day);
		Row applies = juniorFor(birthYear, season) ? rowNamed(rows, JUNIOR) : period;

		java.math.BigDecimal amount = euro ? applies.eur() : applies.rsd();
		java.math.BigDecimal fee = euro ? rowNamed(rows, PROCESSING).eur() : java.math.BigDecimal.ZERO;

		/* THE RIGHT TO A PLACE IN THE TABLE COMES FROM THE PERIOD, NEVER FROM THE JUNIOR ROW,
		   and that is the owner's correction of 21.08.2026: the junior price is a LEVEL of price
		   and not a period, so whether somebody may be ranked follows the day he paid on exactly
		   as it does for everybody else. The portal had it the other way once and told every
		   junior he could be ranked whatever the date. */
		return new Price(applies.key(), amount, fee, Boolean.TRUE.equals(period.ranking()));
	}

	/**
	 * Which period a day of the year falls in.
	 *
	 * @throws IllegalStateException when no period covers the day, which cannot happen
	 *                               against V4's rows and is what says so if it ever
	 *                               does
	 */
	public static Row periodFor(List<Row> rows, MonthDay day) {
		String asWritten = String.format("%02d-%02d", day.getMonthValue(), day.getDayOfMonth());

		return rows.stream()
				.filter(row -> "period".equals(row.kind()))
				.filter(row -> row.dayFrom().compareTo(asWritten) <= 0
						&& row.dayTo().compareTo(asWritten) >= 0)
				.findFirst()
				.orElseThrow(() -> new IllegalStateException("no period in the price list covers " + asWritten));
	}

	private static Row rowNamed(List<Row> rows, String key) {
		return rows.stream()
				.filter(row -> key.equals(row.key()))
				.findFirst()
				.orElseThrow(() -> new IllegalStateException("the price list has no row named " + key));
	}
}
