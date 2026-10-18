package com.btl.portal.domain.mail;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE QUOTES THE PORTAL WRITES TO A MEMBER ARE THE ENGLISH ONES (PDL P18, 18.10.2026).
 *
 * <p>The owner: "Neka navodnici budu engleski", for the whole portal and in both languages. The
 * Serbian low quote and the two curly ones are therefore not used in any text a member reads
 * from the server. Two homes write such text, and this reads both of them from what the
 * toolchain itself says about them and not from a list typed out here:
 *
 * <ul>
 * <li><b>The dictionaries</b>, every value of every {@code .properties} under {@code mail/}
 * and {@code notices/}, found by walking the folders. {@link Properties} drops the comments
 * itself, so a comment that quotes the owner in his own marks is not read.
 * <li><b>The strings in the Java classes</b>, read out of the constant pool of the compiled
 * classes under {@code com/btl/portal}. A comment is not in the constant pool by
 * construction, and a sentence assembled from two parts is: {@code "x " + name + "y"}
 * compiles to a recipe that holds both parts, so the mark is found whether it sits in a
 * whole sentence or in a fragment of one. Reading the source text for it would flag every
 * comment that quotes the owner and miss a text built from pieces, which is the pair of
 * mistakes this is here to avoid.
 * </ul>
 *
 * <p><b>What it cannot see, and says so:</b> a mark that arrives as DATA (a team called
 * with a low quote in its name, a figure from a table) is not a string in a class, and the
 * pages the Association writes in the database ({@code db/migration}) are a separate change by
 * decision. The frontend dictionary is the other half of this decision and is not read here.
 *
 * <p>The class-file reader is ~25 lines over the format the JVM specification defines (section
 * 4.4), because Java 21 has no public class-file API and a library for one table would be a
 * dependency bought for a single read. The cases at the bottom measure the reader itself, with
 * classes compiled from this file, so a reader that read nothing would fail them.
 */
class TheQuotesAMemberReadsAreEnglishTest {

	/** The Serbian low double quote, and the curly pair English typesets with. */
	private static final String THE_MARKS = new String(new char[] { 0x201e, 0x201c, 0x201d });

	private static final Path RESOURCES = Path.of("src", "main", "resources");

	private static final Path COMPILED = Path.of("target", "classes");

	/**
	 * EVERY VALUE IN THE DICTIONARIES A MEMBER'S LETTERS AND INBOX ARE WRITTEN FROM.
	 *
	 * <p>It also requires that something was read at all, so a folder that moved, or a walk
	 * that found no file, fails instead of passing over nothing.
	 */
	@Test
	void noValueInTheDictionariesCarriesASerbianOrCurlyQuote() throws IOException {
		List<String> files = new ArrayList<>();
		List<String> offenders = new ArrayList<>();
		int values = 0;

		for (String folder : List.of("mail", "notices")) {
			try (Stream<Path> found = Files.walk(RESOURCES.resolve(folder))) {
				for (Path file : found.filter(one -> one.toString().endsWith(".properties")).toList()) {
					Properties read = new Properties();

					try (Reader in = new InputStreamReader(Files.newInputStream(file),
							StandardCharsets.UTF_8)) {
						read.load(in);
					}

					files.add(file.toString());
					values += read.size();

					for (String key : read.stringPropertyNames()) {
						if (hasAMark(read.getProperty(key))) {
							offenders.add(file + " " + key);
						}
					}
				}
			}
		}

		assertThat(files).as("the dictionaries this case reads").hasSizeGreaterThanOrEqualTo(6);
		assertThat(values).as("so many values read, and a case that reads none measures nothing")
				.isGreaterThan(20);
		assertThat(offenders)
				.as("values a member reads with a quote the owner turned down on 18.10.2026")
				.isEmpty();
	}

	/**
	 * EVERY STRING THE COMPILER PUT INTO A CLASS OF THE PORTAL.
	 *
	 * <p>If a string that is not for a member ever has to carry one of these marks (a log line
	 * quoting the owner, say), it is named here with the reason it is not a member's text, and
	 * the filter is not widened. None does today.
	 */
	@Test
	void noStringInTheCompiledPortalCarriesASerbianOrCurlyQuote() throws IOException {
		List<Path> classes;

		try (Stream<Path> found = Files.walk(COMPILED.resolve("com").resolve("btl").resolve("portal"))) {
			classes = found.filter(one -> one.toString().endsWith(".class")).toList();
		}

		assertThat(classes).as("the compiled classes of the portal, as the build leaves them")
				.hasSizeGreaterThan(100);

		List<String> offenders = new ArrayList<>();

		for (Path one : classes) {
			for (String text : stringsIn(Files.readAllBytes(one))) {
				if (hasAMark(text)) {
					offenders.add(one.getFileName() + ": " + text);
				}
			}
		}

		assertThat(offenders)
				.as("strings in a class that a member can read, with a quote the owner turned down"
						+ " on 18.10.2026")
				.isEmpty();
	}

