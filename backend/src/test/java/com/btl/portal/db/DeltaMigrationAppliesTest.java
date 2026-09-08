package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.StringNode;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The migration {@code --delta} writes is run against a real database.
 *
 * <p><b>Why this exists.</b> Nothing ran the generator and nothing ran what it
 * wrote. The order of the six statements it emits was decided by reasoning and
 * then described, in the migration's own header, as "the only order that runs,
 * and it was found by running it": true of the inputs it had been tried on, and
 * of no others. Two inputs measured on 09.09.2026 broke it, both with
 * {@code update or delete on table "country" violates foreign key constraint
 * "place_country_fk" on table "place"}, and neither could have been caught by
 * reading the generator, because what is wrong is not what it writes but what
 * PostgreSQL does with it.
 *
 * <p><b>How the two states are made.</b> The codebooks the database was loaded
 * from are the {@code before} side, copied as they are; {@code ReferenceDataMatchesCodebookTest}
 * is what says the database really holds them. The {@code after} side is the same
 * two files with one thing changed. So the change under test is the only
 * difference between the two sides, and the generator is handed both through
 * {@code --before} and {@code --after} rather than being asked to read git and
 * the working tree. Nothing under {@code frontend/} is written, and no migration
 * file is written either: {@code --stdout} hands the SQL back.
 *
 * <p><b>What each case measures</b>, and each was chosen because it fails without
 * one particular part of the fix:
 *
 * <ul>
 * <li>a country changing its code fails under the order this replaced, at
 * {@code country_deletes}, because the towns that name it are only re-pointed
 * three statements later;
 * <li>a country joining the middle of the list fails without
 * {@code set constraints all deferred}, because its {@code sort_order} is held by
 * a country that has not moved down yet;
 * <li>a town leaving covers the one statement the other two do not reach.
 * </ul>
 *
 * <p><b>What it does not measure.</b> The test transaction is rolled back, so the
 * COMMIT that would check the deferred order keys never happens. {@code set
 * constraints all immediate} is issued after the delta instead, which makes
 * PostgreSQL check them there and then, so a delta that ends with two towns in
 * one position fails here and not silently.
 */
class DeltaMigrationAppliesTest extends DatabaseTest {

	private static final ObjectMapper JSON = new ObjectMapper();

	private static final String COUNTRIES = "frontend/src/data/countries.json";
	private static final String PLACES = "frontend/public/mock/places.json";

	private static final String GENERATOR = "backend/tools/generate_reference_migrations.py";

	@Autowired
	JdbcTemplate jdbc;

	@TempDir
	Path work;

	/**
	 * One change to the codebooks, and the two halves of it.
	 *
	 * @param what      what the change is, in words, which is also what a failure
	 *                  is named after
	 * @param countries what it does to the country list
	 * @param places    what it does to the town codebook
	 */
	record Change(String what, Consumer<ArrayNode> countries, Consumer<ArrayNode> places) {

		@Override
		public String toString() {
			return what;
		}
	}

	/**
	 * The country a change needs, found rather than counted to.
	 *
	 * A position written here would be a second copy of the country list, kept in
	 * a test, going stale the day one country is added above it.
	 */
	private static ObjectNode countryNamed(ArrayNode rest, String code) {
		for (JsonNode one : rest) {
			if (code.equals(one.get("code").stringValue())) {
				return (ObjectNode) one;
			}
		}

		throw new IllegalStateException("no country " + code + " in " + COUNTRIES);
	}

