package com.btl.portal.deploy;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.Container.ExecResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.utility.DockerImageName;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT {@code deploy/backup/in-memory.sh} DOES, MEASURED IN A REAL LINUX WITH REAL SIGNALS.
 *
 * <p>The same questions {@code PouringFromQaLeavesNothingBehindTest} asks of the pour's helper, and
 * more, because this helper carries more duties: a run that ends with anything but 0 is mailed to
 * the superadmin (ADL O19, owner 20.10.2026), so the alert has to be called on every way out that is
 * not a success, before the work folder goes - the relay's settings are in it - and never on a
 * success; and a signal that arrives while a container step is running has to be acted on AT ONCE.
 *
 * <p><b>The seam.</b> The helper needs {@code fail}, {@code say}, {@code THROWAWAY} and
 * {@code alert} from the script that sources it. The driver below supplies them; the alert writes
 * down the status it was called with, whether the work folder and the spool were still there and
 * when. {@code docker} is a FILE on the PATH, not a function, because what is being measured is a
 * shell waiting for a foreground command that is a separate process: a function runs in the shell
 * itself and has no such wait. The file writes down what it was asked, and for {@code docker run}
 * it can stand for a docker client that takes eight seconds, which on receiving SIGTERM says so
 * and ends, as the real client does (measured 21.10.2026 against Docker 29 in dash: SIGTERM to the
 * client ended a container that had {@code --init} and left one that had not).
 *
 * <p>Run in {@code eclipse-temurin:21-jre} with no network, whose {@code sh} is dash, as on the
 * Debian host, and whose {@code /dev/shm} is memory.
 */
class BackupLeavesNothingBehindTest {

	private static final Path HELPER = Path.of("..", "deploy", "backup", "in-memory.sh");

	private static final Path STACK = Path.of("..", "deploy", "backup", "stack.sh");

	private static final String FAKE_DOCKER = """
			#!/bin/sh
			printf 'docker %s\\n' "$*" >> /tmp/bkp-docker.calls
			case "$1" in
			  run)
			    if [ "${SLOW:-}" = yes ]; then
			      sleep 8 </dev/null >/dev/null 2>&1 &
			      slept=$!
			      trap 'echo CLIENT-TERM >> /tmp/bkp-client; kill $slept 2>/dev/null; exit 143' TERM
			      wait $slept
			    fi
			    ;;
			  ps)
			    if [ "${LEFTOVER:-}" = yes ]; then echo bkp-left-1; fi
			    ;;
			  compose)
			    case "$*" in
			      *'ps -a -q backend'*) echo the-backend ;;
			      *'ps -q postgres'*) echo the-database ;;
			    esac
			    ;;
			  inspect)
			    case "$3" in
			      *Config.Env*)
			        printf 'PATH=/usr/bin\\n'
			        printf 'SPRING_DATASOURCE_PASSWORD=the-database-password\\n'
			        if [ "${NOFOLDER:-}" != yes ]; then printf 'BTL_PHOTOS_FOLDER=/var/btl/photos\\n'; fi
			        printf 'PROD_MAIL_PASSWORD=the-relay-key\\n'
			        ;;
			      *Mounts*) echo the-volume ;;
			      *) echo sha256:the-image ;;
			    esac
			    ;;
			esac
			exit 0
			""";

