package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
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

	private static final String CLIENT_TOLD = "/tmp/b190-client";

	/**
	 * The {@code docker} on the PATH of the driver, as a FILE and not a function, because what is
	 * measured below is a shell waiting for a foreground command that is a separate process: a
	 * function runs in the shell itself and has no such wait. It writes down what it was asked. When
	 * {@code SLOW} is set, {@code exec} and {@code run} take eight seconds and, on a TERM, say so and
	 * end, as a real docker client does; {@code SLOW_RM} makes {@code rm} take two, so that the way
	 * out lasts long enough to be signalled; {@code LEFTOVER} makes {@code ps} name a container of
	 * the run.
	 */
	private static final String FAKE_DOCKER = """
			#!/bin/sh
			printf 'docker %s\\n' "$*" >> /tmp/b190-docker.calls
			case "$1" in
			  exec|run)
			    if [ "${SLOW:-}" = yes ]; then
			      sleep 8 </dev/null >/dev/null 2>&1 &
			      slept=$!
			      trap 'echo CLIENT-TERM >> /tmp/b190-client; kill $slept 2>/dev/null; exit 143' TERM
			      wait $slept
			    fi
			    ;;
			  ps)
			    if [ "${LEFTOVER:-}" = yes ]; then echo pour-left-1; fi
			    ;;
			  rm)
			    if [ "${SLOW_RM:-}" = yes ]; then sleep 2; fi
			    printf 'docker %s DONE\\n' "$*" >> /tmp/b190-docker.calls
			    ;;
			esac
			exit 0
			""";

	/**
	 * What the pour's script is to the helper: the three things it needs, a {@code docker} that
	 * writes down what it was asked, and one named scenario to carry out after sourcing it.
	 */
	private static final String DRIVER = """
			set -eu
			fail() { printf 'REFUSED: %s\\n' "$*"; exit 1; }
			say() { printf '%s\\n' "$*"; }
			REFERENCE=the-reference-database
			export PATH=/tmp/b190-bin:$PATH
			: > /tmp/b190-docker.calls
			rm -f /tmp/b190-client
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
			  step-signal)
			    export SLOW=yes LEFTOVER=yes
			    ( sleep 1; kill -"$2" $$ ) &
			    step docker exec -i the-database psql
			    echo SURVIVED
			    ;;
			  second-signal)
			    export SLOW=yes LEFTOVER=yes SLOW_RM=yes
			    ( sleep 1; kill -TERM $$; sleep 1; kill -"$2" $$ ) &
			    step docker exec -i the-database psql
			    echo SURVIVED
			    ;;
			  refused-then-signal)
			    export SLOW_RM=yes
			    ( sleep 1; kill -TERM $$ ) &
			    fail 'something refused'
			    ;;
			  container)
			    container --entrypoint sh an-image -c x
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
	 *
	 * <p><b>The row says {@code ERROR:} in the middle of its text, on purpose.</b> That is what a
	 * member's own free text can do, and it separates a filter that keeps the lines that BEGIN with
	 * the server's {@code ERROR:} from one that keeps every line that contains the word: the second
	 * prints the CONTEXT and the DETAIL, which carry the row. A probe without it passed both, found
	 * by replacing the anchored pattern with an unanchored one and watching this class stay green.
	 */
	private static final String PROBE = """
			create temp table b190_probe (id integer primary key, who text not null,
			  verdict text not null check (verdict <> 'no'));
			copy b190_probe from stdin;
			1\tMarker Memberson says ERROR: not an error line\tno
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
		postgres.copyFileToContainer(
				Transferable.of(FAKE_DOCKER.getBytes(StandardCharsets.UTF_8), 0755), "/tmp/b190-bin/docker");

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
	 * Runs a scenario and says how long it took and with what status, which {@code run} cannot.
	 *
	 * <p>The cases that use it are {@code NOT_SUPPORTED}: they run no SQL, and the transaction every
	 * case of {@link DatabaseTest} holds would sit idle for as long as they last, which is more than
	 * twenty seconds for the longest. Measured 21.10.2026 on Docker Desktop for Windows: after a case
	 * that long the connection came back from its transaction unusable, and the FIRST statement of the
	 * next class that used the pool, {@code PouringFromQaTest}, failed with an I/O error sending to the
	 * backend. A case that holds no connection has nothing to lose.
	 */
	private ExecResult timed(String scenario, String... more) throws Exception {
		run("exit");
		String command = "start=$(date +%s); sh " + DRIVER_THERE + " " + scenario + " " + String.join(" ", more)
				+ "; echo RC=$?; echo ELAPSED=$(( $(date +%s) - start ))";
		return sh(command);
	}

	private static long numberOf(String name, ExecResult result) {
		Matcher line = Pattern.compile("^" + name + "=(\\d+)$", Pattern.MULTILINE).matcher(result.getStdout());
		assertThat(line.find()).as("no %s= line: %s %s", name, result.getStdout(), result.getStderr()).isTrue();
		return Long.parseLong(line.group(1));
	}

	/**
	 * A SIGNAL THAT ARRIVES WHILE A COMMAND IS RUNNING IS ACTED ON AT ONCE, AND THE WAY OUT SAYS SO: THE
	 * CASE THE ONE ABOVE DOES NOT HAVE, BECAUSE IT SENDS ITS SIGNAL FROM A SCRIPT WITH NO FOREGROUND CHILD.
	 *
	 * <p>A shell runs a trap only after the foreground command it is waiting for has ended, and the
	 * pour spends nearly all of its time in such a command (a {@code docker exec} of a
	 * {@code psql}, for a read of QA or for the transaction on production). A TERM from a stop, or a
	 * {@code kill} of the script, reaches the shell and not the child, so it used to wait for the
	 * child, and a child that hangs does not end. Measured 21.10.2026 in dash: with a client that
	 * takes eight seconds and a signal sent one second in, the work directory was removed at the
	 * eighth second, for TERM and for INT alike. The command here is that client, a separate
	 * process, and the signal is sent by another process one second in, so what is measured is the
	 * time to the end of the script: well under the eight seconds of the step.
	 *
	 * <p>And the rest of the way out is held: the client of the step was told to stop, the containers
	 * that carry the run's label were looked up and removed, the work directory is gone, the status
	 * is 128 plus the signal, and the terminal was told, once, which signal ended it.
	 */
	@Test
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	void aSignalWhileACommandRunsIsActedOnAtOnceAndTheRunsContainersAreRemoved() throws Exception {
		String[][] ways = { { "HUP", "129" }, { "INT", "130" }, { "TERM", "143" } };

		for (String[] way : ways) {
			ExecResult result = timed("step-signal", way[0]);
			String work = workOf(result);

			assertThat(result.getStdout()).as("after %s the script went on", way[0]).doesNotContain("SURVIVED");
			assertThat(numberOf("RC", result)).as("the status after %s", way[0]).isEqualTo(Long.parseLong(way[1]));
			assertThat(numberOf("ELAPSED", result))
					.as("seconds from the start to the end of the script after %s, while the step takes eight", way[0])
					.isLessThan(5);
			assertThat(exists(work)).as("the work directory %s after %s", work, way[0]).isFalse();

			assertThat(sh("cat " + CLIENT_TOLD + " 2>/dev/null || echo none").getStdout())
					.as("the docker client of the step was told to stop, after %s", way[0]).contains("CLIENT-TERM");
			assertThat(dockerCalls())
					.as("the containers of the run are looked up by its label and removed, after %s", way[0])
					.containsPattern("(?m)^docker ps -q --filter label=btl-pour-run=\\d+$")
					.contains("docker rm -f pour-left-1 DONE")
					.contains("docker rm -f the-reference-database DONE");

			assertThat(result.getStderr().split("STOPPED: the pour was ended by ", -1))
					.as("the terminal is told once which signal ended the pour, after %s", way[0])
					.hasSize(2)
					.satisfies(parts -> assertThat(parts[1]).startsWith(way[0] + ".").contains("--check"));
		}
	}

	/**
	 * A SECOND SIGNAL WHILE THE WAY OUT IS RUNNING DOES NOT END IT: THE WORK DIRECTORY IS STILL
	 * REMOVED, THE REFERENCE CONTAINER IS STILL ASKED TO GO, AND THE TERMINAL IS TOLD ONCE.
	 *
	 * <p>A signal handler runs {@code exit}, which runs the cleanup, and a signal that arrived while
	 * the cleanup ran used to run {@code exit} again from inside it, so the cleanup stopped where it
	 * was and the work directory, with every table of the database in plain text, stayed.
	 * Measured 21.10.2026 in dash. The first signal is a TERM during a step; the removal of a
	 * container takes two seconds here; the second signal, a second later, arrives while it runs.
	 */
	@Test
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	void aSecondSignalWhileTheWayOutRunsDoesNotEndItAndTheWorkDirectoryIsStillRemoved() throws Exception {
		for (String second : new String[] { "HUP", "INT", "TERM" }) {
			ExecResult result = timed("second-signal", second);
			String work = workOf(result);

			assertThat(result.getStdout()).as("after a TERM and then a %s the script went on", second)
					.doesNotContain("SURVIVED");
			assertThat(exists(work)).as("the work directory %s after a TERM and then a %s", work, second).isFalse();
			assertThat(numberOf("RC", result)).as("the status is the first signal's, after a second %s", second)
					.isEqualTo(143);
			assertThat(dockerCalls())
					.as("the reference container is asked to go and does, after a TERM and then a %s", second)
					.contains("docker rm -f the-reference-database DONE");
			assertThat(result.getStderr().split("STOPPED: the pour was ended by ", -1))
					.as("the terminal is told once, not once per signal, after a TERM and then a %s", second)
					.hasSize(2);
		}
	}

	/**
	 * A SIGNAL DURING A WAY OUT THAT NO SIGNAL BEGAN IS IGNORED TOO: A REFUSAL IS THE WAY OUT HERE.
	 *
	 * <p>The cleanup also runs after {@code fail} and after a plain exit, and what ignores a signal
	 * during it has to be the cleanup and not the signal handler, or a stop that arrives while a
	 * refused pour is being cleaned up ends the cleanup halfway. The status is the refusal's, the work
	 * directory is gone, and the terminal is not told the pour was stopped, because it was not.
	 */
	@Test
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	void aSignalWhileARefusalIsBeingCleanedUpDoesNotEndTheCleanup() throws Exception {
		ExecResult result = timed("refused-then-signal");
		String work = workOf(result);

		assertThat(numberOf("RC", result)).as("the refusal's status, not the signal's").isEqualTo(1);
		assertThat(exists(work)).as("the work directory %s after a refusal and then a TERM", work).isFalse();
		assertThat(dockerCalls()).contains("docker rm -f the-reference-database DONE");
		assertThat(result.getStderr()).doesNotContain("STOPPED:");
	}

	/** A CONTAINER THE POUR STARTS HAS AN INIT AND THE RUN'S LABEL, so that the way out can find it. */
	@Test
	void aContainerOfThePourHasAnInitAndTheRunsLabel() throws Exception {
		run("container");

		assertThat(dockerCalls())
				.containsPattern("(?m)^docker run --rm --init --label btl-pour-run=\\d+ --entrypoint sh an-image -c x$");
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
