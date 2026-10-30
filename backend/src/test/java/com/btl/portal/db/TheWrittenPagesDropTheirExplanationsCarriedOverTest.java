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
 * WHAT V77 DOES TO LEGAL PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> V77 only edits text, and every other case in this suite starts from a database V77 has
 * just finished editing, so by the time a case can look the text is the new text whether the migration did its work
 * or was never there. What these cases ask is what no other can: given the text that stood immediately BEFORE V77, does
 * V77 give the text the portal serves, change nothing else, and refuse every text it was not written for?
 *
 * <p><b>How the text before V77 is made.</b> V77 names the old text of every edit, so the pages are put back by the
 * reverse of each edit ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each new text standing exactly once to be
 * taken out. That is shared with the guards of the older migrations, which first need the pages as V76 left them. It is
 * proved by behaviour, not by the shape of the undo: every case first asks the table of
 * {@link TheWrittenPagesDropTheirExplanationsTest}, written by hand from the draft the owner approved, whether a
 * piece of each old text really stands in the put-back text, in both languages.
 *
 * <p><b>The floors of the two sweeps.</b> A sweep that finds nothing is only worth something if it can find: asked of
 * the text before V77, the sweep for the exemption finds it in the four sections that hold the five places the
 * owner counted (Article 10, Article 11 twice, the terms in sections 3 and 4) in Serbian and in English, and in
 * English also in the policy's sentence about a decision on the fee, which names no root; the sweep for the familiar
 * phrase finds it in Article 8 in both.
 */
class TheWrittenPagesDropTheirExplanationsCarriedOverTest extends DatabaseTest {

	private static final String OLD_SERBIAN = "Ako vam posle toga neki rezultat nedostaje, samo nam se javite: upisaćemo ga da vam"
			+ " profil bude potpun, s tim što on više ne ulazi u tabele, rang liste ni priznanja.";
	private static final String OLD_ENGLISH = "If a result is still missing after that, just get in touch: we will enter it so that"
			+ " your profile is complete, but it no longer enters the tables, rankings, or awards.";

	@Autowired
	JdbcTemplate jdbc;

	private static int theNumberOfRowsV77Edits() {
		return TheWrittenPagesDropTheirExplanationsTest.CHANGES.size() * 2;
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

	/** The pages as they stood before V77, and the proof that this is so: a piece of every old text stands again. */
	private void theTextAsItStoodBeforeV77() {
		/* V78 (29.10.2026) edited two of the sections V77 edits, so it is undone first, read out of V78 itself, and V80
		   (30.10.2026) moved the rulebook's sign-off on from the day V77 gave it, so it is undone before that. */
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "80");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "78");

