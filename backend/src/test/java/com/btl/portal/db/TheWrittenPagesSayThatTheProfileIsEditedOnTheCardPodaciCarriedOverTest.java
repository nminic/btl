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
 * WHAT V89 DOES TO LEGAL PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> V89 only edits text, and every other case in this suite starts from a database V89 has
 * just finished editing, so by the time a case can look the text is the new text whether the migration did its work or
 * was never there. What these cases ask is what no other can: given the text that stood immediately BEFORE V89, does V89
 * give the text the portal serves, change nothing else, and refuse every text it was not written for?
 *
 * <p><b>How the text before V89 is made.</b> V89 names the old text of every edit, so the pages are put back by the
 * reverse of each edit ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each new text standing exactly once to be taken
 * out. It is proved by behaviour, not by the shape of the undo: every case first asks the table of
 * {@link TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest} whether a piece of each old text really stands in
 * the put-back text, in both languages.
 *
 * <p><b>The floor of the sweep.</b> A sweep that finds nothing is only worth something if it can find: asked of the
 * text before V89, the sweep for the old claim finds it in the policy's section 6, in both languages.
 */
class TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static int theNumberOfRowsV89Edits() {
		return TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest.CHANGES.size() * 2;
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

	/** The pages as they stood before V89, and the proof that this is so: a piece of every old text stands again. */
	private void theTextAsItStoodBeforeV89() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "89");

		for (TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest.Change change : TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest.CHANGES) {
			assertThat(bodyOf(change.slug(), change.position(), "sr"))
					.as("%s: the fixture did not put the old Serbian text back, so V89 below has nothing to change and"
							+ " this case measures nothing", change.id())
					.contains(change.goneFromSerbian());
			assertThat(bodyOf(change.slug(), change.position(), "en"))
					.as("%s: the fixture did not put the old English text back", change.id())
					.contains(change.goneFromEnglish());
		}
	}

	private void v89() {
		jdbc.execute(migrationSql("89"));
	}

	/** V89 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v89Refused() {
		Throwable stopped = catchThrowable(this::v89);

		assertThat(stopped)
				.as("V89 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V89 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	/**
	 * V89 OVER THE TEXT IT FOUND GIVES THE TEXT THE PORTAL SERVES, character for character, in every heading and body of
	 * every page in both languages, and changes exactly the sections it names and no other: four rows, sections 6 and 7 of
	 * the policy in two languages. The sign-offs of the rulebook and of the terms are among the sections it leaves alone.
	 */
	@Test
	void v89OverTheTextItFoundGivesTheTextThePortalServesAndChangesNothingElse() {
		Map<String, String> finished = everyText();

		theTextAsItStoodBeforeV89();

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);

		v89();

		Map<String, String> after = everyText();

		assertThat(after).as("V89 over the text it found does not give the text the portal serves").isEqualTo(finished);

		List<String> changed = before.keySet().stream().filter(key -> !before.get(key).equals(after.get(key))).toList();

		assertThat(changed)
				.as("V89 changed a different set of sections than the ones its edits name, in both languages")
				.containsExactlyInAnyOrder("politika-privatnosti #6 sr", "politika-privatnosti #6 en",
						"politika-privatnosti #7 sr", "politika-privatnosti #7 en");
	}

	/**
	 * V89 OVER THE FINISHED TEXT STOPS AND LISTS EVERY EDIT, one line each, because each finds its old text zero times.
	 * It stops at none of them first: the report is the whole list.
	 */
	@Test
	void v89RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		PSQLException error = v89Refused();

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the written pages were not edited")
				.contains(theNumberOfRowsV89Edits() + " of " + theNumberOfRowsV89Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V89 does not report one line for every edit it makes")
				.hasSize(theNumberOfRowsV89Edits())
				.allMatch(line -> line.contains(": found 0 times"))
				.contains("PROFILE-01 section 6 @ politika-privatnosti #6 sr: found 0 times, and its new text is already there",
						"PROFILE-01 section 6 @ politika-privatnosti #6 en: found 0 times, and its new text is already there",
						"PROFILE-02 sign-off @ politika-privatnosti #7 sr: found 0 times, and its new text is already there",
						"PROFILE-02 sign-off @ politika-privatnosti #7 en: found 0 times, and its new text is already there");
	}

	/**
	 * AN OLD TEXT THAT STANDS TWICE STOPS V89 and says so, and an old text that is NOT there stops it at the same time:
	 * both are in the one report, and the statement is rolled back with nothing changed.
	 */
	@Test
	void anOldTextThatStandsTwiceAndOneThatIsNotThereAreBothReportedAndNothingIsChanged() {
		theTextAsItStoodBeforeV89();

		TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest.Change edit = TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest.CHANGES
				.get(0);
		String oldSerbian = "Deo možete i sami: polja profila menjate i brišete u podešavanjima.";

		setBody(edit.slug(), edit.position(), "sr", bodyOf(edit.slug(), edit.position(), "sr") + "\n" + oldSerbian);
		setBody(edit.slug(), edit.position(), "en",
				bodyOf(edit.slug(), edit.position(), "en").replace(edit.goneFromEnglish(), "gone"));

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v89Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfRowsV89Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("the report must name both problems and the edits that found their text once")
				.hasSize(theNumberOfRowsV89Edits())
				.contains("PROFILE-01 section 6 @ politika-privatnosti #6 sr: found 2 times",
						"PROFILE-01 section 6 @ politika-privatnosti #6 en: found 0 times")
				.filteredOn(line -> line.endsWith("found once"))
				.hasSize(theNumberOfRowsV89Edits() - 2);
		assertThat(everyText()).as("a refused V89 changed a page").isEqualTo(before);
	}

	/** A SECTION THAT ALREADY CARRIES THE NEW TEXT BESIDE THE OLD ONE STOPS V89, whatever the old text finds. */
	@Test
	void aNewTextThatIsAlreadyThereBesideTheOldOneStopsV89() {
		theTextAsItStoodBeforeV89();

		TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest.Change edit = TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest.CHANGES
				.get(0);

		setBody(edit.slug(), edit.position(), "sr",
				bodyOf(edit.slug(), edit.position(), "sr") + "\n" + edit.standsInSerbian());

		PSQLException error = v89Refused();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfRowsV89Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("PROFILE-01 section 6 @ politika-privatnosti #6 sr: found once, and its new text is already there");
	}

	/**
	 * THE FLOOR OF THE SWEEP: asked of the text before V89, the sweep for the old claim finds it in the policy's
	 * section 6, in both languages, and in no other section. A pattern that had gone blind would pass the sweep of the
	 * other class on any text.
	 */
	@Test
	void theSweepFindsWhatItKeepsOutInTheTextBeforeV89() {
		theTextAsItStoodBeforeV89();

		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest.THE_OLD_CLAIM_IN_SERBIAN))
				.as("the Serbian sweep for the old claim cannot see it in the text that held it")
				.containsExactly("politika-privatnosti #6");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				TheWrittenPagesSayThatTheProfileIsEditedOnTheCardPodaciTest.THE_OLD_CLAIM_IN_ENGLISH))
				.as("the English sweep for the old claim cannot see it in the text that held it")
				.containsExactly("politika-privatnosti #6");
	}
}
