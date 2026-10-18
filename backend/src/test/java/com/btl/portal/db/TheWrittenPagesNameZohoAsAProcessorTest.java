package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.postgresql.util.PSQLException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * THE ONE ROW V60 ADDS TO THE PRIVACY POLICY (ZOHO AS A PROCESSOR) AND THE DAY IT IS SIGNED OFF ON, HELD ON THE TEXT
 * THE PORTAL SERVES, IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists.</b> The owner approved, on 17.10.2026, the words that name Zoho Corporation as a processor of
 * the correspondence of {@code info@} (PDL, the entry "Nove reči dopune politike za Zoho (američki region)"): one row
 * of the table of processors in section 5 of the privacy policy, directly under the row for Brevo, in Serbian and in
 * English. {@code PageApiTest} holds the Serbian half against {@code pages.json}; nothing else holds the English half,
 * and nothing holds PLACE, which is the half of this edit that is easiest to get wrong: the same row above Brevo, or
 * in a neighbouring section, reads as a different table.
 *
 * <p><b>The sweeps are over every row, with no {@code where} clause</b>, the shape of
 * {@link TheWrittenPagesSayThatTheCategoryRevealsTheYearOfBirthTest}: not that section 5 is right but that the row
 * stands in that one section of each language and in no other, and that no section of any page names Zoho anywhere
 * else.
 *
 * <p><b>The words the owner struck out the same day are held ABSENT.</b> His first approval named "Zoho Corporation
 * B.V." and "Holandija" and was withdrawn because the account stayed on Zoho's American server (PDL, the same entry,
 * struck through). A row that came back with the Netherlands in it would be a false statement in a legal text.
 *
 * <p><b>And the sentence under the table is held UNCHANGED.</b> The entry says the sentence about transfers outside
 * the European Union stays as it is, so it is held to be the last thing the section says, in both languages.
 *
 * <p><b>The sign-off.</b> The same entry moves "Poslednja izmena" of the privacy policy to the day the change reaches
 * QA. Only the policy's text changes, so only its sign-off moves, from 16.10.2026 (V58) to 18.10.2026; the
 * rulebook keeps V58's day and the terms of use keep V57's. {@link
 * TheWrittenPagesSayThatTheCategoryRevealsTheYearOfBirthTest} holds those two from its side.
 *
 * <p><b>The words are the owner's and are written out here in full, not as phrases.</b> One line of one table: a
 * phrase would let a changed word through, and "SAD" for "Holandija" is the difference between the truth and the
 * thing he withdrew.
 *
 * <p><b>Both floors are asked of the migrations, not of this file.</b> The anchor rows are looked for in the
 * migrations that wrote them, the new row and the new day in no migration before V60.
 */
class TheWrittenPagesNameZohoAsAProcessorTest extends DatabaseTest {

	/** The migration this file is about. */
	private static final int THE_MIGRATION = 60;

	private static final String POLICY = "politika-privatnosti";

	private static final String SERBIAN_BREVO = "| Brevo (Sendinblue SAS) | Vaša adresa i sadržaj poruke | Francuska |";
	private static final String ENGLISH_BREVO = "| Brevo (Sendinblue SAS) | Your address and the content of the message | France |";

	private static final String SERBIAN_ZOHO = "| Zoho Corporation | Prepiska sa adresom info@: vaša adresa i sadržaj poruka | SAD |";
	private static final String ENGLISH_ZOHO = "| Zoho Corporation | Correspondence with info@: your address and the content of the messages | USA |";

	/** The row that follows the new one, as far as it identifies the row: the Association's bank. */
	private static final String SERBIAN_NEXT_ROW = "| Poslovna banka Udruženja |";
	private static final String ENGLISH_NEXT_ROW = "| The Association's business bank |";

	/** The sentence that closes section 5 and that the owner's entry leaves as it is. */
	private static final String SERBIAN_CLOSING = "Server je u Nemačkoj, dakle u Evropskoj uniji. Za prenos van Evropske"
			+ " unije koristimo propisane mehanizme zaštite.";
	private static final String ENGLISH_CLOSING = "The server is in Germany, that is, in the European Union. For transfers"
			+ " outside the European Union we use the prescribed safeguard mechanisms.";

