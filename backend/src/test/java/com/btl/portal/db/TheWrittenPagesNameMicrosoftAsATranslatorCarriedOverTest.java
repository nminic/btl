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
 * WHAT V114 DOES TO LEGAL PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> V114 only edits text, and every other case in this suite starts from a database V114 has just
 * finished editing, so by the time a case can look the text is the new text whether the migration did its work or was never
 * there. What these cases ask is what no other can: given the text that stood immediately BEFORE V114, does V114 give the text
 * the portal serves, change nothing else, and REFUSE every text it was not written for, itself included? The refusal is the
 * point: a database that does not hold the row of Zoho followed by the row of the bank must stop the migration, not skip the
 * edit and leave the policy silent about the processor.
 *
 * <p><b>How the text before V114 is made.</b> V114 names the old text of every edit, so the pages are put back by the reverse of
 * each edit ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each new text standing exactly once to be taken out. It is proved
 * by behaviour, not by the shape of the undo: every case first asks whether the row is really gone and the day is the old one.
 */
class TheWrittenPagesNameMicrosoftAsATranslatorCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String POLICY = TheWrittenPagesNameMicrosoftAsATranslatorTest.POLICY;

	private static int theNumberOfEditsV114Makes() {
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

	private TheWrittenPagesBeforeV71.Edit edit(String label, String language) {
		return TheWrittenPagesBeforeV71.bodyEditsOf(migrationSql("114")).stream()
				.filter(each -> each.label().equals(label) && each.language().equals(language)).findFirst()
				.orElseThrow(() -> new AssertionError("V114 has no edit called " + label + " in " + language));
	}

	/** The pages as they stood before V114, and the proof that this is so: the row is gone and the day is the old one. */
	private void theTextAsItStoodBeforeV114() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "114");

		assertThat(bodyOf(POLICY, 5, "sr"))
				.as("the fixture did not take the Serbian row out, so V114 below has nothing to add and this case measures nothing")
				.doesNotContain("Microsoft").contains(TheWrittenPagesNameMicrosoftAsATranslatorTest.ZOHO_IN_SERBIAN
						+ "\n" + TheWrittenPagesNameMicrosoftAsATranslatorTest.BANK_IN_SERBIAN);
		assertThat(bodyOf(POLICY, 5, "en"))
				.as("the fixture did not take the English row out").doesNotContain("Microsoft")
				.contains(TheWrittenPagesNameMicrosoftAsATranslatorTest.ZOHO_IN_ENGLISH
						+ "\n" + TheWrittenPagesNameMicrosoftAsATranslatorTest.BANK_IN_ENGLISH);
		assertThat(bodyOf(POLICY, 7, "sr")).endsWith("Poslednja izmena: 24.11.2026.");
		assertThat(bodyOf(POLICY, 7, "en")).endsWith("Last amended: 24.11.2026.");
	}

	private void v114() {
		jdbc.execute(migrationSql("114"));
	}

	/** V114 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v114Refused() {
		Throwable stopped = catchThrowable(this::v114);

		assertThat(stopped)
				.as("V114 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V114 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	/**
	 * V114 OVER THE TEXT IT FOUND GIVES THE TEXT THE PORTAL SERVES, character for character, in every heading and body of every
	 * page in both languages, and changes exactly the sections it names and no other: sections 5 and 7 of the policy, in both
	 * languages.
	 */
	@Test
	void v114OverTheTextItFoundGivesTheTextThePortalServesAndChangesNothingElse() {
		Map<String, String> finished = everyText();

		theTextAsItStoodBeforeV114();

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);

		v114();

		Map<String, String> after = everyText();

		assertThat(after).as("V114 over the text it found does not give the text the portal serves").isEqualTo(finished);

		List<String> changed = before.keySet().stream().filter(key -> !before.get(key).equals(after.get(key))).toList();

		assertThat(changed).as("V114 changed a different set of sections than the ones its edits name")
				.containsExactlyInAnyOrder(POLICY + " #5 sr", POLICY + " #5 en", POLICY + " #7 sr", POLICY + " #7 en");
	}

	/**
	 * V114 OVER THE FINISHED TEXT STOPS AND LISTS EVERY EDIT, one line each. The row is not added a second time: the pair of rows
	 * V114 asks for is no longer there, so the old text is found zero times and the new text is found already there. The finished
	 * text is the text the portal serves, unchanged by the refused run.
	 */
	@Test
	void v114RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		Map<String, String> finished = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v114Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the written pages were not edited")
				.contains(theNumberOfEditsV114Makes() + " of " + theNumberOfEditsV114Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V114 does not report one line for every edit it makes")
				.containsExactly(
						"MICROSOFT-01 section 5 @ politika-privatnosti #5 sr: found 0 times, and its new text is already there",
						"MICROSOFT-01 section 5 @ politika-privatnosti #5 en: found 0 times, and its new text is already there",
						"MICROSOFT-02 sign-off @ politika-privatnosti #7 sr: found 0 times, and its new text is already there",
						"MICROSOFT-02 sign-off @ politika-privatnosti #7 en: found 0 times, and its new text is already there");
		assertThat(everyText()).as("a refused V114 changed a page").isEqualTo(finished);
	}

	/**
	 * A DATABASE THAT DOES NOT HOLD THE ROW OF ZOHO FOLLOWED BY THE ROW OF THE BANK STOPS V114, in each language, and says which: it
	 * does not skip the edit, and it does not add the row somewhere else. Serbian has Zoho and the bank apart, English has the bank
	 * changed, and both are in the one report with the two edits that did find their text.
	 */
	@Test
	void aTableWithoutTheRowOfZohoDirectlyAboveTheBankStopsV114InsteadOfSkippingTheEdit() {
		theTextAsItStoodBeforeV114();

		String serbian = bodyOf(POLICY, 5, "sr");
		String zoho = TheWrittenPagesNameMicrosoftAsATranslatorTest.ZOHO_IN_SERBIAN;

		setBody(POLICY, 5, "sr", serbian.replace(zoho + "\n", zoho + "\n| Neki red | koji je ovde | Srbija |\n"));
		setBody(POLICY, 5, "en", bodyOf(POLICY, 5, "en").replace("Data from the payment order", "Data of the payment"));

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v114Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfEditsV114Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("the report must name both problems and both edits that were fine")
				.hasSize(theNumberOfEditsV114Makes())
				.contains("MICROSOFT-01 section 5 @ politika-privatnosti #5 sr: found 0 times",
						"MICROSOFT-01 section 5 @ politika-privatnosti #5 en: found 0 times",
						"MICROSOFT-02 sign-off @ politika-privatnosti #7 sr: found once",
						"MICROSOFT-02 sign-off @ politika-privatnosti #7 en: found once");
		assertThat(everyText()).as("a refused V114 changed a page").isEqualTo(before);
	}

	/** AN OLD TEXT THAT STANDS TWICE STOPS V114 and says so, and nothing is changed. */
	@Test
	void anOldTextThatStandsTwiceStopsV114() {
		theTextAsItStoodBeforeV114();

		setBody(POLICY, 5, "sr", bodyOf(POLICY, 5, "sr") + "\n" + edit("MICROSOFT-01 section 5", "sr").oldText());

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v114Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfEditsV114Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("MICROSOFT-01 section 5 @ politika-privatnosti #5 sr: found 2 times");
		assertThat(everyText()).as("a refused V114 changed a page").isEqualTo(before);
	}

	/** A SECTION THAT ALREADY CARRIES THE NEW TEXT BESIDE THE OLD TEXT STOPS V114, whatever the old text finds. */
	@Test
	void aNewTextThatIsAlreadyThereBesideTheOldOneStopsV114() {
		theTextAsItStoodBeforeV114();

		setBody(POLICY, 5, "en", bodyOf(POLICY, 5, "en") + "\n" + edit("MICROSOFT-01 section 5", "en").newText());

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v114Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfEditsV114Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("MICROSOFT-01 section 5 @ politika-privatnosti #5 en: found once, and its new text is already there");
	}

	/**
	 * A SIGN-OFF THAT IS NOT THE ONE V110 LEFT STOPS V114 and says which language: the day moves from 24.11.2026 and from no other,
	 * and a sign-off already on the new day beside the old one is refused like any new text that is already there.
	 */
	@Test
	void aSignOffThatIsNotTheOneV110LeftStopsV114AndOneAlreadyOnTheNewDayIsRefusedToo() {
		theTextAsItStoodBeforeV114();

		setBody(POLICY, 7, "sr", bodyOf(POLICY, 7, "sr").replace("Poslednja izmena: 24.11.2026.", "Poslednja izmena: 21.11.2026."));
		setBody(POLICY, 7, "en", bodyOf(POLICY, 7, "en") + "\nLast amended: 25.11.2026.");

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v114Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfEditsV114Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.contains("MICROSOFT-02 sign-off @ politika-privatnosti #7 sr: found 0 times",
						"MICROSOFT-02 sign-off @ politika-privatnosti #7 en: found once, and its new text is already there");
	}

	/**
	 * THE ENGLISH ROW IS NOT LOOKED FOR IN THE SERBIAN TABLE, nor the Serbian in the English: each language is edited in its own
	 * section and the row goes in no other, so the English row appears once, under the English Zoho, and the Serbian once, under
	 * the Serbian.
	 */
	@Test
	void eachLanguageGetsItsOwnRowInItsOwnTable() {
		theTextAsItStoodBeforeV114();

		v114();

		assertThat(bodyOf(POLICY, 5, "sr")).containsOnlyOnce(TheWrittenPagesNameMicrosoftAsATranslatorTest.THE_ROW_IN_SERBIAN)
				.doesNotContain(TheWrittenPagesNameMicrosoftAsATranslatorTest.THE_ROW_IN_ENGLISH);
		assertThat(bodyOf(POLICY, 5, "en")).containsOnlyOnce(TheWrittenPagesNameMicrosoftAsATranslatorTest.THE_ROW_IN_ENGLISH)
				.doesNotContain(TheWrittenPagesNameMicrosoftAsATranslatorTest.THE_ROW_IN_SERBIAN);
	}
}
