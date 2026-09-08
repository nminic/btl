package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A town has no identity of its own yet, so nothing may point at one.
 *
 * <p><b>The measurement this is here for.</b> The town codebook ships each town
 * as {@code ["name", "COUNTRY"]} and nothing else. There is no mark ADL A36 O1
 * could put beside the {@code bigserial}, because none exists in the source, and
 * the pair of name and country is not one either: 1,614 of those pairs occur more
 * than once in the 46,906 towns. So a delta migration lines the two states of the
 * codebook up by {@code rank}, which is a position in a file and not a fact about
 * a town. Taking one town out of the top of the codebook produces 46,877 changed
 * rows, and the row that held Shenzhen ends up holding Guangzhou under the same
 * {@code place.id}.
 *
 * <p><b>The boundary that follows, and it is a decision and not a nicety.</b>
 * Nothing may hold a foreign key to {@code place}, and nothing may carry a
 * town's id in a column of its own, until the codebook carries a stable mark.
 * A row whose contents move under a stable id cannot be referred to by that id:
 * the reference would survive and mean a different town, and no constraint
 * anywhere would say so. Nothing points at a town today, which is the whole of
 * why nothing is wrong today, and that is exactly the kind of fact that stops
 * being true in a commit nobody thought was about towns.
 *
 * <p><b>What lifts it.</b> The mark that exists is the GeoNames identifier.
 * {@code ../btl-produkt/istorijski-podaci/napravi-mesta.py} already reads it out
 * of {@code cities500} (column 0) and drops it on the way out, so lifting this is
 * one line in that generator, a rebuilt codebook, a delta migration that adds the
 * column and fills it, and a delta that then lines rows up by the mark instead of
 * by the rank. Until then ADL A36 O5, which gives an event a foreign key to a
 * place, cannot be built, and this says so where it will be read: in the build,
 * on the day somebody writes that foreign key.
 *
 * <p><b>Both questions are asked of the catalogue</b>, not of a list of tables
 * kept here. A table added in a later migration is covered the moment it exists,
 * which is the only way a boundary about "anything at all" can be held.
 */
class PlaceIdentityTest extends DatabaseTest {

	/** The codebook whose rows have no identity of their own, and its id column. */
	private static final String TOWNS = "place";

	@Test
	void noForeignKeyAnywhereReferencesTheTownCodebook() {
		List<String> pointing = db
				.sql("""
						select cls.relname || '.' || con.conname
						  from pg_constraint con
						  join pg_class cls on cls.oid = con.conrelid
						  join pg_namespace nsp on nsp.oid = cls.relnamespace
						 where con.contype = 'f'
						   and nsp.nspname = current_schema()
						   and con.confrelid = ?::regclass
						 order by 1
						""")
				.param(TOWNS)
				.query(String.class)
				.list();

		assertThat(pointing)
				.as("a town's id follows its position in the codebook and not the town, so a row that keeps this "
						+ "reference through the next delta keeps a reference to a different town")
				.isEmpty();
	}

	/**
	 * And nothing carries a town's id without saying so with a foreign key either.
	 *
	 * The test above asks about foreign keys, and a column named after the
	 * codebook with no foreign key on it would answer it with silence while being
	 * the same fault: a stored number that means a different town after the next
	 * delta. The name is the schema's own convention rather than a guess -
	 * {@code place.country_id} names {@code country} that way in the migration
	 * this test was written against.
	 */
	@Test
	void noColumnOutsideTheCodebookCarriesATownId() {
		List<String> carrying = db
				.sql("""
						select cls.relname || '.' || att.attname
						  from pg_attribute att
						  join pg_class cls on cls.oid = att.attrelid
						  join pg_namespace nsp on nsp.oid = cls.relnamespace
						 where cls.relkind = 'r'
						   and nsp.nspname = current_schema()
						   and att.attnum > 0
						   and not att.attisdropped
						   and att.attname = ? || '_id'
						 order by 1
						""")
				.param(TOWNS)
				.query(String.class)
				.list();

		assertThat(carrying)
				.as("the codebook has no stable identity to carry; see this class for what lifts the boundary")
				.isEmpty();
	}

	/**
	 * The floor under both: the schema really is one where those questions could
	 * have been answered the other way.
	 *
	 * Two empty lists prove nothing on their own. A query with a typo in it, a
	 * schema read in the wrong place, a catalogue view that does not hold what it
	 * is supposed to, and both of the tests above pass for ever. So the same two
	 * questions are asked about the one reference the schema does carry, a town's
	 * foreign key to its country, and both have to find it.
	 */
	@Test
	void andTheSameTwoQuestionsFindTheReferenceTheSchemaDoesCarry() {
		List<String> pointingAtCountries = db
				.sql("""
						select cls.relname || '.' || con.conname
						  from pg_constraint con
						  join pg_class cls on cls.oid = con.conrelid
						  join pg_namespace nsp on nsp.oid = cls.relnamespace
						 where con.contype = 'f'
						   and nsp.nspname = current_schema()
						   and con.confrelid = 'country'::regclass
						 order by 1
						""")
				.query(String.class)
				.list();

		List<String> carryingCountryId = db
				.sql("""
						select cls.relname || '.' || att.attname
						  from pg_attribute att
						  join pg_class cls on cls.oid = att.attrelid
						  join pg_namespace nsp on nsp.oid = cls.relnamespace
						 where cls.relkind = 'r'
						   and nsp.nspname = current_schema()
						   and att.attnum > 0
						   and not att.attisdropped
						   and att.attname = 'country_id'
						 order by 1
						""")
				.query(String.class)
				.list();

		assertThat(pointingAtCountries).containsExactly("place.place_country_fk");
		assertThat(carryingCountryId).containsExactly("place.country_id");
	}
}
