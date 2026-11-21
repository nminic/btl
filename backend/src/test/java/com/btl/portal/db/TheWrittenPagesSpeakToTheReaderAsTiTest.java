package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE SERBIAN LEGAL PAGES SPEAK TO THE READER AS "TI" AND NOT AS "VI" (V107, owner, 21.11.2026, PDL „Pravni tekstovi prelaze
 * na „ti"": 119 sentences approved as proposed, 27 of them rewritten so that the verb has no gender), and the three
 * documents whose words changed are signed off on the day V107 gives them.
 *
 * <p><b>What is held here, and what is held elsewhere.</b> The words themselves, sentence by sentence, are held by
 * {@code PageApiTest}, which compares the Serbian answer of this server with {@code frontend/src/test/mock/pages.json} (the
 * owner's approved text, carried there from the list he approved), and by {@code writtenVerification.test.ts}, which holds
 * that fixture to {@code writtenPages.snapshot.json}. A sentence changed by one letter in V107 fails the first of them.
 * What those two cannot say is that NOTHING of the old address remains anywhere in the Serbian pages, in a sentence nobody
 * listed, and that is the one question this file asks of the whole text and not of a list: the floor under the 119.
 *
 * <p><b>The floor is the text, not a list.</b> Every heading and every body of every Serbian section of the four pages is
 * read out of the database and asked whether it carries a plural-you pronoun or a plural-you verb form of „biti" or
 * „ćete". It measures pronouns and those two verb forms and nothing else: it cannot tell that „pošaljite" is the plural
 * imperative, and it says so rather than pretending. The 119 approved sentences are what carries the verbs.
 *
 * <p><b>The English is not touched</b> (V107 header: English has no „ti" and „Vi", and the decision speaks of the Serbian
 * text), and that is asked here as behaviour: the English sections, and the sign-off of every English page, are the same
 * with V107 undone as with it applied.
 */
class TheWrittenPagesSpeakToTheReaderAsTiTest extends DatabaseTest {

	static final String POLICY = "politika-privatnosti";
	static final String TERMS = "uslovi-koriscenja";
	static final String RULEBOOK = "pravilnik";
	static final String PRESIDENT = "rec-predsednika";

	/**
	 * The words of address that are plural-you in Serbian, whole words only (a letter on either side means another word):
	 * the pronouns in every case, and the two verb forms that are never anything else in these pages.
	 */
	private static final Pattern PLURAL_YOU = Pattern.compile(
			"(?<![\\p{L}])(Vi|vi|Vas|vas|Vam|vam|Vama|vama|Vaš\\p{L}*|vaš\\p{L}*|ste|Ste|biste|ćete|Ćete)(?![\\p{L}])");

	private record Text(String where, String text) {
	}

	/** Every Serbian heading and body of the four pages, with where each stands. */
	private List<Text> everySerbianText() {
		List<Text> texts = new ArrayList<>();

		db.sql("select p.slug || ' #' || s.position || ' heading' as place, s.heading from static_page_section s"
						+ " join static_page p on p.id = s.page_id"
						+ " union all"
						+ " select p.slug || ' #' || s.position || ' body', s.body from static_page_section s"
						+ " join static_page p on p.id = s.page_id order by 1")
				.query((row, number) -> new Text(row.getString(1), row.getString(2))).list().forEach(texts::add);

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

	private String headingOf(String slug, int position) {
		return db.sql("select s.heading from static_page_section s join static_page p on p.id = s.page_id"
						+ " where p.slug = :slug and s.position = :position")
				.param("slug", slug).param("position", position).query(String.class).single();
	}

	/** Every heading and body of both tables, by page, place and language, so two readings compare row by row. */
	private Map<String, String> everyTextByPlace() {
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

	/** THE FLOOR: no Serbian heading and no Serbian body of any of the four pages carries a plural-you pronoun. */
	@Test
	void noSerbianHeadingAndNoSerbianBodyCarriesAPluralYouPronounAnyMore() {
		List<Text> texts = everySerbianText();

		assertThat(texts.size()).as("the sweep read too few Serbian texts for the four pages to be all of them").isGreaterThan(70);

		List<String> found = new ArrayList<>();

		for (Text each : texts) {
			Matcher word = PLURAL_YOU.matcher(each.text());

			while (word.find()) {
				found.add(each.where() + ": " + word.group());
			}
		}

		assertThat(found).as("the Serbian legal pages still speak to the reader as Vi where they say").isEmpty();
	}

	/**
	 * The pattern above is live: put back, V106's text carries the words it looks for, so an empty answer above means the
	 * text is clean and not that the pattern stopped seeing anything.
	 */
	@Test
	void theSameSweepFindsThePluralYouInTheTextAsV106LeftIt() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "107");

		List<String> found = new ArrayList<>();

		for (Text each : everySerbianText()) {
			Matcher word = PLURAL_YOU.matcher(each.text());

			while (word.find()) {
				found.add(each.where());
			}
		}

		assertThat(found).as("the sweep found nothing in the text before V107, so it measures nothing").hasSizeGreaterThan(50);
		assertThat(found).as("the sweep did not reach the policy, the terms, the rulebook or the president's word")
				.anyMatch(place -> place.startsWith(POLICY))
				.anyMatch(place -> place.startsWith(TERMS))
				.anyMatch(place -> place.startsWith(RULEBOOK))
				.anyMatch(place -> place.startsWith(PRESIDENT));
	}

	/** THE TWO HEADINGS (the owner approved 6. and 8. as sentences 118 and 119), asked of the heading and not of a body. */
	@Test
	void theTwoHeadingsSpeakTiAndTheOthersAreAsTheyWere() {
		assertThat(headingOf(POLICY, 6)).isEqualTo("6. Tvoja prava");
		assertThat(headingOf(TERMS, 8)).isEqualTo("8. Sadržaj koji postavljaš");
	}

	/**
	 * THE THREE DOCUMENTS WHOSE WORDS CHANGED ARE SIGNED OFF ON THE DAY V107 GIVES THEM, ONCE, and the president's word, which
	 * carries no sign-off, still carries none. The English sign-offs keep the day of their own last change, because the English
	 * words did not change (V107 header; PDL 07.11.2026, the day moves when the words of the text change).
	 */
	@Test
	void theThreeSerbianDocumentsAreSignedOffOnTheTwentyFirstOfNovemberAndTheEnglishKeepTheirDays() {
		assertThat(bodyOf(POLICY, 7, "sr")).endsWith("Poslednja izmena: 21.11.2026.").containsOnlyOnce("Poslednja izmena: ")
				.doesNotContain("16.11.2026");
		assertThat(bodyOf(TERMS, 11, "sr")).endsWith("Poslednja izmena: 21.11.2026.").containsOnlyOnce("Poslednja izmena: ")
				.doesNotContain("11.11.2026");
		assertThat(bodyOf(RULEBOOK, 19, "sr")).endsWith("Poslednja izmena: 21.11.2026.").containsOnlyOnce("Poslednja izmena: ")
				.doesNotContain("15.11.2026");
		assertThat(bodyOf(PRESIDENT, 1, "sr")).doesNotContain("Poslednja izmena");

		assertThat(bodyOf(POLICY, 7, "en")).endsWith("Last amended: 16.11.2026.");
		assertThat(bodyOf(TERMS, 11, "en")).endsWith("Last amended: 11.11.2026.");
		assertThat(bodyOf(RULEBOOK, 19, "en")).endsWith("Last amended: 15.11.2026.");
	}

	/**
	 * V107 EDITS SERBIAN AND NOTHING ELSE, asked as behaviour: with V107 undone, every English section (heading and body) and
	 * the translation rows as a set are exactly what they are with it applied.
	 */
	@Test
	void theEnglishSectionsAreTheSameWithV107UndoneAsWithItApplied() {
		Map<String, String> applied = everyTextByPlace();

		TheWrittenPagesBeforeV71.undoBodyEdits(db, "107");

		Map<String, String> undone = everyTextByPlace();

		assertThat(undone).as("undoing V107 changed nothing, so this measures nothing").isNotEqualTo(applied);
		assertThat(undone.keySet()).isEqualTo(applied.keySet());

		for (String place : applied.keySet()) {
			if (place.endsWith(" en")) {
				assertThat(undone.get(place)).as("the English text %s depends on V107", place).isEqualTo(applied.get(place));
			}
		}
	}

	/**
	 * V107 carries every edit the owner approved and the three sign-offs, nothing more: 119 and 3, each written between two
	 * $old$ marks, and each edit names the Serbian text (a migration that named an English one would change what this file
	 * says it does not touch).
	 */
	@Test
	void theTableNamesEveryEditV107MakesAndEveryOneIsSerbian() {
		String sql = migrationSql("107");

		assertThat(sql.split("\\$old\\$", -1).length - 1)
				.as("V107 carries an edit that this file does not name (or this file names one V107 lacks): 119 sentences and 3"
						+ " sign-offs, each written between two $old$ marks")
				.isEqualTo((119 + 3) * 2);

		List<TheWrittenPagesBeforeV71.Edit> edits = TheWrittenPagesBeforeV71.editsWithAFieldOf(sql);

		assertThat(edits).hasSize(119 + 3);
		assertThat(edits).extracting(TheWrittenPagesBeforeV71.Edit::language).containsOnly("sr");
		assertThat(edits).filteredOn(edit -> edit.label().startsWith("TI-SIGNOFF")).hasSize(3);
		assertThat(edits).filteredOn(edit -> edit.field().equals("heading")).hasSize(2);
	}
}
