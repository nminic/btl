package com.btl.portal.db;

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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT {@code deploy/pour-from-qa/leaves-nothing-behind.sh} DOES, MEASURED IN A REAL LINUX WITH
 * REAL SIGNALS AND A REAL {@code psql}.
 *
 * <p>The pour writes every table of the database to one file in plain text. Whether that file is
 * gone after a Ctrl-C, whether it was ever on a disk, and what the terminal is shown when the
 * pour fails are facts about a shell and about what PostgreSQL prints, and no reading of the text
 * answers them: the question that cannot be answered by reading is whether a handler that merely
 * cleans up lets the script carry on and pour without its files. So the helper is run, here, in
 * the container this suite already starts, under {@code sh} (dash on this image, as on the
 * Debian host), sent {@code HUP}, {@code INT} and {@code TERM} by itself, and looked at.
 *
 * <p><b>Why it runs in the container and not on the machine that runs the build.</b> The build
 * runs on Windows and on Linux, {@code /dev/shm} and {@code stat -f} exist on one of them, and
 * a Windows checkout carries CRLF that {@code sh} reads as part of every word. The files are
 * therefore read here, folded to LF, and handed to the container.
 *
 * <p><b>The seam.</b> The helper needs {@code fail}, {@code say} and {@code REFERENCE} from the
 * shell that sources it, and calls {@code docker}. The driver below supplies the first three and
 * a {@code docker} that only writes down what it was asked, so what the helper does to the
 * reference container is read off a file. Nothing else is replaced.
 *
 * <p><b>What this does NOT claim.</b> It does not run the pour, and it cannot show what happens
 * to a script killed with {@code KILL}, which nothing can catch; the helper's header says what
 * survives that and why it matters less. And {@code /dev/shm} in this container is memory
 * because Docker makes it so, which is what the host has too, but a host where it is not is not
 * something this can reach: the refusal for that is exercised by pretending {@code stat} said
 * something else.
 */
class PouringFromQaLeavesNothingBehindTest extends DatabaseTest {

	private static final Path HELPER =
			Path.of("..", "deploy", "pour-from-qa", "leaves-nothing-behind.sh");

	private static final String HELPER_THERE = "/tmp/b190-leaves-nothing-behind.sh";

	private static final String DRIVER_THERE = "/tmp/b190-driver.sh";

	private static final String PROBE_THERE = "/tmp/b190-probe.sql";

	private static final String DOCKER_CALLS = "/tmp/b190-docker.calls";

	/**
	 * What the pour's script is to the helper: the three things it needs, a {@code docker} that
	 * writes down what it was asked, and one named scenario to carry out after sourcing it.
	 */
	private static final String DRIVER = """
			set -eu
			fail() { printf 'REFUSED: %s\\n' "$*"; exit 1; }
			say() { printf '%s\\n' "$*"; }
			REFERENCE=the-reference-database
			: > /tmp/b190-docker.calls
			docker() { printf 'docker %s\\n' "$*" >> /tmp/b190-docker.calls; }
			scenario=$1
			if [ "$scenario" = not-memory ]; then
			  stat() { echo ext4; }
			fi
			. /tmp/b190-leaves-nothing-behind.sh
			printf 'WORK=%s\\n' "$WORK"
			case "$scenario" in
			  exit) ;;
			  hup) kill -HUP $$; echo SURVIVED ;;
			  int) kill -INT $$; echo SURVIVED ;;
			  term) kill -TERM $$; echo SURVIVED ;;
			  where)
			    printf 'MODE=%s\\n' "$(stat -c %a "$WORK")"
			    printf 'KIND=%s\\n' "$(stat -f -c %T "$WORK")"
			    : > "$WORK/a-file"
			    printf 'FILEMODE=%s\\n' "$(stat -c %a "$WORK/a-file")"
			    ;;
			  report)
			    PGPASSWORD=$4 psql -h 127.0.0.1 -U "$2" -d "$3" -v ON_ERROR_STOP=1 -f - \\
			      < /tmp/b190-probe.sql > "$WORK/pour.log" 2>&1 || true
			    report_failure "$WORK/pour.log" production
			    ;;
			esac
			""";

