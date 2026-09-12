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
		String distances = whatThePortalServes().keySet().stream()
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
	 * AND THE TWO KNOW THE SAME WORDS.
	 *
	 * <p>The case above compares distance by distance and would still pass if both
	 * sides quietly grew a sixth category that no race the portal serves happens to
	 * reach. Neither side is typed out here: one set comes off the file, the other
	 * off what the database answered.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"race", "result"})
	void neitherSideKnowsAWordTheOtherDoesNot(String table) {
		assertThat(whatThePortalServes().values().stream().collect(Collectors.toSet()))
				.as("the portal and `%s` name different categories", table)
				.isEqualTo(howTheSchemaWorksItOut(table).lines()
						.flatMap(one -> java.util.regex.Pattern.compile("'([a-z]+)'::text")
								.matcher(one).results().map(found -> found.group(1)))
						.collect(Collectors.toSet()));
	}
}