	private static final String SERBIAN_SIGN_OFF_BEFORE = "Poslednja izmena: 16.10.2026.";
	private static final String SERBIAN_SIGN_OFF_AFTER = "Poslednja izmena: 18.10.2026.";
	private static final String ENGLISH_SIGN_OFF_BEFORE = "Last amended: 16.10.2026.";
	private static final String ENGLISH_SIGN_OFF_AFTER = "Last amended: 18.10.2026.";

	/** A section by the page it belongs to and its place in it. */
	record Place(String slug, int position) {
	}

	private static final Place THE_TABLE = new Place(POLICY, 5);
	private static final Place THE_POLICY_SIGN_OFF = new Place(POLICY, 7);

	@Autowired
	JdbcTemplate jdbc;

	private static String brevoIn(String language) {
		return language.equals("sr") ? SERBIAN_BREVO : ENGLISH_BREVO;
	}

	private static String zohoIn(String language) {
		return language.equals("sr") ? SERBIAN_ZOHO : ENGLISH_ZOHO;
	}

	private static String nextRowIn(String language) {
		return language.equals("sr") ? SERBIAN_NEXT_ROW : ENGLISH_NEXT_ROW;
	}

	private static String closingIn(String language) {
		return language.equals("sr") ? SERBIAN_CLOSING : ENGLISH_CLOSING;
	}

	private static String signOffBefore(String language) {
		return language.equals("sr") ? SERBIAN_SIGN_OFF_BEFORE : ENGLISH_SIGN_OFF_BEFORE;
	}

