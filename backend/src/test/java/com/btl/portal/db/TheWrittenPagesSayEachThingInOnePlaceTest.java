package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.postgresql.util.PSQLException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * WHAT V71 DOES TO THE THREE LEGAL PAGES, IN BOTH LANGUAGES: EACH THING SAID IN ONE PLACE, THE ARTICLES AND THE
 * SECTIONS NUMBERED FROM ONE, EVERY REFERENCE ON ITS NEW NUMBER, AND ALL THREE SIGNED OFF ON 22.10.2026.
 *
 * <p><b>Why this exists.</b> The owner approved, on 22.10.2026, a proposal that says each subject of the three
 * documents in one place (PDL, "Uprošćavanje pravnih tekstova (22.10.2026)"): "Izmeni sva dokumenta po predlogu, ali
 * dobro obrati pažnju da je sve lepo numerisano i da radi kako je predviđeno." {@code PageApiTest} holds the Serbian
 * answer against {@code pages.json} and {@code writtenPages.test.tsx} holds the Serbian references against the
 * headings they land on. Nothing else holds the English half, and nothing else holds that the English references land
 * on the same articles as the Serbian ones, which is where a renumbering of seventy references in two languages goes
 * wrong.
 *
 * <p><b>Three kinds of case.</b> The finished text: numbering, references and the places each subject is said in,
 * asked of every row with no {@code where} clause. The migration: run over the text it found
 * ({@link TheWrittenPagesBeforeV71}), it gives the finished text character for character, and run over anything else it
 * refuses with every edit listed. The floors: what V71 writes was written by no migration before it.
 */
class TheWrittenPagesSayEachThingInOnePlaceTest extends DatabaseTest {

	/** The migration this file is about. */
	private static final int THE_MIGRATION = 71;

	private static final String RULEBOOK = "pravilnik";
	private static final String TERMS = "uslovi-koriscenja";
	private static final String POLICY = "politika-privatnosti";

	@Autowired
	JdbcTemplate jdbc;

	/** A section by the page it belongs to and its place in it. */
	record Place(String slug, int position) {
	}

	/** One section's text in one language. */
	record Text(Place place, String heading, String body) {
	}

	private List<Text> textsIn(String language, String slug) {
		List<Text> texts = language.equals("sr")
				? db.sql("select p.slug, s.position, s.heading, s.body from static_page_section s"
								+ " join static_page p on p.id = s.page_id where p.slug like :slug order by p.slug, s.position")
						.param("slug", slug)
						.query((row, number) -> new Text(new Place(row.getString(1), row.getInt(2)), row.getString(3),
								row.getString(4)))
						.list()
				: db.sql("select p.slug, s.position, t.heading, t.body from static_page_section_translation t"
								+ " join static_page_section s on s.id = t.section_id"
								+ " join static_page p on p.id = s.page_id"
								+ " where t.language = :language and p.slug like :slug order by p.slug, s.position")
						.param("language", language).param("slug", slug)
						.query((row, number) -> new Text(new Place(row.getString(1), row.getInt(2)), row.getString(3),
								row.getString(4)))
						.list();

		assertThat(texts).as("there is no %s text of %s at all, so this case measures nothing", language, slug)
				.isNotEmpty();

		return texts;
	}

	private List<Place> placesWhichCarry(String language, String text) {
		return textsIn(language, "%").stream().filter(each -> each.body().contains(text)).map(Text::place).toList();
	}

	private static final Map<String, String> ARTICLE = Map.of("sr", "Član", "en", "Article");

	/** Every heading of an article of the rulebook, by its number. */
	private Map<Integer, String> articlesIn(String language) {
		Map<Integer, String> articles = new LinkedHashMap<>();
		Pattern heading = Pattern.compile("^### " + ARTICLE.get(language) + " (\\d+)\\. (.+)$", Pattern.MULTILINE);

		for (Text text : textsIn(language, RULEBOOK)) {
			Matcher each = heading.matcher(text.body());

			while (each.find()) {
				assertThat(articles.put(Integer.parseInt(each.group(1)), each.group(2)))
						.as("%s: article %s is headed twice", language, each.group(1)).isNull();
			}
		}

		return articles;
	}