	/**
	 * A COPY that fails a check, written in the shape the pour sends one: from standard input, by
	 * {@code psql -f -}, with the row inline. The row carries a name that is not a real person's,
	 * and is what the case looks for on the terminal. A TEMP table, so it is gone when the session
	 * ends and the schema every other case reads is never touched.
	 */
	private static final String PROBE = """
			create temp table b190_probe (id integer primary key, who text not null,
			  verdict text not null check (verdict <> 'no'));
			copy b190_probe from stdin;
			1\tMarker Memberson\tno
			\\.
			""";

	@Autowired
	PostgreSQLContainer postgres;

	private static byte[] lf(Path file) {
		try {
			return Files.readString(file, StandardCharsets.UTF_8)
					.replace("\r\n", "\n")
					.getBytes(StandardCharsets.UTF_8);
		}
		catch (IOException cannotRead) {
			throw new UncheckedIOException("cannot read " + file, cannotRead);
		}
	}

	private ExecResult sh(String command) throws Exception {
		return postgres.execInContainer("sh", "-c", command);
	}

	/** Puts the helper, the driver and the probe in the container and runs one scenario. */
	private ExecResult run(String scenario, String... more) throws Exception {
		postgres.copyFileToContainer(Transferable.of(lf(HELPER)), HELPER_THERE);
		postgres.copyFileToContainer(
				Transferable.of(DRIVER.getBytes(StandardCharsets.UTF_8)), DRIVER_THERE);
		postgres.copyFileToContainer(
				Transferable.of(PROBE.getBytes(StandardCharsets.UTF_8)), PROBE_THERE);

		String command = "sh " + DRIVER_THERE + " " + scenario + " " + String.join(" ", more);
		return sh(command);
	}

	private static String workOf(ExecResult result) {
		Matcher work = Pattern.compile("^WORK=(\\S+)$", Pattern.MULTILINE).matcher(result.getStdout());
		assertThat(work.find()).as("the driver printed no WORK= line: %s", result.getStdout()).isTrue();
		return work.group(1);
	}

	private boolean exists(String path) throws Exception {
		return sh("[ -e '" + path + "' ] && echo yes || echo no").getStdout().strip().equals("yes");
	}

	private String dockerCalls() throws Exception {
		return sh("cat " + DOCKER_CALLS).getStdout();
	}

	/**
	 * THE WORK DIRECTORY IS GONE AFTER EVERY WAY OUT A SHELL CAN CATCH, and the script does not go
	 * on after a signal.
	 *
	 * <p>Both halves are in one case because they are one fault. A trap on a signal that only
	 * cleans up removes the files and then lets the script continue with the next line, so the
	 * pour would run on without them: that is {@code SURVIVED} on the standard output, and the
	 * status of such a script is 0, not 128 plus the signal. The reference container has to be
	 * asked to go on each of the four ways out too, because the same trap carries it.
	 */
	@Test
	void everyWayOutThatCanBeCaughtRemovesTheWorkAndEndsTheScript() throws Exception {
		String[][] ways = {
				{ "exit", "0" },
				{ "hup", "129" },
				{ "int", "130" },
				{ "term", "143" } };

		for (String[] way : ways) {
			ExecResult result = run(way[0]);
			String work = workOf(result);

			assertThat(result.getStdout())
					.as("after %s the script went on to its next line", way[0])
					.doesNotContain("SURVIVED");
			assertThat(result.getExitCode())
					.as("the exit status after %s", way[0])
					.isEqualTo(Integer.parseInt(way[1]));
			assertThat(exists(work))
					.as("the work directory %s is still there after %s", work, way[0])
					.isFalse();
			assertThat(dockerCalls())
					.as("the reference container was not removed after %s", way[0])
					.contains("docker rm -f the-reference-database");
		}
	}

