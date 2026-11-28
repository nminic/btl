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
 * WHAT V102 DOES TO LEGAL PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> V102 only edits text, and every other case in this suite starts from a database V102 has just
 * finished editing, so by the time a case can look the text is the new text whether the migration did its work or was never
 * there. What these cases ask is what no other can: given the text that stood immediately BEFORE V102, does V102 give the text
 * the portal serves, change nothing else, and refuse every text it was not written for, itself included?
 *
 * <p><b>How the text before V102 is made.</b> V102 names the old text of every edit, so the pages are put back by the
 * reverse of each edit ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each new text standing exactly once to be taken
 * out. It is proved by behaviour, not by the shape of the undo: every case first asks whether the sentence is really gone.
 *
 * <p><b>Run twice.</b> A migration whose new text contains its old text would be found once over its own result and would add
 * the sentence again. V102's old texts run on to the heading after the list for that reason, and the case that runs it over the
 * finished text holds it.
 */
class TheWrittenPagesSayWhatASharedProfileShowsCarriedOverTest extends DatabaseTest {

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

	private static final String POLICY = TheWrittenPagesSayWhatASharedProfileShowsTest.POLICY;

	private static int theNumberOfRowsV102Edits() {
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

	/** The pages as they stood before V102, and the proof that this is so: the sentence is gone in both languages. */
	private void theTextAsItStoodBeforeV102() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "102");

