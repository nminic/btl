package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A town has an identity of its own, and it is the one thing anything may point at.
 *
 * <p><b>What this class used to say, and why it says the opposite now.</b> Until
 * 08.09.2026 the codebook shipped each town as {@code ["name", "COUNTRY"]} and
 * nothing else, so a town had no mark, the pair was no mark either because more
 * than one town carries the same name and country, and a delta migration had to
 * line the two states of the codebook up by {@code rank}, a position in a
 * file. Taking one town out of the top rewrote every row below it, and the row
 * that held Shanghai ended up holding Chongqing under the same {@code place.id}.
 * This class then held a boundary: nothing anywhere may reference a town. The
 * owner lifted it on 08.09.2026 by having the codebook carry the GeoNames
 * identifier the generator was already reading and dropping (ADL A16, A36 O5).
 * How many such pairs there are is deliberately not written here: it is a number
 * that changes every time the codebook is rebuilt, and the two homes that give it
 * are {@code V3__place.sql}, which nothing may rewrite, and {@code places.ts},
 * where {@code contract.test.ts} asks the shipped codebook for it on every run.
 * Written here it would be a third copy with nothing under it, and it was one
 * until 09.09.2026.
 *
 * <p><b>What holds now, and what each half is worth on its own.</b> The mark
 * without the key is a column somebody may fill twice; the key without
 * plainness is a column no foreign key may name, which is precisely what
 * {@code place.rank} is and precisely why the mark is not it. So both are asked,
 * and the third test is the one that says what the other two are for.
 *
 * <p>Read out of the catalogue rather than off the migration, because the
 * question is what the database ended up with. The column name is the one thing
 * written down here, and it has to be: it is the name the generator and the
 * front end both use, and nothing but agreement makes it the right one.
 */
class PlaceIdentityTest extends DatabaseTest {

	/** The codebook, and the mark beside its surrogate key. */
	private static final String TOWNS = "place";
	private static final String MARK = "geonames_id";

	/** The column that is a position in the file rather than a fact about a town. */
	private static final String POSITION = "rank";

	@Test
	void theCodebookCarriesAMarkOfItsOwn() {
		List<Map<String, Object>> column = db
				.sql("""
						select format_type(att.atttypid, att.atttypmod) as type,
						       att.attnotnull                           as required
						  from pg_attribute att
						  join pg_class cls on cls.oid = att.attrelid
						  join pg_namespace nsp on nsp.oid = cls.relnamespace
						 where nsp.nspname = current_schema()
						   and cls.relname = ?
						   and att.attname = ?
						   and att.attnum > 0
						   and not att.attisdropped
						""")
				.params(TOWNS, MARK)
				.query()
				.listOfRows();

		assertThat(column)
				.as("a town is identified by its GeoNames mark, so the column carrying it is the one thing "
						+ "about a town that may not be missing")
				.singleElement()
				.satisfies(row -> {
					assertThat(row.get("type")).isEqualTo("bigint");
					assertThat(row.get("required")).isEqualTo(true);
				});
	}

	/**
	 * And the mark is unique, through a key that is plain.
	 *
	 * Both parts in one assertion because they are one decision. Unique, or two
	 * towns wear one mark and a reference to either means both. Plain, or nothing
	 * may name it: PostgreSQL refuses a foreign key to a deferrable unique
	 * constraint outright, when the referring table is created. The whole point of
	 * the mark is being referred to (ADL A36 O5), so a deferrable one would be a
	 * mark that does not do the one thing it is for.
	 */
	@Test
	void theMarkIsUniqueAndItsKeyIsPlain() {
		List<Map<String, Object>> keys = db
				.sql("""
						select con.conname       as name,
						       con.condeferrable as deferrable
						  from pg_constraint con
						  join pg_class cls on cls.oid = con.conrelid
						  join pg_namespace nsp on nsp.oid = cls.relnamespace
						  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
						 where nsp.nspname = current_schema()
						   and cls.relname = ?
						   and con.contype in ('p', 'u')
						   and array_length(con.conkey, 1) = 1
						   and att.attname = ?
						""")
				.params(TOWNS, MARK)
				.query()
				.listOfRows();

		assertThat(keys)
				.singleElement()
				.satisfies(key -> {
					assertThat(key.get("name")).isEqualTo("place_geonames_id_unique");
					assertThat(key.get("deferrable")).isEqualTo(false);
				});
	}

	/**
	 * The floor under both, and the sentence they are here to make: this is the
	 * column a foreign key may name, and the position is not.
	 *
	 * Two empty answers or two catalogue rows prove nothing by themselves. A query
	 * against the wrong schema, a column renamed on one side only, and the two
	 * tests above would go on passing. Here the two columns are used the way the
	 * schema means them to be used, and they have to answer differently: a table
	 * referring to the mark is created, a table referring to the position is
	 * refused before a row is ever written.
	 *
	 * <p>Which is also the whole difference between what this class held before
	 * 08.09.2026 and what it holds now. The refusal on {@code rank} is unchanged
	 * and is the old boundary, still standing where it belongs: over the column
	 * that is a position. What changed is that the town now has somewhere else to
	 * be pointed at.
	 */
	@Test
	void aForeignKeyMayNameTheMarkAndMayNotNameThePosition() {
		assertThat(db.sql("create table points_at_the_mark (v bigint references " + TOWNS + " (" + MARK + "))")
				.update())
				.isZero();

		assertThatThrownBy(() -> db
				.sql("create table points_at_the_position (v integer references " + TOWNS + " (" + POSITION + "))")
				.update())
				.as("the order of the codebook is maintained by moving a range of it, so its key is deferrable, "
						+ "and a deferrable unique key is one nothing may name")
				.hasMessageContaining("cannot use a deferrable unique constraint for referenced table");
	}
}
