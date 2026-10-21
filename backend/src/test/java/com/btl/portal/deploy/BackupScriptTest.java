package com.btl.portal.deploy;

import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE FORM OF {@code deploy/backup.sh}, {@code deploy/restore.sh} AND THE FILES IN
 * {@code deploy/backup/}, HELD WITHOUT A DATABASE OR A CONTAINER.
 *
 * <p>The backup speaks to the live production stack and to R2, so it cannot run in this gate. It is
 * held from three sides, the way the pour is:
 *
 * <ul>
 *   <li>{@code BackupCopyTest} runs the scripts that make, open, restore and prove a copy, against a
 *       real PostgreSQL 18 holding the real schema;
 *   <li>{@code BackupTransferTest} and {@code BackupLeavesNothingBehindTest} run the scripts that
 *       talk to R2 and to the relay, and the helper that keeps the work folder in memory, in the
 *       image they run in on the host;
 *   <li>this class reads the CODE of the host scripts, which need {@code docker}, and asks
 *       questions about the shape of single lines, with the reader {@link PouringFromQaScriptTest}
 *       already holds against text meant to trip it.
 * </ul>
 *
 * <p><b>What this does NOT claim.</b> That the host scripts work: a line can have the right shape
 * and be wrong. What measures them is the first real run, listed in {@code deploy/README.md}.
 * This class exists so that the specific orders and refusals the design rests on cannot leave by
 * one edit with nothing failing.
 */
class BackupScriptTest {

	private static final Path DEPLOY = Path.of("..", "deploy");

	private static final Path BACKUP_SH = DEPLOY.resolve("backup.sh");

	private static final Path RESTORE_SH = DEPLOY.resolve("restore.sh");

	private static final Path FOLDER = DEPLOY.resolve("backup");

	private static String text(Path file) {
		try {
			return Files.readString(file, StandardCharsets.UTF_8).replace("\r\n", "\n");
		}
		catch (IOException cannotRead) {
			throw new UncheckedIOException("cannot read " + file, cannotRead);
		}
	}

	private static List<String> code(Path file) {
		return PouringFromQaScriptTest.code(text(file));
	}

	private static int first(List<String> code, String needle) {
		for (int at = 0; at < code.size(); at++) {
			if (code.get(at).contains(needle)) {
				return at;
			}
		}
		return -1;
	}

	private static List<String> with(List<String> code, String needle) {
		return code.stream().filter(one -> one.contains(needle)).toList();
	}

	/** The host scripts, and the two helpers they source: everything that runs on the host itself. */
	private static List<Path> onTheHost() {
		return List.of(BACKUP_SH, RESTORE_SH, FOLDER.resolve("stack.sh"), FOLDER.resolve("in-memory.sh"));
	}

	/** Every shell script of the backup, on the host and in a container. */
	private static List<Path> everyScript() throws IOException {
		List<Path> all = new ArrayList<>(List.of(BACKUP_SH, RESTORE_SH));
		try (Stream<Path> inside = Files.list(FOLDER)) {
			inside.filter(one -> one.getFileName().toString().endsWith(".sh")).sorted().forEach(all::add);
		}
		assertThat(all).as("the backup's scripts were not found, so nothing below reads anything").hasSizeGreaterThan(8);
		return all;
	}

	/** The image {@code backup.sh} runs curl in, as its own line says it. */
	static String transferImage() {
		List<String> named = with(code(BACKUP_SH), "TRANSFER_IMAGE=");
		assertThat(named).as("backup.sh names the image it runs curl in exactly once").hasSize(1);
		return named.get(0).substring(named.get(0).indexOf('=') + 1);
	}

	/**
	 * THE DATABASE IS DUMPED FIRST, WHOLE, AND THE PHOTOGRAPHS ARE READ AFTER IT.
	 *
	 * <p>A photograph's file is written once and never changed, so a file that exists when the dump
	 * is taken still exists when tar reads it a moment later; the other order would leave rows in the
	 * dump whose files tar passed before they were written, which after a restore is a picture that
	 * 404s. Held by position, which is what an order is. And the dump is WHOLE: custom format, which
	 * is what pg_restore and check.sh read, and no table left out - Flyway's own history above all,
	 * without which a restored database would be migrated again on the next start.
	 */
	@Test
	void theDatabaseIsDumpedWholeAndBeforeThePhotographs() {
		List<String> code = code(BACKUP_SH);

		List<String> dumps = with(code, "exec pg_dump");
		assertThat(dumps).as("exactly one line dumps the database").hasSize(1);
		assertThat(dumps.get(0))
				.contains("--format=custom")
				.contains("> \"$WORK/btl.dump\"")
				.doesNotContain("--exclude-table")
				.doesNotContain("-T ")
				.doesNotContain("--table")
				.doesNotContain("--schema");

		int dumped = first(code, "exec pg_dump");
		int packed = first(code, "/backup/pack.sh");
		int checked = first(code, "check_copy");
		int sent = first(code, "transfer put /work/copy.gpg \"$KEY\"");

		assertThat(List.of(dumped, packed, checked, sent))
				.as("the dump, then the photographs, then the check, then the send")
				.allSatisfy(one -> assertThat(one).isNotNegative())
				.isSorted();
	}

