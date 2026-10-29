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
 * THE ONE ROW V70 CHANGES IN THE PRIVACY POLICY (CLOUDFLARE ALSO STORES THE ENCRYPTED BACKUPS) AND THE DAY THE POLICY
 * IS SIGNED OFF ON, HELD ON THE TEXT THE PORTAL SERVES, IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists.</b> The owner approved, on 20.10.2026, the words of the row about Cloudflare in the table of
 * processors in section 5 of the privacy policy (PDL, the entry "Red o Cloudflare-u u politici privatnosti postaje"):
 * the second cell gains "; čuvanje šifrovanih rezervnih kopija baze i slika", and the English row gains "; storage of
 * encrypted backups of the database and photos". {@code PageApiTest} holds the Serbian half against
 * {@code pages.json}; nothing else holds the English half, and nothing holds that the edit landed on THIS row and no
 * other, which is the half of a one-row edit that is easiest to get wrong: the row for Zoho, which V60 wrote directly
 * under Brevo, has a second cell of the same shape.
 *
 * <p><b>The sweeps are over every row, with no {@code where} clause</b>, the shape of
 * {@link TheWrittenPagesNameZohoAsAProcessorTest}: not that section 5 is right but that the row stands in that one
 * section of each language and in no other, and that no section of any page names Cloudflare anywhere else.
 *
 * <p><b>The old row is held ABSENT.</b> The edit is a replacement, so a migration that added the new row and left the
 * old one standing would publish Cloudflare twice, once saying less.
 *
 * <p><b>And nothing else in the section moved.</b> The finished section, with the new row put back to the old one, is
 * the text V70 found, character for character; this is what catches an edit that landed on a neighbour.
 *
 * <p><b>The sign-off.</b> The entry is silent about the date; it follows from the entry of 16.10.2026 (the date moves
 * on the documents whose text changes) the way V58 and V60 followed it. Only the policy's text changes, so only its
 * sign-off moves, from 18.10.2026 (V60) to 22.10.2026; the rulebook keeps V58's day and the terms of use keep V57's.
 * Since V71 the rulebook and the terms stand at 22.10.2026 too (owner, 22.10.2026), so the cases on the finished
 * text hold all three there, and the cases that run V70 again first put the pages back to the text V71 found
 * ({@link TheWrittenPagesBeforeV71}).
 *
 * <p><b>The words are written out here in full, not as phrases.</b> One line of one table: a phrase would let a changed
 * word through.
 *
 * <p><b>Both floors are asked of the migrations, not of this file.</b> The old rows are looked for in the migrations
 * that wrote them (V41 in Serbian, V43 in English), the new rows and the new day in no migration before V70.
 */
class TheWrittenPagesTheCloudflareRowNamesTheBackupsTest extends DatabaseTest {

	/** The migration this file is about. */
	private static final int THE_MIGRATION = 70;

	private static final String POLICY = "politika-privatnosti";

	private static final String SERBIAN_OLD_ROW = "| Cloudflare | Saobraćaj i IP adrese, zaštita i domen | SAD i EU |";
	private static final String ENGLISH_OLD_ROW = "| Cloudflare | Traffic and IP addresses, protection, and the domain | USA and EU |";

	private static final String SERBIAN_ROW = "| Cloudflare | Saobraćaj i IP adrese, zaštita i domen; čuvanje šifrovanih"
			+ " rezervnih kopija baze i slika | SAD i EU |";
	private static final String ENGLISH_ROW = "| Cloudflare | Traffic and IP addresses, protection, and the domain;"
			+ " storage of encrypted backups of the database and photos | USA and EU |";

	/** The rows directly above and directly below the one, as far as they identify the row. */
	private static final String SERBIAN_ABOVE = "| Hetzner Online GmbH | Smeštaj portala | Nemačka |";
	private static final String ENGLISH_ABOVE = "| Hetzner Online GmbH | Portal hosting | Germany |";
	private static final String SERBIAN_BELOW = "| PayPal (Europe) S.à r.l. et Cie, S.C.A. |";
	private static final String ENGLISH_BELOW = "| PayPal (Europe) S.à r.l. et Cie, S.C.A. |";

