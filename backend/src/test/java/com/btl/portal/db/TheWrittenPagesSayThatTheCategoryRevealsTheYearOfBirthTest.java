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

	/** A section by the page it belongs to and its place in it; the order is the one they are sorted into. */
	record Place(String slug, int position) {
	}

	/** Where the sentence belongs, in either language. */
	private static final List<Place> WHERE_IT_STANDS = List.of(new Place(POLICY, 3), new Place(RULEBOOK, 17));

	@Autowired
	JdbcTemplate jdbc;

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
		assertThat(error.getServerErrorMessage().getMessage()).contains("4 of 4 edits");
		assertThat(reportOf(error))
				.as("the anchor stands once and the sentence is already there, and V58 did not say so")
				.contains("BR @ politika-privatnosti #3 sr: found once, and its new text is already there")
				.contains("BR @ politika-privatnosti #3 en: found once, and its new text is already there")
				.contains("BR @ pravilnik #17 sr: found once, and its new text is already there")
				.contains("BR @ pravilnik #17 en: found once, and its new text is already there");
	}

	@Test
	void anAnchorThatStandsTwiceStopsV58() {
		assertThat(db.sql("update static_page_section s set body = :body || ' ' || :anchor from static_page p"
						+ " where p.id = s.page_id and p.slug = 'pravilnik' and s.position = 17")
				.param("body", bodyOf("sr", new Place(RULEBOOK, 17)).replace(" " + SERBIAN_SENTENCE, ""))
				.param("anchor", SERBIAN_ANCHOR)
				.update())
				.as("there is no seventeenth section of the rulebook to write the anchor into twice")
				.isOne();

		assertThat(reportOf(v58RunAgain()))
				.as("the anchor stands twice and V58 did not say so")
				.contains("BR @ pravilnik #17 sr: found 2 times");
	}

	@Test
	void anAnchorThatIsNotThereStopsV58() {
		assertThat(db.sql("update static_page_section_translation t set body = replace(t.body, :anchor, 'gone')"
						+ " from static_page_section s, static_page p"
						+ " where s.id = t.section_id and p.id = s.page_id and p.slug = 'politika-privatnosti'"
						+ " and s.position = 3 and t.language = 'en'")
				.param("anchor", ENGLISH_ANCHOR)
				.update())
				.as("there is no English text of the policy's third section to take the anchor out of")
				.isOne();

		assertThat(reportOf(v58RunAgain()))
				.as("the anchor is not where V58 looks for it and V58 did not say so")
				.contains("BR @ politika-privatnosti #3 en: found 0 times");
	}

	@Test
	void aSectionThatHasNoSuchTextStopsV58() {
		assertThat(db.sql("delete from static_page_section_translation t using static_page_section s, static_page p"
						+ " where s.id = t.section_id and p.id = s.page_id and p.slug = 'pravilnik'"
						+ " and s.position = 17 and t.language = 'en'")
				.update())
				.as("there is no English text of Article 74 to take away")
				.isOne();

		assertThat(reportOf(v58RunAgain()))
				.as("an edit was aimed at a text that is not there and V58 did not say so")
				.contains("BR @ pravilnik #17 en: there is no such text");
	}

	private static final Pattern A_LINE_OF_THE_REPORT = Pattern.compile("^(.+ @ \\S+ #\\d+ \\w+): .+$");

	/**
	 * THE TABLE NAMES EXACTLY THE EDITS V58 MAKES, asked of V58 itself: the four it aims at the places and the
	 * languages above. An edit added to the file and not here, or one dropped from it, fails.
	 */
	@Test
	void v58MakesExactlyTheFourEditsTheSweepsHold() {
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

		assertThat(editedByTheMigration).as("V58 names no edit at all, so this case measures nothing").isNotEmpty();
		assertThat(heldByTheSweeps)
				.as("the sweeps and V58 do not hold the same edits, each aimed at the same section in the same language")
				.isEqualTo(editedByTheMigration);
	}
}
