package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The two codebooks in the database are the two codebooks the portal ships.
 *
 * This is the floor under V2, V3 and every delta migration after them. All of
 * them are written by {@code backend/tools/generate_reference_migrations.py} out
 * of files that live under {@code frontend/}, and a generated file with nothing
 * checking it is a file that drifts the first time somebody edits the SQL by
 * hand, or changes the source and forgets to write the migration that carries the
 * change. Rather than trusting either, this reads the same two source files and
 * compares them against what actually loaded, row by row and in order.
 *
 * <p><b>What to do when this fails, because until 08.09.2026 the answer written
 * everywhere in the repository was the one thing that must not be done.</b> The
 * codebook and the database have parted company, and the way back is the next
 * migration and never the last one:
 *
 * <pre>python backend/tools/generate_reference_migrations.py --delta</pre>
 *
 * which writes what changed as its own V file. Regenerating V2 or V3 over
 * themselves passes here and on CI, because both start from an empty database,
 * and stops the backend from starting on QA, where those files have been applied
 * since the day they merged. The generator refuses to do it and
 * {@link MigrationsAreImmutableTest} fails if something else does.
 *
 * The source files are read and never written; nothing under {@code frontend/}
 * is touched. The precedent is the front end's own suite, which runs against the
 * generated data on disk rather than against a fixture written by hand, and
 * catches for that reason things a fixture would not.
 *
 * Order is part of the comparison and not decoration. The town codebook is in
 * order of size, and the field that suggests towns walks it and stops at the
 * first eight matches, which is why typing "beo" ends at Beograd and not at the
 * village of Beotince. The population is not in the codebook; the order is all
 * that is left of it, so a codebook loaded in the wrong order is a codebook that
 * answers differently.
 *
 * What the {@code order by rank} below does not prove, measured rather than
 * assumed: swapping it for {@code order by id} leaves this test green, because
 * the migration inserts in rank order and the two run together. That is not a
 * hole. What carries the claim is that {@code rank} is one of the compared
 * fields, so a town holding the wrong rank fails whichever column the rows were
 * fetched in; the {@code order by} only lines the two lists up.
 */
class ReferenceDataMatchesCodebookTest extends DatabaseTest {

	private static final ObjectMapper JSON = new ObjectMapper();

	/** How many mismatching rows a failure prints before it stops. Forty seven
	 *  thousand of them would bury the first one, which is the one worth reading. */
	private static final int SHOWN_ON_FAILURE = 5;

	record CountryRow(String code, String name, boolean inRegion, int sortOrder) {
	}

	/** A name in a country, which is what the owner's decision of 02.10.2026 says may be carried by one
	 *  town only. */
	record NameInACountry(String country, String name) {
	}

	/** A town as both sides hold it. The mark first, because it is what the town
	 *  is: a name is unique within its country since 02.10.2026, but a label in it is the nearest
	 *  bigger town and moves when GeoNames does, and the rank is a position in the file. */
	record PlaceRow(long geonamesId, String name, String countryCode, String englishName, int rank) {
	}

	@Test
	void theCountryTableIsTheListTheFormIsFilledFrom() {
		JsonNode file = read("frontend/src/data/countries.json");

		List<CountryRow> expected = new ArrayList<>();
		addCountries(expected, file.get("region"), true);
		addCountries(expected, file.get("rest"), false);

		List<CountryRow> actual = db
				.sql("select code, name, in_region, sort_order from country order by sort_order")
				.query((rs, row) -> new CountryRow(rs.getString("code"), rs.getString("name"),
						rs.getBoolean("in_region"), rs.getInt("sort_order")))
				.list();

		/* Two hundred and forty six, eleven of them the region at the top of the
		   list in the order the owner set. Written out so that a source file that
		   quietly shrank is a failure here rather than a shorter list that matches
		   a shorter table. */
		assertThat(expected).hasSize(246);
		assertThat(expected.stream().filter(CountryRow::inRegion).count()).isEqualTo(11);

		sameRows(expected, actual);
	}

