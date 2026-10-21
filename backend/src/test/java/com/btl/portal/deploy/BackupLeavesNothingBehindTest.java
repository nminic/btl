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
 * one more, because this helper carries one more duty: a run that ends with anything but 0 is
 * mailed to the superadmin (ADL O19, owner 20.10.2026), so the alert has to be called on every
 * way out that is not a success, before the work folder goes - the relay's settings are in it -
 * and never on a success.
 *
 * <p><b>The seam.</b> The helper needs {@code fail}, {@code say}, {@code THROWAWAY} and
 * {@code alert} from the script that sources it, and calls {@code docker}. The driver below
 * supplies them; the alert writes down the status it was called with and whether the work folder
 * was still there, and {@code docker} writes down what it was asked.
 *
 * <p>Run in {@code eclipse-temurin:21-jre} with no network, whose {@code sh} is dash, as on the
 * Debian host, and whose {@code /dev/shm} is memory.
 */
class BackupLeavesNothingBehindTest {

	private static final Path HELPER = Path.of("..", "deploy", "backup", "in-memory.sh");

	private static final String DRIVER = """
			set -eu
			fail() { printf 'REFUSED: %s\\n' "$*"; exit 1; }
			say() { printf '%s\\n' "$*"; }
			THROWAWAY=the-throwaway-database
			: > /tmp/bkp-docker.calls
			rm -f /tmp/bkp-alert
			docker() { printf 'docker %s\\n' "$*" >> /tmp/bkp-docker.calls; }
			alert() { [ -d "$WORK" ] && there=yes || there=no; printf '%s %s\\n' "$1" "$there" > /tmp/bkp-alert; }
			scenario=$1
			if [ "$scenario" = not-memory ]; then
			  stat() { echo ext4; }
			fi
			. /tmp/bkp-in-memory.sh
			printf 'WORK=%s\\n' "$WORK"
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
			    ;;
			esac
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
		linux.copyFileToContainer(Transferable.of(DRIVER.getBytes(StandardCharsets.UTF_8)), "/tmp/bkp-driver.sh");
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

	private static String workOf(ExecResult result) {
		Matcher work = Pattern.compile("^WORK=(\\S+)$", Pattern.MULTILINE).matcher(result.getStdout());
		assertThat(work.find()).as("the driver printed no WORK= line: %s %s", result.getStdout(), result.getStderr())
				.isTrue();
		return work.group(1);
	}

	/**
	 * EVERY WAY OUT REMOVES THE WORK FOLDER AND THE THROWAWAY DATABASE, KEEPS ITS STATUS, AND MAILS ON
	 * EVERY ONE THAT IS NOT A SUCCESS - BEFORE THE FOLDER GOES.
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

			assertThat(result.getStdout()).as("after %s the script went on", way[0]).doesNotContain("SURVIVED");
			assertThat(result.getExitCode()).as("the status after %s", way[0]).isEqualTo(Integer.parseInt(way[1]));
			assertThat(sh("[ -e '" + work + "' ] && echo yes || echo no").getStdout().strip())
					.as("the work folder after %s", way[0]).isEqualTo("no");
			assertThat(sh("cat /tmp/bkp-docker.calls").getStdout())
					.as("the throwaway database after %s", way[0])
					.contains("docker rm -f the-throwaway-database");

			String alerted = sh("cat /tmp/bkp-alert 2>/dev/null || echo none").getStdout().strip();
			if (way[1].equals("0")) {
				assertThat(alerted).as("a run that passed mailed somebody").isEqualTo("none");
			}
			else {
				assertThat(alerted)
						.as("after %s the superadmin is told, with the status, while the relay's settings are still there", way[0])
						.isEqualTo(way[1] + " yes");
			}
		}
	}

	/** In memory, and nobody but the owner reads it. */
	@Test
	void theWorkFolderIsInMemoryAndPrivate() {
		ExecResult result = sh("sh /tmp/bkp-driver.sh where");

		assertThat(workOf(result)).startsWith("/dev/shm/btl-backup.");
		assertThat(result.getStdout()).contains("KIND=tmpfs").contains("MODE=700").contains("FILEMODE=600");
	}

	/** A filesystem that is not memory is refused before anything is made. */
	@Test
	void aFilesystemThatIsNotMemoryIsRefusedBeforeAnythingIsMade() {
		String count = "ls -d /dev/shm/btl-backup.* 2>/dev/null | wc -l";
		String before = sh(count).getStdout().strip();

		ExecResult result = sh("sh /tmp/bkp-driver.sh not-memory");

		assertThat(result.getExitCode()).isEqualTo(1);
		assertThat(result.getStdout()).contains("REFUSED:").contains("not tmpfs");
		assertThat(sh(count).getStdout().strip()).isEqualTo(before);
	}
}
