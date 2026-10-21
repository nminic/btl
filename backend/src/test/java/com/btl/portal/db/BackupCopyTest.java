package com.btl.portal.db;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.testcontainers.containers.Container.ExecResult;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT A COPY OF PRODUCTION IS, MADE, OPENED, RESTORED AND PROVED BY THE SCRIPTS THAT DO IT ON THE
 * HOST, AGAINST A REAL POSTGRESQL 18 HOLDING THE REAL SCHEMA.
 *
 * <p>{@code deploy/backup.sh} needs a live production stack and R2, so it cannot run here; what it
 * runs inside its containers can, and is the part that decides whether a copy is a copy:
 * {@code pack.sh}, {@code check.sh}, {@code restore-database.sh}, {@code prove.sh} and
 * {@code restore-photos.sh}, in the container this suite already starts, which is the image the
 * host runs them in. {@code pg_dump} is called with the options {@code backup.sh} gives it, and the
 * dump goes through standard output to a file, which is how the host gets it.
 *
 * <p><b>The source is a database of its own, made from the migrated test database and then given
 * what a real one carries that the migrations do not</b>:
 * <ul>
 *   <li><b>the owner's own membership as it stands on QA and will stand on production</b>: free of
 *       the fee, entered before the trail existed, so it breaks the two constraints V35 added
 *       {@code not valid} for exactly that row (btl/CLAUDE.md, section 11: a constraint that does
 *       not survive the rows already there is invisible to every suite that makes its own rows).
 *       Written by lifting every constraint the catalogue calls not valid, inserting, and putting
 *       each back from its own definition, so nothing here names them;
 *   <li>two photographs with rows whose size and digest are the files', a photograph no row names,
 *       files owned by the backend's uid and dated long ago.
 * </ul>
 * Each copy is restored into a database of its own; every database and folder this makes is
 * removed after it, and the test database the rest of the suite reads is never written.
 *
 * <p><b>What this does NOT claim.</b> Anything about R2 or the relay ({@code BackupTransferTest}),
 * about the helper that keeps the plain text in memory ({@code BackupLeavesNothingBehindTest}), or
 * about the host scripts' own lines ({@code BackupScriptTest}). Nor how long a real copy takes.
 */
class BackupCopyTest extends DatabaseTest {

	private static final Path BACKUP = Path.of("..", "deploy", "backup");

	private static final String SCRIPTS = "/tmp/bkp-scripts";

	private static final String SOURCE = "bkp_source";

	private static final String PHOTOS = "/tmp/bkp-source/photos";

	private static final String PASSPHRASE = "a passphrase only this case knows";

	private static PostgreSQLContainer shared;

	private static boolean built;

	@Autowired
	PostgreSQLContainer postgres;

	private final List<String> made = new ArrayList<>();

	private static byte[] lf(Path file) {
		try {
			return Files.readString(file, StandardCharsets.UTF_8).replace("\r\n", "\n")
					.getBytes(StandardCharsets.UTF_8);
		}
		catch (IOException cannotRead) {
			throw new UncheckedIOException("cannot read " + file, cannotRead);
		}
	}

	private ExecResult sh(String command) {
		try {
			return postgres.execInContainer("sh", "-c", command);
		}
		catch (IOException | InterruptedException cannot) {
			throw new IllegalStateException("could not run in the container: " + command, cannot);
		}
	}

	private String ok(String command) {
		ExecResult result = sh(command);
		assertThat(result.getExitCode()).as("%s%n%s%s", command, result.getStdout(), result.getStderr()).isZero();
		return result.getStdout().strip();
	}

	private String psql(String database, String sql) {
		return ok("psql -X -q -v ON_ERROR_STOP=1 -U " + postgres.getUsername() + " -d " + database + " -tA -c \""
				+ sql.replace("\"", "\\\"") + "\"");
	}

	private String aDatabase(String name) {
		ok("createdb -U " + postgres.getUsername() + " " + name);
		made.add("db:" + name);
		return name;
	}

	private String aFolder(String template) {
		String folder = ok("mktemp -d " + template);
		made.add("dir:" + folder);
		return folder;
	}

