package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PRICE OF A MEMBERSHIP LIVES IN FOUR PLACES, AND THIS HOLDS TWO OF THEM TO EACH OTHER.
 *
 * <p><b>Why it exists at all: PR 370 gave the price list a route that WRITES it</b>, and the
 * moment an amount became something an administrator changes rather than something a
 * migration states, the copies of it stopped being duplication and became drift waiting to
 * happen. The four:
 *
 * <ol>
 * <li>{@code price_row} (V4), which {@code PaymentApi} books from and {@code PricingApi}
 * serves - the only home {@code PricingWriteApi} can reach;
 * <li><b>{@code frontend/src/data/pricing.ts}</b>, which draws the public price table,
 * quotes the member his amount, and - through {@code data/paymentQr.ts} - fills in the IPS
 * QR code he scans to pay;
 * <li>{@code backend/tools/generate_reference_migrations.py} ({@code PRICE_ROWS}), copied
 * by hand, which that file admits in a comment because {@code pricing.ts} is TypeScript and
 * not data;
 * <li>{@code PriceListRowsTest}, a fourth written list, read from the decision rather than
 * from the generator - deliberately, so that a generator bug cannot agree with itself.
 * </ol>
 *
 * <p><b>THE BOUNDARY, AND IT IS THE REASON THIS FILE IS NOT ENOUGH.</b> What is held below
 * is the SOURCE: the numbers the repository ships in two of its halves. The drift that
 * actually costs a member money happens at RUN TIME and nothing on this side can see it -
 * an administrator raises a price through {@code PUT /api/pricing/{key}}, the table moves,
 * and the bundled constant does not, so the page he reads and the QR he scans still carry
 * the old amount while the next payment is booked at the new one. Every test here starts
 * from a database V4 has just written, so that state cannot be reached. It closes when a
 * screen reads {@code GET /api/pricing} instead of the constant, and that is the pricing
 * screen's own increment (owner, 25.09.2026, PDL P12b).
 *
 * <p><b>Home 3 is not compared here and that is deliberate.</b> The generator writes V4, and
 * V4 is home 1: comparing the two would be asking whether the generator's output equals its
 * input, which {@code MigrationsAreImmutableTest} and {@code DeltaMigrationAppliesTest}
 * already cover from the side that matters. Home 4 is held by its own file and is written
 * from the journal on purpose.
 *
 * <p><b>And the table is compared rather than the route's answer</b>, although the answer is
 * what a screen would read. {@code PricingApiTest} already holds every field of that answer
 * to these rows, so „the answer equals the table" has a home; asking it again here would be
 * a second one, and this file would then be measuring the wrong pair.
 */
class ThePriceListHasOneHomeTest extends DatabaseTest {

	private static final Path PRICING =
			Path.of("..", "frontend", "src", "data", "pricing.ts");

	/**
	 * The key of the row whose amount is not written as a row at all.
	 *
	 * <p>{@code PROCESSING_FEE_EUR} is a bare number in the portal's file - the fee has no
	 * dinar side, so it was never given the shape of a price row there - which is why it is
	 * read by a pattern of its own below and why every sweep here counts six and not seven.
	 */
	private static final String THE_FEE = "processing";

	/**
	 * A ROW OF THE PORTAL'S PRICE LIST: a key, and the two amounts that follow it.
	 *
	 * <p><b>Matched over the whole file rather than inside {@code PRICES}</b>, which is not
	 * tidiness but the only thing that works: the fourth period is not written in that array
	 * at all, it is the named constant {@code IN_SEASON} referred to from it, and the junior
	 * and referral rows are two more constants somewhere else again. A sweep aimed at the
	 * array finds three of the six, and would have been green while missing half the list.
	 *
	 * <p><b>The order inside a literal is key, then euro, then dinars</b>, in all six, and
	 * this reads it that way. Should somebody write one the other way round the pairing
	 * breaks - and it breaks LOUDLY, as a mismatched amount, never as a quiet pass, which is
	 * the direction to be wrong in. The count asserted below is what says the sweep found
	 * the whole list in the first place.
	 */
	private static final Pattern A_ROW = Pattern.compile(
			"key:\\s*'([a-z]+)'[^}]*?eur:\\s*([0-9.]+)[^}]*?rsd:\\s*([0-9.]+)", Pattern.DOTALL);

	/** The one amount written as a plain number, because the fee has no dinar side. */
	private static final Pattern THE_FEE_IN_EURO =
			Pattern.compile("PROCESSING_FEE_EUR\\s*=\\s*([0-9.]+)");

