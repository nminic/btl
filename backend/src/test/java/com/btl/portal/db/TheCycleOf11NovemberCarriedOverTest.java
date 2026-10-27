package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V75 AND V76 DO TO A PRICE LIST, PAYMENTS AND PAGES THAT ARE ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists.</b> Neither migration adds a column or a constraint, so the schema afterwards is the
 * whole of what an ordinary case can see, and every other case in this suite starts from a database these
 * migrations have just built. The rows that could break them are rows that stood BEFORE them: a price row an
 * administrator has retyped, and payments that point at the rows being moved. That is the class that took QA down
 * on 27.09.2026 (CLAUDE.md, section 11), and it is invisible to every other tool we have.
 *
 * <p><b>What can really have moved, and it is the NAME and the AMOUNTS.</b> {@code PUT /api/pricing/{key}} writes
 * {@code label}, {@code eur} and {@code rsd} and never the days. So the fixture retypes the label of one row and
 * both amounts of another, and the cases hold that the label is overwritten (V49's decision, unchanged) and the
 * amounts are NOT: a migration that wrote the owner's prices again would discard an edit made on the portal.
 *
 * <p><b>The payments are the other half.</b> {@code payment.price_row_id} points at a row by its id and every
 * payment already booked must still point at the same row, with the same amount, after the days move.
 *
 * <p><b>How it is made.</b> What the two migrations wrote is put back to what stood before them (V49's days and
 * labels; the sentences V76 replaces, by the reverse of each replacement) and then THE MIGRATION ITSELF is
 * executed, the file Flyway resolved ({@link DatabaseTest#migrationSql}), inside the test's transaction. The undo
 * is proved by behaviour: every case first asserts that the OLD value is what it just wrote.
 */
class TheCycleOf11NovemberCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private void competitor(String number, String last, String code) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, last, code).update();
	}

	/** One recognised payment against the row NAMED BY KEY, so each of the four rows has one standing on it. */
	private void payment(String number, String reference, String key, String amount) {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
						+ " fee, method, state, recorded_at, recorded_by, recorded_by_name, received)"
						+ " values ("
						+ " (select id from competitor where member_number = ?), 2027, ?,"
						+ " (select id from price_row where key = ?), " + amount + ", 'RSD', 0, 'ips', 'recorded',"
						+ " timestamptz '2026-10-05 09:00:00+00', " + AN_ACCOUNT + ", 'Blagajnik Probni',"
						+ " " + amount + ")")
				.params(number, reference, key).update();
	}

	/**
	 * The price list as V49 left it, and as a real database has it: the days and names V49 wrote, with ONE name
	 * and ONE pair of amounts that an administrator has typed over, and a ranking column wrong on two rows so that
	 * a migration which does not write it is told apart from one that does. Four payments, one on each period.
	 */
	@BeforeEach
	void thePriceListAsItStoodBeforeV75() {
		jdbc.execute("update price_row set day_from = '10-15', day_to = '10-31', ranking = true,"
				+ " label = '15. do 31. oktobra' where key = 'early'");
		jdbc.execute("update price_row set day_from = '11-01', day_to = '11-30', ranking = true,"
				+ " label = '1. do 30. novembra' where key = 'regular'");
		jdbc.execute("update price_row set day_from = '12-01', day_to = '12-31', ranking = false,"
				+ " label = 'Kasna uplata, kako sam je ja nazvao', eur = 51, rsd = 6100 where key = 'late'");
		jdbc.execute("update price_row set day_from = '01-01', day_to = '10-14', ranking = true,"
				+ " label = '1. januara do 14. oktobra' where key = 'season'");

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
				+ " 'Probic', 'blagajnik@primer.rs', (select id from role where code = 'moderator'))")
				.update();

		competitor("001001", "Rana", "00112233445566b1");
		competitor("001002", "Redovna", "00112233445566b2");
		competitor("001003", "Kasna", "00112233445566b3");
		competitor("001004", "Tekuca", "00112233445566b4");

		payment("001001", "2027001001", "early", "4200.00");
		payment("001002", "2027001002", "regular", "4800.00");
		payment("001003", "2027001003", "late", "6100.00");
		payment("001004", "2027001004", "season", "4800.00");
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

	/**
	 * THE FOUR ROWS MOVE OVER ROWS THAT WERE ALREADY THERE, the name even where an administrator had typed his own,
	 * and the ranking is written.
	 */
	@Test
	void theDaysTheNamesAndTheRankingMoveOverARealPriceList() {
		assertThat(rowOf("early").subList(0, 2))
				.as("the fixture did not put V49's days back, so the migration below is run against rows it has"
						+ " already moved and this case measures nothing")
				.containsExactly("10-15", "10-31");
		assertThat(rowOf("late").get(2)).isEqualTo("Kasna uplata, kako sam je ja nazvao");

		theMigration("75");

		assertThat(rowOf("early")).containsExactly("11-11", "11-20", "11. do 20. novembra", "true");
		assertThat(rowOf("regular")).containsExactly("11-21", "12-31", "21. novembra do 31. decembra", "true");
		assertThat(rowOf("late"))
				.as("the name an administrator typed survived, or the ranking was not written")
				.containsExactly("01-01", "03-31", "1. januara do 31. marta", "true");
		assertThat(rowOf("season")).containsExactly("04-01", "11-10", "1. aprila do 10. novembra", "false");
	}

	/**
	 * THE AMOUNTS ARE NOT TOUCHED. The row an administrator re-priced keeps his prices, because the migration
	 * moves days and writes no amount at all.
	 */
	@Test
	void theAmountsAnAdministratorTypedAreLeftAlone() {
		theMigration("75");

		assertThat(db.sql("select eur::text || '/' || rsd::text from price_row where key = 'late'")
				.query(String.class).single())
				.as("the migration wrote an amount, so a price set on the portal was discarded")
				.isEqualTo("51.00/6100.00");
		assertThat(db.sql("select eur::text || '/' || rsd::text from price_row where key = 'early'")
				.query(String.class).single())
				.isEqualTo("35.00/4200.00");
	}

	/**
	 * EVERY PAYMENT ALREADY BOOKED STILL POINTS AT THE SAME ROW, with the same amount. The row "early" still means
	 * 35 EUR and the ids do not move, so no payment is orphaned, re-priced or re-pointed by moving the days.
	 */
	@Test
	void everyPaymentAlreadyBookedStillPointsAtTheRowItWasBookedOn() {
		List<String> before = payments();

		assertThat(before).as("the fixture booked no payments, so this case measures nothing").hasSize(4);

		theMigration("75");

		assertThat(payments()).containsExactlyInAnyOrderElementsOf(before);
	}

	private List<String> payments() {
		return db.sql("select p.reference || ' ' || r.key || ' ' || p.amount::text from payment p"
						+ " join price_row r on r.id = p.price_row_id")
				.query(String.class)
				.list();
	}

	/**
	 * AND THE PAGES MOVE OVER THE TEXT THAT WAS ALREADY THERE, in both languages. The sentences are put back by
	 * the reverse of what V76 replaces, and then V76 is executed.
	 */
	@Test
	void theRulebookMovesOverTheTextThatWasAlreadyThere() {
		theTextAsItStoodBeforeV76();

		assertThat(bodiesNaming("static_page_section", "Iz tima se izlazi u istom prozoru"))
				.as("the fixture did not put the old Serbian text back, so the migration below has nothing to"
						+ " change and this case measures nothing")
				.isEqualTo(1);
		assertThat(bodiesNaming("static_page_section_translation", "A member leaves a team in the same window"))
				.as("the fixture did not put the old English text back")
				.isEqualTo(1);

		theMigration("76");

		assertThat(bodiesNaming("static_page_section", "Iz tima se izlazi u istom prozoru")).isZero();
		assertThat(bodiesNaming("static_page_section", "Prelazni rok za timove je od 11. novembra do 31. decembra."))
				.as("the migration emptied the paragraph instead of replacing it").isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", "Sve promene moraju biti završene do 31. decembra")).isZero();
		assertThat(bodiesNaming("static_page_section", "Promena tima stupa na snagu 1. januara naredne sezone"))
				.as("the struck sentence took the one beside it with it").isEqualTo(1);
		assertThat(bodiesNaming("static_page_section_translation", "A member leaves a team in the same window"))
				.isZero();
		assertThat(bodiesNaming("static_page_section_translation",
				"A change of team takes effect on 1 January of the following season")).isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", "Poslednja izmena: 27.10.2026.")).isEqualTo(1);
		assertThat(bodiesNaming("static_page_section_translation", "Last amended: 27.10.2026.")).isEqualTo(1);
		assertThat(bodiesNaming("static_page_section", "Poslednja izmena: 22.10.2026."))
				.as("the terms of use were moved too, and their text did not change").isEqualTo(1);
	}

	/**
	 * A DATABASE WHOSE TEXT IS NOT THE TEXT V76 WAS WRITTEN AGAINST STOPS, and changes nothing. It is run on the
	 * text as it stands today, which already holds the new sentences, so every edit finds its old text zero times.
	 */
	@Test
	void textThatDoesNotHoldTheOldSentencesStopsTheMigrationAndChangesNothing() {
		String before = db.sql("select string_agg(body, '|' order by id) from static_page_section")
				.query(String.class).single();

		/* The refusal aborts the transaction of the test, so what it left is asked after a rollback to the point
		   taken here. */
		jdbc.execute("savepoint before_the_refusal");
		assertThatThrownBy(() -> theMigration("76"))
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

	private void put(String slug, int position, String language, String now, String was) {
		String languageClause = language == null ? "" : " and t.language = '" + language + "'";
		String sql = language == null
				? "update static_page_section t set body = replace(t.body, ?, ?) from static_page p"
						+ " where p.id = t.page_id and p.slug = ? and t.position = ?"
				: "update static_page_section_translation t set body = replace(t.body, ?, ?)"
						+ " from static_page_section s, static_page p where s.id = t.section_id and p.id = s.page_id"
						+ " and p.slug = ? and s.position = ?" + languageClause;

		assertThat(jdbc.update(sql, now, was, slug, position))
				.as("the reverse of an edit of V76 matched no section, so the fixture is not the old text")
				.isEqualTo(1);
	}

	/** The old sentences, put back by the reverse of each of V76's replacements. */
	private void theTextAsItStoodBeforeV76() {
		put("pravilnik", 3, null, "zaključno sa 31. martom 2027. godine", "zaključno sa 31. decembrom 2026. godine");
		put("pravilnik", 3, "en", "by a payment made by 31 March 2027 at the latest",
				"by a payment made by 31 December 2026 at the latest");
		put("pravilnik", 3, null, "Ko se učlani od 1. aprila 2027, dobija profil",
				"Ko se učlani tokom sezone, dakle od 1. januara 2027, dobija profil");
		put("pravilnik", 3, "en", "Anyone who joins from 1 April 2027 onward receives a profile",
				"Anyone who joins during the season, that is from 1 January 2027 onward, receives a profile");
		put("pravilnik", 4, null, "Cenovnik se sa istim rokovima ponavlja svake sezone.",
				"Cenovnik se ponavlja svake godine: od 15. oktobra se prodaje naredna sezona, a od 1. januara do 14. oktobra"
						+ " tekuća, bez prava na rangiranje.");
		put("pravilnik", 4, "en", "The price list repeats every season with the same deadlines.",
				"The price list repeats every year: from 15 October the following season is sold, and from 1 January to"
						+ " 14 October the current one is, without the right to be ranked.");
		put("pravilnik", 12, null,
				"Prelazni rok za timove je od 11. novembra do 31. decembra. Ulazak ili izlazak iz tima su dozvoljeni samo"
						+ " tokom prelaznog roka.",
				"Iz tima se izlazi u istom prozoru u kom se i ulazi, od 15. oktobra do 31. decembra. Izlazak je jedan i ne"
						+ " nosi nikakvu kaznu: doprinos koji je član dao timu u toj sezoni ostaje, i član sme odmah da se"
						+ " prijavi drugom timu u istom prozoru. Van tog prozora izlazak nije moguć.");
		put("pravilnik", 12, "en",
				"The transfer window for teams runs from 11 November to 31 December. Joining or leaving a team is allowed"
						+ " only during the transfer window.",
				"A member leaves a team in the same window in which they join one, from 15 October to 31 December. There is"
						+ " one exit and it carries no penalty: the contribution they have made to the team in that season"
						+ " stays, and they may apply to another team immediately, within the same window. Outside that"
						+ " window leaving is not possible.");
		put("pravilnik", 12, null, "aktivno za tu sezonu.\n\nTrkački par",
				"aktivno za tu sezonu. Sve promene moraju biti završene do 31. decembra.\n\nTrkački par");
		put("pravilnik", 12, "en", "active for that season.\n\nA racing pair",
				"active for that season. All changes must be completed by 31 December.\n\nA racing pair");
		put("pravilnik", 19, null, "Poslednja izmena: 27.10.2026.", "Poslednja izmena: 22.10.2026.");
		put("pravilnik", 19, "en", "Last amended: 27.10.2026.", "Last amended: 22.10.2026.");
	}
}
