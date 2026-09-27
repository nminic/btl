package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V35 DOES TO A DATABASE THAT ALREADY HAS ROWS, run against a real database.
 *
 * <p><b>Why this exists, and it is not a hypothetical.</b> V35 merged on 27.09.2026 and took QA
 * down the same day, restarting in a loop on
 * {@code ERROR: check constraint "membership_free_of_the_fee_says_who" of relation "membership"
 * is violated by some row}. The gate had been green through a full review, on CI and locally,
 * and could not have been otherwise: Testcontainers hands every run an EMPTY database and every
 * case writes the rows it needs, so each one satisfies the new constraint by construction. <b>A
 * constraint that cannot survive the rows already there is invisible to any suite that makes its
 * own rows.</b> That is a class and not an instance, which is why it gets a test rather than only
 * a fix.
 *
 * <p><b>How the two halves are made.</b> The three columns V35 adds are dropped as a fixture, the
 * rows a real database carries are written, and then THE MIGRATION ITSELF is executed - the file
 * Flyway resolved and applied, not a copy of its statements ({@link DatabaseTest#migrationSql}).
 * Everything happens inside the test's transaction and is rolled back. The shape is
 * {@link LeagueRacesCarriedOverTest}'s, where it was written, by way of
 * {@link MembershipCarriedOverTest}, which does the same thing to the same table for V22.
 *
 * <p><b>The fixture drops COLUMNS and names no constraint, and that is the whole reason it can be
 * trusted.</b> V35 adds three columns, four checks, a foreign key and an index; a fixture that
 * listed those six by name would be a list with nothing under it, going stale the day a seventh
 * is added. {@code drop column ... cascade} asks PostgreSQL, which computes dependents and cannot
 * forget one. Measured: it leaves {@code membership} at exactly its V34 shape, four columns, nine
 * constraints and three indexes.
 *
 * <p><b>And the floor under the fixture is BEHAVIOURAL, so it needs no catalogue query at all:</b>
 * the legacy exemption below names nobody, so ANY surviving constraint of V35 would refuse it. The
 * insert succeeding is itself the proof that the undo was complete. A fixture that removed too
 * little fails while writing its rows, not quietly afterwards.
 *
 * <p><b>Which cases use the fixture and which must not.</b> Two questions are about the migration
 * meeting old rows, and they undo and re-run it. Two are about the schema THIS REPOSITORY SHIPS -
 * whether the right constraints are validated and whether any other is not - and those must see
 * the schema as Flyway applied it, so they never touch the fixture. Undoing V35 in a
 * {@code @BeforeEach} would have left them measuring a schema this test had taken apart.
 */
class TheTrailArrivesOverMembershipsAlreadyThereTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/**
	 * The two constraints of V35 that a database with rows in it cannot validate, and the reason
	 * each is here rather than a count.
	 *
	 * <p>Named once and used by three cases: what must be {@code not valid} on the table, what the
	 * rest of the table must NOT be, and what nothing else in the whole schema may be.
	 */
	private static final Set<String> NOT_VALIDATED_ON_PURPOSE = Set.of(
			/* One membership predates these columns: `feeExempt`, no payment, and no trail, because
			   on the day it was written there was nowhere to put one. Nobody granted that exemption
			   on the portal, so there is no name that could be written into it truthfully. */
			"membership_free_of_the_fee_says_who",
			/* And the same row names no moment either, so the pair goes together: validating either
			   one alone refuses it. */
			"membership_free_of_the_fee_says_when");

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";
	private static final String THE_MODERATOR = "(select id from account where email = 'blagajnik@primer.rs')";
	private static final String AN_INSTANT = "timestamptz '2026-10-02 09:00:00+00'";

	/**
	 * The name a new exemption is entered under, and it is DELIBERATELY NOT THE MODERATOR'S NAME.
	 *
	 * <p>In the portal these two are the same string, because {@code MembershipWriteApi} writes the
	 * account's own name into the row. That is exactly why a test must not: with the same value in
	 * both places, an assertion about {@code membership.decided_by_name} is equally satisfied by a
	 * query that joined to {@code account} and read the name from there, and the column that
	 * outlives the account would stop being measured at all. The account is 'Probni Probic'; this
	 * is not.
	 */
	private static final String THE_NAME_ON_THE_ROW = "'Upisao Neko Drugi'";

	private static final String EXEMPT_LONG_AGO = "(select id from competitor where member_number = '001000')";
	private static final String A_PAYER = "(select id from competitor where member_number = '001001')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/**
	 * EVERYTHING V35 ADDS, TAKEN AWAY BY NAMING ONLY THE THREE COLUMNS IT ADDS.
	 *
	 * <p>{@code cascade} is doing the work a written list would otherwise do badly: the four checks,
	 * the foreign key and the index all hang off these columns, and PostgreSQL knows that without
	 * being told. The three names here are not a list of consequences, they are the change itself.
	 */
	private void whatV35Adds() {
		jdbc.execute("alter table membership"
				+ " drop column decided_by cascade,"
				+ " drop column decided_by_name cascade,"
				+ " drop column decided_at cascade");
	}

	private void competitor(String number, String last, String code, String basis) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true, ?, ?, null,"
						+ " '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, last, basis, code).update();
	}

	/**
	 * WHAT A PORTAL HELD BEFORE V35 EVER RAN, and every row of it is here for a reason rather than
	 * for company.
	 *
	 * <p><b>Two memberships on the two different bases</b>, because the exemption must not be the
	 * only row of its kind: a migration that emptied the table, or a claim satisfied by whatever
	 * row happened to be first, would read the same as a correct one against a table of one.
	 *
	 * <p><b>A membership held on a payment carries all three trail columns empty</b>, which is the
	 * side {@code membership_on_a_payment_names_no_decision} asks for. It is in the fixture
	 * precisely so that constraint is under pressure while the migration runs: the answer to "which
	 * of the six statements fails on old rows" has to be measured against both bases, not inferred
	 * from the one error QA happened to print first.
	 *
	 * <p><b>A competitor no account names, and an account that names no competitor.</b> The second
	 * is the ordinary case for a moderator (V23, owner 14.09.2026) and it is also the account the
	 * trail below points at, so the foreign key V35 adds is measured against a real target rather
	 * than against null alone.
	 */
	@BeforeEach
	void theRowsARealDatabaseCarries() {
		/* The moderator: an account that names no competitor, which is the ordinary case, and the
		   one a new exemption's trail points at. */
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
				+ " 'Probic', 'blagajnik@primer.rs', (select id from role where code = 'moderator'))")
				.update();

		competitor("001000", "Oslobodjen", "00112233445566b1", "feeExempt");
		competitor("001001", "Platisa", "00112233445566b2", "payment");
		/* A third member nobody's account names and nobody's membership mentions, so neither the
		   competitor table nor the membership table is a list of exactly the rows under test. */
		competitor("001002", "Bezveze", "00112233445566b3", "payment");

		/* And an account that DOES name a competitor, so `account.competitor_id` is not uniformly
		   empty in this fixture either. */
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Drugi', 'Probic', 'clan@primer.rs',"
						+ " (select id from role where code = 'competitor'), " + A_PAYER + ")")
				.update();

		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount,"
						+ " currency, fee, method, state, recorded_at, recorded_by, recorded_by_name)"
						+ " values (" + A_PAYER + ", 2027, '20271001', " + A_PRICE_ROW + ", 4200.00,"
						+ " 'RSD', 0, 'ips', 'recorded', " + AN_INSTANT + ", " + THE_MODERATOR
						+ ", 'Probni Probic')")
				.update();
	}

	/** The memberships that were standing before V35, written after the fixture has undone it. */
	private void theMembershipsThatWereAlreadyThere() {
		/* THE ROW THAT TOOK QA DOWN: an exemption entered before the trail existed. This insert
		   succeeding is the floor under `whatV35Adds` - any surviving constraint refuses it. */
		db.sql("insert into membership (competitor_id, season, basis, payment_id) values ("
				+ EXEMPT_LONG_AGO + ", 2027, 'feeExempt', null)").update();

		db.sql("insert into membership (competitor_id, season, basis, payment_id) values ("
				+ A_PAYER + ", 2027, 'payment', (select id from payment where reference = '20271001'))")
				.update();
	}

	/**
	 * Who is a member of what, read WITHOUT the trail columns, because before the migration runs
	 * they do not exist.
	 *
	 * <p>Two readers rather than one with a flag: the floor before the migration and the claim after
	 * it are asking different questions of different schemas, and a single query that worked for
	 * both would have to avoid the columns the whole case is about.
	 */
	private List<String> membershipsBeforeTheTrailExists() {
		return db.sql("select c.member_number || ' ' || m.season || ' ' || m.basis from membership m"
						+ " join competitor c on c.id = m.competitor_id"
						+ " order by c.member_number, m.season")
				.query(String.class).list();
	}

	/** And afterwards, with what each row's trail says, which for an old row must be nothing. */
	private List<String> membershipsWithTheirTrail() {
		return db.sql("select c.member_number || ' ' || m.season || ' ' || m.basis || ' '"
						+ " || coalesce(m.decided_by_name, 'bez traga') from membership m"
						+ " join competitor c on c.id = m.competitor_id"
						+ " order by c.member_number, m.season")
				.query(String.class).list();
	}

	/**
	 * THE STATE A DATABASE IS IN THE MOMENT AFTER V35 REACHES IT: old rows standing, the trail
	 * columns freshly added around them.
	 *
	 * <p>The assertion in the middle is what makes everything built on this honest. The constraints
	 * the cases below put under pressure could in principle come from two places - Flyway's own
	 * application of V35 when the context started, or this re-run - and a case cannot tell those
	 * apart by looking at the constraint. It does not have to: the old exemption names nobody, so it
	 * can only be written while V35 is undone, and if the undo had left either check standing this
	 * insert would have been refused. The rows being here is therefore proof that the constraints
	 * that follow were added by the migration OVER them.
	 */
	private void v35ArrivesOverTheRowsAlreadyThere() {
		whatV35Adds();
		theMembershipsThatWereAlreadyThere();

		assertThat(membershipsBeforeTheTrailExists())
				.as("the old memberships are not standing, so whatever the migration does below it is"
						+ " not doing it over existing rows")
				.containsExactly("001000 2027 feeExempt", "001001 2027 payment");

		jdbc.execute(migrationSql("35"));
	}

	/** Whether a constraint on {@code membership} is validated, asked of the catalogue. */
	private Set<String> constraintsOnTheMembershipThatAreNotValidated() {
		return Set.copyOf(db.sql("select conname from pg_constraint"
						+ " where conrelid = 'membership'::regclass and not convalidated")
				.query(String.class).list());
	}

	/**
	 * V35 APPLIES OVER AN EXEMPTION THAT NAMES NOBODY, which is the whole point of the branch.
	 *
	 * <p>Both floors are in the case rather than in a comment about it. The columns must be GONE
	 * before the migration runs, or the migration is a no-op and its success says nothing; and the
	 * rows must be THERE, or it is being measured against the empty database that hid this in the
	 * first place. Either one missing and a broken V35 would pass here exactly as it passed the
	 * gate.
	 *
	 * <p>Putting {@code not valid} back on either constraint fails this case with the message QA
	 * printed, which is the mutation this was written from.
	 */
	@Test
	void theMigrationAppliesOverAnExemptionThatNamesNobody() {
		whatV35Adds();

		assertThat(db.sql("select column_name from information_schema.columns"
						+ " where table_name = 'membership'").query(String.class).list())
				.as("the columns V35 adds are still there, so running it below proves nothing")
				.doesNotContain("decided_by", "decided_by_name", "decided_at");

		theMembershipsThatWereAlreadyThere();

		assertThat(membershipsBeforeTheTrailExists())
				.as("the rows V35 has to survive are not in the table, so the migration below is"
						+ " being measured against the empty database that hid this")
				.containsExactly("001000 2027 feeExempt", "001001 2027 payment");

		jdbc.execute(migrationSql("35"));

		assertThat(membershipsWithTheirTrail())
				.as("V35 did not leave the memberships that were already there exactly as they were")
				.containsExactly("001000 2027 feeExempt bez traga", "001001 2027 payment bez traga");
	}

	/**
	 * AND A NEW EXEMPTION STILL HAS TO SAY WHO, in that same database, which is the half
	 * {@code not valid} had to keep.
	 *
	 * <p>This is the case that stops the obvious wrong fix. Deleting both constraints from V35
	 * altogether makes the case above pass - the migration applies over the old rows beautifully -
	 * and the owner's decision of 27.09.2026 quietly stops existing. So the claim is not "the
	 * migration got through" but "the migration got through AND still refuses what it was written
	 * to refuse", measured in one database with the old row sitting in it.
	 *
	 * <p>The accepted row is not the assertion's only half: without it, a constraint that refused
	 * every exemption whatsoever would pass the two refusals and leave the portal unable to free
	 * anybody of the fee.
	 */
	/**
	 * Half a trail, and which constraint has to be the one that refuses it.
	 *
	 * @param missing   what the row fails to say, which is what a failure is named after
	 * @param values    the trail, as the three columns after the four of V22
	 * @param refusedBy the constraint that must be the one to refuse it, and the ONLY one
	 */
	record HalfATrail(String missing, String values, String refusedBy) {

		@Override
		public String toString() {
			return missing;
		}
	}

	/**
	 * <b>Each row leaves out exactly ONE half, and that is the whole design rather than tidiness.</b>
	 * A row missing both the name and the moment breaks two constraints, and PostgreSQL reports
	 * whichever it checked first - measured on this schema: {@code says_when} - so one such row
	 * would assert whichever it happened to name and say nothing about the other.
	 */
	static List<HalfATrail> halfATrails() {
		return List.of(
				new HalfATrail("it names the moment but nobody at all",
						"null, null, " + AN_INSTANT, "membership_free_of_the_fee_says_who"),
				new HalfATrail("it names who but no moment",
						THE_MODERATOR + ", 'Probni Probic', null",
						"membership_free_of_the_fee_says_when"));
	}

	/**
	 * AND A NEW EXEMPTION STILL HAS TO SAY WHO AND WHEN, in that same database, which is the half
	 * {@code not valid} had to keep.
	 *
	 * <p>This is the case that stops the obvious wrong fix. Deleting both constraints from V35
	 * altogether makes {@link #theMigrationAppliesOverAnExemptionThatNamesNobody()} pass - the
	 * migration applies over the old rows beautifully - and the owner's decision of 27.09.2026
	 * quietly stops existing. So the claim is not "the migration got through" but "the migration got
	 * through AND still refuses what it was written to refuse", measured in one database with the old
	 * row sitting in it.
	 *
	 * <p>One case per row, because a refused statement aborts the transaction and everything after it
	 * comes back as {@code current transaction is aborted} rather than as the constraint's own name.
	 * That is the shape {@link MembershipConstraintsTest} uses, and it was measured here: written as
	 * two assertions in one method, the second one passed on the wrong exception entirely.
	 */
	@ParameterizedTest
	@MethodSource("halfATrails")
	void aNewExemptionWithHalfATrailIsStillRefusedBesideTheOldOneThatHasNone(HalfATrail half) {
		v35ArrivesOverTheRowsAlreadyThere();

		assertThatThrownBy(() -> db.sql("insert into membership (competitor_id, season, basis,"
						+ " payment_id, decided_by, decided_by_name, decided_at) values ("
						+ EXEMPT_LONG_AGO + ", 2028, 'feeExempt', null, " + half.values() + ")")
						.update())
				.as("an exemption entered now got in although %s, so the trail is optional after all"
						+ " and the owner's decision of 27.09.2026 is not in the schema", half.missing())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(half.refusedBy());
	}

	/**
	 * AND ONE THAT SAYS BOTH GOES IN, which is the other half of the same claim.
	 *
	 * <p>Without it, a constraint that refused every exemption whatsoever would satisfy both cases
	 * above and leave the portal unable to free anybody of the fee - and it would do that while
	 * looking stricter, which is the direction nobody checks.
	 */
	@Test
	void aNewExemptionThatSaysWhoAndWhenIsAcceptedBesideTheOldOneThatCannot() {
		v35ArrivesOverTheRowsAlreadyThere();

		assertThat(db.sql("insert into membership (competitor_id, season, basis, payment_id,"
						+ " decided_by, decided_by_name, decided_at) values (" + EXEMPT_LONG_AGO
						+ ", 2028, 'feeExempt', null, " + THE_MODERATOR + ", " + THE_NAME_ON_THE_ROW
						+ ", " + AN_INSTANT + ")").update())
				.as("an exemption that says who and when was refused too, so nobody can be freed of"
						+ " the fee at all")
				.isOne();

		assertThat(membershipsWithTheirTrail())
				.as("the new exemption did not land beside the old one, both of them readable, which"
						+ " is the state this whole branch is for")
				.containsExactly("001000 2027 feeExempt bez traga",
						"001000 2028 feeExempt Upisao Neko Drugi", "001001 2027 payment bez traga");
	}

	/**
	 * EXACTLY TWO CONSTRAINTS ON THIS TABLE ARE UNVALIDATED, AND THE REST ARE VALIDATED.
	 *
	 * <p>Measured against the schema Flyway applied, with no fixture: this is a question about what
	 * the repository ships. Both directions are the claim and neither says the other. Without the
	 * first, the pair could be validated again and QA would go back down; without the second,
	 * {@code not valid} could be sprinkled over the whole table - which is the cheap way to make
	 * any failing migration pass - and nothing would notice.
	 *
	 * <p>It is measured rather than reasoned that the other four statements of V35 need no such
	 * thing: the foreign key passes because {@code decided_by} is null on every old row and a null
	 * satisfies a key, {@code membership_on_a_payment_names_no_decision} passes because an old
	 * membership held on a payment carries these columns empty, and
	 * {@code membership_decided_by_name_not_blank} passes because null is not blank.
	 */
	@Test
	void exactlyTheTwoConstraintsThatCannotSurviveOldRowsAreUnvalidated() {
		assertThat(constraintsOnTheMembershipThatAreNotValidated())
				.as("the constraints on `membership` that are not validated are no longer exactly the"
						+ " two that an exemption predating the trail breaks")
				.isEqualTo(NOT_VALIDATED_ON_PURPOSE);
	}

	/**
	 * AND NOTHING ELSE IN THE WHOLE SCHEMA IS UNVALIDATED EITHER, which is the floor that makes
	 * this more than a note about one table.
	 *
	 * <p>{@code not valid} is the cheapest way to make any migration stop failing, and it works on
	 * every table. The question is therefore asked of {@code pg_constraint} over the whole schema
	 * rather than of {@code membership}, so the next migration that reaches for it has to come
	 * through here and say why, once, instead of waiting to be noticed.
	 *
	 * <p>Only CHECK constraints are counted, and that is a boundary rather than an oversight: a
	 * foreign key may also be {@code not valid}, and if one ever is, this case is where it will
	 * show up as a name nobody wrote down.
	 */
	@Test
	void everyUnvalidatedConstraintInTheSchemaIsOneOfTheTwoNamedHere() {
		List<String> unvalidated = db.sql("select con.conname from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and not con.convalidated"
						+ " order by con.conname")
				.query(String.class).list();

		assertThat(unvalidated)
				.as("a constraint somewhere in the schema is not validated and no decision here says"
						+ " why; `not valid` is how a migration is made to stop failing without"
						+ " anybody choosing that, so it is named once or it is not written")
				.containsExactlyInAnyOrderElementsOf(NOT_VALIDATED_ON_PURPOSE);
	}

	/**
	 * A CONSTRAINT THAT IS NOT VALIDATED IS STILL A CONSTRAINT THE FLOORS CAN SEE.
	 *
	 * <p>Here because it is the assumption everything above rests on, and because it is the one that
	 * would fail silently. {@code MembershipConstraintsTest} asks {@code pg_constraint} which
	 * constraints the table has and demands a row that breaks each; if {@code not valid} had made
	 * either of these invisible there, the pair would have dropped out of that list and its cases
	 * would have gone with them, leaving the whole table looking covered.
	 */
	@ParameterizedTest
	@MethodSource("namesThatMustStillBeDeclared")
	void anUnvalidatedConstraintIsStillDeclaredAndStillCoveredByItsOwnFloor(String name) {
		assertThat(db.sql("select conname from pg_constraint"
						+ " where conrelid = 'membership'::regclass").query(String.class).list())
				.as("`%s` is not in pg_constraint, so every floor that reads the catalogue has"
						+ " stopped seeing it", name)
				.contains(name);

		assertThat(MembershipConstraintsTest.violations().stream()
				.map(MembershipConstraintsTest.Violation::constraint).collect(Collectors.toSet()))
				.as("`%s` has no row that breaks it, so nothing says it is still enforced", name)
				.contains(name);
	}

	static Set<String> namesThatMustStillBeDeclared() {
		return NOT_VALIDATED_ON_PURPOSE;
	}
}