	@Test
	void thePlaceTableIsTheTownCodebook() {
		JsonNode file = read("frontend/src/test/mock/places.json");

		List<PlaceRow> expected = new ArrayList<>();

		for (int index = 0; index < file.size(); index++) {
			JsonNode place = file.get(index);
			String english = place.size() > 3 ? place.get(3).stringValue() : null;
			expected.add(new PlaceRow(place.get(0).longValue(), place.get(1).stringValue(),
					place.get(2).stringValue(), english, index + 1));
		}

		List<PlaceRow> actual = db.sql("""
						select p.geonames_id, p.name, c.code as country_code, p.english_name, p.rank
						  from place p
						  join country c on c.id = p.country_id
						 order by p.rank
						""")
				.query((rs, row) -> new PlaceRow(rs.getLong("geonames_id"), rs.getString("name"),
						rs.getString("country_code"), rs.getString("english_name"), rs.getInt("rank")))
				.list();

		/* Forty seven thousand and sixteen, measured on the export of 08.09.2026.
		   Written out for the reason the country count is: a codebook that quietly
		   shrank is a failure here rather than a shorter list matching a shorter
		   table. */
		assertThat(expected).hasSize(47_016);

		sameRows(expected, actual);
	}

	/**
	 * No two towns of one country carry one name in the SOURCE the database is loaded from.
	 *
	 * <p>Owner, 02.10.2026, PDL "Odluke iz ciscenja nalaza (02.10.2026, vlasnik)", the entry that begins
	 * „Istoimena mesta u istoj drzavi dobijaju u zagradi": towns of one country that were called alike
	 * carry the nearest bigger town in brackets, and the database refuses a second one
	 * ({@code place_country_name_unique}). That key is the floor under the database. This is the floor
	 * under the file, and it asks the question a person regenerating the file needs answered.
	 *
	 * <p><b>Why the file needs its own.</b> {@code btl-produkt/istorijski-podaci/napravi-mesta.py} writes
	 * the codebook out of GeoNames and knows nothing about brackets: rebuilt from a newer export it
	 * returns every namesake bare again, and {@link #thePlaceTableIsTheTownCodebook()} would say only
	 * that some thousands of rows differ from the database. What was forgotten is a step, the one
	 * {@code oznaci-istoimena-mesta.py} does, and this names it. A mutation of the file that gives one
	 * town the name of another town of its country fails here and not only in the row comparison.
	 *
	 * <p><b>The pair is the country and the name compared WITHOUT regard to case and WITH regard to
	 * marks</b> (review of PR 464, answered 02.10.2026): "Dolenja vas" and "Dolenja Vas" are one name to a
	 * reader and "Münster" and "Munster" are not. The key in the database is over the EXACT name, so it
	 * is this floor, and its twin over the same file in the frontend ({@code data.test.tsx}), that hold
	 * the case. {@code toLowerCase(Locale.ROOT)} gives the same text as {@code str.lower()} in the tool that
	 * labels the file and as {@code toLowerCase()} in the portal, which was measured over every name of the
	 * codebook, 47,678 of them, and gives the same text as {@code lower()} in PostgreSQL under the column's
	 * collation as well.
	 */
	@Test
	void noTwoTownsOfOneCountryCarryOneName() {
		JsonNode file = read("frontend/src/test/mock/places.json");

		assertThat(townsUnderOneName(file).stream().limit(SHOWN_ON_FAILURE).toList())
				.as("towns of one country under one name: run btl-produkt/istorijski-podaci/oznaci-istoimena-mesta.py"
						+ " over the codebook, then --delta, before this file is committed")
				.isEmpty();
		assertThat(file.size()).as("a source that quietly shrank would have nothing to repeat").isGreaterThan(40_000);
	}

