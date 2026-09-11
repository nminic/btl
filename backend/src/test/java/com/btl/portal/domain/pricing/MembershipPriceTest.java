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
			row("early", "period", "10-01", "10-05", 35, 4200, true),
			row("regular", "period", "10-06", "11-30", 40, 4800, true),
			row("late", "period", "12-01", "12-31", 50, 6000, true),
			row("season", "period", "01-01", "09-30", 40, 4800, false),
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
	 * last day that belongs to one period and the first that belongs to the next. The
	 * five-day early window is the one worth looking at twice: it is the owner's own
	 * decision to bring the thirty-five euro price back, and it is five days wide.
	 */
	@ParameterizedTest
	@CsvSource({
			"01-01, season",   // the year opens in the late window's aftermath
			"09-30, season",   // and that period runs to the last day of September
			"10-01, early",    // the five days open
			"10-05, early",    // and close
			"10-06, regular",
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
		assertThat(MembershipPrice.on(ROWS, monthDay("10-03"), 1990, 2027, true).amount())
				.isEqualByComparingTo("35");
		assertThat(MembershipPrice.on(ROWS, monthDay("10-03"), 1990, 2027, false).amount())
				.isEqualByComparingTo("4200");
		assertThat(MembershipPrice.on(ROWS, monthDay("12-15"), 1990, 2027, true).amount())
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
		assertThat(MembershipPrice.on(ROWS, monthDay("10-03"), 1990, 2027, true).fee())
				.isEqualByComparingTo("3");
		assertThat(MembershipPrice.on(ROWS, monthDay("10-03"), 1990, 2027, false).fee())
				.as("a dinar payment was charged a fee that covers an intermediary it does not use")
				.isEqualByComparingTo("0");

		assertThat(MembershipPrice.on(ROWS, monthDay("10-03"), 1990, 2027, true).amount())
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
		assertThat(MembershipPrice.on(ROWS, monthDay("10-03"), 2015, 2027, true).amount())
				.isEqualByComparingTo("20");
		assertThat(MembershipPrice.on(ROWS, monthDay("12-31"), 2015, 2027, true).amount())
				.isEqualByComparingTo("20");
		assertThat(MembershipPrice.on(ROWS, monthDay("12-31"), 2015, 2027, true).key())
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
		assertThat(MembershipPrice.on(ROWS, monthDay("10-03"), 2015, 2027, true).ranking())
				.as("a junior who paid in the window was refused a place")
				.isTrue();

		assertThat(MembershipPrice.on(ROWS, monthDay("03-15"), 2015, 2027, true).ranking())
				.as("a junior who paid in March was told he could be ranked, and nobody else who"
						+ " paid that day can be")
				.isFalse();

		assertThat(MembershipPrice.on(ROWS, monthDay("03-15"), 1990, 2027, true).ranking()).isFalse();
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

		assertThatThrownBy(() -> MembershipPrice.on(withoutTheFee, monthDay("10-03"), 1990, 2027, true))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining(MembershipPrice.PROCESSING);
	}

	private static MonthDay monthDay(String written) {
		return MonthDay.of(Integer.parseInt(written.substring(0, 2)), Integer.parseInt(written.substring(3)));
	}
}