	@BeforeEach
	void theScriptsAndTheSource() {
		shared = postgres;
		for (String script : List.of("pack.sh", "member.sh", "check.sh", "restore-database.sh", "prove.sh",
				"restore-photos.sh")) {
			postgres.copyFileToContainer(Transferable.of(lf(BACKUP.resolve(script))), SCRIPTS + "/" + script);
		}
		if (built) {
			return;
		}

		String user = postgres.getUsername();
		ok("pg_dump --format=custom -U " + user + " -d " + postgres.getDatabaseName() + " > /dev/shm/bkp-seed.dump");
		ok("createdb -U " + user + " " + SOURCE);
		ok("pg_restore --exit-on-error --single-transaction --no-owner -U " + user + " -d " + SOURCE
				+ " /dev/shm/bkp-seed.dump && rm -f /dev/shm/bkp-seed.dump");

		ok("mkdir -p " + PHOTOS + " && printf 'the first picture' > " + PHOTOS + "/101"
				+ " && printf 'the second, longer picture' > " + PHOTOS + "/102"
				+ " && printf 'a file no row names' > " + PHOTOS + "/999"
				+ " && chown 1001:1001 " + PHOTOS + "/* && touch -d '2026-01-01 00:00:00' " + PHOTOS + "/*");
		String first = ok("sha256sum " + PHOTOS + "/101 | cut -c1-64");
		String second = ok("sha256sum " + PHOTOS + "/102 | cut -c1-64");

		String fixture = """
				create temp table lifted as
				  select conname, pg_get_constraintdef(oid) as def from pg_constraint
				  where conrelid = 'membership'::regclass and not convalidated;
				do $$ declare one record; begin
				  for one in select * from lifted loop
				    execute format('alter table membership drop constraint %I', one.conname);
				  end loop; end $$;
				insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,
				  city, country_id, first_season, first_season_2027, active, referral_code, referred_by, bio,
				  profile_hidden, birthday_shown, father_name, address, shirt_size, health_statement_at)
				  values ('009001', 'Rezervni', 'Clanovic', 'M', date '1980-01-01',
				  (select id from place where rank = 1), null, null, 2027, false, true, '00112233445566c1',
				  null, '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00');
				insert into membership (competitor_id, season, basis, payment_id) values
				  ((select id from competitor where member_number = '009001'), 2027, 'feeExempt', null);
				do $$ declare one record; begin
				  for one in select * from lifted loop
				    execute format('alter table membership add constraint %I %s', one.conname, one.def);
				  end loop; end $$;
				insert into photo (id, media_type, byte_size, digest, crop_x, crop_y, crop_diameter) values
				  (101, 'image/jpeg', 17, 'FIRST', 0.5, 0.5, 1),
				  (102, 'image/png', 26, 'SECOND', 0.5, 0.5, 1);
				select count(*) from lifted;
				""".replace("FIRST", first).replace("SECOND", second);
		postgres.copyFileToContainer(Transferable.of(fixture.getBytes(StandardCharsets.UTF_8)), "/tmp/bkp-fixture.sql");
		String lifted = ok("psql -X -q -v ON_ERROR_STOP=1 -U " + user + " -d " + SOURCE + " -tA -f /tmp/bkp-fixture.sql");

		assertThat(Integer.parseInt(lifted))
				.as("the schema has constraints that are not valid on membership, V35's two, and this case is about them")
				.isGreaterThanOrEqualTo(2);
		built = true;
	}

	@AfterEach
	void removeWhatThisCaseMade() {
		for (String one : made) {
			if (one.startsWith("db:")) {
				sh("dropdb -U " + postgres.getUsername() + " --if-exists " + one.substring(3));
			}
			else {
				sh("rm -rf " + one.substring(4));
			}
		}
	}

	@AfterAll
	static void removeTheSource() throws Exception {
		if (shared != null && built) {
			shared.execInContainer("sh", "-c", "dropdb -U " + shared.getUsername() + " --if-exists " + SOURCE
					+ "; rm -rf /tmp/bkp-source /tmp/bkp-scripts /tmp/bkp-fixture.sql");
			built = false;
		}
	}

	/** A work folder in memory holding the passphrase and a copy of {@code database}, made the way the host makes it. */
	private String aCopyOf(String database, String photos) {
		String work = aFolder("/dev/shm/bkp-work.XXXXXX");
		ok("printf '%s' '" + PASSPHRASE + "' > " + work + "/passphrase");
		ok("pg_dump --format=custom -U " + postgres.getUsername() + " -d " + database + " > " + work + "/btl.dump");
		ok("sh " + SCRIPTS + "/pack.sh " + work + " " + photos);
		return work;
	}

	private ExecResult check(String work) {
		return sh("sh " + SCRIPTS + "/check.sh " + work + " " + work + "/copy.gpg");
	}

