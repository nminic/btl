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
 * WHAT V107 DOES TO LEGAL PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> V107 only edits text, and every other case in this suite starts from a database V107 has just
 * finished editing, so by the time a case can look the text is the new text whether the migration did its work or was never
 * there. What these cases ask is what no other can: given the text that stood immediately BEFORE V107, does V107 give the
 * text the portal serves, change nothing else, and refuse every text it was not written for, itself included?
 *
 * <p><b>How the text before V107 is made.</b> V107 names the old text of every edit, so the pages are put back by the
 * reverse of each edit ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each new text standing exactly once to be taken
 * out. It is proved by behaviour, not by the shape of the undo: every case first asks whether the new address is really
 * gone and the old one is back.
 *
 * <p><b>Run twice.</b> A migration whose new text contains its old text would be found once over its own result and would
 * edit again. V107's old texts are whole sentences that the new ones no longer contain, and the case that runs it over the
 * finished text holds it: every one of the 125 edits finds its old text zero times.
 */
class TheWrittenPagesSpeakToTheReaderAsTiCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String POLICY = TheWrittenPagesSpeakToTheReaderAsTiTest.POLICY;
	private static final String TERMS = TheWrittenPagesSpeakToTheReaderAsTiTest.TERMS;
	private static final String RULEBOOK = TheWrittenPagesSpeakToTheReaderAsTiTest.RULEBOOK;

	/**
	 * V110 (24.11.2026) later took a row out of the policy and moved its sign-off, so what is asked here is asked of the text as
	 * V109 left it: the text V107 is run over, and the text it is compared with, are the ones V107 itself gave.
	 */
	@BeforeEach
	void theTextAsV109LeftIt() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "118");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "114");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "110");
	}

	/** 119 sentences and 3 sign-offs in each of two languages. */
	private static int theNumberOfEditsV107Makes() {
		return 125;
	}

	/**
	 * The Serbian sections V107 changes, as the list the owner approved places them: every section of the policy, the
	 * sections of the terms and of the rulebook that carry a sentence, the president's word, and the sign-off sections.
	 * Written out and not read out of V107, so a section V107 touched without the owner's list is a failure of this case.
	 */
	private static final List<String> THE_SECTIONS_V107_CHANGES = List.of(
			POLICY + " #1 sr", POLICY + " #2 sr", POLICY + " #3 sr", POLICY + " #4 sr", POLICY + " #5 sr", POLICY + " #6 sr",
			POLICY + " #7 sr",
			TERMS + " #1 sr", TERMS + " #3 sr", TERMS + " #4 sr", TERMS + " #5 sr", TERMS + " #6 sr", TERMS + " #8 sr",
			TERMS + " #9 sr", TERMS + " #11 sr",
			RULEBOOK + " #1 sr", RULEBOOK + " #2 sr", RULEBOOK + " #5 sr", RULEBOOK + " #8 sr", RULEBOOK + " #9 sr",
			RULEBOOK + " #12 sr", RULEBOOK + " #15 sr", RULEBOOK + " #17 sr", RULEBOOK + " #18 sr", RULEBOOK + " #19 sr",
			"rec-predsednika #1 sr",
			POLICY + " #7 en", TERMS + " #11 en", RULEBOOK + " #19 en");

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

	private void setBody(String slug, int position, String body) {
		int changed = db.sql("update static_page_section s set body = :body from static_page p"
						+ " where p.id = s.page_id and p.slug = :slug and s.position = :position")
				.param("body", body).param("slug", slug).param("position", position).update();

		assertThat(changed).as("there is no Serbian text of %s #%s to write", slug, position).isOne();
	}

	private TheWrittenPagesBeforeV71.Edit edit(String label) {
		return TheWrittenPagesBeforeV71.editsWithAFieldOf(migrationSql("107")).stream()
				.filter(each -> each.label().equals(label)).findFirst()
				.orElseThrow(() -> new AssertionError("V107 has no edit called " + label));
	}

	/** The pages as they stood before V107, and the proof that this is so: the old address is back and the new one is gone. */
	private void theTextAsItStoodBeforeV107() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "107");

		assertThat(bodyOf(POLICY, 1, "sr"))
				.as("the fixture did not put the old address back, so V107 below has nothing to change and this case measures nothing")
				.contains("Vašim podacima rukuje Sportsko udruženje BTL")
				.doesNotContain("Tvojim podacima rukuje");
		assertThat(bodyOf(POLICY, 7, "sr")).endsWith("Poslednja izmena: 16.11.2026.");
		assertThat(bodyOf(TERMS, 11, "sr")).endsWith("Poslednja izmena: 11.11.2026.");
		assertThat(bodyOf(RULEBOOK, 19, "sr")).endsWith("Poslednja izmena: 15.11.2026.");
	}

	private void v107() {
		jdbc.execute(migrationSql("107"));
	}

	/** V107 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v107Refused() {
		Throwable stopped = catchThrowable(this::v107);

		assertThat(stopped)
				.as("V107 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V107 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	/**
	 * V107 OVER THE TEXT IT FOUND GIVES THE TEXT THE PORTAL SERVES, character for character, in every heading and body of
	 * every page in both languages, and changes exactly the Serbian sections the owner's list names, and the three English
	 * sections that carry a sign-off, and no other: no other English section, no section of a page the list does not carry.
	 */
	@Test
	void v107OverTheTextItFoundGivesTheTextThePortalServesAndChangesNothingElse() {
		Map<String, String> finished = everyText();

		theTextAsItStoodBeforeV107();

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);

		v107();

		Map<String, String> after = everyText();

		assertThat(after).as("V107 over the text it found does not give the text the portal serves").isEqualTo(finished);

		List<String> changed = before.keySet().stream().filter(key -> !before.get(key).equals(after.get(key))).toList();

		assertThat(changed)
				.as("V107 changed a different set of sections than the ones the owner's list names")
				.containsExactlyInAnyOrderElementsOf(THE_SECTIONS_V107_CHANGES);
	}

	/**
	 * V107 OVER THE FINISHED TEXT STOPS AND LISTS EVERY EDIT, one line each, because each finds its old text zero times and
	 * finds its new text already there. Nothing is edited a second time: the finished text is the text the portal serves,
	 * unchanged by the refused run.
	 */
	@Test
	void v107RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		Map<String, String> finished = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v107Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the written pages were not edited")
				.contains(theNumberOfEditsV107Makes() + " of " + theNumberOfEditsV107Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V107 does not report one line for every edit it makes")
				.hasSize(theNumberOfEditsV107Makes())
				.allMatch(line -> line.endsWith(": found 0 times, and its new text is already there"))
				.contains("TI-001 politika-privatnosti #1 body @ politika-privatnosti #1 sr: found 0 times, and its new text is already there",
						"TI-118 politika-privatnosti #6 heading @ politika-privatnosti #6 sr: found 0 times, and its new text is already there",
						"TI-SIGNOFF pravilnik #19 body @ pravilnik #19 sr: found 0 times, and its new text is already there");
		assertThat(everyText()).as("a refused V107 changed a page").isEqualTo(finished);
	}

	/**
	 * AN OLD TEXT THAT STANDS TWICE STOPS V107 and says so, and an old text that is NOT there stops it at the same time: both
	 * are in the one report, and the statement is rolled back with nothing changed.
	 */
	@Test
	void anOldTextThatStandsTwiceAndOneThatIsNotThereAreBothReportedAndNothingIsChanged() {
		theTextAsItStoodBeforeV107();

		TheWrittenPagesBeforeV71.Edit twice = edit("TI-001 politika-privatnosti #1 body");
		TheWrittenPagesBeforeV71.Edit missing = edit("TI-104 pravilnik #9 body");

		setBody(POLICY, 1, bodyOf(POLICY, 1, "sr") + "\n" + twice.oldText());
		setBody(RULEBOOK, 9, bodyOf(RULEBOOK, 9, "sr").replace(missing.oldText(), "gone"));

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v107Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfEditsV107Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("the report must name both problems, and one line for every edit")
				.hasSize(theNumberOfEditsV107Makes())
				.contains("TI-001 politika-privatnosti #1 body @ politika-privatnosti #1 sr: found 2 times",
						"TI-104 pravilnik #9 body @ pravilnik #9 sr: found 0 times");
		assertThat(everyText()).as("a refused V107 changed a page").isEqualTo(before);
	}

	/** A SECTION THAT ALREADY CARRIES THE NEW SENTENCE BESIDE THE OLD TEXT STOPS V107, whatever the old text finds. */
	@Test
	void aNewTextThatIsAlreadyThereBesideTheOldOneStopsV107() {
		theTextAsItStoodBeforeV107();

		TheWrittenPagesBeforeV71.Edit one = edit("TI-001 politika-privatnosti #1 body");

		setBody(POLICY, 1, bodyOf(POLICY, 1, "sr") + "\n" + one.newText());

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v107Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfEditsV107Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("TI-001 politika-privatnosti #1 body @ politika-privatnosti #1 sr: found once, and its new text is already there");
	}

	/**
	 * A SIGN-OFF THAT IS NOT THE ONE V106 LEFT STOPS V107 and says which document: the day moves from the day each document
	 * was given and from no other, and a sign-off already on the new day beside the old one is refused like any new text
	 * that is already there.
	 */
	@Test
	void aSignOffThatIsNotTheOneV106LeftStopsV107AndOneAlreadyOnTheNewDayIsRefusedToo() {
		theTextAsItStoodBeforeV107();

		setBody(POLICY, 7, bodyOf(POLICY, 7, "sr").replace("Poslednja izmena: 16.11.2026.", "Poslednja izmena: 08.11.2026."));
		setBody(RULEBOOK, 19, bodyOf(RULEBOOK, 19, "sr") + "\nPoslednja izmena: 21.11.2026.");

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v107Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfEditsV107Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.contains("TI-SIGNOFF politika-privatnosti #7 body @ politika-privatnosti #7 sr: found 0 times",
						"TI-SIGNOFF pravilnik #19 body @ pravilnik #19 sr: found once, and its new text is already there");
	}

	/**
	 * THE ENGLISH IS NOT A HOME OF ANYTHING V107 EDITS: a sentence V107 would find in an English section is not touched,
	 * because it is looked for in the Serbian table only. An English section that carries a Serbian old text is left as it
	 * is by the run.
	 */
	@Test
	void anOldSerbianSentenceThatStandsInAnEnglishSectionIsLeftAlone() {
		theTextAsItStoodBeforeV107();

		TheWrittenPagesBeforeV71.Edit one = edit("TI-001 politika-privatnosti #1 body");
		String english = bodyOf(POLICY, 1, "en") + "\n" + one.oldText();

		db.sql("update static_page_section_translation t set body = :body from static_page_section s, static_page p"
						+ " where s.id = t.section_id and p.id = s.page_id and p.slug = :slug"
						+ " and s.position = 1 and t.language = 'en'")
				.param("body", english).param("slug", POLICY).update();

		v107();

		assertThat(bodyOf(POLICY, 1, "en")).isEqualTo(english);
		assertThat(bodyOf(POLICY, 1, "sr")).contains(one.newText()).doesNotContain(one.oldText());
	}
}