	/** Every reference to an article of the rulebook, outside the headings, as "section: number", in order. */
	private List<String> referencesIn(String language) {
		/* Unicode classes, or \b does not see "Č" as a letter and the Serbian half finds nothing at all. */
		Pattern reference = Pattern.compile(language.equals("sr")
				? "\\b(?:Član|Člana|člana|član|Članu|članu|Članom|članom)\\s(\\d+)\\b"
				: "\\b(?:Article|article)\\s(\\d+)\\b", Pattern.UNICODE_CHARACTER_CLASS);
		List<String> found = new ArrayList<>();

		for (Text text : textsIn(language, "%")) {
			Matcher each = reference.matcher(text.body().replaceAll("(?m)^### .*$", ""));

			while (each.find()) {
				found.add(text.place().slug() + " #" + text.place().position() + ": " + each.group(1));
			}
		}

		return found;
	}

	@Test
	void theRulebookNumbersItsSixtyEightArticlesFromOneInBothLanguages() {
		for (String language : List.of("sr", "en")) {
			List<Integer> numbers = new ArrayList<>(articlesIn(language).keySet());

			assertThat(numbers).as("the %s articles are not numbered 1 to 68 in order", language)
					.isEqualTo(java.util.stream.IntStream.rangeClosed(1, 68).boxed().toList());
		}
	}

	/**
	 * THE ENGLISH REFERENCES LAND ON THE ARTICLES THE SERBIAN ONES LAND ON, section by section and in order, and each
	 * of them on an article that exists. {@code writtenPages.test.tsx} holds the Serbian ones to the heading they
	 * land on; this holds the English to the Serbian, which is the half nothing else reads.
	 */
	@Test
	void everyEnglishReferenceLandsOnTheArticleTheSerbianOneLandsOn() {
		List<String> serbian = referencesIn("sr");
		List<String> english = referencesIn("en");

		assertThat(serbian).as("the Serbian pages name no article at all, so this measures nothing").isNotEmpty();
		assertThat(english).as("the English references are not the Serbian ones").isEqualTo(serbian);

		Map<Integer, String> articles = articlesIn("sr");

		for (String one : serbian) {
			int number = Integer.parseInt(one.substring(one.lastIndexOf(' ') + 1));

			assertThat(articles).as("%s names an article the rulebook does not have", one).containsKey(number);
		}
	}

	@Test
	void theTermsHaveElevenSectionsNumberedFromOneAndNoneOnAwardsInBothLanguages() {
		for (String language : List.of("sr", "en")) {
			List<Text> terms = textsIn(language, TERMS);

			assertThat(terms.stream().map(each -> each.place().position()).toList())
					.as("%s: the terms do not stand at positions 1 to 11", language)
					.isEqualTo(java.util.stream.IntStream.rangeClosed(1, 11).boxed().toList());
			assertThat(terms.stream().map(each -> Integer.parseInt(each.heading().split("\\.")[0])).toList())
					.as("%s: the headings of the terms are not numbered as they stand", language)
					.isEqualTo(java.util.stream.IntStream.rangeClosed(1, 11).boxed().toList());
			assertThat(terms.stream().map(Text::heading).toList())
					.as("%s: the section on awards is back", language)
					.noneMatch(heading -> heading.contains("Nagrade") || heading.contains("Awards"));
		}
	}

