package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.postgresql.util.PSQLException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * WHAT V110 DOES TO LEGAL PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> V110 only edits text, and every other case in this suite starts from a database V110 has just
 * finished editing, so by the time a case can look the text is the new text whether the migration did its work or was never
 * there. What these cases ask is what no other can: given the text that stood immediately BEFORE V110, does V110 give the text
 * the portal serves, change nothing else, and refuse every text it was not written for, itself included?
 *
 * <p><b>How the text before V110 is made.</b> V110 names the old text of every edit, so the pages are put back by the reverse of
 * each edit ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each new text standing exactly once to be taken out. It is proved
 * by behaviour, not by the shape of the undo: every case first asks whether the row is really back and the day is the old one.
 *
 * <p><b>Run twice.</b> A migration whose new text is empty would find "its new text" in every section, and one whose old text is
 * the row alone would be found once over its own result only if the row were there. V110's old text is the row together with the
 * one after it, and the case that runs it over the finished text holds that every edit is refused by name.
 */
class TheWrittenPagesLoseTheRowAboutTheThemeCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String POLICY = TheWrittenPagesLoseTheRowAboutTheThemeTest.POLICY;

	private static int theNumberOfEditsV110Makes() {
		return 8;
	}

	/** Every heading and body of both tables, by page, place and language, so two readings compare row by row. */
	private Map<String, String> everyText() {
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

	private void setBody(String slug, int position, String language, String body) {
		int changed = language.equals("sr")
				? db.sql("update static_page_section s set body = :body from static_page p"
								+ " where p.id = s.page_id and p.slug = :slug and s.position = :position")
						.param("body", body).param("slug", slug).param("position", position).update()
				: db.sql("update static_page_section_translation t set body = :body from static_page_section s, static_page p"
								+ " where s.id = t.section_id and p.id = s.page_id and p.slug = :slug"
								+ " and s.position = :position and t.language = :language")
						.param("body", body).param("slug", slug).param("position", position)
						.param("language", language).update();

		assertThat(changed).as("there is no %s text of %s #%s to write", language, slug, position).isOne();
	}

	private TheWrittenPagesBeforeV71.Edit edit(String label, String language) {
		return TheWrittenPagesBeforeV71.bodyEditsOf(migrationSql("110")).stream()
				.filter(each -> each.label().equals(label) && each.language().equals(language)).findFirst()
				.orElseThrow(() -> new AssertionError("V110 has no edit called " + label + " in " + language));
	}

	/** The pages as they stood before V110, and the proof that this is so: the row is back and the day is the old one. */
	private void theTextAsItStoodBeforeV110() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "110");

		assertThat(bodyOf(POLICY, 2, "sr"))
				.as("the fixture did not put the Serbian row back, so V110 below has nothing to take out and this case measures nothing")
				.containsOnlyOnce(TheWrittenPagesLoseTheRowAboutTheThemeTest.THE_ROW_IN_SERBIAN);
		assertThat(bodyOf(POLICY, 2, "en"))
				.as("the fixture did not put the English row back")
				.containsOnlyOnce(TheWrittenPagesLoseTheRowAboutTheThemeTest.THE_ROW_IN_ENGLISH);
		assertThat(bodyOf(POLICY, 4, "sr")).as("the fixture did not put the Serbian paragraph back")
				.containsOnlyOnce(TheWrittenPagesLoseTheRowAboutTheThemeTest.THE_PARAGRAPH_IN_SERBIAN);
		assertThat(bodyOf(POLICY, 4, "en")).as("the fixture did not put the English paragraph back")
				.containsOnlyOnce(TheWrittenPagesLoseTheRowAboutTheThemeTest.THE_PARAGRAPH_IN_ENGLISH);
		assertThat(bodyOf(POLICY, 7, "sr")).endsWith("Poslednja izmena: 21.11.2026.");
		assertThat(bodyOf(POLICY, 7, "en")).endsWith("Last amended: 21.11.2026.");
	}

	private void v110() {
		jdbc.execute(migrationSql("110"));
	}

	/** V110 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v110Refused() {
		Throwable stopped = catchThrowable(this::v110);

		assertThat(stopped)
				.as("V110 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V110 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	/**
	 * V110 OVER THE TEXT IT FOUND GIVES THE TEXT THE PORTAL SERVES, character for character, in every heading and body of every
	 * page in both languages, and changes exactly the sections it names and no other: sections 2, 4 and 7 of the policy, in both
	 * languages. The sign-offs of the terms and of the rulebook, the other
	 * sections and the other pages are among the ones it leaves alone.
	 */
	@Test
	void v110OverTheTextItFoundGivesTheTextThePortalServesAndChangesNothingElse() {
		Map<String, String> finished = everyText();

		theTextAsItStoodBeforeV110();

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);

		v110();

		Map<String, String> after = everyText();

		assertThat(after).as("V110 over the text it found does not give the text the portal serves").isEqualTo(finished);

		List<String> changed = before.keySet().stream().filter(key -> !before.get(key).equals(after.get(key))).toList();

		assertThat(changed)
				.as("V110 changed a different set of sections than the ones its edits name")
				.containsExactlyInAnyOrder(POLICY + " #2 sr", POLICY + " #2 en", POLICY + " #4 sr", POLICY + " #4 en",
						POLICY + " #7 sr", POLICY + " #7 en");
	}

	/**
	 * V110 OVER THE FINISHED TEXT STOPS AND LISTS EVERY EDIT, one line each, because each finds its old text zero times and finds
	 * its new text already there. Nothing is edited a second time: the finished text is the text the portal serves, unchanged by the
	 * refused run.
	 */
	@Test
	void v110RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		Map<String, String> finished = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v110Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the written pages were not edited")
				.contains(theNumberOfEditsV110Makes() + " of " + theNumberOfEditsV110Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V110 does not report one line for every edit it makes")
				.hasSize(theNumberOfEditsV110Makes())
				.contains("THEME-01 section 2 @ politika-privatnosti #2 sr: found 0 times, and its new text is already there",
						"THEME-01 section 2 @ politika-privatnosti #2 en: found 0 times, and its new text is already there",
						"THEME-03 section 4 @ politika-privatnosti #4 sr: found 0 times",
						"THEME-03 section 4 @ politika-privatnosti #4 en: found 0 times",
						"THEME-04 section 4, the sentence after it @ politika-privatnosti #4 sr: found 0 times, and its new text is already there",
						"THEME-04 section 4, the sentence after it @ politika-privatnosti #4 en: found 0 times, and its new text is already there",
						"THEME-02 sign-off @ politika-privatnosti #7 sr: found 0 times, and its new text is already there",
						"THEME-02 sign-off @ politika-privatnosti #7 en: found 0 times, and its new text is already there");
		assertThat(everyText()).as("a refused V110 changed a page").isEqualTo(finished);
	}

	/**
	 * AN OLD TEXT THAT STANDS TWICE STOPS V110 and says so, and an old text that is NOT there stops it at the same time: both
	 * are in the one report, and the statement is rolled back with nothing changed.
	 */
	@Test
	void anOldTextThatStandsTwiceAndOneThatIsNotThereAreBothReportedAndNothingIsChanged() {
		theTextAsItStoodBeforeV110();

		setBody(POLICY, 2, "sr", bodyOf(POLICY, 2, "sr") + "\n" + edit("THEME-01 section 2", "sr").oldText());
		setBody(POLICY, 2, "en", bodyOf(POLICY, 2, "en").replace("Choice of light or dark theme", "gone"));

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v110Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfEditsV110Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("the report must name both problems")
				.hasSize(theNumberOfEditsV110Makes())
				.contains("THEME-01 section 2 @ politika-privatnosti #2 sr: found 2 times",
						"THEME-01 section 2 @ politika-privatnosti #2 en: found 0 times, and its new text is already there");
		assertThat(everyText()).as("a refused V110 changed a page").isEqualTo(before);
	}

	/** A SECTION THAT ALREADY CARRIES THE NEW TEXT BESIDE THE OLD TEXT STOPS V110, whatever the old text finds. */
	@Test
	void aNewTextThatIsAlreadyThereBesideTheOldOneStopsV110() {
		theTextAsItStoodBeforeV110();

		setBody(POLICY, 2, "en", bodyOf(POLICY, 2, "en") + "\n" + edit("THEME-01 section 2", "en").newText());

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v110Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfEditsV110Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("THEME-01 section 2 @ politika-privatnosti #2 en: found once, and its new text is already there");
	}

	/**
	 * THE SENTENCE AFTER THE PARAGRAPH IS ITS OWN EDIT, AND BOTH LANGUAGES ARE ASKED: over the text before V110 it becomes the
	 * owner's sentence, and a section that already carries the new sentence beside the old one is refused by name, in each language.
	 */
	@Test
	void theSentenceAfterTheParagraphIsGivenInBothLanguagesAndANewOneAlreadyThereStopsV110() {
		theTextAsItStoodBeforeV110();

		v110();

		assertThat(bodyOf(POLICY, 4, "sr")).containsOnlyOnce("U pregledaču se ništa drugo ne čuva, niti ima analitike.")
				.doesNotContain("Drugog skladišta");
		assertThat(bodyOf(POLICY, 4, "en")).containsOnlyOnce("Nothing else is kept in your browser, and there is no analytics.")
				.doesNotContain("There is no other storage");

		for (String language : List.of("sr", "en")) {
			theTextAsItStoodBeforeV110();

			TheWrittenPagesBeforeV71.Edit sentence = edit("THEME-04 section 4, the sentence after it", language);

			setBody(POLICY, 4, language, bodyOf(POLICY, 4, language) + "\n\n" + sentence.newText());

			jdbc.execute("savepoint before_the_refusal");

			PSQLException error = v110Refused();

			jdbc.execute("rollback to savepoint before_the_refusal");

			assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfEditsV110Makes() + " edits");
			assertThat(error.getServerErrorMessage().getDetail())
					.contains("THEME-04 section 4, the sentence after it @ politika-privatnosti #4 " + language
							+ ": found once, and its new text is already there");
		}
	}

	/**
	 * A SIGN-OFF THAT IS NOT THE ONE V107 LEFT STOPS V110 and says which language: the day moves from 21.11.2026 and from no
	 * other, and a sign-off already on the new day beside the old one is refused like any new text that is already there.
	 */
	@Test
	void aSignOffThatIsNotTheOneV107LeftStopsV110AndOneAlreadyOnTheNewDayIsRefusedToo() {
		theTextAsItStoodBeforeV110();

		setBody(POLICY, 7, "sr", bodyOf(POLICY, 7, "sr").replace("Poslednja izmena: 21.11.2026.", "Poslednja izmena: 16.11.2026."));
		setBody(POLICY, 7, "en", bodyOf(POLICY, 7, "en") + "\nLast amended: 24.11.2026.");

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v110Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfEditsV110Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.contains("THEME-02 sign-off @ politika-privatnosti #7 sr: found 0 times",
						"THEME-02 sign-off @ politika-privatnosti #7 en: found once, and its new text is already there");
	}

	/**
	 * THE ENGLISH ROW IS NOT LOOKED FOR IN THE SERBIAN TABLE, nor the Serbian in the English: a Serbian row that stands in the
	 * English section is left where it is, and the English edit finds its own row once.
	 */
	@Test
	void aSerbianRowThatStandsInTheEnglishSectionIsLeftAlone() {
		theTextAsItStoodBeforeV110();

		String english = bodyOf(POLICY, 2, "en") + "\n" + TheWrittenPagesLoseTheRowAboutTheThemeTest.THE_ROW_IN_SERBIAN;

		setBody(POLICY, 2, "en", english);

		v110();

		assertThat(bodyOf(POLICY, 2, "en")).as("V110 took the Serbian row out of the English section")
				.endsWith(TheWrittenPagesLoseTheRowAboutTheThemeTest.THE_ROW_IN_SERBIAN)
				.doesNotContain(TheWrittenPagesLoseTheRowAboutTheThemeTest.THE_ROW_IN_ENGLISH);
		assertThat(bodyOf(POLICY, 2, "sr")).doesNotContain(TheWrittenPagesLoseTheRowAboutTheThemeTest.THE_ROW_IN_SERBIAN);
	}
}
