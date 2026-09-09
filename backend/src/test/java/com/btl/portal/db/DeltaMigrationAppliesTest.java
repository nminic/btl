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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The migration {@code --delta} writes is run against a real database.
 *
 * <p><b>Why this exists.</b> Nothing ran the generator and nothing ran what it
 * wrote. The order of the statements it emits was decided by reasoning and
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
 * <p><b>The cases are counted, and that is the point of the floors at the
 * bottom.</b> Until 09.09.2026 the list below was four cases with nothing under
 * it, and a shape it did not hold went straight past: two countries exchanging
 * names, which the generator wrote as a migration that cannot run while the text
 * it wrote into that same migration said it refuses to. A hand written list is
 * not the fault; a hand written list with nothing underneath it is. So the
 * questions are asked of the catalogue and of the generator's own output rather
 * than of a memory:
 *
 * <ul>
 * <li>{@link #everyStatementADeltaCanWriteIsWrittenBySomeCase()}: there are two
 * codebooks and a row can arrive or change, the tables come out of
 * {@code pg_tables}, and a row LEAVING is the shape the generator refuses;
 * <li>{@link #everyKeyADeltaCouldTripHasAVerdict()}: every key and foreign key in
 * the schema either has a case that puts pressure on it or a written decision
 * saying a delta cannot reach it;
 * <li>{@link #theKeysThatPointAtACodebookRefuseToLetOneLeave()}: what the schema
 * says about a codebook row somebody is standing on, and what a delta's header
 * says about it, are the same thing.
 * </ul>
 *
 * <p><b>Both directions of "a codebook never loses a row", and why it takes two
 * kinds of case.</b> The generator refuses to write the DELETE
 * ({@link #theGeneratorRefusesADeltaItCannotWrite(Refusal)}), and PostgreSQL
 * refuses to run it ({@link #theDeleteADeltaWillNotWriteIsRefusedByTheKeyItWouldTrip(Pressure)}).
 * Neither says the other: a refusal with nothing behind it is a script being
 * careful about a DELETE that would have gone straight through, and a key with
 * nothing in front of it is a migration that stops halfway on a live database.
 * The second pair of cases is what found this on 09.09.2026, when four keys
 * pointing at the codebooks were left at the default NO ACTION and this file
 * asked {@code pg_constraint} only about keys standing ON them.
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

	/**
	 * The changes a delta is written for, and there are two of them because a row
	 * of a codebook can arrive or change and that is all it can do.
	 *
	 * <p>There were five here until 09.09.2026, and the three that are gone are
	 * gone to {@link #refusals()} rather than deleted: each of them takes a row out
	 * of a codebook, and a delta no longer writes that statement at all. Which is
	 * not obvious for one of them, so it is said here. A country is lined up by its
	 * {@code code}, so a country CHANGING its code is one country leaving and
	 * another arriving, and the leaving half is a row members and events are
	 * standing on.
	 */
	static List<Change> changes() {
		return List.of(
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
						DeltaMigrationAppliesTest::renameAndMove));
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
	 * The town the case below takes out, named the way the refusal has to name it,
	 * and read off the codebook rather than written here: a literal would be a
	 * second copy of the codebook and would go on passing the day GeoNames recuts
	 * it. The mark is in it because the name alone is not an identity - one
	 * thousand six hundred and sixteen name and country pairs occur more than once
	 * (A16) - and because a refusal that leaves somebody guessing which Plymouth is
	 * half a refusal.
	 */
	private static String lastTownOfTheCodebook() {
		ArrayNode towns = (ArrayNode) JSON.readTree(repositoryRoot().resolve(PLACES));
		JsonNode last = towns.get(towns.size() - 1);

		return last.get(1).stringValue() + " (" + last.get(0).longValue() + ")";
	}

	/**
	 * The first two are one thing seen twice: a country taking a name that is still
	 * worn at the moment its statement runs. {@code country_name_unique} is plain,
	 * so PostgreSQL checks it as each row is written and neither the deferral at
	 * the top of a delta nor any order of its statements helps.
	 *
	 * <p><b>The last three are the other refusal, added 09.09.2026, and it is about
	 * a row LEAVING a codebook.</b> V7 gave {@code competitor} and
	 * {@code btl_event} four keys pointing at the two codebooks, all four
	 * ON DELETE RESTRICT, so a town or a country cannot go while one member or one
	 * event names it. Which rows those are is something only the database knows and
	 * the generator is handed two files, so it refuses the whole shape and names
	 * what would have left. Before that it wrote the DELETE, and a real delta over
	 * a real database came back {@code update or delete on table "place" violates
	 * foreign key constraint "competitor_place_fk" on table "competitor"} - halfway
	 * through a migration rather than before a file existed.
	 *
	 * <p><b>And the order of the two refusals is a case of its own.</b> "a country
	 * changes its code and keeps its name" is turned away for the NAME, while "a
	 * country leaves and another takes the name it gives up" gets past that
	 * question and is turned away for the REMOVAL. The one condition in the
	 * generator that tells them apart is {@code code not in leaving}: without it the
	 * second is reported as an exchange that is not happening, and whoever writes
	 * that migration by hand goes looking for a name clash that disappears with CD.
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
						"Kongo - Kinšasa"),

				/* A town and nothing else, which is the smallest thing a codebook
				   can lose. The last one of the file, because it is the one town
				   that leaves without moving anything else; any other shifts the
				   rank of every town below it and the case would then be about
				   the UPDATE as well. */
				new Refusal(new Change("the last town of the codebook leaves",
						rest -> {
						},
						towns -> towns.remove(towns.size() - 1)),
						"the codebook drops a row a member or an event may be standing on",
						lastTownOfTheCodebook()),

				/* A country and nothing else. GB leaves and UK arrives with a
				   different name, so the first refusal above has nothing to say
				   about it and this one does: a code is an identity, and changing
				   it is a country leaving. Until 09.09.2026 this was a delta the
				   generator wrote, and the towns moving to UK were the reason its
				   six statements were in the order they were in. */
				new Refusal(new Change("a country changes its code, and its towns move with it",
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
						"the codebook drops a row a member or an event may be standing on",
						"Ujedinjeno Kraljevstvo (GB)"),

				/* Both codebooks at once, and the case that says which refusal
				   answers first. The two Congos, because the pair is real: CD
				   leaves with all of its towns and CG takes the name it gives up.
				   Reported as a removal naming CD, not as an exchange naming CG,
				   and the paragraph above says what turns on that. */
				new Refusal(new Change("a country leaves and another takes the name it gives up",
						rest -> {
							String freed = countryLeaves(rest, "CD");

							countryNamed(rest, "CG").put("name", freed);
						},
						towns -> townsOfCountryLeave(towns, "CD")),
						"the codebook drops a row a member or an event may be standing on",
						"Kongo - Kinšasa (CD)"));
	}

	@ParameterizedTest
	@MethodSource("refusals")
	void theGeneratorRefusesADeltaItCannotWrite(Refusal refusal) throws Exception {
		Ran ran = generate(refusal.change());

		assertThat(ran.exitCode()).isNotZero();
		assertThat(ran.errors()).contains(refusal.says(), refusal.names());
		assertThat(ran.output()).isBlank();
	}

	// --------------------------------------------- and the DELETE it will not write

	/**
	 * One row standing on a codebook, the DELETE that then cannot run, and the two
	 * instructions: the one that lets it run and the one that does not.
	 *
	 * @param what        what the case is, in words, and what a verdict names
	 * @param constraint  the key that has to be the reason the DELETE fails
	 * @param stands      the row that names a codebook row
	 * @param drops       the DELETE a delta would have written for that codebook row
	 * @param frees       the UPDATE the refusal instructs, after which {@code drops} must go through
	 * @param refusesToo  the constraint that refuses when the OLD instruction is followed instead,
	 *                    and it is a different one on each side: a check for a town, the foreign key
	 *                    itself for a country
	 */
	record Pressure(String what, String constraint, String stands, String drops, String frees,
			String refusesToo) {

		@Override
		public String toString() {
			return what;
		}
	}

	/* The two codebook rows these cases stand on, looked up rather than numbered:
	   V2 and V3 hand the ids out of a sequence and nothing here may depend on
	   which. The country is one with no town in it, and that is not tidiness: RS
	   has forty seven thousand towns' worth of company and deleting it would come
	   back naming place_country_fk, so the case would be about a key it is not
	   about. Three of the two hundred and forty six carry no town (IO, CQ, TK), the
	   query finds whichever of them sorts first, and the assertion below fails
	   loudly rather than quietly if one day none does. */
	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_COUNTRY_WITH_NO_TOWNS =
			"(select c.id from country c where not exists (select 1 from place p where p.country_id = c.id)"
					+ " order by c.sort_order limit 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_year,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown";
	private static final String EVENT_COLUMNS =
			"slug, name, date, place_id, city, country_id, kind, featured, description, link, copied_from";

	private static String memberStandingOn(String town, String city, String country) {
		return "insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000904', 'Probni', 'Clan', 'M', 1990, "
				+ town + ", " + city + ", " + country + ", 2027, false, true, 'payment', '00112233445566ab',"
				+ " null, '', false, 'none')";
	}

	/* The country the leaving town is in, read off the town rather than named, so
	   the case does not have to know which country the first town of the codebook
	   is in. Which country it becomes is not asserted and could not be: the
	   instruction says the decision is a person's, and any country satisfies the
	   check. What is asserted is that a country is written at all. */
	private static final String THE_TOWNS_COUNTRY = "(select country_id from place where rank = 1)";

	/* And a country that is certainly not the one leaving, for the other half. RS
	   is the one country in the codebook with forty seven thousand towns, so it
	   cannot be A_COUNTRY_WITH_NO_TOWNS, which is what would otherwise make the
	   DELETE below pass for the wrong reason. */
	private static final String ANOTHER_COUNTRY = "(select id from country where code = 'RS')";

	/** The instruction the refusal gives for a town: three columns written together. */
	private static String movedOff(String table, String which, String country) {
		return "update " + table + " set place_id = null, city = 'Zaselak', country_id = " + country
				+ " where " + which;
	}

	/**
	 * And the instruction it used to give, which is the same one short of a column.
	 *
	 * <p>One shape for all four cases, because it is one sentence that was wrong in
	 * two ways at once. Against a town it writes {@code city} while {@code
	 * country_id} stays empty, and the check that makes those two conditions of
	 * each other refuses it. Against a country it changes nothing at all - whoever
	 * stands on a country already has the name typed and the key empty - so it goes
	 * through and the DELETE it was supposed to unblock is refused exactly as
	 * before.
	 */
	private static String oldInstructionFor(Pressure pressure) {
		String table = pressure.constraint().startsWith("competitor") ? "competitor" : "btl_event";
		String which = "competitor".equals(table) ? "member_number = '000904'" : "slug = 'cetvrta-proba-2027'";

		return "update " + table + " set place_id = null, city = 'Zaselak' where " + which;
	}

	private static String eventStandingOn(String town, String city, String country) {
		return "insert into btl_event (" + EVENT_COLUMNS + ") values ('cetvrta-proba-2027', 'Cetvrta proba',"
				+ " date '2027-06-06', " + town + ", " + city + ", " + country + ", 'race', false, '', '', null)";
	}

	/**
	 * The four keys V7 pointed at the codebooks, one case each.
	 *
	 * <p>A member and an event both hold a town and both hold a country, so it is
	 * four cases and not two, and the pairs are not interchangeable: a member's town
	 * is a preference he can be asked about again, an event's town is where the race
	 * was run and stays true after the event is over.
	 *
	 * <p>The town and the country are the two halves of ADL A36 O5, which is also
	 * why one row cannot press both keys at once: a town from the codebook is
	 * {@code place_id} and nothing else, a typed town is {@code city} with its own
	 * {@code country_id}, and {@code competitor_town_is_from_the_codebook_or_typed}
	 * refuses a row that is both.
	 */
	static List<Pressure> pressures() {
		return List.of(
				new Pressure("a member stands on a town the codebook drops", "competitor_place_fk",
						memberStandingOn(A_TOWN, "null", "null"), "delete from place where rank = 1",
						movedOff("competitor", "member_number = '000904'", THE_TOWNS_COUNTRY),
						"competitor_typed_town_names_its_country"),
				new Pressure("a member stands on a country the codebook drops", "competitor_country_fk",
						memberStandingOn("null", "'Zaselak'", A_COUNTRY_WITH_NO_TOWNS),
						"delete from country where id = " + A_COUNTRY_WITH_NO_TOWNS,
						"update competitor set country_id = " + ANOTHER_COUNTRY
								+ " where member_number = '000904'",
						"competitor_country_fk"),
				new Pressure("an event stands on a town the codebook drops", "btl_event_place_fk",
						eventStandingOn(A_TOWN, "null", "null"), "delete from place where rank = 1",
						movedOff("btl_event", "slug = 'cetvrta-proba-2027'", THE_TOWNS_COUNTRY),
						"btl_event_typed_town_names_its_country"),
				new Pressure("an event stands on a country the codebook drops", "btl_event_country_fk",
						eventStandingOn("null", "'Zaselak'", A_COUNTRY_WITH_NO_TOWNS),
						"delete from country where id = " + A_COUNTRY_WITH_NO_TOWNS,
						"update btl_event set country_id = " + ANOTHER_COUNTRY
								+ " where slug = 'cetvrta-proba-2027'",
						"btl_event_country_fk"));
	}

	/**
	 * The DELTA the generator refuses to write is a DELETE the database refuses to
	 * run, and this is the half of that sentence the generator cannot say.
	 *
	 * <p>Without it the refusal in {@link #theGeneratorRefusesADeltaItCannotWrite}
	 * is a script being careful about a statement that would have gone straight
	 * through, and nothing would notice the day these keys stop refusing: they
	 * carried the default NO ACTION until 09.09.2026 and the whole suite was green
	 * while a delta that dropped one town could not be applied to any database with
	 * a member in it.
	 */
	@ParameterizedTest
	@MethodSource("pressures")
	void theDeleteADeltaWillNotWriteIsRefusedByTheKeyItWouldTrip(Pressure pressure) {
		assertThat(db.sql(pressure.stands()).update())
				.as("nothing is standing on the codebook, so the DELETE below would say nothing")
				.isOne();

		assertThatThrownBy(() -> db.sql(pressure.drops()).update())
				.hasMessageContaining(pressure.constraint());
	}

	/**
	 * And the same DELETE goes through when nobody is standing on that row.
	 *
	 * <p>Without this the case above passes for a codebook nothing can ever be
	 * deleted from, whatever the reason, and the key it names would be beside the
	 * point. It is also what says {@link #A_COUNTRY_WITH_NO_TOWNS} found a country:
	 * a subselect that matches nothing deletes nothing and the count is zero.
	 */
	@ParameterizedTest
	@MethodSource("pressures")
	void andTheSameDeleteGoesThroughWhenNobodyIsStandingOnIt(Pressure pressure) {
		assertThat(db.sql(pressure.drops()).update())
				.as("the row the case above stands on is not there to be deleted")
				.isOne();
	}

	/**
	 * The instruction the refusal gives is an UPDATE that lets the DELETE through.
	 *
	 * <p>The refusal is prose, but what it claims is behaviour: do this and the row
	 * can go. Measured by running it rather than by reading it, which is the only
	 * way that sentence has ever been held. Until 09.09.2026 it was held by nothing
	 * at all, and it was wrong: it named two columns where a typed town needs
	 * three, and it offered a town's answer to somebody whose country is leaving.
	 */
	@ParameterizedTest
	@MethodSource("pressures")
	void theInstructionInTheRefusalLetsTheCodebookRowGo(Pressure pressure) {
		assertThat(db.sql(pressure.stands()).update()).isOne();

		assertThat(db.sql(pressure.frees()).update())
				.as("the instruction moved nobody, so the DELETE below would say nothing")
				.isOne();

		assertThat(db.sql(pressure.drops()).update())
				.as("the row is still worn after the instruction the refusal gives")
				.isOne();
	}

	/**
	 * And the instruction it used to give does not, on either side.
	 *
	 * <p>One assertion over the pair rather than two, because only one of the two
	 * statements throws in any given case and which one it is is the finding: for a
	 * town the UPDATE itself breaks the check, for a country the UPDATE is a no-op
	 * that goes through and the DELETE is refused by the key just as before. The
	 * constraint named in {@code refusesToo} is what says which of the two
	 * happened, so a case that started failing for the other reason fails here.
	 */
	@ParameterizedTest
	@MethodSource("pressures")
	void andTheInstructionItGaveBeforeDoesNot(Pressure pressure) {
		assertThat(db.sql(pressure.stands()).update()).isOne();

		assertThatThrownBy(() -> {
			db.sql(oldInstructionFor(pressure)).update();
			db.sql(pressure.drops()).update();
		}).hasMessageContaining(pressure.refusesToo());
	}

	// ------------------------------------------------------------------- the floors

	/**
	 * Every statement a delta can write is written by one of the cases above, and
	 * the DELETE it cannot write is written by none of them.
	 *
	 * <p>Derived rather than counted to: there are two codebooks in the schema and
	 * a row of one can arrive, leave or change, which is an INSERT, a DELETE and an
	 * UPDATE against each. The table names come out of
	 * {@link ConstraintsTest#TABLES}, so a fourth reference table arriving fails
	 * here rather than being covered by silence, and the observed side is read out
	 * of the SQL the generator actually wrote rather than out of the generator's
	 * source.
	 *
	 * <p><b>Six of those statements until 09.09.2026, four since.</b> A row leaving
	 * is refused rather than written, so the two DELETEs are asked for from the
	 * other side: {@link #refusals()} carries a case that takes a row out of each
	 * codebook, and the assertion below then says that no case wrote one anyway.
	 * Both halves are needed. Without the refusal cases a generator that has
	 * quietly stopped emitting DELETEs passes this; without this a generator that
	 * emits them for a change no case makes passes those.
	 */
	@Test
	void everyStatementADeltaCanWriteIsWrittenBySomeCase() throws Exception {
		Set<String> written = new LinkedHashSet<>();

		for (Change change : changes()) {
			written.addAll(statementsIn(generate(change).output()));
		}

		List<String> maintained = referenceTables().stream()
				.filter(table -> !NOT_MAINTAINED_BY_A_DELTA.contains(table))
				.toList();

		assertThat(written)
				.as("a statement no case reaches is a statement nothing has ever run, and a DELETE is one "
						+ "no delta may write at all")
				.containsExactlyInAnyOrderElementsOf(maintained.stream()
						.flatMap(table -> Stream.of("insert " + table, "update " + table))
						.toList());

		assertThat(refusalsThatEmpty())
				.as("a codebook no case takes a row out of is a codebook whose DELETE is refused by nothing")
				.containsExactlyInAnyOrderElementsOf(maintained);
	}

	/**
	 * Which codebooks the refusals actually take a row out of, counted off the two
	 * states each of them writes rather than off its name.
	 *
	 * A case is a pair of consumers and there is no reading what they do, so this
	 * runs each refusal, lets it write its {@code before} and {@code after}, and
	 * compares the two files. A case renamed to sound like a removal, or one whose
	 * consumer stops removing anything, is counted by what is on disk.
	 */
	private Set<String> refusalsThatEmpty() throws Exception {
		Set<String> emptied = new LinkedHashSet<>();

		for (Refusal refusal : refusals()) {
			generate(refusal.change());

			if (countriesIn(work.resolve("after")).size() < countriesIn(work.resolve("before")).size()) {
				emptied.add("country");
			}

			if (townsIn(work.resolve("after")).size() < townsIn(work.resolve("before")).size()) {
				emptied.add("place");
			}
		}

		return emptied;
	}

	/**
	 * The one table a delta leaves alone, named rather than left out quietly.
	 *
	 * The price list is not derived from a file: there is no {@code pricing.json},
	 * so the seven rows are written into the generator by hand and a change to them
	 * is a migration written by hand as well. Said in full at {@code PRICE_ROWS} in
	 * the generator. The day pricing moves into a file of its own, this line goes
	 * and two statements arrive, an INSERT and an UPDATE, with a case for each and
	 * a refusal for the row that leaves.
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
							+ "arrivals is one the database does not carry, and a delta never takes a town out, "
							+ "so no mark is ever given up for another row to take"),
			Verdict.measuredBy("place_rank_unique", "a town is renamed and changes places with its neighbour"),
			Verdict.measuredBy("place_country_fk", "a country joins the middle of the list, with a town in it"),

			Verdict.outOfReach("price_row_pk", "a delta does not touch the price list at all"),
			Verdict.outOfReach("price_row_key_unique", "a delta does not touch the price list at all"),
			Verdict.outOfReach("price_row_sort_order_unique", "a delta does not touch the price list at all"),

			/* And the four that point AT the codebooks, which this list did not
			   ask about at all until 09.09.2026: the question put to
			   pg_constraint was conrelid, the keys standing ON the three tables,
			   and these four stand on `competitor` and `btl_event`. A delta that
			   dropped one town was refused by every one of them on any database
			   with a member in it, and nothing here said so.

			   Measured rather than decided out of reach, and the cases are not
			   the refusals: a refusal with nothing behind it is a script being
			   careful about a DELETE that would have gone through. Each of these
			   names the case that runs that DELETE against the database and reads
			   back which key stopped it. */
			Verdict.measuredBy("competitor_place_fk", "a member stands on a town the codebook drops"),
			Verdict.measuredBy("competitor_country_fk", "a member stands on a country the codebook drops"),
			Verdict.measuredBy("btl_event_place_fk", "an event stands on a town the codebook drops"),
			Verdict.measuredBy("btl_event_country_fk", "an event stands on a country the codebook drops"));

	/**
	 * Both sides of a codebook, and the second side is what this asked nothing
	 * about until 09.09.2026.
	 *
	 * <p>{@code conrelid} is the table a constraint stands on, so asking only that
	 * question counts the keys of {@code country}, {@code place} and
	 * {@code price_row} and stops. {@code confrelid} is the table it points at, and
	 * V7 gave the schema four keys that stand on {@code competitor} and
	 * {@code btl_event} and point here. Those are exactly the keys a delta trips by
	 * taking a row out of a codebook, and they had no verdict, no case and no
	 * decision while "the last town of the codebook leaves" passed for the one
	 * reason that says nothing: that test database has no members in it.
	 */
	@Test
	void everyKeyADeltaCouldTripHasAVerdict() {
		List<String> declared = db
				.sql("select con.conname from pg_constraint con"
						+ " where (con.conrelid = any (array[" + tableLiterals() + "]::regclass[])"
						+ "     or con.confrelid = any (array[" + tableLiterals() + "]::regclass[]))"
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

	/**
	 * What holds a codebook row from outside, and the delta header's sentence about
	 * it.
	 *
	 * <p><b>Why the schema needs asking and not just the header.</b> These four
	 * keys carried {@code NO ACTION} until 09.09.2026, which is the default: the
	 * DELETE was refused, so nothing behaved differently, and nobody had chosen
	 * anything. RESTRICT is the decision, and the difference it makes is what can
	 * be said afterwards. RESTRICT is checked where it is written and cannot be put
	 * off; NO ACTION is the half of the pair a deferral reaches the day one of
	 * these is declared DEFERRABLE. A delta's first statement is {@code set
	 * constraints all deferred} and its header names these four as the keys that
	 * statement does not touch, which is true of RESTRICT by what RESTRICT is.
	 *
	 * <p><b>From outside, and that word is doing work.</b> {@code place_country_fk}
	 * points at a codebook from inside one and is V3's, not V7's, and V3 is a
	 * migration nobody may change (ADL A2). The question here is about the rows a
	 * delta cannot see.
	 *
	 * <p>Both sides derived. A fifth key pointing here fails until somebody decides
	 * what it does and writes it into the header, and a name in the header for a key
	 * that is gone fails too.
	 */
	@Test
	void theKeysThatPointAtACodebookRefuseToLetOneLeave() throws Exception {
		List<String> holding = keysPointingAtACodebook("");

		assertThat(holding)
				.as("nothing outside the codebooks points at one, so the sentence below is about nothing")
				.isNotEmpty();
		assertThat(keysPointingAtACodebook(" and con.confdeltype = 'r'"))
				.as("a key that lets a codebook row go, or lets the going be deferred")
				.containsExactlyInAnyOrderElementsOf(holding);

		Matcher sentence = ON_DELETE_RESTRICT.matcher(generate(changes().getFirst()).output());

		assertThat(sentence.find())
				.as("the sentence that lists them has been reworded, so nothing below is being read")
				.isTrue();

		Set<String> named = new LinkedHashSet<>();
		Matcher name = QUOTED.matcher(sentence.group(1));

		while (name.find()) {
			named.add(name.group(1));
		}

		assertThat(named)
				.as("a key the header does not name, or a name for a key that is gone")
				.containsExactlyInAnyOrderElementsOf(holding);
	}

	/**
	 * The refusal names every column a typed town is written with, and the schema
	 * says which those are.
	 *
	 * <p>The behaviour of that instruction is measured by
	 * {@link #theInstructionInTheRefusalLetsTheCodebookRowGo(Pressure)}, which runs
	 * it. This is the other half, and without it the two are not tied: the UPDATE
	 * in that case is written here rather than read out of the message, so the
	 * message can go back to naming two columns and the suite stays green. It did
	 * name two until 09.09.2026, and the migration a person would then have written
	 * by hand breaks on the check.
	 *
	 * <p><b>The floor is a closure and not a list.</b> It starts at
	 * {@code place_id}, which is what a town on a member is, and takes in every
	 * column reachable from it through a CHECK: {@code place_id} and {@code city}
	 * are conditions of each other, {@code city} and {@code country_id} are
	 * conditions of each other, and that is the whole of the web today. A fourth
	 * column joining it tomorrow fails this until the refusal names it too, which
	 * is the thing a hand written list of three could not do.
	 *
	 * <p>Asked of both tables, because the refusal says the event is the same as the
	 * member and nothing else would notice the day it stops being.
	 */
	@Test
	void theRefusalNamesEveryColumnATypedTownIsWrittenWith() throws Exception {
		List<String> onAMember = columnsATypedTownIsWrittenWith("competitor");

		assertThat(onAMember)
				.as("the closure found nothing, so the comparison below is against an empty list")
				.isNotEmpty();
		assertThat(columnsATypedTownIsWrittenWith("btl_event"))
				.as("the event no longer holds a town the way the member does, and the refusal says it does")
				.containsExactlyInAnyOrderElementsOf(onAMember);

		Matcher sentence = TYPED_TOWN.matcher(generate(aCodebookRowLeaves()).errors());

		assertThat(sentence.find())
				.as("the sentence that lists the columns has been reworded, so nothing below is being read")
				.isTrue();

		Set<String> named = new LinkedHashSet<>();
		Matcher name = QUOTED.matcher(sentence.group(1));

		while (name.find()) {
			named.add(name.group(1));
		}

		assertThat(named)
				.as("a column the instruction does not name, or a name for a column that is not in the web")
				.containsExactlyInAnyOrderElementsOf(onAMember);
	}

	/**
	 * The case whose refusal carries that instruction, chosen by the sentence it is
	 * recognised by rather than by its place in the list.
	 *
	 * <p>Three of the five cases end in that refusal and any of them would do; what
	 * may not be done is to take whichever is first, because the first two are the
	 * other refusal entirely and the one below would then read a message that never
	 * carried the instruction.
	 */
	private static Change aCodebookRowLeaves() {
		return refusals().stream()
				.filter(one -> "the codebook drops a row a member or an event may be standing on".equals(one.says()))
				.map(Refusal::change)
				.findFirst()
				.orElseThrow();
	}

	/**
	 * Every column reachable from {@code place_id} through the CHECK constraints of
	 * one table, {@code place_id} itself included.
	 *
	 * <p>NOT NULL is recorded in {@code pg_constraint} in PostgreSQL 18 like any
	 * other constraint and would drag in every column of the table, so the walk is
	 * over {@code contype = 'c'} alone.
	 */
	private List<String> columnsATypedTownIsWrittenWith(String table) {
		return db
				.sql("with recursive reached as ("
						+ "   select a.attnum from pg_attribute a"
						+ "    where a.attrelid = ?::regclass and a.attname = 'place_id'"
						+ " union"
						+ "   select k.attnum from reached r"
						+ "     join pg_constraint con on con.conrelid = ?::regclass and con.contype = 'c'"
						+ "      and r.attnum = any (con.conkey)"
						+ "     join unnest(con.conkey) as k(attnum) on true"
						+ " )"
						+ " select a.attname from reached r"
						+ "   join pg_attribute a on a.attrelid = ?::regclass and a.attnum = r.attnum"
						+ " order by a.attname")
				.param(table)
				.param(table)
				.param(table)
				.query(String.class)
				.list();
	}

	/** The foreign keys held by a table a delta does not write, pointing at one it
	 *  does, narrowed by whatever else is asked. */
	private List<String> keysPointingAtACodebook(String and) {
		return db
				.sql("select con.conname from pg_constraint con"
						+ " where con.confrelid = any (array[" + tableLiterals() + "]::regclass[])"
						+ "   and not (con.conrelid = any (array[" + tableLiterals() + "]::regclass[]))"
						+ "   and con.contype = 'f'" + and
						+ " order by con.conname")
				.query(String.class)
				.list();
	}

	/** The list of names in that sentence, and the sentence it is in. */
	private static final Pattern ON_DELETE_RESTRICT = Pattern
			.compile("((?:`\\w+`[,\\s]*(?:and\\s+)?)+)\\s*are ON DELETE RESTRICT");

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

	/** The columns the refusal says a typed town is written with, and the sentence
	 *  they stand in. */
	private static final Pattern TYPED_TOWN = Pattern
			.compile("((?:`\\w+`[,\\s]*(?:and\\s+)?)+)\\s*are written together");

	/**
	 * And a verdict names a case that exists.
	 *
	 * <p>Without this the verdicts are prose: a case renamed leaves every line that
	 * pointed at it pointing at nothing, and the list above goes on looking
	 * complete. The other direction is deliberately not asserted here, because a
	 * case need not press a key to be worth having: "the last town of the codebook
	 * leaves" presses none.
	 *
	 * <p><b>What neither floor holds.</b> A key that carries more than one verdict
	 * can lose one of them, together with the case that verdict names, and nothing
	 * here fails: {@link #everyKeyADeltaCouldTripHasAVerdict()} asks only that every
	 * key has some verdict, and this one only that every verdict names a case that
	 * exists. Whoever deletes a case has to look at how many verdicts its key
	 * carries, because neither floor looks.
	 *
	 * <p><b>Why that is written down instead of guarded.</b> Deleting a case and the
	 * line that names it leaves nothing behind for a floor to miss, and a rule that
	 * every case must be needed would have been false the day it was written. What
	 * does hold is narrower and is what such a case is for: while the case is there,
	 * the generator's behaviour under it is measured, and taking
	 * {@code code not in leaving} out of the generator fails "a country leaves and
	 * another takes the name it gives up".
	 */
	@Test
	void everyVerdictNamesACaseThatExists() {
		Set<String> cases = Stream
				.of(changes().stream().map(Change::what),
						refusals().stream().map(one -> one.change().what()),
						pressures().stream().map(Pressure::what))
				.flatMap(one -> one)
				.collect(Collectors.toSet());

		Set<String> named = VERDICTS.stream()
				.map(Verdict::measuredBy)
				.filter(one -> one != null)
				.collect(Collectors.toSet());

		assertThat(named).isNotEmpty();
		assertThat(cases).containsAll(named);
	}

	/**
	 * The tables a delta is about, and until 09.09.2026 that was every table the
	 * schema had.
	 *
	 * <p>It could be, because every table the schema had was a reference table the
	 * generator writes. V5 and V6 gave the schema tables no generator ever touches,
	 * and reading {@code pg_tables} here would have asked the verdicts below for a
	 * line about {@code account_role_fk} and asked a delta's header to name
	 * {@code email_verification_token_hash_unique}, which is a sentence about a key
	 * no delta can reach.
	 *
	 * <p>What replaces it is not a list written here. {@link ConstraintsTest#TABLES}
	 * is the class that answers for the reference tables, and it is floored by
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()}:
	 * every table in the schema is claimed by exactly one such class, so a fourth
	 * reference table arriving is claimed there and arrives here with it, and a
	 * table claimed by any other class is by that fact not a codebook. Read as a
	 * field rather than as a name, so removing it stops the compiler.
	 */
	private static List<String> referenceTables() {
		return ConstraintsTest.TABLES;
	}

	private String tableLiterals() {
		return referenceTables().stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));
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