	/**
	 * THE SAME ROW, READ FOR ITS DAYS INSTEAD OF ITS AMOUNTS (29.09.2026).
	 *
	 * <p><b>Why this was added, and it is the hole this file had rather than a new idea.</b>
	 * Everything above holds the two homes to each other on the KEY and the two AMOUNTS, and
	 * on nothing else - so when the owner moved the selling year from 1 to 15 October, the one
	 * thing that had to move in both places was the one thing nothing compared. The branch
	 * that moved it found this file already here and pointing at the right pair; it was
	 * measuring the wrong column of it.
	 *
	 * <p><b>It stops at a closing brace like {@link #A_ROW} does</b>, which is what keeps a
	 * row's days from being read out of the row after it. The middle of the match is taken
	 * whole and the two days are picked out of it below, because {@code from} and {@code to}
	 * are written before {@code eur} in every row that has them and absent altogether in the
	 * three that do not - which is exactly what the table says with a null.
	 */
	private static final Pattern A_ROW_AND_WHAT_PRECEDES_ITS_PRICE = Pattern.compile(
			"key:\\s*'([a-z]+)'([^}]*?)eur:\\s*[0-9.]+", Pattern.DOTALL);

	private static final Pattern A_DAY_OF_THE_YEAR =
			Pattern.compile("%s:\\s*'([0-9]{2}-[0-9]{2})'");

	private record Amounts(BigDecimal eur, BigDecimal rsd) {
	}

	/** The two days of the year a period runs between, or two nulls where it has no period. */
	private record Days(String from, String to) {
	}

