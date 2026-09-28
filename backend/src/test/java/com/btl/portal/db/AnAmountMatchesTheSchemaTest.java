package com.btl.portal.db;

import com.btl.portal.domain.pricing.MembershipPrice;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE SHAPE OF A PRICE, WHICH IS THE ONE RULE ABOUT THE PRICE LIST THAT NO CONSTRAINT CAN
 * CARRY.
 *
 * <p>{@code PriceListRowsTest} holds the ROWS - seven of them, four kinds, the year tiled
 * with no gap. What is held here is the COLUMN, and it is a separate file for the reason it
 * is a separate question: an amount with more para than the column keeps is not rejected by
 * PostgreSQL, it is silently ROUNDED. 41.125 written would come back 41.13, and there is no
 * check constraint that could say otherwise. So {@code MembershipPrice.amountIsKeptExactly}
 * refuses it in Java, and what stops that refusal from drifting away from the table is this
 * file.
 *
 * <p><b>Both numbers are rebuilt out of {@code information_schema} and neither is written
 * down.</b> The precedent is {@code RaceShapesMatchTheSchemaTest}, and it is a precedent
 * with a measurement behind it: when V25 widened {@code race.distance_km} from
 * {@code numeric(6,2)} to {@code numeric(8,4)}, every question in that file moved with the
 * migration instead of leaving the code refusing a length the table would have kept.
 *
 * <p><b>AND THE COLUMNS ARE ASKED FOR RATHER THAN NAMED, which is what keeps this from
 * being a list.</b> {@code eur} and {@code rsd} are not written anywhere below; what is
 * asked is every column the catalogue calls {@code numeric} on each of the two tables. A third
 * amount added to the price list tomorrow is measured on the day it is added rather than on
 * the day somebody remembers this file, and an amount given a shape of its own fails here
 * instead of quietly having two rules.
 *
 * <p><b>TWO TABLES SINCE 28.09.2026, AND UNTIL THEN ONE, WHICH LEFT THE HALF THAT HURTS
 * UNMEASURED.</b> {@code price_row} alone was here, and {@code PaymentApi} nevertheless says of
 * the amount a moderator types that „the scale and the ceiling are the COLUMN'S and
 * {@code AnAmountMatchesTheSchemaTest} rebuilds both of them out of {@code information_schema}".
 * That sentence was about {@code payment.received}, and this file was not reading that table at
 * all. The direction it leaves open is not academic: a migration that widens {@code price_row.eur}
 * to {@code numeric(12,2)} while {@code payment} stays {@code numeric(10,2)} is obeyed here,
 * {@link MembershipPrice#mostAnAmountCanBe} is FORCED UP to match, the route then accepts an
 * amount the column it writes to cannot hold, and the {@code insert} answers
 * {@code numeric field overflow} - a 500 on a moderator entering a bank statement. Not one case
 * would have gone red, because every literal those cases send has eleven digits and would still
 * be refused.
 *
 * <p><b>Both tables and nothing else, which is a boundary rather than an oversight.</b> These two
 * are exactly the tables the two routes NAME in their reasons for asking
 * {@link MembershipPrice#amountIsKeptExactly}: {@code PricingWriteApi} of {@code price_row}, and
 * {@code PaymentApi} of {@code payment}. {@code payment.amount} and {@code payment.fee} are here
 * with {@code received} although nobody asks that question of them directly - they are COPIED out
 * of {@code price_row} on every booking, so a narrower column would round a price that the list
 * kept exactly, which is the very fault this file exists for. {@code balance_entry.amount} is left
 * out: nothing asks {@code amountIsKeptExactly} of it, and every figure that reaches it is a
 * difference of two amounts that have already passed through here.
 */
class AnAmountMatchesTheSchemaTest extends DatabaseTest {

	/**
	 * THE TABLES WHOSE AMOUNTS THE CODE CLAIMS A SHAPE FOR.
	 *
	 * <p>Written by hand, and the floor under the list is the count asserted below: a table added
	 * here with no numeric column of its own - a name misspelt is the ordinary way - leaves the
	 * total short and says so, rather than measuring one table and reporting two.
	 */
	private static final List<String> AMOUNTS_LIVE_IN = List.of("price_row", "payment");

	/** The precision and the scale of one column, as the catalogue gives them. */
	private record Shape(String table, String column, int precision, int scale) {

		@Override
		public String toString() {
			return table + "." + column;
		}
	}

	private List<Shape> everyAmountColumn() {
		return db.sql("select table_name, column_name, numeric_precision, numeric_scale"
						+ " from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = any (?)"
						+ "   and data_type = 'numeric'"
						+ " order by table_name, column_name")
				.param(AMOUNTS_LIVE_IN.toArray(String[]::new))
				.query((row, one) -> new Shape(row.getString(1), row.getString(2), row.getInt(3),
						row.getInt(4)))
				.list();
	}

	/**
	 * EVERY AMOUNT OF THE PRICE LIST HAS ONE SHAPE, AND THE CODE HOLDS THAT SHAPE.
	 *
	 * <p>The euro price and the dinar price are two price lists (V4) and not one with a rate
	 * on it, but they are the same KIND of number, and {@code amountIsKeptExactly} is asked
	 * of both by {@code PricingWriteApi}. Were they shaped differently, that one question
	 * would be right about one column and wrong about the other, and the wrong one would
	 * round in silence.
	 *
	 * <p>The tables that answered are asserted first, and against {@link #AMOUNTS_LIVE_IN} in BOTH
	 * directions rather than only counted. A list that came back empty would let every loop below
	 * run nought times and leave this case green having measured nothing, which is exactly what a
	 * table name misspelt would produce; and a name that answers no numeric column at all - a table
	 * renamed by a migration, say - is the same nothing wearing a longer list.
	 */
	@Test
	void everyAmountOfThePriceListIsShapedTheWayTheCodeBelievesItIs() {
		List<Shape> columns = everyAmountColumn();

		assertThat(columns.stream().map(Shape::table).distinct().toList())
				.as("one of the tables this file claims to measure has no amount column at all, so"
						+ " it is not being measured: the table or the type it is asked about has"
						+ " moved")
				.containsExactlyInAnyOrderElementsOf(AMOUNTS_LIVE_IN);

		for (Shape column : columns) {
			assertThat(column.scale())
					.as("%s keeps a different number of decimals than the code does, so"
							+ " an amount refused by MembershipPrice would have been kept, or one"
							+ " it accepts is being rounded on the way in", column)
					.isEqualTo(MembershipPrice.digitsKeptAfterThePoint());

			/* 10^(precision - scale) - 10^-scale, which for numeric(10,2) is eight nines, a
			   point and two more. Worked out from the catalogue rather than written, so a
			   migration that widens a price fails this line instead of being obeyed silently. */
			BigDecimal most = BigDecimal.TEN.pow(column.precision() - column.scale())
					.subtract(BigDecimal.ONE.movePointLeft(column.scale()))
					.setScale(column.scale());

			assertThat(MembershipPrice.mostAnAmountCanBe())
					.as("the code and %s as numeric(%d,%d) no longer agree about the"
							+ " largest amount there is", column, column.precision(),
							column.scale())
					.isEqualByComparingTo(most);
		}
	}

	/**
	 * AND THE ROUNDING THIS GUARDS AGAINST REALLY IS SILENT, asked of the database itself.
	 *
	 * <p>Everything above compares two numbers, and both of them would be right about a
	 * column that REFUSED a third decimal rather than rounding it - in which case
	 * {@code amountIsKeptExactly} would be a second answer to a question PostgreSQL was
	 * already answering, and the refusal it gives would be belt over braces rather than the
	 * only thing standing there.
	 *
	 * <p>So the table is asked. A price is written with a third decimal, read back, and
	 * required to have CHANGED. The day PostgreSQL starts refusing that write instead, this
	 * fails and says that the rule in Java has become something else.
	 *
	 * <p>Rolled back with every other case here ({@code DatabaseTest}), so the price list is
	 * the seven rows V4 wrote by the time anything else reads it.
	 */
	@Test
	void aThirdDecimalIsRoundedByTheTableAndNotRefusedByIt() {
		db.sql("update price_row set eur = 41.125 where key = 'regular'").update();

		assertThat(db.sql("select eur from price_row where key = 'regular'")
						.query(BigDecimal.class).single())
				.as("the price list kept 41.125 as it was written, so the column is no longer"
						+ " numeric(10,2) and the rule in MembershipPrice is guarding against"
						+ " something that cannot happen")
				.isEqualByComparingTo(new BigDecimal("41.13"));
	}
}
