package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE RULEBOOK SAYS IN THE OWNER'S TWO SENTENCES WHO PAYS IN WHICH CURRENCY, AND ITS SIGN-OFF IS 30.10.2026 (V80, owner,
 * 30.10.2026), IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists, and it is the other half of V80 (as {@link TheWrittenPagesKeepTheDucatsAndLoseTheMapTest} is of
 * V78).</b> V80 makes two edits in each language with {@code replace()} calls. A replace is exact and has one failure
 * mode, which is to match NOTHING and report success; the migration itself refuses that, so what is held here is the
 * other side: that what the owner decided is what the portal serves, in both languages, and that the old words of the
 * sentence stand nowhere on any of the three pages.
 *
 * <p><b>Three kinds of case.</b> The table of edits ({@link #CHANGES}): the full new text stands once in the section it
 * was aimed at and a piece of the old text is gone, in Serbian and in English separately, so an edit done in one
 * language alone fails the other. The sweep over every section of the three pages with no section named: the clause the
 * owner cut ("as a separate line item rather than as a higher membership fee") stands nowhere, and the new sentence
 * stands once, in the rulebook. And the neighbours: the sentence before the changed one and the sentence after it are
 * untouched, in both languages. A floor under the sweep sits in {@link TheWrittenPagesSayWhoPaysInWhichCurrencyCarriedOverTest}:
 * asked of the text before V80 it finds what it is meant to keep out.
 *
 * <p><b>The sign-off is held twice, on purpose.</b> Here, that the rulebook carries 30.10.2026 once and no longer
 * carries the 29.10.2026 V77 gave it; and by the older guards that count the sign-offs of all three documents, which
 * say that 29.10.2026 now stands on the terms and the policy alone.
 */
class TheWrittenPagesSayWhoPaysInWhichCurrencyTest extends DatabaseTest {

	static final String RULEBOOK = "pravilnik";

	/**
	 * One edit of V80 as the owner decided it. The full new text must stand once in the section, and a piece of the old
	 * text must not stand in it.
	 */
	record Change(String id, String slug, int position, String standsInSerbian, String goneFromSerbian,
			String standsInEnglish, String goneFromEnglish) {
	}

	static final List<Change> CHANGES = List.of(
			new Change("CUR-01", RULEBOOK, 4,
					"Članovi iz Srbije plaćaju dinarski iznos, a članovi iz inostranstva iznos u evrima. Uz iznos u evrima naplaćuje se i taksa za obradu plaćanja od 3 EUR.",
					"Član sa adresom u Srbiji plaća dinarski iznos",
					"Members from Serbia pay the dinar amount, and members from abroad pay the amount in euros. A payment processing fee of 3 EUR is also charged on the amount in euros.",
					"A member with an address in Serbia pays the dinar amount"),
			new Change("CUR-02", RULEBOOK, 19,
					"Poslednja izmena: 30.10.2026.",
					"izmena: 29.10.2026.",
					"Last amended: 30.10.2026.",
					"amended: 29.10.2026."));

	/** The clause the owner cut, and the words of the old sentence that are not in the new one, by root, in each language. */
	static final Pattern THE_CUT_CLAUSE_IN_SERBIAN = Pattern.compile(
			"kao odvojena stavka|veća članarina|Član sa adresom u Srbiji", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
	static final Pattern THE_CUT_CLAUSE_IN_ENGLISH = Pattern.compile(
			"separate line item|higher membership fee|member with an address in Serbia", Pattern.CASE_INSENSITIVE);

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

	private void everyEditHolds(String language) {
		assertThat(CHANGES).as("the table of edits is empty, so this case measures nothing").hasSize(2);

		for (Change change : CHANGES) {
			boolean serbian = language.equals("sr");
			String stands = serbian ? change.standsInSerbian() : change.standsInEnglish();
			String gone = serbian ? change.goneFromSerbian() : change.goneFromEnglish();
			String body = bodyOf(change.slug(), change.position(), language);

			assertThat(body)
					.as("%s (%s #%s, %s): its new text must stand exactly once", change.id(), change.slug(),
							change.position(), language)
					.containsOnlyOnce(stands);
			assertThat(body)
					.as("%s (%s #%s, %s): a piece of its old text still stands", change.id(), change.slug(),
							change.position(), language)
					.doesNotContain(gone);
		}
	}

	@Test
	void everyEditStandsInSerbianAndItsOldWordsAreGone() {
		everyEditHolds("sr");
	}

	@Test
	void everyEditStandsInEnglishAndItsOldWordsAreGone() {
		everyEditHolds("en");
	}

	/**
	 * THE TABLE KNOWS EVERY EDIT THE MIGRATION MAKES, so a third edit added to V80 without a line here fails (the floor is
	 * the file Flyway resolved): each of the 4 rows of V80 carries one old text, written between two {@code $old$} marks.
	 */
	@Test
	void theTableNamesEveryEditV80Makes() {
		String sql = migrationSql("80");

		assertThat(sql.split("\\$old\\$", -1).length - 1)
				.as("V80 carries an edit that the table of this file does not name (or the table names one V80 lacks)")
				.isEqualTo(CHANGES.size() * 2 * 2);
	}

	/**
	 * THE NEW SENTENCE STANDS BETWEEN THE SENTENCES IT STOOD BETWEEN, in Serbian and in English: the one before it (the
	 * dinar price is fixed for the season) and the one after it (the fee is not part of the membership fee) are V71's, and
	 * a replace that took a neighbour with it would pass the table above.
	 */
	@Test
	void theNewSentenceStandsBetweenTheSentencesItStoodBetween() {
		assertThat(bodyOf(RULEBOOK, 4, "sr"))
				.contains("Dinarska cena je fiksirana za celu sezonu i ne menja se sa kursom. "
						+ CHANGES.get(0).standsInSerbian()
						+ " Taksa nije deo članarine nego trošak obrade uplate kod platnog posrednika,");
		assertThat(bodyOf(RULEBOOK, 4, "en"))
				.contains("The dinar price is fixed for the whole season and does not change with the exchange rate. "
						+ CHANGES.get(0).standsInEnglish()
						+ " The processing fee is not part of the membership fee but the cost of processing the payment");
	}

	/** THE SIGN-OFF STANDS ONCE, AS THE LAST LINE OF THE RULEBOOK, and the day V77 gave it stands nowhere on the page. */
	@Test
	void theRulebookIsSignedOffOnTheThirtiethAndNoEarlierDayStandsOnIt() {
		for (String language : List.of("sr", "en")) {
			String last = bodyOf(RULEBOOK, 19, language);
			String stands = language.equals("sr") ? CHANGES.get(1).standsInSerbian() : CHANGES.get(1).standsInEnglish();

			assertThat(last).as("the %s rulebook ends with its sign-off", language).endsWith(stands);
			assertThat(last).as("the %s rulebook names the day it last changed once", language)
					.containsOnlyOnce(language.equals("sr") ? "Poslednja izmena" : "Last amended")
					.doesNotContain("29.10.2026");
		}
	}

	@Test
	void noSectionOfTheThreePagesStillHoldsTheCutClause() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr", THE_CUT_CLAUSE_IN_SERBIAN))
				.as("a Serbian section still holds the clause the owner cut from Article 11").isEmpty();
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en", THE_CUT_CLAUSE_IN_ENGLISH))
				.as("an English section still holds the clause the owner cut from Article 11").isEmpty();
	}

	/** THE NEW SENTENCE STANDS IN THE RULEBOOK AND NOWHERE ELSE: a second home for it would be said twice. */
	@Test
	void theNewSentenceStandsInArticleElevenAndNowhereElse() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				Pattern.compile(Pattern.quote(CHANGES.get(0).standsInSerbian()))))
				.containsExactly(RULEBOOK + " #4");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				Pattern.compile(Pattern.quote(CHANGES.get(0).standsInEnglish()))))
				.containsExactly(RULEBOOK + " #4");
	}
}