	/**
	 * THE READER READS WHAT IT IS SAID TO READ, ON A CLASS OF THE PORTAL ITSELF.
	 *
	 * <p>A sentence the portal writes to a member is found in the strings of the class that
	 * writes it. Without this the case above would pass for a reader that returned nothing.
	 */
	@Test
	void theReaderFindsTheSentencesTheClassesWrite() throws IOException {
		Path compiledClass = COMPILED.resolve("com/btl/portal/web/TeamJoiningWriteApi.class");

		assertThat(stringsIn(Files.readAllBytes(compiledClass)))
				.contains("Poziv u tim je ostao bez odgovora");
	}

	/**
	 * AND IT TELLS A MARK IN A STRING FROM A MARK IN A COMMENT, which is the line between a
	 * sentence a member reads and the owner quoted in a comment, and a mark in a sentence that is
	 * only built from pieces.
	 *
	 * <p>Four classes compiled from this very file, each with exactly one thing in it. The
	 * comment is the case the owner's own quotes in the portal's source make every day.
	 */
	@Test
	void aMarkInAStringIsFoundAndAMarkInACommentIsNot() throws IOException {
		assertThat(marksIn(NothingToFind.class)).as("a class with no mark at all").isEmpty();
		assertThat(marksIn(OnlyInAComment.class))
				.as("a mark in a comment is not in the compiled class").isEmpty();
		assertThat(marksIn(InAWholeSentence.class)).as("a mark in a sentence").hasSize(1);
		assertThat(marksIn(InTwoParts.class))
				.as("a mark in the first piece of a sentence built from two").hasSize(1);
		assertThat(marksIn(InTheLastPiece.class))
				.as("and in the last piece, which is the closing one a name is wrapped in")
				.hasSize(1);
	}

	private static boolean hasAMark(String text) {
		return text.chars().anyMatch(one -> THE_MARKS.indexOf(one) >= 0);
	}

	private static List<String> marksIn(Class<?> compiled) throws IOException {
		String path = "/" + compiled.getName().replace('.', '/') + ".class";

		try (InputStream in = TheQuotesAMemberReadsAreEnglishTest.class.getResourceAsStream(path)) {
			return stringsIn(in.readAllBytes()).stream().filter(TheQuotesAMemberReadsAreEnglishTest::hasAMark)
					.toList();
		}
	}

	/**
	 * EVERY UTF-8 ENTRY OF A CLASS'S CONSTANT POOL, which holds every string constant, every
	 * piece of a concatenation recipe, and also the names and descriptors (which carry no mark).
	 *
	 * <p>JVM specification 4.4: a pool is a count and then that many entries, each a one byte
	 * tag followed by a body whose size the tag fixes, except that a long and a double take two
	 * places. Only the tag 1 entries are text, and {@link DataInputStream#readUTF} reads them in
	 * the format a class file stores them in.
	 */
	private static List<String> stringsIn(byte[] classFile) throws IOException {
		List<String> strings = new ArrayList<>();

		try (DataInputStream in = new DataInputStream(new ByteArrayInputStream(classFile))) {
			in.skipNBytes(8);

			int count = in.readUnsignedShort();

			for (int place = 1; place < count; place++) {
				int tag = in.readUnsignedByte();

				switch (tag) {
					case 1 -> strings.add(in.readUTF());
					case 3, 4, 9, 10, 11, 12, 17, 18 -> in.skipNBytes(4);
					case 5, 6 -> {
						in.skipNBytes(8);
						place++;
					}
					case 7, 8, 16, 19, 20 -> in.skipNBytes(2);
					case 15 -> in.skipNBytes(3);
					default -> throw new IllegalStateException("a constant pool tag nobody knows: " + tag);
				}
			}
		}

		return strings;
	}

	/* ------------------------------------------------------------------------ the fixtures */

	static final class NothingToFind {
		static String say() {
			return "nothing here";
		}
	}

	static final class OnlyInAComment {
		/** The owner wrote \u201eNeka navodnici budu engleski\u201c, and this class is only a comment of it. */
		static String say() {
			// \u201e and \u201d and \u201c, in a comment
			return "nothing here either";
		}
	}

	static final class InAWholeSentence {
		static String say() {
			return "Tim \u201eSava\u201c nije prihvatio";
		}
	}

	static final class InTwoParts {
		static String say(String name) {
			return "Primljen si u tim \u201e" + name;
		}
	}

	static final class InTheLastPiece {
		static String say(String name) {
			return "Primljen si u tim " + name + "\u201d";
		}
	}
}
