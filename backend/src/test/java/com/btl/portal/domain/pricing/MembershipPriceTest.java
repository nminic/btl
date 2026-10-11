package com.btl.portal.domain.pricing;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.time.MonthDay;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * What a membership costs on the day it is paid for.
 *
 * <p>The rows here are V4's seven, written out so the cases can be read without a
 * database. What ties them to the schema is
 * {@code PriceListRowsTest.theRowsThePriceRuleReadsAreTheRowsTheSchemaHolds}, which
 * reads the real ones back and compares - so a price changed in a migration and not
 * here fails, and so does the other way round.
 */
public class MembershipPriceTest {

	/* Javno samo zato sto pod u paketu `db` cita bas ovaj spisak, pa se dva doma cene
	   ne mogu raziti. Bez toga bi se sedam iznosa prepisivalo, a A12 to zabranjuje. */

	public static final List<MembershipPrice.Row> ROWS = List.of(
			row("early", "period", "10-15", "10-31", 35, 4200, true),
			row("regular", "period", "11-01", "11-30", 40, 4800, true),
			row("late", "period", "12-01", "12-31", 50, 6000, true),
			row("season", "period", "01-01", "10-14", 40, 4800, false),
			row("junior", "level", null, null, 20, 2400, null),
			row("processing", "fee", null, null, 3, null, null),
			row("referral", "referral", null, null, 5, 600, null));

	private static MembershipPrice.Row row(String key, String kind, String from, String to,
			int eur, Integer rsd, Boolean ranking) {
		return new MembershipPrice.Row(key, kind, from, to, BigDecimal.valueOf(eur),
				rsd == null ? null : BigDecimal.valueOf(rsd), ranking);
	}

	/**
	 * Every boundary of every period, from both sides.
	 *
	 * <p>Four periods make four boundaries once the year wraps, and each is given the
	 * last day that belongs to one period and the first that belongs to the next.
	 *
	 * <p><b>The early window is the one worth looking at twice.</b> It is the owner's own
	 * decision to bring the thirty-five euro price back, and since 29.09.2026 it runs from
	 * 15 to 31 October rather than for the first five days of the month - seventeen days
	 * instead of five, which he was asked about before anything moved: „Jeste, OK je".
	 *
	 * <p><b>1 October is here although it is no boundary at all, and that is why.</b> It was
	 * the first day of the early window and is now an ordinary day in the middle of the
	 * running season's period, so it is the one day that tells the new list from the old -
	 * every other row below reads the same under either.
	 */
	@ParameterizedTest
	@CsvSource({
			"01-01, season",   // the year opens in the late window's aftermath
			"09-30, season",
			"10-01, season",   // no longer the early window, and nothing else says so
			"10-14, season",   // and that period now runs to the middle of October
			"10-15, early",    // the seventeen days open
			"10-31, early",    // and close with the month
			"11-01, regular",
			"11-30, regular",
			"12-01, late",
			"12-31, late"      // the year ends here
	})
	void everyBoundaryBetweenThePeriodsIsWhereItShouldBe(String day, String key) {
		assertThat(MembershipPrice.periodFor(ROWS, monthDay(day)).key()).isEqualTo(key);
	}

	/** What a member pays in each period, in both currencies. */
	@Test
	void thePriceIsThePriceOfTheDay() {
		assertThat(MembershipPrice.on(ROWS, monthDay("10-20"), 1990, 2027, Currency.EUR).amount())
				.isEqualByComparingTo("35");
		assertThat(MembershipPrice.on(ROWS, monthDay("10-20"), 1990, 2027, Currency.RSD).amount())
				.isEqualByComparingTo("4200");
		assertThat(MembershipPrice.on(ROWS, monthDay("12-15"), 1990, 2027, Currency.EUR).amount())
				.isEqualByComparingTo("50");
	}

