package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * THE ROWS A TRANSLATION CAN BELONG TO, written the way the tests of V115 need them, and one translation made of
 * whatever the text of such a row says now. Public so that the cases of the schema ({@code com.btl.portal.db}) and
 * of the routes and of the pass read one set of fixtures instead of five.
 */
public final class TranslatableRows {

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private TranslatableRows() {
	}

	public static long event(JdbcClient db, String slug, String description) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
						+ " description, link) values (?, ?, date '2027-05-01', " + A_TOWN
						+ ", null, null, 'race', false, ?, '') returning id")
				.params(slug, "Događaj " + slug, description)
				.query(Long.class)
				.single();
	}

	public static long league(JdbcClient db, String slug, int season, String rules, String prizes) {
		return db.sql("insert into league (slug, name, season, rules, prizes) values (?, ?, ?, ?, ?) returning id")
				.params(slug, "Liga " + slug, season, rules, prizes)
				.query(Long.class)
				.single();
	}

	public static long team(JdbcClient db, String slug, String bio) {
		return db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, first_season, admin_id)"
						+ " values (?, ?, ?, '', " + A_TOWN + ", null, null, 2027, null) returning id")
				.params(slug, "Tim " + slug, bio)
				.query(Long.class)
				.single();
	}

	/** A member, not active until {@link HeldOn#season} says so. */
	public static long member(JdbcClient db, String number, String bio, boolean hidden) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
						+ " city, country_id, first_season, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', ?, 'M', date '1982-02-02', " + A_TOWN + ", null, null, 2027,"
						+ " ?, null, ?, ?, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, "Prezime" + number, "00112233445588" + number.substring(4), bio, hidden)
				.query(Long.class)
				.single();
	}

	public static long comment(JdbcClient db, long event, long member, String body) {
		return db.sql("insert into event_comment (event_id, competitor_id, who, published_at, rating_organisation,"
						+ " rating_value, rating_ambience, body) values (?, ?, 'Probni Autor',"
						+ " timestamptz '2027-05-02 10:00:00+00', 4, 4, 4, ?) returning id")
				.params(event, member, body)
				.query(Long.class)
				.single();
	}

	/**
	 * A TRANSLATION OF THE TEXT AS IT NOW STANDS: made of the digest of {@code table.column} of that row at this
	 * moment, so that it is shown until the text changes.
	 *
	 * @param key the column of {@code text_translation} that names the row, {@code league_id} and the like
	 */
	public static void translated(JdbcClient db, String table, String column, String key, long id, String language,
			String origin, String heardAs, String body) {
		db.sql("insert into text_translation (" + key + ", field, language, origin, source_digest, source_language,"
						+ " body) select id, ?, ?, ?, encode(sha256(convert_to(" + column + ", 'UTF8')), 'hex'), ?, ?"
						+ " from " + table + " where id = ?")
				.params(column, language, origin, heardAs, body, id)
				.update();
	}

	/** The same for a machine, which always says what it read. */
	public static void machine(JdbcClient db, String table, String column, String key, long id, String language,
			String body) {
		translated(db, table, column, key, id, language, "machine", "sr-Latn", body);
	}
}
