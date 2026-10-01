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
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT {@code deploy/pour-from-qa.sh} DECIDES, MEASURED AGAINST A REAL DATABASE.
 *
 * <p>The tool that pours QA's data into a production database that has never been used is a
 * shell script, and the script itself cannot run in this gate: it speaks to two live stacks
 * over {@code docker exec} and neither exists here. What CAN run here is every decision it
 * makes, because none of them is written in the script. They are SQL files under
 * {@code deploy/pour-from-qa/}, the script executes them, and so does this. What the script
 * does around them is held from two other sides: {@code PouringFromQaScriptTest} reads its code
 * without a database, and {@code PouringFromQaLeavesNothingBehindTest} runs the shell helper it
 * sources in a real Linux and sends it signals.
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
	 * Where the files live, as one path rather than one per file, so this class also cannot
	 * disagree with itself about the folder. Relative to the backend module, which is what
	 * {@code WhatEachStackRequiresTest} already does for {@code deploy/README.md}.
	 */
	private static final Path POUR = Path.of("..", "deploy", "pour-from-qa");

	private static final Path SCRIPT = Path.of("..", "deploy", "pour-from-qa.sh");

	/**
	 * The files that make up the tool's folder: the SQL this class runs, and the shell helper
	 * that {@code PouringFromQaLeavesNothingBehindTest} runs. It is a list, and the case right
	 * below is its floor: it is compared against the directory in both directions, so a file
	 * added under {@code deploy/pour-from-qa/} and not named here fails the build rather than
	 * going unmeasured.
	 */
	private static final Set<String> EXERCISED = Set.of("load-order.sql", "row-counts.sql",
			"sequences.sql", "lets-somebody-in.sql", "leaves-nothing-behind.sh");

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

	/** One row of {@code load-order.sql}: the name, the level (null for a table in a cycle), the quoted form. */
	private record OrderRow(String name, Integer level, String quoted) {
	}

	private List<OrderRow> loadOrderRows() {
		return db.sql(sqlOf("load-order.sql")).query((row, one) -> {
			// wasNull() answers about the LAST column read, so it is taken right after the level
			// and before the quoted name: see loadOrder() above for what it cost to get that wrong.
			int level = row.getInt(2);
			boolean noLevel = row.wasNull();
			return new OrderRow(row.getString(1), noLevel ? null : level, row.getString(3));
		}).list();
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
					.filter(one -> one.endsWith(".sql") || one.endsWith(".sh"))
					.collect(Collectors.toCollection(TreeSet::new));
		}

		assertThat(onDisk)
				.as("every .sql and .sh file under deploy/pour-from-qa/ has to be measured by this"
						+ " class or by PouringFromQaLeavesNothingBehindTest, and this class may not"
						+ " name one that is not there")
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
	 * EVERY NAME COMES BACK IN THE ONE FORM THAT GOES INTO A STATEMENT, and it is usable as it
	 * came.
	 *
	 * <p>The script puts a table after {@code public.} in a TRUNCATE, in the header of the rows it
	 * pours in and in the statement that reads them out of QA. It used to put the bare name in
	 * all three, while the two files beside this one quoted theirs, so the one way of getting a
	 * name into SQL that nobody had quoted was the one the whole pour depended on. Asked here the
	 * way the script uses it: each returned form is put after {@code public.} and run.
	 */
	@Test
	void everyTableComesBackWithItsNameQuotedForSql() {
		List<OrderRow> rows = loadOrderRows();

		assertThat(rows).as("an empty order would make this say nothing").isNotEmpty();
		for (OrderRow one : rows) {
			assertThat(db.sql("select count(*) from public." + one.quoted()).query(Long.class).single())
					.as("%s came back as %s, which has to be usable after public. as it is",
							one.name(), one.quoted())
					.isGreaterThanOrEqualTo(0L);
		}
	}

	/**
	 * A NAME THAT NEEDS QUOTES ARRIVES WITH THEM, and that is the case the schema cannot supply.
	 *
	 * <p>Every table the migrations create is lower case and snake case, so on the real schema the
	 * quoted form equals the name and the case above passes for a column that quoted nothing. Three
	 * tables are built here whose names cannot be written bare, one for each way a name needs
	 * quotes: capitals and a space, a reserved word, and a double quote in the name. The probe
	 * tables go away with the transaction.
	 *
	 * <p>The second assertion is what stops the first from being empty: a name that comes back
	 * unchanged was not awkward, and this would then be measuring nothing.
	 */
	@Test
	void aNameThatNeedsQuotesIsCarriedWithThem() {
		db.sql("create table \"B190 Mixed Case\" (id bigint primary key)").update();
		db.sql("create table \"order\" (id bigint primary key)").update();
		db.sql("create table \"b190 \"\"double\"\" quoted\" (id bigint primary key)").update();

		Map<String, String> quotedByName = new TreeMap<>();
		loadOrderRows().forEach(one -> quotedByName.put(one.name(), one.quoted()));

		for (String name : List.of("B190 Mixed Case", "order", "b190 \"double\" quoted")) {
			String quoted = quotedByName.get(name);

			assertThat(quoted).as("the order does not list %s at all", name).isNotNull();
			assertThat(quoted)
					.as("%s needs quotes, so a form that came back equal to it carries none", name)
					.isNotEqualTo(name);
			assertThat(db.sql("select count(*) from public." + quoted).query(Long.class).single())
					.as("%s came back as %s and that is not a name PostgreSQL accepts", name, quoted)
					.isZero();
		}
	}

	/**
	 * NO TABLE NAME HAS A CHARACTER THE POUR CANNOT CARRY, asked of the catalogue and not of a list.
	 *
	 * <p>The quoted form is put inside single quotes on a psql script line and read out of a file
	 * whose fields are separated by a bar, so a single quote, a backslash, a bar or a newline in a
	 * name would break it or, worse, bend it into something else. {@code load-order.sql} says that
	 * is a boundary and not a defect; this is what makes it one that fails in the build, on the
	 * day a migration writes such a name, and not on the host in the middle of the pour. Asked of
	 * the real schema only, so it runs before any case builds a probe.
	 */
	@Test
	void noTableNameHasACharacterTheHeaderLineCannotCarry() {
		List<String> uncarriable = db.sql("select c.relname from pg_class c"
						+ " join pg_namespace n on n.oid = c.relnamespace"
						+ " where n.nspname = 'public' and c.relkind = 'r'"
						+ " and (position(chr(39) in c.relname) > 0"
						+ " or position(chr(92) in c.relname) > 0"
						+ " or position('|' in c.relname) > 0"
						+ " or position(chr(10) in c.relname) > 0)")
				.query(String.class)
				.list();

		assertThat(uncarriable)
				.as("a table name with a quote, a backslash, a bar or a newline in it cannot be"
						+ " carried by the pour, which would bend it; see load-order.sql")
				.isEmpty();
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
	 * EVERY SEQUENCE THE SCHEMA HAS IS CARRIED, whoever owns it and whether anybody does.
	 *
	 * <p><b>This case used to ask the wrong question, and the way it was wrong is worth more than
	 * the answer.</b> It was called "every sequence OWNED BY A COLUMN is carried", and its
	 * expected side repeated the very predicate {@code sequences.sql} was being measured on -
	 * {@code pg_depend} with {@code deptype in ('a','i')}. A floor that restates the list it is
	 * measuring is not a floor: both sides moved together, both sides agreed, and the case passed
	 * over a sequence neither of them looked at.
	 *
	 * <p>The one it missed is {@code member_number_seq}. V16 creates it BARE, with no
	 * {@code owned by}, deliberately, so that it survives a deleted row; {@code MemberNumbers}
	 * draws the member number straight out of it. Left behind by the pour, production stood at
	 * {@code 1 | f} while QA stood at {@code 2 | t}, and the next activations died on
	 * {@code duplicate key (member_number)=(000001)} - each one spending its number for good,
	 * because {@code nextval} is not transactional. The tool also refuses to run twice, so the
	 * repair would have been a {@code setval} typed by hand on production.
	 *
	 * <p><b>So the expected side no longer names a predicate at all.</b> It asks for every
	 * sequence in the schema. The question the pour actually has is "which sequences does the
	 * portal draw from", and a sequence is drawn from whether or not a column owns it, so
	 * ownership was never the right thing to ask about.
	 */
	@Test
	void everySequenceTheSchemaHasIsCarried() {
		Set<String> named = carriedSequences().stream()
				.map(one -> one.replaceAll("^.*setval\\('public\\.", "").replaceAll("'.*$", ""))
				.collect(Collectors.toCollection(TreeSet::new));

		Set<String> everySequence = new TreeSet<>(db.sql("select s.relname from pg_class s"
						+ " join pg_namespace n on n.oid = s.relnamespace"
						+ " where s.relkind = 'S' and n.nspname = 'public'")
				.query(String.class)
				.list());

		assertThat(everySequence).as("a schema with no sequences would make this say nothing")
				.isNotEmpty();
		assertThat(named)
				.as("a sequence left behind stands where its migration left it, and the first row"
						+ " the portal writes after the pour collides with one already poured")
				.isEqualTo(everySequence);

		assertThat(named)
				.as("member_number_seq is owned by no column on purpose (V16), and it is what the"
						+ " member number is drawn from; a predicate about ownership cannot see it,"
						+ " which is exactly how it was missed")
				.contains("member_number_seq");
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
	 * <p>Every id in this schema is a {@code bigserial}. An identity column is the other way a
	 * table gets one, and PostgreSQL records the two differently in {@code pg_depend} - 'a'
	 * against 'i'. {@code sequences.sql} no longer asks {@code pg_depend} anything, so both are
	 * carried for the same reason a bare sequence is: it is a sequence in the schema. This case
	 * stays because that was not always so, and it is what fails if a predicate about ownership
	 * is ever put back - which is how {@code member_number_seq} came to be left behind in the
	 * first place.
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

	/**
	 * EVERY TABLE A VISITOR IS CHECKED AGAINST IS NAMED, PASSWORDS INCLUDED.
	 *
	 * <p>The tool pours every table and then says which of the poured rows let somebody in. The
	 * first version of that query asked for {@code token_hash} alone and so listed three tables,
	 * leaving out the one that matters most: {@code account}, whose {@code password_hash} is
	 * literally what {@code SignInApi} checks a visitor against -
	 * {@code select id, password_hash, ... from account where lower(email) = lower(?)}. A
	 * security round found it, and what made it worse than a short list was the sentence beside
	 * it, which said emptying the token tables ends every one of them. It does not: a password
	 * is in none of those three tables, so every QA password goes on working on production and
	 * only a password change ends it.
	 *
	 * <p><b>The floor is deliberately WIDER than the query it holds.</b> The query names two
	 * column names; this asks the catalogue for every column whose name ends in "hash" at all.
	 * So it fails in two different directions, and both are wanted: narrowing the query back to
	 * {@code token_hash} drops {@code account} and fails, and a third kind of authenticator
	 * arriving one day - {@code otp_hash}, say - fails too, which forces somebody to decide
	 * whether it lets a visitor in rather than letting it go unlisted.
	 *
	 * <p>{@code account} is then named outright beside the derived comparison. That is a fact
	 * written by hand, on purpose and with a floor beside it, in the shape
	 * {@code publicData.test.tsx} already uses: it is the one thing the derived half would also
	 * lose if both homes were changed together, and it is the whole reason this case exists.
	 */
	@Test
	void everyTableAVisitorIsCheckedAgainstIsNamedIncludingPasswords() {
		Map<String, String> named = namedByTheList();

		Map<String, String> carryingAHash = new TreeMap<>();
		db.sql("select c.relname, string_agg(a.attname::text, ',' order by a.attname)"
						+ " from pg_class c"
						+ " join pg_namespace n on n.oid = c.relnamespace"
						+ " join pg_attribute a on a.attrelid = c.oid"
						+ " and a.attnum > 0 and not a.attisdropped"
						+ " where n.nspname = 'public' and c.relkind = 'r'"
						+ " and a.attname like '%hash'"
						+ " group by c.relname")
				.query((row, one) -> carryingAHash.put(row.getString(1), row.getString(2)))
				.list();

		assertThat(carryingAHash)
				.as("no table carries a hash column at all, so this case measures nothing")
				.isNotEmpty();

		// The comparison is over table AND column, and that is wider than it was: a further hash
		// column on a table the list already names changes no table and used to pass, and the
		// report's sentence about which rows can be emptied is built on the column.
		assertThat(named)
				.as("the report has to name every table the portal checks a visitor against, and the"
						+ " column it checks by; a column ending in 'hash' that is NOT one of those is"
						+ " a decision somebody has to make out loud rather than leave to this query")
				.isEqualTo(carryingAHash);

		assertThat(named.keySet())
				.as("account.password_hash is what SignInApi checks a visitor against, and unlike"
						+ " the token tables it cannot be emptied - it comes over with the rest of"
						+ " the row and only a password change ends it")
				.contains("account");
	}

	/** What {@code lets-somebody-in.sql} returns: each table, with the column or columns it is checked by. */
	private Map<String, String> namedByTheList() {
		Map<String, String> named = new TreeMap<>();
		db.sql(sqlOf("lets-somebody-in.sql"))
				.query((row, one) -> named.put(row.getString(1), row.getString(2)))
				.list();
		return named;
	}

	/**
	 * A FURTHER TABLE WITH A TOKEN IS LISTED, MARKED, AND THE REPORT'S SENTENCE STAYS TRUE.
	 *
	 * <p>The closing report says the rows checked by {@code token_hash} can be ended by emptying
	 * their table, and it says so about "a table listed above with that column" and not about
	 * three tables by name. That is only true if a fourth such table arrives in the list marked
	 * with that column on the day it is created, which is what is held here with one built for the
	 * purpose. The report used to name the three by hand, and a fourth made the sentence false
	 * without a case failing.
	 */
	@Test
	void aFurtherTableWithATokenIsListedAndMarkedWithoutAnyoneEditingAnything() {
		db.sql("create table b190_further_token (token_hash char(64) not null primary key)").update();

		assertThat(namedByTheList()).containsEntry("b190_further_token", "token_hash");
	}

	/**
	 * THE CLOSING REPORT NAMES NO TABLE THAT CARRIES A TOKEN, asked of the catalogue.
	 *
	 * <p>The negative half of the case above. A sentence that lists the token tables is the one
	 * that goes stale, so every table the catalogue says carries a {@code token_hash} is looked for
	 * in the script's code, and none may be there. Derived, so it covers the fourth table too and
	 * not only the three that exist today.
	 */
	@Test
	void theClosingReportNamesNoTableThatCarriesAToken() throws IOException {
		List<String> tokenTables = db.sql("select distinct c.relname from pg_class c"
						+ " join pg_namespace n on n.oid = c.relnamespace"
						+ " join pg_attribute a on a.attrelid = c.oid"
						+ " and a.attnum > 0 and not a.attisdropped"
						+ " where n.nspname = 'public' and c.relkind = 'r' and a.attname = 'token_hash'")
				.query(String.class)
				.list();
		assertThat(tokenTables).as("no table carries a token, so this measures nothing").isNotEmpty();

		List<String> code = Files.readAllLines(SCRIPT, StandardCharsets.UTF_8).stream()
				.filter(line -> !line.strip().startsWith("#"))
				.toList();

		for (String table : tokenTables) {
			Pattern named = Pattern.compile("\\b" + Pattern.quote(table) + "\\b");
			assertThat(code.stream().filter(line -> named.matcher(line).find()))
					.as("the closing report names %s, a table that carries a token_hash. The list it"
							+ " prints is derived from the catalogue, and a sentence that names tables"
							+ " is the one that goes stale", table)
					.isEmpty();
		}
	}

	/**
	 * THE TABLES THE CLOSING REPORT POINTS AT FOR RIGHTS ARE REAL.
	 *
	 * <p>The report says which rights each account holds live in {@code account_admin_right} and
	 * which right opens a row of the verification queues is {@code verification.right_code}. The
	 * script is checked for naming them in {@code PouringFromQaScriptTest}; this is the other half,
	 * that the names are in the schema, so a rename fails here and does not leave the operator
	 * reading about a table that is not there.
	 */
	@Test
	void theTablesTheClosingReportNamesForRightsExist() {
		assertThat(tablesInTheSchema()).contains("account_admin_right");

		assertThat(db.sql("select count(*) from information_schema.columns"
						+ " where table_schema = current_schema()"
						+ " and table_name = 'verification' and column_name = 'right_code'")
				.query(Long.class)
				.single())
				.as("verification.right_code is what says which right opens a verification row")
				.isEqualTo(1L);
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
