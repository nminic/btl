package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
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
 * WHAT V98 DOES TO LEGAL PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> V98 only edits text, and every other case in this suite starts from a database V98 has
 * just finished editing, so by the time a case can look the text is the new text whether the migration did its work or
 * was never there. What these cases ask is what no other can: given the text that stood immediately BEFORE V98, does V98
 * give the text the portal serves, change nothing else, and refuse every text it was not written for?
 *
 * <p><b>How the text before V98 is made.</b> V98 names the old text of every edit, so the pages are put back by the
 * reverse of each edit ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each new text standing exactly once to be taken
 * out. It is proved by behaviour, not by the shape of the undo: every case first asks whether the old phrase and the old
 * sign-offs really stand in the put-back text.
 *
 * <p><b>The floor of the sweep.</b> A sweep that finds nothing is only worth something if it can find: asked of the
 * text before V98, the sweep for the bare name finds it in Article 36 of the rulebook, in English.
 */
class TheWrittenPagesNameTheRookiesWithTheLetterOfTheGenderCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/** The text as V98 left it: V100 (owner, 14.11.2026) moves the rulebook's sign-off on, which is held by TheWrittenPagesSayThatAnUnscoredRaceIsAPersonalRecordCarriedOverTest. */
	@BeforeEach
	void theTextAsV98LeftIt() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "110");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "107");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "100");
	}

	private static int theNumberOfRowsV98Edits() {
		return 3;
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

	/** The pages as they stood before V98, and the proof that this is so: every old text stands again. */
	private void theTextAsItStoodBeforeV98() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "98");

		assertThat(bodyOf("pravilnik", 8, "en"))
				.as("the fixture did not put the old English phrase back, so V98 below has nothing to change and this case"
						+ " measures nothing")
				.contains(TheWrittenPagesNameTheRookiesWithTheLetterOfTheGenderTest.THE_PHRASE_THAT_WAS);
		assertThat(bodyOf("pravilnik", 19, "sr")).as("the old Serbian sign-off is not back")
				.endsWith("Poslednja izmena: 12.11.2026.");
		assertThat(bodyOf("pravilnik", 19, "en")).as("the old English sign-off is not back")
				.endsWith("Last amended: 12.11.2026.");
	}

	private void v98() {
		jdbc.execute(migrationSql("98"));
	}

	/** V98 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v98Refused() {
		Throwable stopped = catchThrowable(this::v98);

		assertThat(stopped)
				.as("V98 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V98 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	/**
	 * V98 OVER THE TEXT IT FOUND GIVES THE TEXT THE PORTAL SERVES, character for character, in every heading and body of
	 * every page in both languages, and changes exactly the sections it names and no other: Article 36 in English and the
	 * sign-off of the rulebook in both languages. The sign-offs of the policy and of the terms are among the sections it
	 * leaves alone, and so is the Serbian Article 36.
	 */
	@Test
	void v98OverTheTextItFoundGivesTheTextThePortalServesAndChangesNothingElse() {
		Map<String, String> finished = everyText();

		theTextAsItStoodBeforeV98();

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);

		v98();

		Map<String, String> after = everyText();

		assertThat(after).as("V98 over the text it found does not give the text the portal serves").isEqualTo(finished);

		List<String> changed = before.keySet().stream().filter(key -> !before.get(key).equals(after.get(key))).toList();

		assertThat(changed)
				.as("V98 changed a different set of sections than the ones its edits name")
				.containsExactlyInAnyOrder("pravilnik #8 en", "pravilnik #19 sr", "pravilnik #19 en");
	}

	/**
	 * V98 OVER THE FINISHED TEXT STOPS AND LISTS EVERY EDIT, one line each, because each finds its old text zero times.
	 * It stops at none of them first: the report is the whole list.
	 */
	@Test
	void v98RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		PSQLException error = v98Refused();

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the written pages were not edited")
				.contains(theNumberOfRowsV98Edits() + " of " + theNumberOfRowsV98Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V98 does not report one line for every edit it makes")
				.hasSize(theNumberOfRowsV98Edits())
				.allMatch(line -> line.contains(": found 0 times"))
				.contains("ROOKIE-01 article 36 @ pravilnik #8 en: found 0 times, and its new text is already there",
						"ROOKIE-02 sign-off @ pravilnik #19 sr: found 0 times, and its new text is already there",
						"ROOKIE-02 sign-off @ pravilnik #19 en: found 0 times, and its new text is already there");
	}

	/**
	 * AN OLD TEXT THAT STANDS TWICE STOPS V98 and says so, and an old text that is NOT there stops it at the same time:
	 * both are in the one report, and the statement is rolled back with nothing changed.
	 */
	@Test
	void anOldTextThatStandsTwiceAndOneThatIsNotThereAreBothReportedAndNothingIsChanged() {
		theTextAsItStoodBeforeV98();

		setBody("pravilnik", 8, "en", bodyOf("pravilnik", 8, "en") + "\n" + TheWrittenPagesNameTheRookiesWithTheLetterOfTheGenderTest.THE_PHRASE_THAT_WAS);
		setBody("pravilnik", 19, "sr", bodyOf("pravilnik", 19, "sr").replace("12.11.2026", "gone"));

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v98Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfRowsV98Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("the report must name both problems and the edit that found its text once")
				.hasSize(theNumberOfRowsV98Edits())
				.contains("ROOKIE-01 article 36 @ pravilnik #8 en: found 2 times",
						"ROOKIE-02 sign-off @ pravilnik #19 sr: found 0 times",
						"ROOKIE-02 sign-off @ pravilnik #19 en: found once");
		assertThat(everyText()).as("a refused V98 changed a page").isEqualTo(before);
	}

	/** A SECTION THAT ALREADY CARRIES THE NEW TEXT BESIDE THE OLD ONE STOPS V98, whatever the old text finds. */
	@Test
	void aNewTextThatIsAlreadyThereBesideTheOldOneStopsV98() {
		theTextAsItStoodBeforeV98();

		setBody("pravilnik", 8, "en", bodyOf("pravilnik", 8, "en") + "\n" + TheWrittenPagesNameTheRookiesWithTheLetterOfTheGenderTest.THE_PHRASE_IN_ENGLISH);

		PSQLException error = v98Refused();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfRowsV98Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("ROOKIE-01 article 36 @ pravilnik #8 en: found once, and its new text is already there");
	}

	/**
	 * THE FLOOR OF THE SWEEP: asked of the text before V98, the sweep for the bare name finds it in Article 36 of the
	 * rulebook and in no other section. A pattern that had gone blind would pass the sweep of the other class on any text.
	 */
	@Test
	void theSweepFindsWhatItKeepsOutInTheTextBeforeV98() {
		theTextAsItStoodBeforeV98();

		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en", TheWrittenPagesNameTheRookiesWithTheLetterOfTheGenderTest.THE_BARE_NAME_IN_BRACKETS))
				.as("the English sweep for the bare name cannot see it in the text that held it")
				.containsExactly("pravilnik #8");
	}
}
