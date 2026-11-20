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
 * <p>WHY THERE IS A LIST AT ALL, AND WHY IT HAS ITS OWN FLOOR. The texts that carry a past participle
 * after „ste" ( „ste potvrdili", „Upisani ste", „koju ste poslali") cannot be moved to „ti" by
 * changing the address alone: the participle has a gender, and neither the letters nor most of the
 * inbox know the reader's. The owner has been asked which of the ways out he wants; until he
 * answers, those texts stay as he approved them and stand here. The list is the SAME size as what
 * the scan finds, in both directions: a text that is moved to „ti" and left on the list fails the
 * floor (so the list shrinks and never outlives its reason), and a new text with a „vi" form that is
 * not on the list fails it too (so the list never grows by accident). The two PairWriteApi
 * sentences are on it for a different reason: {@code PairWriteApiTest} ties them sign for sign to
 * {@code pair.endedBody} and {@code pair.brokenBody} in {@code frontend/src/i18n/sr.json}, which
 * the screens' own move to „ti" rewrites.
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
					+ "|upišite|potvrdite|vodite|izaberete|slažete)(?![\\p{L}\\p{N}])");

	/** Texts whose participle after „ste" or whose pinned twin keeps them from moving yet. */
	private static final List<String> WAITING = List.of(
			"mail/sr.properties#confirmTheAddress.subject",
			"mail/sr.properties#confirmTheAddress.body",
			"mail/sr.properties#setANewPassword.body",
			"mail/sr.properties#invitedAsAModerator.subject",
			"mail/sr.properties#invitedAsAModerator.body",
			"mail/sr.properties#invitedAsAMember.subject",
			"mail/sr.properties#invitedAsAMember.body",
			"mail/welcome.properties#welcomeWithASlip.body",
			"mail/welcome.properties#welcomeWithPayPal.body",
			"mail/welcome.properties#welcomeFreedOfTheFee.subject",
			"mail/welcome.properties#welcomeFreedOfTheFee.body",
			"mail/welcome.properties#welcomePaidFromTheBalance.body",
			"mail/welcome.properties#welcomePaid.subject",
			"mail/welcome.properties#welcomePaid.body",
			"mail/welcome.properties#welcomeTheBalanceCovers.body",
			"notices/membership.properties#exemptionGranted.subject",
			"notices/membership.properties#exemptionGranted.body",
			"notices/membership.properties#beginnersCategoryClosed.subject",
			"notices/membership.properties#beginnersCategoryClosed.body",
			"notices/membership.properties#referralThanked.body",
			"notices/results.properties#resultEntered.subject",
			"notices/results.properties#resultEntered.body",
			"notices/results.properties#resultEnteredUnscored.subject",
			"notices/results.properties#resultEnteredUnscored.body",
			"notices/results.properties#resultChangedUnscored.subject",
			"notices/results.properties#resultChangedUnscored.body",
			"notices/results.properties#resultChanged.subject",
			"notices/results.properties#resultChanged.body",
			"notices/sr.properties#thePasswordHasChanged.subject",
			"notices/sr.properties#thePasswordHasChanged.body",
			"java/web/AwardingDucats.java :: , i njime ste osvojili ",
			"java/web/AwardingDucats.java :: Osvojili ste dukat",
			"java/web/AwardingDucats.java :: Liga vam je unela rezultat sa trke ",
			"java/web/AwardingDucats.java :: Odobren vam je rezultat sa trke ",
			"java/web/AwardingDucats.java :: Dukat stoji na vašem profilu.",
			"java/web/AwardingDucats.java :: Dukati stoje na vašem profilu.",
			"java/web/PairWriteApi.java ::  vaš trkački par za sezonu ",
			"java/web/PairWriteApi.java :: Vaš trkački par za sezonu ",
			"java/web/RaceWriteApi.java :: , pa su vaši bodovi sa nje preračunati. Time ste u zvaničnoj sezoni ",
			"java/web/RaceWriteApi.java ::  bodova, pa vam je početnička kategorija ",
			"java/web/RaceWriteApi.java :: Početnička kategorija vam je ponovo otvorena",
			"java/web/RaceWriteApi.java :: Početnička kategorija vam je zatvorena",
			"java/web/ResultsByTheLeagueApi.java :: . Time ste u zvaničnoj sezoni ",
			"java/web/ResultsByTheLeagueApi.java ::  bodova, pa vam je početnička kategorija ",
			"java/web/ResultsByTheLeagueApi.java :: Liga vam je ",
			"java/web/ResultsByTheLeagueApi.java :: Početnička kategorija vam je ponovo otvorena",
			"java/web/ResultsByTheLeagueApi.java :: Početnička kategorija vam je zatvorena",
			"java/web/VerificationWriteApi.java :: , jer ste rezultatom sa trke ",
			"java/web/VerificationWriteApi.java :: Superadmin je preuzeo stavku koju ste držali u redu za verifikaciju.",
			"java/web/VerificationWriteApi.java :: Početnička kategorija vam je zatvorena",
			"java/web/VerificationWriteApi.java :: Početnička kategorija vam je zatvorena za sezonu ",
			"java/web/VerificationWriteApi.java :: Stavka vam je oduzeta");

	@Test
	void everyTextWithAViFormIsOneOfTheOnesWaitingForTheOwnersAnswerAndEveryOneWaitingStillHasOne()
			throws IOException {
		List<String> found = new ArrayList<>();
		found.addAll(dictionaryTextsWithAViForm("mail"));
		found.addAll(dictionaryTextsWithAViForm("notices"));
		found.addAll(literalsWithAViForm());

		assertThat(found)
				.as("a text with a „vi" form that is not waiting, or one waiting that has moved to „ti"")
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
