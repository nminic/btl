package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PRIVACY POLICY SAYS THAT THE PROFILE FIELDS, THE PICTURE AND THE TEXT ABOUT ONESELF ARE CHANGED AND DELETED ON THE
 * PAGE MOJI PODACI (V89, owner, 07.11.2026), IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists, and it is the other half of V89 (as {@link TheWrittenPagesSayWhoPaysInWhichCurrencyTest} is of
 * V80).</b> V89 makes one edit in each language with a {@code replace()} call. A replace is exact and has one failure
 * mode, which is to match NOTHING and report success; the migration itself refuses that, so what is held here is the
 * other side: that what the owner decided is what the portal serves, in both languages, that the sentence it replaced
 * stands nowhere on any of the three pages, and that the sentences beside it were not taken along.
 *
 * <p><b>Three kinds of case.</b> The table of edits ({@link #CHANGES}): the full new text stands once in the section it
 * was aimed at and a piece of the old text is gone, in Serbian and in English separately, so an edit done in one
 * language alone fails the other. The sweeps over every section of the three pages with no section named: the old words
 * stand nowhere (a second home for the old claim, that the picture and the words are kept in the settings, would say
 * what is no longer so), and the new sentence stands once, in the policy. And the neighbours: what stood after the
 * changed sentence is untouched, and so is the sentence in section 3 that is still true, that the choice of who sees the
 * profile is made in the settings.
 *
 * <p><b>The sign-off is held here too</b> (owner, 07.11.2026: the date moves whenever the words of a legal text change, to
 * the day the change reaches QA). The policy carries 07.11.2026 once, as its last line, in both languages, and the
 * rulebook and the terms of use keep the days they had (10.11.2026 of V93, and 29.10.2026), because their words did not change.
 */
class TheWrittenPagesSayThatTheProfileIsEditedOnThePageMojiPodaciTest extends DatabaseTest {

	static final String POLICY = "politika-privatnosti";

	/**
	 * V90 (owner, 08.11.2026) links the sentence V89 wrote and moves the sign-off V89 moved, so every case here reads the
	 * text with V90 undone, read out of V90 itself: what is held here is what V89 wrote, and what stands now is held by
	 * {@link TheWrittenPagesSayMojiPodaciWhereTheySaidTheCardTest}.
	 */
	@BeforeEach
	void theTextAsV89LeftIt() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "90");
	}

	/**
	 * One edit of V89 as the owner decided it. The full new text must stand once in the section, and a piece of the old
	 * text must not stand in it.
	 */
	record Change(String id, String slug, int position, String standsInSerbian, String goneFromSerbian,
			String standsInEnglish, String goneFromEnglish) {
	}

	static final List<Change> CHANGES = List.of(
			new Change("PROFILE-01", POLICY, 6,
					"Polja profila, sliku i tekst o sebi menjate i brišete na strani Moji podaci.",
					"menjate i brišete u podešavanjima",
					"You change and delete profile fields, your picture and the text about yourself on the My details page.",
					"profile fields in settings"),
			new Change("PROFILE-02", POLICY, 7,
					"Poslednja izmena: 07.11.2026.",
					"izmena: 29.10.2026.",
					"Last amended: 07.11.2026.",
					"amended: 29.10.2026."));

	/**
	 * The old claims, by their roots, in each language: the lead-in the owner's sentence does not have, where it said it
	 * was done first (the settings), and where it said so for the few hours it was approved on the card of the profile.
	 */
	static final Pattern THE_OLD_CLAIM_IN_SERBIAN = Pattern.compile(
			"Deo možete i sami|polja profila menjate i brišete u podešavanjima|brišete na kartici Podaci svog profila",
			Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
	static final Pattern THE_OLD_CLAIM_IN_ENGLISH = Pattern.compile(
			"Some of it you can do yourself|profile fields in settings|on the Details card of your own profile",
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
	void theEditStandsInSerbianAndItsOldWordsAreGone() {
		everyEditHolds("sr");
	}

	@Test
	void theEditStandsInEnglishAndItsOldWordsAreGone() {
		everyEditHolds("en");
	}

	/**
	 * THE TABLE KNOWS EVERY EDIT THE MIGRATION MAKES, so a second edit added to V89 without a line here fails (the floor
	 * is the file Flyway resolved): each of the 4 rows of V89 carries one old text, written between two {@code $old$}
	 * marks.
	 */
	@Test
	void theTableNamesEveryEditV89Makes() {
		String sql = migrationSql("89");

		assertThat(sql.split("\\$old\\$", -1).length - 1)
				.as("V89 carries an edit that the table of this file does not name (or the table names one V89 lacks)")
				.isEqualTo(CHANGES.size() * 2 * 2);
	}

	/**
	 * THE NEW SENTENCE OPENS ITS PARAGRAPH AND THE SENTENCE ABOUT THE CONSENT FOR COOKIES FOLLOWS IT, in Serbian and in
	 * English: the owner's sentence has no lead-in, so it stands where the old lead-in stood, and a replace that took the
	 * next sentence with it, or left the old lead-in in front, would pass the table above.
	 */
	@Test
	void theNewSentenceOpensItsParagraphAndTheSentenceAboutCookiesFollowsIt() {
		assertThat(bodyOf(POLICY, 6, "sr"))
				.contains("\n\n" + CHANGES.get(0).standsInSerbian() + " Saglasnost za kolačiće se ne povlači jer se ne daje");
		assertThat(bodyOf(POLICY, 6, "en"))
				.contains("\n\n" + CHANGES.get(0).standsInEnglish() + " Consent for cookies is not withdrawn because it is not given");
	}

	/**
	 * THE CHOICE OF WHO SEES THE PROFILE STAYS IN THE SETTINGS, and the policy still says so in section 3: the owner
	 * kept that sentence ("tačno, privatnost ostaje na Podešavanjima"), and a replace that swept every "u podešavanjima"
	 * of the policy would have taken it along.
	 */
	@Test
	void theSentenceThatSaysTheProfileIsHiddenInTheSettingsIsStillThere() {
		assertThat(bodyOf(POLICY, 3, "sr")).containsOnlyOnce("U podešavanjima možete sakriti profil");
		assertThat(bodyOf(POLICY, 3, "en")).containsOnlyOnce("In settings you can hide your profile");
	}

	/**
	 * ONLY THE POLICY IS SIGNED WITH THE NEW DAY: its sign-off stands once as the last line, in both languages, and the
	 * other two documents keep the day of their own last change, so a sign-off moved on all three (or on none) fails.
	 */
	@Test
	void thePolicyIsSignedOffOnTheSeventhOfNovemberAndTheOtherTwoKeepTheirDays() {
		for (String language : List.of("sr", "en")) {
			boolean serbian = language.equals("sr");
			String mark = serbian ? "Poslednja izmena: " : "Last amended: ";

			assertThat(bodyOf(POLICY, 7, language)).as("the %s policy ends with its sign-off", language)
					.endsWith(serbian ? CHANGES.get(1).standsInSerbian() : CHANGES.get(1).standsInEnglish())
					.containsOnlyOnce(mark).doesNotContain("29.10.2026");
			assertThat(bodyOf("pravilnik", 19, language)).as("the %s rulebook keeps its day", language)
					.endsWith(mark + "10.11.2026.");
			assertThat(bodyOf("uslovi-koriscenja", 11, language)).as("the %s terms keep their day", language)
					.endsWith(mark + "29.10.2026.");
		}
	}

	@Test
	void noSectionOfTheThreePagesStillHoldsTheOldClaim() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr", THE_OLD_CLAIM_IN_SERBIAN))
				.as("a Serbian section still says the profile fields are changed and deleted in the settings").isEmpty();
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en", THE_OLD_CLAIM_IN_ENGLISH))
				.as("an English section still says the profile fields are changed and deleted in the settings").isEmpty();
	}

	/** THE NEW SENTENCE STANDS IN SECTION 6 OF THE POLICY AND NOWHERE ELSE: a second home for it would be said twice. */
	@Test
	void theNewSentenceStandsInTheRightsOfThePolicyAndNowhereElse() {
		List<TheWrittenPagesDropTheirExplanationsTest.Row> rows = TheWrittenPagesDropTheirExplanationsTest
				.theThreePages(db);

		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "sr",
				Pattern.compile(Pattern.quote(CHANGES.get(0).standsInSerbian()))))
				.containsExactly(POLICY + " #6");
		assertThat(TheWrittenPagesDropTheirExplanationsTest.whereItMatches(rows, "en",
				Pattern.compile(Pattern.quote(CHANGES.get(0).standsInEnglish()))))
				.containsExactly(POLICY + " #6");
	}
}
