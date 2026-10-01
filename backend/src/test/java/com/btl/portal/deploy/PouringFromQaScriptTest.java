package com.btl.portal.deploy;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE FORM OF {@code deploy/pour-from-qa.sh}, HELD WITHOUT A DATABASE.
 *
 * <p>The tool pours QA's real personal data into production, once, and it cannot run in this
 * gate: it speaks to two live stacks over {@code docker exec}. Three classes hold it from three
 * sides, and this is the one that needs neither a database nor a container, which is why it is
 * the one that can be run in a second:
 *
 * <ul>
 *   <li>{@code PouringFromQaTest} runs the SQL the script executes, against a real PostgreSQL;
 *   <li>{@code PouringFromQaLeavesNothingBehindTest} runs the shell helper the script sources,
 *       in a real Linux, and sends it signals;
 *   <li>this class reads the script's CODE and asks questions about the SHAPE of single lines.
 * </ul>
 *
 * <p><b>Why the questions are about the shape of one line and never about where a value
 * comes from.</b> A guard that reads a script's text to answer "where does this value end up"
 * has to follow it through the code, and that question has no bottom: it is the shape that was
 * rewritten four times in a row on the guard that reads module imports, each draft correct and
 * each leaving the next form open. "Which lines name this file", "is this the one line that
 * opens the session", "does the transaction open before the loop and close after it" are
 * answered by looking at the line, and are complete by construction.
 *
 * <p><b>Comments are removed before anything is asked.</b> The script's header discusses
 * everything it does in prose, so a bare {@code contains} would go on passing after the line
 * that does the thing was deleted: the prose would still carry the word. Only code is read.
 *
 * <p><b>What this does NOT claim, written down rather than left to be found.</b> It does not
 * claim the script works. A line can have the right shape and be wrong, and a script that
 * parses is not a script that pours. What measures behaviour is the other two classes and a
 * run on the host with {@code --check}. This class exists so that the specific shapes a review
 * found wrong cannot come back by one edit, with nothing failing.
 */
class PouringFromQaScriptTest {

	private static final Path DEPLOY = Path.of("..", "deploy");

	private static final Path SCRIPT = DEPLOY.resolve("pour-from-qa.sh");

	private static final Path README = DEPLOY.resolve("README.md");

	/**
	 * Read with CRLF folded to LF. A Windows checkout carries CRLF on disk and the index carries
	 * LF, so a case that compared against either would pass on one machine and fail on the
	 * other.
	 */
	private static String text(Path file) {
		try {
			return Files.readString(file, StandardCharsets.UTF_8).replace("\r\n", "\n");
		}
		catch (IOException cannotRead) {
			throw new UncheckedIOException("cannot read " + file, cannotRead);
		}
	}

	/**
	 * The script's code, one entry per LOGICAL line: comments and blank lines gone, and a line
	 * that ends in a backslash joined to the one after it, so a command written over three
	 * lines is asked about as one.
	 */
	static List<String> code(String shell) {
		List<String> lines = new ArrayList<>();
		StringBuilder pending = null;

		for (String raw : shell.split("\n", -1)) {
			String line = raw.strip();
			if (pending == null && (line.isEmpty() || line.startsWith("#"))) {
				continue;
			}

			boolean continues = line.endsWith("\\") && !line.endsWith("\\\\");
			String piece = continues ? line.substring(0, line.length() - 1).strip() : line;

			if (pending == null) {
				pending = new StringBuilder(piece);
			}
			else {
				pending.append(' ').append(piece);
			}

			if (!continues) {
				lines.add(pending.toString());
				pending = null;
			}
		}

		if (pending != null) {
			lines.add(pending.toString());
		}
		return lines;
	}

	private static List<String> scriptCode() {
		return code(text(SCRIPT));
	}

	/** The logical lines that contain {@code needle}, so a case can say how many there are. */
	private static List<String> linesWith(List<String> code, String needle) {
		return code.stream().filter(one -> one.contains(needle)).toList();
	}

	/**
	 * THE DUMP LIVES WHERE THE HELPER PUTS IT, and the script makes no work directory of its own.
	 *
	 * <p>Every table of the database is written in plain text to one file while the pour runs.
	 * Where that file lives, who can read it, and what removes it on the way out are three
	 * decisions, and they are made once, in {@code leaves-nothing-behind.sh}, which the
	 * measuring class runs under signals. The mutation this holds is the quiet one: a
	 * {@code mktemp -d} or a {@code trap} written back into the script, which leaves the helper
	 * green and valid and the dump on a disk again.
	 */
	@Test
	void theScriptTakesItsWorkDirectoryFromTheHelperAndMakesNoneOfItsOwn() {
		List<String> code = scriptCode();

		assertThat(code)
				.as("the script has to source the helper that decides where the dump lives")
				.contains(". \"$LEAVES_NOTHING_SH\"");

		assertThat(linesWith(code, "mktemp"))
				.as("a work directory made here would be one the helper does not know about, and"
						+ " so one that nothing removes and nothing keeps off a disk")
				.isEmpty();
		assertThat(linesWith(code, "trap "))
				.as("a trap set here would replace the one the helper set, and the helper's is the"
						+ " one measured under HUP, INT, TERM and a plain exit")
				.isEmpty();
	}

