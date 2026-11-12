package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PRIVACY POLICY SAYS "MOJI PODACI" WHERE IT SAID "THE CARD PODACI", LINKS THE SENTENCE OF SECTION 6 TO THAT PAGE,
 * AND IS SIGNED 08.11.2026 (V90, owner, 07.11.2026 and 08.11.2026), IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists, and it is the other half of V90</b> (as
 * {@link TheWrittenPagesSayThatTheProfileIsEditedOnThePageMojiPodaciTest} is of V89). V90 makes its edits with
 * {@code replace()} calls, and a replace has one failure mode, which is to match NOTHING and report success; the migration
 * itself refuses that, so what is held here is the other side: that what the owner decided is what the portal serves, in
 * each language and in that language's own words, that the words it replaced stand nowhere on any of the three pages, and
 * that the words around them were not taken along.
 *
 * <p><b>The kinds of case.</b> The table of edits ({@link #CHANGES}): the full new text stands once in the section it was
 * aimed at and a piece of the old text is gone, in Serbian and in English separately, so an edit done in one language
 * alone, or the Serbian words written into the English text, fails. The sweeps over every section of the three pages: the
 * card stands nowhere (a second home for it would send a member to a card his profile no longer has), and the link stands
 * once, in section 6. The neighbours: the rest of the row of the document number and of the list of what is not public is
 * as it was. And the sign-off: the policy carries 08.11.2026 once, as its last line, and the rulebook and the terms keep
 * their days, because their words did not change.
 */
class TheWrittenPagesSayMojiPodaciWhereTheySaidTheCardTest extends DatabaseTest {

	static final String POLICY = "politika-privatnosti";

	/** The link of section 6 in each language: the words of the page name, and the address the portal puts the language in front of. */
	static final String THE_LINK_IN_SERBIAN = "[Moji podaci](/moji-podaci)";
	static final String THE_LINK_IN_ENGLISH = "[My details](/moji-podaci)";

	/**
	 * One edit of V90 as the owner decided it. The full new text must stand once in the section, and a piece of the old
	 * text must not stand in it.
	 */
	record Change(String id, String slug, int position, String standsInSerbian, String goneFromSerbian,
			String standsInEnglish, String goneFromEnglish) {
	}

	static final List<Change> CHANGES = List.of(
			new Change("MENU-01", POLICY, 2,
					"Vidi ga samo administracija i vi, na strani Moji podaci; drugima se ne prikazuje nigde",
					"na svojoj kartici Podaci",
					"Only the administration and you see it, on your My details page; it is not displayed to others anywhere",
					"on your own Details card"),
			new Change("MENU-02", POLICY, 3,
					"ime oca i broj ličnog dokumenta, osim vama, na strani Moji podaci,",
					"na vašoj kartici Podaci",
					"father's name and ID document number, except to you, on your My details page,",
					"on your own Details card"),
			new Change("MENU-03", POLICY, 6,
					"Polja profila, sliku i tekst o sebi menjate i brišete na strani " + THE_LINK_IN_SERBIAN + ".",
					"na strani Moji podaci.",
					"You change and delete profile fields, your picture and the text about yourself on the "
							+ THE_LINK_IN_ENGLISH + " page.",
					"on the My details page."),
			new Change("MENU-04", POLICY, 7,
					"Poslednja izmena: 08.11.2026.",
					"izmena: 07.11.2026.",
					"Last amended: 08.11.2026.",
					"amended: 07.11.2026."));

	/** The card, by its roots, in each language: what the policy said before the menu arrived. */
	static final Pattern THE_CARD_IN_SERBIAN = Pattern.compile("kartic\\p{L}* Podaci", Pattern.UNICODE_CASE);
	static final Pattern THE_CARD_IN_ENGLISH = Pattern.compile("Details card", Pattern.CASE_INSENSITIVE);

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

	private void everyEditHolds(String language) {
		/* The text as V94 left it: V95 (owner, 11.11.2026) moved the sign-offs of all three pages and took sentences out of them, which is held by TheWrittenPagesStateTheFactCarriedOverTest. */
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "95");
		assertThat(CHANGES).as("the table of edits is empty, so this case measures nothing").hasSize(4);

		for (Change change : CHANGES) {
			boolean serbian = language.equals("sr");
			String stands = serbian ? change.standsInSerbian() : change.standsInEnglish();
			String gone = serbian ? change.goneFromSerbian() : change.goneFromEnglish();
			String other = serbian ? change.standsInEnglish() : change.standsInSerbian();
			String body = bodyOf(change.slug(), change.position(), language);

			assertThat(body)
					.as("%s (%s #%s, %s): its new text must stand exactly once", change.id(), change.slug(),
							change.position(), language)
					.containsOnlyOnce(stands);
			assertThat(body)
					.as("%s (%s #%s, %s): a piece of its old text still stands", change.id(), change.slug(),
							change.position(), language)
					.doesNotContain(gone);
			assertThat(body)
					.as("%s (%s #%s, %s): the other language's words were written here", change.id(), change.slug(),
							change.position(), language)
					.doesNotContain(other);
		}
	}

	@Test
	void theEditsStandInSerbianAndTheirOldWordsAreGone() {
		everyEditHolds("sr");
	}

	@Test
	void theEditsStandInEnglishAndTheirOldWordsAreGone() {
		everyEditHolds("en");
	}

	/**
	 * THE TABLE KNOWS EVERY EDIT THE MIGRATION MAKES, so a second edit added to V90 without a line here fails (the floor
	 * is the file Flyway resolved): each of the 8 rows of V90 carries one old text, written between two {@code $old$}
	 * marks.
	 */
	@Test
	void theTableNamesEveryEditV90Makes() {
		String sql = migrationSql("90");

		assertThat(sql.split("\\$old\\$", -1).length - 1)
				.as("V90 carries an edit that the table of this file does not name (or the table names one V90 lacks)")
				.isEqualTo(CHANGES.size() * 2 * 2);
	}

	/**
	 * THE WORDS AROUND EACH EDIT ARE AS THEY WERE: the rest of the row of the document number (its table cells), the list
	 * of what is not public on both sides of the clause, and the sentence about the consent for cookies after the link. A
	 * replace that took a neighbour with it would pass the table above.
	 */
	@Test
	void theWordsAroundEachEditAreAsTheyWere() {
		assertThat(bodyOf(POLICY, 2, "sr")).contains("| Broj ličnog dokumenta | Evidencija članova koju udruženje vodi"
				+ " po zakonu. Od člana mlađeg od 16 godina se traži, ali nije obavezan. " + CHANGES.get(0).standsInSerbian()
				+ " | Pravna obaveza | Sekcija 5 |");
		assertThat(bodyOf(POLICY, 3, "sr")).contains("veličina majice, " + CHANGES.get(1).standsInSerbian()
				+ " telefon, privatne poruke");
		assertThat(bodyOf(POLICY, 6, "sr"))
				.contains("\n\n" + CHANGES.get(2).standsInSerbian() + " Saglasnost za kolačiće se ne povlači jer se ne daje");

		assertThat(bodyOf(POLICY, 2, "en")).contains(CHANGES.get(0).standsInEnglish() + " | ");
		assertThat(bodyOf(POLICY, 3, "en")).contains("T-shirt size, " + CHANGES.get(1).standsInEnglish() + " phone");
		assertThat(bodyOf(POLICY, 6, "en"))
				.contains("\n\n" + CHANGES.get(2).standsInEnglish() + " Consent for cookies is not withdrawn because it is not given");
	}

	/**
	 * ONLY THE POLICY IS SIGNED WITH THE NEW DAY: its sign-off stands once as the last line, in both languages, and the
	 * other two documents keep the day of their own last change, so a sign-off moved on all three (or on none) fails.
	 */
	@Test
	void thePolicyIsSignedOffOnTheEighthOfNovemberAndTheOtherTwoKeepTheirDays() {
		/* The text as V94 left it: V95 (owner, 11.11.2026) moved the sign-offs of all three pages and took sentences out of them, which is held by TheWrittenPagesStateTheFactCarriedOverTest. */
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "95");
		for (String language : List.of("sr", "en")) {
			boolean serbian = language.equals("sr");
			String mark = serbian ? "Poslednja izmena: " : "Last amended: ";

			assertThat(bodyOf(POLICY, 7, language)).as("the %s policy ends with its sign-off", language)
					.endsWith(serbian ? CHANGES.get(3).standsInSerbian() : CHANGES.get(3).standsInEnglish())
					.containsOnlyOnce(mark).doesNotContain("07.11.2026");
			assertThat(bodyOf("pravilnik", 19, language)).as("the %s rulebook keeps its day", language)
					.endsWith(mark + "10.11.2026.");
			assertThat(bodyOf("uslovi-koriscenja", 11, language)).as("the %s terms keep their day", language)
					.endsWith(mark + "29.10.2026.");
		}
	}

	@Test
	void noSectionOfTheThreePagesStillSpeaksOfTheCard() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr", THE_CARD_IN_SERBIAN))
				.as("a Serbian section still sends the member to the card Podaci").isEmpty();
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en", THE_CARD_IN_ENGLISH))
				.as("an English section still sends the member to the Details card").isEmpty();
	}

	/** THE LINK STANDS IN SECTION 6 OF THE POLICY AND NOWHERE ELSE, in each language with that language's words. */
	@Test
	void theLinkStandsInTheRightsOfThePolicyAndNowhereElse() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				Pattern.compile(Pattern.quote("](/moji-podaci)"))))
				.containsExactly(POLICY + " #6");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				Pattern.compile(Pattern.quote("](/moji-podaci)"))))
				.containsExactly(POLICY + " #6");
		assertThat(bodyOf(POLICY, 6, "sr")).containsOnlyOnce(THE_LINK_IN_SERBIAN).doesNotContain(THE_LINK_IN_ENGLISH);
		assertThat(bodyOf(POLICY, 6, "en")).containsOnlyOnce(THE_LINK_IN_ENGLISH).doesNotContain(THE_LINK_IN_SERBIAN);
	}
}
