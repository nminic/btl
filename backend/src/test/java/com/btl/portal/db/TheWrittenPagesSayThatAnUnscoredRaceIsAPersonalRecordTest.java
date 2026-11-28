package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ARTICLE 15 OF THE RULEBOOK SAYS THAT AN UNSCORED RACE IS KEPT ON THE PORTAL AS A PERSONAL RECORD AND DOES NOT COUNT
 * (V100, owner, 14.11.2026, "drugi krug pitanja o planu", item 7), IN BOTH LANGUAGES, AND THE RULEBOOK STILL READS THE DAY
 * V98 GAVE IT.
 *
 * <p><b>Why this exists, and it is the other half of V100.</b> V100 adds one line to Article 15 in each language with
 * {@code replace()} calls. A replace is exact and has one failure mode, which is to match NOTHING and report success; the
 * migration itself refuses that, so what is held here is the other side: that the sentence the owner decided is what the
 * portal serves in Serbian, word for word, that it is the LAST item of the article it belongs to and not a line of the
 * article before or after, that it stands once on the three pages and nowhere else, and that the day of the rulebook was not
 * moved by a migration that has no new day to give.
 *
 * <p><b>The English is the assistant's translation</b> and not the owner's wording, and the constant below says so.
 *
 * <p><b>The sign-off is held and not edited.</b> 14.11.2026 is both the day V98 gave the rulebook and the day V100 is expected
 * on QA (see the head of V100), so V100 moves nothing. A guard that only asked "does it read 14.11.2026" would pass whether V100
 * moved it or not, which is why the case below also reads V100 itself for an edit of a sign-off. If V100 reaches QA on a later
 * day, the day is moved in V100, in the case below and in every guard that holds it.
 */
class TheWrittenPagesSayThatAnUnscoredRaceIsAPersonalRecordTest extends DatabaseTest {

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

	/** Articles 14 to 21 of the rulebook stand in this section (V71 renumbered them from 18 to 25). */
	static final int ARTICLES_14_TO_21 = 5;

	/** The owner's sentence (PDL 14.11.2026), word for word. */
	static final String THE_SENTENCE_IN_SERBIAN =
			"Nebodovane trke (plivanje, biciklizam, duatlon, triatlon, akvatlon i slično) vode se na portalu samo kao lična evidencija i ne boduju se.";

	/** The assistant's translation, not the owner's wording. */
	static final String THE_SENTENCE_IN_ENGLISH =
			"Unscored races (swimming, cycling, duathlon, triathlon, aquathlon and the like) are kept on the portal as a personal record only and do not count toward points.";

	static final String THE_LAST_ITEM_THAT_WAS_IN_SERBIAN = "- Planinarske akcije bez zvaničnog merenja vremena.";
	static final String THE_LAST_ITEM_THAT_WAS_IN_ENGLISH = "- Hiking outings with no official timing.";

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

	/** The part of section 5 that is Article 15 and no other article: from its heading to the heading of the next one. */
	private String articleFifteen(String language) {
		String body = bodyOf(RULEBOOK, ARTICLES_14_TO_21, language);
		String heading = language.equals("sr") ? "### Član 15. Šta se ne boduje" : "### Article 15. What does not count toward points";
		String next = language.equals("sr") ? "### Član 16." : "### Article 16.";

		assertThat(body).as("%s section 5 has no Article 15 heading", language).containsOnlyOnce(heading).containsOnlyOnce(next);

		return body.substring(body.indexOf(heading), body.indexOf(next));
	}

	@Test
	void theSerbianSentenceIsTheOwnersWordForWordAndTheLastItemOfArticleFifteen() {
		assertThat(articleFifteen("sr").stripTrailing())
				.as("the Serbian Article 15 must end with the owner's sentence as its last item")
				.endsWith(THE_LAST_ITEM_THAT_WAS_IN_SERBIAN + "\n- " + THE_SENTENCE_IN_SERBIAN)
				.containsOnlyOnce(THE_SENTENCE_IN_SERBIAN);
	}

