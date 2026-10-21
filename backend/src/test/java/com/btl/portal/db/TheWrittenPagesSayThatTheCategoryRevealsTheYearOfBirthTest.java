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
 * THE ONE SENTENCE V58 ADDS TO THE WRITTEN PAGES (item BR), HELD ON THE TEXT THE PORTAL SERVES, IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists.</b> The owner chose, on 16.10.2026, the words that say a member who moves to an older age
 * category between two seasons gives away his exact year of birth (PDL, the entry "Reči za BR"). They go into
 * Article 74 of the rulebook and into section 3 of the privacy policy, in Serbian and in English, directly after
 * the sentence that says the category is always public. {@code PageApiTest} holds the Serbian half against
 * {@code pages.json}; nothing else holds the English half, and nothing holds PLACE, which is the half of this edit
 * that is easiest to get wrong: the same words in front of the anchor, or in a neighbouring section, read as a
 * different sentence.
 *
 * <p><b>The sweep is over every row, with no {@code where} clause</b>, the shape of
 * {@link TheWrittenPagesCarryTheEditsOfTheTenthOfOctoberTest}: not that the two articles are right but that the
 * sentence stands in exactly those two sections of each language and in no third one.
 *
 * <p><b>And the sign-off date of the two documents that carry it.</b> The same edit moves "Poslednja izmena" of
 * the privacy policy (section 7) and of the rulebook (section 19) from 10.10.2026 to 16.10.2026, in both languages
 * (PDL, the entry "Datum Poslednja izmena se pomera", owner, 16.10.2026). The terms of use are NOT edited and keep
 * 10.10.2026. Three things are held, each in its own case, because each is a different way to be wrong: the date
 * left old on one of the two documents, the date moved on the terms too, and the date moved in one language only.
 * Since V60 and V70 the privacy policy's sign-off has moved on, to 18.10.2026 (owner, 17.10.2026) and then to
 * 21.10.2026 (owner, 20.10.2026), so the cases that read the finished text hold the policy at V70's day and the
 * rulebook at V58's; what V58 itself does to the dates is held by
 * the case that puts the text back to before V58 and runs it.
 *
 * <p><b>The words are the owner's and are written out here in full, not as phrases.</b> The usual rule against a
 * second copy of a legal text does not hold for one sentence of one line, and a phrase would let a changed word
 * through: "tačna" for "približna" is a different decision (PDL, "Odaje se TAČNA, ne približna godina rođenja").
 *
 * <p><b>Both floors are asked of the migrations, not of this file.</b> The anchor is looked for in V57's text (it
 * is the sentence V57 wrote), and the sentence is looked for in no migration before V58.
 */
class TheWrittenPagesSayThatTheCategoryRevealsTheYearOfBirthTest extends DatabaseTest {

	/** The migration this file is about. */
	private static final int THE_MIGRATION = 58;

	private static final String POLICY = "politika-privatnosti";
	private static final String RULEBOOK = "pravilnik";

	private static final String SERBIAN_ANCHOR = "Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor.";
	private static final String ENGLISH_ANCHOR = "The category that follows from it is always public, whatever you choose.";

	private static final String SERBIAN_SENTENCE = "Iz prelaska u stariju uzrasnu kategoriju između dve sezone vidi se "
			+ "tačna godina rođenja, i kad datum rođenja nije prikazan.";
	private static final String ENGLISH_SENTENCE = "Moving to an older age category between two seasons reveals the "
			+ "exact year of birth, even when the date of birth is not displayed.";

	private static final String TERMS = "uslovi-koriscenja";

	private static final String SERBIAN_SIGN_OFF_BEFORE = "Poslednja izmena: 10.10.2026.";
	private static final String SERBIAN_SIGN_OFF_AFTER = "Poslednja izmena: 16.10.2026.";
	private static final String ENGLISH_SIGN_OFF_BEFORE = "Last amended: 10.10.2026.";
	private static final String ENGLISH_SIGN_OFF_AFTER = "Last amended: 16.10.2026.";

	/* The day the privacy policy stands signed off on NOW: V60 moved it from V58's day to 18.10.2026 with the row that
	   names Zoho (owner, 17.10.2026) and V70 moved it on to 21.10.2026 with the words about the backups in the row for
	   Cloudflare (owner, 20.10.2026). The rulebook did not move and keeps V58's. What V70 holds of that day is its own
	   guard, TheWrittenPagesTheCloudflareRowNamesTheBackupsTest. */
	private static final String SERBIAN_POLICY_SIGN_OFF_NOW = "Poslednja izmena: 21.10.2026.";
	private static final String ENGLISH_POLICY_SIGN_OFF_NOW = "Last amended: 21.10.2026.";

