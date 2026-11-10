package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V94 DOES TO THE TEXT OF THE RULEBOOK THAT IS ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists, and it is the shape of {@link TheCycleOf21NovemberCarriedOverTest} for the same reason.</b>
 * V94 adds no column and no constraint, so every other case in this suite starts from a database it has just built.
 * The rows that could break it are rows that stood BEFORE it: the text of Article 56 as V24 and V43 wrote it.
 *
 * <p><b>What the owner decided (PDL, "Flajer A6 (dve strane, i za Facebook)", 10.11.2026):</b> the trophies are handed
 * out at the New Year cocktail session of the Association, and Article 56 changes the same day. So the cases hold the
 * sentence in both languages, that the sentence next to it stays, that the sign-off V93 gave the rulebook is not moved,
 * and that the migration refuses to run over text that is not the text it was written against, and over a section
 * that already holds the new sentence.
 *
 * <p><b>How it is made.</b> The sentence is put back by the reverse of V94's own edit, read out of V94
 * ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each case first asserting that the OLD sentence is what it just
 * wrote. Then THE MIGRATION ITSELF is executed, the file Flyway resolved, inside the test's transaction.
 */
class TheTrophiesAreHandedOutAtTheCocktailSessionCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String OLD_SR = "Pehari se uručuju na ceremoniji spojenoj sa BTL dezorijentiringom.";
	private static final String NEW_SR = "Pehari se uručuju na novogodišnjoj koktel sednici Udruženja.";
	private static final String OLD_EN = "Trophies are presented at a ceremony joined with the BTL dezorijentiring.";
	private static final String NEW_EN = "Trophies are presented at the Association's New Year cocktail session.";
	private static final String NEIGHBOUR_SR = "Digitalne nagrade i diplome dodeljuju se automatski, u trenutku"
			+ " zamrzavanja tabela, svima istovremeno i bez obzira na to gde ko živi.";

	@BeforeEach
	void theSentenceAsV24AndV43LeftIt() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "94");
	}

	private void theMigration() {
		jdbc.execute(migrationSql("94"));
	}

	private int bodiesNaming(String table, String phrase) {
		return db.sql("select count(*) from " + table + " where body like ?")
				.param("%" + phrase + "%")
				.query(Integer.class)
				.single();
	}

	private String everyBody() {
		return db.sql("select (select string_agg(body, '|' order by id) from static_page_section)"
						+ " || (select string_agg(body, '|' order by id) from static_page_section_translation)")
				.query(String.class).single();
	}

	@Test
	void theRulebookSaysTheNewSentenceOverTheTextThatWasAlreadyThere() {
		assertThat(bodiesNaming("static_page_section", OLD_SR))
				.as("the fixture did not put the old Serbian sentence back, so the migration below has nothing to"
						+ " change and this case measures nothing")
				.isEqualTo(1);
		assertThat(bodiesNaming("static_page_section_translation", OLD_EN))
				.as("the fixture did not put the old English sentence back")
				.isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", NEW_SR)).isZero();
		assertThat(bodiesNaming("static_page_section_translation", NEW_EN)).isZero();

		theMigration();

		assertThat(bodiesNaming("static_page_section", OLD_SR)).isZero();
		assertThat(bodiesNaming("static_page_section", "ceremoniji spojenoj")).isZero();
		assertThat(bodiesNaming("static_page_section", NEW_SR))
				.as("the migration emptied the sentence instead of replacing it").isEqualTo(1);
		assertThat(bodiesNaming("static_page_section_translation", OLD_EN)).isZero();
		assertThat(bodiesNaming("static_page_section_translation", NEW_EN)).isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", NEIGHBOUR_SR))
				.as("the sentence before it went with it").isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", "### Član 57. Preuzimanje fizičkih nagrada"))
				.as("the article after it went with it").isEqualTo(1);
	}

	@Test
	void theSentenceStandsInArticle56AndNowhereElse() {
		theMigration();

		assertThat(db.sql("select count(*) from static_page_section s join static_page p on p.id = s.page_id"
						+ " where p.slug = 'pravilnik' and s.position = 14 and s.body like ?")
				.param("%### Član 56. Dodela%" + NEW_SR + "%### Član 57.%")
				.query(Integer.class).single())
				.as("the sentence is not between Article 56's heading and Article 57's")
				.isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", NEW_SR)).isEqualTo(1);
	}

	@Test
	void theSignOffV93GaveTheRulebookIsNotMoved() {
		assertThat(bodiesNaming("static_page_section", "Poslednja izmena: 10.11.2026.")).isEqualTo(1);
		assertThat(bodiesNaming("static_page_section_translation", "Last amended: 10.11.2026.")).isEqualTo(1);

		theMigration();

		assertThat(bodiesNaming("static_page_section", "Poslednja izmena: 10.11.2026."))
				.as("the migration moved the sign-off of the rulebook").isEqualTo(1);
		assertThat(bodiesNaming("static_page_section_translation", "Last amended: 10.11.2026."))
				.isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", "Poslednja izmena: 29.10.2026."))
				.as("the terms of use were moved, and their text did not change").isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", "Poslednja izmena: 08.11.2026."))
				.as("the privacy policy was moved, and its text did not change").isEqualTo(1);
	}

	@Test
	void textThatDoesNotHoldTheOldSentencesStopsTheMigrationAndChangesNothing() {
		String before = everyBody();
		jdbc.execute("update static_page_section s set body = replace(s.body, '" + OLD_SR + "', 'Nesto drugo.')"
				+ " from static_page p where p.id = s.page_id and p.slug = 'pravilnik' and s.position = 14");
		String changed = everyBody();

		assertThat(changed).as("the fixture did not take the old sentence away").isNotEqualTo(before);

		jdbc.execute("savepoint before_the_refusal");
		assertThatThrownBy(this::theMigration)
				.hasMessageContaining("the written pages were not edited")
				.hasMessageContaining("1 of 2 edits");
		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(everyBody()).as("a refused migration changed a page").isEqualTo(changed);
	}

	@Test
	void aSectionThatAlreadyHoldsTheNewSentenceStopsTheMigrationAndChangesNothing() {
		/* The old sentence stands once, as it must, and the new one stands beside it. Each edit is asked about the
		   new text too, so this is refused although the old text was found exactly once. */
		jdbc.execute("update static_page_section s set body = s.body || E'\\n\\n" + NEW_SR + "'"
				+ " from static_page p where p.id = s.page_id and p.slug = 'pravilnik' and s.position = 14");
		assertThat(bodiesNaming("static_page_section", OLD_SR)).isEqualTo(1);
		String before = everyBody();

		jdbc.execute("savepoint before_the_refusal");
		assertThatThrownBy(this::theMigration)
				.hasMessageContaining("the written pages were not edited")
				.hasMessageContaining("found once, and its new text is already there");
		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(everyBody()).as("a refused migration changed a page").isEqualTo(before);
	}
}