	/**
	 * THE FLOOR ABOVE SEES TWO NAMES THAT DIFFER ONLY IN CASE, AND NOT TWO THAT DIFFER IN A MARK.
	 *
	 * <p>Asked of rows it can be wrong about, because the shipped file cannot show it: once the labels are
	 * given the floor passes whether it compares the name exactly or without regard to case, so a floor
	 * weakened back to the exact name would stay green over the file it is for. The two pairs are the real
	 * ones the review of PR 464 found, Dolenja vas in Slovenia and C.A. Rosetti in Romania; a mark is not a
	 * capital, so Münster and Munster are two names here as they are in the key, and one name in two
	 * countries is not a pair.
	 */
	@Test
	void theFloorSeesTwoNamesThatDifferOnlyInCaseAndNotTwoThatDifferInAMark() {
		assertThat(townsUnderOneName(JSON.readTree("[[3201849,\"Dolenja vas\",\"SI\"],[8986894,\"Dolenja Vas\",\"SI\"]]")))
				.containsExactly("dolenja vas in SI: towns [3201849, 8986894]");
		assertThat(townsUnderOneName(JSON.readTree("[[682679,\"C.A. Rosetti\",\"RO\"],[682680,\"C.a. Rosetti\",\"RO\"]]")))
				.containsExactly("c.a. rosetti in RO: towns [682679, 682680]");
		assertThat(townsUnderOneName(JSON.readTree("[[2867543,\"Münster\",\"DE\"],[2867542,\"Munster\",\"DE\"]]")))
				.isEmpty();
		assertThat(townsUnderOneName(JSON.readTree("[[4930956,\"Boston\",\"US\"],[2655138,\"Boston\",\"GB\"]]")))
				.isEmpty();
	}

	/** Every name of a country that more than one town of it carries, as "name in COUNTRY: towns [marks]". */
	private static List<String> townsUnderOneName(JsonNode places) {
		Map<NameInACountry, List<Long>> carried = new LinkedHashMap<>();

		for (JsonNode place : places) {
			carried.computeIfAbsent(
					new NameInACountry(place.get(2).stringValue(), place.get(1).stringValue().toLowerCase(Locale.ROOT)),
					pair -> new ArrayList<>()).add(place.get(0).longValue());
		}

		return carried.entrySet().stream()
				.filter(pair -> pair.getValue().size() > 1)
				.map(pair -> "%s in %s: towns %s".formatted(pair.getKey().name(), pair.getKey().country(),
						pair.getValue()))
				.toList();
	}

	/**
	 * Kosovo is carried as part of Serbia and the code appears nowhere.
	 *
	 * Owner, 11.08.2026, ADL A16. GeoNames publishes those towns under XK and the
	 * generator that builds the codebook rewrites them to RS on the way through,
	 * so this is a statement about what arrived rather than about what the rule
	 * says. The schema refuses XK as a country as well, which is the same decision
	 * said in the place where it cannot be forgotten.
	 */
	@Test
	void noRowCarriesTheCodeTheOwnerRemoved() {
		assertThat(db.sql("select count(*) from country where code = 'XK'").query(Long.class).single()).isZero();
	}

	private static void addCountries(List<CountryRow> into, JsonNode listed, boolean inRegion) {
		for (JsonNode country : listed) {
			into.add(new CountryRow(country.get("code").stringValue(), country.get("name").stringValue(), inRegion,
					into.size() + 1));
		}
	}

	private static JsonNode read(String relativePath) {
		Path source = repositoryRoot().resolve(relativePath);

		/* Never skipped when the file is not there. A floor that steps aside when
		   it cannot find its source is not a floor: it would go quiet on exactly
		   the day the codebook moved, which is the day it is needed. */
		assertThat(Files.isRegularFile(source)).as("codebook %s", source).isTrue();

		return JSON.readTree(source);
	}

	/**
	 * The two lists hold the same rows in the same order.
	 *
	 * Written out rather than left to a list comparison because these lists run to
	 * forty seven thousand rows: a failure has to say which row and what about it,
	 * not print both lists.
	 */
	private static <T> void sameRows(List<T> expected, List<T> actual) {
		assertThat(actual).hasSameSizeAs(expected);

		List<String> differences = new ArrayList<>();

		for (int index = 0; index < expected.size() && differences.size() < SHOWN_ON_FAILURE; index++) {
			if (!expected.get(index).equals(actual.get(index))) {
				differences.add("row %d: codebook has %s, database has %s"
						.formatted(index + 1, expected.get(index), actual.get(index)));
			}
		}

		assertThat(differences).isEmpty();
	}
}