	private static final String DRIVER = """
			set -eu
			fail() { printf 'REFUSED: %s\\n' "$*"; exit 1; }
			say() { printf '%s\\n' "$*"; }
			export PATH=/tmp/bkp-bin:$PATH
			THROWAWAY=the-throwaway-database
			: > /tmp/bkp-docker.calls
			rm -f /tmp/bkp-alert /tmp/bkp-alert-at /tmp/bkp-client /tmp/bkp-started
			alert() {
			  if [ -d "$WORK" ]; then there=yes; else there=no; fi
			  if [ -d "$SPOOL" ]; then kept=yes; else kept=no; fi
			  printf '%s %s %s\\n' "$1" "$there" "$kept" > /tmp/bkp-alert
			  date +%s > /tmp/bkp-alert-at
			}
			scenario=$1
			sig=${2:-}
			if [ "$scenario" = not-memory ]; then
			  stat() { echo ext4; }
			fi
			. /tmp/bkp-in-memory.sh
			printf 'WORK=%s\\n' "$WORK"
			printf 'SPOOL=%s\\n' "$SPOOL"
			case "$scenario" in
			  exit) ;;
			  fail) fail 'something refused' ;;
			  hup) kill -HUP $$; echo SURVIVED ;;
			  int) kill -INT $$; echo SURVIVED ;;
			  term) kill -TERM $$; echo SURVIVED ;;
			  where)
			    printf 'MODE=%s\\n' "$(stat -c %a "$WORK")"
			    printf 'KIND=%s\\n' "$(stat -f -c %T "$WORK")"
			    : > "$WORK/a-file"
			    printf 'FILEMODE=%s\\n' "$(stat -c %a "$WORK/a-file")"
			    printf 'SPOOLMODE=%s\\n' "$(stat -c %a "$SPOOL")"
			    printf 'SPOOLKIND=%s\\n' "$(stat -f -c %T "$SPOOL")"
			    ;;
			  step-signal)
			    export SLOW=yes LEFTOVER=yes
			    date +%s > /tmp/bkp-started
			    ( sleep 1; kill -"$sig" $$ ) &
			    container --network none an-image
			    echo SURVIVED
			    ;;
			  container)
			    container --network none an-image sh x
			    printf 'RC=%s\\n' "$?"
			    ;;
			  stdin)
			    printf 'the dump' > "$WORK/in"
			    step cat < "$WORK/in" > "$WORK/out"
			    printf 'OUT=%s\\n' "$(cat "$WORK/out")"
			    ;;
			  status)
			    rc=0
			    step sh -c 'exit 7' || rc=$?
			    printf 'RC=%s\\n' "$rc"
			    ;;
			esac
			""";

	private static final String STACK_DRIVER = """
			set -eu
			fail() { printf 'REFUSED: %s\\n' "$*"; exit 1; }
			say() { printf '%s\\n' "$*"; }
			export PATH=/tmp/bkp-bin:$PATH
			COMPOSE=compose.prod.yml
			WORK=$(mktemp -d /dev/shm/bkp-stack.XXXXXX)
			trap 'rm -rf "$WORK"' EXIT
			. /tmp/bkp-stack.sh
			find_stack
			printf 'DB=%s\\nIMAGE=%s\\nBACKEND=%s\\nPHOTOS_VOLUME=%s\\n' "$DB" "$IMAGE" "$BACKEND" "$PHOTOS_VOLUME"
			printf 'LEAKED_IN=%s\\n' "$(grep -rl -e the-database-password -e the-relay-key "$WORK" | wc -l | tr -d ' ')"
			printf 'FILES=%s\\n' "$(ls -A "$WORK" | wc -l | tr -d ' ')"
			""";

	private static GenericContainer<?> linux;

	@BeforeAll
	@SuppressWarnings("resource")
	static void aRealLinux() {
		linux = new GenericContainer<>(DockerImageName.parse(BackupScriptTest.transferImage()))
				.withNetworkMode("none")
				.withCreateContainerCmdModifier(create -> create.withEntrypoint("sleep"))
				.withCommand("infinity");
		linux.start();
		linux.copyFileToContainer(Transferable.of(BackupTransferTest.lf(HELPER)), "/tmp/bkp-in-memory.sh");
		linux.copyFileToContainer(Transferable.of(BackupTransferTest.lf(STACK)), "/tmp/bkp-stack.sh");
		linux.copyFileToContainer(Transferable.of(DRIVER.getBytes(StandardCharsets.UTF_8)), "/tmp/bkp-driver.sh");
		linux.copyFileToContainer(Transferable.of(STACK_DRIVER.getBytes(StandardCharsets.UTF_8)),
				"/tmp/bkp-stack-driver.sh");
		linux.copyFileToContainer(Transferable.of(FAKE_DOCKER.getBytes(StandardCharsets.UTF_8), 0755),
				"/tmp/bkp-bin/docker");
	}