	/**
	 * THE REFERENCE DATABASE IS REACHED BY NOTHING BUT {@code docker exec}, so it has no network.
	 *
	 * <p>It runs with {@code trust}, so that no password has to be held anywhere. That is only
	 * as safe as who can reach it, and on the default bridge that is every other container on
	 * the host. {@code --network none} takes the bridge away and costs nothing, because the
	 * script talks to it through {@code docker exec} and {@code pg_isready -h 127.0.0.1} runs
	 * inside it.
	 */
	@Test
	void theReferenceDatabaseIsStartedWithoutANetwork() {
		List<String> starts = linesWith(scriptCode(), "docker run -d --name \"$REFERENCE\"");

		assertThat(starts).as("the one line that starts the reference database").hasSize(1);
		assertThat(starts.get(0)).contains("--network none");
	}

	/**
	 * ALL OF QA IS READ IN ONE SESSION, INSIDE ONE REPEATABLE READ TRANSACTION.
	 *
	 * <p>Forty-nine tables read as forty-nine separate commands are forty-nine snapshots. A row
	 * written to QA between two of them can land as a child whose parent was read earlier, and
	 * the pour then fails on a foreign key, or does not fail and carries a pair that never
	 * stood together. One session under {@code repeatable read} takes ONE snapshot at its first
	 * query and keeps it to the last.
	 *
	 * <p>Three shapes are held, and each is a way the one snapshot silently becomes several:
	 * the transaction opening INSIDE the loop (many snapshots in one session), the sequence
	 * positions read in a separate session (so not the same moment), and a table read by its
	 * own {@code psql -c "copy ..."} again.
	 */
	@Test
	void allOfQaIsReadInOneSessionUnderOneRepeatableReadTransaction() {
		List<String> code = scriptCode();

		String begin = "printf 'begin isolation level repeatable read read only;\\n'";
		List<String> order = List.of(
				begin,
				"while IFS='|' read -r _ _ quoted; do",
				"done < \"$WORK/order\"",
				"cat \"$SEQUENCES_SQL\"",
				"printf 'commit;\\n'",
				"} > \"$QA_SESSION\"");

		assertThat(code.stream().filter(begin::equals).count())
				.as("exactly one line opens a transaction on QA, and it is a repeatable read one")
				.isEqualTo(1);

		int previous = -1;
		for (String line : order) {
			int at = code.indexOf(line);
			assertThat(at).as("the session is built from the line: %s", line).isGreaterThanOrEqualTo(0);
			assertThat(at)
					.as("%s has to come after the line before it: the transaction opens BEFORE the"
							+ " loop over the tables, the sequences are read INSIDE it, and it closes"
							+ " AFTER them", line)
					.isGreaterThan(previous);
			previous = at;
		}

		List<String> feeds = linesWith(code, "< \"$QA_SESSION\"");
		assertThat(feeds)
				.as("one command feeds that session to QA, and it is not repeated per table")
				.hasSize(1);
		assertThat(feeds.get(0)).contains("psql").contains("\"$QA_POSTGRES\"");

		assertThat(code.stream().filter(one -> Pattern.compile("-c\\s+[\"']copy").matcher(one).find()))
				.as("no table is read by a command of its own: that is one snapshot per table")
				.isEmpty();
		assertThat(linesWith(code, "< \"$SEQUENCES_SQL\""))
				.as("the sequence positions are read inside the session above and not in a"
						+ " separate one, which would be a different moment")
				.isEmpty();
	}

