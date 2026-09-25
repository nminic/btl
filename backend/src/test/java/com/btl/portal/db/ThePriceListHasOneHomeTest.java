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

	private record Amounts(BigDecimal eur, BigDecimal rsd) {
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
}