		theTextAsItStoodBeforeV77WhenV78IsAlreadyUndone();
	}

	/** The same, for the case that has already put the pages back to the text V77 left and kept a copy of it. */
	private void theTextAsItStoodBeforeV77WhenV78IsAlreadyUndone() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "77");

		for (TheWrittenPagesDropTheirExplanationsTest.Change change : TheWrittenPagesDropTheirExplanationsTest.CHANGES) {
			assertThat(bodyOf(change.slug(), change.position(), "sr"))
					.as("%s: the fixture did not put the old Serbian text back, so V77 below has nothing to change and"
							+ " this case measures nothing", change.id())
					.contains(change.goneFromSerbian());
			assertThat(bodyOf(change.slug(), change.position(), "en"))
					.as("%s: the fixture did not put the old English text back", change.id())
					.contains(change.goneFromEnglish());
		}
	}

	private void v77() {
		jdbc.execute(migrationSql("77"));
	}

	/** V77 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v77Refused() {
		Throwable stopped = catchThrowable(this::v77);

		assertThat(stopped)
				.as("V77 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V77 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	/**
	 * V77 OVER THE TEXT IT FOUND GIVES THE TEXT THE PORTAL SERVES, character for character, in every heading and body of
	 * every page in both languages, and changes exactly the sections it names and no other.
	 */
	@Test
	void v77OverTheTextItFoundGivesTheTextV77LeftAndChangesNothingElse() {
		/* The text the portal serves carries V78 on top (29.10.2026), which edits two of the sections V77 edits, so V78 is
		   undone first and what V77 is compared to is the text V77 itself left (V80 of 30.10.2026 first of all, since it
		   moved the sign-off V77 wrote). */
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "80");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "78");

		Map<String, String> finished = everyText();

		theTextAsItStoodBeforeV77WhenV78IsAlreadyUndone();

		Map<String, String> before = everyText();

		assertThat(before).as("putting the text back changed nothing, so this measures nothing").isNotEqualTo(finished);

		v77();

		Map<String, String> after = everyText();

		assertThat(after).as("V77 over the text it found does not give the text V77 left").isEqualTo(finished);

		long named = TheWrittenPagesDropTheirExplanationsTest.CHANGES.stream()
				.map(change -> change.slug() + " #" + change.position())
				.distinct()
				.count() * 2;
		long changed = before.keySet().stream().filter(key -> !before.get(key).equals(after.get(key))).count();

		assertThat(changed)
				.as("V77 changed a different number of sections than the ones its edits name, in both languages")
				.isEqualTo(named);
	}

	/**
	 * V77 OVER THE FINISHED TEXT STOPS AND LISTS EVERY EDIT, one line each, because each finds its old text zero times.
	 * It stops at none of them first: the report is the whole list.
	 */
	@Test
	void v77RunAgainOverTheFinishedTextStopsAndListsEveryEdit() {
		PSQLException error = v77Refused();

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the written pages were not edited")
				.contains(theNumberOfRowsV77Edits() + " of " + theNumberOfRowsV77Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("V77 does not report one line for every edit it makes")
				.hasSize(theNumberOfRowsV77Edits())
				.allMatch(line -> line.contains(": found 0 times"))
				.contains("PRAV-01 Article 8 @ pravilnik #2 sr: found 0 times, and its new text is already there",
						"USL-11 sign-off @ uslovi-koriscenja #11 en: found 0 times, and its new text is already there");
	}

	/**
	 * AN OLD TEXT THAT STANDS TWICE STOPS V77 and says so, and an old text that is NOT there stops it at the same time:
	 * both are in the one report, and the statement is rolled back with nothing changed.
	 */
	@Test
	void anOldTextThatStandsTwiceAndOneThatIsNotThereAreBothReportedAndNothingIsChanged() {
		theTextAsItStoodBeforeV77();
		setBody(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 2, "sr",
				bodyOf(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 2, "sr") + "\n" + OLD_SERBIAN);
		setBody(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 2, "en",
				bodyOf(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 2, "en").replace(OLD_ENGLISH, "gone"));

		Map<String, String> before = everyText();

		jdbc.execute("savepoint before_the_refusal");

		PSQLException error = v77Refused();

		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of " + theNumberOfRowsV77Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail().lines().toList())
				.as("the report must name both problems and the edits that found their text once")
				.hasSize(theNumberOfRowsV77Edits())
				.contains("PRAV-01 Article 8 @ pravilnik #2 sr: found 2 times",
						"PRAV-01 Article 8 @ pravilnik #2 en: found 0 times")
				.filteredOn(line -> line.endsWith("found once"))
				.hasSize(theNumberOfRowsV77Edits() - 2);
		assertThat(everyText()).as("a refused V77 changed a page").isEqualTo(before);
	}

	/** A SECTION THAT ALREADY CARRIES THE NEW TEXT BESIDE THE OLD ONE STOPS V77, whatever the old text finds. */
	@Test
	void aNewTextThatIsAlreadyThereBesideTheOldOneStopsV77() {
		theTextAsItStoodBeforeV77();

		String newSerbian = TheWrittenPagesDropTheirExplanationsTest.CHANGES.get(0).standsInSerbian();

		setBody(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 2, "sr",
				bodyOf(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 2, "sr") + "\n" + newSerbian);

		PSQLException error = v77Refused();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of " + theNumberOfRowsV77Edits() + " edits");
		assertThat(error.getServerErrorMessage().getDetail())
				.contains("PRAV-01 Article 8 @ pravilnik #2 sr: found once, and its new text is already there");
	}

	/**
	 * A STRIKE THAT LEAVES THE SENTENCE BEFORE IT IS NOT "ALREADY THERE": the new text of a strike is a piece of its own
	 * old text, and V77 asks about it with the old text taken out. Held by the fact that the whole run above succeeds,
	 * and by this case in the one place the difference is sharpest: the new text of PRAV-13 is the first sentence of
	 * its old text, which stands in the section exactly once before V77 and must not stop it.
	 */
	@Test
	void theNewTextOfAStrikeThatIsAPieceOfItsOldTextDoesNotStopV77() {
		theTextAsItStoodBeforeV77();

		String sentence = "Tabele se osvežavaju odmah posle svakog verifikovanog rezultata.";

		assertThat(bodyOf(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 11, "sr"))
				.as("PRAV-13: the sentence that stays must be a piece of the text that goes")
				.contains(sentence + " Periodičnog obračuna nema.");

		v77();

		assertThat(bodyOf(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 11, "sr"))
				.containsOnlyOnce(sentence)
				.doesNotContain("Periodičnog obračuna nema");
	}

	/**
	 * THE FORMS OF THE EXEMPTION SWEEP THAT NAME NO ROOT STAND ON A FLOOR OF THEIR OWN, in both languages (PR 657
	 * review, 29.10.2026: putting the old English list back stayed green, because the text before V77 holds no English
	 * mention that only the new forms catch, so nothing asked whether those forms see). The sentence the review named
	 * is written into a section of the rulebook, with its Serbian pair, and the sweep must find it in each language: the
	 * Serbian form {@code ne pla[ćct]} sees "ne plati", the English {@code not pay} sees "does not pay". The sentence
	 * is written over the current text and not over the text before V77, because what is asked is whether the
	 * patterns see it, wherever it stands.
	 */
	@Test
	void theSweepsSeeTheOfferOfAnExemptionThatNamesNoRoot() {
		String serbian = "Upravni odbor može da odluči da član ne plati članarinu.";
		String english = "The Managing Board may decide that a member does not pay the membership fee.";

		setBody(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 4, "sr",
				bodyOf(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 4, "sr") + "\n\n" + serbian);
		setBody(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 4, "en",
				bodyOf(TheWrittenPagesDropTheirExplanationsTest.RULEBOOK, 4, "en") + "\n\n" + english);

		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				TheWrittenPagesDropTheirExplanationsTest.AN_EXEMPTION_IN_SERBIAN))
				.as("the Serbian sweep does not see an offer of the exemption that names no root")
				.containsExactly("pravilnik #4");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				TheWrittenPagesDropTheirExplanationsTest.AN_EXEMPTION_IN_ENGLISH))
				.as("the English sweep does not see an offer of the exemption that names no root")
				.containsExactly("pravilnik #4");
	}

	/**
	 * THE FLOORS OF THE TWO SWEEPS: asked of the text before V77, the sweep for the exemption finds it in the four
	 * sections of the Serbian text that held the owner's five places (PDL 29.10.2026) and in the same four of the English,
	 * and the English sweep finds it in the policy as well, in the sentence about the name that stays with a decision.
	 * That sentence names no root in Serbian ("odobrili da neko plati manje ili da ne plati članarinu", section 5 of the
	 * policy, edited by V77), and the Serbian sweep sees it only through its forms without the root, which is what holds
	 * those forms: a sweep that asked for the root alone would miss it here, and miss the same sentence written anew. The
	 * same forms see "ne plaća za pristup sajtu" in section 2 of the terms, which V77 also strikes (USL-01). The sweep for
	 * the familiar phrase finds it in Article 8. A pattern that had gone blind would pass the sweeps of the other class on
	 * any text.
	 */
	@Test
	void theSweepsFindWhatTheyKeepOutInTheTextBeforeV77() {
		theTextAsItStoodBeforeV77();

		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				TheWrittenPagesDropTheirExplanationsTest.AN_EXEMPTION_IN_SERBIAN))
				.as("the Serbian sweep for the exemption cannot see it in the text that held it")
				.containsExactlyInAnyOrder("pravilnik #3", "pravilnik #4", "uslovi-koriscenja #2", "uslovi-koriscenja #3",
						"uslovi-koriscenja #4", "politika-privatnosti #5");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				TheWrittenPagesDropTheirExplanationsTest.AN_EXEMPTION_IN_ENGLISH))
				.as("the English sweep for the exemption cannot see it in the text that held it")
				.containsExactlyInAnyOrder("pravilnik #3", "pravilnik #4", "uslovi-koriscenja #3", "uslovi-koriscenja #4",
						"politika-privatnosti #5");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				TheWrittenPagesDropTheirExplanationsTest.A_FAMILIAR_PHRASE_IN_SERBIAN))
				.containsExactly("pravilnik #2");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				TheWrittenPagesDropTheirExplanationsTest.A_FAMILIAR_PHRASE_IN_ENGLISH))
				.containsExactly("pravilnik #2");
	}
}
