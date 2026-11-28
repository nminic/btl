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
 * WHAT V100 DOES TO LEGAL PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> V100 only edits text, and every other case in this suite starts from a database V100 has just
 * finished editing, so by the time a case can look the text is the new text whether the migration did its work or was never
 * there. What these cases ask is what no other can: given the text that stood immediately BEFORE V100, does V100 give the text
 * the portal serves, change nothing else, and refuse every text it was not written for, itself included?
 *
 * <p><b>How the text before V100 is made.</b> V100 names the old text of every edit, so the pages are put back by the
 * reverse of each edit ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each new text standing exactly once to be taken
 * out. It is proved by behaviour, not by the shape of the undo: every case first asks whether the line is really gone.
 *
 * <p><b>Run twice.</b> A migration whose new text contains its old text would be found once over its own result and would add
 * the line again. V100's old texts run on to the heading of the next article for that reason, and the case that runs it over the
 * finished text holds it.
 */
class TheWrittenPagesSayThatAnUnscoredRaceIsAPersonalRecordCarriedOverTest extends DatabaseTest {

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

	@Autowired
	JdbcTemplate jdbc;

	private static int theNumberOfRowsV100Edits() {
		return 4;
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

	/** The pages as they stood before V100, and the proof that this is so: the line is gone in both languages. */
	private void theTextAsItStoodBeforeV100() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "100");