	@AfterAll
	static void stopIt() {
		if (linux != null) {
			linux.stop();
		}
	}

	private static ExecResult sh(String command) {
		try {
			return linux.execInContainer("sh", "-c", command);
		}
		catch (IOException | InterruptedException cannot) {
			throw new IllegalStateException(cannot);
		}
	}

	private static String lineOf(String name, ExecResult result) {
		Matcher line = Pattern.compile("^" + name + "=(\\S+)$", Pattern.MULTILINE).matcher(result.getStdout());
		assertThat(line.find()).as("the driver printed no %s= line: %s %s", name, result.getStdout(), result.getStderr())
				.isTrue();
		return line.group(1);
	}

	private static String workOf(ExecResult result) {
		return lineOf("WORK", result);
	}

	private static String spoolOf(ExecResult result) {
		return lineOf("SPOOL", result);
	}

	private static String exists(String path) {
		return sh("[ -e '" + path + "' ] && echo yes || echo no").getStdout().strip();
	}

	/**
	 * EVERY WAY OUT REMOVES THE WORK FOLDER, THE SPOOL AND THE THROWAWAY DATABASE, KEEPS ITS STATUS, AND
	 * MAILS ON EVERY ONE THAT IS NOT A SUCCESS - BEFORE THE FOLDERS GO.
	 *
	 * <p>A signal handler that only cleaned up would let the run go on to its next line without its
	 * files: that is {@code SURVIVED}, and a status of 0. A trap that mailed after the cleanup would
	 * have no relay settings left to mail with: that is the alert seeing no folder. And a run that
	 * passed must not mail at all, or the superadmin learns to ignore the mail that matters.
	 */
	@Test
	void everyWayOutCleansUpKeepsItsStatusAndMailsWhenItFailed() {
		String[][] ways = {
				{ "exit", "0" },
				{ "fail", "1" },
				{ "hup", "129" },
				{ "int", "130" },
				{ "term", "143" } };

		for (String[] way : ways) {
			ExecResult result = sh("sh /tmp/bkp-driver.sh " + way[0]);
			String work = workOf(result);
			String spool = spoolOf(result);

			assertThat(result.getStdout()).as("after %s the script went on", way[0]).doesNotContain("SURVIVED");
			assertThat(result.getExitCode()).as("the status after %s", way[0]).isEqualTo(Integer.parseInt(way[1]));
			assertThat(exists(work)).as("the work folder after %s", way[0]).isEqualTo("no");
			assertThat(exists(spool)).as("the folder of the encrypted copy after %s", way[0]).isEqualTo("no");
			assertThat(sh("cat /tmp/bkp-docker.calls").getStdout())
					.as("the throwaway database after %s", way[0])
					.contains("docker rm -f the-throwaway-database");

			String alerted = sh("cat /tmp/bkp-alert 2>/dev/null || echo none").getStdout().strip();
			if (way[1].equals("0")) {
				assertThat(alerted).as("a run that passed mailed somebody").isEqualTo("none");
			}
			else {
				assertThat(alerted)
						.as("after %s the superadmin is told, with the status, while the relay's settings and the copy are still there", way[0])
						.isEqualTo(way[1] + " yes yes");
			}
		}
	}

