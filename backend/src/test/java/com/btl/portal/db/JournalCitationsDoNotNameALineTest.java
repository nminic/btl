package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A citation of the product/architecture journal that names a LINE NUMBER goes stale the
 * moment anybody edits {@code PDL.md} or {@code ADL.md} above that line: every edit shifts
 * every number below it, silently, so a citation naming line six thousand and something ends
 * up pointing at whatever sentence now happens to sit on that number - a different decision, a
 * blank line, or a heading - and a reader who opens the journal there either believes the
 * wrong sentence is the decision or concludes there is no decision at all. Both are worse than
 * the number never having been there. (This javadoc deliberately never spells the citation
 * pattern out as a literal example: doing so would trip the very check below, which is itself
 * the surest sign the check reads the whole tree and not a chosen sample of it.)
 *
 * <p>[ODLUKA 27.09.2026, owner, after independent review of PR 388 found exactly this] A
 * citation carries a literal phrase copied verbatim from the journal instead, confirmed with
 * {@code grep -c} to occur exactly once before it is used. Text does not move when the
 * journal is edited; a line number moves every time. PR 414 set the precedent this test
 * enforces, and PR 155 swept the class that had accumulated in {@code backend/src} before the
 * rule existed - see that PR's description for which citations had already drifted onto the
 * wrong paragraph.
 *
 * <p><b>The question is not whether the text reads "PDL.md" then a colon then digits - it is
 * whether anybody names a journal line by number at all, in whatever shape a sentence happens
 * to write it.</b> PR 155's own sweep left a gap: a comment that cites the journal once and
 * then, later in the same sentence, cites a SECOND line of the same document written only as a
 * bare colon-number - the shorthand the surrounding prose already uses throughout this
 * codebase for "same file, another line" - goes stale exactly the same way and was invisible to
 * a check that only looked for the file name glued to the number. A third wrapper turned up in
 * the same sweep: the file name closed with a backtick immediately before the colon, rather
 * than glued to it or held inside {@code @code}. All three are the same defect in different
 * clothing, and this test reads for the defect rather than for one spelling of it.
 *
 * <p><b>How that is done without a hand-written list of exceptions, which would only defer the
 * next false positive rather than remove it.</b> The scan walks each file's text in order and
 * remembers which named file the LAST citation was about, the way a reader does: a citation
 * that names a file resets that memory to that file (journal or not); a bare {@code :NNN}
 * inherits whatever file was last named, so it is only flagged when that file was {@code
 * PDL.md} or {@code ADL.md}. A citation to some other file in between - {@code
 * SomeScreen.tsx:263} and a bare {@code :315} straight after it, both naming a frontend
 * source file rather than the journal - correctly resets the memory and is never flagged,
 * without either file name ever being written into this test by hand. Confirmed both
 * directions in the PR description: a bare continuation of a journal citation is caught, and
 * the same shape continuing a non-journal citation is not.
 *
 * <p><b>The name and the colon must be adjacent, with at most the one closing backtick
 * between them - never a space.</b> {@link MigrationsAreImmutableTest}'s own repin note
 * writes out, deliberately and in quotes, what an old citation of this journal used to look
 * like, as the historical reason for a checksum change; that citation is written with a
 * space before the colon, on purpose, precisely so a reader can tell it apart from a live one
 * without this test having to know that file exists. Loosening the pattern to tolerate a
 * space would catch that quote too, and there would be no way back to excluding it that did
 * not mean naming the file.
 *
 * <p><b>Migrations are the one recorded exception, and it is a folder, not a list of
 * today's migrations.</b> Once a migration is applied it is immutable (ADL A2): its checksum
 * is pinned in {@link MigrationsAreImmutableTest} and Flyway runs with
 * {@code validate-on-migrate=true}, so a citation written inside one cannot be repaired
 * without rewriting history nobody may rewrite. Writing the exception as three file names
 * would let a fourth migration slip in tomorrow carrying the same defect unnoticed; writing it
 * as {@code db/migration} does not.
 */