	/**
	 * EVERY CONTAINER THAT SEES THE COPY IN PLAIN TEXT HAS NO NETWORK, AND THE PROOF'S DATABASE KEEPS
	 * ITS DATA IN MEMORY.
	 *
	 * <p>Every {@code docker run} of the database's own image ({@code "$IMAGE"}) reads the dump, the
	 * photographs or the restored members, so each has {@code --network none}; only the image that
	 * talks to R2 has a network, and it holds nothing in plain text but the files in memory. The
	 * proof's throwaway database restores every member of the portal, so its data folder is a
	 * {@code --tmpfs}, and it is reached by nothing but {@code docker exec}.
	 */
	@Test
	void everyContainerThatSeesThePlainTextHasNoNetwork() {
		List<String> runs = new ArrayList<>();
		for (Path script : onTheHost()) {
			runs.addAll(with(code(script), "docker run "));
		}

		List<String> ofTheImage = runs.stream().filter(one -> one.contains("\"$IMAGE\"")).toList();
		assertThat(ofTheImage)
				.as("the containers of the database's image: the pack, the check, the proof's database and the restore of the photographs")
				.hasSizeGreaterThanOrEqualTo(4)
				.allSatisfy(one -> assertThat(one).contains("--network none"));

		assertThat(runs)
				.as("every container is of the database's image or of the one that talks to R2: %s", runs)
				.allSatisfy(one -> assertThat(one.contains("\"$IMAGE\"") || one.contains("\"$TRANSFER_IMAGE\"")).isTrue());

		List<String> throwaway = with(code(BACKUP_SH), "docker run -d --name \"$THROWAWAY\"");
		assertThat(throwaway).as("the one line that starts the proof's database").hasSize(1);
		assertThat(throwaway.get(0))
				.contains("--network none")
				.contains("--tmpfs /var/lib/postgresql");
	}

	/**
	 * NOTHING THE HOST SCRIPTS WRITE IS OUTSIDE THE WORK FOLDER, AND THEY MAKE NO WORK FOLDER OF THEIR
	 * OWN.
	 *
	 * <p>The dump, the passphrase and the keys are written to files, and the cleanup removes the work
	 * folder and nothing else; the helper refuses a work folder that is not memory. So every
	 * redirection of every host script must go under {@code "$WORK/"}, to {@code /dev/null} or to a
	 * descriptor, and no host script may make a folder or set a trap of its own. Read with the reader
	 * {@link PouringFromQaScriptTest} holds, which knows a {@code >} in a message from one that is an
	 * operator. The scripts that run in a container write into the folder they are handed, which is
	 * that same work folder mounted, and {@code BackupCopyTest} runs them.
	 */
	@Test
	void nothingTheHostScriptsWriteIsOutsideTheWorkFolder() {
		List<String> refused = new ArrayList<>();
		int read = 0;

		for (Path script : onTheHost()) {
			for (PouringFromQaScriptTest.Redirection one : PouringFromQaScriptTest.redirections(text(script))) {
				read++;
				String target = one.target();
				if (!(target.startsWith("\"$WORK/") || target.equals("/dev/null") || target.startsWith("&"))) {
					refused.add(script.getFileName() + " line " + one.line() + ": " + one.operator() + " " + target);
				}
			}
		}

		assertThat(read).as("the host scripts redirect output in many places, so a reading that found few read nothing")
				.isGreaterThan(15);
		assertThat(refused)
				.as("a file written somewhere other than under \"$WORK/\", which is memory and is removed on the way out")
				.isEmpty();

		for (Path script : List.of(BACKUP_SH, RESTORE_SH, FOLDER.resolve("stack.sh"))) {
			List<String> code = code(script);
			assertThat(with(code, "mktemp")).as("%s makes a folder the helper does not know about", script).isEmpty();
			assertThat(with(code, "trap ")).as("%s sets a trap over the helper's", script).isEmpty();
		}
		for (Path script : List.of(BACKUP_SH, RESTORE_SH)) {
			assertThat(code(script)).as("%s keeps its plain text where the helper says", script)
					.contains(". \"$BACKUP/in-memory.sh\"");
		}
	}

