package com.btl.portal.domain.mail;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

/**
 * THE PORTAL ADDRESSES ITS MEMBER WITH „TI", AND THE LETTERS AND THE INBOX ARE NO EXCEPTION.
 *
 * <p>Owner, 21.11.2026: „I mejlovi na „ti”" (PDL, „Na sajtu se ne persira"). This floor reads every
 * Serbian text the server says to a member, where it is written: the dictionaries under
 * {@code mail/} and {@code notices/} (every file that is not English), and every string literal in
 * {@code src/main/java}. A word of the second person plural (vaš, vam, ste, možete ...) in any of
 * them fails here, unless the text is one of the {@link #WAITING} below.
 *
 * <p>WHY THERE IS A LIST AT ALL, AND WHY IT HAS ITS OWN FLOOR. The texts that wait stand on {@link #WAITING}
 * with the reason. The list is the SAME size as what the scan finds, in both directions: a text that
 * is moved to „ti" and left on the list fails the floor (so the list shrinks and never outlives its
 * reason), and a new text with a „vi" form that is not on the list fails it too (so the list never
 * grows by accident).
 *
 * <p>THE WORD LIST IS MEASURED, NOT GUESSED. Over the whole of {@code src/main/java} string
 * literals and the non-English dictionaries it finds only the texts below, and every one of them is a
 * real „vi" form: no word on it is also an ordinary word of another meaning in the text the server
 * says. Reading literals and not source text keeps the comments, which quote the owner's old
 * sentences on purpose, out of it.
 */
class NoMessageAddressesAMemberAsViTest {

	private static final Path MAIN = Path.of("src", "main");

	private static final Pattern A_VI_FORM = Pattern.compile(
			"(?iu)(?<![\\p{L}\\p{N}])(vaš|vaša|vaše|vašu|vašeg|vašem|vašoj|vašim|vaši|vašom|vas|vam|vi|ste|niste"
					+ "|možete|imate|želite|javite|otvorite|postavite|zatražite|pišite|pošaljite|zanemarite"
					+ "|upišite|potvrdite|vodite|izaberete|slažete|dobijate|nemate|uplatite|aktivirajte"
					+ "|potvrđujete|uplaćujete|registrujete|kliknite|prijavite|odjavite|proverite|pročitajte"
					+ "|sačuvajte|nastavite|pokušajte|kontaktirajte|obnovite|platite|popunite)(?![\\p{L}\\p{N}])");

	/**
	 * THE TEXTS THAT STILL WAIT, and each for a reason that is not the participle (the participle is
	 * solved: the words go by the sex of who reads, {@link Gender}). Four flows go to an account that
	 * may name no member, a moderator who does not race (V23), who has no sex anywhere in the portal:
	 * the invitation of a moderator, the link to set a new password, the notice that it was changed, and
	 * the confirmation of the address he is sent while he has not yet spent his invitation (that one is
	 * written to him in the words it always had, {@code mail/sr-no-member}).
	 * What those say to him is the owner's question, asked on 21.11.2026 and not answered here. The two
	 * {@code PairWriteApi} sentences are tied sign for sign to {@code pair.endedBody} and
	 * {@code pair.brokenBody} in {@code frontend/src/i18n/sr.json}, which the move of the screens to
	 * „ti" rewrites, and they move with it.
	 */
	private static final List<String> WAITING = List.of(
			"mail/sr-no-member.properties#confirmTheAddress.subject",
			"mail/sr-no-member.properties#confirmTheAddress.body",
			"mail/sr.properties#setANewPassword.body",
			"mail/sr.properties#invitedAsAModerator.subject",
			"mail/sr.properties#invitedAsAModerator.body",
			"notices/sr.properties#thePasswordHasChanged.subject",
			"notices/sr.properties#thePasswordHasChanged.body");