	static List<Change> changes() {
		return List.of(
				/* The case the old order died on. GB leaves and UK arrives, and
				   every town that named GB has to be re-pointed before GB can go.
				   The name moves with the code, because the insert of UK is the
				   first statement of the delta and country_name_unique is plain:
				   a country arriving with a name that has not been given up is
				   refused by the generator, which is what
				   theGeneratorRefusesADeltaItCannotWrite measures. */
				new Change("a country changes its code, and its towns move with it",
						rest -> {
							ObjectNode britain = countryNamed(rest, "GB");
							britain.put("code", "UK");
							britain.put("name", "Velika Britanija");
						},
						towns -> {
							for (JsonNode town : towns) {
								if ("GB".equals(town.get(1).stringValue())) {
									((ArrayNode) town).set(1, StringNode.valueOf("UK"));
								}
							}
						}),

				/* The case that needs the deferral. A country lands in the middle
				   of the list, so every country below it moves down one, and the
				   insert of the new one happens first, into a sort_order somebody
				   else is still holding. The town in it is there so that the
				   arriving country is also one a town names in the same migration,
				   which is the reason the insert has to come first at all. */
				new Change("a country joins the middle of the list, with a town in it",
						rest -> {
							ObjectNode arriving = JSON.createObjectNode();
							arriving.put("code", "ZZ");
							arriving.put("name", "Zzemlja Proba");
							rest.insert(rest.size() / 2, arriving);
						},
						towns -> {
							ArrayNode town = JSON.createArrayNode();
							town.add("Zzgrad Proba");
							town.add("ZZ");
							towns.add(town);
						}),

				/* And the statement neither of the two above reaches. The last town
				   of the file is the one town that can leave on its own: any other
				   one shifts the rank of every town below it, because a town is
				   lined up by its position and not by anything about the town
				   (PlaceIdentityTest). */
				new Change("the last town of the codebook leaves",
						rest -> {
						},
						towns -> towns.remove(towns.size() - 1)));
	}

	@ParameterizedTest
	@MethodSource("changes")
	void theMigrationTheGeneratorWritesForItGoesIn(Change change) throws Exception {
		Ran ran = generate(change);

		assertThat(ran.exitCode()).as("the generator said: %s", ran.errors()).isZero();
		assertThat(ran.output()).as("a delta with no statements in it would leave every assertion below true")
				.isNotBlank();

		jdbc.execute(ran.output());

		/* The order keys are deferred by the migration's first statement and this
		   transaction is rolled back, so without this the check they were deferred
		   to would never happen at all. */
		jdbc.execute("set constraints all immediate");

		assertThat(countriesInTheDatabase()).isEqualTo(countriesIn(work.resolve("after")));
		assertThat(townsInTheDatabase()).isEqualTo(townsIn(work.resolve("after")));
	}

	/**
	 * And the one shape of change it will not write, it refuses instead of writing.
	 *
	 * A country arriving with a name another country has not given up. The insert
	 * is the first statement of a delta, because a town may be moving to the
	 * country that is arriving, and {@code country_name_unique} is plain: it was
	 * never declared deferrable, so {@code SET CONSTRAINTS} cannot put it off and
	 * it is checked as the row is written. There is no order of the six statements
	 * that both frees the name and has the country in place in time, so this is a
	 * migration written by hand, and the generator says so instead of writing SQL
	 * that stops halfway through on a live database.
	 *
	 * <p>It is the first case above with one thing taken out of it, the new name,
	 * which is also what says that case passes for a reason.
	 */
	@Test
	void theGeneratorRefusesADeltaItCannotWrite() throws Exception {
		Ran ran = generate(new Change("a country changes its code and keeps its name",
				rest -> countryNamed(rest, "GB").put("code", "UK"),
				towns -> {
					for (JsonNode town : towns) {
						if ("GB".equals(town.get(1).stringValue())) {
							((ArrayNode) town).set(1, "UK");
						}
					}
				}));

		assertThat(ran.exitCode()).isNotZero();
		assertThat(ran.errors()).contains("a country arrives carrying a name another country has not given up yet",
				"Ujedinjeno Kraljevstvo");
		assertThat(ran.output()).isBlank();
	}

	// ----------------------------------------------------------------- the two states

	/** What one run of the generator said, in full. */
	record Ran(int exitCode, String output, String errors) {
	}

	/**
	 * Writes the two states and runs the generator over them.
	 *
	 * The before side is the two files exactly as they are on disk, which is what
	 * the database was loaded from; the after side is those two files with the
	 * change applied. Copying rather than pointing at {@code frontend/} for the
	 * before side as well, so that the two arguments are the same kind of thing
	 * and a delta measured against something else cannot pass unnoticed.
	 */
	private Ran generate(Change change) throws Exception {
		Path root = repositoryRoot();
		Path before = Files.createDirectories(work.resolve("before"));
		Path after = Files.createDirectories(work.resolve("after"));

		Files.copy(root.resolve(COUNTRIES), before.resolve("countries.json"));
		Files.copy(root.resolve(PLACES), before.resolve("places.json"));

		ObjectNode countries = (ObjectNode) JSON.readTree(root.resolve(COUNTRIES));
		ArrayNode towns = (ArrayNode) JSON.readTree(root.resolve(PLACES));

		change.countries().accept((ArrayNode) countries.get("rest"));
		change.places().accept(towns);

		Files.writeString(after.resolve("countries.json"), JSON.writeValueAsString(countries), StandardCharsets.UTF_8);
		Files.writeString(after.resolve("places.json"), JSON.writeValueAsString(towns), StandardCharsets.UTF_8);

		return run(root, python(), GENERATOR, "--delta", "--stdout",
				"--before", before.toString(), "--after", after.toString());
	}

