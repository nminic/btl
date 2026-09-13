package com.btl.portal.db;

import com.btl.portal.TestcontainersConfiguration;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.Location;
import org.flywaydb.core.api.MigrationInfo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

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
	 * The SQL of one migration, asked of Flyway rather than written down here.
	 *
	 * <p>Flyway says where its migrations live and what the script of the version
	 * that was applied is called, so nothing here is a second copy of a setting: a
	 * file renamed, moved, or given a different location in the configuration is
	 * still the file this reads. Only the VERSION is named, and that is the fact the
	 * case asking for it is about.
	 *
	 * <p>It is here rather than in one test class because two of them execute a
	 * migration over a fixture, which is the only way the DATA half of a migration
	 * is ever measured: every test begins at an empty database, so a carry that
	 * works and a carry that was deleted leave the same nothing behind. See
	 * {@link LeagueRacesCarriedOverTest}, where it was written, and
	 * {@link MembershipCarriedOverTest}.
	 */
	String migrationSql(String version) {
		MigrationInfo applied = Arrays.stream(flyway.info().applied())
				.filter(one -> one.getVersion() != null
						&& version.equals(one.getVersion().getVersion()))
				.findFirst()
				.orElseThrow(() -> new AssertionError("no migration " + version + " was applied"));

		String folder = Arrays.stream(flyway.getConfiguration().getLocations())
				.map(Location::getPath)
				.findFirst()
				.orElseThrow(() -> new AssertionError("Flyway is configured with no location"));

		try (InputStream sql = getClass().getClassLoader()
				.getResourceAsStream(folder + "/" + applied.getScript())) {
			assertThat(sql)
					.as("%s is not under %s, where Flyway says its migrations are",
							applied.getScript(), folder)
					.isNotNull();
			return new String(sql.readAllBytes(), StandardCharsets.UTF_8);
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
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