		assertThat(bodyOf("pravilnik", 5, "sr"))
				.as("the fixture did not take the Serbian line out, so V100 below has nothing to add and this case measures nothing")
				.doesNotContain(TheWrittenPagesSayThatAnUnscoredRaceIsAPersonalRecordTest.THE_SENTENCE_IN_SERBIAN)
				.contains(TheWrittenPagesSayThatAnUnscoredRaceIsAPersonalRecordTest.THE_LAST_ITEM_THAT_WAS_IN_SERBIAN);
		assertThat(bodyOf("pravilnik", 5, "en"))
				.as("the fixture did not take the English line out")
				.doesNotContain(TheWrittenPagesSayThatAnUnscoredRaceIsAPersonalRecordTest.THE_SENTENCE_IN_ENGLISH)
				.contains(TheWrittenPagesSayThatAnUnscoredRaceIsAPersonalRecordTest.THE_LAST_ITEM_THAT_WAS_IN_ENGLISH);
	}

	private void v100() {
		jdbc.execute(migrationSql("100"));
	}

	/** V100 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v100Refused() {
		Throwable stopped = catchThrowable(this::v100);

		assertThat(stopped)
				.as("V100 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V100 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	/**
	 * V100 OVER THE TEXT IT FOUND GIVES THE TEXT THE PORTAL SERVES, character for character, in every heading and body of
	 * every page in both languages, and changes exactly the sections it names and no other: sections 5 and 19 of the rulebook,
	 * in both languages. The sign-offs of the policy and of the terms, the other sections and the other pages are among the ones it leaves alone.
	 */
	@Test
	void v100OverTheTextItFoundGivesTheTextThePortalServesAndChangesNothingElse() {
		Map<String, String> finished = everyText();

		theTextAsItStoodBeforeV100();

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);

		v100();

		Map<String, String> after = everyText();

		assertThat(after).as("V100 over the text it found does not give the text the portal serves").isEqualTo(finished);

		List<String> changed = before.keySet().stream().filter(key -> !before.get(key).equals(after.get(key))).toList();

		assertThat(changed)
				.as("V100 changed a different set of sections than the ones its edits name")
				.containsExactlyInAnyOrder("pravilnik #5 sr", "pravilnik #5 en", "pravilnik #19 sr", "pravilnik #19 en");
	}

	/**
	 * V100 OVER THE FINISHED TEXT STOPS AND LISTS EVERY EDIT, one line each, because each finds its old text zero times. The
	 * line is not added a second time: the finished text is the text the portal serves, unchanged by the refused run.
	 */
	@Test
	void v100RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		Map<String, String> finished = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v100Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the written pages were not edited")
				.contains(theNumberOfRowsV100Edits() + " of " + theNumberOfRowsV100Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V100 does not report one line for every edit it makes")
				.hasSize(theNumberOfRowsV100Edits())
				.allMatch(line -> line.contains(": found 0 times"))
				.contains("UNSCORED-01 article 15 @ pravilnik #5 sr: found 0 times, and its new text is already there",
						"UNSCORED-01 article 15 @ pravilnik #5 en: found 0 times, and its new text is already there",
						"UNSCORED-02 sign-off @ pravilnik #19 sr: found 0 times, and its new text is already there",
						"UNSCORED-02 sign-off @ pravilnik #19 en: found 0 times, and its new text is already there");
		assertThat(everyText()).as("a refused V100 changed a page").isEqualTo(finished);
	}

	/**
	 * AN OLD TEXT THAT STANDS TWICE STOPS V100 and says so, and an old text that is NOT there stops it at the same time:
	 * both are in the one report, and the statement is rolled back with nothing changed.
	 */
	@Test
	void anOldTextThatStandsTwiceAndOneThatIsNotThereAreBothReportedAndNothingIsChanged() {
		theTextAsItStoodBeforeV100();

		String oldSerbian = "- Planinarske akcije bez zvaničnog merenja vremena.\n\n### Član 16. Štafete";

		setBody("pravilnik", 5, "sr", bodyOf("pravilnik", 5, "sr") + "\n" + oldSerbian);
		setBody("pravilnik", 5, "en", bodyOf("pravilnik", 5, "en").replace("Hiking outings", "gone"));

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v100Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfRowsV100Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("the report must name both problems")
				.hasSize(theNumberOfRowsV100Edits())
				.contains("UNSCORED-01 article 15 @ pravilnik #5 sr: found 2 times",
						"UNSCORED-01 article 15 @ pravilnik #5 en: found 0 times");
		assertThat(everyText()).as("a refused V100 changed a page").isEqualTo(before);
	}

	/** A SECTION THAT ALREADY CARRIES THE NEW LINE BESIDE THE OLD TEXT STOPS V100, whatever the old text finds. */
	@Test
	void aNewTextThatIsAlreadyThereBesideTheOldOneStopsV100() {
		theTextAsItStoodBeforeV100();

		setBody("pravilnik", 5, "en", bodyOf("pravilnik", 5, "en") + "\n"
				+ TheWrittenPagesSayThatAnUnscoredRaceIsAPersonalRecordTest.THE_LAST_ITEM_THAT_WAS_IN_ENGLISH + "\n- "
				+ TheWrittenPagesSayThatAnUnscoredRaceIsAPersonalRecordTest.THE_SENTENCE_IN_ENGLISH + "\n\n### Article 16. Relays");

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v100Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfRowsV100Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("UNSCORED-01 article 15 @ pravilnik #5 en: found once, and its new text is already there");
	}

	/**
	 * A SIGN-OFF THAT IS NOT THE ONE V98 LEFT STOPS V100 and says which language: the day moves from 14.11.2026 and from no
	 * other, and a sign-off already on the new day beside the old one is refused like any new text that is already there.
	 */
	@Test
	void aSignOffThatIsNotTheOneV98LeftStopsV100AndOneAlreadyOnTheNewDayIsRefusedToo() {
		theTextAsItStoodBeforeV100();

		setBody("pravilnik", 19, "sr", bodyOf("pravilnik", 19, "sr").replace("Poslednja izmena: 14.11.2026.", "Poslednja izmena: 12.11.2026."));
		setBody("pravilnik", 19, "en", bodyOf("pravilnik", 19, "en") + "\nLast amended: 15.11.2026.");

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v100Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfRowsV100Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.contains("UNSCORED-02 sign-off @ pravilnik #19 sr: found 0 times",
						"UNSCORED-02 sign-off @ pravilnik #19 en: found once, and its new text is already there");
	}
}