	/**
	 * The interpreter this machine calls Python, asked rather than assumed.
	 *
	 * {@code python3} on a Linux runner and {@code python} on the owner's Windows,
	 * where {@code python3} is a stub that prints an invitation to the Microsoft
	 * Store, so the answer has to be a version and not merely an exit code. Fails
	 * loudly when there is none: a floor that steps aside because it cannot find
	 * its tool would go quiet on the day the tool is what is broken.
	 */
	private static String python() throws Exception {
		List<String> tried = new ArrayList<>();

		for (String candidate : List.of("python3", "python", "py")) {
			try {
				Ran ran = run(repositoryRoot(), candidate, "--version");

				if (ran.exitCode() == 0 && (ran.output() + ran.errors()).stripLeading().matches("(?s)Python \\d.*")) {
					return candidate;
				}

				tried.add(candidate + ": " + ran.exitCode() + " " + ran.output().strip() + ran.errors().strip());
			}
			catch (IOException absent) {
				tried.add(candidate + ": " + absent.getMessage());
			}
		}

		throw new IllegalStateException("no Python on this machine, and " + GENERATOR + " is written in it: " + tried);
	}

	/**
	 * Runs a command and hands back everything it said.
	 *
	 * The error stream goes to a file rather than to a second pipe this thread
	 * would have to drain: a delta for one changed country is a hundred kilobytes
	 * of SQL, and reading one pipe to the end while the other fills is how a test
	 * hangs for ever instead of failing.
	 */
	private static Ran run(Path within, String... command) throws Exception {
		Path said = Files.createTempFile("generator", ".err");

		try {
			Process process = new ProcessBuilder(command)
					.directory(within.toFile())
					.redirectError(said.toFile())
					.start();

			String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

			return new Ran(process.waitFor(), output, Files.readString(said, StandardCharsets.UTF_8));
		}
		finally {
			Files.deleteIfExists(said);
		}
	}

	// ----------------------------------------------------------------- the comparison

	record CountryRow(String code, String name, boolean inRegion, int sortOrder) {
	}

	record TownRow(String name, String countryCode, String englishName, int rank) {
	}

	private List<CountryRow> countriesInTheDatabase() {
		return db
				.sql("select code, name, in_region, sort_order from country order by sort_order")
				.query((rs, row) -> new CountryRow(rs.getString("code"), rs.getString("name"),
						rs.getBoolean("in_region"), rs.getInt("sort_order")))
				.list();
	}

	private List<TownRow> townsInTheDatabase() {
		return db
				.sql("""
						select p.name, c.code as country_code, p.english_name, p.rank
						  from place p
						  join country c on c.id = p.country_id
						 order by p.rank
						""")
				.query((rs, row) -> new TownRow(rs.getString("name"), rs.getString("country_code"),
						rs.getString("english_name"), rs.getInt("rank")))
				.list();
	}

	private static List<CountryRow> countriesIn(Path directory) {
		JsonNode file = JSON.readTree(directory.resolve("countries.json"));
		List<CountryRow> rows = new ArrayList<>();

		addCountries(rows, file.get("region"), true);
		addCountries(rows, file.get("rest"), false);

		return rows;
	}

	private static void addCountries(List<CountryRow> into, JsonNode listed, boolean inRegion) {
		for (JsonNode country : listed) {
			into.add(new CountryRow(country.get("code").stringValue(), country.get("name").stringValue(), inRegion,
					into.size() + 1));
		}
	}

	private static List<TownRow> townsIn(Path directory) {
		JsonNode file = JSON.readTree(directory.resolve("places.json"));
		List<TownRow> rows = new ArrayList<>();

		for (int index = 0; index < file.size(); index++) {
			JsonNode town = file.get(index);
			rows.add(new TownRow(town.get(0).stringValue(), town.get(1).stringValue(),
					town.size() > 2 ? town.get(2).stringValue() : null, index + 1));
		}

		return rows;
	}
}