	@Test
	void everyTextWithAViFormIsOneOfTheOnesWaitingForTheOwnersAnswerAndEveryOneWaitingStillHasOne()
			throws IOException {
		List<String> found = new ArrayList<>();
		found.addAll(dictionaryTextsWithAViForm("mail"));
		found.addAll(dictionaryTextsWithAViForm("notices"));
		found.addAll(literalsWithAViForm());

		assertThat(found)
				.as("a text with a vi form that is not waiting, or one waiting that has moved to ti")
				.containsExactlyInAnyOrderElementsOf(WAITING);
		assertThat(new TreeSet<>(WAITING)).as("the waiting list names nothing twice").hasSameSizeAs(WAITING);
	}

	@Test
	void theScannerSeesTheViFormsItIsMeantToAndNotTheTiOnes() {
		for (String vi : List.of("Vaš nalog", "Otvoren vam je", "Član ste lige", "Ako ne želite", "Pišite nam",
				"niste tražili", "javite se")) {
			assertThat(A_VI_FORM.matcher(vi).find()).as(vi).isTrue();
		}
		for (String ti : List.of("Tvoj nalog", "Otvoren ti je", "Član si lige", "Ako ne želiš", "Piši nam",
				"nisi tražio", "javi se", "Vaso", "Zaviste", "viši", "ostaje")) {
			assertThat(A_VI_FORM.matcher(ti).find()).as(ti).isFalse();
		}
	}

	private static List<String> dictionaryTextsWithAViForm(String folder) throws IOException {
		List<String> out = new ArrayList<>();
		try (Stream<Path> files = Files.list(MAIN.resolve("resources").resolve(folder))) {
			for (Path file : files.filter(f -> f.getFileName().toString().endsWith(".properties"))
					.filter(f -> !f.getFileName().toString().endsWith("en.properties")).sorted().toList()) {
				Properties words = new Properties();
				try (Reader in = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
					words.load(in);
				}
				for (String key : words.stringPropertyNames()) {
					if (A_VI_FORM.matcher(words.getProperty(key)).find()) {
						out.add(folder + "/" + file.getFileName() + "#" + key);
					}
				}
			}
		}
		return out;
	}

	private static List<String> literalsWithAViForm() throws IOException {
		List<String> out = new ArrayList<>();
		Path java = MAIN.resolve("java").resolve("com").resolve("btl").resolve("portal");
		try (Stream<Path> files = Files.walk(java)) {
			for (Path file : files.filter(f -> f.toString().endsWith(".java")).sorted().toList()) {
				String shown = "java/" + java.relativize(file).toString().replace('\\', '/');
				for (String literal : literalsOf(Files.readString(file, StandardCharsets.UTF_8))) {
					if (A_VI_FORM.matcher(literal).find()) {
						out.add(shown + " :: " + literal);
					}
				}
			}
		}
		return out;
	}

	/** The string literals of a source, with comments and character literals left out. */
	static List<String> literalsOf(String source) {
		List<String> out = new ArrayList<>();
		int i = 0;
		int n = source.length();
		while (i < n) {
			if (source.startsWith("//", i)) {
				int end = source.indexOf('\n', i);
				i = end < 0 ? n : end;
			} else if (source.startsWith("/*", i)) {
				int end = source.indexOf("*/", i + 2);
				i = end < 0 ? n : end + 2;
			} else if (source.charAt(i) == '"' || source.charAt(i) == '\'') {
				char quote = source.charAt(i);
				int j = i + 1;
				while (j < n && source.charAt(j) != quote) {
					j += source.charAt(j) == '\\' ? 2 : 1;
				}
				if (quote == '"') {
					out.add(source.substring(i + 1, Math.min(j, n)));
				}
				i = j + 1;
			} else {
				i++;
			}
		}
		return out;
	}

	@Test
	void theScannerReadsStringsAndNotCommentsOrCharacters() {
		assertThat(literalsOf("a = \"vam\"; // vam \"ste\"\n/* \"vas\" */ char c = '\"'; b = \"x\\\"y\";"))
				.containsExactly("vam", "x\\\"y");
	}
}
