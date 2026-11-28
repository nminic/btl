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
 * WHAT V118 DOES TO LEGAL PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> V118 only edits text, and every other case in this suite starts from a database V118 has just
 * finished editing, so by the time a case can look the text is the new text whether the migration did its work or was never
 * there. What these cases ask is what no other can: given the text that stood immediately BEFORE V118, does V118 give the text the
 * portal serves, change nothing else, and REFUSE every text it was not written for, itself included? The refusal is the point:
 * the pages are not editable through any screen, but a database whose Article 33 or 35 is not the text V118 was written against
 * must stop the migration, not skip the edit and leave the rulebook saying that a link or a picture is the only proof.
 *
 * <p><b>How the text before V118 is made.</b> V118 names the old text of every edit, so the pages are put back by the reverse of
 * each edit ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each new text standing exactly once to be taken out. It is proved by
 * behaviour, not by the shape of the undo: every case first asks whether the old words are really back and the day is the old one.
 */
class TheWrittenPagesAcceptACommentAsProofCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String RULEBOOK = TheWrittenPagesAcceptACommentAsProofTest.RULEBOOK;

	private static final List<String> EVERY_SECTION_IT_NAMES =
			List.of(RULEBOOK + " #9 sr", RULEBOOK + " #9 en", RULEBOOK + " #19 sr", RULEBOOK + " #19 en");

	private static int theNumberOfEditsV118Makes() {
		return 6;
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
		return TheWrittenPagesBeforeV71.bodyEditsOf(migrationSql("118")).stream()
				.filter(each -> each.label().equals(label) && each.language().equals(language)).findFirst()
				.orElseThrow(() -> new AssertionError("V118 has no edit called " + label + " in " + language));
	}

	/** The pages as they stood before V118, and the proof that this is so: the old words are back and the day is the old one. */
	private void theTextAsItStoodBeforeV118() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "118");

		assertThat(bodyOf(RULEBOOK, 9, "sr"))
				.as("the fixture did not put the Serbian words back, so V118 below has nothing to add and this case measures nothing")
				.contains(TheWrittenPagesAcceptACommentAsProofTest.THE_OLD_PHRASE_IN_SERBIAN)
				.doesNotContain("ko je merio");
		assertThat(bodyOf(RULEBOOK, 9, "en"))
				.as("the fixture did not put the English words back")
				.contains(TheWrittenPagesAcceptACommentAsProofTest.THE_OLD_PHRASE_IN_ENGLISH)
				.doesNotContain("who timed it");
		assertThat(bodyOf(RULEBOOK, 19, "sr")).endsWith("Poslednja izmena: 21.11.2026.");
		assertThat(bodyOf(RULEBOOK, 19, "en")).endsWith("Last amended: 21.11.2026.");
	}

	private void v118() {
		jdbc.execute(migrationSql("118"));
	}

	/** V118 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v118Refused() {
		Throwable stopped = catchThrowable(this::v118);

		assertThat(stopped)
				.as("V118 ran over text it was not written for and said nothing: a replace() that matches nothing passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V118 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	/**
	 * V118 OVER THE TEXT IT FOUND GIVES THE TEXT THE PORTAL SERVES, character for character, in every heading and body of every page
	 * in both languages, and changes exactly the sections it names and no other: sections 9 and 19 of the rulebook, in both languages.
	 */
	@Test
	void v118OverTheTextItFoundGivesTheTextThePortalServesAndChangesNothingElse() {
		Map<String, String> finished = everyText();

		theTextAsItStoodBeforeV118();

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);

		v118();

		Map<String, String> after = everyText();

		assertThat(after).as("V118 over the text it found does not give the text the portal serves").isEqualTo(finished);

		List<String> changed = before.keySet().stream().filter(key -> !before.get(key).equals(after.get(key))).toList();

		assertThat(changed).as("V118 changed a different set of sections than the ones its edits name")
				.containsExactlyInAnyOrderElementsOf(EVERY_SECTION_IT_NAMES);
	}

	/**
	 * V118 OVER THE FINISHED TEXT STOPS AND LISTS EVERY EDIT, one line each: the old text is found zero times and the new text is
	 * found already there, so nothing is added a second time. The finished text is the text the portal serves, unchanged by the
	 * refused run.
	 */
	@Test
	void v118RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		Map<String, String> finished = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v118Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the written pages were not edited")
				.contains(theNumberOfEditsV118Makes() + " of " + theNumberOfEditsV118Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V118 does not report one line for every edit it makes")
				.containsExactly(
						"PROOF-01 Article 33 @ pravilnik #9 sr: found 0 times, and its new text is already there",
						"PROOF-01 Article 33 @ pravilnik #9 en: found 0 times, and its new text is already there",
						"PROOF-02 Article 35 @ pravilnik #9 sr: found 0 times, and its new text is already there",
						"PROOF-02 Article 35 @ pravilnik #9 en: found 0 times, and its new text is already there",
						"PROOF-03 sign-off @ pravilnik #19 sr: found 0 times, and its new text is already there",
						"PROOF-03 sign-off @ pravilnik #19 en: found 0 times, and its new text is already there");
		assertThat(everyText()).as("a refused V118 changed a page").isEqualTo(finished);
	}

	/**
	 * A DATABASE WHOSE ARTICLE 35 IS NOT THE TEXT V118 WAS WRITTEN AGAINST STOPS V118, in each language, and says which: it does not
	 * skip the edit and it does not put the sentence somewhere else. Serbian has the last sentence reworded, English has the
	 * second reworded; the other four edits found their text and are in the same report.
	 */
	@Test
	void anArticleThirtyFiveThatIsNotTheOneV77LeftStopsV118InsteadOfSkippingTheEdit() {
		theTextAsItStoodBeforeV118();

		setBody(RULEBOOK, 9, "sr", bodyOf(RULEBOOK, 9, "sr").replace("Sliku brišemo čim proverimo rezultat.", "Sliku brišemo kad proverimo rezultat."));
		setBody(RULEBOOK, 9, "en", bodyOf(RULEBOOK, 9, "en").replace("what the picture shows.", "what the picture is."));

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v118Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfEditsV118Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("the report must name both problems and the four edits that were fine")
				.hasSize(theNumberOfEditsV118Makes())
				.contains("PROOF-02 Article 35 @ pravilnik #9 sr: found 0 times",
						"PROOF-02 Article 35 @ pravilnik #9 en: found 0 times",
						"PROOF-01 Article 33 @ pravilnik #9 sr: found once",
						"PROOF-01 Article 33 @ pravilnik #9 en: found once",
						"PROOF-03 sign-off @ pravilnik #19 sr: found once",
						"PROOF-03 sign-off @ pravilnik #19 en: found once");
		assertThat(everyText()).as("a refused V118 changed a page").isEqualTo(before);
	}

	/** AN OLD TEXT THAT STANDS TWICE STOPS V118 and says so, and nothing is changed. */
	@Test
	void anOldTextThatStandsTwiceStopsV118() {
		theTextAsItStoodBeforeV118();

		setBody(RULEBOOK, 9, "sr", bodyOf(RULEBOOK, 9, "sr") + "\n" + edit("PROOF-01 Article 33", "sr").oldText());

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v118Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfEditsV118Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("PROOF-01 Article 33 @ pravilnik #9 sr: found 2 times");
		assertThat(everyText()).as("a refused V118 changed a page").isEqualTo(before);
	}

	/** A SECTION THAT ALREADY CARRIES THE NEW TEXT BESIDE THE OLD TEXT STOPS V118, whatever the old text finds. */
	@Test
	void aNewTextThatIsAlreadyThereBesideTheOldOneStopsV118() {
		theTextAsItStoodBeforeV118();

		setBody(RULEBOOK, 9, "en", bodyOf(RULEBOOK, 9, "en") + "\n" + edit("PROOF-01 Article 33", "en").newText());

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v118Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfEditsV118Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("PROOF-01 Article 33 @ pravilnik #9 en: found once, and its new text is already there");
	}

	/**
	 * A SIGN-OFF THAT IS NOT THE ONE V107 LEFT STOPS V118 and says which language: the day moves from 21.11.2026 and from no other,
	 * and a sign-off already on the new day beside the old one is refused like any new text that is already there.
	 */
	@Test
	void aSignOffThatIsNotTheTwentyFirstStopsV118AndOneAlreadyOnTheNewDayIsRefusedToo() {
		theTextAsItStoodBeforeV118();

		setBody(RULEBOOK, 19, "sr", bodyOf(RULEBOOK, 19, "sr").replace("Poslednja izmena: 21.11.2026.", "Poslednja izmena: 14.11.2026."));
		setBody(RULEBOOK, 19, "en", bodyOf(RULEBOOK, 19, "en") + "\nLast amended: 28.11.2026.");

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v118Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfEditsV118Makes() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.contains("PROOF-03 sign-off @ pravilnik #19 sr: found 0 times",
						"PROOF-03 sign-off @ pravilnik #19 en: found once, and its new text is already there");
	}

	/**
	 * THE ENGLISH SENTENCE IS NOT LOOKED FOR IN THE SERBIAN TEXT, nor the Serbian in the English: each language is edited in its own
	 * section and the sentence goes in no other, so each stands once, in its own language.
	 */
	@Test
	void eachLanguageGetsItsOwnWordsInItsOwnText() {
		theTextAsItStoodBeforeV118();

		v118();

		assertThat(bodyOf(RULEBOOK, 9, "sr")).containsOnlyOnce(TheWrittenPagesAcceptACommentAsProofTest.THE_THIRD_SENTENCE_IN_SERBIAN)
				.doesNotContain(TheWrittenPagesAcceptACommentAsProofTest.THE_THIRD_SENTENCE_IN_ENGLISH)
				.doesNotContain(TheWrittenPagesAcceptACommentAsProofTest.THE_PHRASE_IN_ENGLISH);
		assertThat(bodyOf(RULEBOOK, 9, "en")).containsOnlyOnce(TheWrittenPagesAcceptACommentAsProofTest.THE_THIRD_SENTENCE_IN_ENGLISH)
				.doesNotContain(TheWrittenPagesAcceptACommentAsProofTest.THE_THIRD_SENTENCE_IN_SERBIAN)
				.doesNotContain(TheWrittenPagesAcceptACommentAsProofTest.THE_PHRASE_IN_SERBIAN);
	}
}