class JournalCitationsDoNotNameALineTest {

	/**
	 * Three shapes in one pattern, tried left to right at each position, and none of them
	 * spelled out below as a literal digit-bearing example for the same reason the class
	 * javadoc gives - it would trip the very thing being described. A NAMED citation is a
	 * file-like token, optionally closed by a single backtick, glued to a colon and a line
	 * number: {@code PDL.md} joined straight to a colon and digits, the same joined through
	 * a closing backtick first, and a source file such as {@code SomeScreen.tsx} joined the
	 * same way all take this shape, and all three are told apart only by the name, not by
	 * the punctuation around it. A BARE continuation is an {@code @code}-wrapped colon and
	 * digits with no name of its own, meaning "the file just named". And the journal's own
	 * name can appear with no number attached at all - the shape this repository's own
	 * anchors now take, {@code PDL.md} followed by a parenthesized quote - which still has
	 * to update what "just named" means for a bare continuation that follows it.
	 */
	private static final Pattern CITATION = Pattern.compile(
			"\\b(?<namedFile>[A-Za-z][A-Za-z0-9_./]*\\.[A-Za-z0-9]+)`?:(?<namedNum>[0-9]+)"
					+ "|\\{@code\\s*:\\s*(?<bareNum>[0-9]+)\\s*\\}"
					+ "|\\b(?<journalNameOnly>PDL\\.md|ADL\\.md)\\b");

	@Test
	void noBackendSourceCitesTheJournalByLineNumberOutsideAMigration() throws IOException {
		Path sources = DatabaseTest.repositoryRoot().resolve("backend/src");
		Path migrations = sources.resolve("main/resources/db/migration");

		try (Stream<Path> tree = Files.walk(sources)) {
			List<String> guilty = tree
					.filter(Files::isRegularFile)
					.filter(path -> !path.startsWith(migrations))
					.flatMap(path -> citations(readable(path)).stream()
							.map(cited -> sources.relativize(path) + ": " + cited))
					.sorted()
					.toList();

			assertThat(guilty)
					.as("a citation of PDL.md or ADL.md that names a line number - directly, through a"
							+ " bare continuation, or through a backtick before the colon - goes stale the"
							+ " moment anybody edits the journal above that line (ADL, decision of"
							+ " 27.09.2026); quote the decisive sentence instead, confirmed unique in the"
							+ " journal with grep -c, and drop the line number")
					.isEmpty();
		}
	}

	/**
	 * Walks every citation-shaped token in document order and remembers, as it goes, which
	 * named file the most recent one was about - exactly the inference a person reading the
	 * sentence makes for a bare continuation, and nothing more. A named citation to
	 * {@code PDL.md} or {@code ADL.md} is flagged on the spot regardless of memory; a named
	 * citation to anything else clears the memory instead of flagging; a bare continuation
	 * is flagged only while the memory says journal.
	 */
	private static List<String> citations(String content) {
		List<String> found = new ArrayList<>();
		Matcher token = CITATION.matcher(content);
		boolean lastNamedFileWasTheJournal = false;

		while (token.find()) {
			String namedFile = token.group("namedFile");
			if (namedFile != null) {
				boolean isJournal = namedFile.equals("PDL.md") || namedFile.equals("ADL.md");
				if (isJournal) {
					found.add(namedFile + ":" + token.group("namedNum"));
				}
				lastNamedFileWasTheJournal = isJournal;
			}
			else if (token.group("bareNum") != null) {
				if (lastNamedFileWasTheJournal) {
					found.add(token.group());
				}
			}
			else {
				lastNamedFileWasTheJournal = true;
			}
		}

		return found;
	}

	private static String readable(Path path) {
		try {
			return Files.readString(path);
		}
		catch (IOException problem) {
			throw new UncheckedIOException(problem);
		}
	}
}
