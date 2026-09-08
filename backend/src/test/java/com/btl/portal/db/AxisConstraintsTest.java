package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Every constraint the six tables of V7 carry, with the row that breaks it.
 *
 * The same shape as ConstraintsTest and AccountConstraintsTest, and for the same
 * reason: a constraint nobody has broken on purpose is an intention rather than
 * a constraint, and a CHECK with a typo in the regular expression sits there
 * looking like protection and lets the row through. So each one gets a row that
 * it, and only it, must reject, and the failure has to name it.
 *
 * The floor under the hand written list is
 * {@link #everyConstraintOnTheSixTablesHasARowThatBreaksIt()}, which reads the
 * constraints back out of {@code pg_constraint} and the unique indexes out of
 * {@code pg_index}. Neither side can drift: a constraint added to the migration
 * without a row here fails the build, and a row here naming one that has been
 * dropped fails it too. PostgreSQL 18 records NOT NULL in {@code pg_constraint}
 * like any other constraint, so the floor covers those as well.
 *
 * The other direction is {@link #aLegitimateRowIsAccepted(String)}: without it,
 * a constraint that rejects everything would pass every case above.
 *
 * ONE CONSTRAINT HAS NO ROW THAT BREAKS IT, and it is named rather than left out
 * of the floor. {@code race_day_unique} is over (id, date) and id is already the
 * primary key, so no row can violate the pair without violating the key first;
 * it is not there to refuse anything but to be the target the result's composite
 * reference needs. Its proof is behavioural and lives in
 * CompetitorEventRaceAndResultTest, which drops it and shows the reference
 * cannot be made without it.
 */
class AxisConstraintsTest extends DatabaseTest {

	/**
	 * One row that must be rejected, and the constraint that has to be the reason.
	 *
	 * {@code evidence} is what the database says when that constraint is the one
	 * that fired: its own name for a check, a unique, a key or a foreign key, and
	 * the column for a NOT NULL, which PostgreSQL words by column and relation.
	 */
	record Violation(String constraint, String evidence, String sql) {

		static Violation of(String constraint, String sql) {
			return new Violation(constraint, constraint, sql);
		}

		static Violation notNull(String constraint, String column, String sql) {
			return new Violation(constraint, "column \"" + column + "\"", sql);
		}

		@Override
		public String toString() {
			return constraint + ": " + sql;
		}
	}

	/**
	 * The six tables V7 adds. The others answer to their own files, scoped the
	 * same way.
	 *
	 * Package visible because
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()}
	 * adds this list to the same list in every sibling and compares them against
	 * {@code pg_tables}: that is the floor that lets each of these files name its
	 * tables by hand, and it reads the field rather than a name, so dropping it
	 * stops the compiler.
	 */
	static final List<String> TABLES =
			List.of("competitor", "btl_event", "race", "result", "attending", "event_comment");

	/** Carried by the floor and not by a row, for the reason in the class comment. */
	private static final Set<String> KEYS_THAT_ONLY_EXIST_AS_A_TARGET = Set.of("race_day_unique");

	/* A town and a country out of the codebooks, looked up rather than numbered:
	   V2 and V3 hand the ids out of a sequence and nothing here may depend on
	   which. */
	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_COUNTRY = "(select id from country where code = 'RS')";

	private static final String PROBE_MEMBER = "000900";
	private static final String PROBE_COMPETITOR = "(select id from competitor where member_number = '000900')";
	private static final String OTHER_COMPETITOR = "(select id from competitor where member_number = '000901')";

	private static final String PROBE_SLUG = "probni-dogadjaj-2027";
	private static final String PROBE_EVENT = "(select id from btl_event where slug = '" + PROBE_SLUG + "')";

	private static final String PROBE_RACE = "(select id from race where name = 'Probna trka')";
	private static final String PROBE_RACE_DAY = "date '2027-04-03'";

	private static final String AN_INSTANT = "timestamptz '2027-04-04 09:00:00+00'";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_year,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown";
	private static final String EVENT_COLUMNS =
			"slug, name, date, place_id, city, country_id, kind, featured, description, link, copied_from";
	private static final String RACE_COLUMNS =
			"event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m, descent_m";
	private static final String RESULT_COLUMNS =
			"competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds, points";
	private static final String COMMENT_COLUMNS = "event_id, competitor_id, who, published_at,"
			+ " rating_organisation, rating_value, rating_ambience, body";

	/* A row of each table that breaks nothing: every violation below is one of
	   these with a single field spoiled, so what fails is the field and not the
	   fixture. Written out rather than built by the helpers, because the
	   annotation that uses them takes a constant and a method call is not one. */
	private static final String GOOD_COMPETITOR = "insert into competitor (" + COMPETITOR_COLUMNS + ") values ("
			+ "'000902', 'Probni', 'Clan', 'M', 1990, " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
			+ " '00112233445566aa', null, '', false, 'none')";
	private static final String GOOD_EVENT = "insert into btl_event (" + EVENT_COLUMNS + ") values ("
			+ "'druga-proba-2027', 'Druga proba', date '2027-05-05', " + A_TOWN
			+ ", null, null, 'race', false, '', '', null)";
	private static final String GOOD_RACE = "insert into race (" + RACE_COLUMNS + ") values ("
			+ PROBE_EVENT + ", 'Druga probna trka', false, " + PROBE_RACE_DAY + ", 'length', 0, 21.10, 0, 0)";
	private static final String GOOD_RESULT = "insert into result (" + RESULT_COLUMNS + ") values ("
			+ OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY + ", 10.00, 120, 120, 3600, 12.34)";
	/* A result that scores nothing, and it is a legitimate row rather than a
	   curiosity: five kilometres run out over a full twenty four hours come to
	   four ten thousandths of a point, and the formula rounds that to zero. This
	   is the row that fails the day "not negative" is tightened to "more than
	   zero", which no row above would notice. */
	private static final String GOOD_RESULT_THAT_SCORES_NOTHING = "insert into result (" + RESULT_COLUMNS
			+ ") values (" + OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
			+ ", 5.00, 0, 0, 86400, 0.00)";
	private static final String GOOD_ATTENDING = "insert into attending (event_id, competitor_id) values ("
			+ PROBE_EVENT + ", " + OTHER_COMPETITOR + ")";
	private static final String GOOD_COMMENT = "insert into event_comment (" + COMMENT_COLUMNS + ") values ("
			+ PROBE_EVENT + ", " + OTHER_COMPETITOR + ", 'Druga Proba', " + AN_INSTANT + ", 0, 5, 3, '')";

	/**
	 * Two members, one event, one race, one result, one intention and one comment,
	 * so the rows below have something to collide with.
	 *
	 * The class is transactional and rolled back, so this is written afresh for
	 * every case and leaves nothing behind. The second member exists so that every
	 * legitimate row above can be written without colliding with the probe.
	 */
	@BeforeEach
	void probe() {
		db.sql(competitor("'" + PROBE_MEMBER + "', 'Probni', 'Takmicar', 'M', 1985, " + A_TOWN
				+ ", null, null, 2027, false, true, 'payment', 'aaaabbbbccccdddd', null, '', false, 'none'")).update();
		db.sql(competitor("'000901', 'Druga', 'Proba', 'F', 1992, null, 'Zaselak', " + A_COUNTRY
				+ ", 2027, true, true, 'feeExempt', 'ffffeeeeddddcccc', null, '', true, 'full'")).update();

		db.sql("insert into btl_event (" + EVENT_COLUMNS + ") values ('" + PROBE_SLUG + "', 'Probni dogadjaj', "
				+ PROBE_RACE_DAY + ", " + A_TOWN + ", null, null, 'race', false, '', '', null)").update();

		db.sql("insert into race (" + RACE_COLUMNS + ") values (" + PROBE_EVENT + ", 'Probna trka', false, "
				+ PROBE_RACE_DAY + ", 'length', 0, 10.00, 100, 100)").update();

		db.sql(result(PROBE_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
				+ ", 10.00, 100, 100, 3600, 12.34")).update();

		db.sql("insert into attending (event_id, competitor_id) values (" + PROBE_EVENT + ", " + PROBE_COMPETITOR + ")")
				.update();

		db.sql("insert into event_comment (" + COMMENT_COLUMNS + ") values (" + PROBE_EVENT + ", " + PROBE_COMPETITOR
				+ ", 'Probni Takmicar', " + AN_INSTANT + ", 5, 4, 5, 'Odlicna organizacija.')").update();
	}

	static List<Violation> violations() {
		return List.of(
				// ------------------------------------------------------------- competitor
				Violation.of("competitor_pk",
						"insert into competitor (id, " + COMPETITOR_COLUMNS + ") select id, '000903', 'Probni',"
								+ " 'Clan', 'M', 1990, place_id, null, null, 2027, false, true, 'payment',"
								+ " '00112233445566aa', null, '', false, 'none' from competitor"
								+ " where member_number = '" + PROBE_MEMBER + "'"),
				/* One member number is one member: it is the address of a profile and
				   it is never handed out twice (PDL P8). */
				Violation.of("competitor_member_number_unique",
						competitorRow("'" + PROBE_MEMBER + "'", "'00112233445566aa'")),
				/* And one referral code is one member, for the sharper reason: two
				   members sharing a code would be two people one link credits. */
				Violation.of("competitor_referral_code_unique",
						competitorRow("'000903'", "'aaaabbbbccccdddd'")),
				Violation.of("competitor_place_fk", "insert into competitor (" + COMPETITOR_COLUMNS + ") values ("
						+ "'000903', 'Probni', 'Clan', 'M', 1990, (select max(id) + 1 from place), null, null,"
						+ " 2027, false, true, 'payment', '00112233445566aa', null, '', false, 'none')"),
				Violation.of("competitor_country_fk", "insert into competitor (" + COMPETITOR_COLUMNS + ") values ("
						+ "'000903', 'Probni', 'Clan', 'M', 1990, null, 'Zaselak',"
						+ " (select max(id) + 1 from country), 2027, false, true, 'payment', '00112233445566aa',"
						+ " null, '', false, 'none')"),
				/* A member brought by a member who is not there. Minus one rather
				   than one past the highest id, because one past the highest is the
				   id this very row is about to be given and the failure would then
				   name the check that refuses a member who brought himself. */
				Violation.of("competitor_referred_by_fk", competitor("'000903', 'Probni', 'Clan', 'M', 1990, "
						+ A_TOWN + ", null, null, 2027, false, true, 'payment', '00112233445566aa',"
						+ " -1, '', false, 'none'")),

				/* Six digits, because the address of a profile is built out of the
				   number and a number of another length is an address that does not
				   sort beside the others. */
				Violation.of("competitor_member_number_shape",
						competitorRow("'12345'", "'00112233445566aa'")),
				Violation.of("competitor_member_number_shape",
						competitorRow("'00090A'", "'00112233445566aa'")),
				Violation.of("competitor_first_name_not_blank", competitor("'000903', '   ', 'Clan', 'M', 1990, "
						+ A_TOWN + ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
						+ " '', false, 'none'")),
				Violation.of("competitor_last_name_not_blank", competitor("'000903', 'Probni', '   ', 'M', 1990, "
						+ A_TOWN + ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
						+ " '', false, 'none'")),
				/* Two letters and nothing else. Not a third word: the portal reads M
				   and F everywhere, and a lowercase m is the same member written twice
				   as far as any tally by gender is concerned. */
				Violation.of("competitor_gender_known", competitor("'000903', 'Probni', 'Clan', 'X', 1990, "
						+ A_TOWN + ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
						+ " '', false, 'none'")),
				Violation.of("competitor_gender_known", competitor("'000903', 'Probni', 'Clan', 'm', 1990, "
						+ A_TOWN + ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
						+ " '', false, 'none'")),
				Violation.of("competitor_membership_basis_known",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, false, true, 'honorary', '00112233445566aa', null,"
								+ " '', false, 'none'")),
				/* Three values and no fourth. A fourth would be a promise the profile
				   cannot keep, and the empty string is the shape a form sends when
				   nobody chose. */
				Violation.of("competitor_birthday_shown_known",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
								+ " '', false, 'day'")),
				Violation.of("competitor_birthday_shown_known",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
								+ " '', false, ''")),
				/* Sixteen lowercase hexadecimal characters. The member number is what
				   the link used to carry and is exactly what it must not be again. */
				Violation.of("competitor_referral_code_shape",
						competitorRow("'000903'", "'000903'")),
				Violation.of("competitor_referral_code_shape",
						competitorRow("'000903'", "'AABBCCDDEEFF0011'")),

				/* Both halves of "a town is from the codebook or it is typed": neither
				   is a member from nowhere, and both is a member in two towns. */
				Violation.of("competitor_town_is_from_the_codebook_or_typed",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, null, null, null,"
								+ " 2027, false, true, 'payment', '00112233445566aa', null, '', false, 'none'")),
				Violation.of("competitor_town_is_from_the_codebook_or_typed",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN + ", 'Zaselak', " + A_COUNTRY
								+ ", 2027, false, true, 'payment', '00112233445566aa', null, '', false, 'none'")),
				/* And both halves of "a typed town brings its own country": a typed
				   town with no country is a member whose country nothing can answer
				   for, and a codebook town with one is the second home this split was
				   made to avoid. */
				Violation.of("competitor_typed_town_names_its_country",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, null, 'Zaselak', null,"
								+ " 2027, false, true, 'payment', '00112233445566aa', null, '', false, 'none'")),
				Violation.of("competitor_typed_town_names_its_country",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN + ", null, " + A_COUNTRY
								+ ", 2027, false, true, 'payment', '00112233445566aa', null, '', false, 'none'")),
				Violation.of("competitor_city_not_blank",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, null, '   ', " + A_COUNTRY
								+ ", 2027, false, true, 'payment', '00112233445566aa', null, '', false, 'none'")),
				/* Nobody brought himself. Not a joke: an empty value read as
				   "everybody" has already once let every member of this portal read
				   somebody else's news as his own. */
				Violation.of("competitor_not_referred_by_itself",
						"insert into competitor (id, " + COMPETITOR_COLUMNS + ") select 900001, '000903', 'Probni',"
								+ " 'Clan', 'M', 1990, place_id, null, null, 2027, false, true, 'payment',"
								+ " '00112233445566aa', 900001, '', false, 'none' from competitor"
								+ " where member_number = '" + PROBE_MEMBER + "'"),

				Violation.notNull("competitor_id_not_null", "id",
						"insert into competitor (id, " + COMPETITOR_COLUMNS + ") values (null, '000903', 'Probni',"
								+ " 'Clan', 'M', 1990, " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
								+ " '00112233445566aa', null, '', false, 'none')"),
				Violation.notNull("competitor_member_number_not_null", "member_number",
						competitorRow("null", "'00112233445566aa'")),
				Violation.notNull("competitor_first_name_not_null", "first_name",
						competitor("'000903', null, 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
								+ " '', false, 'none'")),
				Violation.notNull("competitor_last_name_not_null", "last_name",
						competitor("'000903', 'Probni', null, 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
								+ " '', false, 'none'")),
				Violation.notNull("competitor_gender_not_null", "gender",
						competitor("'000903', 'Probni', 'Clan', null, 1990, " + A_TOWN
								+ ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
								+ " '', false, 'none'")),
				Violation.notNull("competitor_birth_year_not_null", "birth_year",
						competitor("'000903', 'Probni', 'Clan', 'M', null, " + A_TOWN
								+ ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
								+ " '', false, 'none'")),
				Violation.notNull("competitor_first_season_not_null", "first_season",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, null, false, true, 'payment', '00112233445566aa', null,"
								+ " '', false, 'none'")),
				Violation.notNull("competitor_first_season_2027_not_null", "first_season_2027",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, null, true, 'payment', '00112233445566aa', null,"
								+ " '', false, 'none'")),
				Violation.notNull("competitor_active_not_null", "active",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, false, null, 'payment', '00112233445566aa', null,"
								+ " '', false, 'none'")),
				Violation.notNull("competitor_membership_basis_not_null", "membership_basis",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, false, true, null, '00112233445566aa', null,"
								+ " '', false, 'none'")),
				Violation.notNull("competitor_referral_code_not_null", "referral_code",
						competitorRow("'000903'", "null")),
				Violation.notNull("competitor_bio_not_null", "bio",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
								+ " null, false, 'none'")),
				Violation.notNull("competitor_profile_hidden_not_null", "profile_hidden",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
								+ " '', null, 'none'")),
				Violation.notNull("competitor_birthday_shown_not_null", "birthday_shown",
						competitor("'000903', 'Probni', 'Clan', 'M', 1990, " + A_TOWN
								+ ", null, null, 2027, false, true, 'payment', '00112233445566aa', null,"
								+ " '', false, null")),

				// -------------------------------------------------------------- btl_event
				Violation.of("btl_event_pk",
						"insert into btl_event (id, " + EVENT_COLUMNS + ") select id, 'treca-proba-2027',"
								+ " 'Treca proba', date '2027-05-05', place_id, null, null, 'race', false, '', '',"
								+ " null from btl_event where slug = '" + PROBE_SLUG + "'"),
				/* One address is one event, which is O7 and which is what makes
				   Result's link to an event a link at all. */
				Violation.of("btl_event_slug_unique", event("'" + PROBE_SLUG + "'")),
				Violation.of("btl_event_place_fk", "insert into btl_event (" + EVENT_COLUMNS + ") values ("
						+ "'treca-proba-2027', 'Treca proba', date '2027-05-05', (select max(id) + 1 from place),"
						+ " null, null, 'race', false, '', '', null)"),
				Violation.of("btl_event_country_fk", "insert into btl_event (" + EVENT_COLUMNS + ") values ("
						+ "'treca-proba-2027', 'Treca proba', date '2027-05-05', null, 'Zaselak',"
						+ " (select max(id) + 1 from country), 'race', false, '', '', null)"),
				/* Copied from an event that is not there, and minus one for the same
				   reason the member above carries it. */
				Violation.of("btl_event_copied_from_fk", "insert into btl_event (" + EVENT_COLUMNS + ") values ("
						+ "'treca-proba-2027', 'Treca proba', date '2027-05-05', " + A_TOWN + ", null, null,"
						+ " 'race', false, '', '', -1)"),

				/* Four ways to write an address that would be a second address for the
				   same event: capitals, a mark above a letter, a space, and a hyphen
				   with nothing on one side of it. */
				Violation.of("btl_event_slug_shape", event("'Treca-Proba-2027'")),
				Violation.of("btl_event_slug_shape", event("'trecá-proba-2027'")),
				Violation.of("btl_event_slug_shape", event("'treca proba 2027'")),
				Violation.of("btl_event_slug_shape", event("'treca-proba-'")),
				Violation.of("btl_event_name_not_blank", "insert into btl_event (" + EVENT_COLUMNS + ") values ("
						+ "'treca-proba-2027', '   ', date '2027-05-05', " + A_TOWN
						+ ", null, null, 'race', false, '', '', null)"),
				Violation.of("btl_event_kind_known", "insert into btl_event (" + EVENT_COLUMNS + ") values ("
						+ "'treca-proba-2027', 'Treca proba', date '2027-05-05', " + A_TOWN
						+ ", null, null, 'party', false, '', '', null)"),
				/* The shape the form asks for, and the two ways round it: no scheme at
				   all, and a space inside. */
				Violation.of("btl_event_link_shape", eventWithLink("'primer.rs/trka'")),
				Violation.of("btl_event_link_shape", eventWithLink("'https://primer.rs/dve reci'")),
				Violation.of("btl_event_town_is_from_the_codebook_or_typed",
						"insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', 'Treca proba',"
								+ " date '2027-05-05', null, null, null, 'race', false, '', '', null)"),
				Violation.of("btl_event_town_is_from_the_codebook_or_typed",
						"insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', 'Treca proba',"
								+ " date '2027-05-05', " + A_TOWN + ", 'Zaselak', " + A_COUNTRY
								+ ", 'race', false, '', '', null)"),
				Violation.of("btl_event_typed_town_names_its_country",
						"insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', 'Treca proba',"
								+ " date '2027-05-05', null, 'Zaselak', null, 'race', false, '', '', null)"),
				Violation.of("btl_event_typed_town_names_its_country",
						"insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', 'Treca proba',"
								+ " date '2027-05-05', " + A_TOWN + ", null, " + A_COUNTRY
								+ ", 'race', false, '', '', null)"),
				Violation.of("btl_event_city_not_blank",
						"insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', 'Treca proba',"
								+ " date '2027-05-05', null, '   ', " + A_COUNTRY + ", 'race', false, '', '', null)"),
				/* An event copied from itself is a chain of editions that never ends,
				   and reading it backwards is what the link is for. */
				Violation.of("btl_event_not_copied_from_itself",
						"insert into btl_event (id, " + EVENT_COLUMNS + ") values (900001, 'treca-proba-2027',"
								+ " 'Treca proba', date '2027-05-05', " + A_TOWN
								+ ", null, null, 'race', false, '', '', 900001)"),

				Violation.notNull("btl_event_id_not_null", "id",
						"insert into btl_event (id, " + EVENT_COLUMNS + ") values (null, 'treca-proba-2027',"
								+ " 'Treca proba', date '2027-05-05', " + A_TOWN
								+ ", null, null, 'race', false, '', '', null)"),
				Violation.notNull("btl_event_slug_not_null", "slug", event("null")),
				Violation.notNull("btl_event_name_not_null", "name",
						"insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', null,"
								+ " date '2027-05-05', " + A_TOWN + ", null, null, 'race', false, '', '', null)"),
				Violation.notNull("btl_event_date_not_null", "date",
						"insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', 'Treca proba',"
								+ " null, " + A_TOWN + ", null, null, 'race', false, '', '', null)"),
				Violation.notNull("btl_event_kind_not_null", "kind",
						"insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', 'Treca proba',"
								+ " date '2027-05-05', " + A_TOWN + ", null, null, null, false, '', '', null)"),
				Violation.notNull("btl_event_featured_not_null", "featured",
						"insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', 'Treca proba',"
								+ " date '2027-05-05', " + A_TOWN + ", null, null, 'race', null, '', '', null)"),
				Violation.notNull("btl_event_description_not_null", "description",
						"insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', 'Treca proba',"
								+ " date '2027-05-05', " + A_TOWN + ", null, null, 'race', false, null, '', null)"),
				Violation.notNull("btl_event_link_not_null", "link", eventWithLink("null")),

				// ------------------------------------------------------------------- race
				/* The same id on another day, so the key is the only reason: the same
				   id on the same day would break race_day_unique as well and the
				   failure could name either. */
				Violation.of("race_pk",
						"insert into race (id, " + RACE_COLUMNS + ") select id, event_id, 'Treca probna trka',"
								+ " false, date '2027-04-04', 'length', 0, 5.00, 0, 0 from race"
								+ " where name = 'Probna trka'"),
				Violation.of("race_event_fk",
						race("(select max(id) + 1 from btl_event), 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'length', 0, 5.00, 0, 0")),
				Violation.of("race_name_not_blank",
						race(PROBE_EVENT + ", '   ', false, " + PROBE_RACE_DAY + ", 'length', 0, 5.00, 0, 0")),
				Violation.of("race_kind_known",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'relay', 0, 5.00, 0, 0")),
				/* Negative on a free race, where neither biconditional has anything to
				   say about it: a length of minus one is not more than zero either
				   way, so only this constraint can be the reason. */
				Violation.of("race_limit_seconds_not_negative",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'length', -1, 5.00, 0, 0")),
				/* Both directions: a race of a length that carries a limit, and a
				   timed race that carries none. Half of one is a different fault from
				   the other half. */
				Violation.of("race_only_a_timed_race_has_a_limit",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'length', 86400, 5.00, 0, 0")),
				Violation.of("race_only_a_timed_race_has_a_limit",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'time', 0, 0.00, 0, 0")),
				Violation.of("race_distance_not_negative",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'free', 0, -1.00, 0, 0")),
				Violation.of("race_only_a_length_race_fixes_a_distance",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'free', 0, 5.00, 0, 0")),
				Violation.of("race_only_a_length_race_fixes_a_distance",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'length', 0, 0.00, 0, 0")),
				Violation.of("race_ascent_not_negative",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'length', 0, 5.00, -1, 0")),
				Violation.of("race_descent_not_negative",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'length', 0, 5.00, 0, -1")),

				Violation.notNull("race_id_not_null", "id",
						"insert into race (id, " + RACE_COLUMNS + ") values (null, " + PROBE_EVENT
								+ ", 'Treca probna trka', false, " + PROBE_RACE_DAY + ", 'length', 0, 5.00, 0, 0)"),
				Violation.notNull("race_event_id_not_null", "event_id",
						race("null, 'Treca probna trka', false, " + PROBE_RACE_DAY + ", 'length', 0, 5.00, 0, 0")),
				Violation.notNull("race_name_not_null", "name",
						race(PROBE_EVENT + ", null, false, " + PROBE_RACE_DAY + ", 'length', 0, 5.00, 0, 0")),
				Violation.notNull("race_renamed_not_null", "renamed",
						race(PROBE_EVENT + ", 'Treca probna trka', null, " + PROBE_RACE_DAY
								+ ", 'length', 0, 5.00, 0, 0")),
				Violation.notNull("race_date_not_null", "date",
						race(PROBE_EVENT + ", 'Treca probna trka', false, null, 'length', 0, 5.00, 0, 0")),
				Violation.notNull("race_kind_not_null", "kind",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", null, 0, 5.00, 0, 0")),
				Violation.notNull("race_limit_seconds_not_null", "limit_seconds",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'length', null, 5.00, 0, 0")),
				Violation.notNull("race_distance_km_not_null", "distance_km",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'length', 0, null, 0, 0")),
				Violation.notNull("race_ascent_m_not_null", "ascent_m",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'length', 0, 5.00, null, 0")),
				Violation.notNull("race_descent_m_not_null", "descent_m",
						race(PROBE_EVENT + ", 'Treca probna trka', false, " + PROBE_RACE_DAY
								+ ", 'length', 0, 5.00, 0, null")),

				// ----------------------------------------------------------------- result
				Violation.of("result_pk",
						"insert into result (id, " + RESULT_COLUMNS + ") select id, competitor_id, race_id,"
								+ " race_date, distance_km, ascent_m, descent_m, seconds, points from result"),
				Violation.of("result_competitor_fk",
						result("(select max(id) + 1 from competitor), " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", 10.00, 100, 100, 3600, 12.34")),
				/* A result of no race, and a result whose day is not its race's day.
				   The second is the whole reason the reference is composite: without
				   it the day would be the hundred and sixty first copy that drifted. */
				Violation.of("result_race_fk",
						result(OTHER_COMPETITOR + ", (select max(id) + 1 from race), " + PROBE_RACE_DAY
								+ ", 10.00, 100, 100, 3600, 12.34")),
				Violation.of("result_race_fk",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", date '2027-04-04',"
								+ " 10.00, 100, 100, 3600, 12.34")),
				Violation.of("result_distance_positive",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", 0.00, 100, 100, 3600, 12.34")),
				Violation.of("result_ascent_not_negative",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", 10.00, -1, 100, 3600, 12.34")),
				Violation.of("result_descent_not_negative",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", 10.00, 100, -1, 3600, 12.34")),
				Violation.of("result_seconds_positive",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", 10.00, 100, 100, 0, 12.34")),
				/* Not negative and not "more than zero": five kilometres run out over
				   a full twenty four hours score four ten thousandths of a point,
				   which rounds to zero, and that result really happened. */
				Violation.of("result_points_not_negative",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", 10.00, 100, 100, 3600, -0.01")),

				Violation.notNull("result_id_not_null", "id",
						"insert into result (id, " + RESULT_COLUMNS + ") values (null, " + OTHER_COMPETITOR + ", "
								+ PROBE_RACE + ", " + PROBE_RACE_DAY + ", 10.00, 100, 100, 3600, 12.34)"),
				Violation.notNull("result_competitor_id_not_null", "competitor_id",
						result("null, " + PROBE_RACE + ", " + PROBE_RACE_DAY + ", 10.00, 100, 100, 3600, 12.34")),
				Violation.notNull("result_race_id_not_null", "race_id",
						result(OTHER_COMPETITOR + ", null, " + PROBE_RACE_DAY + ", 10.00, 100, 100, 3600, 12.34")),
				Violation.notNull("result_race_date_not_null", "race_date",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", null, 10.00, 100, 100, 3600, 12.34")),
				Violation.notNull("result_distance_km_not_null", "distance_km",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", null, 100, 100, 3600, 12.34")),
				Violation.notNull("result_ascent_m_not_null", "ascent_m",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", 10.00, null, 100, 3600, 12.34")),
				Violation.notNull("result_descent_m_not_null", "descent_m",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", 10.00, 100, null, 3600, 12.34")),
				Violation.notNull("result_seconds_not_null", "seconds",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", 10.00, 100, 100, null, 12.34")),
				Violation.notNull("result_points_not_null", "points",
						result(OTHER_COMPETITOR + ", " + PROBE_RACE + ", " + PROBE_RACE_DAY
								+ ", 10.00, 100, 100, 3600, null")),

				// -------------------------------------------------------------- attending
				Violation.of("attending_pk",
						"insert into attending (id, event_id, competitor_id) select id, event_id, competitor_id"
								+ " from attending"),
				Violation.of("attending_event_fk", attending("(select max(id) + 1 from btl_event), "
						+ OTHER_COMPETITOR)),
				Violation.of("attending_competitor_fk", attending(PROBE_EVENT
						+ ", (select max(id) + 1 from competitor)")),
				/* Saying it twice is the same intention. */
				Violation.of("attending_said_once", attending(PROBE_EVENT + ", " + PROBE_COMPETITOR)),
				Violation.notNull("attending_id_not_null", "id",
						"insert into attending (id, event_id, competitor_id) values (null, " + PROBE_EVENT + ", "
								+ OTHER_COMPETITOR + ")"),
				Violation.notNull("attending_event_id_not_null", "event_id", attending("null, " + OTHER_COMPETITOR)),
				Violation.notNull("attending_competitor_id_not_null", "competitor_id",
						attending(PROBE_EVENT + ", null")),

				// ---------------------------------------------------------- event_comment
				Violation.of("event_comment_pk",
						"insert into event_comment (id, " + COMMENT_COLUMNS + ") select id, event_id, competitor_id,"
								+ " who, published_at, rating_organisation, rating_value, rating_ambience, body"
								+ " from event_comment"),
				Violation.of("event_comment_event_fk", comment("(select max(id) + 1 from btl_event), "
						+ OTHER_COMPETITOR + ", 'Druga Proba', " + AN_INSTANT + ", 5, 4, 5, ''")),
				Violation.of("event_comment_competitor_fk", comment(PROBE_EVENT
						+ ", (select max(id) + 1 from competitor), 'Druga Proba', " + AN_INSTANT + ", 5, 4, 5, ''")),
				/* The tombstone may not be blank: it is the whole of what is left of
				   an author who has no profile to read a name off. */
				Violation.of("event_comment_who_not_blank", comment(PROBE_EVENT + ", " + OTHER_COMPETITOR
						+ ", '   ', " + AN_INSTANT + ", 5, 4, 5, ''")),
				/* Both ends of each of the three marks. Zero is a mark nobody gave and
				   is legitimate; minus one and six are not marks at all. */
				Violation.of("event_comment_organisation_in_scale", comment(PROBE_EVENT + ", " + OTHER_COMPETITOR
						+ ", 'Druga Proba', " + AN_INSTANT + ", -1, 4, 5, ''")),
				Violation.of("event_comment_organisation_in_scale", comment(PROBE_EVENT + ", " + OTHER_COMPETITOR
						+ ", 'Druga Proba', " + AN_INSTANT + ", 6, 4, 5, ''")),
				Violation.of("event_comment_value_in_scale", comment(PROBE_EVENT + ", " + OTHER_COMPETITOR
						+ ", 'Druga Proba', " + AN_INSTANT + ", 5, -1, 5, ''")),
				Violation.of("event_comment_value_in_scale", comment(PROBE_EVENT + ", " + OTHER_COMPETITOR
						+ ", 'Druga Proba', " + AN_INSTANT + ", 5, 6, 5, ''")),
				Violation.of("event_comment_ambience_in_scale", comment(PROBE_EVENT + ", " + OTHER_COMPETITOR
						+ ", 'Druga Proba', " + AN_INSTANT + ", 5, 4, -1, ''")),
				Violation.of("event_comment_ambience_in_scale", comment(PROBE_EVENT + ", " + OTHER_COMPETITOR
						+ ", 'Druga Proba', " + AN_INSTANT + ", 5, 4, 6, ''")),

				Violation.notNull("event_comment_id_not_null", "id",
						"insert into event_comment (id, " + COMMENT_COLUMNS + ") values (null, " + PROBE_EVENT + ", "
								+ OTHER_COMPETITOR + ", 'Druga Proba', " + AN_INSTANT + ", 5, 4, 5, '')"),
				Violation.notNull("event_comment_event_id_not_null", "event_id", comment("null, " + OTHER_COMPETITOR
						+ ", 'Druga Proba', " + AN_INSTANT + ", 5, 4, 5, ''")),
				Violation.notNull("event_comment_who_not_null", "who", comment(PROBE_EVENT + ", " + OTHER_COMPETITOR
						+ ", null, " + AN_INSTANT + ", 5, 4, 5, ''")),
				Violation.notNull("event_comment_published_at_not_null", "published_at",
						comment(PROBE_EVENT + ", " + OTHER_COMPETITOR + ", 'Druga Proba', null, 5, 4, 5, ''")),
				Violation.notNull("event_comment_rating_organisation_not_null", "rating_organisation",
						comment(PROBE_EVENT + ", " + OTHER_COMPETITOR + ", 'Druga Proba', " + AN_INSTANT
								+ ", null, 4, 5, ''")),
				Violation.notNull("event_comment_rating_value_not_null", "rating_value",
						comment(PROBE_EVENT + ", " + OTHER_COMPETITOR + ", 'Druga Proba', " + AN_INSTANT
								+ ", 5, null, 5, ''")),
				Violation.notNull("event_comment_rating_ambience_not_null", "rating_ambience",
						comment(PROBE_EVENT + ", " + OTHER_COMPETITOR + ", 'Druga Proba', " + AN_INSTANT
								+ ", 5, 4, null, ''")),
				Violation.notNull("event_comment_body_not_null", "body",
						comment(PROBE_EVENT + ", " + OTHER_COMPETITOR + ", 'Druga Proba', " + AN_INSTANT
								+ ", 5, 4, 5, null")));
	}

	/** A member who differs from the good one in nothing but the two fields the
	 *  case is about. */
	private static String competitorRow(String memberNumber, String referralCode) {
		return competitor(memberNumber + ", 'Probni', 'Clan', 'M', 1990, " + A_TOWN
				+ ", null, null, 2027, false, true, 'payment', " + referralCode + ", null, '', false, 'none'");
	}

	private static String competitor(String values) {
		return "insert into competitor (" + COMPETITOR_COLUMNS + ") values (" + values + ")";
	}

	/** An event that differs from the good one in nothing but its address. */
	private static String event(String slug) {
		return "insert into btl_event (" + EVENT_COLUMNS + ") values (" + slug + ", 'Treca proba',"
				+ " date '2027-05-05', " + A_TOWN + ", null, null, 'race', false, '', '', null)";
	}

	/** And one that differs in nothing but its link. */
	private static String eventWithLink(String link) {
		return "insert into btl_event (" + EVENT_COLUMNS + ") values ('treca-proba-2027', 'Treca proba',"
				+ " date '2027-05-05', " + A_TOWN + ", null, null, 'race', false, '', " + link + ", null)";
	}

	private static String race(String values) {
		return "insert into race (" + RACE_COLUMNS + ") values (" + values + ")";
	}

	private static String result(String values) {
		return "insert into result (" + RESULT_COLUMNS + ") values (" + values + ")";
	}

	private static String attending(String values) {
		return "insert into attending (event_id, competitor_id) values (" + values + ")";
	}

	private static String comment(String values) {
		return "insert into event_comment (" + COMMENT_COLUMNS + ") values (" + values + ")";
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/**
	 * The floor under the list above, read out of the database rather than
	 * remembered.
	 *
	 * A hand written list is not the fault; a hand written list with nothing
	 * underneath it is. This asks PostgreSQL what the six tables actually carry,
	 * so neither side can drift: a constraint added to the migration without a
	 * row above fails here, and a row above naming one that has been dropped
	 * fails here too.
	 *
	 * Both catalogues, for the reason AccountConstraintsTest reads both: a rule
	 * written as a unique INDEX rather than as a constraint would otherwise be
	 * droppable without a word. V7 writes none, and this is what says so, since
	 * an index that appeared would land in {@code declared} with nothing covering
	 * it. Unique indexes that back a constraint are left out and not listed
	 * twice, because they answer under the constraint's name.
	 *
	 * {@code regclass} rather than a name compared against {@code pg_class}: the
	 * cast resolves the tables the same way a query in this session resolves
	 * them, so the answer cannot come from a table of the same name in another
	 * schema.
	 */
	@Test
	void everyConstraintOnTheSixTablesHasARowThatBreaksIt() {
		String tables = TABLES.stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));
		String relations = " = any (array[" + tables + "]::regclass[])";

		List<String> declared = db
				.sql("select con.conname from pg_constraint con where con.conrelid" + relations
						+ " union all "
						+ "select index.relname from pg_index idx join pg_class index on index.oid = idx.indexrelid"
						+ " where idx.indrelid" + relations + " and idx.indisunique"
						+ " and not exists (select 1 from pg_constraint own where own.conindid = idx.indexrelid)")
				.query(String.class)
				.list();

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());
		Set<String> answeredFor = new HashSet<>(covered);
		answeredFor.addAll(KEYS_THAT_ONLY_EXIST_AS_A_TARGET);

		assertThat(declared).isNotEmpty();
		assertThat(answeredFor).containsExactlyInAnyOrderElementsOf(declared);

		/* And the exemption is one key rather than a place to put anything that
		   turns out to be awkward: a constraint named here and also given a row
		   would make the set above pass while saying nothing. */
		assertThat(covered).doesNotContainAnyElementsOf(KEYS_THAT_ONLY_EXIST_AS_A_TARGET);
	}

	/**
	 * And a row that breaks nothing goes in.
	 *
	 * Without this every constraint above could be replaced by one that rejects
	 * everything and the whole file would still pass. It is the mutation that
	 * would otherwise be answered by turning a check off.
	 */
	@ParameterizedTest
	@ValueSource(strings = { GOOD_COMPETITOR, GOOD_EVENT, GOOD_RACE, GOOD_RESULT, GOOD_RESULT_THAT_SCORES_NOTHING,
			GOOD_ATTENDING, GOOD_COMMENT })
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isEqualTo(1);
	}
}
