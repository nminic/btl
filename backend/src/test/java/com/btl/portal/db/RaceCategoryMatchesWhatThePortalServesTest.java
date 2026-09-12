package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT LENGTH MAKES A RACE A MARATHON, ASKED OF BOTH PLACES THAT ANSWER IT.
 *
 * <p>{@code race.category} is a generated column: the database works it out of
 * the distance and nobody writes it. The portal answers the same question today
 * for every race it serves, in {@code races.json}, and the day those two
 * disagree every ladder, filter and badge on the portal is drawn one way and
 * scored another, with nothing to say so.
 *
 * <p><b>The portal's file is the source and it is not a list somebody typed.</b>
 * It carries one thousand six hundred and twelve races over four hundred and
 * thirty six distinct distances, which is a sweep nobody would have written by
 * hand and which lands on the places the rule turns: exactly 21.1, exactly 42.2,
 * and 21.11, which is eleven hundredths past a half marathon and must not be
 * one.
 *
 * <p><b>The rule is not read, it is RUN.</b> The generated expression comes out
 * of the catalogue and PostgreSQL evaluates it over every distance at once. A
 * floor that compared the written CASE with a written Java equivalent would be
 * two rules again, which is the thing it exists to stop.
 *
 * <p><b>AND THE RULE HAS FIVE HOMES, of which this file holds two.</b> The two
 * here are the generated columns. The other three live in the browser:
 * {@code races.json} and {@code results.json}, which are served with a category on
 * every record, and {@code frontend/src/data/raceCategory.ts}, which answers the
 * same question in TypeScript for the administration's form and for a reported
 * result. No test here can run TypeScript and a Java copy of the rule would be a
 * sixth home, so those three are held in their own package
 * ({@code raceCategory.test.ts}), by a sweep that READS THE SERVED DIRECTORY
 * rather than naming files.
 *
 * <p><b>Two rounds of review found this, and both were one mistake at different
 * depths</b> (12.09.2026): the first knew three homes and missed the function, the
 * second knew four and missed {@code results.json}, where 3528 results carry their
 * own category and three screens read it straight off the record. Each time the
 * proof was the same: move the rule in the home nobody holds, and every case here
 * stays green.
 */
class RaceCategoryMatchesWhatThePortalServesTest extends DatabaseTest {

	private static final Path SERVED =
			Path.of("..", "frontend", "public", "mock", "races.json");

	/** Every distance the portal serves, with the category it gives it. */
	private static Map<BigDecimal, String> whatThePortalServes() {
		Map<BigDecimal, String> byDistance = new TreeMap<>();

		for (JsonNode race : read()) {
			BigDecimal distance = new BigDecimal(race.path("distanceKm").asString())
					.setScale(2, java.math.RoundingMode.UNNECESSARY);
			String category = race.path("category").asString("");

			String already = byDistance.putIfAbsent(distance, category);

			assertThat(already == null || already.equals(category))
					.as("the portal serves %s as both '%s' and '%s', so it does not agree with itself",
							distance, already, category)
					.isTrue();
		}

		return byDistance;
	}

