package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE NAME OF A PRICE ROW HAS TWO HOMES FOR AS LONG AS THE SCREEN READS THE DICTIONARY, AND
 * THIS IS WHAT KEEPS THEM EQUAL.
 *
 * <p><b>The cost was named before the work began and accepted.</b> PDL P12b, 1 (owner,
 * 25.09.2026) made the name a column, with the condition „Kad: zajedno sa ekranom cenovnika, ne
 * pre" and the reason beside it: „dodavanje kolone pre ekrana daje nazivu <b>dva doma</b> dok
 * ekran jos cita recnik." On 26.09.2026 the owner settled the order - the column first, the
 * screen after - because without the column the pricing screen can change the amounts of the six
 * rows the dictionary names and <b>cannot give the processing fee a button at all</b>, so the
 * second half of P12b (the fee gets a button) could not be carried out either way round.
 *
 * <p><b>So this file exists to make „two homes" a measured state rather than a known risk.</b>
 * It is the same arrangement {@code ThePriceListHasOneHomeTest} has for the AMOUNT, which has
 * four homes by the same kind of accident, and it is written in that file's shape deliberately:
 * one reading off the working tree, one reading off the table, compared both ways.
 *
 * <p><b>THE BOUNDARY, and it is the same one, said again because it is the half that matters.</b>
 * What is held here is the SOURCE: the six names the repository ships in its other half against
 * the seven rows this one loads. The drift that actually reaches a visitor happens at RUN TIME -
 * an administrator renames a row through {@code PUT /api/pricing/{key}}, the column moves, and
 * the bundled dictionary does not, so the table published under Clan 14 of the rulebook still
 * prints the old name. Every test here starts from a database V34 has just written, so that state
 * cannot be reached from this side at all. It closes when {@code PriceTable} reads
 * {@code GET /api/pricing} instead of {@code pricing.rows.*}, and that is the pricing screen's own
 * increment.
 *
 * <p><b>Six and seven, and the difference is named rather than smoothed over.</b> The dictionary
 * has no entry for the processing fee and never had one: both screens that mention the fee draw
 * it as a NOTE and not as a row of a table ({@code AdminPricing}, {@code Membership}), so there
 * was nothing for anybody to translate. That is the gap this increment was written for, and the
 * comparison below is deliberately not {@code containsExactly} over seven - that would demand a
 * seventh key in a file this branch does not touch.
 */
class TheRowNameHasOneHomeTest extends DatabaseTest {

	private static final Path DICTIONARY =
			Path.of("..", "frontend", "src", "i18n", "sr.json");

	/**
	 * The key of the one row the dictionary has never named.
	 *
	 * <p>Named as a literal because it is the shape of the asymmetry and not a second home for
	 * anything: what it says is „the dictionary is the table minus this one row".
	 */
	private static final String THE_FEE = "processing";

	/**
	 * The names the portal ships, out of {@code pricing.rows} in the dictionary.
	 *
	 * <p><b>Parsed and not matched by a pattern.</b> {@code sr.json} is JSON, so the block can be
	 * asked for by path and the whole of it read - which means a seventh key appearing there
	 * tomorrow arrives here on the day it is added rather than on the day somebody remembers this
	 * file. {@code ThePriceListHasOneHomeTest} sweeps with a regular expression because its other
	 * half is TypeScript and there is nothing to parse.
	 */
	private static Map<String, String> namesThePortalShips() {
		assertThat(DICTIONARY)
				.as("the portal's dictionary is not where this expects it, so nothing is compared")
				.exists();

		JsonNode rows = read().path("pricing").path("rows");

		assertThat(rows.isObject())
				.as("pricing.rows is not an object in frontend/src/i18n/sr.json, so the names the"
						+ " portal prints are not being read at all and every case here would pass"
						+ " having compared nothing")
				.isTrue();

		Map<String, String> names = new LinkedHashMap<>();
		rows.propertyStream().forEach(one -> names.put(one.getKey(), one.getValue().asString()));

		return names;
	}

