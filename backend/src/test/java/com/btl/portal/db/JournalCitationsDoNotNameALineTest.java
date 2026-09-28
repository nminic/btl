package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.MatchResult;
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
 * <p><b>Migrations are the one recorded exception, and it is a folder, not a list of
 * today's migrations.</b> Once a migration is applied it is immutable (ADL A2): its checksum
 * is pinned in {@link MigrationsAreImmutableTest} and Flyway runs with
 * {@code validate-on-migrate=true}, so a citation written inside one cannot be repaired
 * without rewriting history nobody may rewrite. Writing the exception as three file names
 * would let a fourth migration slip in tomorrow carrying the same defect unnoticed; writing it
 * as {@code db/migration} does not.
 */
class JournalCitationsDoNotNameALineTest {

	private static final Pattern CITES_A_LINE_NUMBER = Pattern.compile("(PDL|ADL)\\.md:[0-9]+");

	@Test
	void noBackendSourceCitesTheJournalByLineNumberOutsideAMigration() throws IOException {
		Path sources = DatabaseTest.repositoryRoot().resolve("backend/src");
		Path migrations = sources.resolve("main/resources/db/migration");

		try (Stream<Path> tree = Files.walk(sources)) {
			List<String> guilty = tree
					.filter(Files::isRegularFile)
					.filter(path -> !path.startsWith(migrations))
					.flatMap(path -> citations(path).map(cited -> sources.relativize(path) + ": " + cited))
					.sorted()
					.toList();

			assertThat(guilty)
					.as("a citation of PDL.md or ADL.md that names a line number goes stale the moment "
							+ "anybody edits the journal above that line (ADL, decision of 27.09.2026); "
							+ "quote the decisive sentence instead, confirmed unique in the journal with "
							+ "grep -c, and drop the line number")
					.isEmpty();
		}
	}

	private static Stream<String> citations(Path path) {
		Matcher found = CITES_A_LINE_NUMBER.matcher(readable(path));
		return found.results().map(MatchResult::group);
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
