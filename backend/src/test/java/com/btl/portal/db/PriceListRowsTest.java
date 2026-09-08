package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The seven rows of the price list, and the shape ADL A36 O12 decided for them.
 *
 * The price list has no machine readable source: it lives in
 * {@code frontend/src/data/pricing.ts}, which is TypeScript and not data, so
 * unlike the two codebooks it cannot be compared against a file. What is held
 * here instead is the decision. Seven rows and four kinds of row, four periods,
 * one level, one fee, one referral; the fee is the only row with no dinar price;
 * only a period answers whether what it buys is ranked; and the four periods tile
 * the year with no gap and no overlap.
 *
 * That last one is here rather than in the schema on purpose, and the migration
 * says so where it would otherwise look like an omission. No overlap is
 * expressible as an exclusion constraint over a range; no gap is not, and half a
 * rule in the schema reads as the whole of it. Held over the rows, both halves
 * are said.
 *
 * The amounts are asserted, and yes, that is a second place they are written. It
 * is the right second place: a price is a thing that must not change by accident,
 * and the generator and this test read from different sides, the generator from
 * `pricing.ts` and this from PDL P8 and the decisions of 03., 04. and 12.08.2026.
 */
class PriceListRowsTest extends DatabaseTest {

	record Row(String key, String kind, String dayFrom, String dayTo, BigDecimal eur, BigDecimal rsd, Boolean ranking) {
	}

	private List<Row> rows() {
		return db.sql("select key, kind, day_from, day_to, eur, rsd, ranking from price_row order by sort_order")
				.query((rs, index) -> new Row(rs.getString("key"), rs.getString("kind"), rs.getString("day_from"),
						rs.getString("day_to"), rs.getBigDecimal("eur"), rs.getBigDecimal("rsd"),
						rs.getObject("ranking", Boolean.class)))
				.list();
	}

	/**
	 * Seven rows, and the amounts each one carries.
	 *
	 * The four periods and the junior level are PDL P8. The processing fee is the
	 * decision of 03.08.2026, three euro on a payment from abroad, and the
	 * correction of 04.08.2026 that made it a row of the list rather than a
	 * sentence on one screen: everybody is shown it, only those paying in euro pay
	 * it. The referral is PDL P16, owner 12.08.2026: five euro or six hundred
	 * dinars credited for a member brought in, and a row of the price list because
	 * the owner asked for it to be set there like any other amount.
	 *
	 * The dinar prices are their own price list and not a conversion. That they
	 * sit at the league's own rate of 120 to the euro is beside the point: what is
	 * stored is what a member is charged, so a rate that moves cannot move it.
	 */
	@Test
	void thePriceListIsTheSevenRowsTheOwnerDecided() {
		assertThat(rows()).containsExactly(
				new Row("early", "period", "10-01", "10-05", money(35), money(4200), true),
				new Row("regular", "period", "10-06", "11-30", money(40), money(4800), true),
				new Row("late", "period", "12-01", "12-31", money(50), money(6000), true),
				/* The season already running buys a profile but no place in the
				   standing, which is the one period that answers Ne. */
				new Row("season", "period", "01-01", "09-30", money(40), money(4800), false),
				new Row("junior", "level", null, null, money(20), money(2400), null),
				new Row("processing", "fee", null, null, money(3), null, null),
				/* Two figures and not one with a conversion, as everywhere else on
				   this list: six hundred dinars is not five euro at any rate, it is
				   the dinar figure the league chose (owner, 11.08.2026). */
				new Row("referral", "referral", null, null, money(5), money(600), null));
	}

