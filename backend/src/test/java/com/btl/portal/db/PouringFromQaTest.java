package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT {@code deploy/pour-from-qa.sh} DECIDES, MEASURED AGAINST A REAL DATABASE.
 *
 * <p>The tool that pours QA's data into a production database that has never been used is a
 * shell script, and the script itself cannot run in this gate: it speaks to two live stacks
 * over {@code docker exec} and neither exists here. What CAN run here is every decision it
 * makes, because none of them is written in the script. They are three SQL files under
 * {@code deploy/pour-from-qa/}, the script executes them, and so does this.
 *
 * <p><b>That is the join, and it is the thing this class exists to hold.</b> A guard split over
 * two files states both halves and leaves what binds them stated by nobody, which reads as
 * though it works. Here the binding is the SET OF SQL FILES: the script names them, this
 * exercises them, and {@link #theScriptAndThisClassReachForTheSameFiles} compares both against
 * the DIRECTORY rather than against a list written in either. Rename a file in the script and
 * leave the file alone, or add a file nothing runs, and that case fails while the script and
 * every SQL file is still correct on its own.
 *
 * <p><b>Why this sits in {@code com.btl.portal.db} and not beside
 * {@code WhatEachStackRequiresTest} in {@code com.btl.portal.deploy}, which is where a reader
 * would look first.</b> Every case below needs a PostgreSQL with the migrations applied, and
 * {@link DatabaseTest} is how this repository gets one. It is package private, so a class in
 * another package cannot extend it, and the alternative is standing up a second container for
 * the same schema - a fixed cost on every run of the gate, for a database that already exists
 * three feet away. The files under {@code deploy/} are read by path, which is what
 * {@code WhatEachStackRequiresTest} does anyway, so nothing is lost by being here.
 *
 * <p><b>What this does NOT claim, written down rather than left to be found.</b> It says
 * nothing about the orchestration: resolving containers, copying the photograph volume, the
 * single transaction, or the refusal to pour into a database that is not empty as a WHOLE. It
 * measures the questions the SQL answers, on which every one of those depends. The refusal
 * itself is exercised only as far as {@code row-counts.sql} goes, which is the part that can
 * be wrong quietly; a script that fails to run at all fails loudly.
 */
class PouringFromQaTest extends DatabaseTest {

	/**
	 * Where the three files live, as one path rather than three, so this class also cannot
	 * disagree with itself about the folder. Relative to the backend module, which is what
	 * {@code WhatEachStackRequiresTest} already does for {@code deploy/README.md}.
	 */
	private static final Path POUR = Path.of("..", "deploy", "pour-from-qa");

	private static final Path SCRIPT = Path.of("..", "deploy", "pour-from-qa.sh");

	/**
	 * The files this class runs. It is a list, and the case right below is its floor: it is
	 * compared against the directory in both directions, so a file added under
	 * {@code deploy/pour-from-qa/} and not named here fails the build rather than going
	 * unmeasured.
	 */
	private static final Set<String> EXERCISED =
			Set.of("load-order.sql", "row-counts.sql", "sequences.sql");

	private static String sqlOf(String name) {
		try {
			String text = Files.readString(POUR.resolve(name), StandardCharsets.UTF_8);
			return text.strip().endsWith(";") ? text.strip().substring(0, text.strip().length() - 1) : text;
		}
		catch (IOException cannotRead) {
			throw new UncheckedIOException("cannot read " + POUR.resolve(name), cannotRead);
		}
	}

	/** Every table the load order returns, with the level it came back with, null included. */
	private Map<String, Integer> loadOrder() {
		Map<String, Integer> levels = new HashMap<>();
		db.sql(sqlOf("load-order.sql")).query((row, one) -> {
			int level = row.getInt(2);
			levels.put(row.getString(1), row.wasNull() ? null : level);
			return null;
		}).list();
		return levels;
	}

	/**
	 * THE JOIN BETWEEN THE SCRIPT AND THIS CLASS, held against the directory rather than
	 * against either of them.
	 *
	 * <p>Three sets have to agree: what is on disk, what the script reaches for, and what the
	 * cases below run. Any one of the three alone is a list; compared against the filesystem
	 * they are a floor. The mutation this is written for changes ONLY the binding - a file
	 * renamed in the script with the file left where it is - which leaves the script valid
	 * shell, every SQL file valid SQL, and every other case here green.
	 */
	@Test
	void theScriptAndThisClassReachForTheSameFiles() throws IOException {
		Set<String> onDisk;
		try (Stream<Path> files = Files.list(POUR)) {
			onDisk = files.map(one -> one.getFileName().toString())
					.filter(one -> one.endsWith(".sql"))
					.collect(Collectors.toCollection(TreeSet::new));
		}

		assertThat(onDisk)
				.as("every .sql file under deploy/pour-from-qa/ has to be measured by this class,"
						+ " and this class may not name one that is not there")
				.isEqualTo(new TreeSet<>(EXERCISED));

		String script = Files.readString(SCRIPT, StandardCharsets.UTF_8);
		for (String file : onDisk) {
			assertThat(script)
					.as("deploy/pour-from-qa.sh never names %s, so this class is measuring a file"
							+ " the tool does not run", file)
					.contains(file);
		}
	}

	/**
	 * THE ORDER IS AN ORDER, checked against the foreign keys themselves.
	 *
	 * <p>Not against a written sequence of table names: that would be the same fact in a second
	 * home, and the day a migration adds a table the two would disagree with nothing to say so.
	 * Every foreign key in the catalogue is fetched and the only thing asserted is the one
	 * property a load order has - the parent is strictly earlier than the child. Reverse the
	 * order in the SQL, sort it alphabetically, or drop the recursion, and this fails.
	 */
	@Test
	void everyParentIsFilledBeforeEveryChild() {
		Map<String, Integer> levels = loadOrder();

		List<String[]> keys = db.sql("select child.relname, parent.relname"
						+ " from pg_constraint con"
						+ " join pg_class child on child.oid = con.conrelid"
						+ " join pg_class parent on parent.oid = con.confrelid"
						+ " join pg_namespace n on n.oid = child.relnamespace"
						+ " where con.contype = 'f' and n.nspname = 'public'"
						+ " and child.relname <> parent.relname")
				.query((row, one) -> new String[] { row.getString(1), row.getString(2) })
				.list();

		assertThat(keys).as("a schema with no foreign keys would make this case say nothing")
				.isNotEmpty();

		for (String[] key : keys) {
			assertThat(levels.get(key[1]))
					.as("%s points at %s, so %s has to be filled first, but the order puts it at"
							+ " %s against %s", key[0], key[1], key[1], levels.get(key[1]),
							levels.get(key[0]))
					.isNotNull()
					.isLessThan(levels.get(key[0]));
		}
	}

	/**
	 * AND IT COVERS EVERY TABLE, in both directions, against the catalogue.
	 *
	 * <p>A pour that leaves a table out is the thing the owner asked it never to do, and an
	 * order that names a table which is not there would fail on the host rather than here.
	 * {@link DatabaseTest#tablesInTheSchema()} already excludes Flyway's own history by asking
	 * Flyway what it is called, which is the same table the SQL leaves out.
	 */
	@Test
	void theOrderNamesEveryTableInTheSchemaAndNothingElse() {
		assertThat(new TreeSet<>(loadOrder().keySet()))
				.isEqualTo(new TreeSet<>(tablesInTheSchema()));
	}

	/**
	 * NOTHING IS UNREACHABLE TODAY, which is what lets the tool pour at all.
	 *
	 * <p>A table in a foreign key cycle comes back with no level, and the script stops and names
	 * it. That branch is deliberate and this is the case that says it is not being taken now: if
	 * a migration ever closes a cycle, this fails here rather than on the host, halfway.
	 */
	@Test
	void noTableIsLeftWithoutAPlaceInTheOrder() {
		assertThat(loadOrder()).as("a table with no level is a table in a cycle")
				.doesNotContainValue(null);
	}

	/**
	 * A TABLE THAT POINTS AT ITSELF STILL HAS A PLACE, and this is the case that holds the one
	 * line in {@code load-order.sql} whose reason is a measurement rather than an argument.
	 *
	 * <p>{@code btl_event} points at {@code btl_event} and {@code competitor} at
	 * {@code competitor}. Counted as edges they would each be a cycle of one and both tables
	 * would come back with no level at all. They need no order between them because the whole
	 * table is filled by one COPY and a foreign key is carried out by an AFTER ROW trigger that
	 * fires at the end of the statement - measured on postgres:18, a row pointing forward at a
	 * row later in the same COPY lands, and the same two rows as two COPYs do not.
	 *
	 * <p>Which tables these are is asked of the catalogue, so the case keeps holding on the day
	 * a third one arrives and stops pretending on the day the last one goes.
	 */
	@Test
	void aTableThatPointsAtItselfIsStillInTheOrder() {
		List<String> pointingAtThemselves = db.sql("select distinct child.relname"
						+ " from pg_constraint con"
						+ " join pg_class child on child.oid = con.conrelid"
						+ " join pg_class parent on parent.oid = con.confrelid"
						+ " join pg_namespace n on n.oid = child.relnamespace"
						+ " where con.contype = 'f' and n.nspname = 'public'"
						+ " and child.relname = parent.relname")
				.query(String.class)
				.list();

		assertThat(pointingAtThemselves)
				.as("no table points at itself any more, so this case measures nothing and the"
						+ " line in load-order.sql that excludes self references needs rereading")
				.isNotEmpty();

		Map<String, Integer> levels = loadOrder();
		for (String table : pointingAtThemselves) {
			assertThat(levels.get(table))
					.as("%s points at itself, which is not an edge, so it must still have a level",
							table)
					.isNotNull();
		}
	}

	/**
	 * THE COUNT IS TAKEN OF EVERY TABLE, with no list of tables in the file.
	 *
	 * <p>This is the half of the emptiness proof that can be wrong quietly. A count query that
	 * silently skipped a table would call a production database empty while that table held
	 * rows, and the pour would then double them.
	 */
	@Test
	void theCountNamesEveryTableInTheSchema() {
		assertThat(new TreeSet<>(rowCounts().keySet()))
				.isEqualTo(new TreeSet<>(tablesInTheSchema()));
	}

	/**
	 * AND IT NOTICES ONE ROW, which is the whole of what "empty" has to mean.
	 *
	 * <p>The database this runs against IS the reference: the migrations and nothing else. So
	 * the counts taken here are exactly what the script compares production against, and the
	 * question is whether a single row moves one of them. It is written over
	 * {@code photo} because nothing points at it, so the row needs no fixture around it;
	 * {@code @Transactional} takes it away again.
	 *
	 * <p><b>Both states are asserted and that is deliberate.</b> A case that only inserted would
	 * pass against a query that always reported one; a case that only counted would pass against
	 * a query that always reported the seed. The seeded count is read before, not written down
	 * here, so this keeps holding when a migration changes it.
	 */
	@Test
	void oneRowIsEnoughToStopBeingEmpty() {
		long before = rowCounts().get("photo");

		// The crop is three fractions of the picture rather than three pixel counts, and the
		// column is `crop_diameter`: V8 created it as `crop_side` in pixels and V21 both
		// retyped and renamed it. Written against what the SCHEMA carries, which is not what
		// the migration that creates the table says - reading only that one is what put
		// `crop_side` here first, and the insert failed on a column that has not existed
		// since V21.
		db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/jpeg', 1, repeat('a', 64), 0.5, 0.5, 0.5)")
				.update();

		assertThat(rowCounts().get("photo"))
				.as("a single row has to move the count the emptiness check reads")
				.isEqualTo(before + 1);
	}

	private Map<String, Long> rowCounts() {
		Map<String, Long> counts = new HashMap<>();
		db.sql(sqlOf("row-counts.sql"))
				.query((row, one) -> counts.put(row.getString(1), row.getLong(2)))
				.list();
		return counts;
	}

	/**
	 * EVERY SEQUENCE OWNED BY A COLUMN IS CARRIED, in both directions against pg_depend.
	 *
	 * <p>Forty of them today, one per table with a {@code bigserial} id. A sequence left behind
	 * is a sequence still standing where its migration left it, so the first row the portal
	 * writes after the pour takes an id a poured row already has.
	 */
	@Test
	void everySequenceOwnedByAColumnIsCarried() {
		Set<String> named = carriedSequences().stream()
				.map(one -> one.replaceAll("^.*setval\\('public\\.", "").replaceAll("'.*$", ""))
				.collect(Collectors.toCollection(TreeSet::new));

		Set<String> owned = new TreeSet<>(db.sql("select s.relname from pg_class s"
						+ " join pg_namespace n on n.oid = s.relnamespace"
						+ " join pg_depend d on d.objid = s.oid"
						+ " and d.classid = 'pg_class'::regclass and d.deptype in ('a', 'i')"
						+ " where s.relkind = 'S' and n.nspname = 'public'")
				.query(String.class)
				.list());

		assertThat(owned).as("a schema with no owned sequences would make this say nothing")
				.isNotEmpty();
		assertThat(named).isEqualTo(owned);
	}

	/**
	 * AND WHAT IT WRITES OUT PUTS A SEQUENCE BACK WHERE IT WAS, which asserting the text of the
	 * statements never would.
	 *
	 * <p>The statement is generated first, the sequence is then moved on three times, and the
	 * statement is executed: if it carries the position it was generated from, the sequence
	 * ends where it began. Generating against the same database it is applied to is what makes
	 * that safe to do here - a sequence is not transactional and {@code @Transactional} would
	 * not take a {@code setval} back, so the case is written to finish where it started rather
	 * than to rely on a rollback that does not come.
	 *
	 * <p>This is also what holds {@code is_called}, which is the difference between a sequence
	 * whose next value is 8 and one whose next value is 7, and which {@code pg_sequences} does
	 * not expose at all.
	 */
	@Test
	void theStatementsPutASequenceBackWhereItStood() {
		String sequence = "photo_id_seq";
		String statement = carriedSequences().stream()
				.filter(one -> one.contains(sequence))
				.findFirst()
				.orElseThrow(() -> new AssertionError(sequence + " is not among the statements"));

		long stood = db.sql("select last_value from " + sequence).query(Long.class).single();

		db.sql("select nextval('" + sequence + "')").query(Long.class).list();
		db.sql("select nextval('" + sequence + "')").query(Long.class).list();
		long moved = db.sql("select last_value from " + sequence).query(Long.class).single();
		assertThat(moved).as("the sequence did not move, so the rest of this case measures nothing")
				.isNotEqualTo(stood);

		db.sql(statement.strip().replaceAll(";$", "")).query(Long.class).list();

		assertThat(db.sql("select last_value from " + sequence).query(Long.class).single())
				.as("the statement has to carry the position it was generated from")
				.isEqualTo(stood);
	}

	private List<String> carriedSequences() {
		List<String> statements = new ArrayList<>(
				db.sql(sqlOf("sequences.sql")).query(String.class).list());
		assertThat(statements).as("no sequence came back at all").isNotEmpty();
		return statements;
	}
}
