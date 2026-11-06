package com.btl.portal.web;

import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.LiteralTree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.TreeScanner;
import org.junit.jupiter.api.Test;

import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.ToolProvider;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NOTHING IN {@code src/main} READS {@code competitor.active}; IT IS ONLY WRITTEN.
 *
 * <p>PDL, „Članstvo je činjenica po sezoni" (13.09.2026): „Zastavica „aktivan" prestaje da bude podatak i
 * postaje izvedena". Since AF-1 every statement that asks whether a member is active asks it through
 * {@link AMemberIsActive}, of {@code membership}, and the writers go on writing the flag so that a step back
 * is a revert; the column goes in a migration of its own. This case is what keeps a new reader of the flag
 * from arriving in between: a statement that reads it again would answer by a fact with no season in it,
 * and the member whose fee lapsed at New Year would stand on the list again.
 *
 * <p><b>WHAT IT ASKS AND HOW.</b> Every {@code .java} file under {@code src/main/java}, found by walking the
 * tree, is parsed by the compiler's own parser ({@link JavacTask#parse}), and every string literal it holds
 * is asked whether it names {@code active} as a word. The parser and not a pattern over the text decides
 * what a literal is, so a comment that names the column (and many do, to say why it is no longer read) is
 * not a literal, and a literal split over lines or written with either kind of quote is one.
 *
 * <p>The parser folds a chain of literals joined by {@code +} into one literal, so a statement written over
 * many lines is read whole, up to the first piece that is not a literal.
 *
 * <p><b>THE EXCEPTIONS ARE THE WRITERS, BY THE CLAUSE THAT WRITES, AND THE LIST IS HELD IN BOTH
 * DIRECTIONS.</b> Every clause on the list is taken out of the literals of its own file, and the word must
 * not be left in any of them; a clause on the list that no literal of its file holds fails as surely, so
 * the list cannot go stale and widen what passes. A writer that also read the flag in the same statement
 * ({@code ... set active = true where active}) is caught, because only the clause is taken out.
 *
 * <p><b>ITS BOUNDARY, SAID RATHER THAN HIDDEN:</b> the sweep reads what is written. SQL assembled from two
 * pieces that are not both literals, each saying less than the word ({@code "act" + suffix}), or a word
 * built at run time, is not seen. Nothing in the portal builds a column name that way, and a statement
 * that did would be the first.
 */
class NothingReadsTheFlagTest {

	private static final Pattern THE_WORD = Pattern.compile("\\bactive\\b");

	/**
	 * Every clause in {@code src/main/java} allowed to name the column, by the file that holds it. Each is a
	 * write: an {@code update} that sets it, or the column list of an {@code insert}.
	 */
	private static final Map<String, List<String>> THE_WRITERS = Map.of(
			"BookingAPayment.java", List.of("set member_number = ?, active = true", "set active = true"),
			"CompetitorWriteApi.java", List.of("first_season, active,"),
			"GrantingASeason.java", List.of("set member_number = ?, active = true"),
			"MemberMembershipApi.java", List.of("set active = exists("),
			"MyMembershipWriteApi.java", List.of("set member_number = ?, active = true", "set active = true"),
			"RegistrationApi.java", List.of("first_season, active,"));

	@Test
	void onlyTheWritersNameTheFlag() throws IOException {
		Path sources = Path.of("src/main/java");
		List<String> reads = new ArrayList<>();
		Map<String, Set<String>> written = new TreeMap<>();

		try (Stream<Path> tree = Files.walk(sources)) {
			tree.filter(path -> path.getFileName().toString().endsWith(".java"))
					.sorted()
					.forEach(path -> {
						String name = path.getFileName().toString();
						List<String> clauses = THE_WRITERS.getOrDefault(name, List.of());

						for (String literal : literalsNamingTheFlag(read(path))) {
							String left = literal;

							for (String clause : clauses) {
								if (left.contains(clause)) {
									written.computeIfAbsent(name, any -> new TreeSet<>()).add(clause);
									left = left.replace(clause, "");
								}
							}

							if (THE_WORD.matcher(left).find()) {
								reads.add(name + ": " + literal);
							}
						}
					});
		}

		assertThat(reads)
				.as("a statement in src/main reads competitor.active again; ask AMemberIsActive instead")
				.isEmpty();

		Map<String, Set<String>> listed = new TreeMap<>();
		THE_WRITERS.forEach((name, clauses) -> listed.put(name, new TreeSet<>(clauses)));

		assertThat(written)
				.as("a writer on the list is no longer in the code, so the list allows more than is written")
				.isEqualTo(listed);
	}

	/** The parser and not the text decides what a literal is: a comment is none, a literal in a statement is one. */
	@Test
	void aLiteralIsSeenAndACommentIsNot() {
		String source = "class A { /* where c.active */ // and active\n"
				+ " String a = \"select 1\" + \" where c.active\"; String b = \"activeness\"; }";

		assertThat(literalsNamingTheFlag(source)).containsExactly("select 1 where c.active");
	}

	static List<String> literalsNamingTheFlag(String source) {
		JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
		JavaFileObject file = new SimpleJavaFileObject(URI.create("string:///Source.java"),
				JavaFileObject.Kind.SOURCE) {
			@Override
			public CharSequence getCharContent(boolean ignoreEncodingErrors) {
				return source;
			}
		};
		List<String> named = new ArrayList<>();

		try {
			JavacTask task = (JavacTask) compiler.getTask(null, null, null, List.of("-proc:none"), null,
					List.of(file));

			for (CompilationUnitTree unit : task.parse()) {
				new TreeScanner<Void, Void>() {
					@Override
					public Void visitLiteral(LiteralTree literal, Void nothing) {
						if (literal.getValue() instanceof String text && THE_WORD.matcher(text).find()) {
							named.add(text);
						}

						return null;
					}
				}.scan(unit, null);
			}
		}
		catch (IOException problem) {
			throw new UncheckedIOException(problem);
		}

		return named;
	}

	private static String read(Path path) {
		try {
			return Files.readString(path, StandardCharsets.UTF_8);
		}
		catch (IOException problem) {
			throw new UncheckedIOException(problem);
		}
	}
}
