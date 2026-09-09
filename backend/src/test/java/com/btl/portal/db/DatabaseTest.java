package com.btl.portal.db;

import com.btl.portal.TestcontainersConfiguration;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * What every test about the schema needs: a real PostgreSQL with the migrations
 * already applied, and a transaction that is rolled back afterwards.
 *
 * The database is the one the image ships, {@code postgres:18} through
 * Testcontainers, never an in memory stand in: the whole point of these tests is
 * the constraints, the collation and the types, and those are exactly what an
 * in memory database gets wrong.
 *
 * Rolled back rather than cleaned up. Several of the tests below insert a row
 * that has to be rejected; a rejected insert writes nothing, but the ones that
 * check the other direction, that a legitimate row is accepted, do write, and a
 * codebook that grows by one row every time the suite runs is a codebook nobody
 * can make an assertion about.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
abstract class DatabaseTest {

	@Autowired
	JdbcClient db;

	@Autowired
	Flyway flyway;

	/**
	 * The name of the table Flyway keeps its own history in, asked of Flyway.
	 *
	 * Every question below about "the tables this schema has" means the tables
	 * these migrations create, and Flyway's own is not one of them: nobody writes
	 * its constraints and nobody may change them. Asked rather than written out,
	 * because it is a setting, and a setting written down twice is a setting that
	 * moves in one of the two places.
	 */
	String flywayTable() {
		return flyway.getConfiguration().getTable();
	}

	/**
	 * Every table these migrations create, read out of the catalogue.
	 *
	 * Derived and not listed, and that is the whole point of it. A list of three
	 * table names in a test file is a list whose floor is another list of three
	 * table names in another test file, and the day a fourth table arrives the
	 * build asks for one of them and not the other. {@code pg_tables} cannot
	 * forget a table.
	 */
	List<String> tablesInTheSchema() {
		return db
				.sql("select tablename from pg_tables"
						+ " where schemaname = current_schema() and tablename <> ?"
						+ " order by tablename")
				.param(flywayTable())
				.query(String.class)
				.list();
	}

	/**
	 * The root of the repository, found rather than assumed.
	 *
	 * Surefire runs with {@code backend/} as the working directory and a person
	 * running one test from an editor may not, so this climbs until it finds the
	 * two directories that make this repository what it is. Failing loudly beats
	 * a relative path that quietly resolves to nothing on somebody else's machine.
	 */
	static Path repositoryRoot() {
		Path here = Path.of("").toAbsolutePath();

		for (Path candidate = here; candidate != null; candidate = candidate.getParent()) {
			if (Files.isDirectory(candidate.resolve("backend")) && Files.isDirectory(candidate.resolve("frontend"))) {
				return candidate;
			}
		}

		throw new IllegalStateException("no directory above " + here + " holds both backend/ and frontend/");
	}
}