	@Test
	void theEnglishSentenceIsTheTranslationAndTheLastItemOfArticleFifteen() {
		assertThat(articleFifteen("en").stripTrailing())
				.as("the English Article 15 must end with the translation as its last item")
				.endsWith(THE_LAST_ITEM_THAT_WAS_IN_ENGLISH + "\n- " + THE_SENTENCE_IN_ENGLISH)
				.containsOnlyOnce(THE_SENTENCE_IN_ENGLISH);
	}

	/** THE SENTENCE STANDS IN ARTICLE 15 OF THE RULEBOOK AND NOWHERE ELSE, in either language: a second home would say it twice. */
	@Test
	void theSentenceStandsOnceOnTheThreePagesInEachLanguage() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				Pattern.compile(Pattern.quote(THE_SENTENCE_IN_SERBIAN))))
				.containsExactly(RULEBOOK + " #" + ARTICLES_14_TO_21);
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				Pattern.compile(Pattern.quote(THE_SENTENCE_IN_ENGLISH))))
				.containsExactly(RULEBOOK + " #" + ARTICLES_14_TO_21);
	}

	/** THE OTHER ITEMS OF ARTICLE 15 ARE NOT TOUCHED: the four it had stand in their order, and the new one is the fifth. */
	@Test
	void theFourItemsItHadStandInTheirOrderAndTheNewOneIsTheFifth() {
		for (String language : List.of("sr", "en")) {
			List<String> items = articleFifteen(language).lines().filter(line -> line.startsWith("- ")).toList();

			assertThat(items).as("the %s Article 15 is not a list of five", language).hasSize(5);
			assertThat(items.get(4)).as("the %s new item is not the last", language)
					.isEqualTo("- " + (language.equals("sr") ? THE_SENTENCE_IN_SERBIAN : THE_SENTENCE_IN_ENGLISH));
			assertThat(items.get(0)).as("the %s first item moved", language)
					.isEqualTo(language.equals("sr") ? "- Trkački segment triatlona i duatlona." : "- The running segment of a triathlon or duathlon.");
		}
	}

	@Test
	void theTableNamesEveryEditV100Makes() {
		assertThat(migrationSql("100").split("\\$old\\$", -1).length - 1)
				.as("V100 carries an edit that this file does not name (or this file names one V100 lacks): one line and one sign-off in each language,"
						+ " each written between two $old$ marks")
				.isEqualTo(4 * 2);
	}

	/**
	 * THE RULEBOOK IS SIGNED OFF ON THE FIFTEENTH OF NOVEMBER, IN BOTH LANGUAGES, AND THE DAY IS MOVED BY V100 ITSELF: asked of
	 * the text the portal serves (a move in one language only, or to another day, fails it), and of V100, which must carry the
	 * move from the day V98 gave to the new one in each language, as the edit of a sign-off in the shape of V98.
	 */
	@Test
	void theRulebookReadsTheFifteenthOfNovemberInBothLanguagesAndV100IsWhatMovesIt() {
		for (String language : List.of("sr", "en")) {
			boolean serbian = language.equals("sr");
			String mark = serbian ? "Poslednja izmena: " : "Last amended: ";

			assertThat(bodyOf(RULEBOOK, 19, language)).as("the %s rulebook ends with its sign-off", language)
					.endsWith(mark + "15.11.2026.")
					.containsOnlyOnce(mark).doesNotContain("14.11.2026");
			assertThat(bodyOf("politika-privatnosti", 7, language)).as("the %s policy reads the day V102 gave it", language)
					.endsWith(mark + "16.11.2026.");
			assertThat(bodyOf("uslovi-koriscenja", 11, language)).as("the %s terms keep their day", language)
					.endsWith(mark + "11.11.2026.");
			assertThat(migrationSql("100")).as("V100 does not move the %s sign-off from the day V98 gave it", language)
					.contains("$old$" + mark + "14.11.2026.$old$")
					.contains("$new$" + mark + "15.11.2026.$new$");
		}
	}
}
