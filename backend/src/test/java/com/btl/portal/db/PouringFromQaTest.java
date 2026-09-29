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
			// wasNull() speaks about the LAST column read, so it is taken here and not inside
			// the put below: reading the name first would make it answer about the NAME, which
			// is never null, and every missing level would come back as a plain 0. Measured
			// 29.09.2026 - written that way, the cycle case below saw level 0 where it had to
			// see nothing, and the case asserting that no level is missing could not have
			// failed for any schema at all.
			int level = row.getInt(2);
			boolean noLevel = row.wasNull();
			levels.put(row.getString(1), noLevel ? null : level);
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

		// The BINDING and not the bare name. The script's header also points at these files in
		// prose, so a bare `contains` would go on passing after the line that actually opens the
		// file was renamed - the prose would still carry the old word. What is asserted is the
		// one form the script binds them in, `NAME="$SQL/<file>"`, which appears exactly once
		// per file and is what a rename has to touch.
		String script = Files.readString(SCRIPT, StandardCharsets.UTF_8);
		for (String file : onDisk) {
			assertThat(script)
					.as("deploy/pour-from-qa.sh binds no variable to %s, so either it runs a file"
							+ " that is not there or this class measures one it never opens", file)
					.contains("=\"$SQL/" + file + "\"");
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
	 *
	 * <p><b>What this case does NOT hold, measured rather than assumed.</b> Taking the exclusion
	 * out of {@code load-order.sql} leaves this GREEN, and the mutation series of 29.09.2026 is
	 * where that was found rather than guessed. Both tables are reached through their OTHER
	 * parents, so the extra self edge is blocked by the path check and changes no level. The
	 * line only decides anything for a table whose ONLY foreign key is its own, which this
	 * schema does not have - so {@link #aTableWhoseOnlyKeyIsItsOwnIsStillARoot} builds one.
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
	 * A TABLE WHOSE ONLY KEY IS ITS OWN IS A ROOT, which is the case the schema cannot supply.
	 *
	 * <p>Built here rather than waited for. The probe is created inside the test's own
	 * transaction and PostgreSQL rolls DDL back with everything else, so the schema is untouched
	 * afterwards and nothing leaks into another case.
	 *
	 * <p>With the exclusion in place the probe has no incoming edge at all and comes back at
	 * level 0. Without it, the probe is excluded from the roots by its own edge and can then be
	 * reached only from itself, which the path check forbids - so it comes back with no level,
	 * the tool would refuse to pour, and this fails. That is the whole of what the line buys.
	 */
	@Test
	void aTableWhoseOnlyKeyIsItsOwnIsStillARoot() {
		db.sql("create table b185_alone (id bigint primary key,"
				+ " parent bigint references b185_alone (id))").update();

		assertThat(loadOrder().get("b185_alone"))
				.as("its only foreign key points at itself, which one COPY carries, so it is a"
						+ " root and not a table without a place")
				.isEqualTo(0);
	}

	/**
	 * A REAL CYCLE COMES BACK NAMED, WITH NO LEVEL, which is the branch the tool refuses on.
	 *
	 * <p>Today no cycle exists, so that branch is never taken and the outer join that carries it
	 * is indistinguishable from an inner one - measured on 29.09.2026, turning it into an inner
	 * join left every case green. This builds the cycle the schema does not have, and then both
	 * halves mean something: the tables are still LISTED (which the inner join would have
	 * dropped, and the tool would then have poured the rest and skipped them silently, which is
	 * the one thing the owner asked it never to do) and they carry NO LEVEL (which is what makes
	 * the tool stop and name them).
	 */
	@Test
	void twoTablesPointingAtEachOtherAreListedWithNoLevel() {
		db.sql("create table b185_here (id bigint primary key, there_id bigint)").update();
		db.sql("create table b185_there (id bigint primary key, here_id bigint)").update();
		db.sql("alter table b185_here add constraint b185_here_fk"
				+ " foreign key (there_id) references b185_there (id)").update();
		db.sql("alter table b185_there add constraint b185_there_fk"
				+ " foreign key (here_id) references b185_here (id)").update();

		Map<String, Integer> levels = loadOrder();

		assertThat(levels)
				.as("a table in a cycle has to be LISTED, or the tool pours the rest and leaves"
						+ " it out without saying so")
				.containsKeys("b185_here", "b185_there");
		assertThat(levels.get("b185_here"))
				.as("and it has to carry no level, which is what makes the tool stop")
				.isNull();
		assertThat(levels.get("b185_there")).isNull();
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
	 * THE STATEMENT CARRIES THE POSITION AND NOT A CONSTANT.
	 *
	 * <p><b>Why this is written over a table built here instead of over one the schema has, and
	 * it was measured rather than preferred.</b> The first draft moved {@code photo_id_seq},
	 * which on a freshly migrated database stands at 1 because nothing has used it. Replacing
	 * the whole of {@code last_value} with the constant 1 therefore left the case GREEN: the
	 * right answer and the wrong one were the same number. That is two sources for one value in
	 * the FIXTURE, and no assertion over it could have told them apart. A probe advanced to a
	 * position that is not the starting one separates them.
	 *
	 * <p>It is also why the probe is created rather than borrowed. A sequence is not
	 * transactional, so a {@code setval} on a real one would outlive the rollback and change
	 * what some other case sees; a table created inside this transaction takes its sequence
	 * with it when PostgreSQL rolls the DDL back.
	 */
	@Test
	void theStatementCarriesThePositionAndNotAConstant() {
		db.sql("create table b185_moved (id bigserial primary key)").update();
		for (int step = 0; step < 4; step++) {
			db.sql("select nextval('b185_moved_id_seq')").query(Long.class).list();
		}

		long stood = lastValueOf("b185_moved_id_seq");
		assertThat(stood).as("the probe has to stand somewhere other than the position a"
				+ " constant would name, or this case cannot tell them apart").isEqualTo(4);

		String statement = statementFor("b185_moved_id_seq");

		db.sql("select nextval('b185_moved_id_seq')").query(Long.class).list();
		assertThat(lastValueOf("b185_moved_id_seq"))
				.as("the probe did not move, so the rest of this case measures nothing")
				.isNotEqualTo(stood);

		db.sql(statement).query(Long.class).list();

		assertThat(lastValueOf("b185_moved_id_seq"))
				.as("the statement has to carry the position it was generated from")
				.isEqualTo(stood);
	}

	/**
	 * AND IT CARRIES WHETHER THE SEQUENCE HAS EVER BEEN USED, which is a separate fact.
	 *
	 * <p>{@code is_called} is the difference between a sequence whose next value is 1 and one
	 * whose next value is 2, and {@code pg_sequences} does not expose it at all - which is why
	 * {@code sequences.sql} reads it out of the sequence itself. Assuming it rather than reading
	 * it burns the first id of every table QA has never written to, and the case above cannot
	 * see that: it moves a sequence that HAS been used, where the assumption happens to be
	 * right. Measured 29.09.2026, that mutation survived until this case existed.
	 */
	@Test
	void theStatementCarriesWhetherTheSequenceHasBeenUsed() {
		db.sql("create table b185_untouched (id bigserial primary key)").update();

		assertThat(hasBeenCalled("b185_untouched_id_seq"))
				.as("a sequence nobody has used is the state this case is about").isFalse();

		String statement = statementFor("b185_untouched_id_seq");

		db.sql("select nextval('b185_untouched_id_seq')").query(Long.class).list();
		assertThat(hasBeenCalled("b185_untouched_id_seq"))
				.as("the probe was not used, so the rest of this case measures nothing").isTrue();

		db.sql(statement).query(Long.class).list();

		assertThat(hasBeenCalled("b185_untouched_id_seq"))
				.as("production must be left with the first id still unspent, exactly as QA has it")
				.isFalse();
	}

	/**
	 * AN IDENTITY COLUMN'S SEQUENCE IS CARRIED TOO, and the schema cannot ask this today.
	 *
	 * <p>Every id in this schema is a {@code bigserial}, whose sequence PostgreSQL records with
	 * {@code deptype} 'a'. An identity column records 'i' instead, and
	 * {@code sequences.sql} names both. Measured 29.09.2026: narrowing it to 'a' alone left
	 * every case green, because there is no 'i' to lose - so the day somebody writes
	 * {@code generated by default as identity}, that table's sequence would be left behind and
	 * the first row the portal wrote would collide with a poured one. The probe supplies the
	 * case the schema does not.
	 */
	@Test
	void anIdentityColumnsSequenceIsCarriedToo() {
		db.sql("create table b185_identity"
				+ " (id bigint generated by default as identity primary key)").update();

		assertThat(carriedSequences())
				.as("an identity column's sequence is owned by its column exactly as a serial's"
						+ " is, and is just as lost if it is not carried")
				.anyMatch(one -> one.contains("b185_identity_id_seq"));
	}

	private long lastValueOf(String sequence) {
		return db.sql("select last_value from " + sequence).query(Long.class).single();
	}

	private boolean hasBeenCalled(String sequence) {
		return db.sql("select is_called from " + sequence).query(Boolean.class).single();
	}

	/** The statement {@code sequences.sql} writes out for one sequence, ready to execute. */
	private String statementFor(String sequence) {
		return carriedSequences().stream()
				.filter(one -> one.contains(sequence))
				.findFirst()
				.orElseThrow(() -> new AssertionError(sequence + " is not among the statements"))
				.strip()
				.replaceAll(";$", "");
	}

	private List<String> carriedSequences() {
		List<String> statements = new ArrayList<>(
				db.sql(sqlOf("sequences.sql")).query(String.class).list());
		assertThat(statements).as("no sequence came back at all").isNotEmpty();
		return statements;
	}
}