	/** The row V60 wrote for Zoho, which this edit must not touch. */
	private static final String SERBIAN_ZOHO = "| Zoho Corporation | Prepiska sa adresom info@: vaša adresa i sadržaj poruka | SAD |";
	private static final String ENGLISH_ZOHO = "| Zoho Corporation | Correspondence with info@: your address and the content of the messages | USA |";

	/** The sentence that closes section 5 and that the entry leaves as it is. */
	private static final String SERBIAN_CLOSING = "Server je u Nemačkoj, dakle u Evropskoj uniji. Za prenos van Evropske"
			+ " unije koristimo propisane mehanizme zaštite.";
	private static final String ENGLISH_CLOSING = "The server is in Germany, that is, in the European Union. For transfers"
			+ " outside the European Union we use the prescribed safeguard mechanisms.";

	private static final String SERBIAN_SIGN_OFF_BEFORE = "Poslednja izmena: 18.10.2026.";
	private static final String SERBIAN_SIGN_OFF_AFTER = "Poslednja izmena: 22.10.2026.";
	private static final String ENGLISH_SIGN_OFF_BEFORE = "Last amended: 18.10.2026.";
	private static final String ENGLISH_SIGN_OFF_AFTER = "Last amended: 22.10.2026.";

	/** The days the other two documents keep. */
	private static final String SERBIAN_RULEBOOK_SIGN_OFF = "Poslednja izmena: 16.10.2026.";
	private static final String ENGLISH_RULEBOOK_SIGN_OFF = "Last amended: 16.10.2026.";
	private static final String SERBIAN_TERMS_SIGN_OFF = "Poslednja izmena: 10.10.2026.";
	private static final String ENGLISH_TERMS_SIGN_OFF = "Last amended: 10.10.2026.";

	/** A section by the page it belongs to and its place in it. */
	record Place(String slug, int position) {
	}

	private static final Place THE_TABLE = new Place(POLICY, 5);
	private static final Place THE_POLICY_SIGN_OFF = new Place(POLICY, 7);
	private static final Place THE_RULEBOOK_SIGN_OFF = new Place("pravilnik", 19);
	private static final Place THE_TERMS_SIGN_OFF = new Place("uslovi-koriscenja", 12);

	@Autowired
	JdbcTemplate jdbc;

	private static String oldRowIn(String language) {
		return language.equals("sr") ? SERBIAN_OLD_ROW : ENGLISH_OLD_ROW;
	}

	private static String rowIn(String language) {
		return language.equals("sr") ? SERBIAN_ROW : ENGLISH_ROW;
	}

	private static String aboveIn(String language) {
		return language.equals("sr") ? SERBIAN_ABOVE : ENGLISH_ABOVE;
	}

	private static String belowIn(String language) {
		return language.equals("sr") ? SERBIAN_BELOW : ENGLISH_BELOW;
	}

