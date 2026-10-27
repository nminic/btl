package com.btl.portal.db;

import com.btl.portal.domain.season.SeasonClock;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE DAY THE PRICE LIST STARTS SELLING NEXT SEASON IS THE DAY THE TRANSFER WINDOW OPENS,
 * AND NOTHING ELSE IN THE REPOSITORY SAYS SO.
 *
 * <p><b>Why this file exists, and it is the whole risk of the change that made it.</b> One
 * boundary is written in two places that cannot see each other: {@code price_row} holds the
 * days the selling year runs between, and {@link SeasonClock#transferWindowOpen} holds the
 * day a member may move between teams. The owner's decision of 29.09.2026 is that they are
 * ONE fact - „Zelim da prvi period postane 15-31. oktobar [...] S tim na umu zelim i da se
 * prelazni rok i sve ostalo otvara 15.10. ubuduce, a ne 1.10." - and until this file there
 * was nothing that would notice if one of them moved alone. {@link SeasonClock}'s own note
 * says the same thing from its side: the window is „the same window membership is renewed
 * in". That sentence was true and unmeasured.
 *
 * <p><b>NEITHER SIDE IS A COPY OF THE OTHER, which is what makes this a floor rather than a
 * second list.</b> The expected side is READ OUT OF THE TABLE and no day of the year is
 * written in this file at all; the measured side is the clock's BEHAVIOUR, asked by calling
 * it, never by reading its source. The two share no word: {@link SeasonClock} does not
 * mention the price list, a price row, {@code ranking} or {@code kind} anywhere. So a
 * mutation that moves one of them alone cannot move the other with it, which is the fault
 * that a floor repeating the condition it measures would have (ADL, 29.09.2026, „Pod koji
 * ponavlja USLOV iz fajla koji meri nije pod").
 *
 * <p><b>WHICH ROW OPENS THE SELLING YEAR IS NAMED SINCE 27.10.2026, AND WHY IT HAS TO BE.</b>
 * It used to be derived: a period that buys a place in the standing sold a season which had not
 * begun, and the one that did not was the season already running. The owner then made 1 January
 * to 31 March a ranked period OF THE RUNNING SEASON, so ranking no longer tells the two apart
 * and {@code min(day_from)} over the ranked periods is 1 January. The cycle opens with the row
 * {@code early} (PDL, „Prijave ce pocinjati 11. novembra svake godine"): its {@code day_from}
 * is the day this file holds the clock to, and the last day of the cycle is the last day of
 * the year, {@code max(day_to)} over all periods. What is read out of the table is still a
 * day and never written here.
 *
 * <p><b>The year is walked twice, and neither of them is 2026.</b> The days are {@code mm-dd}
 * because the list repeats every year (owner, 30.07.2026), so a case pinned to one year would
 * be satisfied by a rule that happened to be right in it. 2026 is avoided for a second and
 * sharper reason, which {@code SeasonClockTest} names in full: before the first season
 * everything the clock answers about a season is clamped to {@link SeasonClock#FIRST_SEASON},
 * and a clamped answer is the same on both sides of any boundary.
 */
class TheSellingYearAndTheTransferWindowOpenOnOneDayTest extends DatabaseTest {

	/**
	 * Two seasons the league actually has, walked so that a rule right in one year only is
	 * red in the other. 2028 is a leap year, which is why it is the second of the two. Neither
	 * is 2026, whose first sale opens on its own day ({@link SeasonClock#FIRST_SALE}) and has a
	 * case of its own below.
	 */
	private static final List<Integer> SEASONS = List.of(2027, 2028);

	private record SellingYear(MonthDay opens, MonthDay closes) {
	}

	/**
	 * When the price list starts and stops selling a season that has not begun, asked of the
	 * table.
	 *
	 * <p>The row is asserted first because everything below is satisfied by an empty answer:
	 * a null boundary would make every assertion here compare nothing to nothing.
	 */
	private SellingYear theSellingYear() {
		List<String> opening = db
				.sql("select day_from from price_row where kind = 'period' and key = 'early'")
				.query(String.class)
				.list();

		assertThat(opening)
				.as("the price list has no row that opens the cycle, so the boundary below is read"
						+ " off nothing and this file measures nothing")
				.hasSize(1);

		return new SellingYear(
				MonthDay.parse("--" + opening.getFirst()),
				MonthDay.parse("--" + db.sql("select max(day_to) from price_row where kind = 'period'")
						.query(String.class).single()));
	}

	private static ZonedDateTime middayOn(int season, MonthDay day) {
		return day.atYear(season).atTime(12, 0).atZone(SeasonClock.ZONE);
	}

	private static ZonedDateTime middayOnTheDayBefore(int season, MonthDay day) {
		return day.atYear(season).minusDays(1).atTime(12, 0).atZone(SeasonClock.ZONE);
	}

	/**
	 * THE WINDOW IS SHUT ON THE EVE OF THE SELLING YEAR AND OPEN ON ITS FIRST DAY.
	 *
	 * <p>Both sides, because one alone says nothing: a clock that answered „open" on every
	 * day of the year would pass the second assertion, and one that never opened at all would
	 * pass the first.
	 */
	@Test
	void theWindowOpensOnTheDayThePriceListStartsSellingNextSeason() {
		SellingYear selling = theSellingYear();

		for (int season : SEASONS) {
			assertThat(SeasonClock.transferWindowOpen(middayOnTheDayBefore(season, selling.opens())))
					.as("in %d the transfer window was already open the day before the price list"
							+ " began selling a season that has not begun", season)
					.isFalse();

			assertThat(SeasonClock.transferWindowOpen(middayOn(season, selling.opens())))
					.as("in %d the price list was selling next season on a day a member could not"
							+ " move between teams", season)
					.isTrue();
		}
	}

	/**
	 * AND IT IS STILL OPEN ON THE LAST DAY OF THE SELLING YEAR AND SHUT THE MORNING AFTER.
	 *
	 * <p>The far end of the same boundary. It has never moved and is measured anyway: the
	 * owner was asked on 29.09.2026 whether only the opening day moves and answered „Tacno",
	 * so the end staying where it is IS the decision, and a decision nothing measures is the
	 * one that moves by accident.
	 */
	@Test
	void theWindowShutsWhenTheSellingYearDoes() {
		SellingYear selling = theSellingYear();

		for (int season : SEASONS) {
			assertThat(SeasonClock.transferWindowOpen(middayOn(season, selling.closes())))
					.as("in %d the window had already shut on the last day next season was on"
							+ " sale", season)
					.isTrue();

			LocalDate theMorningAfter = selling.closes().atYear(season).plusDays(1);

			assertThat(SeasonClock.transferWindowOpen(
					theMorningAfter.atTime(12, 0).atZone(SeasonClock.ZONE)))
					.as("in %d the window stayed open past the end of the selling year", season)
					.isFalse();
		}
	}

	/**
	 * THE FIRST YEAR OPENS ON ITS OWN DAY AND NO OTHER YEAR DOES (owner, 27.10.2026).
	 *
	 * <p>„hocu da ove godine ljudi i dalje mogu da se prijavljuju i pre 11.11. po uslovima koji ce
	 * vaziti 11.11." The window of 2026 is open from {@link SeasonClock#FIRST_SALE} and the season
	 * on sale is 2027; the same fortnight in 2027 is shut and the season on sale is the running one.
	 * Asked on the days around the exception AND on the day the table opens, so a rule that
	 * extended the exception to later years - or dropped it - is red on a named day. The cases read
	 * the day the table opens, and write down only the exception's own day, which is the
	 * clock's constant and not a second copy of the table.
	 */
	@Test
	void theFirstSaleOf2026OpensEarlierThanTheTableAndIsNotRepeated() {
		SellingYear selling = theSellingYear();
		ZonedDateTime firstSale = SeasonClock.FIRST_SALE.atTime(12, 0).atZone(SeasonClock.ZONE);

		assertThat(SeasonClock.transferWindowOpen(firstSale.minusDays(1)))
				.as("the window was open the day before the first sale").isFalse();
		assertThat(SeasonClock.transferWindowOpen(firstSale)).isTrue();
		assertThat(SeasonClock.seasonBeingPaidFor(firstSale)).isEqualTo(2027);
		assertThat(SeasonClock.transferWindowOpen(middayOnTheDayBefore(2026, selling.opens())))
				.as("the exception of 2026 ended before the day the table opens on").isTrue();
		assertThat(SeasonClock.transferWindowOpen(middayOn(2026, selling.opens()))).isTrue();

		assertThat(SeasonClock.transferWindowOpen(firstSale.withYear(2027)))
				.as("the exception of the first year was repeated in 2027").isFalse();
		assertThat(SeasonClock.seasonBeingPaidFor(firstSale.withYear(2027))).isEqualTo(2027);
	}

	/**
	 * AND THE PRICE LIST IS READ ON THE DAY THE TABLE OPENS ON DURING THE FIRST SALE, so the
	 * price of the days before it is the cycle's first price and not the running season's.
	 */
	@Test
	void duringTheFirstSaleThePriceListIsReadOnTheDayTheTableOpens() {
		SellingYear selling = theSellingYear();

		assertThat(SeasonClock.dayThePriceListIsReadOn(SeasonClock.FIRST_SALE.minusDays(1)))
				.isEqualTo(MonthDay.from(SeasonClock.FIRST_SALE.minusDays(1)));
		assertThat(SeasonClock.dayThePriceListIsReadOn(SeasonClock.FIRST_SALE)).isEqualTo(selling.opens());
		assertThat(SeasonClock.dayThePriceListIsReadOn(selling.opens().atYear(2026).minusDays(1)))
				.isEqualTo(selling.opens());
		assertThat(SeasonClock.dayThePriceListIsReadOn(selling.opens().atYear(2026).plusDays(3)))
				.isEqualTo(MonthDay.from(selling.opens().atYear(2026).plusDays(3)));
		assertThat(SeasonClock.dayThePriceListIsReadOn(SeasonClock.FIRST_SALE.withYear(2027)))
				.isEqualTo(MonthDay.from(SeasonClock.FIRST_SALE));
	}

	/**
	 * AND WHAT IS ON SALE TURNS OVER ON THAT SAME DAY, which is the largest thing the
	 * boundary decides and the one no screen answers for itself.
	 *
	 * <p>Until the eve of the selling year a payment buys the season that is RUNNING; from
	 * its first day it buys the next one. Asked here rather than only in
	 * {@code SeasonClockTest} because there the boundary is a day written in the file, and
	 * here it is the day the TABLE holds - so this is the assertion that fails if the table
	 * and the clock part company, whichever of the two moved.
	 */
	@Test
	void whatIsOnSaleTurnsOverOnTheSameDayTheWindowOpens() {
		SellingYear selling = theSellingYear();

		for (int season : SEASONS) {
			assertThat(SeasonClock.seasonBeingPaidFor(middayOnTheDayBefore(season, selling.opens())))
					.as("on the eve of the selling year in %d a member was sold a season that had"
							+ " not begun", season)
					.isEqualTo(season);

			assertThat(SeasonClock.seasonBeingPaidFor(middayOn(season, selling.opens())))
					.as("on the first day of the selling year in %d a member was still sold the"
							+ " season that is running", season)
					.isEqualTo(season + 1);
		}
	}
}