	private ExecResult restore(String work, String into) {
		return sh("env POSTGRES_DB=" + into + " sh -c \"$(cat " + SCRIPTS + "/restore-database.sh)\" < "
				+ work + "/check/btl.dump");
	}

	/** One step of prove.sh, as {@code backup.sh --prove} runs it: the step, the work folder, and the time if the step takes one. */
	private ExecResult prove(String work, String into, String step) {
		String[] words = step.split(" ", 2);
		return sh("env POSTGRES_DB=" + into + " sh " + SCRIPTS + "/prove.sh " + words[0] + " " + work
				+ (words.length > 1 ? " " + words[1] : ""));
	}

	/**
	 * A COPY RESTORES WHOLE: ITS MIGRATION HISTORY, THE OWNER'S MEMBERSHIP THAT PREDATES ITS
	 * CONSTRAINTS, AND THOSE CONSTRAINTS STILL NOT VALID.
	 *
	 * <p>The measurement btl/CLAUDE.md section 11 asks for. pg_dump writes a constraint that is not
	 * valid AFTER the data, with the words NOT VALID; this is where that is measured rather than
	 * assumed, on the real table, with the real row. And Flyway's own table comes back
	 * with every migration and its checksum, so the backend that starts on it migrates nothing twice.
	 * The proof that is written down afterwards carries counts and no member.
	 */
	@Test
	void aCopyRestoresWholeWithItsHistoryAndTheConstraintsThatWereNotValid() {
		String work = aCopyOf(SOURCE, PHOTOS);
		ExecResult checked = check(work);
		assertThat(checked.getExitCode()).as(checked.getStderr()).isZero();
		assertThat(checked.getStdout()).contains("2 photo rows, 3 files, 1 files no row names");

		String into = aDatabase("bkp_restored_whole");
		ExecResult restored = restore(work, into);
		assertThat(restored.getExitCode()).as(restored.getStderr()).isZero();

		ExecResult counted = prove(work, into, "counts");
		assertThat(counted.getExitCode()).as(counted.getStderr()).isZero();

		String exemptWithoutTrail = "select count(*) from membership where basis = 'feeExempt' and decided_by_name is null";
		assertThat(psql(into, exemptWithoutTrail)).as("the owner's membership, as it stands").isEqualTo("1");

		String notValid = "select string_agg(conrelid::regclass || '.' || conname || ' ' || pg_get_constraintdef(oid), ' | '"
				+ " order by conname) from pg_constraint where not convalidated and connamespace = 'public'::regnamespace";
		assertThat(psql(into, notValid))
				.as("every constraint that was not valid is back, with its definition, and still not valid")
				.isEqualTo(psql(SOURCE, notValid))
				.contains("membership.");

		String history = "select count(*) || ' ' || string_agg(version || ':' || coalesce(checksum, 0), ',' order by installed_rank)"
				+ " from " + flywayTable();
		assertThat(psql(into, history)).as("the copy carries Flyway's history whole").isEqualTo(psql(SOURCE, history));

		String now = ok("date +%s");
		ExecResult aged = prove(work, into, "age " + now);
		assertThat(aged.getExitCode()).as(aged.getStderr()).isZero();
		ExecResult recorded = prove(work, into, "record " + now);
		assertThat(recorded.getExitCode()).as(recorded.getStderr()).isZero();

		String proof = ok("cat " + work + "/proof.txt");
		assertThat(proof)
				.contains("result restored")
				.contains("copy-photos 2")
				.doesNotContain("Rezervni")
				.doesNotContain("009001")
				.doesNotContain("@");
	}

	/**
	 * THE PHOTOGRAPHS COME BACK BYTE FOR BYTE, TO THE BACKEND'S UID, AND AS YOUNG AS THE RESTORE.
	 *
	 * <p>The source files are dated 1 January 2026, so a restore that kept their time would hand the
	 * backend's hourly sweep files that look nine months old (ThePicturesFolderIsSwept deletes a file
	 * no row names once it is ten minutes old). That is what {@code tar -m} is for, and the moment
	 * read before the restore is the floor every restored file has to stand on.
	 */
	@Test
	void thePhotographsComeBackWholeOwnedAsTheyWereAndAsYoungAsTheRestore() {
		String work = aCopyOf(SOURCE, PHOTOS);
		assertThat(check(work).getExitCode()).isZero();

		String target = aFolder("/tmp/bkp-restored.XXXXXX");
		ok("mkdir " + target + "/photos");
		long before = Long.parseLong(ok("date +%s"));

		ExecResult restored = sh("sh " + SCRIPTS + "/restore-photos.sh " + work + " " + work + "/copy.gpg " + target + "/photos");
		assertThat(restored.getExitCode()).as(restored.getStderr()).isZero();

		for (String name : List.of("101", "102", "999")) {
			assertThat(ok("sha256sum " + target + "/photos/" + name + " | cut -c1-64"))
					.as("photograph %s came back as it was", name)
					.isEqualTo(ok("sha256sum " + PHOTOS + "/" + name + " | cut -c1-64"));
			String[] owner = ok("stat -c '%u %Y' " + target + "/photos/" + name).split(" ");
			assertThat(owner[0]).as("photograph %s belongs to the backend's uid", name).isEqualTo("1001");
			assertThat(Long.parseLong(owner[1]))
					.as("photograph %s came back with its old time, which the sweep reads as old", name)
					.isGreaterThanOrEqualTo(before);
		}
	}