	/**
	 * WHAT A FAILED COPY SAYS NEVER REACHES THE TERMINAL EXCEPT THROUGH THE HELPER.
	 *
	 * <p>PostgreSQL puts the offending row in the message of a failed COPY, on lines of its own,
	 * and in the DETAIL of a check or not-null violation. Printed, it lands in the shell history
	 * and in every log that captures the output. The question asked here has a bottom: after
	 * the three ways the script is ALLOWED to touch the two files psql writes its complaints
	 * to are taken out of each line, no line may still name them. A {@code tail -20 pour.log}
	 * put back, a {@code cat}, or a new {@code grep} that is not the helper's all fail it.
	 *
	 * <p>The same for the read side, where psql's complaint used to go straight to the
	 * terminal because nothing captured it.
	 */
	@Test
	void whatPsqlSaysAboutARowIsTouchedByNothingButTheHelper() {
		List<String> code = scriptCode();

		List<String> allowed = List.of(
				"> \"$WORK/pour.log\" 2>&1",
				"2> \"$WORK/qa.err\"",
				"report_failure \"$WORK/pour.log\"",
				"report_failure \"$WORK/qa.err\"");

		List<String> mentioning = new ArrayList<>();
		for (String line : code) {
			String rest = line;
			for (String way : allowed) {
				rest = rest.replace(way, "");
			}
			if (rest.contains("pour.log") || rest.contains("qa.err")) {
				mentioning.add(line);
			}
		}

		assertThat(mentioning)
				.as("psql's complaints go to a file and are shown only by report_failure, which"
						+ " prints the ERROR lines and keeps the rest in memory")
				.isEmpty();

		for (String way : allowed) {
			assertThat(linesWith(code, way))
					.as("%s is how the script handles the complaint of one of the two psql calls that"
							+ " carry member rows, and it is missing", way)
					.isNotEmpty();
		}
	}

	/**
	 * NO TABLE NAME IS SPELLED OUT, SPLIT OR EXPANDED BY THE SHELL.
	 *
	 * <p>A name reaches SQL text in exactly one form here, the {@code quoted} column
	 * {@code load-order.sql} returns, and the shell reads it a LINE at a time. Both halves are
	 * held, because either alone is the old fault: an unquoted {@code public.$name} breaks on a
	 * name that needs quotes, and a {@code for table in $TABLES} breaks on a name with a space
	 * in it before quoting is ever asked about.
	 */
	@Test
	void aTableNameReachesSqlOnlyAsTheQuotedColumnAndIsNeverWordSplit() {
		List<String> code = scriptCode();

		assertThat(code.stream().filter(one -> Pattern.compile("public\\.\\$(?!quoted\\b)").matcher(one).find()))
				.as("a name put after public. without going through the quoted column")
				.isEmpty();
		// A word boundary after the name: $LETS_IN_SQL is the file that is run, and it begins with
		// the same characters as the list that used to be word-split. Not a general ban on loops
		// over an unquoted expansion either: `for version in $want` walks migration numbers, which
		// are digits, and is not a catalogue name.
		assertThat(code.stream().filter(one -> Pattern.compile("\\$\\{?(TABLES|LETS_IN)\\b").matcher(one).find()))
				.as("the two lists of catalogue names the shell used to expand unquoted, one name per"
						+ " word, which splits a name at every space in it")
				.isEmpty();
	}

	/**
	 * THE CLOSING REPORT SAYS WHERE AUTHORIZATION LIVES, AND THAT IT CROSSED OVER.
	 *
	 * <p>The report names what lets somebody IN: tokens, passwords, the superadmin. What a member
	 * MAY DO is a different fact in different tables, and it came over just the same. The names
	 * are checked here against the script and, in {@code PouringFromQaTest}, against the
	 * catalogue, so a rename fails somewhere instead of leaving the report pointing at nothing.
	 *
	 * <p>The boundary, written down: the report names the two places the schema keeps rights
	 * today. A third kind of table that carries authorization would have to be added by hand, and
	 * nothing here can tell that it exists.
	 */
	@Test
	void theClosingReportNamesWhereRightsAreKept() {
		List<String> code = scriptCode();

		assertThat(linesWith(code, "account_admin_right")).as("which rights each account holds").isNotEmpty();
		assertThat(linesWith(code, "verification.right_code")).as("which right opens a queue").isNotEmpty();
	}

	/**
	 * THE RUNBOOK NAMES THE TOOL, AND THE POUR COMES BEFORE THE SUPERADMIN'S REGISTRATION.
	 *
	 * <p>The README said the tool "is not in this file" after it had been written, and nowhere
	 * said the order. The order is forced by the tool's own refusal: a registration through the
	 * portal writes rows, a database that holds rows its migrations did not leave is refused,
	 * and so registering first makes the pour impossible. Held by position, which is what an
	 * order is: the first place the README tells the operator to pour comes before the place it
	 * tells him to register.
	 */
	@Test
	void theRunbookNamesThePourToolAndPutsItBeforeTheRegistration() {
		String readme = text(README);

		int pour = readme.indexOf("pour-from-qa.sh");
		int registration = readme.indexOf("REGISTER IT AND CONFIRM IT");

		assertThat(pour).as("deploy/README.md never names the tool that pours QA into production")
				.isGreaterThanOrEqualTo(0);
		assertThat(registration).as("the registration step the order is measured against is gone")
				.isGreaterThanOrEqualTo(0);
		assertThat(pour)
				.as("the pour has to be described BEFORE the superadmin's registration: the tool"
						+ " refuses a production database that somebody has already used")
				.isLessThan(registration);
	}
}
