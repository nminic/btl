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
 * WHAT V78 DOES TO LEGAL PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> V78 only edits text, and every other case in this suite starts from a database V78 has
 * just finished editing, so by the time a case can look the text is the new text whether the migration did its work or
 * was never there. What these cases ask is what no other can: given the text that stood immediately BEFORE V78, does V78
 * give the text the portal serves, change nothing else, and refuse every text it was not written for?
 *
 * <p><b>How the text before V78 is made.</b> V78 names the old text of every edit, so the pages are put back by the
 * reverse of each edit ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each new text standing exactly once to be taken
 * out. It is proved by behaviour, not by the shape of the undo: every case first asks the table of
 * {@link TheWrittenPagesKeepTheDucatsAndLoseTheMapTest} whether a piece of each old text really stands in the put-back
 * text, in both languages.
 *
 * <p><b>The floors of the sweeps.</b> A sweep that finds nothing is only worth something if it can find: asked of the
 * text before V78, the sweeps for the old ducat paragraph and for the map find them in the rulebook's section 18 and the
 * policy's section 2, in both languages.
 */
class TheWrittenPagesKeepTheDucatsAndLoseTheMapCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static int theNumberOfRowsV78Edits() {
		return TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.CHANGES.size() * 2;
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

	/** The pages as they stood before V78, and the proof that this is so: a piece of every old text stands again. */
	private void theTextAsItStoodBeforeV78() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "78");

		for (TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.Change change : TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.CHANGES) {
			assertThat(bodyOf(change.slug(), change.position(), "sr"))
					.as("%s: the fixture did not put the old Serbian text back, so V78 below has nothing to change and"
							+ " this case measures nothing", change.id())
					.contains(change.goneFromSerbian());
			assertThat(bodyOf(change.slug(), change.position(), "en"))
					.as("%s: the fixture did not put the old English text back", change.id())
					.contains(change.goneFromEnglish());
		}
	}

	private void v78() {
		jdbc.execute(migrationSql("78"));
	}

	/** V78 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v78Refused() {
		Throwable stopped = catchThrowable(this::v78);

		assertThat(stopped)
				.as("V78 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V78 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	/**
	 * V78 OVER THE TEXT IT FOUND GIVES THE TEXT THE PORTAL SERVES, character for character, in every heading and body of
	 * every page in both languages, and changes exactly the sections it names and no other: four rows, the rulebook's
	 * section 18 and the policy's section 2 in two languages.
	 */
	@Test
	void v78OverTheTextItFoundGivesTheTextThePortalServesAndChangesNothingElse() {
		Map<String, String> finished = everyText();

		theTextAsItStoodBeforeV78();

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);

		v78();

		Map<String, String> after = everyText();

		assertThat(after).as("V78 over the text it found does not give the text the portal serves").isEqualTo(finished);

		List<String> changed = before.keySet().stream().filter(key -> !before.get(key).equals(after.get(key))).toList();

		assertThat(changed)
				.as("V78 changed a different set of sections than the ones its edits name, in both languages")
				.containsExactlyInAnyOrder("pravilnik #18 sr", "pravilnik #18 en", "politika-privatnosti #2 sr",
						"politika-privatnosti #2 en");
	}

	/**
	 * V78 OVER THE FINISHED TEXT STOPS AND LISTS EVERY EDIT, one line each, because each finds its old text zero times.
	 * It stops at none of them first: the report is the whole list.
	 */
	@Test
	void v78RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		PSQLException error = v78Refused();

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the written pages were not edited")
				.contains(theNumberOfRowsV78Edits() + " of " + theNumberOfRowsV78Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V78 does not report one line for every edit it makes")
				.hasSize(theNumberOfRowsV78Edits())
				.allMatch(line -> line.contains(": found 0 times"))
				.contains("DUK-01 section 18 @ pravilnik #18 sr: found 0 times, and its new text is already there",
						"POL-20 section 2 @ politika-privatnosti #2 en: found 0 times, and its new text is already there");
	}

	/**
	 * AN OLD TEXT THAT STANDS TWICE STOPS V78 and says so, and an old text that is NOT there stops it at the same time:
	 * both are in the one report, and the statement is rolled back with nothing changed.
	 */
	@Test
	void anOldTextThatStandsTwiceAndOneThatIsNotThereAreBothReportedAndNothingIsChanged() {
		theTextAsItStoodBeforeV78();

		TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.Change ducats = TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.CHANGES
				.get(0);
		String oldSerbian = "Osvojen dukat ostaje trajno. Ne skida se kad dođe slabija godina, ni kad se uslovi kasnije promene,"
				+ " ni kad prestanete da se takmičite, i stoji na profilu kao zapis o onome što je istrčano.";

		setBody(ducats.slug(), ducats.position(), "sr", bodyOf(ducats.slug(), ducats.position(), "sr") + "\n" + oldSerbian);
		setBody(ducats.slug(), ducats.position(), "en",
				bodyOf(ducats.slug(), ducats.position(), "en").replace(ducats.goneFromEnglish(), "gone"));

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v78Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfRowsV78Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("the report must name both problems and the edits that found their text once")
				.hasSize(theNumberOfRowsV78Edits())
				.contains("DUK-01 section 18 @ pravilnik #18 sr: found 2 times",
						"DUK-01 section 18 @ pravilnik #18 en: found 0 times")
				.filteredOn(line -> line.endsWith("found once"))
				.hasSize(theNumberOfRowsV78Edits() - 2);
		assertThat(everyText()).as("a refused V78 changed a page").isEqualTo(before);
	}

	/** A SECTION THAT ALREADY CARRIES THE NEW TEXT BESIDE THE OLD ONE STOPS V78, whatever the old text finds. */
	@Test
	void aNewTextThatIsAlreadyThereBesideTheOldOneStopsV78() {
		theTextAsItStoodBeforeV78();

		TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.Change ducats = TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.CHANGES
				.get(0);

		setBody(ducats.slug(), ducats.position(), "sr",
				bodyOf(ducats.slug(), ducats.position(), "sr") + "\n" + ducats.standsInSerbian());

		PSQLException error = v78Refused();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfRowsV78Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("DUK-01 section 18 @ pravilnik #18 sr: found once, and its new text is already there");
	}

	/**
	 * THE FLOORS OF THE SWEEPS: asked of the text before V78, the sweep for the old ducat paragraph finds it in the
	 * rulebook's section 18 and the sweep for the map finds it in the policy's section 2, in both languages. A pattern that
	 * had gone blind would pass the sweeps of the other class on any text.
	 */
	@Test
	void theSweepsFindWhatTheyKeepOutInTheTextBeforeV78() {
		theTextAsItStoodBeforeV78();

		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.THE_OLD_DUCAT_PARAGRAPH_IN_SERBIAN))
				.as("the Serbian sweep for the old ducat paragraph cannot see it in the text that held it")
				.containsExactly("pravilnik #18");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.THE_OLD_DUCAT_PARAGRAPH_IN_ENGLISH))
				.as("the English sweep for the old ducat paragraph cannot see it in the text that held it")
				.containsExactly("pravilnik #18");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.A_MAP_IN_SERBIAN))
				.as("the Serbian sweep for the map cannot see it in the text that held it")
				.containsExactly("politika-privatnosti #2");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				TheWrittenPagesKeepTheDucatsAndLoseTheMapTest.A_MAP_IN_ENGLISH))
				.as("the English sweep for the map cannot see it in the text that held it")
				.containsExactly("politika-privatnosti #2");
	}
}