	/**
	 * A PHOTOGRAPH THAT IS NOT WHAT ITS ROW DESCRIBES IS NAMED, BY THE ROW'S SIZE AND THE ROW'S DIGEST.
	 *
	 * <p>Three ways a file can fail its row: different bytes of the SAME length (only the digest
	 * tells), a byte more (the size tells), and no file at all. Each has to be named, and the copy is
	 * still whole (exit 3, not 1): its database is good. A check that took the expected digest from
	 * the file itself would pass the first, and that is the mutation this is here for.
	 */
	@Test
	void aPhotographThatIsNotItsRowIsNamed() {
		String wrong = aFolder("/tmp/bkp-wrong.XXXXXX");
		ok("mkdir " + wrong + "/photos && cp -p " + PHOTOS + "/101 " + wrong + "/photos/"
				+ " && printf 'THE first picture' > " + wrong + "/photos/101");
		assertThat(ok("wc -c < " + wrong + "/photos/101")).as("the same length, so only the digest can tell").isEqualTo("17");

		String work = aCopyOf(SOURCE, wrong + "/photos");
		ExecResult checked = check(work);

		assertThat(checked.getExitCode()).as(checked.getStdout() + checked.getStderr()).isEqualTo(3);
		assertThat(checked.getStderr())
				.contains("photo 101: the file is not the picture its row describes")
				.contains("photo 102: no file in the copy");

		ok("printf 'the first picture!' > " + wrong + "/photos/101");
		String longer = aCopyOf(SOURCE, wrong + "/photos");
		ExecResult sized = check(longer);
		assertThat(sized.getExitCode()).isEqualTo(3);
		assertThat(sized.getStderr()).contains("photo 101: the row says 17 bytes and the file has 18");
	}

	/**
	 * THE EXPECTED COUNTS ARE THE DUMP'S, NOT THE RESTORED DATABASE'S.
	 *
	 * <p>A row is taken out of the restored database after the restore. The dump still carries it,
	 * so the proof has to say which table lost what; a proof that counted the restored database to
	 * know what to expect would compare it with itself and pass.
	 */
	@Test
	void theExpectedCountsAreTheDumpsAndNotTheRestoredDatabases() {
		String work = aCopyOf(SOURCE, PHOTOS);
		assertThat(check(work).getExitCode()).isZero();
		String into = aDatabase("bkp_restored_short");
		assertThat(restore(work, into).getExitCode()).isZero();

		psql(into, "delete from membership");

		ExecResult counted = prove(work, into, "counts");
		assertThat(counted.getExitCode()).as("a restored database short of a row was proved").isEqualTo(1);
		assertThat(counted.getStderr())
				.contains("< public.membership 1")
				.contains("> public.membership 0");
	}

	/**
	 * A COPY OF A DATABASE NOBODY MIGRATED PROVES NOTHING, EVEN THOUGH EVERY COUNT MATCHES.
	 *
	 * <p>Two empty tables, dumped, packed, opened and restored: the dump says zero and the restored
	 * database says zero, so every comparison agrees. The floor is what refuses it.
	 */
	@Test
	void aCopyOfADatabaseNobodyMigratedProvesNothing() {
		String hollow = aDatabase("bkp_hollow");
		psql(hollow, "create table photo (id bigint primary key, media_type text, byte_size integer, digest text);"
				+ " create table " + flywayTable() + " (installed_rank integer primary key)");
		String empty = aFolder("/tmp/bkp-empty.XXXXXX");
		ok("mkdir " + empty + "/photos");

		String work = aCopyOf(hollow, empty + "/photos");
		assertThat(check(work).getExitCode()).isZero();
		String into = aDatabase("bkp_hollow_restored");
		assertThat(restore(work, into).getExitCode()).isZero();

		ExecResult counted = prove(work, into, "counts");
		assertThat(counted.getExitCode()).as("a copy of nothing was proved").isEqualTo(1);
		assertThat(counted.getStderr()).contains("nobody migrated");
	}