	/** A section by the page it belongs to and its place in it; the order is the one they are sorted into. */
	record Place(String slug, int position) {
	}

	/** Where the sentence belongs, in either language. */
	private static final List<Place> WHERE_IT_STANDS = List.of(new Place(POLICY, 3), new Place(RULEBOOK, 17));

	/** The sign-offs this migration moves: the privacy policy's and the rulebook's. */
	private static final List<Place> SIGNED_OFF_ON_THE_SIXTEENTH = List.of(new Place(POLICY, 7), new Place(RULEBOOK, 19));

	/** The sign-off it does not move. */
	private static final Place THE_TERMS_SIGN_OFF = new Place(TERMS, 12);

	@Autowired
	JdbcTemplate jdbc;

	private static String signOffBefore(String language) {
		return language.equals("sr") ? SERBIAN_SIGN_OFF_BEFORE : ENGLISH_SIGN_OFF_BEFORE;
	}

	private static String signOffAfter(String language) {
		return language.equals("sr") ? SERBIAN_SIGN_OFF_AFTER : ENGLISH_SIGN_OFF_AFTER;
	}

	private static String policySignOffNow(String language) {
		return language.equals("sr") ? SERBIAN_POLICY_SIGN_OFF_NOW : ENGLISH_POLICY_SIGN_OFF_NOW;
	}

	private static String anchorIn(String language) {
		return language.equals("sr") ? SERBIAN_ANCHOR : ENGLISH_ANCHOR;
	}