	/**
	 * THE FEE IS ON EURO PAYMENTS AND NEVER ON DINAR ONES.
	 *
	 * <p>Owner, 03.08.2026: it covers an intermediary the dinar account does not have,
	 * and "dinarska uplata je nema". It is also a separate line and not a bigger
	 * membership - "stalo mi je da se naznaci da to nije clanarina nego obrada taksi" -
	 * which is why it comes back beside the amount rather than added into it.
	 */
	@Test
	void theFeeIsOnEuroPaymentsAndNeverOnDinarOnes() {
		assertThat(MembershipPrice.on(ROWS, monthDay("10-20"), 1990, 2027, Currency.EUR).fee())
				.isEqualByComparingTo("3");
		assertThat(MembershipPrice.on(ROWS, monthDay("10-20"), 1990, 2027, Currency.RSD).fee())
				.as("a dinar payment was charged a fee that covers an intermediary it does not use")
				.isEqualByComparingTo("0");

		assertThat(MembershipPrice.on(ROWS, monthDay("10-20"), 1990, 2027, Currency.EUR).amount())
				.as("the fee was added into the membership instead of standing beside it")
				.isEqualByComparingTo("35");
	}

	/**
	 * THE JUNIOR PRICE IGNORES THE DATE, which is the only price in the list that
	 * does.
	 *
	 * <p>Twenty euro whether it is paid in the five-day window or in December, because
	 * it is a LEVEL of price rather than a period.
	 */
	@Test
	void theJuniorPriceIsTheSameWheneverItIsPaid() {
		assertThat(MembershipPrice.on(ROWS, monthDay("10-20"), 2015, 2027, Currency.EUR).amount())
				.isEqualByComparingTo("20");
		assertThat(MembershipPrice.on(ROWS, monthDay("12-31"), 2015, 2027, Currency.EUR).amount())
				.isEqualByComparingTo("20");
		assertThat(MembershipPrice.on(ROWS, monthDay("12-31"), 2015, 2027, Currency.EUR).key())
				.isEqualTo("junior");
	}

	/**
	 * AND THE RIGHT TO A PLACE IN THE TABLE STILL FOLLOWS THE DAY HE PAID ON.
	 *
	 * <p>This is the owner's correction of 21.08.2026 and it is the whole reason the
	 * period is looked up even for somebody who pays the junior price. The public
	 * price list used to tell every junior that he could be ranked whatever the date,
	 * because the junior row carried the answer - and the junior row is a level, not a
	 * period, so it has no business answering it.
	 */
	@Test
	void aJuniorWhoPaysInMarchIsNoMoreRankedThanAnybodyElseWhoDoes() {
		assertThat(MembershipPrice.on(ROWS, monthDay("10-20"), 2015, 2027, Currency.EUR).ranking())
				.as("a junior who paid in the window was refused a place")
				.isTrue();

		assertThat(MembershipPrice.on(ROWS, monthDay("03-15"), 2015, 2027, Currency.EUR).ranking())
				.as("a junior who paid in March was told he could be ranked, and nobody else who"
						+ " paid that day can be")
				.isFalse();

		assertThat(MembershipPrice.on(ROWS, monthDay("03-15"), 1990, 2027, Currency.EUR).ranking()).isFalse();
	}

	/**
	 * Fifteen is the oldest a junior may be in a season, and sixteen is not.
	 *
	 * <p>Fifteen and not fourteen, and that is the owner answering exactly this on
	 * 13.08.2026: "Ko puni 15, a ima bar dan 14 u novoj sezoni, OK je da placa
	 * juniorsku." The junior price is an upper bound measured across the whole season,
	 * which is the one place the portal does not fix an age on 1 January.
	 */
	@Test
	void fifteenIsTheOldestAJuniorMayBeAndSixteenIsNot() {
		assertThat(MembershipPrice.juniorFor(2012, 2027)).as("fifteen in 2027").isTrue();
		assertThat(MembershipPrice.juniorFor(2011, 2027)).as("sixteen in 2027").isFalse();
		assertThat(MembershipPrice.juniorFor(2027, 2027)).as("born this season").isTrue();
	}

	/**
	 * A day no period covers stops rather than guessing.
	 *
	 * <p>It cannot happen against V4's rows - the floor in the db package measures
	 * that they cover every day of the year exactly once - and this is what says so if
	 * one is ever taken out.
	 */
	@Test
	void aDayNoPeriodCoversStopsRatherThanGuessing() {
		List<MembershipPrice.Row> withAGap = ROWS.stream()
				.filter(row -> !"late".equals(row.key()))
				.toList();

		assertThatThrownBy(() -> MembershipPrice.periodFor(withAGap, monthDay("12-15")))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("12-15");
	}

	/** And so does a price list with a row missing. */
	@Test
	void aPriceListMissingARowStopsRatherThanGuessing() {
		List<MembershipPrice.Row> withoutTheFee = ROWS.stream()
				.filter(row -> !MembershipPrice.PROCESSING.equals(row.key()))
				.toList();

		assertThatThrownBy(() -> MembershipPrice.on(withoutTheFee, monthDay("10-20"), 1990, 2027, Currency.EUR))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining(MembershipPrice.PROCESSING);
	}

