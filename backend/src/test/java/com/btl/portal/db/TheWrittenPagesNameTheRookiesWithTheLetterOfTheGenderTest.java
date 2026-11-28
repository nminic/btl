package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE RULEBOOK NAMES THE ROOKIE CATEGORY IN ENGLISH WITH THE LETTER OF THE GENDER IN FRONT, AND ITS SIGN-OFF IS 14.11.2026
 * (V98, owner, 13.11.2026), IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists, and it is the other half of V98.</b> V98 makes one edit of Article 36 in English and moves one
 * sign-off in each language, with {@code replace()} calls. A replace is exact and has one failure mode, which is to match
 * NOTHING and report success; the migration itself refuses that, so what is held here is the other side: that what the
 * owner decided is what the portal serves, that the phrase it replaced stands nowhere on any of the three pages, that the
 * Serbian text was not taken along, and that the two names in the rulebook are the two names the tables carry.
 *
 * <p><b>Two homes of one fact.</b> The English names of the category are written in the dictionary the tables read
 * ({@code category.rookieMale} and {@code category.rookieFemale} of {@code frontend/src/i18n/en.json}) and in the text of
 * Article 36. Neither can say which is right, so the case below reads the dictionary and compares: a day the tables say
 * something else, the rulebook is the one that fails.
 *
 * <p><b>The day 14.11.2026 is the day expected</b> (see the head of V98). If the file reaches QA on another day, the day is
 * moved in the migration, in the table below and in every guard that holds it.
 */
class TheWrittenPagesNameTheRookiesWithTheLetterOfTheGenderTest extends DatabaseTest {

	/**
	 * V107 (21.11.2026) later changed the pronoun of the sentences this file asks about, and moved the sign-off of the three
	 * documents, so what is asked here is asked of the text as V106 left it. The text the portal serves now is held by
	 * {@link TheWrittenPagesSpeakToTheReaderAsTiTest}.
	 */
	@BeforeEach
	void theTextAsV106LeftIt() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "118");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "114");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "110");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "107");
	}

	static final String RULEBOOK = "pravilnik";

	/** Article 36 stands at this position of the rulebook (V71). */
	static final int ARTICLE_36 = 8;

	static final String THE_PHRASE_IN_ENGLISH = "the rookie category (M Rookies, F Rookies) or in your own age category";
	static final String THE_PHRASE_THAT_WAS = "the rookie category (Rookies) or in your own age category";

	/** What stands in Serbian beside it, which V98 leaves as it is: both words, no letter. */
	static final String THE_SERBIAN_PHRASE = "(Početnici, Početnice)";

	/** The bare name in brackets, which is the old text, by its shape: no letter in front. */
	static final Pattern THE_BARE_NAME_IN_BRACKETS = Pattern.compile("\\(Rookies\\)");

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

	@Test
	void articleThirtySixNamesBothRookieCategoriesWithTheLetterOfTheirGender() {
		assertThat(bodyOf(RULEBOOK, ARTICLE_36, "en"))
				.as("the English Article 36 must name the two categories with a letter in front")
				.containsOnlyOnce(THE_PHRASE_IN_ENGLISH)
				.doesNotContain(THE_PHRASE_THAT_WAS);
	}

	@Test
	void theSerbianArticleThirtySixIsNotTouched() {
		assertThat(bodyOf(RULEBOOK, ARTICLE_36, "sr"))
				.as("the Serbian text already names both words and has no letter in front: V98 does not touch it")
				.containsOnlyOnce(THE_SERBIAN_PHRASE);
	}

	/**
	 * THE TWO NAMES IN THE RULEBOOK ARE THE TWO NAMES THE TABLES CARRY: read out of the dictionary of the English screens,
	 * not typed again here. A source swapped for a constant of this file would pass the case above and none of this one.
	 */
	@Test
	void theTwoNamesInTheRulebookAreTheNamesTheEnglishTablesCarry() throws Exception {
		JsonNode category = new ObjectMapper().readTree(repositoryRoot().resolve("frontend/src/i18n/en.json")).path("category");
		String men = category.path("rookieMale").asString();
		String women = category.path("rookieFemale").asString();

		assertThat(men).as("the dictionary has no English name for the men's rookie category").isNotBlank();
		assertThat(women).as("the dictionary has no English name for the women's rookie category").isNotBlank();
		assertThat(bodyOf(RULEBOOK, ARTICLE_36, "en"))
				.as("Article 36 does not say the names the tables say")
				.containsOnlyOnce("(" + men + ", " + women + ")");
	}

	/** NO SECTION OF THE THREE PAGES STILL NAMES THE CATEGORY AS A BARE NAME IN BRACKETS, in English. */
	@Test
	void noEnglishSectionOfTheThreePagesStillHoldsTheBareName() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en", THE_BARE_NAME_IN_BRACKETS))
				.as("an English section still names the rookie category without the letter of the gender")
				.isEmpty();
	}

	/** THE NEW PHRASE STANDS IN ARTICLE 36 OF THE RULEBOOK AND NOWHERE ELSE: a second home for it would be said twice. */
	@Test
	void theNewPhraseStandsInArticleThirtySixAndNowhereElse() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				Pattern.compile(Pattern.quote(THE_PHRASE_IN_ENGLISH))))
				.containsExactly(RULEBOOK + " #" + ARTICLE_36);
	}

	@Test
	void theTableNamesEveryEditV98Makes() {
		assertThat(migrationSql("98").split("\\$old\\$", -1).length - 1)
				.as("V98 carries an edit that this file does not name (or this file names one V98 lacks): one phrase and two sign-offs,"
						+ " each written between two $old$ marks")
				.isEqualTo(3 * 2);
	}

	/**
	 * ONLY THE RULEBOOK IS SIGNED WITH THE NEW DAY: its sign-off stands once as the last line, in both languages, the other
	 * two documents keep the day of their own last change, and the day V96 gave the rulebook stands on it nowhere.
	 */
	@Test
	void theRulebookIsSignedOffOnTheFifteenthOfNovemberAndTheOtherTwoKeepTheirDays() {
		for (String language : List.of("sr", "en")) {
			boolean serbian = language.equals("sr");
			String mark = serbian ? "Poslednja izmena: " : "Last amended: ";

			assertThat(bodyOf(RULEBOOK, 19, language)).as("the %s rulebook ends with its sign-off", language)
					.endsWith(mark + "15.11.2026.")
					.containsOnlyOnce(mark).doesNotContain("14.11.2026").doesNotContain("12.11.2026").doesNotContain("11.11.2026");
			assertThat(bodyOf("politika-privatnosti", 7, language)).as("the %s policy reads the day V102 gave it", language)
					.endsWith(mark + "16.11.2026.");
			assertThat(bodyOf("uslovi-koriscenja", 11, language)).as("the %s terms keep their day", language)
					.endsWith(mark + "11.11.2026.");
		}
	}
}