	/**
	 * A SIGNAL THAT ARRIVES WHILE A CONTAINER STEP IS RUNNING IS ACTED ON AT ONCE: THE CASE THE TEST
	 * ABOVE DOES NOT HAVE, BECAUSE IT SENDS ITS SIGNAL FROM A SCRIPT WITH NO FOREGROUND CHILD.
	 *
	 * <p>A shell runs a trap only after the foreground command it is waiting for has ended
	 * (measured 21.10.2026 in dash with the docker client of the host: no trap after six seconds,
	 * the work folder with the dump and the passphrase still there). The copy spends nearly all of
	 * its time in such a command, so this is the way a SIGTERM from systemd, a stop or a reboot
	 * actually arrives. The step here is a docker client that takes eight seconds, and the signal is
	 * sent by another process one second in, so what this measures is the time between the signal
	 * and the mail, and the mail is the proof that the way out ran: it is called with the work
	 * folder and the spool still there, the client was told to stop, and the containers that carry
	 * the run's label were looked up and removed.
	 *
	 * <p>Eight seconds against five is the margin that separates "at once" from "when the step
	 * ended": a shell that waits in the foreground mails after eight.
	 */
	@Test
	void aSignalWhileAContainerStepRunsIsActedOnAtOnceAndTheRunsContainersAreRemoved() {
		String[][] ways = { { "HUP", "129" }, { "INT", "130" }, { "TERM", "143" } };

		for (String[] way : ways) {
			ExecResult result = sh("sh /tmp/bkp-driver.sh step-signal " + way[0]);
			String work = workOf(result);
			String spool = spoolOf(result);

			assertThat(result.getStdout()).as("after %s the script went on", way[0]).doesNotContain("SURVIVED");
			assertThat(result.getExitCode()).as("the status after %s", way[0]).isEqualTo(Integer.parseInt(way[1]));

			long started = Long.parseLong(sh("cat /tmp/bkp-started").getStdout().strip());
			long mailed = Long.parseLong(sh("cat /tmp/bkp-alert-at").getStdout().strip());
			assertThat(mailed - started)
					.as("seconds from the start of the step to the mail, after %s, while the step takes eight", way[0])
					.isLessThan(5);
			assertThat(sh("cat /tmp/bkp-alert").getStdout().strip())
					.as("the mail goes with the status, the work folder and the spool still there")
					.isEqualTo(way[1] + " yes yes");

			sh("sleep 1");
			assertThat(sh("cat /tmp/bkp-client 2>/dev/null || echo none").getStdout())
					.as("the docker client of the step was told to stop, after %s", way[0]).contains("CLIENT-TERM");
			assertThat(sh("cat /tmp/bkp-docker.calls").getStdout())
					.as("the containers of the run are looked up by its label and removed, after %s", way[0])
					.containsPattern("(?m)^docker ps -q --filter label=btl-backup-run=\\d+$")
					.contains("docker rm -f bkp-left-1\n");

			assertThat(exists(work)).as("the work folder after %s", way[0]).isEqualTo("no");
			assertThat(exists(spool)).as("the folder of the encrypted copy after %s", way[0]).isEqualTo("no");
		}
	}

	/**
	 * A CONTAINER OF THE RUN HAS AN INIT, THE RUN'S LABEL, AND GOES WHEN IT ENDS.
	 *
	 * <p>The init is what makes a SIGTERM to the client end the container at all: process 1 ignores
	 * a signal it has no handler for, and process 1 here is {@code sh transfer.sh}.
	 */
	@Test
	void aContainerOfTheRunHasAnInitAndTheRunsLabel() {
		ExecResult result = sh("sh /tmp/bkp-driver.sh container");

		assertThat(result.getStdout()).contains("RC=0");
		assertThat(sh("cat /tmp/bkp-docker.calls").getStdout())
				.containsPattern("(?m)^docker run --rm --init --label btl-backup-run=\\d+ --network none an-image sh x$");
	}

