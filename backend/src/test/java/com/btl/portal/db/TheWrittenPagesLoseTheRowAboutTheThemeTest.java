package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PRIVACY POLICY HAS NO ROW ABOUT THE CHOICE OF THEME IN SECTION 2, IN EITHER LANGUAGE (V110, owner, 24.11.2026, PDL
 * „Tema": „Red o izboru teme (`btl-theme`, lokalno skladište) se briše iz Politike privatnosti, srpske i engleske, bez
 * ikakvog novog teksta."), AND THE POLICY, AND ONLY THE POLICY, IS SIGNED OFF ON 24.11.2026.
 *
 * <p><b>What is held here, and what is held elsewhere.</b> The words of the policy that remain are held by
 * {@code PageApiTest}, which compares the Serbian answer of this server with {@code frontend/src/test/mock/pages.json}, and by
 * {@code writtenVerification.test.ts}, which holds that fixture to {@code writtenPages.snapshot.json}. What those cannot say is
 * that the row is gone from the English table too, and that the rows beside it are still there word for word; that is what is
 * asked here. What V110 does to a text that is already there is asked by {@link TheWrittenPagesLoseTheRowAboutTheThemeCarriedOverTest}.
 *
 * <p><b>SECTION 4 TOO</b> (owner, 24.11.2026, PDL, anchor „Briše se i rečenica o temi u odeljku 4”): the paragraph that said the
 * theme is kept is gone in both languages, with no new word, and the paragraph after it and the one before it are what they were.
 */
class TheWrittenPagesLoseTheRowAboutTheThemeTest extends DatabaseTest {

	static final String POLICY = "politika-privatnosti";
	static final String TERMS = "uslovi-koriscenja";
	static final String RULEBOOK = "pravilnik";
	static final String PRESIDENT = "rec-predsednika";

	/** The table of section 2 that held the row: „Podaci koji nastaju samim posećivanjem". */
	static final int THE_TABLE_OF_DATA = 2;

	static final String THE_ROW_IN_SERBIAN =
			"| Izbor svetle ili tamne teme (`btl-theme`, lokalno skladište) | Da te portal otvori u temi koju izabereš | Neophodno za pruženu uslugu, jer ga izabereš | Dok ga ne obrišeš |";
	static final String THE_ROW_IN_ENGLISH =
			"| Choice of light or dark theme (`btl-theme`, local storage) | So the portal opens in the theme you chose | Necessary for the service provided, since you choose it yourself | Until you delete it yourself |";

	/** The rows that stood under it and stand now where it stood, word for word. */
	static final List<String> THE_ROWS_THAT_STAY_IN_SERBIAN = List.of(
			"| Bezbednosni kolačić | Bez njega slanje obrasca ne može bezbedno da radi | Neophodno za pruženu uslugu | Do kraja posete |",
			"| Kolačić sesije | Bez njega prijava ne može da radi | Neophodno za pruženu uslugu | Do odjave, a najduže 30 dana od poslednjeg korišćenja portala |",
			"| Zapisi servera | Bezbednost i otkrivanje zloupotreba | Legitimni interes | 30 dana |");
	static final List<String> THE_ROWS_THAT_STAY_IN_ENGLISH = List.of(
			"| Security cookie | Without it, submitting a form cannot work safely | Necessary for the service provided | Until the end of the visit |",
			"| Session cookie | Without it, signing in cannot work | Necessary for the service provided | Until sign-out, and at most 30 days from the last use of the portal |",
			"| Server logs | Security and detecting abuse | Legitimate interest | 30 days |");

	private String bodyOf(String slug, int position, String language) {
		return language.equals("sr")
				? db.sql("select s.body from static_page_section s join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position")
						.param("slug", slug).param("position", position).query(String.class).single()
				: db.sql("select t.body from static_page_section_translation t"
								+ " join static_page_section s on s.id = t.section_id join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position and t.language = :language")
						.param("slug", slug).param("position", position).param("language", language)
						.query(String.class).single();
	}

	/** THE ROW IS GONE FROM THE TABLE IN BOTH LANGUAGES, and so is its name, which no other row of the section carries. */
	@Test
	void theRowAboutTheChoiceOfThemeIsNotInTheTableInEitherLanguage() {
		String serbian = bodyOf(POLICY, THE_TABLE_OF_DATA, "sr");
		String english = bodyOf(POLICY, THE_TABLE_OF_DATA, "en");

		assertThat(serbian).doesNotContain(THE_ROW_IN_SERBIAN).doesNotContain("Izbor svetle ili tamne teme").doesNotContain("btl-theme");
		assertThat(english).doesNotContain(THE_ROW_IN_ENGLISH).doesNotContain("Choice of light or dark theme").doesNotContain("btl-theme");
	}

	static final String THE_PARAGRAPH_IN_SERBIAN =
			"Pored kolačića, u tvom pregledaču se čuva i još nešto: izbor svetle ili tamne teme, pod imenom `btl-theme`, u lokalnom skladištu. Postavlja se tek kad temu izabereš. Za njega se pristanak ne traži, jer je to podešavanje prikaza koje zatražiš. Brišeš ga brisanjem podataka sajta u pregledaču, a portal će te onda otvoriti u tamnoj temi, koja je podrazumevana.";
	static final String THE_PARAGRAPH_IN_ENGLISH =
			"Besides the cookies, something else is kept in your browser: the choice of light or dark theme, under the name `btl-theme`, in local storage. It is set only once you choose a theme yourself. No consent is asked for it, because it is a display setting you requested yourself. You delete it by clearing the site's data in your browser, and the portal will then open you in the dark theme, which is the default.";
	static final String WHAT_FOLLOWS_IN_SERBIAN = "Drugog skladišta, niti analitike, nema.";
	static final String WHAT_FOLLOWS_IN_ENGLISH = "There is no other storage, nor analytics.";

	/**
	 * THE PARAGRAPH ABOUT THE THEME IS NOT IN SECTION 4 IN EITHER LANGUAGE, and nothing about the store is said anywhere in the policy
	 * any more. The paragraphs around it are word for word what they were: the one before it still ends the cookies, the one after it
	 * still opens with the sentence about other storage, and the section is three paragraphs and not four.
	 */
	@Test
	void theParagraphAboutTheThemeIsNotInSectionFourAndNoWordOfItIsLeftAnywhere() {
		for (String language : List.of("sr", "en")) {
			String body = bodyOf(POLICY, 4, language);
			String paragraph = language.equals("sr") ? THE_PARAGRAPH_IN_SERBIAN : THE_PARAGRAPH_IN_ENGLISH;
			String follows = language.equals("sr") ? WHAT_FOLLOWS_IN_SERBIAN : WHAT_FOLLOWS_IN_ENGLISH;

			assertThat(body).as("section 4 in %s", language).doesNotContain(paragraph).doesNotContain("btl-theme")
					.containsOnlyOnce(follows);
			assertThat(body.split("\n\n")).as("the paragraphs of section 4 in %s", language).hasSize(3);
			assertThat(body.split("\n\n")[1]).as("the paragraph that now follows the cookies in %s", language).isEqualTo(follows);

			for (int position = 1; position <= 7; position++) {
				assertThat(bodyOf(POLICY, position, language)).as("section %s in %s", position, language).doesNotContain("btl-theme");
			}
		}
	}

	/**
	 * THE ROWS BESIDE IT ARE WHAT THEY WERE, word for word, each once, and the table is whole: the heading of its part, the head
	 * of its columns and every row after the one that went. A row that went with it, or a word of a neighbour that changed with
	 * it, is a failure that names the row.
	 */
	@Test
	void theRowsBesideItAreStillThereWordForWord() {
		String serbian = bodyOf(POLICY, THE_TABLE_OF_DATA, "sr");
		String english = bodyOf(POLICY, THE_TABLE_OF_DATA, "en");

		assertThat(serbian).containsOnlyOnce("### Podaci koji nastaju samim posećivanjem");
		assertThat(english).containsOnlyOnce("### Data generated simply by visiting");

		for (String row : THE_ROWS_THAT_STAY_IN_SERBIAN) {
			assertThat(serbian).as("the Serbian row %s", row).containsOnlyOnce(row);
		}

		for (String row : THE_ROWS_THAT_STAY_IN_ENGLISH) {
			assertThat(english).as("the English row %s", row).containsOnlyOnce(row);
		}

		/* The part that held it is a table of three rows now and starts right under its head. */
		String part = serbian.substring(serbian.indexOf("### Podaci koji nastaju samim posećivanjem"));
		List<String> rows = part.lines().filter(line -> line.startsWith("| ") && !line.startsWith("| Podatak")).toList();

		assertThat(rows).as("the table of what a visit creates has not the rows it should").hasSize(3);
	}

	/**
	 * THE POLICY IS SIGNED OFF ON THE DAY V110 GIVES IT, in both languages and once, and the terms and the rulebook keep the day
	 * V107 gave them; the president's word carries no sign-off, and still carries none.
	 */
	@Test
	void thePolicyAloneIsSignedOffOnTheTwentyFourthOfNovemberInBothLanguages() {
		assertThat(bodyOf(POLICY, 7, "sr")).endsWith("Poslednja izmena: 24.11.2026.").containsOnlyOnce("Poslednja izmena: ")
				.doesNotContain("21.11.2026");
		assertThat(bodyOf(POLICY, 7, "en")).endsWith("Last amended: 24.11.2026.").containsOnlyOnce("Last amended: ")
				.doesNotContain("21.11.2026");

		for (String language : List.of("sr", "en")) {
			String signed = language.equals("sr") ? "Poslednja izmena: 21.11.2026." : "Last amended: 21.11.2026.";

			assertThat(bodyOf(TERMS, 11, language)).as("the terms in %s", language).endsWith(signed);
			assertThat(bodyOf(RULEBOOK, 19, language)).as("the rulebook in %s", language).endsWith(signed);
		}

		assertThat(bodyOf(PRESIDENT, 1, "sr")).doesNotContain("Poslednja izmena");
	}

	/**
	 * V110 TOUCHES NOTHING ELSE, asked as behaviour: with V110 undone, every heading and body of both tables is what it is with it
	 * applied, except the three sections of the policy it edits, in both languages, and those differ only by the row, the paragraph and the day.
	 */
	@Test
	void everyOtherTextIsTheSameWithV110UndoneAsWithItApplied() {
		Map<String, String> applied = everyTextByPlace();

		TheWrittenPagesBeforeV71.undoBodyEdits(db, "110");

		Map<String, String> undone = everyTextByPlace();

		assertThat(undone).as("undoing V110 changed nothing, so this measures nothing").isNotEqualTo(applied);
		assertThat(undone.keySet()).isEqualTo(applied.keySet());

		List<String> changed = applied.keySet().stream().filter(key -> !applied.get(key).equals(undone.get(key))).toList();

		assertThat(changed).containsExactlyInAnyOrder(POLICY + " #2 sr", POLICY + " #2 en", POLICY + " #4 sr", POLICY + " #4 en",
				POLICY + " #7 sr", POLICY + " #7 en");

		assertThat(undone.get(POLICY + " #4 sr")).contains(THE_PARAGRAPH_IN_SERBIAN)
				.isEqualTo(applied.get(POLICY + " #4 sr").replace(WHAT_FOLLOWS_IN_SERBIAN,
						THE_PARAGRAPH_IN_SERBIAN + "\n\n" + WHAT_FOLLOWS_IN_SERBIAN));
		assertThat(undone.get(POLICY + " #4 en")).contains(THE_PARAGRAPH_IN_ENGLISH)
				.isEqualTo(applied.get(POLICY + " #4 en").replace(WHAT_FOLLOWS_IN_ENGLISH,
						THE_PARAGRAPH_IN_ENGLISH + "\n\n" + WHAT_FOLLOWS_IN_ENGLISH));

		assertThat(undone.get(POLICY + " #2 sr")).contains(THE_ROW_IN_SERBIAN)
				.isEqualTo(applied.get(POLICY + " #2 sr").replace(THE_ROWS_THAT_STAY_IN_SERBIAN.get(0),
						THE_ROW_IN_SERBIAN + "\n" + THE_ROWS_THAT_STAY_IN_SERBIAN.get(0)));
		assertThat(undone.get(POLICY + " #2 en")).contains(THE_ROW_IN_ENGLISH)
				.isEqualTo(applied.get(POLICY + " #2 en").replace(THE_ROWS_THAT_STAY_IN_ENGLISH.get(0),
						THE_ROW_IN_ENGLISH + "\n" + THE_ROWS_THAT_STAY_IN_ENGLISH.get(0)));
		assertThat(undone.get(POLICY + " #7 sr")).endsWith("Poslednja izmena: 21.11.2026.");
		assertThat(undone.get(POLICY + " #7 en")).endsWith("Last amended: 21.11.2026.");
	}

	/** Every heading and body of both tables, by page, place and language, so two readings compare row by row. */
	private Map<String, String> everyTextByPlace() {
		Map<String, String> texts = new TreeMap<>();

		db.sql("select p.slug || ' #' || s.position || ' sr' as key, s.heading || E'\\n' || s.body from static_page_section s"
						+ " join static_page p on p.id = s.page_id")
				.query((row, number) -> Map.entry(row.getString(1), row.getString(2)))
				.list().forEach(each -> texts.put(each.getKey(), each.getValue()));
		db.sql("select p.slug || ' #' || s.position || ' ' || t.language, t.heading || E'\\n' || t.body"
						+ " from static_page_section_translation t join static_page_section s on s.id = t.section_id"
						+ " join static_page p on p.id = s.page_id")
				.query((row, number) -> Map.entry(row.getString(1), row.getString(2)))
				.list().forEach(each -> texts.put(each.getKey(), each.getValue()));

		assertThat(texts).as("there is no page text at all, so this case measures nothing").isNotEmpty();

		return texts;
	}
}