	private static String sentenceIn(String language) {
		return language.equals("sr") ? SERBIAN_SENTENCE : ENGLISH_SENTENCE;
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

	private void theSentenceStandsInThoseTwoSectionsAndNowhereElse(String language) {
		List<Place> carrying = placesWhichCarry(language, sentenceIn(language));

		assertThat(carrying)
				.as("the %s sentence must stand in Article 74 and in section 3 of the policy, and in no other section",
						language)
				.containsExactlyInAnyOrderElementsOf(WHERE_IT_STANDS);
	}

	private void theSentenceFollowsItsAnchorDirectlyAndStandsOnceThere(String language) {
		for (Place place : WHERE_IT_STANDS) {
			assertThat(bodyOf(language, place))
					.as("%s #%s %s: the sentence must come directly after the sentence that says the category is public,"
							+ " and once", place.slug(), place.position(), language)
					.containsOnlyOnce(anchorIn(language) + " " + sentenceIn(language));
		}
	}

	@Test
	void theSerbianSentenceStandsInThoseTwoSectionsAndNowhereElse() {
		theSentenceStandsInThoseTwoSectionsAndNowhereElse("sr");
	}

	@Test
	void theEnglishSentenceStandsInThoseTwoSectionsAndNowhereElse() {
		theSentenceStandsInThoseTwoSectionsAndNowhereElse("en");
	}

	@Test
	void theSerbianSentenceFollowsItsAnchorDirectlyAndStandsOnceThere() {
		theSentenceFollowsItsAnchorDirectlyAndStandsOnceThere("sr");
	}

	@Test
	void theEnglishSentenceFollowsItsAnchorDirectlyAndStandsOnceThere() {
		theSentenceFollowsItsAnchorDirectlyAndStandsOnceThere("en");
	}

	private void theSignOffIsMovedOnTheTwoDocumentsAndOnlyOnThem(String language) {
		assertThat(placesWhichCarry(language, signOffAfter(language)))
				.as("the %s sign-off of 16.10.2026 must stand on the privacy policy and on the rulebook, and nowhere"
						+ " else", language)
				.containsExactlyInAnyOrderElementsOf(SIGNED_OFF_ON_THE_SIXTEENTH);
		assertThat(placesWhichCarry(language, signOffBefore(language)))
				.as("the %s sign-off of 10.10.2026 must stand on the terms of use alone", language)
				.containsExactly(THE_TERMS_SIGN_OFF);

		for (Place place : SIGNED_OFF_ON_THE_SIXTEENTH) {
			assertThat(bodyOf(language, place))
					.as("%s #%s %s: the sign-off must stand once", place.slug(), place.position(), language)
					.containsOnlyOnce(signOffAfter(language))
					.doesNotContain(signOffBefore(language));
		}

		assertThat(bodyOf(language, THE_TERMS_SIGN_OFF))
				.as("the terms of use must keep the day they were signed off on")
				.containsOnlyOnce(signOffBefore(language))
				.doesNotContain(signOffAfter(language));
	}

	/**
	 * THE SIGN-OFFS AS THEY STAND NOW, which is not how V58 left them: V60 and then V70 moved the privacy policy's on to
	 * 21.10.2026. The rulebook's is still V58's day and the terms' is still V57's, and those two are held here exactly
	 * as before. What V58 itself does to the dates is held by
	 * {@link #v58AddsTheSentenceAndMovesTheSignOffInEightSectionsAndChangesNothingElse}, which puts the text back to
	 * before V58 and runs it.
	 */
	private void theSignOffsStandAsTheyDoNow(String language) {
		Place rulebookSignOff = new Place(RULEBOOK, 19);
		Place policySignOff = new Place(POLICY, 7);

		assertThat(placesWhichCarry(language, signOffAfter(language)))
				.as("the %s sign-off of 16.10.2026 must stand on the rulebook alone, the policy having moved on",
						language)
				.containsExactly(rulebookSignOff);
		assertThat(placesWhichCarry(language, policySignOffNow(language)))
				.as("the %s sign-off of 21.10.2026 must stand on the privacy policy alone", language)
				.containsExactly(policySignOff);
		assertThat(placesWhichCarry(language, signOffBefore(language)))
				.as("the %s sign-off of 10.10.2026 must stand on the terms of use alone", language)
				.containsExactly(THE_TERMS_SIGN_OFF);

		assertThat(bodyOf(language, policySignOff))
				.as("the privacy policy must be signed off once, on the day of V70, the last migration that edited it")
				.containsOnlyOnce(policySignOffNow(language))
				.doesNotContain(signOffAfter(language))
				.doesNotContain(signOffBefore(language));
		assertThat(bodyOf(language, rulebookSignOff))
				.as("the rulebook must keep the day V58 signed it off on")
				.containsOnlyOnce(signOffAfter(language))
				.doesNotContain(signOffBefore(language))
				.doesNotContain(policySignOffNow(language));
		assertThat(bodyOf(language, THE_TERMS_SIGN_OFF))
				.as("the terms of use must keep the day they were signed off on")
				.containsOnlyOnce(signOffBefore(language))
				.doesNotContain(signOffAfter(language))
				.doesNotContain(policySignOffNow(language));
	}

	@Test
	void theSerbianSignOffsStandOnTheirDaysAndThePolicyHasMovedOn() {
		theSignOffsStandAsTheyDoNow("sr");
	}

	@Test
	void theEnglishSignOffsStandOnTheirDaysAndThePolicyHasMovedOn() {
		theSignOffsStandAsTheyDoNow("en");
	}

	/**
	 * THE FLOORS, asked of the migrations.
	 *
	 * <p>The anchor is the sentence V57 wrote (its edits C and D), so "directly after the anchor" means something
	 * only if V57 really has it; and a sentence that an earlier migration already wrote would make the sweeps above
	 * pass without V58 doing anything. Both are read out of the files Flyway resolved.
	 */
	@Test
	void theAnchorsAreV57sAndNoMigrationBeforeV58WroteTheSentence() {
		String v57 = migrationSql("57");
		String before = everyMigrationBeforeThisOne();

		assertThat(before).as("no migration before V58 was read, so this case measures nothing").isNotBlank();

		for (String anchor : List.of(SERBIAN_ANCHOR, ENGLISH_ANCHOR)) {
			assertThat(v57).as("V57 does not carry the anchor \"%s\", so \"directly after it\" measures nothing", anchor)
					.contains(anchor);
		}

		for (String sentence : List.of(SERBIAN_SENTENCE, ENGLISH_SENTENCE)) {
			assertThat(before).as("a migration before V58 already writes \"%s\"", sentence).doesNotContain(sentence);
		}

		for (String signOff : List.of(SERBIAN_SIGN_OFF_BEFORE, ENGLISH_SIGN_OFF_BEFORE)) {
			assertThat(v57).as("V57 does not write the sign-off \"%s\", so moving it measures nothing", signOff)
					.contains(signOff);
		}

		for (String signOff : List.of(SERBIAN_SIGN_OFF_AFTER, ENGLISH_SIGN_OFF_AFTER)) {
			assertThat(before).as("a migration before V58 already writes \"%s\"", signOff).doesNotContain(signOff);
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
	 * V58 run once more, over the text it has already edited, and the error PostgreSQL answers with.
	 *
	 * <p>The last thing a case may ask of the database: the error leaves the transaction aborted.
	 */
	private PSQLException v58RunAgain() {
		String sql = migrationSql(String.valueOf(THE_MIGRATION));
		Throwable stopped = catchThrowable(() -> jdbc.execute(sql));

		assertThat(stopped)
				.as("V58 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently, and a second run that adds the sentence again is worse")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V58 stopped with something other than an error from PostgreSQL").isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	private static String reportOf(PSQLException error) {
		return error.getServerErrorMessage().getDetail();
	}

	@Test
	void v58RunAgainOverTheFinishedTextStopsAndSaysTheSentenceIsAlreadyThere() {
		PSQLException error = v58RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("the written pages were not edited");
		assertThat(error.getServerErrorMessage().getMessage()).contains("8 of 8 edits");
		assertThat(reportOf(error))
				.as("the rulebook's sign-off is already moved and V58 did not say so")
				.contains("BR date @ pravilnik #19 sr: found 0 times, and its new text is already there")
				.contains("BR date @ pravilnik #19 en: found 0 times, and its new text is already there");
		assertThat(reportOf(error).lines().toList())
				.as("the policy's sign-off has moved on to V70's day, so V58's day is not there and V58 must say"
						+ " only that its old text is missing")
				.contains("BR date @ politika-privatnosti #7 sr: found 0 times",
						"BR date @ politika-privatnosti #7 en: found 0 times");
		assertThat(reportOf(error))
				.as("the anchor stands once and the sentence is already there, and V58 did not say so")
				.contains("BR @ politika-privatnosti #3 sr: found once, and its new text is already there")
				.contains("BR @ politika-privatnosti #3 en: found once, and its new text is already there")
				.contains("BR @ pravilnik #17 sr: found once, and its new text is already there")
				.contains("BR @ pravilnik #17 en: found once, and its new text is already there");
	}

	/**
	 * The text as it stood BEFORE V58: the sentence taken out of the four sections it was put into and the sign-off
	 * of the policy and of the rulebook put back to 10.10.2026, by hand and with nothing else touched. The refusals below are asked of this text, because it is the one V58 is written
	 * for; asked of the finished text every edit would refuse for the same reason (the sentence is already there)
	 * and one edit's own check could be taken away without any case noticing.
	 */
	private void putBackTheTextAsItStoodBeforeV58() {
		for (Place place : WHERE_IT_STANDS) {
			for (String language : List.of("sr", "en")) {
				setBody(language, place, bodyOf(language, place).replace(" " + sentenceIn(language), ""));
			}
		}

		for (Place place : SIGNED_OFF_ON_THE_SIXTEENTH) {
			for (String language : List.of("sr", "en")) {
				/* The policy's sign-off stands at V70's day now, the rulebook's at V58's: both go back to V57's. */
				setBody(language, place, bodyOf(language, place)
						.replace(policySignOffNow(language), signOffBefore(language))
						.replace(signOffAfter(language), signOffBefore(language)));
			}
		}
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

	/**
	 * V58 run over the text before it, which is the one case in which it succeeds: four sections gain the sentence
	 * directly after the anchor, the sign-off of two documents moves in both languages, and no other section of
	 * either table changes by a character.
	 */
	@Test
	void v58AddsTheSentenceAndMovesTheSignOffInEightSectionsAndChangesNothingElse() {
		putBackTheTextAsItStoodBeforeV58();

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

		assertThat(changed).as("V58 must change the body of eight sections (four for the sentence, four for the date)"
				+ " and no other").isEqualTo(8);

		for (Place place : WHERE_IT_STANDS) {
			for (String language : List.of("sr", "en")) {
				assertThat(bodyOf(language, place))
						.as("%s #%s %s after V58", place.slug(), place.position(), language)
						.containsOnlyOnce(anchorIn(language) + " " + sentenceIn(language));
			}
		}

		for (String language : List.of("sr", "en")) {
			theSignOffIsMovedOnTheTwoDocumentsAndOnlyOnThem(language);
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

	@Test
	void anAnchorThatStandsTwiceStopsV58() {
		putBackTheTextAsItStoodBeforeV58();
		setBody("sr", new Place(RULEBOOK, 17), bodyOf("sr", new Place(RULEBOOK, 17)) + " " + SERBIAN_ANCHOR);

		PSQLException error = v58RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error))
				.as("the anchor stands twice and V58 did not say so")
				.contains("BR @ pravilnik #17 sr: found 2 times");
	}

	@Test
	void anAnchorThatIsNotThereStopsV58() {
		putBackTheTextAsItStoodBeforeV58();
		setBody("en", new Place(POLICY, 3), bodyOf("en", new Place(POLICY, 3)).replace(ENGLISH_ANCHOR, "gone"));

		PSQLException error = v58RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error))
				.as("the anchor is not where V58 looks for it and V58 did not say so")
				.contains("BR @ politika-privatnosti #3 en: found 0 times");
	}

	@Test
	void aSentenceThatIsAlreadyThereInOneSectionStopsV58() {
		putBackTheTextAsItStoodBeforeV58();
		setBody("sr", new Place(POLICY, 3),
				bodyOf("sr", new Place(POLICY, 3)).replace(SERBIAN_ANCHOR, SERBIAN_ANCHOR + " " + SERBIAN_SENTENCE));

		PSQLException error = v58RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error))
				.as("the anchor stands once and the sentence is already there, and V58 did not say so")
				.contains("BR @ politika-privatnosti #3 sr: found once, and its new text is already there");
	}

