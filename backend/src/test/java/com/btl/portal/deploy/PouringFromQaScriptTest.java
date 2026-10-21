package com.btl.portal.deploy;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;

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

	private static final Path HELPER = DEPLOY.resolve("pour-from-qa").resolve("leaves-nothing-behind.sh");

	/**
	 * A line that gives WORK a value, or takes it away: an assignment, one behind {@code export},
	 * {@code readonly} and the like, an append, an {@code unset}, or a string handed to
	 * {@code eval}. The character before it may be a quote, so that {@code eval "WORK=..."} is seen.
	 */
	private static final Pattern WORK_IS_GIVEN_A_VALUE = Pattern.compile(
			"(^|[\\s;&|({\"'])(?:(?:export|readonly|declare|local|typeset)\\s+)*WORK\\+?=|\\bunset\\s+WORK\\b");

	/**
	 * The command {@code cp}, by its name: not the end of a longer word, of a path or of an option.
	 * Every line of the script's code that holds it is a line that copies something.
	 */
	private static final Pattern CP_THE_COMMAND = Pattern.compile("(?<![\\w./-])cp(?![\\w-])");

	/**
	 * The quoted string a {@code docker run} is handed as {@code -c '...'}, when it opens with
	 * {@code cp}: the whole command that copies the photographs, as one group.
	 */
	private static final Pattern CP_HANDED_TO_SH = Pattern.compile("-c\\s+'(cp\\s[^']*)'");

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
	 *
	 * <p><b>And it is the same fault when the work directory is not made but RENAMED.</b> The
	 * helper makes one in memory, the cleanup removes that one and nothing else, and a line after
	 * the helper that gives {@code WORK} another value puts every file of the pour somewhere the
	 * cleanup has never heard of: a {@code mktemp} guard is satisfied and the dump is on a disk. So
	 * the question is asked about the VALUE as well: no line of the script gives {@code WORK} one,
	 * and exactly one line of the helper does, in memory.
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

		assertThat(code.stream().filter(one -> WORK_IS_GIVEN_A_VALUE.matcher(one).find()))
				.as("a line of the script that gives WORK a value of its own: the cleanup removes the"
						+ " directory the helper made and nothing else, so every file of the pour would"
						+ " be written where nothing removes it")
				.isEmpty();

		List<String> helper = code(text(HELPER));
		assertThat(helper.stream().filter(one -> WORK_IS_GIVEN_A_VALUE.matcher(one).find()))
				.as("WORK is given a value in exactly one place, and it is a directory made in memory")
				.containsExactly("WORK=$(mktemp -d \"$MEMORY/btl-pour.XXXXXX\")");

		Pattern template = Pattern.compile("mktemp\\s+(?:-\\S+\\s+)*(\\S+)");
		for (String line : linesWith(helper, "mktemp")) {
			Matcher made = template.matcher(line);
			assertThat(made.find()).as("a mktemp whose template cannot be read: %s", line).isTrue();
			assertThat(made.group(1))
					.as("everything the helper makes is made in memory, and this one is not: %s", line)
					.startsWith("\"$MEMORY/");
		}
	}

	/**
	 * EVERY FILE THE SCRIPT WRITES IS UNDER THE WORK DIRECTORY, and the question is asked of each
	 * redirection on its own.
	 *
	 * <p>The pour writes the whole database, with the password hashes and the live sessions, to
	 * one file, and the cleanup removes the work directory and nothing else. A file written
	 * anywhere else is therefore one that nothing removes, and it is still there after a pour that
	 * passed. A guard that knew only {@code mktemp} and {@code trap} was satisfied by
	 * {@code STREAM="/var/tmp/btl-pour.sql"}: the helper was right, the cases about it were green,
	 * and the dump was on a disk. What binds the helper to the script is where the script writes,
	 * so that is what is held.
	 *
	 * <p><b>Why this asks about one redirection at a time and follows nothing.</b> Every
	 * redirection of the script is read the way the shell reads it, so a {@code >} in a quoted
	 * message, in an awk program, in a comment or in a here-document is not one, and each target
	 * has to be one of five things: a path under {@code "$WORK/}, {@code /dev/null}, a
	 * duplication of a descriptor, one of the two variables named below, or the fourth parameter
	 * of {@code dump_into}. Anything else, including a variable nobody has thought of, is REFUSED,
	 * so the list cannot be short in silence: a new way to write a file fails here and asks the
	 * person who wrote it to say where it goes. The two variables are checked where they are
	 * given a value, which must be one line that starts under {@code "$WORK/}, and the calls of
	 * {@code dump_into} must hand it a path under it.
	 *
	 * <p><b>What this does NOT see, written down rather than left to be found.</b> A file written
	 * without a redirection: {@code tee}, {@code cp}, {@code dd}, {@code sed -i}, {@code docker cp},
	 * a redirection inside an awk program or the output option of a command. The script uses
	 * none of them today, and the day it does, this is where to look. And the measuring of what
	 * the pour really leaves behind is the rehearsal on a throwaway stack, where
	 * {@code docker diff} says what a pour wrote outside memory; it is not run in this gate
	 * because the script needs two live stacks.
	 */
	@Test
	void everyFileTheScriptWritesIsUnderTheWorkDirectory() {
		String script = text(SCRIPT);
		List<Redirection> redirections = redirections(script);
		List<String> code = scriptCode();
		List<String> lines = List.of(script.split("\n", -1));

		assertThat(redirections)
				.as("the script redirects output to files in thirty places, so a reading that found"
						+ " almost none read nothing")
				.hasSizeGreaterThan(20);

		int dumpIntoFirst = -1;
		int dumpIntoLast = -1;
		for (int at = 0; at < lines.size(); at++) {
			if (dumpIntoFirst < 0 && lines.get(at).startsWith("dump_into() {")) {
				dumpIntoFirst = at + 1;
			}
			else if (dumpIntoFirst > 0 && dumpIntoLast < 0 && lines.get(at).equals("}")) {
				dumpIntoLast = at + 1;
			}
		}

		List<String> refused = new ArrayList<>();
		for (Redirection one : redirections) {
			String target = one.target();
			boolean underWork = target.startsWith("\"$WORK/");
			boolean notAFile = target.equals("/dev/null") || target.startsWith("&");
			boolean namedOutput = target.equals("\"$STREAM\"") || target.equals("\"$QA_SESSION\"");
			boolean parameterOfDumpInto = target.equals("\"$4\"")
					&& one.line() >= dumpIntoFirst && one.line() <= dumpIntoLast;
			if (!(underWork || notAFile || namedOutput || parameterOfDumpInto)) {
				refused.add("line " + one.line() + ": " + one.operator() + " " + target);
			}
		}
		assertThat(refused)
				.as("a file written somewhere other than under \"$WORK/\": the cleanup removes the work"
						+ " directory and nothing else, so what is written elsewhere is still on the"
						+ " disk after a pour that passed")
				.isEmpty();

		for (String name : List.of("STREAM", "QA_SESSION")) {
			Pattern given = Pattern.compile("(^|[\\s;&|({\"'])" + name + "\\+?=");
			List<String> assigned = code.stream().filter(one -> given.matcher(one).find()).toList();
			assertThat(assigned).as("%s is given a value in exactly one place", name).hasSize(1);
			assertThat(assigned.get(0))
					.as("%s names a file the pour writes, so it has to start under \"$WORK/\"", name)
					.startsWith(name + "=\"$WORK/");
		}

		List<String> calls = code.stream().filter(one -> one.startsWith("dump_into ")).toList();
		assertThat(calls).as("dump_into is called, or its redirection to a parameter is not followed")
				.isNotEmpty();
		for (String call : calls) {
			List<String> words = new ArrayList<>();
			Matcher word = Pattern.compile("\"[^\"]*\"|'[^']*'|\\S+").matcher(call);
			while (word.find()) {
				words.add(word.group());
			}
			assertThat(words.get(4))
					.as("dump_into writes its schema dump to the fourth parameter: %s", call)
					.startsWith("\"$WORK/");
		}
	}

	/**
	 * THE READER OF REDIRECTIONS READS SHELL THE WAY THE SHELL DOES, which is the whole of what the
	 * case above rests on.
	 *
	 * <p>A guard whose reader finds nothing passes for any script, so the reader is held on its
	 * own, on text that is meant to trip it: a {@code >} in a quoted message and in an awk
	 * program, which are not redirections; one in a comment and in the body of a here-document,
	 * which are not either; and the forms that ARE ones, appended, behind a descriptor, joined to
	 * its target, inside a command substitution that has quotes of its own, and a duplication.
	 */
	@Test
	void theReaderOfRedirectionsReadsShellTheWayTheShellDoes() {
		String shell = String.join("\n",
				"say \"a message with V<number>__*.sql in it\" # and a > in a comment",
				"awk '$2 > 0 { print }' \"$WORK/a\"",
				"cat <<EOF",
				"a > in a here-document",
				"EOF",
				"first > \"$WORK/one\"",
				"second >> \"$STREAM\"",
				"third 2>\"$WORK/three\" 4> /dev/null",
				"fourth >&2",
				"x=\"$(inside \"quotes\" > \"$WORK/four\")\"",
				"printf '%s' \"it's\" > \"$WORK/five\"",
				"");

		assertThat(redirections(shell))
				.extracting(Redirection::operator, Redirection::target)
				.containsExactly(
						tuple(">", "\"$WORK/one\""),
						tuple(">>", "\"$STREAM\""),
						tuple(">", "\"$WORK/three\""),
						tuple(">", "/dev/null"),
						tuple(">", "&2"),
						tuple(">", "\"$WORK/four\""),
						tuple(">", "\"$WORK/five\""));
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
	 * THE CONSTRAINTS THAT ARE NOT VALID STEP ASIDE BEFORE THE FIRST WRITE AND COME BACK BEFORE THE
	 * COMMIT, in the one transaction, and are checked again after it.
	 *
	 * <p>The pour is a stream written by the shell, and the order of its parts is the whole
	 * mechanism: a constraint lifted after the truncate has already refused nothing, and one put
	 * back after the commit is one the transaction cannot take back, and a restore that is simply
	 * missing leaves production with a constraint QA has and no error anywhere. Held by position,
	 * which is what an order is: {@code begin}, the lifts, the truncate, the reading of QA, the
	 * restores, the {@code commit}.
	 *
	 * <p>Two more shapes are held. The list is asked of PRODUCTION, whose catalogue the schema
	 * comparison has already proved is QA's, and it is asked AGAIN after the pour and compared: a
	 * constraint that came back as valid is not in the second answer at all, and that absence is
	 * the whole of what shows it.
	 */
	@Test
	void theConstraintsThatAreNotValidStepAsideBeforeTheFirstWriteAndComeBackBeforeTheCommit() {
		List<String> code = scriptCode();

		String lift = "sed -n 's/^drop|//p' \"$WORK/not-valid\"";
		String restore = "sed -n 's/^restore|//p' \"$WORK/not-valid\" >> \"$STREAM\"";
		String commit = "printf 'commit;\\n' >> \"$STREAM\"";

		int begin = code.indexOf("printf 'begin;\\n'");
		int lifted = code.indexOf(lift);
		int truncate = indexOfLineStarting(code, "printf 'truncate table");
		int readQa = indexOfLineContaining(code, "< \"$QA_SESSION\"");
		int restored = code.indexOf(restore);
		int committed = code.indexOf(commit);

		assertThat(List.of(begin, lifted, truncate, readQa, restored, committed))
				.as("every part of the pour has to be there: begin, the lifts, the truncate, the"
						+ " reading of QA, the restores, the commit")
				.allSatisfy(one -> assertThat(one).isGreaterThanOrEqualTo(0));
		assertThat(List.of(begin, lifted, truncate, readQa, restored, committed))
				.as("the constraints step aside BEFORE the first write and come back BEFORE the commit,"
						+ " in this order")
				.isSorted();

		assertThat(code.stream().filter(lift::equals).count())
				.as("one line lifts them, and it is not repeated")
				.isEqualTo(1);

		List<String> asked = linesWith(code, "< \"$NOT_VALID_SQL\"");
		assertThat(asked)
				.as("the list is asked twice, of production both times: before the pour and after it")
				.containsExactly(
						"prod_sql -F'|' -f - < \"$NOT_VALID_SQL\" > \"$WORK/not-valid\"",
						"prod_sql -F'|' -f - < \"$NOT_VALID_SQL\" > \"$WORK/not-valid.after\"");

		int pour = indexOfLineContaining(code, "< \"$STREAM\"");
		int again = code.indexOf("prod_sql -F'|' -f - < \"$NOT_VALID_SQL\" > \"$WORK/not-valid.after\"");
		int compared = indexOfLineContaining(code, "diff -u \"$WORK/not-valid\" \"$WORK/not-valid.after\"");
		assertThat(List.of(pour, again, compared))
				.as("the answer is compared with the one from before the pour, and only after the pour")
				.isSorted()
				.allSatisfy(one -> assertThat(one).isGreaterThanOrEqualTo(0));
	}

	private static int indexOfLineStarting(List<String> code, String prefix) {
		for (int at = 0; at < code.size(); at++) {
			if (code.get(at).startsWith(prefix)) {
				return at;
			}
		}
		return -1;
	}

	private static int indexOfLineContaining(List<String> code, String needle) {
		for (int at = 0; at < code.size(); at++) {
			if (code.get(at).contains(needle)) {
				return at;
			}
		}
		return -1;
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
	 * THE PHOTOGRAPHS ARE COPIED WITHOUT THEIR TIMES, BY ONE LINE WHOSE OPTIONS ARE EXACTLY TWO.
	 *
	 * <p>The backend deletes, once an hour, every file in the pictures folder that no row names
	 * and that is older than ten minutes by its own time of last modification
	 * ({@code ThePicturesFolderIsSwept}), and this tool copies the files BEFORE the transaction
	 * that writes their rows. {@code cp -a} keeps QA's times, so a poured file would arrive
	 * looking old and, for as long as the pour takes, without a row: a sweep that fell there would
	 * delete it. The copy keeps the mode and the owner, which is the part of {@code -a} the backend
	 * needs, and nothing that carries a time.
	 *
	 * <p><b>Held as a list of what is ALLOWED and not as a list of what is forbidden</b>, because
	 * the spellings that keep a time are not a closed set ({@code -a}, {@code -p}, {@code -dpR},
	 * {@code --archive}, {@code --preserve}, {@code --preserve=all},
	 * {@code --preserve=timestamps}, and whatever the next release of the tool adds), and a list of
	 * them would only defer the next one. Every option of the command is asked about, and any that
	 * is not one of the two fails the case, so a new option has to be argued for here instead of
	 * slipping in.
	 *
	 * <p><b>The command is read the one way the shape allows and the guard fails when it cannot
	 * read it.</b> It is taken out of the quoted string {@code docker run} is handed, by the name
	 * {@code cp}. A copy done by anything else - a {@code tar} pipe, {@code rsync -a} - leaves no
	 * such line and fails the first assertion, and a {@code cp} that stops being inside one
	 * single quoted {@code -c '...'} fails the second: in both the guard says it does not know the
	 * shape, which is the right way round for a line whose whole point is a thing it cannot see.
	 */
	@Test
	void thePhotographsAreCopiedByOneLineThatKeepsNoTime() {
		List<String> copies = scriptCode().stream()
				.filter(one -> CP_THE_COMMAND.matcher(one).find())
				.toList();

		assertThat(copies)
				.as("exactly one line of the script's code copies something with cp, and it is the"
						+ " one that copies the photographs: a second line, or none, is a copy this"
						+ " guard was not told about")
				.hasSize(1);

		Matcher handed = CP_HANDED_TO_SH.matcher(copies.get(0));

		assertThat(handed.find())
				.as("the cp command is not one single quoted string handed to sh -c, so this guard"
						+ " cannot read its options and fails rather than guess: %s", copies.get(0))
				.isTrue();

		List<String> options = Arrays.stream(handed.group(1).trim().split("\\s+"))
				.skip(1)
				.filter(word -> word.startsWith("-"))
				.toList();

		assertThat(options)
				.as("the options of the cp that copies the photographs: it keeps the mode and the"
						+ " owner and no time, because the backend deletes a file no row names that"
						+ " is older than ten minutes by its time, and a poured file arrives before"
						+ " its row. Any other option, -a above all, has to be argued for here")
				.containsExactlyInAnyOrder("-R", "--preserve=mode,ownership");
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

	/** One output redirection of a shell script: the line it is on, the operator, and its target as written. */
	record Redirection(int line, String operator, String target) {
	}

	/**
	 * Every output redirection of a shell script, found the way the shell finds them. A reading
	 * that cannot make sense of the text, a quote that is never closed, throws: a guard that cannot
	 * read the script says nothing about it, and must fail rather than pass.
	 */
	static List<Redirection> redirections(String shell) {
		return new ShellReader(shell).read();
	}

	/**
	 * A reader of exactly as much shell as the question needs: quotes, comments, here-documents,
	 * command substitutions and parameter expansions, so that it knows when a {@code >} is an
	 * operator and when it is a character in a string. It does not run anything, expand anything or
	 * follow a value.
	 */
	private static final class ShellReader {

		private final String s;

		private int i;

		private int line = 1;

		private final List<Redirection> found = new ArrayList<>();

		/** Each entry is a delimiter and whether it was written {@code <<-}, waiting for the next newline. */
		private final Deque<String[]> hereDocuments = new ArrayDeque<>();

		ShellReader(String shell) {
			this.s = shell;
		}

		List<Redirection> read() {
			code(false);
			if (!hereDocuments.isEmpty()) {
				throw unreadable("a here-document that is never closed");
			}
			return found;
		}

		private AssertionError unreadable(String why) {
			return new AssertionError("line " + line + " cannot be read as shell: " + why
					+ ". A guard that cannot read the script says nothing about it, so it fails.");
		}

		private char at(int index) {
			return index < s.length() ? s.charAt(index) : '\0';
		}

		/** Code, up to the end of the text or, inside {@code $( ... )}, up to its closing parenthesis. */
		private void code(boolean substitution) {
			boolean startsWord = true;
			int depth = 0;
			while (i < s.length()) {
				char c = s.charAt(i);
				if (c == '\n') {
					i++;
					line++;
					swallowHereDocuments();
					startsWord = true;
				}
				else if (c == '\\') {
					if (at(i + 1) == '\n') {
						line++;
					}
					i += 2;
					startsWord = false;
				}
				else if (c == '\'') {
					singleQuoted();
					startsWord = false;
				}
				else if (c == '"') {
					i++;
					doubleQuoted();
					startsWord = false;
				}
				else if (c == '`') {
					backticked();
					startsWord = false;
				}
				else if (c == '$') {
					dollar();
					startsWord = false;
				}
				else if (c == '#' && startsWord) {
					while (i < s.length() && s.charAt(i) != '\n') {
						i++;
					}
				}
				else if (c == '>') {
					redirection();
					startsWord = true;
				}
				else if (c == '<') {
					input();
					startsWord = true;
				}
				else if (c == '(') {
					depth++;
					i++;
					startsWord = true;
				}
				else if (c == ')') {
					i++;
					if (depth > 0) {
						depth--;
					}
					else if (substitution) {
						return;
					}
					startsWord = true;
				}
				else {
					startsWord = Character.isWhitespace(c) || ";|&{}".indexOf(c) >= 0;
					i++;
				}
			}
			if (substitution) {
				throw unreadable("a $( that is never closed");
			}
		}

		private void swallowHereDocuments() {
			while (!hereDocuments.isEmpty()) {
				String[] document = hereDocuments.poll();
				while (true) {
					if (i >= s.length()) {
						throw unreadable("the here-document <<" + document[0] + " is never closed");
					}
					int end = s.indexOf('\n', i);
					String body = end < 0 ? s.substring(i) : s.substring(i, end);
					i = end < 0 ? s.length() : end + 1;
					line++;
					if ((document[1].equals("-") ? body.replaceAll("^\t+", "") : body).equals(document[0])) {
						break;
					}
				}
			}
		}

		private void singleQuoted() {
			int end = s.indexOf('\'', i + 1);
			if (end < 0) {
				throw unreadable("a single quote that is never closed");
			}
			for (int at = i; at < end; at++) {
				if (s.charAt(at) == '\n') {
					line++;
				}
			}
			i = end + 1;
		}

		/** Inside double quotes, with {@code i} just past the opening one. */
		private void doubleQuoted() {
			while (i < s.length()) {
				char c = s.charAt(i);
				if (c == '"') {
					i++;
					return;
				}
				if (c == '\\') {
					if (at(i + 1) == '\n') {
						line++;
					}
					i += 2;
				}
				else if (c == '$') {
					dollar();
				}
				else if (c == '`') {
					backticked();
				}
				else {
					if (c == '\n') {
						line++;
					}
					i++;
				}
			}
			throw unreadable("a double quote that is never closed");
		}

		private void backticked() {
			int end = i + 1;
			while (end < s.length() && s.charAt(end) != '`') {
				if (s.charAt(end) == '\\') {
					end++;
				}
				end++;
			}
			if (end >= s.length()) {
				throw unreadable("a backtick that is never closed");
			}
			for (int at = i; at < end; at++) {
				if (s.charAt(at) == '\n') {
					line++;
				}
			}
			i = end + 1;
		}

		private void dollar() {
			char next = at(i + 1);
			if (next == '(') {
				if (at(i + 2) == '(') {
					int end = s.indexOf("))", i + 3);
					if (end < 0) {
						throw unreadable("an arithmetic expansion that is never closed");
					}
					i = end + 2;
				}
				else {
					i += 2;
					code(true);
				}
			}
			else if (next == '{') {
				int depth = 1;
				i += 2;
				while (i < s.length() && depth > 0) {
					char c = s.charAt(i);
					if (c == '\'') {
						singleQuoted();
						continue;
					}
					if (c == '"') {
						i++;
						doubleQuoted();
						continue;
					}
					if (c == '{') {
						depth++;
					}
					else if (c == '}') {
						depth--;
					}
					else if (c == '\\') {
						i++;
					}
					else if (c == '\n') {
						line++;
					}
					i++;
				}
				if (depth > 0) {
					throw unreadable("a ${ that is never closed");
				}
			}
			else if (next != '\0' && "@*#?$!-0123456789".indexOf(next) >= 0) {
				i += 2;
			}
			else {
				i++;
			}
		}

		/** A shell word, quotes and expansions included, read to the character that ends it. */
		private void word() {
			while (i < s.length()) {
				char c = s.charAt(i);
				if (Character.isWhitespace(c) || ";|&()<>".indexOf(c) >= 0) {
					return;
				}
				if (c == '\\') {
					if (at(i + 1) == '\n') {
						line++;
					}
					i += 2;
				}
				else if (c == '\'') {
					singleQuoted();
				}
				else if (c == '"') {
					i++;
					doubleQuoted();
				}
				else if (c == '`') {
					backticked();
				}
				else if (c == '$') {
					dollar();
				}
				else {
					i++;
				}
			}
		}

		private void redirection() {
			i++;
			String operator = ">";
			if (at(i) == '>') {
				operator = ">>";
				i++;
			}
			if (at(i) == '&') {
				int end = i + 1;
				while (end < s.length() && (Character.isDigit(s.charAt(end)) || s.charAt(end) == '-')) {
					end++;
				}
				found.add(new Redirection(line, operator, s.substring(i, end)));
				i = end;
				return;
			}
			if (at(i) == '|') {
				i++;
			}
			while (at(i) == ' ' || at(i) == '\t') {
				i++;
			}
			int start = i;
			word();
			found.add(new Redirection(line, operator, s.substring(start, i)));
		}

		private void input() {
			if (at(i + 1) == '<' && at(i + 2) != '<') {
				i += 2;
				String strip = "";
				if (at(i) == '-') {
					strip = "-";
					i++;
				}
				while (at(i) == ' ' || at(i) == '\t') {
					i++;
				}
				int start = i;
				word();
				String delimiter = s.substring(start, i).replace("'", "").replace("\"", "").replace("\\", "");
				if (delimiter.isEmpty()) {
					throw unreadable("a here-document with no delimiter");
				}
				hereDocuments.add(new String[] { delimiter, strip });
			}
			else if (at(i + 1) == '<') {
				i += 3;
			}
			else {
				i++;
			}
		}
	}
}