	/**
	 * EACH SUBJECT IS SAID IN ITS ONE PLACE, which is the whole of what the owner approved. A phrase per subject, in
	 * each language, and the places it may stand in, read over every section of every page.
	 */
	@Test
	void eachSubjectIsSaidWhereItsHomeIsAndNowhereElse() {
		Object[][] homes = {
				{ "sr", "Obe granice se mere na dan popunjavanja prijave", List.of(new Place(TERMS, 2)) },
				{ "en", "Both thresholds are measured on the day the application is submitted", List.of(new Place(TERMS, 2)) },
				{ "sr", "mlađeg od 14 godina", List.of(new Place(POLICY, 2), new Place(POLICY, 3), new Place(TERMS, 2)) },
				{ "en", "younger than 14", List.of(new Place(POLICY, 2), new Place(POLICY, 3), new Place(TERMS, 2)) },
				{ "sr", "Neverifikovan rezultat", List.of(new Place(RULEBOOK, 10)) },
				{ "en", "An unverified result", List.of(new Place(RULEBOOK, 10)) },
				{ "sr", "u roku od 48 časova od prijave", List.of(new Place(RULEBOOK, 10)) },
				{ "en", "within 48 hours of submission", List.of(new Place(RULEBOOK, 10)) },
				{ "sr", "zajedno sa majicom sezone", List.of(new Place(RULEBOOK, 14)) },
				{ "en", "together with the season's T-shirt", List.of(new Place(RULEBOOK, 14)) },
				{ "sr", "Poštanske troškove", List.of(new Place(RULEBOOK, 14)) },
				{ "en", "Postal costs", List.of(new Place(RULEBOOK, 14)) },
				{ "sr", "Na raskid para se ne odnosi nijedan rok", List.of(new Place(RULEBOOK, 12)) },
				{ "en", "No deadline in this article applies to ending a pair", List.of(new Place(RULEBOOK, 12)) },
				{ "sr", "Liga je javno takmičenje", List.of(new Place(POLICY, 3)) },
				{ "en", "The league is a public competition", List.of(new Place(POLICY, 3)) },
				{ "sr", "taksa za obradu plaćanja od 3 EUR", List.of(new Place(RULEBOOK, 4)) },
				{ "en", "payment processing fee of 3 EUR", List.of(new Place(RULEBOOK, 4)) },
				{ "sr", "Odjava iz sezone ne znači i istupanje iz Udruženja.", List.of(new Place(TERMS, 11)) },
				{ "en", "Cancelling for a season does not mean leaving the Association.", List.of(new Place(TERMS, 11)) },
				/* What was said twice or three times and is now said nowhere: Article 9 and the terms' table. */
				{ "sr", "Trkački par nije vezan nijednim rokom", List.of() },
				{ "en", "A racing pair is bound by no deadline", List.of() },
				{ "sr", "Povlašćenih cena nema", List.of() },
				{ "en", "There are no discounted prices", List.of() },
				{ "sr", "Uplate se primaju od 15. oktobra", List.of() },
				{ "en", "Payments are accepted from 15 October", List.of() },
				{ "sr", "Ukratko: mere idu", List.of() },
				{ "en", "In short: measures range", List.of() },
				{ "sr", "podatke čuvamo pet godina", List.of() },
				{ "en", "we keep the data for five years", List.of() },
				/* And what the owner had struck on 29.10.2026 (PDL, "Urednička revizija Pravilnika, Uslova i Politike
				   privatnosti"): no text offers the exemption from the fee as an option any more, so the paragraph of
				   Article 11 that said the Managing Board may exempt a regular member is said nowhere. */
				{ "sr", "Upravni odbor sme odlukom da redovnog člana oslobodi", List.of() },
				{ "en", "The Managing Board may, by decision, exempt a regular member", List.of() } };

		for (Object[] home : homes) {
			@SuppressWarnings("unchecked")
			List<Place> places = (List<Place>) home[2];

			assertThat(placesWhichCarry((String) home[0], (String) home[1]))
					.as("%s: \"%s\"", home[0], home[1])
					.containsExactlyElementsOf(places);
		}
	}

