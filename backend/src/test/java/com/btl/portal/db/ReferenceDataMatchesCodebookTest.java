package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

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

	/** A town as both sides hold it. The mark first, because it is what the town
	 *  is: name and country repeat, and the rank is a position in the file. */
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
		JsonNode file = read("frontend/public/mock/places.json");

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