	private static JsonNode read() {
		try {
			return new ObjectMapper().readTree(Files.readString(SERVED, StandardCharsets.UTF_8));
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	/**
	 * What the schema itself works the category out of, in its own words.
	 *
	 * <p>Two tables carry the same rule: a race has a distance and so does a result,
	 * because a result keeps its own rather than reading the race's (V7), so that a
	 * race edited afterwards cannot rescore what was already run. That is the right
	 * decision and it makes the rule live in two places, which is why this takes the
	 * table as an argument and why one of the cases below puts the two to each
	 * other.
	 */
	private String howTheSchemaWorksItOut(String table) {
		return db.sql("select pg_get_expr(def.adbin, def.adrelid)"
						+ " from pg_attrdef def"
						+ " join pg_class rel on rel.oid = def.adrelid"
						+ " join pg_attribute col on col.attrelid = def.adrelid and col.attnum = def.adnum"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and rel.relname = ? and col.attname = 'category'")
				.param(table).query(String.class).single();
	}

	@ParameterizedTest
	@ValueSource(strings = {"race", "result"})
	void theSchemaStillWorksTheCategoryOutItself(String table) {
		assertThat(howTheSchemaWorksItOut(table))
				.as("the column no longer computes anything, so nothing here is being compared")
				.contains("distance_km")
				.contains("CASE");
	}

	/**
	 * EVERY DISTANCE THE PORTAL SERVES, PUT TO THE DATABASE, COMES BACK THE SAME.
	 *
	 * <p>All four hundred and thirty six in one statement, because four hundred and
	 * thirty six round trips to prove one rule is a minute spent on nothing.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"race", "result"})
	void everyDistanceThePortalServesIsCategorisedTheSameWay(String table) {
		Map<BigDecimal, String> served = whatThePortalServes();

		assertThat(served)
				.as("the portal serves no races at all, so this sweep compares nothing")
				.hasSizeGreaterThan(400);

		String asked = howTheSchemaWorksItOut(table).replace("distance_km", "km");
		String distances = served.keySet().stream()
				.map(BigDecimal::toPlainString)
				.collect(Collectors.joining(","));

		Map<BigDecimal, String> fromTheSchema = new LinkedHashMap<>();

		db.sql("select km, (" + asked + ") as category"
						+ " from unnest(array[" + distances + "]::numeric(6,2)[]) as km")
				.query((row, one) -> Map.entry(row.getBigDecimal(1), row.getString(2)))
				.list()
				.forEach(one -> fromTheSchema.put(one.getKey(), one.getValue()));

		assertThat(fromTheSchema)
				.as("`%s` and the portal no longer agree about what a distance makes a race", table)
				.isEqualTo(new LinkedHashMap<>(served));
	}

	/**
	 * AND THE TWO TABLES ANSWER THE SAME, which nothing else in the portal checks.
	 *
	 * <p>A race keeps a distance and a result keeps its own, and each works the
	 * category out of it with a rule written out separately. Compared as TEXT they
	 * would pass while spelled differently and mean the same, or fail while spelled
	 * the same and mean different things after an edit to one; so both are run, over
	 * every distance the portal serves, and the answers are put side by side.
	 *
	 * <p>What this catches is the edit somebody makes to one of them.
	 */
	@Test
	void aRaceAndAResultOfTheSameLengthAreTheSameCategory() {
		Map<BigDecimal, String> served = whatThePortalServes();

		/* Counted before anything is compared, because the comparison below is a
		   count of disagreements: over an empty sweep it is zero and passes while the
		   two rules disagree about every length there is. */
		assertThat(served)
				.as("the portal serves no races at all, so this compares nothing")
				.hasSizeGreaterThan(400);

		String distances = served.keySet().stream()
				.map(BigDecimal::toPlainString).collect(Collectors.joining(","));

		assertThat(db.sql("select count(*) from unnest(array[" + distances + "]::numeric(6,2)[]) as km"
						+ " where (" + howTheSchemaWorksItOut("race").replace("distance_km", "km") + ")"
						+ " is distinct from"
						+ " (" + howTheSchemaWorksItOut("result").replace("distance_km", "km") + ")")
				.query(Integer.class).single())
				.as("a race and a result of the same length are put in different categories")
				.isZero();
	}

	/**
	 * AND THE TWO KNOW THE SAME CATEGORIES, asked as what the rule can PRODUCE.
	 *
	 * <p><b>This read the words out of the expression until a round on 12.09.2026,
	 * and that was the one thing in this file doing what the file exists to stop.</b>
	 * A45 says the source text answers where something is written, never what
	 * happens, and the reviewer proved the difference: move the ultra threshold to a
	 * distance nothing reaches and no race is ever categorised ultra again, while
	 * the word {@code 'ultra'} sits in the text exactly as before. The assertion
	 * stayed green about a category that had stopped existing.
	 *
	 * <p>So the rule is RUN instead, over every distance the column can hold, and
	 * what comes back is the set of categories it can actually produce. A branch
	 * nothing can reach is simply not in that set.
	 *
	 * <p><b>Over every distance the COLUMN can hold, and not over a number typed
	 * here.</b> This swept to a hundred kilometres until a second round pointed out
	 * that a hundred was mine and nobody else's: the portal already serves races up
	 * to 529.93 km, and a branch turning above the swept bound would be unreachable
	 * to this case while being perfectly reachable in the portal. So the bound comes
	 * off the column itself - {@code numeric(6,2)} holds up to 9999.99 in steps of a
	 * hundredth - which is the largest distance that can ever be stored and needs
	 * nobody to keep it up to date.
	 *
	 * <p>Neither side is typed out here: one comes off the file the portal serves,
	 * the other off what the database answered, and the domain off the catalogue.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"race", "result"})
	void neitherSideCanProduceACategoryTheOtherDoesNot(String table) {
		String asked = howTheSchemaWorksItOut(table).replace("distance_km", "km");

		assertThat(db.sql("select distinct (" + asked + ")"
						+ " from generate_series(0::numeric, " + mostThatFits(table) + ", "
						+ smallestStep(table) + ") as km")
				.query(String.class).list())
				.as("the portal and `%s` can produce different categories", table)
				.containsExactlyInAnyOrderElementsOf(
						whatThePortalServes().values().stream().collect(Collectors.toSet()));
	}
	/**
	 * The largest distance the column can hold, asked of the catalogue.
	 *
	 * <p>`numeric(p,s)` holds up to ten raised to the digits before the point, less
	 * one step. Read rather than written, so that widening the column widens the
	 * sweep with it and nobody has to remember.
	 */
	private String mostThatFits(String table) {
		return db.sql("select (power(10, numeric_precision - numeric_scale)"
						+ " - power(10, -numeric_scale))::text"
						+ " from information_schema.columns"
						+ " where table_schema = current_schema()"
						+ "  and table_name = ? and column_name = 'distance_km'")
				.param(table).query(String.class).single();
	}

	/** And the smallest step it can tell apart, from the same place. */
	private String smallestStep(String table) {
		return db.sql("select power(10, -numeric_scale)::text"
						+ " from information_schema.columns"
						+ " where table_schema = current_schema()"
						+ "  and table_name = ? and column_name = 'distance_km'")
				.param(table).query(String.class).single();
	}
}