	/** The sentences the owner approved word for word, each in its place, once, in both languages. */
	@Test
	void theApprovedSentencesStandOnceWhereTheyBelong() {
		Object[][] sentences = {
				{ "sr", new Place(RULEBOOK, 1), "- Pravilnik uređuje takmičenje i članarinu." },
				{ "en", new Place(RULEBOOK, 1), "- The Rulebook governs the competition and the membership fee." },
				{ "sr", new Place(RULEBOOK, 2), "Rezultate prethodne sezone možete da prijavite sami do 1. januara u 10:00." },
				{ "en", new Place(RULEBOOK, 2), "You can submit results from the previous season yourself until 1 January at 10:00." },
				{ "sr", new Place(RULEBOOK, 8), "Izbor za narednu sezonu možete da menjate koliko god puta želite, sve do 1. januara u 10:00, kada postaje konačan." },
				{ "en", new Place(RULEBOOK, 8), "You can change your choice for the next season as many times as you like, right up to 1 January at 10:00, when it becomes final." },
				/* „sasvim dovoljan" / „quite enough" went on 29.10.2026 with the other familiar phrases (owner, PDL
				   "Urednička revizija Pravilnika, Uslova i Politike privatnosti"); the sentence says the same thing. */
				{ "sr", new Place(RULEBOOK, 9), "Dovoljan je link ka zvaničnim rezultatima." },
				{ "en", new Place(RULEBOOK, 9), "A link to the official results is enough." },
				{ "sr", new Place(TERMS, 11), "Ako želite da istupite, postupak opisuje [Statut](/BTL%20Statut.pdf)." },
				{ "en", new Place(TERMS, 11), "If you wish to leave, the procedure is described in the [Statute](/BTL%20Statut.pdf)." },
				{ "sr", new Place(TERMS, 11), "Vi svoj profil i dalje vidite, a dukati i priznanja ostaju zabeleženi i vraćaju se sa vama kad ponovo obnovite status." },
				{ "en", new Place(TERMS, 11), "You can still see your own profile, and your ducats and honours stay on record and come back with you when you renew your status." },
				{ "sr", new Place(POLICY, 3), "bodovi, plasman i statistika, dukati i priznanja" },
				{ "en", new Place(POLICY, 3), "points, placing, and statistics, ducats and honours" },
				{ "sr", new Place(POLICY, 4), "Drugi je kolačić sesije, koji vas drži prijavljenim dok se ne odjavite, a najduže 30 dana od kada ste poslednji put koristili portal." },
				{ "en", new Place(POLICY, 4), "The second is the session cookie, which keeps you signed in until you sign out, and at most 30 days from the last time you used the portal." },
				{ "sr", new Place(POLICY, 2), "| Kolačić sesije | Bez njega prijava ne može da radi | Neophodno za pruženu uslugu | Do odjave, a najduže 30 dana od poslednjeg korišćenja portala |" },
				{ "en", new Place(POLICY, 2), "| Session cookie | Without it, signing in cannot work | Necessary for the service provided | Until sign-out, and at most 30 days from the last use of the portal |" } };

		for (Object[] sentence : sentences) {
			assertThat(placesWhichCarry((String) sentence[0], (String) sentence[2]))
					.as("%s: \"%s\"", sentence[0], sentence[2])
					.containsExactly((Place) sentence[1]);
			assertThat(textsIn((String) sentence[0], ((Place) sentence[1]).slug()).stream()
					.filter(each -> each.place().equals(sentence[1])).findFirst().orElseThrow().body())
					.containsOnlyOnce((String) sentence[2]);
		}
	}