	/**
	 * AN AMOUNT THE PRICE LIST WOULD KEEP AS IT WAS TYPED, and three ways of not being one.
	 *
	 * <p>Each row below is one of the three halves of the rule, said from both sides of its
	 * boundary, because a rule with three conditions passes on two of them while the third
	 * is missing. Measured from the outside, that would be a price silently rounded, a
	 * negative price refused by the database as a 500, or an overflow reaching an
	 * administrator the same way.
	 *
	 * <p><b>{@code 41.10} is the one that reads like a mistake and is not.</b> Its scale is
	 * two written down and one after {@code stripTrailingZeros}, which is the whole reason
	 * the rule strips them: a form that sends {@code 41.10} means forty-one euro and ten,
	 * and a rule reading the scale as it arrived would refuse {@code 41.100} and accept
	 * {@code 41.10} for no reason anybody could explain. The floor under the number two
	 * itself is {@code AnAmountMatchesTheSchemaTest}, which reads it off the catalogue.
	 */
	@ParameterizedTest
	@CsvSource({
			"0, true",
			"41, true",
			"41.1, true",
			"41.10, true",
			"41.12, true",
			"41.125, false",
			"-0.01, false",
			"99999999.99, true",
			"100000000, false"})
	void anAmountIsKeptExactlyOnlyWhenTheColumnWouldHoldItAsWritten(String written, boolean kept) {
		assertThat(MembershipPrice.amountIsKeptExactly(new BigDecimal(written)))
				.as("%s: the price list would %s keep it as it was typed", written,
						kept ? "" : "not")
				.isEqualTo(kept);
	}

	/**
	 * AN AMOUNT IS WHOLE WHATEVER ZEROS IT IS WRITTEN WITH, AND ONLY WHEN IT HAS NO FRACTION.
	 *
	 * <p>PDL, ODLUKA 02.10.2026, „Iznosi se unose kao celi brojevi" (recorded as the owner's own
	 * words: „Iznosi se unose bez tačaka i zareza!"), for what is typed, confirmed on 10.10.2026.
	 * The question is asked of the VALUE: {@code 4.800} is 4.8 and is a fraction, which is how a
	 * dinar price typed with a separator for the thousands was quietly becoming 3,5 dinars.
	 *
	 * <p><b>Every row is one way the rule can be written wrongly.</b> {@code 40.00} and
	 * {@code 0.00} are whole but have a scale of two as they arrive, so a rule that reads the scale
	 * without stripping the zeros refuses them. {@code 1E+2} is a hundred with a scale BELOW nought,
	 * so a rule asking {@code scale == 0} refuses it. {@code 40.5}, {@code 40.10} and {@code 0.01} are
	 * the fractions, from half a unit down to the smallest one the column keeps, so a rule that lets
	 * one decimal or two through passes some of them and not others. {@code 3.500} is the incident
	 * spelt as it was typed.
	 *
	 * <p><b>And two rows that say what is NOT asked here:</b> a negative whole number and one past
	 * the column's ceiling are whole, because the sign and the ceiling are
	 * {@link MembershipPrice#amountIsKeptExactly}'s question and the route's own, and a rule that
	 * judged them as well would give a negative price the wrong sentence.
	 */
	@ParameterizedTest
	@CsvSource({
			"0, true",
			"0.00, true",
			"40, true",
			"40.0, true",
			"40.00, true",
			"4800, true",
			"1E+2, true",
			"-40, true",
			"100000000, true",
			"0.01, false",
			"40.5, false",
			"40.10, false",
			"4.800, false",
			"3.500, false",
			"41.125, false",
			"-40.5, false"})
	void anAmountIsWholeOnlyWhenItHasNoFractionWhateverZerosItIsWrittenWith(String written,
			boolean whole) {
		assertThat(MembershipPrice.amountIsWhole(new BigDecimal(written)))
				.as("%s: it %s a fraction in it", written, whole ? "has no" : "has")
				.isEqualTo(whole);
	}

	private static MonthDay monthDay(String written) {
		return MonthDay.of(Integer.parseInt(written.substring(0, 2)), Integer.parseInt(written.substring(3)));
	}
}