	private static String zohoIn(String language) {
		return language.equals("sr") ? SERBIAN_ZOHO : ENGLISH_ZOHO;
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

	private static String rulebookSignOffIn(String language) {
		return language.equals("sr") ? SERBIAN_RULEBOOK_SIGN_OFF : ENGLISH_RULEBOOK_SIGN_OFF;
	}

	private static String termsSignOffIn(String language) {
		return language.equals("sr") ? SERBIAN_TERMS_SIGN_OFF : ENGLISH_TERMS_SIGN_OFF;
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

	private void theRowStandsInThatOneSectionAndCloudflareIsNamedNowhereElse(String language) {
		assertThat(placesWhichCarry(language, rowIn(language)))
				.as("the %s row must stand in section 5 of the privacy policy and in no other section", language)
				.containsExactly(THE_TABLE);
		assertThat(placesWhichCarry(language, "Cloudflare"))
				.as("the %s text must name Cloudflare in section 5 of the privacy policy and nowhere else", language)
				.containsExactly(THE_TABLE);
		assertThat(bodyOf(language, THE_TABLE).lines().filter(line -> line.contains("Cloudflare")).toList())
				.as("section 5 must name Cloudflare in one line and that line is the row, in %s", language)
				.containsExactly(rowIn(language));
	}

	private void theOldRowIsGoneAndTheRowSitsBetweenItsNeighbours(String language) {
		assertThat(placesWhichCarry(language, oldRowIn(language)))
				.as("the %s row as it stood before V70 must be nowhere, or Cloudflare is named twice", language)
				.isEmpty();
		assertThat(bodyOf(language, THE_TABLE))
				.as("%s: the row must come directly under the row for Hetzner and directly above the next row, once",
						language)
				.containsOnlyOnce(aboveIn(language) + "\n" + rowIn(language) + "\n" + belowIn(language));
	}

	private void theRowOfZohoIsUntouched(String language) {
		assertThat(bodyOf(language, THE_TABLE).lines().filter(line -> line.contains("Zoho")).toList())
				.as("the %s row for Zoho must be exactly what V60 wrote, once", language)
				.containsExactly(zohoIn(language));
	}

	private void theSentenceUnderTheTableIsTheLastThingTheSectionSaysAndIsUnchanged(String language) {
		assertThat(bodyOf(language, THE_TABLE))
				.as("%s: the sentence about transfers outside the European Union must stay, once, as the last thing"
						+ " the section says", language)
				.containsOnlyOnce(closingIn(language))
				.endsWith(closingIn(language));
	}

	@Test
	void theSerbianRowStandsInThatOneSectionAndCloudflareIsNamedNowhereElse() {
		theRowStandsInThatOneSectionAndCloudflareIsNamedNowhereElse("sr");
	}

	@Test
	void theEnglishRowStandsInThatOneSectionAndCloudflareIsNamedNowhereElse() {
		theRowStandsInThatOneSectionAndCloudflareIsNamedNowhereElse("en");
	}

	@Test
	void theSerbianOldRowIsGoneAndTheRowSitsBetweenItsNeighbours() {
		theOldRowIsGoneAndTheRowSitsBetweenItsNeighbours("sr");
	}

	@Test
	void theEnglishOldRowIsGoneAndTheRowSitsBetweenItsNeighbours() {
		theOldRowIsGoneAndTheRowSitsBetweenItsNeighbours("en");
	}

	@Test
	void theSerbianRowOfZohoIsUntouched() {
		theRowOfZohoIsUntouched("sr");
	}

	@Test
	void theEnglishRowOfZohoIsUntouched() {
		theRowOfZohoIsUntouched("en");
	}

	@Test
	void theSerbianSentenceUnderTheTableIsUnchanged() {
		theSentenceUnderTheTableIsTheLastThingTheSectionSaysAndIsUnchanged("sr");
	}

	@Test
	void theEnglishSentenceUnderTheTableIsUnchanged() {
		theSentenceUnderTheTableIsTheLastThingTheSectionSaysAndIsUnchanged("en");
	}

	private void theSignOffOfThePolicyIsMovedAndNoOtherDocumentMovesWithIt(String language) {
		assertThat(placesWhichCarry(language, signOffAfter(language)))
				.as("the %s sign-off of 22.10.2026 must stand on the privacy policy alone", language)
				.containsExactly(THE_POLICY_SIGN_OFF);
		assertThat(bodyOf(language, THE_POLICY_SIGN_OFF))
				.as("the privacy policy must be signed off once, on 22.10.2026, and no longer on 18.10.2026")
				.containsOnlyOnce(signOffAfter(language))
				.doesNotContain(signOffBefore(language));
		assertThat(placesWhichCarry(language, signOffBefore(language)))
				.as("the %s sign-off of 18.10.2026 must stand nowhere, the policy having moved on", language)
				.isEmpty();
		assertThat(placesWhichCarry(language, rulebookSignOffIn(language)))
				.as("the %s sign-off of 16.10.2026 must stand on the rulebook alone", language)
				.containsExactly(THE_RULEBOOK_SIGN_OFF);
		assertThat(placesWhichCarry(language, termsSignOffIn(language)))
				.as("the %s sign-off of 10.10.2026 must stand on the terms of use alone", language)
				.containsExactly(THE_TERMS_SIGN_OFF);
	}

	/**
	 * THE SIGN-OFFS AS THEY STAND NOW, which is not how V70 left them: V71 moved the rulebook's and the terms' to the
	 * day V70 moved the policy to (owner, 22.10.2026), and moved the terms' section up by one. None of the earlier days
	 * stands anywhere. What V70 itself does to the dates is held by
	 * {@link #v70ChangesTheRowAndMovesTheSignOffInFourSectionsAndChangesNothingElse}.
	 */
	private void theSignOffsStandAsTheyDoNow(String language) {
		/* V73 moved the policy's on to 24.10.2026 and V76 the rulebook's to 27.10.2026 (PDL, "Datum Poslednja izmena se
		   pomera"); V77 (owner, 29.10.2026) moved all three to 29.10.2026, so each of those days stands nowhere now and
		   the one day stands on all three documents. */
		String today = language.equals("sr") ? "Poslednja izmena: 29.10.2026." : "Last amended: 29.10.2026.";

		assertThat(placesWhichCarry(language, today))
				.as("the %s sign-off of 29.10.2026 must stand on all three documents, V77 having moved them together",
						language)
				.containsExactlyInAnyOrder(THE_RULEBOOK_SIGN_OFF, THE_POLICY_SIGN_OFF, new Place("uslovi-koriscenja", 11));
		assertThat(bodyOf(language, THE_POLICY_SIGN_OFF)).containsOnlyOnce(today);

		for (String gone : List.of(signOffAfter(language),
				language.equals("sr") ? "Poslednja izmena: 27.10.2026." : "Last amended: 27.10.2026.",
				language.equals("sr") ? "Poslednja izmena: 24.10.2026." : "Last amended: 24.10.2026.",
				signOffBefore(language), rulebookSignOffIn(language), termsSignOffIn(language))) {
			assertThat(placesWhichCarry(language, gone))
					.as("the %s sign-off \"%s\" must stand nowhere", language, gone)
					.isEmpty();
		}
	}

	@Test
	void theSerbianSignOffsStandAsTheyDoNow() {
		theSignOffsStandAsTheyDoNow("sr");
	}

	@Test
	void theEnglishSignOffsStandAsTheyDoNow() {
		theSignOffsStandAsTheyDoNow("en");
	}

	/**
	 * THE FLOORS, asked of the migrations.
	 *
	 * <p>The old rows are what the edit is aimed at, so "the old row is gone" means something only if the migrations
	 * that wrote them wrote them (V41 in Serbian, V43 in English); a new row that an earlier migration already wrote
	 * would make the sweeps above pass without V70 doing anything; and the day V70 moves the policy to must not be
	 * written before it, while the day it moves it from is V60's. All are read out of the files Flyway resolved.
	 */
	@Test
	void theOldRowsAreOlderMigrationsAndNoMigrationBeforeV70WroteTheRowOrTheDay() {
		String before = everyMigrationBeforeThisOne();

		assertThat(before).as("no migration before V70 was read, so this case measures nothing").isNotBlank();

		assertThat(migrationSql("41")).as("V41 does not write the Serbian old row, so \"it is gone\" measures nothing")
				.contains(SERBIAN_OLD_ROW);
		assertThat(migrationSql("43")).as("V43 does not write the English old row, so \"it is gone\" measures nothing")
				.contains(ENGLISH_OLD_ROW);

		for (String row : List.of(SERBIAN_ROW, ENGLISH_ROW)) {
			assertThat(before).as("a migration before V70 already writes \"%s\"", row).doesNotContain(row);
		}

		for (String backups : List.of("rezervnih kopija", "encrypted backups")) {
			assertThat(before).as("a migration before V70 already speaks of \"%s\"", backups).doesNotContain(backups);
		}

		for (String signOff : List.of(SERBIAN_SIGN_OFF_BEFORE, ENGLISH_SIGN_OFF_BEFORE)) {
			assertThat(migrationSql("60")).as("V60 does not write the sign-off \"%s\", so moving it measures nothing",
					signOff).contains(signOff);
		}

		for (String signOff : List.of(SERBIAN_SIGN_OFF_AFTER, ENGLISH_SIGN_OFF_AFTER)) {
			assertThat(before).as("a migration before V70 already writes \"%s\"", signOff).doesNotContain(signOff);
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
	 * V70 run once more, over the text it has already edited, and the error PostgreSQL answers with.
	 *
	 * <p>The last thing a case may ask of the database: the error leaves the transaction aborted.
	 */
	private PSQLException v70RunAgain() {
		String sql = migrationSql(String.valueOf(THE_MIGRATION));
		Throwable stopped = catchThrowable(() -> jdbc.execute(sql));

		assertThat(stopped)
				.as("V70 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V70 stopped with something other than an error from PostgreSQL").isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	private static String reportOf(PSQLException error) {
		return error.getServerErrorMessage().getDetail();
	}

	@Test
	void v70RunAgainOverTheFinishedTextStopsAndSaysTheRowIsAlreadyThere() {
		PSQLException error = v70RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("the written pages were not edited");
		assertThat(error.getServerErrorMessage().getMessage()).contains("4 of 4 edits");
		assertThat(reportOf(error).lines().toList())
				.as("the old row is gone and its new text is already there, and V70 did not say so")
				.contains("Cloudflare @ politika-privatnosti #5 sr: found 0 times, and its new text is already there",
						"Cloudflare @ politika-privatnosti #5 en: found 0 times, and its new text is already there");
		assertThat(reportOf(error).lines().toList())
				.as("the sign-off has moved on and V70 did not say its old date is gone")
				/* The new text of V70 (22.10.2026) is not there either since V73 moved the policy on to 24.10.2026, so
				   the report says only that the old date is found nowhere. */
				.contains("Cloudflare date @ politika-privatnosti #7 sr: found 0 times",
						"Cloudflare date @ politika-privatnosti #7 en: found 0 times");
	}

	/**
	 * The text as it stood BEFORE V70: the new row put back to the old one in the two sections it was written into and
	 * the policy's sign-off put back to 18.10.2026, by hand and with nothing else touched. The refusals below are asked
	 * of this text, because it is the one V70 is written for; asked of the finished text every edit would refuse for
	 * the same reason and one edit's own check could be taken away without any case noticing.
	 */
	private void putBackTheTextAsItStoodBeforeV70() {
		/* First the text V71 found, which is the pages as V70 left them. */
		TheWrittenPagesBeforeV71.putBack(db, migrationSql("71"));

		for (String language : List.of("sr", "en")) {
			setBody(language, THE_TABLE, bodyOf(language, THE_TABLE).replace(rowIn(language), oldRowIn(language)));
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
	 * V70 run over the text before it, which is the one case in which it succeeds: two sections gain the words in the
	 * row for Cloudflare, the policy's sign-off moves in both languages, and no other section of either table changes
	 * by a character. Inside the sections that do change, putting the new words back gives the text V70 found: the
	 * edit landed on that row and on nothing beside it.
	 */
	@Test
	void v70ChangesTheRowAndMovesTheSignOffInFourSectionsAndChangesNothingElse() {
		putBackTheTextAsItStoodBeforeV70();

		List<String> before = everySectionBody();
		Set<String> tableBefore = Set.of(bodyOf("sr", THE_TABLE), bodyOf("en", THE_TABLE));

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

		assertThat(changed).as("V70 must change the body of four sections (two for the row, two for the date) and no"
				+ " other").isEqualTo(4);

		Set<String> tableAfterPutBack = new HashSet<>();

		for (String language : List.of("sr", "en")) {
			theRowStandsInThatOneSectionAndCloudflareIsNamedNowhereElse(language);
			theOldRowIsGoneAndTheRowSitsBetweenItsNeighbours(language);
			theRowOfZohoIsUntouched(language);
			theSentenceUnderTheTableIsTheLastThingTheSectionSaysAndIsUnchanged(language);
			theSignOffOfThePolicyIsMovedAndNoOtherDocumentMovesWithIt(language);
			tableAfterPutBack.add(bodyOf(language, THE_TABLE).replace(rowIn(language), oldRowIn(language)));
		}

		assertThat(tableAfterPutBack)
				.as("with the new words taken out again, section 5 must be the text V70 found in each language")
				.isEqualTo(tableBefore);
	}

	@Test
	void anOldRowThatStandsTwiceStopsV70() {
		putBackTheTextAsItStoodBeforeV70();
		setBody("sr", THE_TABLE, bodyOf("sr", THE_TABLE) + "\n" + SERBIAN_OLD_ROW);

		PSQLException error = v70RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("the old row stands twice and V70 did not say so")
				.contains("Cloudflare @ politika-privatnosti #5 sr: found 2 times");
	}

	@Test
	void anOldRowThatIsNotThereStopsV70() {
		putBackTheTextAsItStoodBeforeV70();
		setBody("en", THE_TABLE, bodyOf("en", THE_TABLE).replace(ENGLISH_OLD_ROW, "gone"));

		PSQLException error = v70RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("the old row is not where V70 looks for it and V70 did not say so")
				.contains("Cloudflare @ politika-privatnosti #5 en: found 0 times");
	}

	@Test
	void aRowThatIsAlreadyThereInOneSectionStopsV70() {
		putBackTheTextAsItStoodBeforeV70();
		setBody("sr", THE_TABLE, bodyOf("sr", THE_TABLE).replace(SERBIAN_OLD_ROW,
				SERBIAN_OLD_ROW + "\n" + SERBIAN_ROW));

		PSQLException error = v70RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("the old row stands once and the new row is already there, and V70 did not say so")
				.contains("Cloudflare @ politika-privatnosti #5 sr: found once, and its new text is already there");
	}

	@Test
	void aSignOffThatIsAlreadyMovedStopsV70() {
		putBackTheTextAsItStoodBeforeV70();
		setBody("sr", THE_POLICY_SIGN_OFF,
				bodyOf("sr", THE_POLICY_SIGN_OFF).replace(SERBIAN_SIGN_OFF_BEFORE, SERBIAN_SIGN_OFF_AFTER));

		PSQLException error = v70RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("the policy is already signed off on 22.10.2026 and V70 did not say so")
				.contains("Cloudflare date @ politika-privatnosti #7 sr: found 0 times,"
						+ " and its new text is already there");
	}

	@Test
	void aSignOffWithoutTheOldDateStopsV70() {
		putBackTheTextAsItStoodBeforeV70();
		setBody("en", THE_POLICY_SIGN_OFF,
				bodyOf("en", THE_POLICY_SIGN_OFF).replace(ENGLISH_SIGN_OFF_BEFORE, "Last amended: 01.01.2026."));

		PSQLException error = v70RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("the policy does not carry the date V70 was written against and V70 did not say so")
				.contains("Cloudflare date @ politika-privatnosti #7 en: found 0 times");
	}

	@Test
	void aSectionThatHasNoSuchTextStopsV70() {
		putBackTheTextAsItStoodBeforeV70();

		assertThat(db.sql("delete from static_page_section_translation t using static_page_section s, static_page p"
						+ " where s.id = t.section_id and p.id = s.page_id and p.slug = 'politika-privatnosti'"
						+ " and s.position = 5 and t.language = 'en'")
				.update())
				.as("there is no English text of section 5 of the policy to take away")
				.isOne();

		PSQLException error = v70RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 4 edits");
		assertThat(reportOf(error))
				.as("an edit was aimed at a text that is not there and V70 did not say so")
				.contains("Cloudflare @ politika-privatnosti #5 en: there is no such text");
	}

	private static final Pattern A_LINE_OF_THE_REPORT = Pattern.compile("^(.+ @ \\S+ #\\d+ \\w+): .+$");

	/**
	 * THE TABLE NAMES EXACTLY THE EDITS V70 MAKES, asked of V70 itself: the four it aims at the places and the
	 * languages above (two for the row, two for the sign-off). An edit added to the file and not here, or one dropped
	 * from it, fails.
	 */
	@Test
	void v70MakesExactlyTheFourEditsTheSweepsHold() {
		Set<String> editedByTheMigration = new HashSet<>();

		for (String line : reportOf(v70RunAgain()).lines().toList()) {
			Matcher named = A_LINE_OF_THE_REPORT.matcher(line);

			assertThat(named.matches()).as("V70 reported a line this case cannot read: %s", line).isTrue();
			editedByTheMigration.add(named.group(1));
		}

		Set<String> heldByTheSweeps = new HashSet<>();

		for (String language : List.of("sr", "en")) {
			heldByTheSweeps.add("Cloudflare @ " + THE_TABLE.slug() + " #" + THE_TABLE.position() + " " + language);
			heldByTheSweeps.add("Cloudflare date @ " + THE_POLICY_SIGN_OFF.slug() + " #" + THE_POLICY_SIGN_OFF.position()
					+ " " + language);
		}

		assertThat(editedByTheMigration).as("V70 names no edit at all, so this case measures nothing").isNotEmpty();
		assertThat(heldByTheSweeps)
				.as("the sweeps and V70 do not hold the same edits, each aimed at the same section in the same language")
				.isEqualTo(editedByTheMigration);
	}
}