		assertThat(bodyOf(POLICY, 3, "sr"))
				.as("the fixture did not take the Serbian sentence out, so V102 below has nothing to add and this case measures nothing")
				.doesNotContain(TheWrittenPagesSayWhatASharedProfileShowsTest.THE_SENTENCE_IN_SERBIAN)
				.contains(TheWrittenPagesSayWhatASharedProfileShowsTest.THE_END_OF_THE_LIST_IN_SERBIAN);
		assertThat(bodyOf(POLICY, 3, "en"))
				.as("the fixture did not take the English sentence out")
				.doesNotContain(TheWrittenPagesSayWhatASharedProfileShowsTest.THE_SENTENCE_IN_ENGLISH)
				.contains(TheWrittenPagesSayWhatASharedProfileShowsTest.THE_END_OF_THE_LIST_IN_ENGLISH);
	}

	private void v100() {
		jdbc.execute(migrationSql("102"));
	}

	/** V102 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v100Refused() {
		Throwable stopped = catchThrowable(this::v100);

		assertThat(stopped)
				.as("V102 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V102 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	/**
	 * V102 OVER THE TEXT IT FOUND GIVES THE TEXT THE PORTAL SERVES, character for character, in every heading and body of
	 * every page in both languages, and changes exactly the sections it names and no other: sections 3 and 7 of the policy,
	 * in both languages. The sign-offs of the rulebook and of the terms, the other sections and the other pages are among the ones it leaves alone.
	 */
	@Test
	void v100OverTheTextItFoundGivesTheTextThePortalServesAndChangesNothingElse() {
		Map<String, String> finished = everyText();

		theTextAsItStoodBeforeV102();

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);

		v100();

		Map<String, String> after = everyText();

		assertThat(after).as("V102 over the text it found does not give the text the portal serves").isEqualTo(finished);

		List<String> changed = before.keySet().stream().filter(key -> !before.get(key).equals(after.get(key))).toList();

		assertThat(changed)
				.as("V102 changed a different set of sections than the ones its edits name")
				.containsExactlyInAnyOrder(POLICY + " #3 sr", POLICY + " #3 en", POLICY + " #7 sr", POLICY + " #7 en");
	}

	/**
	 * V102 OVER THE FINISHED TEXT STOPS AND LISTS EVERY EDIT, one line each, because each finds its old text zero times. The
	 * sentence is not added a second time: the finished text is the text the portal serves, unchanged by the refused run.
	 */
	@Test
	void v100RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		Map<String, String> finished = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v100Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the written pages were not edited")
				.contains(theNumberOfRowsV102Edits() + " of " + theNumberOfRowsV102Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V102 does not report one line for every edit it makes")
				.hasSize(theNumberOfRowsV102Edits())
				.allMatch(line -> line.contains(": found 0 times"))
				.contains("SHARED-01 section 3 @ politika-privatnosti #3 sr: found 0 times, and its new text is already there",
						"SHARED-01 section 3 @ politika-privatnosti #3 en: found 0 times, and its new text is already there",
						"SHARED-02 sign-off @ politika-privatnosti #7 sr: found 0 times, and its new text is already there",
						"SHARED-02 sign-off @ politika-privatnosti #7 en: found 0 times, and its new text is already there");
		assertThat(everyText()).as("a refused V102 changed a page").isEqualTo(finished);
	}

	/**
	 * AN OLD TEXT THAT STANDS TWICE STOPS V102 and says so, and an old text that is NOT there stops it at the same time:
	 * both are in the one report, and the statement is rolled back with nothing changed.
	 */
	@Test
	void anOldTextThatStandsTwiceAndOneThatIsNotThereAreBothReportedAndNothingIsChanged() {
		theTextAsItStoodBeforeV102();

		String oldSerbian = TheWrittenPagesSayWhatASharedProfileShowsTest.THE_END_OF_THE_LIST_IN_SERBIAN + "\n\n### Podaci koji nisu javni";

		setBody(POLICY, 3, "sr", bodyOf(POLICY, 3, "sr") + "\n" + oldSerbian);
		setBody(POLICY, 3, "en", bodyOf(POLICY, 3, "en").replace("and links you add yourself.", "gone"));

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v100Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfRowsV102Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("the report must name both problems")
				.hasSize(theNumberOfRowsV102Edits())
				.contains("SHARED-01 section 3 @ politika-privatnosti #3 sr: found 2 times",
						"SHARED-01 section 3 @ politika-privatnosti #3 en: found 0 times");
		assertThat(everyText()).as("a refused V102 changed a page").isEqualTo(before);
	}

	/** A SECTION THAT ALREADY CARRIES THE NEW PARAGRAPH BESIDE THE OLD TEXT STOPS V102, whatever the old text finds. */
	@Test
	void aNewTextThatIsAlreadyThereBesideTheOldOneStopsV102() {
		theTextAsItStoodBeforeV102();

		setBody(POLICY, 3, "en", bodyOf(POLICY, 3, "en") + "\n"
				+ TheWrittenPagesSayWhatASharedProfileShowsTest.THE_END_OF_THE_LIST_IN_ENGLISH + "\n\n"
				+ TheWrittenPagesSayWhatASharedProfileShowsTest.THE_SENTENCE_IN_ENGLISH + "\n\n### Data that is not public");

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v100Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfRowsV102Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("SHARED-01 section 3 @ politika-privatnosti #3 en: found once, and its new text is already there");
	}

	/**
	 * A SIGN-OFF THAT IS NOT THE ONE V95 LEFT STOPS V102 and says which language: the day moves from 11.11.2026 and from no
	 * other, and a sign-off already on the new day beside the old one is refused like any new text that is already there.
	 */
	@Test
	void aSignOffThatIsNotTheOneV95LeftStopsV102AndOneAlreadyOnTheNewDayIsRefusedToo() {
		theTextAsItStoodBeforeV102();

		setBody(POLICY, 7, "sr", bodyOf(POLICY, 7, "sr").replace("Poslednja izmena: 11.11.2026.", "Poslednja izmena: 08.11.2026."));
		setBody(POLICY, 7, "en", bodyOf(POLICY, 7, "en") + "\nLast amended: 16.11.2026.");

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v100Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfRowsV102Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.contains("SHARED-02 sign-off @ politika-privatnosti #7 sr: found 0 times",
						"SHARED-02 sign-off @ politika-privatnosti #7 en: found once, and its new text is already there");
	}
}