	@Test
	void aSignOffThatIsAlreadyMovedInOneDocumentStopsV58() {
		putBackTheTextAsItStoodBeforeV58();
		setBody("sr", new Place(RULEBOOK, 19),
				bodyOf("sr", new Place(RULEBOOK, 19)).replace(SERBIAN_SIGN_OFF_BEFORE, SERBIAN_SIGN_OFF_AFTER));

		PSQLException error = v58RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error))
				.as("the rulebook is already signed off on 16.10.2026 and V58 did not say so")
				.contains("BR date @ pravilnik #19 sr: found 0 times, and its new text is already there");
	}

	@Test
	void aSignOffWithoutTheOldDateStopsV58() {
		putBackTheTextAsItStoodBeforeV58();
		setBody("en", new Place(POLICY, 7),
				bodyOf("en", new Place(POLICY, 7)).replace(ENGLISH_SIGN_OFF_BEFORE, "Last amended: 01.01.2026."));

		PSQLException error = v58RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error))
				.as("the policy does not carry the date V58 was written against and V58 did not say so")
				.contains("BR date @ politika-privatnosti #7 en: found 0 times");
	}

	@Test
	void aSectionThatHasNoSuchTextStopsV58() {
		putBackTheTextAsItStoodBeforeV58();

		assertThat(db.sql("delete from static_page_section_translation t using static_page_section s, static_page p"
						+ " where s.id = t.section_id and p.id = s.page_id and p.slug = 'pravilnik'"
						+ " and s.position = 17 and t.language = 'en'")
				.update())
				.as("there is no English text of Article 74 to take away")
				.isOne();

		PSQLException error = v58RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 8 edits");
		assertThat(reportOf(error))
				.as("an edit was aimed at a text that is not there and V58 did not say so")
				.contains("BR @ pravilnik #17 en: there is no such text");
	}

	private static final Pattern A_LINE_OF_THE_REPORT = Pattern.compile("^(.+ @ \\S+ #\\d+ \\w+): .+$");

	/**
	 * THE TABLE NAMES EXACTLY THE EDITS V58 MAKES, asked of V58 itself: the eight it aims at the places and the
	 * languages above (four for the sentence, four for the sign-off). An edit added to the file and not here, or one dropped from it, fails.
	 */
	@Test
	void v58MakesExactlyTheEightEditsTheSweepsHold() {
		Set<String> editedByTheMigration = new HashSet<>();

		for (String line : reportOf(v58RunAgain()).lines().toList()) {
			Matcher named = A_LINE_OF_THE_REPORT.matcher(line);

			assertThat(named.matches()).as("V58 reported a line this case cannot read: %s", line).isTrue();
			editedByTheMigration.add(named.group(1));
		}

		Set<String> heldByTheSweeps = new HashSet<>();

		for (Place place : WHERE_IT_STANDS) {
			for (String language : List.of("sr", "en")) {
				heldByTheSweeps.add("BR @ " + place.slug() + " #" + place.position() + " " + language);
			}
		}

		for (Place place : SIGNED_OFF_ON_THE_SIXTEENTH) {
			for (String language : List.of("sr", "en")) {
				heldByTheSweeps.add("BR date @ " + place.slug() + " #" + place.position() + " " + language);
			}
		}

		assertThat(editedByTheMigration).as("V58 names no edit at all, so this case measures nothing").isNotEmpty();
		assertThat(heldByTheSweeps)
				.as("the sweeps and V58 do not hold the same edits, each aimed at the same section in the same language")
				.isEqualTo(editedByTheMigration);
	}
}