	/**
	 * V71 signed all three off on 22.10.2026, V73 moved the policy's on to 24.10.2026, V76 the rulebook's on to
	 * 27.10.2026 (PDL, "Datum Poslednja izmena se pomera": the text of the document changed and not the others'), and V77
	 * (owner, 29.10.2026) changed the text of all three and so moved all three to 29.10.2026. So none of the earlier
	 * days stands anywhere now and 29.10.2026 stands once on each document. What V71 itself did is held by the cases
	 * below, which put the pages back to what V71 found.
	 */
	@Test
	void allThreeAreSignedOffOnTheTwentyNinthInBothLanguagesAndNoEarlierDayStands() {
		for (String[] signOff : new String[][] {
				{ "sr", "Poslednja izmena: 29.10.2026.", "Poslednja izmena: 22.10.2026.", "Poslednja izmena: 24.10.2026.",
						"Poslednja izmena: 27.10.2026." },
				{ "en", "Last amended: 29.10.2026.", "Last amended: 22.10.2026.", "Last amended: 24.10.2026.",
						"Last amended: 27.10.2026." } }) {
			assertThat(placesWhichCarry(signOff[0], signOff[1]))
					.as("%s: all three documents are signed off on 29.10.2026", signOff[0])
					.containsExactlyInAnyOrder(new Place(TERMS, 11), new Place(RULEBOOK, 19), new Place(POLICY, 7));

			for (int earlier = 2; earlier < signOff.length; earlier++) {
				assertThat(placesWhichCarry(signOff[0], signOff[earlier]))
						.as("%s: \"%s\" stands nowhere, V77 having moved every document on", signOff[0], signOff[earlier])
						.isEmpty();
			}
		}

		for (String gone : List.of("Poslednja izmena: 16.10.2026.", "Poslednja izmena: 10.10.2026.")) {
			assertThat(placesWhichCarry("sr", gone)).as("\"%s\" still stands", gone).isEmpty();
		}

		for (String gone : List.of("Last amended: 16.10.2026.", "Last amended: 10.10.2026.")) {
			assertThat(placesWhichCarry("en", gone)).as("\"%s\" still stands", gone).isEmpty();
		}
	}

	/** Every heading and body of both tables, by page, place and language, so two readings compare row by row. */
	private Map<String, String> everyText() {
		Map<String, String> texts = new LinkedHashMap<>();

		for (String language : List.of("sr", "en")) {
			for (Text text : textsIn(language, "%")) {
				String key = text.place().slug() + " #" + text.place().position() + " " + language;

				texts.put(key + " heading", text.heading());
				texts.put(key + " body", text.body());
			}
		}

		return texts;
	}

	/**
	 * V71 run over the text it found gives the text the portal serves, character for character, in every heading and
	 * every body of every page in both languages. This is also what holds {@link TheWrittenPagesBeforeV71}: a put
	 * back that missed one edit makes V71 refuse, or leaves a row that differs here.
	 */
	@Test
	void v71OverTheTextItFoundGivesTheTextThePortalServes() {
		Map<String, String> finished = everyText();

		TheWrittenPagesBeforeV71.putBack(db, migrationSql(String.valueOf(THE_MIGRATION)));

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);
		assertThat(before).as("the terms do not have the twelve sections V71 was written for")
				.containsKey("uslovi-koriscenja #12 sr body").containsKey("uslovi-koriscenja #12 en body");

		jdbc.execute(migrationSql(String.valueOf(THE_MIGRATION)));
		/* And V73 over what V71 gave, because the portal serves what V73 wrote on top of it (24.10.2026) and the text V71
		   found is the text before V73. */
		jdbc.execute(migrationSql("73"));
		/* And V76 over that, because the rulebook the portal serves carries it (27.10.2026). */
		jdbc.execute(migrationSql("76"));
		/* And V77 over that, because all three pages the portal serves carry it (29.10.2026). */
		jdbc.execute(migrationSql("77"));
		/* And V78 over that, because the ducats and the policy table the portal serves carry it (29.10.2026). */
		jdbc.execute(migrationSql("78"));

