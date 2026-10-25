package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.postgresql.util.PSQLException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * WHAT V73 CHANGES IN THE PRIVACY POLICY, HELD ON THE TEXT THE PORTAL SERVES, IN BOTH LANGUAGES: THE WORD "drugima" (TO
 * OTHERS) IN THE SENTENCE ABOUT THE DATE OF BIRTH, THE CELL AND THE ITEM THAT SAY WHO SEES THE NUMBER OF THE DOCUMENT AND
 * THE FATHER'S NAME, AND THE DAY THE POLICY IS SIGNED OFF ON.
 *
 * <p><b>Why this exists.</b> The owner decided on 24.10.2026 (PDL, the entry "Politika privatnosti, odeljak 3") that the
 * policy's sentence about the date of birth says it is not shown to others, because since that day a member sees his own
 * date on his own card as a locked box. {@code PageApiTest} holds the Serbian half against {@code pages.json}; nothing
 * else holds the English half, nothing holds that the word landed in THIS sentence and in no other, and nothing holds
 * that it stands where it limits the right verb, which is the half of a one-word edit that is easiest to get wrong.
 *
 * <p><b>The owner quoted a sentence the policy no longer has.</b> His entry reads "Datum rođenja se nikada ne prikazuje
 * drugima, ...", and the policy has not said "nikada" about the date since V57 (10.10.2026), when the owner decided a
 * member may choose to show his date or his year. A "nikada" in front of that exception says the opposite of it, so V73
 * adds the word the owner asked for and not the one he remembered. {@link #theWordNikadaIsNotPutBackInFrontOfTheException}
 * holds that, so the next reader who sees the owner's quotation does not put it in.
 *
 * <p><b>The sweeps are over every section of every page, with no {@code where} clause</b>: the new words stand in section
 * 3 of the policy and nowhere else, and the words they replace stand nowhere.
 *
 * <p><b>The sign-off of the policy MOVES, to 24.10.2026, and the other two documents' does not</b> (22.10.2026): the entry
 * of 16.10.2026 ("Datum Poslednja izmena se pomera") moves the date on a document whose text changes. That is the
 * assistant's and the coordinator's derivation from the recorded rule and not a decision of the owner's; 24.10.2026 is the
 * day he approved the words.
 *
 * <p><b>The heading over the list of what is never shown is NOT touched</b>
 * ({@link #theHeadingOverTheListIsAsItWasAndSaysNothingOfOthers}): the owner took back the "drugima" a first version put
 * over the whole list, because it would have said the member sees the internal notes, the private messages and the
 * signature's IP address. The exception stands on the one item it is true of.
 */
class TheWrittenPagesSayTheDateOfBirthIsNotShownToOthersTest extends DatabaseTest {

	/** The migration this file is about. */
	private static final int THE_MIGRATION = 73;

	private static final String POLICY = "politika-privatnosti";

	private static final int THE_SECTION = 3;

	private static final String SERBIAN_OLD = "Datum rođenja tražimo da bismo znali uzrasnu kategoriju i ne prikazujemo ga"
			+ " ni u punom ni u skraćenom obliku, osim ako";
	private static final String ENGLISH_OLD = "We ask for the date of birth so that we know the age category, and we do not"
			+ " display it in full or in shortened form, unless";

	private static final String SERBIAN_NEW = "Datum rođenja tražimo da bismo znali uzrasnu kategoriju i ne prikazujemo ga"
			+ " drugima ni u punom ni u skraćenom obliku, osim ako";
	private static final String ENGLISH_NEW = "We ask for the date of birth so that we know the age category, and we do not"
			+ " display it to others in full or in shortened form, unless";

	/** What stands right after the clause, so the word is shown to limit the verb and not the exception. */
	private static final String SERBIAN_AFTER = " sami izaberete da se na vašem profilu vidi ceo datum ili samo godina;";
	private static final String ENGLISH_AFTER = " you yourself choose to have the full date or only the year shown on your profile;";

	private static final String SERBIAN_SIGN_OFF = "Poslednja izmena: 22.10.2026.";
	private static final String ENGLISH_SIGN_OFF = "Last amended: 22.10.2026.";

	/** A section by the page it belongs to and its place in it. */
	record Place(String slug, int position) {
	}

	private static final Place THE_PLACE = new Place(POLICY, THE_SECTION);
	private static final Place THE_POLICY_SIGN_OFF = new Place(POLICY, 7);

	@Autowired
	JdbcTemplate jdbc;

	private static String oldIn(String language) {
		return language.equals("sr") ? SERBIAN_OLD : ENGLISH_OLD;
	}

	private static String newIn(String language) {
		return language.equals("sr") ? SERBIAN_NEW : ENGLISH_NEW;
	}

	private static String afterIn(String language) {
		return language.equals("sr") ? SERBIAN_AFTER : ENGLISH_AFTER;
	}

	private static String signOffIn(String language) {
		return language.equals("sr") ? SERBIAN_SIGN_OFF : ENGLISH_SIGN_OFF;
	}

	private List<Place> placesWhichCarry(String language, String text) {
		record Row(Place place, String body) {
		}

		List<Row> rows = language.equals("sr")
				? db.sql("select p.slug, s.position, s.body from static_page_section s"
								+ " join static_page p on p.id = s.page_id")
						.query((row, number) -> new Row(new Place(row.getString(1), row.getInt(2)), row.getString(3)))
						.list()
				: db.sql("select p.slug, s.position, t.body from static_page_section_translation t"
								+ " join static_page_section s on s.id = t.section_id"
								+ " join static_page p on p.id = s.page_id where t.language = :language")
						.param("language", language)
						.query((row, number) -> new Row(new Place(row.getString(1), row.getInt(2)), row.getString(3)))
						.list();

		assertThat(rows).as("there is no %s page text at all, so this case measures nothing", language).isNotEmpty();

		return rows.stream().filter(each -> each.body().contains(text)).map(Row::place).toList();
	}

	private String bodyOf(String language, Place place) {
		return language.equals("sr")
				? db.sql("select s.body from static_page_section s join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position")
						.param("slug", place.slug()).param("position", place.position())
						.query(String.class).single()
				: db.sql("select t.body from static_page_section_translation t"
								+ " join static_page_section s on s.id = t.section_id"
								+ " join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position and t.language = :language")
						.param("slug", place.slug()).param("position", place.position())
						.param("language", language).query(String.class).single();
	}

	private void setBody(String language, Place place, String body) {
		int changed = language.equals("sr")
				? db.sql("update static_page_section s set body = :body from static_page p"
								+ " where p.id = s.page_id and p.slug = :slug and s.position = :position")
						.param("body", body).param("slug", place.slug()).param("position", place.position()).update()
				: db.sql("update static_page_section_translation t set body = :body"
								+ " from static_page_section s, static_page p"
								+ " where s.id = t.section_id and p.id = s.page_id and p.slug = :slug"
								+ " and s.position = :position and t.language = :language")
						.param("body", body).param("slug", place.slug()).param("position", place.position())
						.param("language", language).update();

		assertThat(changed).as("there is no %s text of %s #%s to write", language, place.slug(), place.position()).isOne();
	}

	private void theClauseStandsInThatOneSectionAndTheOldOneNowhere(String language) {
		assertThat(placesWhichCarry(language, newIn(language)))
				.as("the %s clause with the new word must stand in section 3 of the privacy policy and in no other",
						language)
				.containsExactly(THE_PLACE);
		assertThat(bodyOf(language, THE_PLACE))
				.as("%s: the new clause must stand once in section 3, and be followed by the exception it limits",
						language)
				.containsOnlyOnce(newIn(language))
				.containsOnlyOnce(newIn(language) + afterIn(language));
		assertThat(placesWhichCarry(language, oldIn(language)))
				.as("the %s clause as it stood before V73 must be nowhere", language)
				.isEmpty();
	}

	@Test
	void theSerbianClauseStandsInThatOneSectionAndTheOldOneNowhere() {
		theClauseStandsInThatOneSectionAndTheOldOneNowhere("sr");
	}

	@Test
	void theEnglishClauseStandsInThatOneSectionAndTheOldOneNowhere() {
		theClauseStandsInThatOneSectionAndTheOldOneNowhere("en");
	}

	/**
	 * The word is put where it limits the verb: directly after "ga" / "it" and before "ni u punom" / "in full". Put
	 * after the exception, at the end of the sentence, it would limit "ako sami izaberete", and the sentence would say
	 * something else. Asked of the whole text, for every other position the word could be put in.
	 */
	@Test
	void theWordIsAfterTheVerbAndNotAtTheEndOfTheSentence() {
		assertThat(bodyOf("sr", THE_PLACE))
				.contains("ne prikazujemo ga drugima ni u punom")
				.doesNotContain("sami izaberete drugima")
				.doesNotContain("godina drugima")
				.doesNotContain("ne vidi ništa drugima");
		assertThat(bodyOf("en", THE_PLACE))
				.contains("we do not display it to others in full")
				.doesNotContain("you yourself choose to others")
				.doesNotContain("on your profile to others")
				.doesNotContain("nothing is shown to others");
	}

	@Test
	void theWordNikadaIsNotPutBackInFrontOfTheException() {
		assertThat(bodyOf("sr", THE_PLACE)).doesNotContain("nikada ne prikazujemo").doesNotContain("se nikada ne prikazuje");
		assertThat(bodyOf("en", THE_PLACE)).doesNotContain("never display it").doesNotContain("is never shown");
	}

	/**
	 * THE SIGN-OFF OF THE POLICY MOVES, AND THE OTHER TWO DO NOT. PDL, "Datum Poslednja izmena se pomera" (owner,
	 * 16.10.2026): the date moves on the document whose text changes. V73 changes the policy's text and nothing of the
	 * rulebook's or the terms', so the policy stands at 24.10.2026 (the day the owner approved the words; THE ASSISTANT'S
	 * DERIVATION from the rule, chosen by the coordinator who asked for the file, not a decision of the owner's) and the
	 * rulebook and the terms keep the 22.10.2026 V71 gave them, in both languages.
	 */
	@Test
	void thePolicyIsSignedOffOnTheTwentyFourthAndTheOtherTwoStayOnTheTwentySecond() {
		for (String language : List.of("sr", "en")) {
			assertThat(placesWhichCarry(language, signOffAfterIn(language)))
					.as("the %s sign-off of 24.10.2026 must stand on the privacy policy alone", language)
					.containsExactly(THE_POLICY_SIGN_OFF);
			assertThat(bodyOf(language, THE_POLICY_SIGN_OFF))
					.containsOnlyOnce(signOffAfterIn(language))
					.doesNotContain(signOffIn(language));
			assertThat(placesWhichCarry(language, signOffIn(language)))
					.as("the %s sign-off of 22.10.2026 must stand on the rulebook and on the terms of use, and not on"
							+ " the policy", language)
					.containsExactlyInAnyOrder(new Place("pravilnik", 19), new Place("uslovi-koriscenja", 11));
		}
	}

	private static final String SERBIAN_SIGN_OFF_AFTER = "Poslednja izmena: 24.10.2026.";
	private static final String ENGLISH_SIGN_OFF_AFTER = "Last amended: 24.10.2026.";

	private static String signOffAfterIn(String language) {
		return language.equals("sr") ? SERBIAN_SIGN_OFF_AFTER : ENGLISH_SIGN_OFF_AFTER;
	}

	/**
	 * THE FLOORS, asked of the migrations: the old clauses are what V57 wrote, and no migration before V73 wrote the new
	 * ones, or the sweeps above would pass without V73 doing anything.
	 */
	@Test
	void theOldClausesAreV57sAndNoMigrationBeforeV73WroteTheNewOnes() {
		String before = everyMigrationBeforeThisOne();

		assertThat(before).as("no migration before V73 was read, so this case measures nothing").isNotBlank();

		assertThat(migrationSql("57")).as("V57 does not write the Serbian old clause").contains(SERBIAN_OLD);
		assertThat(migrationSql("57")).as("V57 does not write the English old clause").contains(ENGLISH_OLD);

		for (String text : List.of(SERBIAN_SIGN_OFF_AFTER, ENGLISH_SIGN_OFF_AFTER)) {
			assertThat(before).as("a migration before V73 already writes \"%s\"", text).doesNotContain(text);
		}

		for (String text : List.of(SERBIAN_NEW, ENGLISH_NEW)) {
			assertThat(before).as("a migration before V73 already writes \"%s\"", text).doesNotContain(text);
		}
	}

	private String everyMigrationBeforeThisOne() {
		StringBuilder text = new StringBuilder();

		for (var applied : flyway.info().applied()) {
			if (applied.getVersion() == null || Integer.parseInt(applied.getVersion().getVersion()) >= THE_MIGRATION) {
				continue;
			}

			text.append(migrationSql(applied.getVersion().getVersion()));
		}

		return text.toString();
	}

	/** V73 run once more, and the error PostgreSQL answers with. The last thing a case may ask: the transaction aborts. */
	private PSQLException v73RunAgain() {
		String sql = migrationSql(String.valueOf(THE_MIGRATION));
		Throwable stopped = catchThrowable(() -> jdbc.execute(sql));

		assertThat(stopped)
				.as("V73 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V73 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	private static String reportOf(PSQLException error) {
		return error.getServerErrorMessage().getDetail();
	}

	/** The text as it stood BEFORE V73: the new clause put back to the old one in both languages, by hand. */
	private void putBackTheTextAsItStoodBeforeV73() {
		for (String language : List.of("sr", "en")) {
			setBody(language, THE_PLACE, asItStoodBefore(language, THE_PLACE));
			setBody(language, THE_TABLE, asItStoodBefore(language, THE_TABLE));
			setBody(language, THE_POLICY_SIGN_OFF, asItStoodBefore(language, THE_POLICY_SIGN_OFF));
		}
	}

	/** A section with every word V73 adds taken out again: what V73 found. */
	private String asItStoodBefore(String language, Place place) {
		return bodyOf(language, place)
				.replace(newIn(language), oldIn(language))
				.replace(rowNew(language), rowOld(language))
				.replace(itemNew(language), itemOld(language))
				.replace(signOffAfterIn(language), signOffIn(language));
	}

	private List<String> everySectionBody() {
		return db.sql("select body from (select p.slug, s.position, 'sr' as language, s.body"
						+ " from static_page_section s join static_page p on p.id = s.page_id"
						+ " union all select p.slug, s.position, t.language, t.body"
						+ " from static_page_section_translation t join static_page_section s on s.id = t.section_id"
						+ " join static_page p on p.id = s.page_id) every_body order by slug, position, language")
				.query(String.class).list();
	}

	/**
	 * V73 run over the text before it, the one case in which it succeeds: six sections change (sections 2, 3 and 7 of the
	 * policy, in two languages), and no other section of either table changes by a character. Inside the six, taking
	 * the words and the date out again gives the text V73 found.
	 */
	@Test
	void v73ChangesSixSectionsAndNothingElse() {
		putBackTheTextAsItStoodBeforeV73();

		List<String> before = everySectionBody();
		List<String> found = List.of(bodyOf("sr", THE_TABLE), bodyOf("sr", THE_PLACE), bodyOf("sr", THE_POLICY_SIGN_OFF),
				bodyOf("en", THE_TABLE), bodyOf("en", THE_PLACE), bodyOf("en", THE_POLICY_SIGN_OFF));

		jdbc.execute(migrationSql(String.valueOf(THE_MIGRATION)));

		List<String> after = everySectionBody();

		assertThat(before).as("there is no page text at all, so this case measures nothing").isNotEmpty();
		assertThat(after).hasSameSizeAs(before);

		int changed = 0;

		for (int row = 0; row < before.size(); row++) {
			if (!before.get(row).equals(after.get(row))) {
				changed++;
			}
		}

		assertThat(changed).as("V73 must change the body of six sections and no other").isEqualTo(6);

		for (String language : List.of("sr", "en")) {
			theClauseStandsInThatOneSectionAndTheOldOneNowhere(language);
		}

		assertThat(List.of(asItStoodBefore("sr", THE_TABLE), asItStoodBefore("sr", THE_PLACE),
				asItStoodBefore("sr", THE_POLICY_SIGN_OFF), asItStoodBefore("en", THE_TABLE),
				asItStoodBefore("en", THE_PLACE), asItStoodBefore("en", THE_POLICY_SIGN_OFF)))
				.as("with the words and the date taken out again, sections 2, 3 and 7 must be the text V73 found in each"
						+ " language")
				.isEqualTo(found);
	}

	@Test
	void v73RunAgainOverTheFinishedTextStopsAndSaysTheWordIsAlreadyThere() {
		PSQLException error = v73RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("the written pages were not edited");
		assertThat(error.getServerErrorMessage().getMessage()).contains("8 of 8 edits");
		assertThat(reportOf(error).lines().toList())
				.contains("Date of birth @ politika-privatnosti #3 sr: found 0 times, and its new text is already there",
						"Date of birth @ politika-privatnosti #3 en: found 0 times, and its new text is already there",
						"Document row @ politika-privatnosti #2 sr: found 0 times, and its new text is already there",
						"Document row @ politika-privatnosti #2 en: found 0 times, and its new text is already there",
						"Never shown, item @ politika-privatnosti #3 sr: found 0 times, and its new text is already there",
						"Never shown, item @ politika-privatnosti #3 en: found 0 times, and its new text is already there",
						"Sign-off @ politika-privatnosti #7 sr: found 0 times, and its new text is already there",
						"Sign-off @ politika-privatnosti #7 en: found 0 times, and its new text is already there");
	}

	@Test
	void aSignOffThatIsAlreadyMovedStopsV73() {
		putBackTheTextAsItStoodBeforeV73();
		setBody("sr", THE_POLICY_SIGN_OFF,
				bodyOf("sr", THE_POLICY_SIGN_OFF).replace(SERBIAN_SIGN_OFF, SERBIAN_SIGN_OFF_AFTER));

		PSQLException error = v73RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error))
				.contains("Sign-off @ politika-privatnosti #7 sr: found 0 times, and its new text is already there");
	}

	@Test
	void aSignOffWithoutTheOldDateStopsV73() {
		putBackTheTextAsItStoodBeforeV73();
		setBody("en", THE_POLICY_SIGN_OFF,
				bodyOf("en", THE_POLICY_SIGN_OFF).replace(ENGLISH_SIGN_OFF, "Last amended: 01.01.2026."));

		PSQLException error = v73RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error)).contains("Sign-off @ politika-privatnosti #7 en: found 0 times");
	}

	@Test
	void anOldClauseThatStandsTwiceStopsV73() {
		putBackTheTextAsItStoodBeforeV73();
		setBody("sr", THE_PLACE, bodyOf("sr", THE_PLACE) + "\n" + SERBIAN_OLD);

		PSQLException error = v73RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error)).contains("Date of birth @ politika-privatnosti #3 sr: found 2 times");
	}

	@Test
	void anOldClauseThatIsNotThereStopsV73() {
		putBackTheTextAsItStoodBeforeV73();
		setBody("en", THE_PLACE, bodyOf("en", THE_PLACE).replace(ENGLISH_OLD, "gone"));

		PSQLException error = v73RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error)).contains("Date of birth @ politika-privatnosti #3 en: found 0 times");
	}

	@Test
	void aClauseThatIsAlreadyThereBesideTheOldOneStopsV73() {
		putBackTheTextAsItStoodBeforeV73();
		setBody("sr", THE_PLACE, bodyOf("sr", THE_PLACE) + "\n" + SERBIAN_NEW);

		PSQLException error = v73RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error))
				.contains("Date of birth @ politika-privatnosti #3 sr: found once, and its new text is already there");
	}

	@Test
	void aSectionThatHasNoSuchTextStopsV73() {
		putBackTheTextAsItStoodBeforeV73();

		assertThat(db.sql("delete from static_page_section_translation t using static_page_section s, static_page p"
						+ " where s.id = t.section_id and p.id = s.page_id and p.slug = 'politika-privatnosti'"
						+ " and s.position = 3 and t.language = 'en'")
				.update())
				.as("there is no English text of section 3 of the policy to take away")
				.isOne();

		PSQLException error = v73RunAgain();

		/* Two of the eight are aimed at that text: the clause and the item of the list. */
		assertThat(error.getServerErrorMessage().getMessage()).contains("2 of 8 edits");
		assertThat(reportOf(error).lines().toList())
				.contains("Date of birth @ politika-privatnosti #3 en: there is no such text",
						"Never shown, item @ politika-privatnosti #3 en: there is no such text");
	}

	private static final String SERBIAN_ROW_OLD = "Vidi ga samo administracija, ne prikazuje se nigde i stoji odvojeno od podataka";
	private static final String ENGLISH_ROW_OLD = "Only the administration sees it; it is not displayed anywhere and stands apart from the data";
	private static final String SERBIAN_ROW_NEW = "Vidi ga samo administracija i vi, na svojoj kartici Podaci; drugima se ne prikazuje nigde"
			+ " i stoji odvojeno od podataka";
	private static final String ENGLISH_ROW_NEW = "Only the administration and you see it, on your own Details card; it is not displayed to"
			+ " others anywhere and stands apart from the data";

	private static final String SERBIAN_ITEM_OLD = "veličina majice, ime oca, broj ličnog dokumenta, telefon";
	private static final String ENGLISH_ITEM_OLD = "T-shirt size, father's name, ID document number, phone";
	private static final String SERBIAN_ITEM_NEW = "veličina majice, ime oca i broj ličnog dokumenta, osim vama, na vašoj kartici Podaci,"
			+ " telefon";
	private static final String ENGLISH_ITEM_NEW = "T-shirt size, father's name and ID document number, except to you, on your own"
			+ " Details card, phone";

	/** The heading over the list, which V73 does NOT touch (owner, 24.10.2026), and the words that follow it. */
	private static final String SERBIAN_HEADING = "### Nikada se ne prikazuje\n\nAdresa elektronske pošte";
	private static final String ENGLISH_HEADING = "### Never displayed\n\nE-mail address";

	private static final Place THE_TABLE = new Place(POLICY, 2);

	private static String rowOld(String language) {
		return language.equals("sr") ? SERBIAN_ROW_OLD : ENGLISH_ROW_OLD;
	}

	private static String rowNew(String language) {
		return language.equals("sr") ? SERBIAN_ROW_NEW : ENGLISH_ROW_NEW;
	}

	private static String itemOld(String language) {
		return language.equals("sr") ? SERBIAN_ITEM_OLD : ENGLISH_ITEM_OLD;
	}

	private static String itemNew(String language) {
		return language.equals("sr") ? SERBIAN_ITEM_NEW : ENGLISH_ITEM_NEW;
	}

	private static String headingIn(String language) {
		return language.equals("sr") ? SERBIAN_HEADING : ENGLISH_HEADING;
	}

	/**
	 * THE TWO MORE PLACES (owner, 24.10.2026, the words are the assistant's): the cell of the table that says who sees the
	 * number of the identity document, and the item of the list of what is never shown that names the father's name and
	 * that number, which gains "osim vama, na vašoj kartici Podaci". Each stands once, in its own section and in no other,
	 * and the old words stand nowhere.
	 */
	@Test
	void theCellOfTheDocumentAndTheItemOfTheListStandOnceInTheirOwnSectionsInBothLanguages() {
		for (String language : List.of("sr", "en")) {
			assertThat(placesWhichCarry(language, rowNew(language)))
					.as("the %s cell about the document must stand in section 2 of the policy and in no other", language)
					.containsExactly(THE_TABLE);
			assertThat(placesWhichCarry(language, rowOld(language)))
					.as("the %s cell about the document as it stood before V73 must be nowhere", language).isEmpty();
			assertThat(bodyOf(language, THE_TABLE)).containsOnlyOnce(rowNew(language));

			assertThat(placesWhichCarry(language, itemNew(language)))
					.as("the %s item of the list must stand in section 3 of the policy and in no other", language)
					.containsExactly(THE_PLACE);
			assertThat(placesWhichCarry(language, itemOld(language)))
					.as("the %s item as it stood before V73 must be nowhere", language).isEmpty();
			assertThat(bodyOf(language, THE_PLACE)).containsOnlyOnce(itemNew(language));
		}
	}

	/**
	 * THE HEADING OVER THE LIST IS WHAT IT WAS. A heading with "drugima" over the whole list would say that the member sees
	 * the internal notes, the private messages and the IP address of the parent's signature, which he does not (owner,
	 * 24.10.2026: the exception goes on the one item it is true of). The heading stands once, as it stood, directly over
	 * the list, in both languages.
	 */
	@Test
	void theHeadingOverTheListIsAsItWasAndSaysNothingOfOthers() {
		for (String language : List.of("sr", "en")) {
			assertThat(bodyOf(language, THE_PLACE)).containsOnlyOnce(headingIn(language));
		}

		assertThat(bodyOf("sr", THE_PLACE)).doesNotContain("Nikada se ne prikazuje drugima");
		assertThat(bodyOf("en", THE_PLACE)).doesNotContain("Never displayed to others");
	}

	/**
	 * The rest of the list and the rest of the cell are as they were: the words were added to one item and to one cell,
	 * and nothing was taken out of either.
	 */
	@Test
	void theRestOfTheListAndOfTheCellAreAsTheyWere() {
		assertThat(bodyOf("sr", THE_PLACE))
				.contains("Adresa elektronske pošte, adresa za slanje, sve u vezi sa članarinom i plaćanjem, stanje virtuelnog balansa,"
						+ " veličina majice, ime oca i broj")
				.contains("telefon, privatne poruke, interne beleške administracije");
		assertThat(bodyOf("en", THE_PLACE))
				.contains("E-mail address, mailing address, everything related to the membership fee and payment, virtual balance,"
						+ " T-shirt size, father's name and ID document number")
				.contains("phone, private messages, internal administration notes");
		assertThat(bodyOf("sr", THE_TABLE))
				.contains("u sopstvenoj tabeli sa sopstvenim pravom pristupa | Pravna obaveza | Sekcija 5 |");
		assertThat(bodyOf("en", THE_TABLE))
				.contains("in its own table with its own access rights | Legal obligation | Section 5 |");
	}

	@Test
	void theWordsAreNotAtTheEndOfTheCellOrOfTheList() {
		assertThat(bodyOf("sr", THE_TABLE)).doesNotContain("pravom pristupa drugima");
		assertThat(bodyOf("sr", THE_PLACE)).doesNotContain("osim vama, na vašoj kartici Podaci, privatne poruke");
	}
}