	private static JsonNode read() {
		try {
			return new ObjectMapper().readTree(Files.readString(DICTIONARY, StandardCharsets.UTF_8));
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	/** What the table holds, keyed the way the dictionary keys it. */
	private Map<String, String> namesTheTableHolds() {
		Map<String, String> names = new LinkedHashMap<>();

		db.sql("select key, label from price_row order by sort_order")
				.query((row, one) -> Map.entry(row.getString(1), row.getString(2)))
				.list()
				.forEach(one -> names.put(one.getKey(), one.getValue()));

		return names;
	}

	/**
	 * THE DICTIONARY NAMES EVERY ROW OF THE TABLE BUT THE FEE, AND IT NAMES NOTHING ELSE.
	 *
	 * <p><b>Asked first and on its own, because it is the floor the case below stands on.</b>
	 * Compared key by key, a dictionary block that had been renamed or emptied would agree with
	 * an empty comparison perfectly and nothing would be red.
	 *
	 * <p><b>The expected side is derived from the TABLE and never a six written here.</b> An
	 * eighth row added to {@code price_row} tomorrow has to be named in the portal's dictionary
	 * too, or be declared a second fee-like row, and this is where that decision is asked for
	 * once instead of being noticed by a visitor.
	 */
	@Test
	void theDictionaryNamesEveryRowOfThePriceListExceptTheFee() {
		Set<String> expected = new LinkedHashSet<>(namesTheTableHolds().keySet());

		assertThat(expected.remove(THE_FEE))
				.as("the price list no longer holds a row keyed %s, so the one asymmetry this file"
						+ " is written around is not the one the table has", THE_FEE)
				.isTrue();

		assertThat(namesThePortalShips().keySet())
				.as("pricing.rows in frontend/src/i18n/sr.json is not the price list minus the"
						+ " processing fee: either a row of the table has no name in the portal's"
						+ " dictionary, or the dictionary names something the price list does not"
						+ " carry")
				.containsExactlyInAnyOrderElementsOf(expected);
	}

	/**
	 * AND EVERY NAME IS THE SAME NAME ON BOTH SIDES, WORD FOR WORD.
	 *
	 * <p>Six entries compared as a map, so a name changed in one home and not the other fails
	 * naming the row rather than as a count that is one out.
	 *
	 * <p><b>Compared with {@code containsAllEntriesOf} and not as equals, which is the whole
	 * shape of this file:</b> the table carries a seventh name that the dictionary has no entry
	 * for, and demanding equality here would be this test asking for a key to be added to a file
	 * the backend does not own.
	 *
	 * <p><b>What a passing run says and what it does not.</b> It says the repository agrees with
	 * itself today. It cannot say anything about a name an administrator changed on a running
	 * server, for the reason at the head of this file.
	 */
	@Test
	void everyNameThePortalPrintsIsTheNameTheTableHolds() {
		assertThat(namesTheTableHolds())
				.as("what frontend/src/i18n/sr.json prints under pricing.rows - the first column of"
						+ " the price table a visitor reads under Clan 14 - is not what price_row.label"
						+ " holds, so the name has two homes that disagree")
				.containsAllEntriesOf(namesThePortalShips());
	}

	/**
	 * AND THE FEE HAS A NAME OF ITS OWN, WHICH IS THE HALF OF P12b THIS ROW EXISTS FOR.
	 *
	 * <p>The row the dictionary never named is the reason the column was worth having before the
	 * screen: with no name for it, a pricing screen has nothing to put on the button. So the one
	 * thing asserted about it is that it is named at all and that its name is not one of the six
	 * the dictionary already carries - which is what would happen if somebody reached for the
	 * nearest existing string rather than the rulebook's words.
	 *
	 * <p><b>What the words are is NOT asserted here, and that is deliberate.</b> The name is data
	 * an administrator edits (PDL P12b, 1), so a case pinning the text would be a home the owner
	 * decided this value should not have, and it would fail the first time he corrected a typo.
	 * Where the starting text came from is written in V34, beside the row that writes it.
	 */
	@Test
	void theProcessingFeeIsNamedAndItsNameIsNotBorrowedFromAnotherRow() {
		Map<String, String> held = namesTheTableHolds();

		assertThat(held.get(THE_FEE))
				.as("the processing fee has no name, and it is the row that had none before V34:"
						+ " the screen the owner is waiting for has nothing to draw on its button")
				.isNotNull()
				.isNotBlank();

		assertThat(namesThePortalShips().values())
				.as("the processing fee is wearing a name that already belongs to another row of the"
						+ " price list, so two rows of the public table read the same")
				.doesNotContain(held.get(THE_FEE));
	}
}
