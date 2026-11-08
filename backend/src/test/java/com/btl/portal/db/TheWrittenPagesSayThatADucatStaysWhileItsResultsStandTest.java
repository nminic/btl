package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE RULEBOOK SAYS THAT A DUCAT STAYS FOR AS LONG AS THE RESULTS THAT WON IT STAND, AND ITS SIGN-OFF IS 09.11.2026 (V92,
 * owner, 08.11.2026), IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists, and it is the other half of V92 (as {@link TheWrittenPagesSayThatTheProfileIsEditedOnThePageMojiPodaciTest}
 * is of V89).</b> V92 makes one edit in each language, and one sign-off in each, with {@code replace()} calls. A replace
 * is exact and has one failure mode, which is to match NOTHING and report success; the migration itself refuses that, so
 * what is held here is the other side: that what the owner decided is what the portal serves, in both languages, that
 * the sentence it replaced stands nowhere on any of the three pages, and that the paragraphs beside it were not taken
 * along.
 *
 * <p><b>Four kinds of case.</b> The table of edits ({@link #CHANGES}): the full new text stands once in the section it
 * was aimed at and a piece of the old text is gone, in Serbian and in English separately, so an edit done in one
 * language alone fails the other. The sweeps over every section of the three pages with no section named: the old
 * sentence (V78's, and the V77 paragraph before it) stands nowhere, and the new sentence stands once, in the rulebook.
 * The neighbours: the paragraph before the sentence and the paragraph after it are untouched. And the sign-offs: only the
 * rulebook moved (owner, 07.11.2026: the date moves whenever the words of a legal text change, to the day the change
 * reaches QA), the policy keeps 08.11.2026 (V90) and the terms 29.10.2026, and 30.10.2026 stands on none of the three.
 *
 * <p><b>The day 09.11.2026 is the day expected</b> (see the head of V92). If the file reaches QA on another day, the day
 * is moved in the migration, in the table below and in every guard that holds it.
 */
class TheWrittenPagesSayThatADucatStaysWhileItsResultsStandTest extends DatabaseTest {

	static final String RULEBOOK = "pravilnik";

	/** The owner's sentence, as he approved it (08.11.2026), and its English as the assistant wrote it. */
	static final String THE_SENTENCE_IN_SERBIAN =
			"Dukat ostaje dok stoje rezultati koji su ga doneli. Mesečni i sezonski dukat zamrznute sezone ostaje trajno.";
	static final String THE_SENTENCE_IN_ENGLISH =
			"A ducat stays for as long as the results that won it stand. A monthly and a seasonal ducat of a frozen season stays for good.";

	/**
	 * One edit of V92 as the owner decided it. The full new text must stand once in the section, and a piece of the old
	 * text must not stand in it.
	 */
	record Change(String id, String slug, int position, String standsInSerbian, String goneFromSerbian,
			String standsInEnglish, String goneFromEnglish) {
	}

	static final List<Change> CHANGES = List.of(
			new Change("DUCAT-01", RULEBOOK, 18,
					THE_SENTENCE_IN_SERBIAN,
					"osim u slučaju brisanja istog",
					THE_SENTENCE_IN_ENGLISH,
					"except in the case of its deletion"),
			new Change("DUCAT-02", RULEBOOK, 19,
					"Poslednja izmena: 09.11.2026.",
					"izmena: 30.10.2026.",
					"Last amended: 09.11.2026.",
					"amended: 30.10.2026."));

	/**
	 * The sentence V78 wrote, which V92 replaced, and the V77 paragraph before it, by their roots, in each language: the
	 * owner's old claim that the ducats stay with the profile (except for its deletion) and the older claim that a won
	 * ducat stays forever.
	 */
	static final Pattern THE_OLD_SENTENCE_IN_SERBIAN = Pattern.compile(
			"u trajnom vlasništvu profila|osim u slučaju brisanja istog|Osvojen dukat ostaje trajno",
			Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
	static final Pattern THE_OLD_SENTENCE_IN_ENGLISH = Pattern.compile(
			"permanent ownership of the profile|except in the case of its deletion|won ducat stays forever",
			Pattern.CASE_INSENSITIVE);

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
		assertThat(CHANGES).as("the table of edits is empty, so this case measures nothing").hasSize(2);

		for (Change change : CHANGES) {
			boolean serbian = language.equals("sr");
			String stands = serbian ? change.standsInSerbian() : change.standsInEnglish();
			String gone = serbian ? change.goneFromSerbian() : change.goneFromEnglish();
			String body = bodyOf(change.slug(), change.position(), language);

			assertThat(body)
					.as("%s (%s #%s, %s): its new text must stand exactly once", change.id(), change.slug(),
							change.position(), language)
					.containsOnlyOnce(stands);
			assertThat(body)
					.as("%s (%s #%s, %s): a piece of its old text still stands", change.id(), change.slug(),
							change.position(), language)
					.doesNotContain(gone);
		}
	}

	@Test
	void everyEditStandsInSerbianAndItsOldWordsAreGone() {
		everyEditHolds("sr");
	}

	@Test
	void everyEditStandsInEnglishAndItsOldWordsAreGone() {
		everyEditHolds("en");
	}

	/**
	 * THE TABLE KNOWS EVERY EDIT THE MIGRATION MAKES, so a third edit added to V92 without a line here fails (the floor is
	 * the file Flyway resolved): each of the 4 rows of V92 carries one old text, written between two {@code $old$} marks.
	 */
	@Test
	void theTableNamesEveryEditV92Makes() {
		String sql = migrationSql("92");

		assertThat(sql.split("\\$old\\$", -1).length - 1)
				.as("V92 carries an edit that the table of this file does not name (or the table names one V92 lacks)")
				.isEqualTo(CHANGES.size() * 2 * 2);
	}

	/**
	 * THE NEW SENTENCE STANDS BETWEEN THE PARAGRAPHS IT STOOD BETWEEN, in Serbian and in English: the paragraph before it
	 * (which ducats are won when) and the one after it (the colours of the ducats, then the gallery) are V77's, and a
	 * replace that took a neighbour with it would pass the table above.
	 */
	@Test
	void theNewSentenceStandsBetweenTheParagraphsItStoodBetween() {
		assertThat(bodyOf(RULEBOOK, 18, "sr"))
				.contains("Jedni se osvajaju svakog meseca, drugi jednom u sezoni, a treći samo jednom.\n\n"
						+ THE_SENTENCE_IN_SERBIAN + "\n\n"
						+ "Dukati su bronzani, srebrni i zlatni, po rastućoj težini.\n\n[[gallery]]");
		assertThat(bodyOf(RULEBOOK, 18, "en"))
				.contains("Some are won every month, others once a season, and others only once.\n\n"
						+ THE_SENTENCE_IN_ENGLISH + "\n\n"
						+ "Ducats are bronze, silver, and gold, in order of increasing difficulty.\n\n[[gallery]]");
	}

	@Test
	void noSectionOfTheThreePagesStillHoldsTheOldSentenceAboutTheDucats() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr", THE_OLD_SENTENCE_IN_SERBIAN))
				.as("a Serbian section still says the ducats stay with the profile whatever happens to its results")
				.isEmpty();
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en", THE_OLD_SENTENCE_IN_ENGLISH))
				.as("an English section still says the ducats stay with the profile whatever happens to its results")
				.isEmpty();
	}

	/** THE NEW SENTENCE STANDS IN SECTION 18 OF THE RULEBOOK AND NOWHERE ELSE: a second home for it would be said twice. */
	@Test
	void theNewSentenceStandsInTheDucatsOfTheRulebookAndNowhereElse() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				Pattern.compile(Pattern.quote(THE_SENTENCE_IN_SERBIAN))))
				.containsExactly(RULEBOOK + " #18");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				Pattern.compile(Pattern.quote(THE_SENTENCE_IN_ENGLISH))))
				.containsExactly(RULEBOOK + " #18");
	}

	/**
	 * ONLY THE RULEBOOK IS SIGNED WITH THE NEW DAY: its sign-off stands once as the last line, in both languages, the
	 * other two documents keep the day of their own last change, and the day V80 gave the rulebook stands on none of the
	 * three, so a sign-off moved on all three (or on none) fails.
	 */
	@Test
	void theRulebookIsSignedOffOnTheNinthOfNovemberAndTheOtherTwoKeepTheirDays() {
		for (String language : List.of("sr", "en")) {
			boolean serbian = language.equals("sr");
			String mark = serbian ? "Poslednja izmena: " : "Last amended: ";

			assertThat(bodyOf(RULEBOOK, 19, language)).as("the %s rulebook ends with its sign-off", language)
					.endsWith(serbian ? CHANGES.get(1).standsInSerbian() : CHANGES.get(1).standsInEnglish())
					.containsOnlyOnce(mark).doesNotContain("30.10.2026").doesNotContain("29.10.2026");
			assertThat(bodyOf("politika-privatnosti", 7, language)).as("the %s policy keeps its day", language)
					.endsWith(mark + "08.11.2026.");
			assertThat(bodyOf("uslovi-koriscenja", 11, language)).as("the %s terms keep their day", language)
					.endsWith(mark + "29.10.2026.");
		}
	}
}
