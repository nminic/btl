package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V92 AND V93 DO TO A PRICE LIST, PAYMENTS AND PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists, and it is the shape of {@link TheCycleOf11NovemberCarriedOverTest} for the same reason.</b>
 * Neither migration adds a column or a constraint, so every other case in this suite starts from a database these
 * migrations have just built. The rows that could break them are rows that stood BEFORE them: a price row an
 * administrator has retyped, payments that point at the rows being moved, and the text of the rulebook as V76 to
 * V91 left it (CLAUDE.md, section 11).
 *
 * <p><b>What the owner decided (PDL, „Ciklus od 21. novembra (10.11.2026)"):</b> the cycle opens on 21 November every
 * year, the first period runs to 30 November, the second begins on 1 December, and the prices do not move. So the
 * cases hold the days and the names of three rows, and that the amounts an administrator typed and every payment
 * already booked are left alone.
 *
 * <p><b>How it is made.</b> The price list is put back to what V75 left (its days and labels, read here as V75
 * writes them) with one label and both amounts of another row retyped, and the text of the rulebook is put back by
 * the reverse of V93's own edits, read out of V93 ({@link TheWrittenPagesBeforeV71#undoBodyEdits}). Then THE
 * MIGRATION ITSELF is executed, the file Flyway resolved, inside the test's transaction. The undo is proved by
 * behaviour: every case first asserts that the OLD value is what it just wrote.
 */
class TheCycleOf21NovemberCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private void competitor(String number, String last, String code) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, last, code).update();
	}

	private void payment(String number, String reference, String key, String amount) {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
						+ " fee, method, state, recorded_at, recorded_by, recorded_by_name, received)"
						+ " values ("
						+ " (select id from competitor where member_number = ?), 2027, ?,"
						+ " (select id from price_row where key = ?), " + amount + ", 'RSD', 0, 'ips', 'recorded',"
						+ " timestamptz '2026-11-05 09:00:00+00', " + AN_ACCOUNT + ", 'Blagajnik Probni',"
						+ " " + amount + ")")
				.params(number, reference, key).update();
	}

	@BeforeEach
	void thePriceListAsV75LeftIt() {
		jdbc.execute("update price_row set day_from = '11-11', day_to = '11-20', ranking = true,"
				+ " label = '11. do 20. novembra' where key = 'early'");
		jdbc.execute("update price_row set day_from = '11-21', day_to = '12-31', ranking = true,"
				+ " label = 'Redovna uplata, kako sam je ja nazvao', eur = 41, rsd = 4900 where key = 'regular'");
		jdbc.execute("update price_row set day_from = '01-01', day_to = '03-31', ranking = true,"
				+ " label = '1. januara do 31. marta' where key = 'late'");
		jdbc.execute("update price_row set day_from = '04-01', day_to = '11-10', ranking = false,"
				+ " label = '1. aprila do 10. novembra' where key = 'season'");

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
				+ " 'Probic', 'blagajnik@primer.rs', (select id from role where code = 'moderator'))")
				.update();

		competitor("001101", "Rana", "00112233445577b1");
		competitor("001102", "Redovna", "00112233445577b2");
		competitor("001103", "Kasna", "00112233445577b3");
		competitor("001104", "Tekuca", "00112233445577b4");

		payment("001101", "2027001101", "early", "4200.00");
		payment("001102", "2027001102", "regular", "4900.00");
		payment("001103", "2027001103", "late", "6000.00");
		payment("001104", "2027001104", "season", "4800.00");
	}

	private void theMigration(String version) {
		jdbc.execute(migrationSql(version));
	}

	private List<String> rowOf(String key) {
		return db.sql("select day_from, day_to, label, ranking::text from price_row where key = ?")
				.param(key)
				.query((row, one) -> List.of(row.getString(1), row.getString(2), row.getString(3), row.getString(4)))
				.single();
	}

	@Test
	void theDaysAndTheNamesMoveOverARealPriceList() {
		assertThat(rowOf("early").subList(0, 2))
				.as("the fixture did not put V75's days back, so the migration below is run against rows it has"
						+ " already moved and this case measures nothing")
				.containsExactly("11-11", "11-20");
		assertThat(rowOf("regular").get(2)).isEqualTo("Redovna uplata, kako sam je ja nazvao");

		theMigration("92");

		assertThat(rowOf("early")).containsExactly("11-21", "11-30", "21. do 30. novembra", "true");
		assertThat(rowOf("regular"))
				.as("the name an administrator typed survived, so the row prints its old days")
				.containsExactly("12-01", "12-31", "1. do 31. decembra", "true");
		assertThat(rowOf("late"))
				.as("a row whose days did not move was changed")
				.containsExactly("01-01", "03-31", "1. januara do 31. marta", "true");
		assertThat(rowOf("season")).containsExactly("04-01", "11-20", "1. aprila do 20. novembra", "false");
	}

	@Test
	void theAmountsAnAdministratorTypedAreLeftAlone() {
		theMigration("92");

		assertThat(db.sql("select eur::text || '/' || rsd::text from price_row where key = 'regular'")
				.query(String.class).single())
				.as("the migration wrote an amount, so a price set on the portal was discarded")
				.isEqualTo("41.00/4900.00");
		assertThat(db.sql("select eur::text || '/' || rsd::text from price_row where key = 'early'")
				.query(String.class).single())
				.isEqualTo("35.00/4200.00");
	}

	@Test
	void everyPaymentAlreadyBookedStillPointsAtTheRowItWasBookedOn() {
		List<String> before = payments();

		assertThat(before).as("the fixture booked no payments, so this case measures nothing").hasSize(4);

		theMigration("92");

		assertThat(payments()).containsExactlyInAnyOrderElementsOf(before);
	}

	private List<String> payments() {
		return db.sql("select p.reference || ' ' || r.key || ' ' || p.amount::text from payment p"
						+ " join price_row r on r.id = p.price_row_id")
				.query(String.class)
				.list();
	}

	@Test
	void theRulebookMovesOverTheTextThatWasAlreadyThere() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "96");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "95");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "94");
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "93");

		assertThat(bodiesNaming("static_page_section", "Prelazni rok za timove je od 11. novembra do 31. decembra."))
				.as("the fixture did not put the old Serbian text back, so the migration below has nothing to"
						+ " change and this case measures nothing")
				.isEqualTo(1);
		assertThat(bodiesNaming("static_page_section_translation",
				"The transfer window for teams runs from 11 November to 31 December."))
				.as("the fixture did not put the old English text back")
				.isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", "Poslednja izmena: 30.10.2026.")).isEqualTo(1);

		theMigration("93");

		assertThat(bodiesNaming("static_page_section", "od 11. novembra")).isZero();
		assertThat(bodiesNaming("static_page_section", "Prelazni rok za timove je od 21. novembra do 31. decembra."))
				.as("the migration emptied the sentence instead of replacing it").isEqualTo(1);
		assertThat(bodiesNaming("static_page_section",
				"Ulazak ili izlazak iz tima su dozvoljeni samo tokom prelaznog roka."))
				.as("the sentence after it went with it").isEqualTo(1);
		assertThat(bodiesNaming("static_page_section_translation", "from 11 November")).isZero();
		assertThat(bodiesNaming("static_page_section_translation",
				"The transfer window for teams runs from 21 November to 31 December.")).isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", "Poslednja izmena: 10.11.2026.")).isEqualTo(1);
		assertThat(bodiesNaming("static_page_section_translation", "Last amended: 10.11.2026.")).isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", "Poslednja izmena: 29.10.2026."))
				.as("the terms of use were moved too, and their text did not change").isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", "Poslednja izmena: 08.11.2026."))
				.as("the privacy policy was moved too, and its text did not change").isEqualTo(1);
	}

	@Test
	void textThatDoesNotHoldTheOldSentencesStopsTheMigrationAndChangesNothing() {
		String before = db.sql("select string_agg(body, '|' order by id) from static_page_section")
				.query(String.class).single();

		jdbc.execute("savepoint before_the_refusal");
		assertThatThrownBy(() -> theMigration("93"))
				.hasMessageContaining("the written pages were not edited");
		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(db.sql("select string_agg(body, '|' order by id) from static_page_section")
				.query(String.class).single())
				.as("a refused migration changed a page")
				.isEqualTo(before);
	}

	private int bodiesNaming(String table, String phrase) {
		return db.sql("select count(*) from " + table + " where body like ?")
				.param("%" + phrase + "%")
				.query(Integer.class)
				.single();
	}
}
