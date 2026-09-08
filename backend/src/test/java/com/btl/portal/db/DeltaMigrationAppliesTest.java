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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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
 * <p><b>The cases are counted, and that is the point of the two floors at the
 * bottom.</b> Until 09.09.2026 the list below was four cases with nothing under
 * it, and a shape it did not hold went straight past: two countries exchanging
 * names, which the generator wrote as a migration that cannot run while the text
 * it wrote into that same migration said it refuses to. A hand written list is
 * not the fault; a hand written list with nothing underneath it is. So two
 * questions are asked of the catalogue and of the generator's own output rather
 * than of a memory:
 *
 * <ul>
 * <li>{@link #everyStatementADeltaCanWriteIsWrittenBySomeCase()}: the six
 * statements are six because there are two codebooks and a row can arrive, leave
 * or change, and the tables come out of {@code pg_tables};
 * <li>{@link #everyKeyADeltaCouldTripHasAVerdict()}: every key and foreign key in
 * the schema either has a case that puts pressure on it or a written decision
 * saying a delta cannot reach it.
 * </ul>
 *
 * <p><b>What the second floor deliberately leaves out, recorded here rather than
 * left to be found.</b> CHECK and NOT NULL constraints are not counted. They are
 * questions about one row's own fields, and a delta carries only what the
 * codebook says, so a row that breaks one of them is a broken source file and
 * fails identically on a first load. What is counted is every constraint whose
 * answer depends on other rows or on the order of statements, which is exactly
 * the primary keys, the unique keys and the foreign keys: those are the ones a
 * delta can trip where the same data loaded from empty would go straight in.
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
	 *                  is named after and what the floors below line up against
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

	/**
	 * Takes a country out of the list and hands back the name it gives up.
	 *
	 * Found rather than counted to, for the reason {@link #countryNamed} gives,
	 * and the name is read off the row being removed rather than written here: a
	 * literal would be a second copy of the country list and would go on passing
	 * the day somebody edits that row.
	 */
	private static String countryLeaves(ArrayNode rest, String code) {
		for (int at = 0; at < rest.size(); at++) {
			if (code.equals(rest.get(at).get("code").stringValue())) {
				return rest.remove(at).get("name").stringValue();
			}
		}

		throw new IllegalStateException("no country " + code + " in " + COUNTRIES);
	}

	/** Every town of one country out of the codebook, back to front so that a
	 *  removal does not move the rows still to be looked at. */
	private static void townsOfCountryLeave(ArrayNode towns, String code) {
		for (int at = towns.size() - 1; at >= 0; at--) {
			if (code.equals(towns.get(at).get(2).stringValue())) {
				towns.remove(at);
			}
		}
	}

	/** Where a town is swapped with the one below it. The middle of the file, so
	 *  that neither end of it can be what makes the case pass. */
	private static int middleOf(ArrayNode towns) {
		return towns.size() / 2;
	}

	/** What the town at that position is renamed to. Nothing in the codebook
	 *  carries this name, and no key covers a town's name anyway. */
	private static final String RENAMED = "Preimenovano Mesto";

	/** Swaps the town in the middle of the codebook with the one below it and
	 *  renames it, which is one town changing both what it is called and where in
	 *  the order it stands. */
	private static void renameAndMove(ArrayNode towns) {
		int at = middleOf(towns);
		ArrayNode moving = (ArrayNode) towns.get(at);
		ArrayNode neighbour = (ArrayNode) towns.get(at + 1);

		moving.set(1, StringNode.valueOf(RENAMED));
		towns.set(at, neighbour);
		towns.set(at + 1, moving);
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
								if ("GB".equals(town.get(2).stringValue())) {
									((ArrayNode) town).set(2, StringNode.valueOf("UK"));
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
							town.add(99_000_001);
							town.add("Zzgrad Proba");
							town.add("ZZ");
							towns.add(town);
						}),

				/* And the statement neither of the two above reaches. The last town
				   of the file is taken because it is the one town that leaves
				   without moving anything else; any other one shifts the rank of
				   every town below it, and this case is about the DELETE. */
				new Change("the last town of the codebook leaves",
						rest -> {
						},
						towns -> towns.remove(towns.size() - 1)),

				/* The town side of the deferral, and the case that says a town is
				   its mark and not its position. Two neighbours exchange ranks
				   inside one UPDATE, which a plain unique key over `rank` would
				   refuse on the first of the two rows to be written; one of them is
				   also renamed, so the row is doing both things a town can do to
				   itself in one migration. aTownKeepsItsIdentityThroughARename
				   reads the same change back by the mark. */
				new Change("a town is renamed and changes places with its neighbour",
						rest -> {
						},
						DeltaMigrationAppliesTest::renameAndMove),

				/* The half of country_name_unique that is allowed, which had no
				   case at all until 09.09.2026 while the two halves that are
				   refused had one each. The generator grants it in a single
				   condition, `code not in leaving`, and taking that condition
				   out turned a delta that runs into a refusal with the whole
				   suite still green.

				   The two Congos, because the pair is real: CD leaves with all
				   of its towns and CG takes the name it gives up. The deletes
				   against country stand ahead of the updates to it, so by the
				   time CG is written the name is nobody's. Both codebooks move,
				   and that is not decoration either: this is the one case where
				   a country goes while its towns are DELETED rather than
				   re-pointed, which is the DELETE against place standing ahead
				   of the DELETE against country. */
				new Change("a country leaves and another takes the name it gives up",
						rest -> {
							String freed = countryLeaves(rest, "CD");

							countryNamed(rest, "CG").put("name", freed);
						},
						towns -> townsOfCountryLeave(towns, "CD")));
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
	 * A town renamed and moved is the same town afterwards, and its row is the
	 * same row.
	 *
	 * <p>This is what the GeoNames mark is for (owner, 08.09.2026, ADL A16), and
	 * before it existed the answer was the other way round: a delta lined the two
	 * states of the codebook up by {@code rank}, so the contents of a row followed
	 * a position in a file, and taking one town out of the top of the codebook
	 * left the row that had held Shanghai holding Chongqing under the same
	 * {@code place.id}.
	 *
	 * <p><b>Why the change under test moves the town as well as renaming it.</b>
	 * A rename on its own would leave {@code place.id} unchanged whichever way the
	 * two states were lined up, so the assertion would hold for a reason that has
	 * nothing to do with the mark and would go on holding if the mark were
	 * ignored. Moved as well, the two answers come apart: lined up by the mark,
	 * one row takes both the new name and the new position; lined up by the
	 * position, the row that used to hold this town takes the neighbour's name
	 * instead. So the id being unchanged proves nothing by itself, and is not what
	 * is asserted; what is asserted is that it is unchanged <em>while</em> the name
	 * and the position both moved, and that the neighbour's row moved the other
	 * way under its own id.
	 */
	@Test
	void aTownKeepsItsIdentityThroughARename() throws Exception {
		ArrayNode before = (ArrayNode) JSON.readTree(repositoryRoot().resolve(PLACES));
		int at = middleOf(before);
		long moving = before.get(at).get(0).longValue();
		long neighbour = before.get(at + 1).get(0).longValue();

		Map<String, Object> was = rowOf(moving);
		Map<String, Object> neighbourWas = rowOf(neighbour);

		Ran ran = generate(new Change("a town is renamed and changes places with its neighbour",
				rest -> {
				},
				DeltaMigrationAppliesTest::renameAndMove));

		assertThat(ran.exitCode()).as("the generator said: %s", ran.errors()).isZero();
		jdbc.execute(ran.output());
		jdbc.execute("set constraints all immediate");

		Map<String, Object> now = rowOf(moving);
		Map<String, Object> neighbourNow = rowOf(neighbour);

		assertThat(now.get("id"))
				.as("the town is its mark, so the row that carried it still carries it")
				.isEqualTo(was.get("id"));
		assertThat(now.get("name"))
				.as("and it really was renamed, or the assertion above is about a migration that did nothing")
				.isEqualTo(RENAMED)
				.isNotEqualTo(was.get("name"));
		assertThat(now.get("rank"))
				.as("and it really did move, which is what tells a mark apart from a position")
				.isEqualTo(neighbourWas.get("rank"));

		assertThat(neighbourNow.get("id")).isEqualTo(neighbourWas.get("id"));
		assertThat(neighbourNow.get("name")).isEqualTo(neighbourWas.get("name"));
		assertThat(neighbourNow.get("rank"))
				.as("the neighbour went the other way, under its own id, rather than being overwritten")
				.isEqualTo(was.get("rank"));
	}

	private Map<String, Object> rowOf(long mark) {
		return db
				.sql("select id, name, rank from place where geonames_id = ?")
				.param(mark)
				.query()
				.singleRow();
	}

	// ------------------------------------------------- the deltas it will not write

	/**
	 * One shape of change the generator refuses, and what it has to say while
	 * refusing.
	 *
	 * @param change what is done to the codebooks
	 * @param says   the sentence the refusal is recognised by
	 * @param names  the country the refusal has to name, because a refusal that
	 *               does not say which one leaves somebody reading a diff of two
	 *               hundred and forty six lines
	 */
	record Refusal(Change change, String says, String names) {

		@Override
		public String toString() {
			return change.what();
		}
	}

	/**
	 * Both shapes, and they are one thing seen twice: a country taking a name that
	 * is still worn at the moment its statement runs. {@code country_name_unique}
	 * is plain, so PostgreSQL checks it as each row is written and neither the
	 * deferral at the top of a delta nor any order of the six statements helps.
	 *
	 * <p>The second of them stood open until 09.09.2026, and it was not an
	 * oversight in the list of cases so much as in what the list was a list of: the
	 * first shape had a case, so the constraint looked covered. Measured then:
	 * exchanging the names of the two Congos in {@code countries.json}, which is
	 * exactly what somebody writes the day they work out which is which, left the
	 * generator at exit code 0 and produced a migration that fails with
	 * {@code duplicate key value violates unique constraint "country_name_unique"}
	 * on a live database, carrying a header that said the script refuses to write
	 * such a delta.
	 */
	static List<Refusal> refusals() {
		return List.of(
				/* The first case above with one thing taken out of it, the new name,
				   which is also what says that case passes for a reason. */
				new Refusal(new Change("a country changes its code and keeps its name",
						rest -> countryNamed(rest, "GB").put("code", "UK"),
						towns -> {
							for (JsonNode town : towns) {
								if ("GB".equals(town.get(2).stringValue())) {
									((ArrayNode) town).set(2, StringNode.valueOf("UK"));
								}
							}
						}),
						"a country arrives carrying a name another country has not given up yet",
						"Ujedinjeno Kraljevstvo"),

				/* And the one that got past the list. Neither country arrives and
				   neither leaves: both are updated, in one UPDATE over a VALUES
				   list, and whichever of the two rows PostgreSQL writes first lands
				   on a name the other has not released. */
				new Refusal(new Change("two countries exchange names, which is one UPDATE over both",
						rest -> {
							ObjectNode brazzaville = countryNamed(rest, "CG");
							ObjectNode kinshasa = countryNamed(rest, "CD");
							String wasBrazzaville = brazzaville.get("name").stringValue();

							brazzaville.put("name", kinshasa.get("name").stringValue());
							kinshasa.put("name", wasBrazzaville);
						},
						towns -> {
						}),
						"a country takes a name another country gives up in the very same statement",
						"Kongo - Kinšasa"));
	}

	@ParameterizedTest
	@MethodSource("refusals")
	void theGeneratorRefusesADeltaItCannotWrite(Refusal refusal) throws Exception {
		Ran ran = generate(refusal.change());

		assertThat(ran.exitCode()).isNotZero();
		assertThat(ran.errors()).contains(refusal.says(), refusal.names());
		assertThat(ran.output()).isBlank();
	}

	// ------------------------------------------------------------------- the floors

	/**
	 * Every statement a delta can write is written by one of the cases above.
	 *
	 * <p>Six, and derived rather than counted to: there are two codebooks in the
	 * schema and a row of one can arrive, leave or change, which is an INSERT, a
	 * DELETE and an UPDATE against each. The table names come out of
	 * {@code pg_tables} through {@link DatabaseTest#tablesInTheSchema()}, so a
	 * fourth codebook table arriving fails here rather than being covered by
	 * silence, and the observed side is read out of the SQL the generator actually
	 * wrote rather than out of the generator's source.
	 */
	@Test
	void everyStatementADeltaCanWriteIsWrittenBySomeCase() throws Exception {
		Set<String> written = new LinkedHashSet<>();

		for (Change change : changes()) {
			written.addAll(statementsIn(generate(change).output()));
		}

		List<String> possible = tablesInTheSchema().stream()
				.filter(table -> !NOT_MAINTAINED_BY_A_DELTA.contains(table))
				.flatMap(table -> Stream.of("insert " + table, "update " + table, "delete " + table))
				.toList();

		assertThat(written)
				.as("a statement no case reaches is a statement nothing has ever run")
				.containsExactlyInAnyOrderElementsOf(possible);
	}

	/**
	 * The one table a delta leaves alone, named rather than left out quietly.
	 *
	 * The price list is not derived from a file: there is no {@code pricing.json},
	 * so the seven rows are written into the generator by hand and a change to them
	 * is a migration written by hand as well. Said in full at {@code PRICE_ROWS} in
	 * the generator. The day pricing moves into a file of its own, this line goes
	 * and three statements arrive.
	 */
	private static final Set<String> NOT_MAINTAINED_BY_A_DELTA = Set.of("price_row");

	/** The verb and the table of every statement in a migration, in order. */
	private static final Pattern STATEMENT = Pattern.compile("(?m)^(insert into|update|delete from) (\\w+)");

	private static Set<String> statementsIn(String sql) {
		Set<String> found = new LinkedHashSet<>();
		Matcher matcher = STATEMENT.matcher(sql);

		while (matcher.find()) {
			found.add(matcher.group(1).split(" ")[0] + " " + matcher.group(2));
		}

		return found;
	}

	/**
	 * One key of the schema and what a delta can do to it.
	 *
	 * @param constraint its name
	 * @param measuredBy the case that puts pressure on it, named exactly as the
	 *                   case names itself, or null
	 * @param decided    why a delta cannot reach it at all, or null
	 */
	record Verdict(String constraint, String measuredBy, String decided) {

		static Verdict measuredBy(String constraint, String change) {
			return new Verdict(constraint, change, null);
		}

		static Verdict outOfReach(String constraint, String why) {
			return new Verdict(constraint, null, why);
		}

		@Override
		public String toString() {
			return constraint;
		}
	}

	/**
	 * The verdict for every key and foreign key in the schema.
	 *
	 * Hand written, and floored twice below: the names have to be the names the
	 * catalogue gives, and every case named here has to be a case that exists. So a
	 * key added without a verdict fails, a verdict for a key that is gone fails, and
	 * a case renamed fails.
	 *
	 * The other direction is not asserted, and {@link #everyVerdictNamesACaseThatExists()}
	 * says both why and what it leaves open.
	 */
	private static final List<Verdict> VERDICTS = List.of(
			Verdict.outOfReach("country_pk", "a delta never writes an id; the sequence does"),
			Verdict.outOfReach("country_code_unique",
					"the code is what the two states of the country list are lined up by, so a code among the "
							+ "arrivals is one the database does not carry, and no statement changes a code"),
			Verdict.measuredBy("country_name_unique", "a country changes its code and keeps its name"),
			Verdict.measuredBy("country_name_unique", "two countries exchange names, which is one UPDATE over both"),
			/* And the shape this key allows, which is a verdict of its own rather
			   than the absence of one. A key covered only by refusals is a key
			   nothing has ever written through: the generator's permission for
			   this shape is one condition, and with no case naming it, taking
			   that condition out turned a delta that runs into a refusal and
			   left every test green (review, 09.09.2026).

			   It is the third verdict for this key, so removing it leaves the
			   key covered and nothing here fails. What that does and does not
			   hold is written out at everyVerdictNamesACaseThatExists. */
			Verdict.measuredBy("country_name_unique", "a country leaves and another takes the name it gives up"),
			Verdict.measuredBy("country_sort_order_unique", "a country joins the middle of the list, with a town in it"),

			Verdict.outOfReach("place_pk", "a delta never writes an id; the sequence does"),
			Verdict.outOfReach("place_geonames_id_unique",
					"the mark is what the two states of the town codebook are lined up by, so a mark among the "
							+ "arrivals is one the database does not carry, and the deletes stand ahead of the "
							+ "inserts, so a mark given up is free before one is taken"),
			Verdict.measuredBy("place_rank_unique", "a town is renamed and changes places with its neighbour"),
			Verdict.measuredBy("place_country_fk", "a country changes its code, and its towns move with it"),

			Verdict.outOfReach("price_row_pk", "a delta does not touch the price list at all"),
			Verdict.outOfReach("price_row_key_unique", "a delta does not touch the price list at all"),
			Verdict.outOfReach("price_row_sort_order_unique", "a delta does not touch the price list at all"));

	@Test
	void everyKeyADeltaCouldTripHasAVerdict() {
		List<String> declared = db
				.sql("select con.conname from pg_constraint con"
						+ " where con.conrelid = any (array[" + tableLiterals() + "]::regclass[])"
						+ "   and con.contype in ('p', 'u', 'f')"
						+ " order by con.conname")
				.query(String.class)
				.list();

		assertThat(declared).isNotEmpty();
		assertThat(VERDICTS.stream().map(Verdict::constraint).collect(Collectors.toSet()))
				.as("a key with no verdict, or a verdict for a key that is gone")
				.containsExactlyInAnyOrderElementsOf(Set.copyOf(declared));

		assertThat(VERDICTS)
				.as("a verdict says one thing or the other, never both and never neither")
				.allSatisfy(verdict -> assertThat(verdict.measuredBy() == null).isNotEqualTo(verdict.decided() == null));
	}

	/**
	 * The sentence in a delta's own header that says which keys the deferral at
	 * the top of it cannot reach.
	 *
	 * <p><b>Why this is not prose.</b> That header is written into every delta
	 * verbatim, and a delta is immutable the moment it is applied: a key added to
	 * the schema and left off that sentence is a wrong sentence in a file nobody
	 * may edit again. Found on 09.09.2026 with {@code place_geonames_id_unique}
	 * missing from it, while {@code V3__place.sql} named the very same key plain
	 * two files away.
	 *
	 * <p><b>Read out of the delta rather than out of the generator.</b> What
	 * ships is the header the generator wrote, and any delta carries the same one,
	 * so the first case is taken and nothing is said about which.
	 *
	 * <p><b>Both directions, and the catalogue answers both.</b> A key that was
	 * never declared DEFERRABLE has to be named there, because SET CONSTRAINTS
	 * cannot help with it; a key that was declared deferrable must not be, because
	 * that sentence would then be false about it. Primary keys are left out of the
	 * question: they are never deferrable and the sentence is not about them, and
	 * the floor that says the distinction is a real one is that both sides come
	 * back non-empty.
	 */
	@Test
	void theHeaderOfADeltaNamesTheKeysTheDeferralCannotReach() throws Exception {
		Matcher sentence = NEVER_DEFERRABLE.matcher(generate(changes().getFirst()).output());

		assertThat(sentence.find())
				.as("the sentence that lists them has been reworded, so nothing below is being read")
				.isTrue();

		Set<String> named = new LinkedHashSet<>();
		Matcher name = QUOTED.matcher(sentence.group(1));

		while (name.find()) {
			named.add(name.group(1));
		}

		assertThat(uniqueKeys(false)).isNotEmpty();
		assertThat(uniqueKeys(true))
				.as("a key that can be deferred, so the sentence would be false about it")
				.isNotEmpty()
				.doesNotContainAnyElementsOf(named);
		assertThat(named)
				.as("a plain key the header does not name, or a name for a key that is gone")
				.containsExactlyInAnyOrderElementsOf(uniqueKeys(false));
	}

	/** The unique keys of the codebook tables, on one side or the other of the
	 *  only distinction this is about. */
	private List<String> uniqueKeys(boolean deferrable) {
		return db
				.sql("select con.conname from pg_constraint con"
						+ " where con.conrelid = any (array[" + tableLiterals() + "]::regclass[])"
						+ "   and con.contype = 'u' and con.condeferrable = ?"
						+ " order by con.conname")
				.param(deferrable)
				.query(String.class)
				.list();
	}

	/** The list of names in that sentence, and the sentence it is in. */
	private static final Pattern NEVER_DEFERRABLE = Pattern
			.compile("((?:`\\w+`[,\\s]*(?:and\\s+)?)+)\\s*were never declared\\s+deferrable");

	/** One name out of that list. */
	private static final Pattern QUOTED = Pattern.compile("`(\\w+)`");

	/**
	 * And a verdict names a case that exists.
	 *
	 * <p>Without this the verdicts are prose: a case renamed leaves every line that
	 * pointed at it pointing at nothing, and the list above goes on looking
	 * complete. The other direction is deliberately not asserted here, because a
	 * case need not press a key to be worth having: "the last town of the codebook
	 * leaves" presses none.
	 *
	 * <p><b>Which cases nothing holds, counted rather than assumed.</b> A case is
	 * held when taking it away takes something away that a floor counts. Asked of
	 * the generator, case by case, on 09.09.2026: "a country joins the middle of the
	 * list, with a town in it" is the only one that writes the INSERT against the
	 * town codebook, so the statement floor holds it; "a country changes its code,
	 * and its towns move with it" and "a town is renamed and changes places with its
	 * neighbour" are the only case named for {@code place_country_fk} and
	 * {@code place_rank_unique}, so the verdict floor holds them. The remaining two
	 * are held by neither. "the last town of the codebook leaves" writes only the
	 * DELETE against the town codebook, which "a country leaves and another takes
	 * the name it gives up" writes as well, and no verdict names it; and that second
	 * case writes nothing another case does not, while the key it is named for
	 * carries two other verdicts. Either can be deleted along with its verdict and
	 * the suite stays green.
	 *
	 * <p><b>Why that is written down instead of guarded.</b> Deleting a case and the
	 * line that names it leaves nothing behind for a floor to miss, and a rule that
	 * every case must be needed would have been false about those two the day it was
	 * written. What does hold is narrower and is what those cases are for: while the
	 * case is there, the generator's behaviour under it is measured, and taking
	 * {@code code not in leaving} out of the generator fails "a country leaves and
	 * another takes the name it gives up".
	 */
	@Test
	void everyVerdictNamesACaseThatExists() {
		Set<String> cases = Stream
				.concat(changes().stream().map(Change::what), refusals().stream().map(one -> one.change().what()))
				.collect(Collectors.toSet());

		Set<String> named = VERDICTS.stream()
				.map(Verdict::measuredBy)
				.filter(one -> one != null)
				.collect(Collectors.toSet());

		assertThat(named).isNotEmpty();
		assertThat(cases).containsAll(named);
	}

	private String tableLiterals() {
		return tablesInTheSchema().stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));
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

		copyOver(root.resolve(COUNTRIES), before.resolve("countries.json"));
		copyOver(root.resolve(PLACES), before.resolve("places.json"));

		ObjectNode countries = (ObjectNode) JSON.readTree(root.resolve(COUNTRIES));
		ArrayNode towns = (ArrayNode) JSON.readTree(root.resolve(PLACES));

		change.countries().accept((ArrayNode) countries.get("rest"));
		change.places().accept(towns);

		Files.writeString(after.resolve("countries.json"), JSON.writeValueAsString(countries), StandardCharsets.UTF_8);
		Files.writeString(after.resolve("places.json"), JSON.writeValueAsString(towns), StandardCharsets.UTF_8);

		return run(root, python(), GENERATOR, "--delta", "--stdout",
				"--before", before.toString(), "--after", after.toString());
	}

	/** Overwriting, because one test now runs the generator more than once and the
	 *  temporary directory is the same one throughout that test. */
	private static void copyOver(Path from, Path to) throws IOException {
		Files.copy(from, to, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
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

	record TownRow(long geonamesId, String name, String countryCode, String englishName, int rank) {
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
						select p.geonames_id, p.name, c.code as country_code, p.english_name, p.rank
						  from place p
						  join country c on c.id = p.country_id
						 order by p.rank
						""")
				.query((rs, row) -> new TownRow(rs.getLong("geonames_id"), rs.getString("name"),
						rs.getString("country_code"), rs.getString("english_name"), rs.getInt("rank")))
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
			rows.add(new TownRow(town.get(0).longValue(), town.get(1).stringValue(), town.get(2).stringValue(),
					town.size() > 3 ? town.get(3).stringValue() : null, index + 1));
		}

		return rows;
	}
}