	/**
	 * Four kinds of row, and the periods are the only kind there is more than one
	 * of.
	 *
	 * The referral became the fourth on 08.09.2026. It is a kind of its own and not
	 * a level, because a level is a price somebody pays and this is an amount
	 * somebody is credited: it has no period in the year, it buys no right to be
	 * ranked, and it is settled for a season when the renewal window opens rather
	 * than sold in one (PDL P16, owner 12. and 16.08.2026).
	 */
	@Test
	void thereAreFourKindsOfRowAndOnlyThePeriodsRepeat() {
		List<Row> rows = rows();

		assertThat(rows).extracting(Row::kind).containsOnly("period", "level", "fee", "referral");
		assertThat(rows).filteredOn(row -> row.kind().equals("period")).hasSize(4);
		assertThat(rows).filteredOn(row -> row.kind().equals("level")).hasSize(1);
		assertThat(rows).filteredOn(row -> row.kind().equals("fee")).hasSize(1);
		assertThat(rows).filteredOn(row -> row.kind().equals("referral")).hasSize(1);
	}

	/**
	 * The four periods tile the year: there is always exactly one price in force.
	 *
	 * Both halves. A gap is a morning on which the portal has no price and quietly
	 * stops selling membership; an overlap is a morning on which it has two and the
	 * one a member is charged depends on which row was read first. Neither has ever
	 * been true, and this is what says so.
	 *
	 * Walked in a leap year so that 29 February is a day like any other: the
	 * periods are days of the year and not dates, because the list repeats. What is
	 * sold from 1 October is the next season, every year, for as long as the portal
	 * runs.
	 */
	@Test
	void theFourPeriodsCoverTheYearWithNoGapAndNoOverlap() {
		List<Row> periods = rows().stream()
				.filter(row -> row.kind().equals("period"))
				.sorted((left, right) -> left.dayFrom().compareTo(right.dayFrom()))
				.toList();

		assertThat(periods.getFirst().dayFrom()).isEqualTo("01-01");
		assertThat(periods.getLast().dayTo()).isEqualTo("12-31");

		for (int index = 1; index < periods.size(); index++) {
			LocalDate closed = dayOfYear(periods.get(index - 1).dayTo());
			LocalDate opened = dayOfYear(periods.get(index).dayFrom());

			assertThat(opened)
					.as("the period after %s opens the next day", periods.get(index - 1).key())
					.isEqualTo(closed.plusDays(1));
		}
	}

	/**
	 * The fee is the only row with no dinar side, and it is that row.
	 *
	 * There is no payment intermediary on the dinar side to pay, so the dinar
	 * prices are unchanged and the fee simply has no dinar amount. Said over the
	 * data as well as in the schema, because the schema only knows that the fee is
	 * the row without one; that the row without one is the fee, at three euro, is
	 * this.
	 */
	@Test
	void onlyTheProcessingFeeHasNoDinarPrice() {
		assertThat(rows())
				.filteredOn(row -> row.rsd() == null)
				.singleElement()
				.satisfies(row -> {
					assertThat(row.key()).isEqualTo("processing");
					assertThat(row.eur()).isEqualByComparingTo(money(3));
				});
	}

	/**
	 * Only a period answers the ranking question, and the other three leave it
	 * empty.
	 *
	 * Whether a season is ranked follows the day the fee was paid, for a junior
	 * exactly as for anybody else, so the junior row points at the periods rather
	 * than answering; the fee buys nothing in the rulebook at all, and the referral
	 * is credited rather than sold. Both public
	 * tables said Da outright at one point, and the administrator's screen said it
	 * for longer, which is worse, because that is the screen somebody decides on.
	 */
	@Test
	void onlyPeriodsSayWhetherWhatTheyBuyIsRanked() {
		assertThat(rows())
				.filteredOn(row -> row.ranking() != null)
				.extracting(Row::kind)
				.containsOnly("period")
				.hasSize(4);
	}

	private static BigDecimal money(int amount) {
		return new BigDecimal(amount).setScale(2);
	}

	private static LocalDate dayOfYear(String monthDay) {
		/* A leap year, so that a period could end on 29 February without this
		   deciding for the price list that it may not. */
		return LocalDate.parse("2000-" + monthDay);
	}
}
