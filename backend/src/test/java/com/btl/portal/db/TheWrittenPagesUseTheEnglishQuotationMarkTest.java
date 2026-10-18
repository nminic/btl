package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.postgresql.util.PSQLException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * THE WRITTEN PAGES USE THE ENGLISH QUOTATION MARK, AND V61 CHANGED NOTHING ELSE.
 *
 * <p><b>Why this exists.</b> The owner decided on 18.10.2026 (PDL P18, the section "Navodnici") that the text the portal
 * writes uses the English quotation marks and not the Serbian ones, and, for the written pages, that the change goes to
 * QA without waiting for his review and that the date "Poslednja izmena" is NOT moved because no word changes. V61
 * replaces the low Serbian opening mark {@code U+201E} (and its two high neighbours, which no page carries) with the
 * plain {@code "} in ten places. A legal text is being edited by a migration, so this file holds the two halves of the
 * promise that makes it allowed: the Serbian mark is gone from every text column of every page, and nothing but the mark
 * moved.
 *
 * <p><b>The sweep is over the catalogue, with no list of columns.</b> The columns that can carry prose are asked of
 * {@code information_schema} (every {@code text} column of every table whose name begins with {@code static_page}), so a
 * column added tomorrow is swept the day it arrives; the six that exist today are held as a floor, so a sweep that found
 * nothing cannot pass.
 *
 * <p><b>"Nothing but the mark moved" is measured, not read, and from two sides.</b> The finished text is taken whole,
 * the ten sentences are put back as they stood before V61, V61 is run over them, and the result must be the finished
 * text again, in every column of every row; the rows that differ between the put-back text and the result are counted
 * (ten) and each is asked to differ by the three marks only. That comparison holds the other pages, the other rows, the
 * dates and the order, but its "before" comes out of a database V61 has already edited, so it cannot see a change V61
 * makes to the ten sections themselves. That is held by the second side: the ten bodies are pinned by digest, a baseline
 * that does not come from V61.
 *
 * <p><b>The sentences are written out here, in full enough to be read,</b> once each, with {@code {} standing where the
 * quotation opens. The old text is that with the Serbian mark and the new text is that with the plain one; the closing
 * mark was already the plain one in every place (V61's header has the measurement).
 *
 * <p><b>The floors are asked of the migrations.</b> The old text of each sentence stands in a migration before V61, so
 * "put back as it stood" is the text that really was published; the new text stands in none, so V61 is what wrote it.
 */
class TheWrittenPagesUseTheEnglishQuotationMarkTest extends DatabaseTest {

	/** The migration this file is about. */
	private static final int THE_MIGRATION = 61;

	/** The three marks V61 names: U+201E, the low one, and U+201C and U+201D, the two high ones. */
	private static final String THE_SERBIAN_MARKS = "\u201E\u201C\u201D";

	/** A section by the page it belongs to, its place in it and the language. */
	record Place(String slug, int position, String language) {
	}

	/** The words around one quotation, with {@code {} where it opens. */
	record Sentence(Place place, String written) {

		String now() {
			return written.replace("{", "\"");
		}

		String before() {
			return written.replace("{", "\u201E");
		}
	}

	private static final List<Sentence> THE_TEN = List.of(
			new Sentence(new Place("uslovi-koriscenja", 6, "sr"),
					"na vašoj strani {Moja članarina\", uz sam link."),
			new Sentence(new Place("rec-predsednika", 1, "sr"),
					"Sportsko udruženje {BTL\", pod popularnim imenom Balkanska trkačka liga"),
			new Sentence(new Place("pravilnik", 5, "sr"),
					"na primer {Beogradski maraton, štafeta 1\", sa dužinom, nagibom i vremenom vaše deonice."),
			new Sentence(new Place("pravilnik", 9, "sr"),
					"dugmetom {Unesi rezultat\" u redu te trke."),
			new Sentence(new Place("pravilnik", 12, "sr"),
					"- {Zajednička trka\" znači ista trka, ne samo isti događaj."),
			new Sentence(new Place("pravilnik", 16, "sr"),
					"Oznake {arhiviran takmičar\" nema, jer takvo stanje ne postoji."),
			new Sentence(new Place("pravilnik", 5, "en"),
					"for example {Beogradski maraton, relay leg 1\", with the length, gradient, and time of your own"
							+ " stretch."),
			new Sentence(new Place("pravilnik", 9, "en"),
					"with the {Submit result\" button on that race"),
			new Sentence(new Place("pravilnik", 12, "en"),
					"- A {shared race\" means the same race, not just the same event."),
			new Sentence(new Place("pravilnik", 16, "en"),
					"There is no {archived competitor\" marker, because no such state exists."));

	/** The three sign-offs, which V61 must not move (PDL P18, the section "Navodnici"). */
	private static final Map<String, String> THE_SIGN_OFFS_IN_SERBIAN = Map.of(
			"pravilnik", "Poslednja izmena: 16.10.2026.",
			"uslovi-koriscenja", "Poslednja izmena: 10.10.2026.",
			"politika-privatnosti", "Poslednja izmena: 18.10.2026.");

	private static final Map<String, String> THE_SIGN_OFFS_IN_ENGLISH = Map.of(
			"pravilnik", "Last amended: 16.10.2026.",
			"uslovi-koriscenja", "Last amended: 10.10.2026.",
			"politika-privatnosti", "Last amended: 18.10.2026.");

	@Autowired
	JdbcTemplate jdbc;

	private String bodyOf(Place place) {
		return place.language().equals("sr")
				? db.sql("select s.body from static_page_section s join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position")
						.param("slug", place.slug()).param("position", place.position())
						.query(String.class).single()
				: db.sql("select t.body from static_page_section_translation t"
								+ " join static_page_section s on s.id = t.section_id"
								+ " join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position and t.language = :language")
						.param("slug", place.slug()).param("position", place.position())
						.param("language", place.language()).query(String.class).single();
	}

	private void setBody(Place place, String body) {
		int changed = place.language().equals("sr")
				? db.sql("update static_page_section s set body = :body from static_page p"
								+ " where p.id = s.page_id and p.slug = :slug and s.position = :position")
						.param("body", body).param("slug", place.slug()).param("position", place.position()).update()
				: db.sql("update static_page_section_translation t set body = :body"
								+ " from static_page_section s, static_page p"
								+ " where s.id = t.section_id and p.id = s.page_id and p.slug = :slug"
								+ " and s.position = :position and t.language = :language")
						.param("body", body).param("slug", place.slug()).param("position", place.position())
						.param("language", place.language()).update();

		assertThat(changed).as("there is no %s text of %s #%s to write", place.language(), place.slug(),
				place.position()).isOne();
	}

	/**
	 * Every text column of every page and section, in every language, by where it stands, in a fixed order. Written
	 * out as one query rather than derived from the catalogue because it also has to NAME the row each text belongs
	 * to; the catalogue sweep above is what keeps the six it reads honest.
	 */
	private Map<String, String> everyText() {
		Map<String, String> every = new LinkedHashMap<>();

		db.sql("select kind, slug, place, language, text from ("
						+ " select 'title' as kind, p.slug, 0 as place, 'sr' as language, p.title as text"
						+ "   from static_page p"
						+ " union all select 'title', p.slug, 0, t.language, t.title"
						+ "   from static_page_translation t join static_page p on p.id = t.page_id"
						+ " union all select 'heading', p.slug, s.position, 'sr', s.heading"
						+ "   from static_page_section s join static_page p on p.id = s.page_id"
						+ " union all select 'body', p.slug, s.position, 'sr', s.body"
						+ "   from static_page_section s join static_page p on p.id = s.page_id"
						+ " union all select 'heading', p.slug, s.position, t.language, t.heading"
						+ "   from static_page_section_translation t join static_page_section s on s.id = t.section_id"
						+ "   join static_page p on p.id = s.page_id"
						+ " union all select 'body', p.slug, s.position, t.language, t.body"
						+ "   from static_page_section_translation t join static_page_section s on s.id = t.section_id"
						+ "   join static_page p on p.id = s.page_id"
						+ " ) every_text order by slug, place, language, kind")
				.query((row, number) -> {
					every.put(row.getString("kind") + " @ " + row.getString("slug") + " #" + row.getInt("place") + " "
							+ row.getString("language"), row.getString("text"));
					return number;
				}).list();

		assertThat(every).as("there is no page text at all, so this case measures nothing").isNotEmpty();

		return every;
	}

	private static String withoutTheSerbianMarks(String text) {
		String plain = text;

		for (char mark : THE_SERBIAN_MARKS.toCharArray()) {
			plain = plain.replace(mark, '"');
		}

		return plain;
	}

	private static boolean carriesASerbianMark(String text) {
		return THE_SERBIAN_MARKS.chars().anyMatch(mark -> text.indexOf(mark) >= 0);
	}

	/**
	 * THE SWEEP: no text column of the written pages carries any of the three marks, asked of the catalogue.
	 *
	 * <p>The six columns that exist today are the floor, and each has rows: a column that is empty answers "none" to
	 * everything.
	 */
	@Test
	void noTextColumnOfTheWrittenPagesCarriesASerbianQuotationMark() {
		List<String> columns = db.sql("select table_name || '.' || column_name from information_schema.columns"
						+ " where table_schema = current_schema() and table_name like 'static\\_page%'"
						+ " and data_type = 'text' order by 1")
				.query(String.class).list();

		assertThat(columns).as("the text columns of the written pages, asked of the catalogue")
				.contains("static_page.title", "static_page_translation.title", "static_page_section.heading",
						"static_page_section.body", "static_page_section_translation.heading",
						"static_page_section_translation.body");

		for (String column : columns) {
			String table = column.substring(0, column.indexOf('.'));
			String name = column.substring(column.indexOf('.') + 1);

			assertThat(db.sql("select count(*) from " + table).query(Long.class).single())
					.as("%s has no row at all, so a sweep of it measures nothing", table).isPositive();
			assertThat(db.sql("select count(*) from " + table + " where translate(" + name + ", :marks, '') <> " + name)
					.param("marks", THE_SERBIAN_MARKS).query(Long.class).single())
					.as("%s carries a Serbian quotation mark", column).isZero();
		}
	}

	@Test
	void everyOfTheTenSentencesStandsInItsPlaceOnceWithTheEnglishMarkAndNeverWithTheSerbianOne() {
		for (Sentence sentence : THE_TEN) {
			assertThat(bodyOf(sentence.place()))
					.as("%s", sentence.place())
					.containsOnlyOnce(sentence.now())
					.doesNotContain(sentence.before());
		}
	}

	/** A section and the SHA-256 of its whole body as V61 left it, line breaks normalised to {@code \n}. */
	record Pinned(Place place, String sha256) {
	}

	private static final List<Pinned> THE_TEN_AS_V61_LEFT_THEM = List.of(
			new Pinned(new Place("uslovi-koriscenja", 6, "sr"),
					"67797049a86e1d3d1af2b1475d8c0e4963fa6f4778264c4bea82ef9c57e65c67"),
			new Pinned(new Place("rec-predsednika", 1, "sr"),
					"6b57ee459ba1b90bd88baeab9573daf7e8fe35c9e4a0e83e0fcc59a21dfed896"),
			new Pinned(new Place("pravilnik", 5, "sr"),
					"51b536c83d7e7c860058b059593828f8fb167706182d2ce96b54359582593f8a"),
			new Pinned(new Place("pravilnik", 9, "sr"),
					"99cb3186eefb25ed2ec15fe364c1928ed13418553f538efc848841e4bdeb6bb8"),
			new Pinned(new Place("pravilnik", 12, "sr"),
					"d7dd7bc699ac228079163f204693c2904a469d0f9ff8f5e8101b60ead4ed53f4"),
			new Pinned(new Place("pravilnik", 16, "sr"),
					"e81c83cf7acc1e2715efbb7a4867c0f57c8309eeed41d6b4b225c3674990ca0c"),
			new Pinned(new Place("pravilnik", 5, "en"),
					"74d78287105b630905e9a59d2c10b55e4383d7962e5d85ff8c76c809264b72ac"),
			new Pinned(new Place("pravilnik", 9, "en"),
					"b4025c36fbd000728b35c3a7934fd8eab2ea36f521e6a6f982fa3bfd9a98feaa"),
			new Pinned(new Place("pravilnik", 12, "en"),
					"da3120a9047f8429328bda9d9a366472c0ed7273d2c42bbdbef2f48e8d0b144c"),
			new Pinned(new Place("pravilnik", 16, "en"),
					"547943cce4f156ac0b8c90f8c9e2ec5867b737924fce73b507615252f0f91f01"));

	/**
	 * THE TEN SECTIONS ARE, CHARACTER FOR CHARACTER, THE TEXT V61 WAS MEANT TO LEAVE.
	 *
	 * <p><b>Why a digest.</b> The comparison in {@link #v61ChangesTenSectionsByTheMarkAndNothingElse} takes its "before"
	 * from the database, which V61 has already edited, so a change V61 makes to something else (an apostrophe, a space)
	 * is in the "before" too and cannot be seen. Measured: V61 rewriting every apostrophe of the English bodies in the
	 * same statement passed every other case here. The finished text of the ten sections is the only baseline that does
	 * not come from V61, so it is pinned, as a SHA-256 of the whole body with the line breaks normalised (a checkout may
	 * hold the older migrations with {@code \r\n}, and the database then holds them so).
	 *
	 * <p><b>What it costs, said plainly.</b> A later migration that edits one of these ten sections changes its
	 * digest, and whoever writes it re-pins the section here, which is the same act the whole-record snapshot of the
	 * written pages already asks (writtenVerification.test.ts). The pins were taken from V61 run over the text of V60, and
	 * checked against {@code after - before} on the three marks alone.
	 */
	@Test
	void theTenSectionsAreExactlyTheTextV61WasMeantToLeave() throws Exception {
		for (Pinned pinned : THE_TEN_AS_V61_LEFT_THEM) {
			byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(
					bodyOf(pinned.place()).replace("\r", "").getBytes(java.nio.charset.StandardCharsets.UTF_8));

			assertThat(java.util.HexFormat.of().formatHex(digest))
					.as("%s is not the text V61 was meant to leave, character for character", pinned.place())
					.isEqualTo(pinned.sha256());
		}
	}

	@Test
	void theSignOffsAreWhereV57V58AndV60LeftThem() {
		for (Map.Entry<String, String> signOff : THE_SIGN_OFFS_IN_SERBIAN.entrySet()) {
			int position = signOff.getKey().equals("pravilnik") ? 19 : signOff.getKey().equals("politika-privatnosti") ? 7 : 12;

			assertThat(bodyOf(new Place(signOff.getKey(), position, "sr")))
					.as("%s asked in sr", signOff.getKey()).containsOnlyOnce(signOff.getValue());
			assertThat(bodyOf(new Place(signOff.getKey(), position, "en")))
					.as("%s asked in en", signOff.getKey())
					.containsOnlyOnce(THE_SIGN_OFFS_IN_ENGLISH.get(signOff.getKey()));
		}
	}

	/**
	 * THE FLOORS, asked of the migrations: the old text of every sentence stands in a migration before V61, and its
	 * new text in none.
	 */
	@Test
	void theOldTextOfEverySentenceWasPublishedByAnEarlierMigrationAndTheNewTextByNone() {
		String before = everyMigrationBeforeThisOne();

		assertThat(before).as("no migration before V61 was read, so this case measures nothing").isNotBlank();

		for (Sentence sentence : THE_TEN) {
			assertThat(before)
					.as("no migration before V61 carries the old text of %s, so \"put back as it stood\" is a text that"
							+ " was never published", sentence.place())
					.contains(sentence.before())
					.as("a migration before V61 already carries the new text of %s", sentence.place())
					.doesNotContain(sentence.now());
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

	/** The text as it stood BEFORE V61: the ten sentences put back with the Serbian mark, nothing else touched. */
	private void putBackTheTextAsItStoodBeforeV61() {
		for (Sentence sentence : THE_TEN) {
			setBody(sentence.place(), bodyOf(sentence.place()).replace(sentence.now(), sentence.before()));
		}
	}

	/**
	 * V61 run over the text before it, which is the case in which it succeeds: ten sections change, each by the mark
	 * and by nothing else, and the result is the finished text, character for character, in every column of every row.
	 */
	@Test
	void v61ChangesTenSectionsByTheMarkAndNothingElse() {
		Map<String, String> finished = everyText();

		putBackTheTextAsItStoodBeforeV61();

		Map<String, String> before = everyText();

		assertThat(before.keySet()).as("putting the text back moved a row").isEqualTo(finished.keySet());

		List<String> differing = new ArrayList<>();

		for (String key : finished.keySet()) {
			if (!before.get(key).equals(finished.get(key))) {
				differing.add(key);
			}
		}

		assertThat(differing).as("the text was not put back in ten places").hasSize(10);

		jdbc.execute(migrationSql(String.valueOf(THE_MIGRATION)));

		Map<String, String> after = everyText();

		assertThat(after.keySet()).as("V61 added or took away a row").isEqualTo(finished.keySet());

		List<String> changedByV61 = new ArrayList<>();

		for (String key : after.keySet()) {
			if (!before.get(key).equals(after.get(key))) {
				changedByV61.add(key);
				assertThat(after.get(key))
						.as("%s: V61 changed something besides the quotation marks", key)
						.isEqualTo(withoutTheSerbianMarks(before.get(key)));
			}
		}

		assertThat(changedByV61).as("V61 must change the body of ten sections and no other")
				.containsExactlyInAnyOrderElementsOf(differing).hasSize(10);

		for (String key : after.keySet()) {
			assertThat(after.get(key)).as("%s is not what it was before the text was put back", key)
					.isEqualTo(finished.get(key));
			assertThat(carriesASerbianMark(after.get(key))).as("%s still carries a Serbian mark", key).isFalse();
		}
	}

	/** V61 run once more, over the text it has already edited, and the error PostgreSQL answers with. */
	private PSQLException v61RunAgain() {
		String sql = migrationSql(String.valueOf(THE_MIGRATION));
		Throwable stopped = catchThrowable(() -> jdbc.execute(sql));

		assertThat(stopped)
				.as("V61 ran over text it was not written for and said nothing: a replace() that matches nothing passes"
						+ " silently, and this migration would have been recorded as done")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V61 stopped with something other than an error from PostgreSQL")
				.isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	private static String reportOf(PSQLException error) {
		return error.getServerErrorMessage().getDetail();
	}

	@Test
	void v61RunAgainOverTheFinishedTextStopsAndSaysNoPlaceCarriesTheMark() {
		PSQLException error = v61RunAgain();

		assertThat(error.getServerErrorMessage().getMessage())
				.contains("the quotation marks of the written pages were not changed")
				.contains("10 of 10 places");
		assertThat(reportOf(error).lines().toList())
				.as("every place V61 was written for is quiet now and V61 did not say so")
				.contains("body @ pravilnik #5 sr: measured 1, found 0", "body @ pravilnik #5 en: measured 1, found 0",
						"body @ rec-predsednika #1 sr: measured 1, found 0",
						"body @ uslovi-koriscenja #6 sr: measured 1, found 0")
				.hasSize(10);
	}

	@Test
	void aMarkInATitleStopsV61() {
		putBackTheTextAsItStoodBeforeV61();
		assertThat(db.sql("update static_page set title = title || ' \u201Ex\"' where slug = 'pravilnik'").update())
				.isOne();

		PSQLException error = v61RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 11 places");
		assertThat(reportOf(error)).contains("title @ pravilnik #0 sr: measured 0, found 1");
	}

	@Test
	void aMarkInATranslatedTitleStopsV61() {
		putBackTheTextAsItStoodBeforeV61();
		assertThat(db.sql("update static_page_translation t set title = t.title || ' \u201Ex\"' from static_page p"
				+ " where p.id = t.page_id and p.slug = 'pravilnik' and t.language = 'en'").update()).isOne();

		PSQLException error = v61RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 11 places");
		assertThat(reportOf(error)).contains("title @ pravilnik #0 en: measured 0, found 1");
	}

	@Test
	void aMarkInAHeadingStopsV61() {
		putBackTheTextAsItStoodBeforeV61();
		assertThat(db.sql("update static_page_section s set heading = s.heading || ' \u201Cx\u201D' from static_page p"
				+ " where p.id = s.page_id and p.slug = 'pravilnik' and s.position = 3").update()).isOne();

		PSQLException error = v61RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 11 places");
		assertThat(reportOf(error)).contains("heading @ pravilnik #3 sr: measured 0, found 2");
	}

	@Test
	void aMarkInATranslatedHeadingStopsV61() {
		putBackTheTextAsItStoodBeforeV61();
		assertThat(db.sql("update static_page_section_translation t set heading = t.heading || ' \u201Ex\"'"
				+ " from static_page_section s, static_page p where s.id = t.section_id and p.id = s.page_id"
				+ " and p.slug = 'pravilnik' and s.position = 3 and t.language = 'en'").update()).isOne();

		PSQLException error = v61RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 11 places");
		assertThat(reportOf(error)).contains("heading @ pravilnik #3 en: measured 0, found 1");
	}

	@Test
	void aHighMarkInABodyThatWasNotMeasuredStopsV61() {
		Place elsewhere = new Place("politika-privatnosti", 2, "sr");

		putBackTheTextAsItStoodBeforeV61();
		setBody(elsewhere, bodyOf(elsewhere) + " \u201Cx\u201D");

		PSQLException error = v61RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 11 places");
		assertThat(reportOf(error)).contains("body @ politika-privatnosti #2 sr: measured 0, found 2");
	}

	@Test
	void aMeasuredPlaceThatCarriesMoreMarksThanMeasuredStopsV61() {
		Place measured = new Place("pravilnik", 5, "en");

		putBackTheTextAsItStoodBeforeV61();
		setBody(measured, bodyOf(measured) + " \u201Ex\"");

		PSQLException error = v61RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 10 places");
		assertThat(reportOf(error)).contains("body @ pravilnik #5 en: measured 1, found 2");
	}

	@Test
	void aMeasuredPlaceThatCarriesNoMarkStopsV61() {
		Place quiet = new Place("pravilnik", 12, "sr");

		putBackTheTextAsItStoodBeforeV61();
		setBody(quiet, bodyOf(quiet).replace("\u201E", "\""));

		PSQLException error = v61RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 10 places");
		assertThat(reportOf(error)).contains("body @ pravilnik #12 sr: measured 1, found 0");
	}

	@Test
	void aMeasuredPlaceWhoseTextIsGoneStopsV61() {
		putBackTheTextAsItStoodBeforeV61();

		assertThat(db.sql("delete from static_page_section_translation t using static_page_section s, static_page p"
						+ " where s.id = t.section_id and p.id = s.page_id and p.slug = 'pravilnik'"
						+ " and s.position = 16 and t.language = 'en'")
				.update())
				.as("there is no English text of Article 70 of the rulebook to take away")
				.isOne();

		PSQLException error = v61RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("1 of 10 places");
		assertThat(reportOf(error)).contains("body @ pravilnik #16 en: measured 1, found 0");
	}

	private static final Pattern A_LINE_OF_THE_REPORT = Pattern.compile("^(\\w+ @ \\S+ #\\d+ \\w+): .+$");

	/**
	 * THE MIGRATION NAMES EXACTLY THE TEN PLACES THE SWEEPS HOLD, asked of V61 itself: a place added to its list and not
	 * here, or dropped from it, fails.
	 */
	@Test
	void v61NamesExactlyTheTenPlacesTheSentencesHold() {
		Set<String> namedByTheMigration = new HashSet<>();

		for (String line : reportOf(v61RunAgain()).lines().toList()) {
			Matcher named = A_LINE_OF_THE_REPORT.matcher(line);

			assertThat(named.matches()).as("V61 reported a line this case cannot read: %s", line).isTrue();
			namedByTheMigration.add(named.group(1));
		}

		Set<String> heldBySentences = new HashSet<>();

		for (Sentence sentence : THE_TEN) {
			heldBySentences.add("body @ " + sentence.place().slug() + " #" + sentence.place().position() + " "
					+ sentence.place().language());
		}

		assertThat(namedByTheMigration).as("V61 names no place at all, so this case measures nothing").isNotEmpty();
		assertThat(heldBySentences)
				.as("the sentences and V61 do not hold the same places, each in the same language")
				.isEqualTo(namedByTheMigration);
	}
}