	/**
	 * A STEP HANDS ITS CALLER'S STANDARD INPUT ON, AND ITS STATUS BACK.
	 *
	 * <p>dash gives a command started with {@code &} the input /dev/null before it looks at the
	 * command's own redirections, so {@code <&0} reads nothing either (measured 21.10.2026). The
	 * restore reads a whole dump through {@code docker exec -i}; a step that dropped it would restore
	 * nothing, in one transaction, and say it had worked.
	 */
	@Test
	void aStepKeepsItsCallersInputAndReturnsItsStatus() {
		assertThat(sh("sh /tmp/bkp-driver.sh stdin").getStdout()).contains("OUT=the dump");
		assertThat(sh("sh /tmp/bkp-driver.sh status").getStdout()).contains("RC=7");
	}

	/**
	 * THE ONLY THING TAKEN OUT OF THE BACKEND'S ENVIRONMENT IS WHERE IT KEEPS PHOTOGRAPHS, AND NOTHING
	 * ELSE IS KEPT.
	 *
	 * <p>The environment carries the database's password and the relay's key, and the work folder is
	 * mounted into the containers that have a network. The fake container's environment holds both,
	 * and no file in the work folder may hold either, nor may anything be written there at all.
	 */
	@Test
	void onlyThePhotographFolderIsTakenOutOfTheBackendsEnvironment() {
		ExecResult result = sh("sh /tmp/bkp-stack-driver.sh");

		assertThat(result.getExitCode()).as("%s %s", result.getStdout(), result.getStderr()).isZero();
		assertThat(result.getStdout())
				.contains("DB=the-database")
				.contains("IMAGE=sha256:the-image")
				.contains("BACKEND=the-backend")
				.contains("PHOTOS_VOLUME=the-volume")
				.contains("LEAKED_IN=0")
				.contains("FILES=0")
				.doesNotContain("the-database-password")
				.doesNotContain("the-relay-key");
		assertThat(result.getStderr()).doesNotContain("the-database-password").doesNotContain("the-relay-key");
	}

	/** A backend that does not say where it keeps photographs is refused, and the run does not go on without a folder. */
	@Test
	void aBackendThatDoesNotSayWhereItKeepsPhotographsIsRefused() {
		ExecResult result = sh("NOFOLDER=yes sh /tmp/bkp-stack-driver.sh");

		assertThat(result.getExitCode()).isEqualTo(1);
		assertThat(result.getStdout()).contains("REFUSED:").contains("does not say where it keeps photographs");
	}

	/** In memory, and nobody but the owner reads it; the encrypted copy has a folder of its own, on a disk. */
	@Test
	void theWorkFolderIsInMemoryAndPrivateAndTheCopyHasAFolderOnADisk() {
		ExecResult result = sh("sh /tmp/bkp-driver.sh where");

		assertThat(workOf(result)).startsWith("/dev/shm/btl-backup.");
		assertThat(result.getStdout()).contains("KIND=tmpfs").contains("MODE=700").contains("FILEMODE=600");

		assertThat(spoolOf(result)).startsWith("/var/tmp/btl-backup-copy.").doesNotStartWith("/dev/shm");
		assertThat(result.getStdout())
				.as("the encrypted copy is kept out of memory, and private all the same")
				.doesNotContain("SPOOLKIND=tmpfs")
				.contains("SPOOLMODE=700");
	}

	/** A filesystem that is not memory is refused before anything is made. */
	@Test
	void aFilesystemThatIsNotMemoryIsRefusedBeforeAnythingIsMade() {
		String count = "ls -d /dev/shm/btl-backup.* /var/tmp/btl-backup-copy.* 2>/dev/null | wc -l";
		String before = sh(count).getStdout().strip();

		ExecResult result = sh("sh /tmp/bkp-driver.sh not-memory");

		assertThat(result.getExitCode()).isEqualTo(1);
		assertThat(result.getStdout()).contains("REFUSED:").contains("not tmpfs");
		assertThat(sh(count).getStdout().strip()).isEqualTo(before);
	}
}
