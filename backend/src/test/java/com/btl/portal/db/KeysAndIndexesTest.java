package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Two questions {@link ConstraintsTest} does not ask, and neither did anything else.
 *
 * <p><b>Whether a key may be deferred.</b> {@code ConstraintsTest} proves that
 * every key rejects a duplicate. It says nothing about <em>when</em> the rejection
 * happens, and for a column that carries an order that is the whole question.
 * Measured on 08.09.2026 against the schema as it was: {@code update place set
 * rank = rank + 1 where rank >= 46900}, which is what inserting a town at position
 * 46,900 is, came back {@code ERROR: duplicate key value violates unique
 * constraint "place_rank_unique", Key (rank)=(46901)}. A plain UNIQUE is checked
 * as each row is written, so the first row to move lands on a neighbour that has
 * not moved yet, and there is no order of rows that avoids it. Nor could it be put
 * off: a constraint not declared DEFERRABLE cannot be deferred. The order the
 * whole town field depends on was therefore unmaintainable, and no test said so.
 *
 * <p><b>Whether an index exists at all.</b> {@code ConstraintsTest} reads
 * {@code pg_constraint} and {@code ConventionsTest} reads {@code pg_tables}, and
 * before 08.09.2026 nothing read {@code pg_indexes}: deleting the one index in the
 * schema left the build at BUILD SUCCESS.
 *
 * <p>Both lists below are written by hand and both have a floor that is not
 * another list: the catalogue. A key added without a line here fails, an index
 * added without a line here fails, and a line here for something that no longer
 * exists fails too.
 */
class KeysAndIndexesTest extends DatabaseTest {

	/**
	 * One key of the schema, and the decision about deferring it.
	 *
	 * @param constraint its name
	 * @param deferrable whether it may be put off to the end of the statement,
	 *                   which is the only way a range of an order can move
	 * @param why        the reason, in words, because the answer is a decision and
	 *                   not a fact anybody can look up
	 */
	record Key(String constraint, boolean deferrable, String why) {

		@Override
		public String toString() {
			return constraint;
		}
	}

