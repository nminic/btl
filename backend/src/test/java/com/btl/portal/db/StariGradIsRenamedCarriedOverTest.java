package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V69 DOES TO THE TOWNS THAT ARE ALREADY THERE, and to the members and events that already
 * stand in them, run against a real database.
 *
 * <p><b>Why this exists, and it is the whole reason rather than a formality.</b> V69 renames two
 * towns. Every test starts from an empty database, so a migration is measured over a place table
 * holding no member and no event; a rename is the one change that cannot refuse a row, but "keeps
 * every row pointing where it pointed" is a claim, and the owner's wording of it was that a member
 * who stands in "Stari Grad (Omiš)" still stands in that town when it is called "Stari Grad (Hvar)"
 * (PDL, 20.10.2026; CLAUDE.md, section 11). The shape is {@link PaymentReferenceCarriedOverTest}'s.
 *
 * <p><b>How the two halves are made.</b> The names V51 gave the two towns are put back as the
 * fixture, a member and an event are written in each of them, and then THE MIGRATION ITSELF is
 * executed: the file Flyway resolved and applied, not a copy of its statements
 * ({@link DatabaseTest#migrationSql}). Everything happens inside the test's transaction and is
 * rolled back.
 *
 * <p><b>The proof that the undo was complete is the first assertion of every case</b>: the names the
 * fixture reads before the migration runs are V51's, so a migration that renamed nothing, or a
 * fixture that left V69's names in place, fails there and not as a pass.
 */
class StariGradIsRenamedCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/** Stari Grad on Hvar, which V51 called after Omiš, and Stari Grad by Pag, which it called after Gospić. */
	private static final long ON_HVAR = 3_189_965L;

	private static final long BY_PAG = 3_216_885L;

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private void theNamesAsV51LeftThem() {
		jdbc.update("update place set name = 'Stari Grad (Omiš)' where geonames_id = ?", ON_HVAR);
		jdbc.update("update place set name = 'Stari Grad (Gospić)' where geonames_id = ?", BY_PAG);
	}

	private long placeOf(long mark) {
		return db.sql("select id from place where geonames_id = ?").param(mark).query(Long.class).single();
	}

	private void competitorIn(String number, String code, long place) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Clan', 'M',"
						+ " date '1982-02-02', ?, null, null, 2027, true,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, place, code).update();
	}

	private void eventIn(String slug, long place) {
		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values (?, ?, date '2027-05-01', ?, 'race', false, '', '')")
				.params(slug, slug, place).update();
	}

	private Map<Long, String> everyTownByMark() {
		return db.sql("select geonames_id, name from place")
				.query((rs, row) -> Map.entry(rs.getLong(1), rs.getString(2))).list().stream()
				.collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
	}

	private List<String> whoStandsWhere() {
		return db.sql("select c.member_number || ' ' || p.geonames_id || ' ' || p.name from competitor c"
						+ " join place p on p.id = c.place_id order by c.member_number")
				.query(String.class).list();
	}

	private List<String> whatIsHeldWhere() {
		return db.sql("select e.slug || ' ' || p.geonames_id || ' ' || p.name from btl_event e"
						+ " join place p on p.id = e.place_id order by e.slug")
				.query(String.class).list();
	}

	@BeforeEach
	void twoMembersAndTwoEventsStandInTheTownsAsTheyWereCalled() {
		theNamesAsV51LeftThem();

		competitorIn("001001", "00112233445566a1", placeOf(ON_HVAR));
		competitorIn("001002", "00112233445566a2", placeOf(BY_PAG));
		eventIn("trka-na-hvaru", placeOf(ON_HVAR));
		eventIn("trka-kod-paga", placeOf(BY_PAG));
	}

	/**
	 * THE TWO TOWNS ARE RENAMED, AND EVERY MEMBER AND EVERY EVENT STILL STANDS IN THE SAME ROW.
	 *
	 * <p>The names are read through the key the member and the event hold, so a migration that
	 * deleted the towns and wrote two new ones, or moved a member to a town of the new name, would
	 * not read the same: the key is what is compared, and the name follows it.
	 */
	@Test
	void theTwoTownsAreRenamedAndNobodyWhoStoodInThemMoves() {
		List<Long> keysBefore = List.of(placeOf(ON_HVAR), placeOf(BY_PAG));

		assertThat(whoStandsWhere()).as("the fixture is not the state V51 left")
				.containsExactly("001001 3189965 Stari Grad (Omiš)", "001002 3216885 Stari Grad (Gospić)");

		jdbc.execute(migrationSql("69"));

		assertThat(whoStandsWhere())
				.containsExactly("001001 3189965 Stari Grad (Hvar)", "001002 3216885 Stari Grad (Pag)");
		assertThat(whatIsHeldWhere()).containsExactly("trka-kod-paga 3216885 Stari Grad (Pag)",
				"trka-na-hvaru 3189965 Stari Grad (Hvar)");
		assertThat(List.of(placeOf(ON_HVAR), placeOf(BY_PAG)))
				.as("a town keeps its key: it was renamed and not replaced").isEqualTo(keysBefore);
	}

	/**
	 * AND NOTHING ELSE OF THE CODEBOOK CHANGES: every other town has the name it had, and the two keep
	 * their rank, their country and their English name. The two names are exchanged between the two
	 * rows by a migration that confused them, and every other town's name changes under one that took
	 * the town by its country or by its name, so the comparison is over the whole table.
	 */
	@Test
	void exactlyTheTwoTownsChangeTheirNameAndNothingElseOfThemChanges() {
		Map<Long, String> before = everyTownByMark();
		List<String> restBefore = db.sql("select geonames_id || ' ' || rank || ' ' || country_id || ' '"
						+ " || coalesce(english_name, '-') from place order by id").query(String.class).list();

		jdbc.execute(migrationSql("69"));

		Map<Long, String> after = everyTownByMark();

		assertThat(after.keySet()).isEqualTo(before.keySet());
		assertThat(after.entrySet().stream().filter(one -> !one.getValue().equals(before.get(one.getKey())))
				.map(Map.Entry::getKey).toList())
				.as("the towns whose name the migration changed")
				.containsExactlyInAnyOrder(ON_HVAR, BY_PAG);
		assertThat(after.get(ON_HVAR)).isEqualTo("Stari Grad (Hvar)");
		assertThat(after.get(BY_PAG)).isEqualTo("Stari Grad (Pag)");
		assertThat(db.sql("select geonames_id || ' ' || rank || ' ' || country_id || ' '"
						+ " || coalesce(english_name, '-') from place order by id").query(String.class).list())
				.as("a key, a rank, a country or an English name moved with the rename")
				.isEqualTo(restBefore);
	}

	/**
	 * A TOWN THAT NO LONGER CARRIES THE LABEL V51 GAVE IT IS LEFT AS IT IS, which is the guard of the
	 * migration: somebody wrote another name for the Stari Grad by Pag by hand, and the migration, which
	 * was written for a town it saw under another label, does not overwrite it. The other one, still
	 * under V51's label, is renamed all the same.
	 */
	@Test
	void aTownThatWasRenamedByHandBeforeIsNotOverwritten() {
		jdbc.update("update place set name = 'Stari Grad (Lika)' where geonames_id = ?", BY_PAG);

		jdbc.execute(migrationSql("69"));

		Map<Long, String> after = everyTownByMark();

		assertThat(after.get(BY_PAG)).as("the guard on the old name was not asked").isEqualTo("Stari Grad (Lika)");
		assertThat(after.get(ON_HVAR)).isEqualTo("Stari Grad (Hvar)");
	}
}
