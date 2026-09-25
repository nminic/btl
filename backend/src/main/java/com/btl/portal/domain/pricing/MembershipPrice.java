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

	/**
	 * THE MOST A ROW OF THE PRICE LIST MAY COST, WHICH IS A DECISION AND NOT A COLUMN.
	 *
	 * <p><b>Owner, 25.09.2026 (PDL P12c):</b> the route refuses an amount above <b>1.000
	 * EUR</b> and <b>200.000 RSD</b>, „dakle iznad granice koju forma vec nosi". He chose it
	 * between the outcomes he was offered, and the cost he was shown and took is written
	 * into the journal in as many words: „ako jednog dana zatreba veci iznos, menja se na
	 * <b>dva mesta</b>, i u ruti i u formi."
	 *
	 * <p><b>Which is why the two numbers are not left as a promise.</b> The other place is
	 * {@code frontend/src/forms/definitions/admin-cena.form.json}, and
	 * {@code WhatAPriceMayCostTest} READS that file off the working tree and requires its
	 * {@code max} on each field to be the number below. Two homes the owner accepted, and a
	 * floor that fails the day only one of them moves - the shape
	 * {@code WhatRegistrationAsksForTest} and {@code MeWriteApiTest} already use for the
	 * registration's form.
	 *
	 * <p><b>THESE ARE TWO NUMBERS AND NEITHER IS THE OTHER CONVERTED.</b> Owner, 25.09.2026
	 * (PDL P12d), refusing the opposite: the rate of 1 EUR = 120 RSD in {@code PDL.md:833}
	 * „je bio <b>nacin da se cene prvi put izracunaju</b>, ne odnos koji portal cuva", and
	 * euros and dinars are typed „slobodno i nezavisno". The pair below says so by itself
	 * rather than only in this paragraph: 1.000 at that rate would be 120.000, and the
	 * ceiling he chose is <b>200.000</b>. Anything here that worked one out of the other
	 * would be the rule he refused, and it would be wrong by eighty thousand dinars.
	 *
	 * <p><b>AND ADL A12 DOES NOT FORBID THESE TWO, WHICH IS WORTH WRITING DOWN BECAUSE IT
	 * READS AS THOUGH IT MIGHT.</b> „Iznosi se cuvaju u {@code NUMERIC}, nikad u
	 * {@code double}, i <b>nikad kao broj upisan u kodu</b>" ({@code ADL.md:1003}) is about
	 * the amount a member is CHARGED, and the reason it gives is its own scope: „da se
	 * cenovnik i ono sto portal objavljuje ne raziđu". Not one price is written here - they
	 * are all in {@code price_row}, which is exactly what this class refuses to repeat. A
	 * ceiling on what may be TYPED is not a price; nobody is ever charged it, it appears on
	 * no screen a member reads, and the owner put these two numbers on the route himself
	 * (PDL P12c). The day it moves, it moves here and in the form, and the floor says so.
	 *
	 * <p><b>And they are asked by two methods rather than by one taking a limit.</b> A
	 * single method would let a caller hand the euro ceiling to a dinar price, which refuses
	 * every dinar row the list has - {@code late} is 6.000 - and hand the dinar ceiling to a
	 * euro price, which lets 1.500 EUR through. Two names cannot be passed the wrong way
	 * round by accident, and swapping them at the call site is a mutation the cases catch.
	 */
	private static final java.math.BigDecimal MOST_A_ROW_MAY_COST_IN_EURO =
			new java.math.BigDecimal("1000");

	/** The dinar half of the pair above, and never the euro one converted. */
	private static final java.math.BigDecimal MOST_A_ROW_MAY_COST_IN_DINARS =
			new java.math.BigDecimal("200000");

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
	 * <p><b>THE CEILING THIS ASKS ABOUT IS THE COLUMN'S AND NOT THE PRICE LIST'S, and until
	 * 25.09.2026 this paragraph said there was no other.</b> It read: „the ceiling is not the
	 * form's ... what is asked here is what the COLUMN keeps, ... the only one this side can
	 * answer without inventing a rule nobody decided." That was true when it was written and
	 * is <b>not true now</b>: the owner decided the other ceiling that same day (PDL P12c),
	 * and it lives beside this one in {@link #euroIsWithinWhatARowMayCost}. The sentence is
	 * rewritten rather than left standing, because a sentence claiming a decision does not
	 * exist is an instruction to the next reader to undo it.
	 *
	 * <p><b>The two are separate questions and both are asked.</b> This one is about the
	 * column: 41.125 is rounded, a negative price is refused by a constraint, and
	 * 100.000.000 does not fit. That one is about what a membership may plausibly cost. An
	 * amount can fail either without failing the other, which is why the route gives them
	 * two different sentences.
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
	 * WHETHER A EURO PRICE IS WITHIN WHAT A ROW OF THE LIST MAY COST (PDL P12c).
	 *
	 * <p>Inclusive: 1.000 is a price the owner may set and 1.000,01 is not. The form says
	 * the same by writing {@code max}, which HTML and every form renderer read as „at
	 * most", so the two homes agree about the edge as well as about the number.
	 *
	 * <p><b>Nothing here judges a small amount</b>, and that is deliberate: nought is a
	 * real answer ({@code price_row_eur_not_negative} allows it) and a free row is a
	 * decision rather than a fault. This is a ceiling and not a range.
	 */
	public static boolean euroIsWithinWhatARowMayCost(java.math.BigDecimal amount) {
		return amount.compareTo(MOST_A_ROW_MAY_COST_IN_EURO) <= 0;
	}

	/**
	 * The same question of a dinar price, and it is a SEPARATE question.
	 *
	 * <p>See the pair of constants above for why this is not the euro answer multiplied by
	 * anything: the owner refused a rate the portal enforces (PDL P12d), and the two
	 * ceilings he chose are not at the league's own rate in any case.
	 */
	public static boolean dinarsAreWithinWhatARowMayCost(java.math.BigDecimal amount) {
		return amount.compareTo(MOST_A_ROW_MAY_COST_IN_DINARS) <= 0;
	}

	/** The euro ceiling itself, for the floor that reads the form and compares. */
	public static java.math.BigDecimal mostARowMayCostInEuro() {
		return MOST_A_ROW_MAY_COST_IN_EURO;
	}

	/** The dinar ceiling itself, for the same floor. */
	public static java.math.BigDecimal mostARowMayCostInDinars() {
		return MOST_A_ROW_MAY_COST_IN_DINARS;
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
