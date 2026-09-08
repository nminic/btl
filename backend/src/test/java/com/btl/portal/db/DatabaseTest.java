package com.btl.portal.db;

import com.btl.portal.TestcontainersConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;

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