		assertThat(everyText()).as("V71, V73, V76, V77 and V78 over the text V71 found do not give the text the portal serves")
				.isEqualTo(finished);
	}

	private PSQLException v71RunAgain() {
		Throwable stopped = catchThrowable(() -> jdbc.execute(migrationSql(String.valueOf(THE_MIGRATION))));

		assertThat(stopped)
				.as("V71 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V71 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	private int editsOfV71() {
		return TheWrittenPagesBeforeV71.editsOf(migrationSql(String.valueOf(THE_MIGRATION))).size();
	}

	@Test
	void v71RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		int edits = editsOfV71();
		PSQLException error = v71RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("the written pages were not edited")
				.contains(edits + " of " + edits + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V71 does not report one line for every edit it makes")
				.hasSize(edits)
				.contains("rulebook date @ pravilnik #19 sr body: found 0 times",
						"terms 12 becomes 11 @ uslovi-koriscenja #12 en heading: there is no such text");
	}

	@Test
	void anOldTextThatStandsTwiceStopsV71() {
		TheWrittenPagesBeforeV71.putBack(db, migrationSql(String.valueOf(THE_MIGRATION)));
		db.sql("update static_page_section s set body = s.body || E'\\nPoslednja izmena: 16.10.2026.'"
						+ " from static_page p where p.id = s.page_id and p.slug = 'pravilnik' and s.position = 19")
				.update();

		PSQLException error = v71RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + editsOfV71() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("rulebook date @ pravilnik #19 sr body: found 2 times");
	}

	@Test
	void anOldTextThatIsNotThereStopsV71() {
		TheWrittenPagesBeforeV71.putBack(db, migrationSql(String.valueOf(THE_MIGRATION)));
		db.sql("update static_page_section_translation t set body = replace(t.body, 'Last amended: 10.10.2026.', 'gone')"
						+ " from static_page_section s, static_page p where s.id = t.section_id and p.id = s.page_id"
						+ " and p.slug = 'uslovi-koriscenja' and s.position = 12 and t.language = 'en'")
				.update();

		PSQLException error = v71RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + editsOfV71() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("terms date @ uslovi-koriscenja #12 en body: found 0 times");
	}

	@Test
	void aNewTextThatIsAlreadyThereStopsV71() {
		TheWrittenPagesBeforeV71.putBack(db, migrationSql(String.valueOf(THE_MIGRATION)));
		db.sql("update static_page_section s set body = s.body || ' bodovi, plasman i statistika, dukati i priznanja'"
						+ " from static_page p where p.id = s.page_id and p.slug = 'politika-privatnosti' and s.position = 3")
				.update();

		PSQLException error = v71RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + editsOfV71() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("policy 3, statistics @ politika-privatnosti #3 sr body: found once, and its new text is"
						+ " already there");
	}

	/** The section of the terms V71 removes is removed only if it is word for word the one V71 was written for. */
	@Test
	void aSectionOfTheTermsThatIsNotTheOneV71WasWrittenForIsNotRemoved() {
		TheWrittenPagesBeforeV71.putBack(db, migrationSql(String.valueOf(THE_MIGRATION)));
		db.sql("update static_page_section s set body = s.body || ' '"
						+ " from static_page p where p.id = s.page_id and p.slug = 'uslovi-koriscenja' and s.position = 8")
				.update();

		PSQLException error = v71RunAgain();

		assertThat(error.getServerErrorMessage().getMessage())
				.isEqualTo("section 8 of the terms of use was not removed: 0 rows matched, and exactly one was expected");
	}

	/** What V71 writes was written by no migration before it, so the sweeps above measure V71 and not its elders. */
	@Test
	void noMigrationBeforeV71WritesWhatV71Writes() {
		StringBuilder before = new StringBuilder();

		for (var applied : flyway.info().applied()) {
			if (applied.getVersion() != null && Integer.parseInt(applied.getVersion().getVersion()) < THE_MIGRATION) {
				before.append(migrationSql(applied.getVersion().getVersion()));
			}
		}

		assertThat(before).as("no migration before V71 was read, so this case measures nothing").isNotEmpty();

		for (String written : List.of("Odjava iz sezone ne znači i istupanje iz Udruženja.",
				"Cancelling for a season does not mean leaving the Association.",
				"Link ka zvaničnim rezultatima je sasvim dovoljan.", "A link to the official results is quite enough.",
				"### Član 68. Tumačenje", "### Article 68. Interpretation", "11. Odjava, brisanje, izmene i sporovi",
				"11. Cancellation, deletion, changes, and disputes", "najduže 30 dana od kada ste poslednji put",
				"at most 30 days from the last time you used the portal")) {
			assertThat(before.toString()).as("a migration before V71 already writes \"%s\"", written)
					.doesNotContain(written);
		}
	}
}