	/**
	 * NO KEY IS EVER AN ARGUMENT.
	 *
	 * <p>An argument is visible in {@code ps} to every user of the host, and the journal of a failed
	 * command can carry it. So every curl reads its keys with {@code -K} from a file in the work
	 * folder and none is handed {@code -u} or {@code --user}; gpg reads its passphrase from a file and
	 * is never handed {@code --passphrase} itself.
	 */
	@Test
	void noKeyIsEverAnArgument() throws IOException {
		/* curl where a command stands: at the start of a line, after an operator, or after if, !,
		   then or do. Not the word in a message, which "a curl config file" is. */
		Pattern aCall = Pattern.compile("(^|[;&|]\\s*|\\b(if|then|do)\\s+|!\\s+)curl\\s");
		int curls = 0;
		for (Path script : everyScript()) {
			for (String line : code(script)) {
				if (aCall.matcher(line).find()) {
					curls++;
					assertThat(line).as("%s: %s", script.getFileName(), line)
							.contains("-K \"$WORK/")
							.doesNotContainPattern("\\s(-u|--user)\\s");
				}
				assertThat(line).as("%s hands gpg the passphrase itself: %s", script.getFileName(), line)
						.doesNotContainPattern("--passphrase(\\s|=)");
			}
		}
		assertThat(curls).as("the scripts that send, fetch, list and mail call curl").isGreaterThanOrEqualTo(5);
	}

	/**
	 * A RESTORE REFUSES A RUNNING BACKEND, AND PUTS THE DATABASE BACK BEFORE THE PHOTOGRAPHS.
	 *
	 * <p>The backend sweeps every photograph no row names that is older than ten minutes, and writes
	 * rows while it runs. So the refusal is asked at the start and again just before the first
	 * write, and the database goes before the photographs. Held by position.
	 */
	@Test
	void aRestoreRefusesARunningBackendAndPutsTheDatabaseBackFirst() {
		List<String> code = code(RESTORE_SH);

		List<String> asks = with(code, "ps -q backend");
		assertThat(asks).as("one function asks whether the backend runs").hasSize(1);
		assertThat(asks.get(0)).contains("[ -z \"$(docker compose -f \"$COMPOSE\" ps -q backend)\" ] || fail");

		List<Integer> calls = new ArrayList<>();
		for (int at = 0; at < code.size(); at++) {
			if (code.get(at).equals("backend_is_stopped")) {
				calls.add(at);
			}
		}
		int database = first(code, "restore-database.sh");
		int photographs = first(code, "/backup/restore-photos.sh");

		assertThat(calls).as("the backend is asked about at the start and again before the first write").hasSize(2);
		assertThat(List.of(calls.get(0), calls.get(1), database, photographs))
				.as("refuse a running backend, then again, then the database, then the photographs")
				.allSatisfy(one -> assertThat(one).isNotNegative())
				.isSorted();

		List<String> extract = with(code(FOLDER.resolve("restore-photos.sh")), "tar -xf -");
		assertThat(extract).as("one line puts the photographs back").hasSize(1);
		assertThat(extract.get(0)).contains("--numeric-owner");
	}