	/** Twenty six hours is the owner's number (ADL O19, 20.10.2026), and its edge is held both ways. */
	@Test
	void aCopyOlderThanTwentySixHoursIsRefused() {
		String work = aCopyOf(SOURCE, PHOTOS);
		assertThat(check(work).getExitCode()).isZero();
		long created = Long.parseLong(ok("sed -n 's/^created //p' " + work + "/check/manifest"));

		assertThat(prove(work, "none", "age " + (created + 26 * 3600)).getExitCode()).isZero();
		ExecResult late = prove(work, "none", "age " + (created + 26 * 3600 + 1));
		assertThat(late.getExitCode()).isEqualTo(1);
		assertThat(late.getStderr()).contains("26");
		assertThat(prove(work, "none", "age " + (created - 1)).getExitCode())
				.as("a copy made in the future means a clock is wrong").isEqualTo(1);
	}

	/**
	 * A CHANGED BYTE, A WRONG PASSPHRASE, OR A DUMP THAT IS NOT THE ONE THE MANIFEST NAMES, IS NOT A
	 * COPY.
	 *
	 * <p>The third is built by hand: the archive opened, its dump changed by one byte, packed and
	 * encrypted again with the right passphrase, so gpg is satisfied and only the manifest can tell.
	 */
	@Test
	void aChangedByteAWrongPassphraseOrAnotherDumpIsRefused() {
		String work = aCopyOf(SOURCE, PHOTOS);
		assertThat(check(work).getExitCode()).as("the floor: the copy as made opens").isZero();

		ok("cp " + work + "/copy.gpg " + work + "/whole.gpg");
		ok("size=$(stat -c %s " + work + "/copy.gpg); printf 'Z' | dd of=" + work
				+ "/copy.gpg bs=1 seek=$((size - 40)) conv=notrunc 2>/dev/null");
		ExecResult changed = check(work);
		assertThat(changed.getExitCode()).isEqualTo(1);
		assertThat(changed.getStderr()).contains("gpg refused");

		ok("cp " + work + "/whole.gpg " + work + "/copy.gpg && printf 'another passphrase' > " + work + "/passphrase");
		ExecResult wrongKey = check(work);
		assertThat(wrongKey.getExitCode()).isEqualTo(1);
		assertThat(wrongKey.getStderr()).contains("gpg refused");

		ok("printf '%s' '" + PASSPHRASE + "' > " + work + "/passphrase");
		String apart = aFolder("/dev/shm/bkp-apart.XXXXXX");
		ok("export GNUPGHOME=$(mktemp -d " + apart + "/g.XXXXXX); cd " + apart
				+ " && gpg --batch --quiet --pinentry-mode loopback --passphrase-file " + work + "/passphrase -d "
				+ work + "/whole.gpg > archive.tar && mkdir x && tar -xf archive.tar -C x"
				+ " && printf 'Z' >> x/btl.dump"
				+ " && tar --numeric-owner -cf - -C x manifest btl.dump photos"
				+ " | gpg --batch --quiet --pinentry-mode loopback --passphrase-file " + work + "/passphrase"
				+ " --symmetric --cipher-algo AES256 -z 0 -o " + work + "/copy.gpg --yes"
				+ "; gpgconf --kill gpg-agent");
		ExecResult another = check(work);
		assertThat(another.getExitCode()).isEqualTo(1);
		assertThat(another.getStderr()).contains("is not the one the manifest names");
	}

	/** A restore into a database that holds anything writes nothing into it. */
	@Test
	void aRestoreIntoADatabaseThatHoldsAnythingWritesNothing() {
		String work = aCopyOf(SOURCE, PHOTOS);
		assertThat(check(work).getExitCode()).isZero();
		String before = psql(SOURCE, "select count(*) from membership");

		ExecResult restored = restore(work, SOURCE);

		assertThat(restored.getExitCode()).isEqualTo(4);
		assertThat(restored.getStderr()).contains("REFUSED").contains("restored into an empty one");
		assertThat(psql(SOURCE, "select count(*) from membership")).isEqualTo(before);
	}
}