	private static String portalsFile() {
		assertThat(PRICING)
				.as("the portal's price list is not where this expects it, so nothing is compared")
				.exists();

		try {
			return Files.readString(PRICING, StandardCharsets.UTF_8);
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	/** What the portal ships, keyed the way the table keys it. Scale is the table's. */
	private static Map<String, Amounts> whatThePortalShips() {
		String source = portalsFile();
		Map<String, Amounts> rows = new LinkedHashMap<>();

		Matcher row = A_ROW.matcher(source);
		while (row.find()) {
			rows.put(row.group(1), new Amounts(scaled(row.group(2)), scaled(row.group(3))));
		}

		Matcher fee = THE_FEE_IN_EURO.matcher(source);
		assertThat(fee.find())
				.as("PROCESSING_FEE_EUR was not found in the portal's price list, so the fee is"
						+ " not being compared and this file is a row short of what it claims")
				.isTrue();
		rows.put(THE_FEE, new Amounts(scaled(fee.group(1)), null));

		return rows;
	}

	/** {@code numeric(10,2)}, so that 35 in the portal and 35.00 in the table are one number. */
	private static BigDecimal scaled(String written) {
		return new BigDecimal(written).setScale(2, java.math.RoundingMode.UNNECESSARY);
	}

	/**
	 * What days the portal ships for each row, keyed the way the table keys it.
	 *
	 * <p>The fee is added with no days at all, exactly as the three rows without a period
	 * carry none: it is written as a bare number rather than a row literal, so the sweep above
	 * cannot reach it, and leaving it out would make the comparison a row short of what it
	 * claims - which is the failure {@link #whatThePortalShips} already guards against on the
	 * amounts side.
	 */
	private static Map<String, Days> whatDaysThePortalShips() {
		String source = portalsFile();
		Map<String, Days> rows = new LinkedHashMap<>();

		Matcher row = A_ROW_AND_WHAT_PRECEDES_ITS_PRICE.matcher(source);
		while (row.find()) {
			String beforeThePrice = row.group(2);

			rows.put(row.group(1), new Days(dayOfTheYear(beforeThePrice, "from"),
					dayOfTheYear(beforeThePrice, "to")));
		}

		rows.put(THE_FEE, new Days(null, null));

		return rows;
	}

	/** One end of a period as the portal writes it, or null where the row has no period. */
	private static String dayOfTheYear(String written, String end) {
		Matcher day = Pattern.compile(A_DAY_OF_THE_YEAR.pattern().formatted(end)).matcher(written);

		return day.find() ? day.group(1) : null;
	}

	private Map<String, Days> whatDaysTheTableHolds() {
		Map<String, Days> rows = new LinkedHashMap<>();

		db.sql("select key, day_from, day_to from price_row order by sort_order")
				.query((row, one) -> Map.entry(row.getString(1),
						new Days(row.getString(2), row.getString(3))))
				.list()
				.forEach(one -> rows.put(one.getKey(), one.getValue()));

		return rows;
	}

	private Map<String, Amounts> whatTheTableHolds() {
		Map<String, Amounts> rows = new LinkedHashMap<>();

		db.sql("select key, eur, rsd from price_row order by sort_order")
				.query((row, one) -> Map.entry(row.getString(1),
						new Amounts(row.getBigDecimal(2), row.getBigDecimal(3))))
				.list()
				.forEach(one -> rows.put(one.getKey(), one.getValue()));

		return rows;
	}

	/**
	 * THE SWEEP FOUND THE WHOLE OF THE PORTAL'S LIST, which is the floor under everything
	 * else here.
	 *
	 * <p><b>Asked first and on its own, because it is the one failure that would make every
	 * other case in this file green while measuring less than it says.</b> A constant renamed
	 * or a literal written in another order takes a row out of the sweep; compared only key
	 * by key, the rows that were still found would agree perfectly and nothing would be red.
	 *
	 * <p><b>The number it is held to is the TABLE'S count and never a six written here</b> -
	 * an eighth row added to {@code price_row} tomorrow has to appear in the portal's file
	 * too, and this is where that is noticed.
	 */
	@Test
	void everyRowTheTableHoldsWasFoundInThePortalsOwnFile() {
		assertThat(whatThePortalShips().keySet())
				.as("the rows read out of frontend/src/data/pricing.ts are not the rows the price"
						+ " list has: either the sweep no longer finds them all, or the two halves"
						+ " of the repository disagree about which prices exist")
				.containsExactlyInAnyOrderElementsOf(whatTheTableHolds().keySet());
	}

	/**
	 * AND EVERY AMOUNT IS THE SAME AMOUNT ON BOTH SIDES.
	 *
	 * <p>Row by row and both amounts at once, so that a euro price changed in one home and
	 * not the other fails naming the row rather than as a count that is one out.
	 *
	 * <p><b>Why this matters more since PR 370 than it did before it.</b> These two numbers
	 * used to move only when somebody edited a file, and a reviewer saw both halves in one
	 * diff. From the day the route exists one of them moves on a running server, where no
	 * diff exists at all - so the source agreeing with itself is the least that can be asked,
	 * and the boundary at the head of this file is what is still missing above it.
	 */
	@Test
	void everyPriceThePortalShowsIsThePriceTheTableCharges() {
		assertThat(whatThePortalShips())
				.as("what frontend/src/data/pricing.ts quotes - on the public price table, on the"
						+ " member's screen and inside the IPS QR code he scans - is not what"
						+ " price_row charges")
				.containsExactlyInAnyOrderEntriesOf(whatTheTableHolds());
	}

	/**
	 * AND THE SWEEP REALLY WOULD NOTICE, asked of the file instead of believed.
	 *
	 * <p>Everything above compares two readings, and both would be satisfied by a pattern
	 * that matched nothing if the table were empty too - which it cannot be, but that is an
	 * argument rather than a measurement. So the pattern is put to the one shape it is most
	 * likely to have lost: the period that is NOT written inside {@code PRICES} but as the
	 * named constant {@code IN_SEASON} referred to from it.
	 *
	 * <p>Named here as a literal key because it is a fixture and not a second home for an
	 * amount: what it says is „the sweep reaches beyond the array", and it is the sentence
	 * that survives the day somebody rewrites the array.
	 */
	@Test
	void theSweepReachesThePeriodThatIsWrittenOutsideTheArray() {
		List<String> insideTheArray = List.of("early", "regular", "late");

		assertThat(whatThePortalShips().keySet())
				.as("the sweep over the portal's price list found only the rows written inside"
						+ " PRICES, so IN_SEASON, JUNIOR and REFERRAL are not being compared at"
						+ " all and half the list is unguarded")
				.contains("season", "junior", "referral")
				.containsAll(insideTheArray);
	}

	/**
	 * AND EVERY DAY OF THE YEAR IS THE SAME DAY ON BOTH SIDES (29.09.2026).
	 *
	 * <p><b>In both directions, which is the half that is easy to leave out.</b> A row the
	 * table gives days must carry the same two in the portal, AND a row the table gives none
	 * must carry none there either: the three rows without a period say so with a null on one
	 * side and by having no {@code from} at all on the other, and those are two spellings of
	 * the same absence. Compared one way only, a {@code from} added to the junior level
	 * tomorrow would pass.
	 *
	 * <p><b>Why this matters as much as the amounts do, and it is measured rather than
	 * argued.</b> The days decide WHAT a member is charged - {@code priceOn} walks them - so
	 * two homes disagreeing about a boundary charge two different prices on the days between
	 * them. When the owner moved the selling year on 29.09.2026 the fortnight in dispute would
	 * have been 1 to 14 October, at 35 euro on one side and 40 on the other, with the right to
	 * be ranked differing too.
	 */
	@Test
	void everyDayThePortalPrintsIsTheDayTheTableSells() {
		assertThat(whatDaysThePortalShips())
				.as("the days frontend/src/data/pricing.ts ships - which is what priceOn walks to"
						+ " decide what a member is charged today - are not the days price_row"
						+ " sells between")
				.containsExactlyInAnyOrderEntriesOf(whatDaysTheTableHolds());
	}

	/**
	 * AND THE SWEEP FOR DAYS REACHES THE SAME ROWS THE ONE FOR AMOUNTS DOES.
	 *
	 * <p>Its own case for the reason the amounts side has one: the comparison above is two
	 * readings, and a pattern that had stopped matching would make both sides shrink together.
	 * The floor is the same and it is the TABLE'S count, never a number written here.
	 *
	 * <p><b>And it is asked of the second sweep separately rather than trusted to the
	 * first</b>, although the two patterns begin alike: they are two patterns, and the day one
	 * of them is narrowed the other would go on finding everything and say so.
	 */
	@Test
	void everyRowTheTableHoldsWasFoundByTheSweepForDaysToo() {
		assertThat(whatDaysThePortalShips().keySet())
				.as("the rows read out of frontend/src/data/pricing.ts for their days are not the"
						+ " rows the price list has, so the comparison above is measuring less"
						+ " than the whole list")
				.containsExactlyInAnyOrderElementsOf(whatDaysTheTableHolds().keySet());
	}
}