	/**
	 * THE FACTS THAT HAVE TWO HOMES ARE THE SAME IN BOTH.
	 *
	 * <p>The image curl runs in is named by {@code backup.sh} and declared on the service
	 * {@code backup-settings}; the sender is the portal's own {@code btl.mail.from}, which is the one
	 * the relay has verified; and 26 hours is the owner's number in the proof and in the Worker.
	 */
	@Test
	@SuppressWarnings("unchecked")
	void theFactsWithTwoHomesAgree() throws IOException {
		Map<String, Object> compose = new Yaml().load(text(DEPLOY.resolve("compose.prod.yml")));
		Map<String, Object> service = (Map<String, Object>) ((Map<String, Object>) compose.get("services"))
				.get("backup-settings");

		assertThat(service).as("compose.prod.yml declares no backup-settings service").isNotNull();
		assertThat(service.get("image")).isEqualTo(transferImage());
		assertThat(code(RESTORE_SH)).contains("TRANSFER_IMAGE=" + transferImage());
		assertThat(service.get("profiles")).as("never started by an `up`").isEqualTo(List.of("backup"));
		assertThat(service.get("network_mode")).isEqualTo("none");
		assertThat((List<Object>) service.get("volumes"))
				.as("the photographs are mounted only into the backend (ADL A43, 2)")
				.allSatisfy(one -> assertThat(String.valueOf(one)).doesNotContain("photos"));

		Properties shipped = new Properties();
		try (Reader file = Files.newBufferedReader(Path.of("src", "main", "resources", "application.properties"),
				StandardCharsets.UTF_8)) {
			shipped.load(file);
		}
		Map<String, Object> environment = (Map<String, Object>) service.get("environment");
		assertThat(environment.get("BTL_BACKUP_MAIL_FROM")).isEqualTo(shipped.getProperty("btl.mail.from"));

		assertThat(code(FOLDER.resolve("prove.sh"))).contains("DAY_AND_TWO_HOURS=" + 26 * 3600);
		assertThat(text(DEPLOY.resolve("cloudflare").resolve("backup-watch.js"))).contains("const LIMIT_HOURS = 26\n");
	}

	/**
	 * THE TIMERS RUN AT THE OWNER'S HOURS, IN BELGRADE, FROM THE CHECKOUT, AND RUN WHAT THE RUNBOOK
	 * SAYS.
	 *
	 * <p>The owner's decision (5) of 20.10.2026: the copy at 04:00 and the proof on the 2nd at 05:00,
	 * by Belgrade time, so the zone is in the line and not taken from the host's clock.
	 */
	@Test
	void theTimersRunAtTheOwnersHours() {
		assertThat(text(FOLDER.resolve("btl-backup.timer"))).contains("\nOnCalendar=*-*-* 04:00:00 Europe/Belgrade\n");
		assertThat(text(FOLDER.resolve("btl-backup-proof.timer"))).contains("\nOnCalendar=*-*-02 05:00:00 Europe/Belgrade\n");
		assertThat(text(FOLDER.resolve("btl-backup.service")))
				.contains("\nWorkingDirectory=/opt/btl/deploy\n")
				.contains("\nExecStart=/bin/sh backup.sh\n");
		assertThat(text(FOLDER.resolve("btl-backup-proof.service")))
				.contains("\nWorkingDirectory=/opt/btl/deploy\n")
				.contains("\nExecStart=/bin/sh backup.sh --prove\n");

		String readme = text(DEPLOY.resolve("README.md"));
		for (String unit : List.of("btl-backup.service", "btl-backup.timer", "btl-backup-proof.service",
				"btl-backup-proof.timer")) {
			assertThat(readme).as("the runbook does not say how to install %s", unit).contains("backup/" + unit);
		}
	}

	/**
	 * THE RUNBOOK'S RESTORE IS IN THE ORDER THE SCRIPT KEEPS: THE BACKEND STOPPED, THE DATABASE
	 * EMPTIED, THE RESTORE, AND ONLY THEN THE BACKEND.
	 */
	@Test
	void theRunbookRestoresInTheOrderTheScriptKeeps() {
		String readme = text(DEPLOY.resolve("README.md"));
		int section = readme.indexOf("### Restoring production from a copy");
		assertThat(section).as("the runbook has no restore section").isNotNegative();
		String restore = readme.substring(section);

		Matcher block = Pattern.compile("```bash\\n(.*?)```", Pattern.DOTALL).matcher(restore);
		assertThat(block.find()).as("the restore section shows no commands").isTrue();
		List<String> steps = block.group(1).lines().filter(line -> !line.startsWith("#")).toList();

		int stop = indexOf(steps, "compose.prod.yml stop backend");
		int empty = indexOf(steps, "dropdb");
		int run = indexOf(steps, "sh restore.sh");
		int start = indexOf(steps, "compose.prod.yml up -d backend");

		assertThat(List.of(stop, empty, run, start))
				.as("stop the backend, empty the database, restore, start the backend: %s", steps)
				.allSatisfy(one -> assertThat(one).isNotNegative())
				.isSorted();
	}

	private static int indexOf(List<String> lines, String needle) {
		for (int at = 0; at < lines.size(); at++) {
			if (lines.get(at).contains(needle)) {
				return at;
			}
		}
		return -1;
	}
}