	private static String signOffAfter(String language) {
		return language.equals("sr") ? SERBIAN_SIGN_OFF_AFTER : ENGLISH_SIGN_OFF_AFTER;
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

	private void theRowStandsInThatOneSectionAndZohoIsNamedNowhereElse(String language) {
		assertThat(placesWhichCarry(language, zohoIn(language)))
				.as("the %s row must stand in section 5 of the privacy policy and in no other section", language)
				.containsExactly(THE_TABLE);
		assertThat(placesWhichCarry(language, "Zoho"))
				.as("the %s text must name Zoho in section 5 of the privacy policy and nowhere else", language)
				.containsExactly(THE_TABLE);
		assertThat(bodyOf(language, THE_TABLE).lines().filter(line -> line.contains("Zoho")).toList())
				.as("section 5 must name Zoho in one line and that line is the row, in %s", language)
				.containsExactly(zohoIn(language));
	}

	private void theRowFollowsBrevoDirectlyAndPrecedesTheBank(String language) {
		assertThat(bodyOf(language, THE_TABLE))
				.as("%s: the row must come directly under the row for Brevo and directly above the next row, once",
						language)
				.containsOnlyOnce(brevoIn(language) + "\n" + zohoIn(language) + "\n" + nextRowIn(language));
	}

	private void theSentenceUnderTheTableIsTheLastThingTheSectionSaysAndIsUnchanged(String language) {
		assertThat(bodyOf(language, THE_TABLE))
				.as("%s: the sentence about transfers outside the European Union must stay, once, as the last thing"
						+ " the section says", language)
				.containsOnlyOnce(closingIn(language))
				.endsWith(closingIn(language));
	}

	private void theWordsTheOwnerStruckOutAreNowhere(String language) {
		for (String struck : List.of("Zoho Corporation B.V.", "Holandija", "Netherlands")) {
			assertThat(placesWhichCarry(language, struck))
					.as("the %s text carries \"%s\", which the owner struck out on 17.10.2026", language, struck)
					.isEmpty();
		}
	}

	@Test
	void theSerbianRowStandsInThatOneSectionAndZohoIsNamedNowhereElse() {
		theRowStandsInThatOneSectionAndZohoIsNamedNowhereElse("sr");
	}

	@Test
	void theEnglishRowStandsInThatOneSectionAndZohoIsNamedNowhereElse() {
		theRowStandsInThatOneSectionAndZohoIsNamedNowhereElse("en");
	}

	@Test
	void theSerbianRowFollowsBrevoDirectlyAndPrecedesTheBank() {
		theRowFollowsBrevoDirectlyAndPrecedesTheBank("sr");
	}

	@Test
	void theEnglishRowFollowsBrevoDirectlyAndPrecedesTheBank() {
		theRowFollowsBrevoDirectlyAndPrecedesTheBank("en");
	}

	@Test
	void theSerbianSentenceUnderTheTableIsUnchanged() {
		theSentenceUnderTheTableIsTheLastThingTheSectionSaysAndIsUnchanged("sr");
	}

	@Test
	void theEnglishSentenceUnderTheTableIsUnchanged() {
		theSentenceUnderTheTableIsTheLastThingTheSectionSaysAndIsUnchanged("en");
	}

	@Test
	void noSerbianSectionCarriesTheWordsTheOwnerStruckOut() {
		theWordsTheOwnerStruckOutAreNowhere("sr");
	}

	@Test
	void noEnglishSectionCarriesTheWordsTheOwnerStruckOut() {
		theWordsTheOwnerStruckOutAreNowhere("en");
	}

	private void theSignOffOfThePolicyIsMovedAndNoOtherDocumentMovesWithIt(String language) {
		assertThat(placesWhichCarry(language, signOffAfter(language)))
				.as("the %s sign-off of 18.10.2026 must stand on the privacy policy alone", language)
				.containsExactly(THE_POLICY_SIGN_OFF);
		assertThat(bodyOf(language, THE_POLICY_SIGN_OFF))
				.as("the privacy policy must be signed off once, on 18.10.2026, and no longer on 16.10.2026")
				.containsOnlyOnce(signOffAfter(language))
				.doesNotContain(signOffBefore(language));
		assertThat(placesWhichCarry(language, signOffBefore(language)))
				.as("the %s sign-off of 16.10.2026 must stand on the rulebook alone, the policy having moved on",
						language)
				.containsExactly(new Place("pravilnik", 19));
	}

	@Test
	void theSerbianSignOffOfThePolicyIsMovedAndNoOtherDocumentMovesWithIt() {
		theSignOffOfThePolicyIsMovedAndNoOtherDocumentMovesWithIt("sr");
	}

	@Test
	void theEnglishSignOffOfThePolicyIsMovedAndNoOtherDocumentMovesWithIt() {
		theSignOffOfThePolicyIsMovedAndNoOtherDocumentMovesWithIt("en");
	}

	/**
	 * THE FLOORS, asked of the migrations.
	 *
	 * <p>The row for Brevo is the anchor, so "directly under it" means something only if the migrations that wrote it
	 * wrote it (V41 in Serbian, V43 in English); a row for Zoho that an earlier migration already wrote would make
	 * the sweeps above pass without V60 doing anything; and the day V60 moves the policy to must not be written
	 * before it, while the day it moves it from is V58's. All are read out of the files Flyway resolved.
	 */
	@Test
	void theAnchorsAreOlderMigrationsAndNoMigrationBeforeV60WroteTheRowOrTheDay() {
		String before = everyMigrationBeforeThisOne();

		assertThat(before).as("no migration before V60 was read, so this case measures nothing").isNotBlank();

		for (String anchor : List.of(SERBIAN_BREVO, ENGLISH_BREVO)) {
			assertThat(before).as("no migration before V60 carries the anchor \"%s\", so \"directly under it\""
					+ " measures nothing", anchor).contains(anchor);
		}

		for (String row : List.of(SERBIAN_ZOHO, ENGLISH_ZOHO)) {
			assertThat(before).as("a migration before V60 already writes \"%s\"", row).doesNotContain(row);
		}

		assertThat(before).as("a migration before V60 already names Zoho").doesNotContain("Zoho");

		for (String signOff : List.of(SERBIAN_SIGN_OFF_BEFORE, ENGLISH_SIGN_OFF_BEFORE)) {
			assertThat(migrationSql("58")).as("V58 does not write the sign-off \"%s\", so moving it measures nothing",
					signOff).contains(signOff);
		}

		for (String signOff : List.of(SERBIAN_SIGN_OFF_AFTER, ENGLISH_SIGN_OFF_AFTER)) {
			assertThat(before).as("a migration before V60 already writes \"%s\"", signOff).doesNotContain(signOff);
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

	/**
	 * V60 run once more, over the text it has already edited, and the error PostgreSQL answers with.
	 *
	 * <p>The last thing a case may ask of the database: the error leaves the transaction aborted.
	 */
	private PSQLException v60RunAgain() {
		String sql = migrationSql(String.valueOf(THE_MIGRATION));
		Throwable stopped = catchThrowable(() -> jdbc.execute(sql));

		assertThat(stopped)
				.as("V60 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently, and a second run that adds the row again is worse")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V60 stopped with something other than an error from PostgreSQL").isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	private static String reportOf(PSQLException error) {
		return error.getServerErrorMessage().getDetail();
	}

	@Test
	void v60RunAgainOverTheFinishedTextStopsAndSaysTheRowIsAlreadyThere() {
		PSQLException error = v60RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("the written pages were not edited");
		assertThat(error.getServerErrorMessage().getMessage()).contains("4 of 4 edits");
		assertThat(reportOf(error).lines().toList())
				.as("the anchor stands once and the row is already there, and V60 did not say so")
				.contains("Zoho @ politika-privatnosti #5 sr: found once, and its new text is already there",
						"Zoho @ politika-privatnosti #5 en: found once, and its new text is already there");
		assertThat(reportOf(error).lines().toList())
				.as("the sign-off is already moved and V60 did not say so")
				.contains("Zoho date @ politika-privatnosti #7 sr: found 0 times, and its new text is already there",
						"Zoho date @ politika-privatnosti #7 en: found 0 times, and its new text is already there");
	}

	/**
	 * The text as it stood BEFORE V60: the row taken out of the two sections it was put into and the policy's sign-off
	 * put back to 16.10.2026, by hand and with nothing else touched. The refusals below are asked of this text,
	 * because it is the one V60 is written for; asked of the finished text every edit would refuse for the same
	 * reason (the row is already there) and one edit's own check could be taken away without any case noticing.
	 */
	private void putBackTheTextAsItStoodBeforeV60() {
		for (String language : List.of("sr", "en")) {
			setBody(language, THE_TABLE, bodyOf(language, THE_TABLE).replace("\n" + zohoIn(language), ""));
			setBody(language, THE_POLICY_SIGN_OFF,
					bodyOf(language, THE_POLICY_SIGN_OFF).replace(signOffAfter(language), signOffBefore(language)));
		}
	}

	/** Every body of both tables in a fixed order, so that two readings can be compared row by row. */
	private List<String> everySectionBody() {
		return db.sql("select body from (select p.slug, s.position, 'sr' as language, s.body"
						+ " from static_page_section s join static_page p on p.id = s.page_id"
						+ " union all select p.slug, s.position, t.language, t.body"
						+ " from static_page_section_translation t join static_page_section s on s.id = t.section_id"
						+ " join static_page p on p.id = s.page_id) every_body order by slug, position, language")
				.query(String.class).list();
	}

	/**
	 * V60 run over the text before it, which is the one case in which it succeeds: two sections gain the row directly
	 * under Brevo, the policy's sign-off moves in both languages, and no other section of either table changes by a
	 * character.
	 */
	@Test
	void v60AddsTheRowAndMovesTheSignOffInFourSectionsAndChangesNothingElse() {
		putBackTheTextAsItStoodBeforeV60();

		List<String> before = everySectionBody();

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

		assertThat(changed).as("V60 must change the body of four sections (two for the row, two for the date) and no"
				+ " other").isEqualTo(4);

		for (String language : List.of("sr", "en")) {
			theRowStandsInThatOneSectionAndZohoIsNamedNowhereElse(language);
			theRowFollowsBrevoDirectlyAndPrecedesTheBank(language);
			theSentenceUnderTheTableIsTheLastThingTheSectionSaysAndIsUnchanged(language);
			assertThat(bodyOf(language, THE_POLICY_SIGN_OFF))
					.as("the policy must be signed off on 18.10.2026 once V60 has run, in %s", language)
					.containsOnlyOnce(signOffAfter(language))
					.doesNotContain(signOffBefore(language));
		}
	}

	@Test
	void anAnchorThatStandsTwiceStopsV60() {
		putBackTheTextAsItStoodBeforeV60();
		setBody("sr", THE_TABLE, bodyOf("sr", THE_TABLE) + "\n" + SERBIAN_BREVO);

		PSQLException error = v60RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("the anchor stands twice and V60 did not say so")
				.contains("Zoho @ politika-privatnosti #5 sr: found 2 times");
	}

	@Test
	void anAnchorThatIsNotThereStopsV60() {
		putBackTheTextAsItStoodBeforeV60();
		setBody("en", THE_TABLE, bodyOf("en", THE_TABLE).replace(ENGLISH_BREVO, "gone"));

		PSQLException error = v60RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("the anchor is not where V60 looks for it and V60 did not say so")
				.contains("Zoho @ politika-privatnosti #5 en: found 0 times");
	}

	@Test
	void aRowThatIsAlreadyThereInOneSectionStopsV60() {
		putBackTheTextAsItStoodBeforeV60();
		setBody("sr", THE_TABLE, bodyOf("sr", THE_TABLE).replace(SERBIAN_BREVO, SERBIAN_BREVO + "\n" + SERBIAN_ZOHO));

		PSQLException error = v60RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("the anchor stands once and the row is already there, and V60 did not say so")
				.contains("Zoho @ politika-privatnosti #5 sr: found once, and its new text is already there");
	}

	@Test
	void aSignOffThatIsAlreadyMovedStopsV60() {
		putBackTheTextAsItStoodBeforeV60();
		setBody("sr", THE_POLICY_SIGN_OFF,
				bodyOf("sr", THE_POLICY_SIGN_OFF).replace(SERBIAN_SIGN_OFF_BEFORE, SERBIAN_SIGN_OFF_AFTER));

		PSQLException error = v60RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("the policy is already signed off on 18.10.2026 and V60 did not say so")
				.contains("Zoho date @ politika-privatnosti #7 sr: found 0 times, and its new text is already there");
	}

	@Test
	void aSignOffWithoutTheOldDateStopsV60() {
		putBackTheTextAsItStoodBeforeV60();
		setBody("en", THE_POLICY_SIGN_OFF,
				bodyOf("en", THE_POLICY_SIGN_OFF).replace(ENGLISH_SIGN_OFF_BEFORE, "Last amended: 01.01.2026."));

		PSQLException error = v60RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("the policy does not carry the date V60 was written against and V60 did not say so")
				.contains("Zoho date @ politika-privatnosti #7 en: found 0 times");
	}

	@Test
	void aSectionThatHasNoSuchTextStopsV60() {
		putBackTheTextAsItStoodBeforeV60();

		assertThat(db.sql("delete from static_page_section_translation t using static_page_section s, static_page p"
						+ " where s.id = t.section_id and p.id = s.page_id and p.slug = 'politika-privatnosti'"
						+ " and s.position = 5 and t.language = 'en'")
				.update())
				.as("there is no English text of section 5 of the policy to take away")
				.isOne();

		PSQLException error = v60RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("an edit was aimed at a text that is not there and V60 did not say so")
				.contains("Zoho @ politika-privatnosti #5 en: there is no such text");
	}

	private static final Pattern A_LINE_OF_THE_REPORT = Pattern.compile("^(.+ @ \\S+ #\\d+ \\w+): .+$");

	/**
	 * THE TABLE NAMES EXACTLY THE EDITS V60 MAKES, asked of V60 itself: the four it aims at the places and the
	 * languages above (two for the row, two for the sign-off). An edit added to the file and not here, or one dropped
	 * from it, fails.
	 */
	@Test
	void v60MakesExactlyTheFourEditsTheSweepsHold() {
		Set<String> editedByTheMigration = new HashSet<>();

		for (String line : reportOf(v60RunAgain()).lines().toList()) {
			Matcher named = A_LINE_OF_THE_REPORT.matcher(line);

			assertThat(named.matches()).as("V60 reported a line this case cannot read: %s", line).isTrue();
			editedByTheMigration.add(named.group(1));
		}

		Set<String> heldByTheSweeps = new HashSet<>();

		for (String language : List.of("sr", "en")) {
			heldByTheSweeps.add("Zoho @ " + THE_TABLE.slug() + " #" + THE_TABLE.position() + " " + language);
			heldByTheSweeps.add("Zoho date @ " + THE_POLICY_SIGN_OFF.slug() + " #" + THE_POLICY_SIGN_OFF.position()
					+ " " + language);
		}

		assertThat(editedByTheMigration).as("V60 names no edit at all, so this case measures nothing").isNotEmpty();
		assertThat(heldByTheSweeps)
				.as("the sweeps and V60 do not hold the same edits, each aimed at the same section in the same language")
				.isEqualTo(editedByTheMigration);
	}
}
