package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE RULEBOOK SAYS IN ONE SENTENCE WHO KEEPS THE DUCATS, AND THE POLICY NO LONGER MENTIONS A MAP OF COUNTRIES VISITED
 * (V78, owner, 29.10.2026), IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists, and it is the other half of V78 (as {@link TheWrittenPagesDropTheirExplanationsTest} is of
 * V77).</b> V78 makes two edits in each language with {@code replace()} calls. A replace is exact and has one failure
 * mode, which is to match NOTHING and report success; the migration itself refuses that, so what is held here is the
 * other side: that what the owner decided is what the portal serves, in both languages, and that the old words stand
 * nowhere on any of the three pages.
 *
 * <p><b>Three kinds of case.</b> The table of edits ({@link #CHANGES}): the full new text stands once in the section it
 * was aimed at and a piece of the old text is gone, in Serbian and in English separately, so an edit done in one
 * language alone fails the other. The two sweeps, over every section of the three pages with no section named: the old
 * paragraph about the ducats stands nowhere and the sentence that replaced it stands once, and "map of countries
 * visited" stands nowhere. And the neighbours: the paragraphs on both sides of the ducat sentence, and the other cells
 * of the policy row, are untouched. A floor under each sweep sits in
 * {@link TheWrittenPagesKeepTheDucatsAndLoseTheMapCarriedOverTest}: asked of the text before V78 they find what they are
 * meant to keep out.
 *
 * <p><b>What does not move, and is held by the older guards</b>: the sign-off. V77 moved the rulebook and the policy to
 * 29.10.2026 on the day of the same revision and V78 leaves them there (see its header); that the day stands once on
 * all three documents is held by {@link TheWrittenPagesDropTheirExplanationsTest} through the table of V77 and by the
 * guards that count the sign-offs.
 */
class TheWrittenPagesKeepTheDucatsAndLoseTheMapTest extends DatabaseTest {

	static final String RULEBOOK = "pravilnik";
	static final String POLICY = "politika-privatnosti";

	/**
	 * One edit of V78 as the owner decided it. The full new text must stand once in the section, and a piece of the old
	 * text must not stand in it.
	 */
	record Change(String id, String slug, int position, String standsInSerbian, String goneFromSerbian,
			String standsInEnglish, String goneFromEnglish) {
	}

	static final List<Change> CHANGES = List.of(
			new Change("DUK-01", RULEBOOK, 18,
					"Osvojeni dukati ostaju u trajnom vlasništvu profila, osim u slučaju brisanja istog.",
					"Osvojen dukat ostaje trajno. Ne skida se kad dođe slabija godina",
					"Won ducats remain in the permanent ownership of the profile, except in the case of its deletion.",
					"A won ducat stays forever. It is not taken away when a weaker year comes"),
			new Change("POL-20", POLICY, 2,
					"Profil, način plaćanja, i državljanstvo u evidenciji članova",
					"mapa posećenih zemalja",
					"Profile, payment method, and citizenship in the membership records",
					"map of countries visited"));

	/** The old paragraph about the ducats and the old words of the cell, by root, in each language. */
	static final Pattern THE_OLD_DUCAT_PARAGRAPH_IN_SERBIAN = Pattern.compile("Osvojen dukat ostaje trajno|slabija godina",
			Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
	static final Pattern THE_OLD_DUCAT_PARAGRAPH_IN_ENGLISH = Pattern.compile("won ducat stays forever|weaker year",
			Pattern.CASE_INSENSITIVE);
	static final Pattern A_MAP_IN_SERBIAN = Pattern.compile("mapa posećenih zemalja|posećenih zemalja",
			Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
	static final Pattern A_MAP_IN_ENGLISH = Pattern.compile("map of countries visited|countries visited",
			Pattern.CASE_INSENSITIVE);

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
	 * THE TABLE KNOWS EVERY EDIT THE MIGRATION MAKES, so a third edit added to V78 without a line here fails (the floor is
	 * the file Flyway resolved): each of the 4 rows of V78 carries one old text, written between two {@code $old$} marks.
	 */
	@Test
	void theTableNamesEveryEditV78Makes() {
		String sql = migrationSql("78");

		assertThat(sql.split("\\$old\\$", -1).length - 1)
				.as("V78 carries an edit that the table of this file does not name (or the table names one V78 lacks)")
				.isEqualTo(CHANGES.size() * 2 * 2);
	}

	/**
	 * THE DUCAT SENTENCE STANDS ONCE AND THE PARAGRAPHS AROUND IT ARE WHERE THEY WERE, in Serbian and in English: the one
	 * before it and the one after it are the owner's and V77's, and a replace that took a neighbour with it would pass the
	 * table above.
	 */
	@Test
	void theDucatSentenceStandsBetweenTheParagraphsItStoodBetween() {
		assertThat(bodyOf(RULEBOOK, 18, "sr"))
				.contains("Jedni se osvajaju svakog meseca, drugi jednom u sezoni, a treći samo jednom.\n\n"
						+ "Osvojeni dukati ostaju u trajnom vlasništvu profila, osim u slučaju brisanja istog.\n\n"
						+ "Dukati su bronzani, srebrni i zlatni, po rastućoj težini.\n\n[[gallery]]");
		assertThat(bodyOf(RULEBOOK, 18, "en"))
				.contains("Some are won every month, others once a season, and others only once.\n\n"
						+ "Won ducats remain in the permanent ownership of the profile, except in the case of its deletion.\n\n"
						+ "Ducats are bronze, silver, and gold, in order of increasing difficulty.\n\n[[gallery]]");
	}

	/** THE POLICY ROW KEEPS ITS OTHER CELLS: only the words of the map left the first one. */
	@Test
	void thePolicyRowKeepsEveryOtherCellAndLosesOnlyTheMap() {
		for (String language : List.of("sr", "en")) {
			String body = bodyOf(POLICY, 2, language);
			String label = language.equals("sr") ? "| Mesto i zemlja | " : "| Place and country | ";
			int start = body.indexOf(label);

			assertThat(start).as("the %s policy has no row for place and country", language).isNotNegative();

			String row = body.substring(start, body.indexOf('\n', start));

			assertThat(row.split("\\|", -1))
					.as("the %s row must keep its four cells (an empty piece before the first bar and one after the last)",
							language)
					.hasSize(6);
			assertThat(row)
					.as("the %s first cell must be the old one without the map, and nothing else of the row moved", language)
					.startsWith(label + (language.equals("sr") ? CHANGES.get(1).standsInSerbian()
							: CHANGES.get(1).standsInEnglish()) + " | ");
		}
	}

	@Test
	void noSectionOfTheThreePagesStillHoldsTheOldDucatParagraphOrTheMap() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr", THE_OLD_DUCAT_PARAGRAPH_IN_SERBIAN))
				.as("a Serbian section still says the old paragraph about the ducats").isEmpty();
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en", THE_OLD_DUCAT_PARAGRAPH_IN_ENGLISH))
				.as("an English section still says the old paragraph about the ducats").isEmpty();
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr", A_MAP_IN_SERBIAN))
				.as("a Serbian section still mentions a map of countries visited, which does not exist").isEmpty();
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en", A_MAP_IN_ENGLISH))
				.as("an English section still mentions a map of countries visited, which does not exist").isEmpty();
	}

	/** THE NEW SENTENCE STANDS IN THE RULEBOOK AND NOWHERE ELSE: a third home for it would be said twice. */
	@Test
	void theDucatSentenceStandsInTheRulebookAndNowhereElse() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				Pattern.compile(Pattern.quote(CHANGES.get(0).standsInSerbian()))))
				.containsExactly(RULEBOOK + " #18");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				Pattern.compile(Pattern.quote(CHANGES.get(0).standsInEnglish()))))
				.containsExactly(RULEBOOK + " #18");
	}
}