	/**
	 * IT IS IN MEMORY, AND NOBODY BUT THE OWNER CAN READ IT.
	 *
	 * <p>The filesystem is asked what it is, here by asking it again from outside the helper: the
	 * directory is on tmpfs, it is private, and a file made inside it is private too, which is
	 * what {@code umask 077} is for and what a file moved out of the directory would otherwise
	 * lose.
	 */
	@Test
	void theWorkDirectoryIsInMemoryAndPrivate() throws Exception {
		ExecResult result = run("where");

		assertThat(workOf(result)).startsWith("/dev/shm/btl-pour.");
		assertThat(result.getStdout())
				.contains("KIND=tmpfs")
				.contains("MODE=700")
				.contains("FILEMODE=600");
	}

	/**
	 * A FILESYSTEM THAT IS NOT MEMORY IS REFUSED, AND NOTHING IS CREATED.
	 *
	 * <p>The only way to reach that branch in a container whose {@code /dev/shm} is memory is to
	 * have {@code stat} say otherwise, which the driver does for this one scenario. What is held
	 * is that the helper believes what the filesystem says and not the name of the directory, and
	 * that it refuses before it makes anything.
	 */
	@Test
	void aFilesystemThatIsNotMemoryIsRefusedBeforeAnythingIsMade() throws Exception {
		String count = "ls -d /dev/shm/btl-pour.* 2>/dev/null | wc -l";
		String before = sh(count).getStdout().strip();

		ExecResult result = run("not-memory");

		assertThat(result.getExitCode()).isEqualTo(1);
		assertThat(result.getStdout()).contains("REFUSED:").contains("not tmpfs");
		assertThat(sh(count).getStdout().strip())
				.as("a work directory was made although the filesystem was refused")
				.isEqualTo(before);
	}

	/**
	 * WHAT A FAILED COPY SAYS NEVER REACHES THE TERMINAL EXCEPT THE ERROR LINE, AND THE REST IS KEPT.
	 *
	 * <p>This is the real thing: {@code psql} fails a COPY in the container, writes what
	 * PostgreSQL says to a file as the pour does, and the helper reports it. The first
	 * assertions are about the raw log and are what stops this case from measuring nothing: the
	 * marker is in the DETAIL and in the CONTEXT of what PostgreSQL printed, so a filter that was
	 * never needed would also pass. What is then held is that the terminal gets the ERROR line, which
	 * names the table and the constraint, that no other line is shown, and that the whole log is
	 * kept in memory under a name the terminal prints, readable by nobody else.
	 */
	@Test
	void aFailedCopyShowsTheErrorLineAndKeepsTheRestInMemory() throws Exception {
		ExecResult result = run("report", postgres.getUsername(), postgres.getDatabaseName(),
				postgres.getPassword());

		String shown = result.getStdout();
		Matcher kept = Pattern.compile("(/dev/shm/btl-pour-failed\\.\\w+)").matcher(shown);
		assertThat(kept.find()).as("the report names no kept log: %s", shown).isTrue();
		String log = kept.group(1);

		try {
			String whole = sh("cat " + log).getStdout();
			assertThat(whole)
					.as("PostgreSQL did not print the row in what it said, so nothing here was"
							+ " measured: the probe has to fail the way a real COPY fails")
					.contains("Marker Memberson")
					.contains("DETAIL:")
					.contains("CONTEXT:");

			assertThat(shown)
					.contains("ERROR:")
					.contains("violates check constraint")
					.doesNotContain("Marker Memberson")
					.doesNotContain("DETAIL")
					.doesNotContain("CONTEXT")
					.doesNotContain("Failing row");

			assertThat(sh("stat -c %a " + log).getStdout().strip())
					.as("the kept log can hold member rows and nobody else may read it")
					.isEqualTo("600");
			assertThat(sh("stat -f -c %T " + log).getStdout().strip())
					.as("and it is in memory like the rest")
					.isEqualTo("tmpfs");
		}
		finally {
			sh("rm -f " + log);
		}
	}
}
