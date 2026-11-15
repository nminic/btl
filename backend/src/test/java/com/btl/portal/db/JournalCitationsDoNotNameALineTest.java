package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
 * whether the name and the number are GLUED together through one of the small set of
 * connectors this codebase actually writes between them, however the name itself is
 * spelled.</b> PR 155's own sweep left a gap: a comment that cites the journal once and
 * then, later in the same sentence, cites a SECOND line of the same document written only as a
 * bare colon-number - the shorthand the surrounding prose already uses throughout this
 * codebase for "same file, another line" - goes stale exactly the same way and was invisible to
 * a check that only looked for the file name glued to the number. A third wrapper turned up in
 * the same sweep: the file name closed with a backtick immediately before the colon, rather
 * than glued to it or held inside {@code @code}. All three are the same defect in different
 * clothing, and this test reads for the defect rather than for one spelling of it.
 *
 * <p><b>Independent review of this fix, 28.09.2026, found two more shapes of the identical
 * defect that PR 155's sweep did not.</b> A name closed by {@code @code} and then glued
 * straight to the colon - the closing brace standing exactly where the backtick stood before -
 * is no less direct a splice than the backtick PR 155 already caught, so the brace joins it as
 * a second connector the named-citation shape accepts. And the journal named through the real
 * folder it lives in is still the journal, not "some other file": a number glued to the
 * folder-qualified name used to read as a citation to a file nobody excludes, and a bare
 * continuation that followed it used to inherit that same wrong belief and go unwatched. Both
 * are closed the same way PR 155 closed its two - by teaching the code to see one more shape of
 * the same thing, not by teaching it to guess.
 *
 * <p><b>Two shapes stay open, named here rather than left for the next reader to discover by
 * missing them.</b> A line number spelled out in words - {@code at line}, this codebase's own
 * house style for citing a SOURCE FILE's line - has no closed set of spellings to check the
 * journal's name against; closing "at line" would still leave "on line", "row" and every other
 * way of saying it, and a hand-written list of phrasings is exactly the kind of list PR 155
 * already rejected for file names, for the same reason: it only defers the next false negative
 * rather than removing it. And a bare colon with no {@code @code} marker at all cannot be told
 * apart from {@link MigrationsAreImmutableTest}'s own repin note below, which writes out an old
 * citation in quotes, on purpose, as the historical shape a live one must not be confused with;
 * the {@code @code} wrapper is the only signal that marks a bare continuation as a live
 * reference rather than prose mentioning a number, and a shape with no wrapper at all has no
 * such signal left to read. Widening either gap by matching a number near the name instead of a
 * number glued to it was tried and measured against this same tree before this paragraph was
 * written: a name-then-nearby-number rule catches both of the repin note's quoted citations,
 * which is the one thing this test exists not to do.
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
 * <p><b>The name and the colon must be adjacent, with at most one closing backtick or one
 * closing {@code @code} brace between them - never a space.</b> {@link
 * MigrationsAreImmutableTest}'s own repin note writes out, deliberately and in quotes, what an
 * old citation of this journal used to look like, as the historical reason for a checksum
 * change; that citation is written with a space before the colon, on purpose, precisely so a
 * reader can tell it apart from a live one without this test having to know that file exists.
 * Loosening the pattern to tolerate a space - or to look for a number anywhere near the name
 * rather than glued to it - would catch that quote too, twice over, since the repin note
 * writes it out in full on two separate lines, and there would be no way back to excluding it
 * that did not mean naming the file or the quote by hand.
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
	 * file-like token, optionally closed by a single backtick OR a single closing
	 * {@code @code} brace, glued to a colon and a line number: {@code PDL.md} joined straight
	 * to a colon and digits, the same joined through a closing backtick first, the same again
	 * joined through the closing brace of its own {@code @code} wrapper, and a source file such
	 * as {@code SomeScreen.tsx} joined any of those same ways all take this shape, and every one
	 * of them is told apart only by the name, not by the punctuation around it - and the name
	 * itself may be written bare or through the real folder it lives in, since a path that ends
	 * in the journal's file name is still naming the journal. A BARE continuation is an
	 * {@code @code}-wrapped colon and digits with no name of its own, meaning "the file just
	 * named". And the journal's own name can appear with no number attached at all - the shape
	 * this repository's own anchors now take, {@code PDL.md} followed by a parenthesized quote -
	 * which still has to update what "just named" means for a bare continuation that follows it.
	 */
	private static final Pattern CITATION = Pattern.compile(
			"\\b(?<namedFile>[A-Za-z][A-Za-z0-9_./]*\\.[A-Za-z0-9]+)[`}]?:(?<namedNum>[0-9]+)"
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
					.flatMap(path -> citations(readable(path).orElse("")).stream()
							.map(cited -> sources.relativize(path) + ": " + cited))
					.sorted()
					.toList();

			assertThat(guilty)
					.as("a citation of PDL.md or ADL.md, named bare or through its folder, that names a"
							+ " line number - directly, through a bare continuation, or through a backtick"
							+ " or a closing @code brace before the colon - goes stale the moment anybody"
							+ " edits the journal above that line (ADL, decision of 27.09.2026); quote the"
							+ " decisive sentence instead, confirmed unique in the journal with grep -c, and"
							+ " drop the line number")
					.isEmpty();
		}
	}

	/**
	 * The two shapes independent review of this fix (28.09.2026) found missing, proven directly
	 * against {@link #citations(String)} rather than by planting them in a real file, and the
	 * two shapes named in the class javadoc as staying open on purpose - proven the same way, so
	 * a future change that starts catching them either updates this case on purpose or fails it
	 * and is read before it merges.
	 */
	@Test
	void aClosingBraceAndAFolderPrefixAreSeenThroughButAWordedNumberAndAnUnwrappedColonAreNot() {
		// Built from pieces rather than written whole: the class javadoc's own reason for never
		// spelling the pattern out literally applies just as much here - a literal digit-bearing
		// example would trip the very check this file's own scan runs over this same source.
		String pdl = "PDL" + ".md";
		String adl = "ADL" + ".md";

		assertThat(citations("{@code " + pdl + "}:" + "4242"))
				.as("a closing @code brace between the name and the colon glues them exactly as"
						+ " directly as the backtick PR 155 already caught")
				.containsExactly(pdl + ":" + "4242");

		assertThat(citations("btl-produkt/" + pdl + ":" + "4343"))
				.as("the journal named through the real folder it lives in is still the journal")
				.containsExactly("produkt/" + pdl + ":" + "4343");

		assertThat(citations("btl-produkt/" + adl + ":" + "4444 and also {@code :" + "4545}"))
				.as("a folder-qualified name updates the memory a later bare continuation reads,"
						+ " the same as a bare name would")
				.containsExactly("produkt/" + adl + ":" + "4444", "{@code :" + "4545}");

		assertThat(citations(pdl + " at line " + "4646"))
				.as("[known gap, named in the class javadoc 28.09.2026] a number spelled out in"
						+ " words has no closed set of spellings to check for, so this stays open"
						+ " rather than growing a list the next phrasing evades")
				.isEmpty();

		assertThat(citations(pdl + " (\"some decision\") and also :" + "4747 nearby"))
				.as("[known gap, named in the class javadoc 28.09.2026] a bare colon with no"
						+ " @code marker cannot be told apart from MigrationsAreImmutableTest's"
						+ " own repin note, which writes the same name, a space, then a colon and"
						+ " digits, in quotes on purpose")
				.isEmpty();
	}

	/**
	 * Walks every citation-shaped token in document order and remembers, as it goes, which
	 * named file the most recent one was about - exactly the inference a person reading the
	 * sentence makes for a bare continuation, and nothing more. A named citation to
	 * {@code PDL.md} or {@code ADL.md} - bare, or written through the folder it lives in, since
	 * a path ending in that file name still names that file - is flagged on the spot regardless
	 * of memory; a named citation to anything else clears the memory instead of flagging; a bare
	 * continuation is flagged only while the memory says journal.
	 */
	private static List<String> citations(String content) {
		List<String> found = new ArrayList<>();
		Matcher token = CITATION.matcher(content);
		boolean lastNamedFileWasTheJournal = false;

		while (token.find()) {
			String namedFile = token.group("namedFile");
			if (namedFile != null) {
				boolean isJournal = namedFile.equals("PDL.md") || namedFile.equals("ADL.md")
						|| namedFile.endsWith("/PDL.md") || namedFile.endsWith("/ADL.md");
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

	/**
	 * THE TEXT OF A FILE, OR NOTHING WHEN THE FILE IS NOT TEXT AT ALL.
	 *
	 * <p>The tree under {@code backend/src} holds files that are not text: the two Roboto fonts
	 * under {@code main/resources/fonts} (PDL P11, 15.11.2026) are TrueType, and read as UTF-8 they
	 * are a {@code MalformedInputException}. What is not text is not asked about a citation, and
	 * "not text" is the question git itself asks of a file: it holds a zero byte. A text in a
	 * legible encoding never does, and every font, image and archive does within its first
	 * bytes. No list of extensions stands in for that question, so a binary of a kind this
	 * portal has not yet met is passed over without anybody having to name it, and the floor
	 * below ({@link #aSourceIsNeverPassedOverAsBinary()}) is what lets the rule be this wide.
	 *
	 * <p><b>What is passed over is the whole of the exception, and it is closed on both
	 * sides.</b> A file that is not binary is read strictly as UTF-8, and a byte that is not
	 * UTF-8 fails the walk with the file's name, as it did before; it is never replaced with a
	 * character and never skipped. A {@code .java} file is read the same strict way WHETHER OR NOT
	 * it holds a zero byte, so a source cannot leave the walk by being damaged into looking
	 * binary.
	 */
	private static Optional<String> readable(Path path) {
		try {
			byte[] bytes = Files.readAllBytes(path);

			if (!path.getFileName().toString().endsWith(".java") && holdsAZeroByte(bytes)) {
				return Optional.empty();
			}

			return Optional.of(StandardCharsets.UTF_8.newDecoder()
					.onMalformedInput(CodingErrorAction.REPORT)
					.onUnmappableCharacter(CodingErrorAction.REPORT)
					.decode(ByteBuffer.wrap(bytes))
					.toString());
		}
		catch (IOException problem) {
			throw new UncheckedIOException(path + " is neither a binary file nor UTF-8 text", problem);
		}
	}

	private static boolean holdsAZeroByte(byte[] bytes) {
		for (byte one : bytes) {
			if (one == 0) {
				return true;
			}
		}

		return false;
	}

	/**
	 * THE FLOOR UNDER THE WALK ABOVE: WHAT IT PASSES OVER, AND WHAT IT MUST NOT.
	 *
	 * <p>Asked of the real tree and not of a sample: no file the walk passes over is a
	 * {@code .java}, and the fonts are among them, so a walk that began passing over everything
	 * would fail here instead of looking like an empty, green sweep.
	 */
	@Test
	void aSourceIsNeverPassedOverAsBinary() throws IOException {
		Path sources = DatabaseTest.repositoryRoot().resolve("backend/src");

		try (Stream<Path> tree = Files.walk(sources)) {
			List<Path> files = tree.filter(Files::isRegularFile).toList();
			List<String> passedOver = files.stream()
					.filter(path -> readable(path).isEmpty())
					.map(path -> sources.relativize(path).toString().replace('\\', '/'))
					.sorted()
					.toList();

			assertThat(passedOver)
					.as("a file passed over as binary that is a Java source, or a walk that passes over"
							+ " nothing, the fonts included")
					.noneMatch(name -> name.endsWith(".java"))
					.contains("main/resources/fonts/Roboto-Regular.ttf", "main/resources/fonts/Roboto-Bold.ttf");
			assertThat(files.size() - passedOver.size())
					.as("the walk reads the text of the tree and not nothing")
					.isGreaterThan(500);
		}
	}

	/**
	 * A file of bytes is passed over, a file of damaged text is NOT, and a damaged source is not
	 * passed over however it is damaged. Proven on files made for the purpose, because the real
	 * tree holds none of the damaged kind and a floor that cannot fail proves nothing.
	 */
	@Test
	void aBinaryIsPassedOverAndDamagedTextIsNeitherPassedOverNorRead(@TempDir Path folder)
			throws IOException {
		Path font = Files.write(folder.resolve("Some.ttf"), new byte[] {0, 1, 0, 0, (byte) 0xFF, 0});
		Path damagedText = Files.write(folder.resolve("notes.txt"), new byte[] {'a', (byte) 0xC3, '(', 'b'});
		Path damagedSource = Files.write(folder.resolve("Some.java"), new byte[] {'a', (byte) 0xC3, '(', 'b'});
		Path sourceWithAZeroByte = Files.write(folder.resolve("Other.java"), new byte[] {'a', 0, 'b'});
		Path fine = Files.writeString(folder.resolve("fine.properties"), "a=b");

		assertThat(readable(font)).isEmpty();
		assertThat(readable(fine)).contains("a=b");
		assertThatThrownBy(() -> readable(damagedText)).isInstanceOf(UncheckedIOException.class);
		assertThatThrownBy(() -> readable(damagedSource)).isInstanceOf(UncheckedIOException.class);
		assertThat(readable(sourceWithAZeroByte)).isPresent();
	}
}