	/**
	 * The decision, one line per key, and the shortest true reason for it.
	 *
	 * The rule the lines follow: a key over a column that carries an <b>order</b>
	 * is deferrable, because an order is maintained by moving a range of it and a
	 * plain UNIQUE makes that impossible rather than awkward. A key over a column
	 * that is <b>looked up</b> is not, and there are two prices for getting that
	 * side wrong rather than the one this file named until 09.09.2026:
	 *
	 * <ol>
	 * <li>a deferrable key is no {@code ON CONFLICT} arbiter, {@code ON CONFLICT
	 * does not support deferrable unique constraints/exclusion constraints as
	 * arbiters};
	 * <li>and nothing may point at one at all: {@code ERROR: cannot use a
	 * deferrable unique constraint for referenced table}, refused when the
	 * referring table is created. A column declared deferrable is a column no
	 * foreign key can ever name.
	 * </ol>
	 *
	 * <p>Both are measured below rather than asserted here, and the second decided
	 * a question the schema did not have when this was written and has now. The
	 * town codebook was given a speaking mark of its own on 08.09.2026, so that
	 * ADL A36 O5 can give an event a foreign key to a place, and that mark's
	 * unique key is <b>plain</b>: it exists to be pointed at, and price 2 says a
	 * deferrable one cannot be. See {@link PlaceIdentityTest}, which holds the two
	 * halves of that over the codebook itself.
	 */
	private static final List<Key> KEYS = List.of(
			new Key("country_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("country_code_unique", false, "a country is looked up by its code; codes are not a sequence"),
			new Key("country_name_unique", false, "a name is looked up, not counted from one end"),
			new Key("country_sort_order_unique", true,
					"the order countries are listed in: a country joining the region moves every one below it"),
			new Key("place_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("place_geonames_id_unique", false,
					"a town is looked up by its GeoNames mark, and the mark is there to be pointed at"),
			new Key("place_rank_unique", true,
					"the order towns are suggested in: inserting one town moves the rank of every smaller town"),
			new Key("price_row_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("price_row_key_unique", false, "a price row is looked up by its key"),
			new Key("price_row_sort_order_unique", true,
					"the order the price list is drawn in: a row inserted between two moves the rest"),
			new Key("role_pk", false, "a surrogate key nothing outside the portal sees, and account.role_id names it"),
			new Key("role_code_unique", false, "a role is looked up by its code, and V5 carries no order at all"),
			new Key("admin_right_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("admin_right_code_unique", false,
					"a right is looked up by the key the portal writes it down under, entity:members"),
			new Key("account_pk", false,
					"a surrogate key nothing outside the portal sees, and the token table points at it"),
			new Key("email_verification_token_pk", false,
					"a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("email_verification_token_hash_unique", false,
					"a link is looked up by the digest it hashes to, and one digest may open one account"));

	/** One index of the schema that no key owns, and what it is for. */
	record Index(String name, String forWhat) {

		@Override
		public String toString() {
			return name;
		}
	}

	private static final List<Index> INDEXES = List.of(
			new Index("place_country_idx", "narrowing the town field by the country already chosen on the form"),
			new Index("role_only_one_holds_every_right",
					"at most one role may hold every right; a partial index because a unique constraint takes no WHERE"),
			new Index("account_email_unique",
					"one address is one account whatever case it is typed in; an index because the uniqueness is over "
							+ "lower(email) and a unique constraint takes no expression"),
			new Index("account_role_idx", "the accounts of one role, which is how a role that cannot be dropped is found"),
			new Index("email_verification_token_account_idx",
					"the live links of one account, which is what re-sending the confirmation reads"));

	/**
	 * Every primary key and unique key in the schema, with what the catalogue says
	 * about deferring it and which single column it covers.
	 *
	 * The column comes from {@code conkey} rather than from the list above, so the
	 * list holds only the part that is a decision. A key over more than one column
	 * comes back with both names and the shift below refuses to guess.
	 */
	private List<Map<String, Object>> keysInTheSchema() {
		return db
				.sql("""
						select con.conname            as constraint_name,
						       con.condeferrable      as deferrable,
						       con.condeferred        as deferred,
						       cls.relname            as table_name,
						       string_agg(att.attname, ',' order by att.attnum) as columns,
						       string_agg(format_type(att.atttypid, att.atttypmod), ',' order by att.attnum)
						                              as column_types
						  from pg_constraint con
						  join pg_class cls on cls.oid = con.conrelid
						  join pg_namespace nsp on nsp.oid = cls.relnamespace
						  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
						 where con.contype in ('p', 'u')
						   and nsp.nspname = current_schema()
						   and cls.relname <> ?
						 group by con.conname, con.condeferrable, con.condeferred, cls.relname
						 order by con.conname
						""")
				.param(flywayTable())
				.query()
				.listOfRows();
	}

	/**
	 * The floor: the catalogue and the list above name the same keys, and agree
	 * about every one of them.
	 *
	 * Both directions in one assertion, because both are the same mistake seen
	 * from either side: a key that arrives without a decision, and a decision that
	 * outlives its key. {@code condeferred} is asserted false throughout, which is
	 * the difference between INITIALLY IMMEDIATE and INITIALLY DEFERRED: a key that
	 * starts deferred moves its complaint to a COMMIT with no statement to blame.
	 */
	@Test
	void everyKeyInTheSchemaHasADecisionAboutDeferring() {
		Map<String, Boolean> decided = KEYS.stream().collect(Collectors.toMap(Key::constraint, Key::deferrable));

		Map<String, Boolean> declared = keysInTheSchema().stream()
				.collect(Collectors.toMap(row -> (String) row.get("constraint_name"),
						row -> (Boolean) row.get("deferrable")));

		assertThat(declared).isNotEmpty();
		assertThat(declared)
				.as("a key with no line in KEYS, or a line in KEYS with no key")
				.containsExactlyInAnyOrderEntriesOf(decided);

		assertThat(keysInTheSchema())
				.as("every key is checked at the end of its own statement, never first at COMMIT")
				.allSatisfy(row -> assertThat(row.get("deferred")).isEqualTo(false));
	}

	/** The keys the list above says may be deferred, as (table, column) to move. */
	static List<Key> orderKeys() {
		return KEYS.stream().filter(Key::deferrable).toList();
	}

	/** And the ones it says may not, which are the ones anything may point at. */
	static List<Key> lookedUpKeys() {
		return KEYS.stream().filter(key -> !key.deferrable()).toList();
	}

	private Map<String, Object> catalogue(Key key) {
		return keysInTheSchema().stream()
				.filter(row -> key.constraint().equals(row.get("constraint_name")))
				.findFirst()
				.orElseThrow();
	}

	/**
	 * A whole range of the order moves in one statement.
	 *
	 * This is the maintenance that a plain UNIQUE refuses and the reason these
	 * three keys are deferrable. It is written as the operation itself rather than
	 * as a question to {@code pg_constraint}, because what was broken was not the
	 * flag: it was that the work could not be done.
	 */
	@ParameterizedTest
	@MethodSource("orderKeys")
	void aRangeOfTheOrderMovesInOneStatement(Key key) {
		Map<String, Object> row = catalogue(key);
		String table = (String) row.get("table_name");
		String column = (String) row.get("columns");

		assertThat(column)
				.as("a deferrable key over more than one column needs a shift written for it, not guessed")
				.doesNotContain(",");

		int moved = db
				.sql("update " + table + " set " + column + " = " + column + " + 1"
						+ " where " + column + " >= (select max(" + column + ") - 5 from " + table + ")")
				.update();

		assertThat(moved).isEqualTo(6);
	}

	/**
	 * And the statement that ends with two rows in one position is still refused.
	 *
	 * The other half of the boundary, and the half that says the first test is not
	 * simply the constraint switched off. Deferrable moves the check to the end of
	 * the statement; it does not remove it, and nothing here says
	 * {@code SET CONSTRAINTS}. A key changed to INITIALLY DEFERRED lets this
	 * through to a COMMIT that never comes in a rolled back test, and a key that
	 * lost its UNIQUE lets it through for good.
	 */
	@ParameterizedTest
	@MethodSource("orderKeys")
	void andAStatementThatEndsWithTwoRowsInOnePositionIsRefused(Key key) {
		Map<String, Object> row = catalogue(key);
		String table = (String) row.get("table_name");
		String column = (String) row.get("columns");

		assertThatThrownBy(() -> db
				.sql("update " + table + " set " + column + " = 1 where " + column + " = 2")
				.update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(key.constraint());
	}

	/**
	 * The second price of deferring: nothing may point at such a key.
	 *
	 * The comment in V3 called itself a list of what deferring costs and named one
	 * item, the {@code ON CONFLICT} arbiter. This is the other, and it is the
	 * larger of the two: a foreign key to a deferrable unique constraint is
	 * refused outright, when the referring table is created, not when a row is
	 * written. So the column is one nothing can ever refer to, which is a fact
	 * about the whole schema rather than about one statement somebody might write.
	 *
	 * <p>Run against every deferrable key rather than against {@code place.rank},
	 * so a fourth order column arriving is measured too. The type comes from
	 * {@code format_type} for the same reason the column name does: guessing it
	 * would make this a test about the guess.
	 */
	@ParameterizedTest
	@MethodSource("orderKeys")
	void noForeignKeyMayPointAtADeferrableKey(Key key) {
		Map<String, Object> row = catalogue(key);

		assertThatThrownBy(() -> db.sql(pointingAt(row)).update())
				.as("a deferrable unique key is one no foreign key can name, and that is the price of deferring it")
				.hasMessageContaining("cannot use a deferrable unique constraint for referenced table");
	}

	/**
	 * And the keys that stayed plain can be pointed at, which is what they are for.
	 *
	 * The other half, and without it the test above is satisfied by a
	 * {@code create table} that fails for any reason at all: a typo in the
	 * statement it builds would pass it against every key and prove nothing. Here
	 * the same statement, built the same way, has to go through.
	 */
	@ParameterizedTest
	@MethodSource("lookedUpKeys")
	void aKeyThatStayedPlainIsOneAForeignKeyMayName(Key key) {
		Map<String, Object> row = catalogue(key);

		assertThat(db.sql(pointingAt(row)).update()).isZero();
	}

	/** A table whose one column is a foreign key to that key, and nothing else. */
	private String pointingAt(Map<String, Object> row) {
		String column = (String) row.get("columns");
		String type = (String) row.get("column_types");

		assertThat(column)
				.as("a key over more than one column needs a referring table written for it, not guessed")
				.doesNotContain(",");

		return "create table points_here (v " + type + " references " + row.get("table_name") + " (" + column + "))";
	}

	/**
	 * Every index that no key brought with it has a line above.
	 *
	 * A unique key and a primary key each create an index of their own, and those
	 * are decisions already held by {@link #everyKeyInTheSchemaHasADecisionAboutDeferring()};
	 * {@code conindid} is how the catalogue says which index belongs to which key,
	 * so what is left over is exactly the indexes somebody wrote on purpose.
	 * Flyway's own table brings an index of its own and is left out with it.
	 */
	@Test
	void everyIndexNoKeyOwnsHasALineHere() {
		List<String> standalone = db
				.sql("""
						select cls.relname
						  from pg_class cls
						  join pg_index idx on idx.indexrelid = cls.oid
						  join pg_class tbl on tbl.oid = idx.indrelid
						  join pg_namespace nsp on nsp.oid = cls.relnamespace
						 where cls.relkind = 'i'
						   and nsp.nspname = current_schema()
						   and tbl.relname <> ?
						   and not exists (select 1 from pg_constraint con where con.conindid = cls.oid)
						 order by cls.relname
						""")
				.param(flywayTable())
				.query(String.class)
				.list();

		assertThat(standalone)
				.as("an index with no line in INDEXES, or a line in INDEXES with no index")
				.containsExactlyInAnyOrderElementsOf(INDEXES.stream().map(Index::name).toList());
	}

	/**
	 * And the one index there is does its job: the towns of a country are found
	 * through it and not by reading all forty seven thousand.
	 *
	 * The plan and not the line in {@code pg_indexes}, because an index nobody can
	 * use is the same as no index. Sequential scans are turned off for this
	 * transaction so the answer does not depend on when autovacuum last collected
	 * statistics; that changes which plan is cheapest, not which plans exist, so a
	 * dropped index still leaves PostgreSQL reading the whole table and this still
	 * fails.
	 */
	@Test
	void theTownsOfOneCountryAreFoundThroughTheIndex() {
		db.sql("set local enable_seqscan = off").update();

		Long serbia = db.sql("select id from country where code = 'RS'").query(Long.class).single();

		String plan = String.join("\n",
				db.sql("explain (costs off) select id from place where country_id = " + serbia)
						.query(String.class)
						.list());

		assertThat(plan).contains("place_country_idx");
	}
}
