package com.btl.portal.db;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V50 DOES TO A SEQUENCE THAT STANDS BELOW THE NUMBERS ALREADY WRITTEN, against a real database.
 *
 * <p><b>Why this exists.</b> V50 adds no column, no constraint and no row. The only thing it changes
 * is where {@code member_number_seq} stands, and only on a database that already holds numbered
 * members. Every other case in this suite starts from a database these migrations have just built,
 * which holds no member at all, so there V50 does nothing, and a V50 that was deleted leaves the same
 * nothing behind. This is the class {@link TheSellingYearCarriedOverTest} names, and here the state QA
 * was seen in on 29.09.2026 - one member holding {@code 000001} and a sequence standing at
 * {@code last_value = 1, is_called = false} - is written out and the migration is run over it.
 *
 * <p><b>How it is made.</b> There is nothing structural to put back, so the fixture is the state
 * itself: rows are written with their numbers already on them, the sequence is put where the case
 * says, and then THE MIGRATION ITSELF is executed - the file Flyway resolved and applied, not a copy
 * of its statement ({@link DatabaseTest#migrationSql}). Everything the rows do happens inside the
 * test's transaction and is rolled back. The shape is {@link MembershipCarriedOverTest}'s.
 *
 * <p><b>A SEQUENCE IS OUTSIDE THE TRANSACTION, and that decides how this class is built.</b>
 * {@code setval} and {@code nextval} are not rolled back with the rows (that is the whole of why
 * V16 chose a sequence), so a case that moved it would leave it moved for every class that runs
 * afterwards in the same database. No class in this package commits a row today (searched for
 * {@code @Commit}, {@code TransactionTemplate} and the propagation settings), so nothing would break if
 * it were left there, but a class that did would be handed a number that is held, and nothing in the
 * failure would point back here. The position is therefore read before each case and put back after
 * it, on a connection of its own: the one the test runs on may be sitting in an aborted transaction by
 * then, which is exactly the moment a restore must not fail
 * ({@code PaymentApiTest#numbersHandedOutSoFar} reads the sequence the same way, for the same reason).
 * Only the migration runs on the test's connection, because the rows it has to see are not committed.
 *
 * <p><b>Every case is measured on what the sequence does next, not on what the SQL says.</b> The
 * answer to "what was V50 for" is the number {@code nextval} hands out afterwards. A case that asked
 * for it BEFORE the migration would draw it and fix the state by itself, so the fixture is checked by
 * reading where the sequence stands, which draws nothing, and only the last step draws.
 *
 * <p><b>WHAT THE ROWS ARE CHOSEN TO TELL APART.</b> The highest number held is never the only one, and
 * never the first or the last row written, and it is never the count of the rows or the position the
 * sequence stood at, so a statement that reads any of those instead of the highest number comes out
 * with a different answer. The one case that has a single row is the incident itself and cannot
 * separate those, which is why it is not the only one.
 *
 * <p><b>COMPARING THE NUMBERS AS TEXT WOULD GIVE THE SAME ANSWER, and saying so plainly is better than
 * a case that pretends otherwise</b> ({@link com.btl.portal.domain.member.MemberNumber#compareTo} says
 * the same about itself). {@code competitor_member_number_shape} (V7) lets nothing through that is not
 * exactly six digits, so two numbers cannot differ in width, and at equal width text and number order
 * alike on every pair there is. V50 also runs once, on a database whose schema V1 to V49 built, so
 * there is no moment at which it could meet a longer one. The statement reads the number as a number
 * because {@code setval} takes one; that is a reason, written as a reason, and not a guard that a case
 * could hold.
 */
class TheMemberNumberSequenceCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	DataSource dataSource;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** Where a sequence stands. When {@code isCalled} is false the next draw is {@code lastValue} itself. */
	private record Standing(long lastValue, boolean isCalled) {
	}

	private Standing standingBefore;

	private int written;

	@BeforeEach
	void rememberWhereTheSequenceStood() throws Exception {
		standingBefore = theSequence();

		assertThat(db.sql("select count(*) from competitor").query(Long.class).single())
				.as("a class that ran before this one left a competitor behind, committed, and every"
						+ " number below is measured against a table this case writes by itself")
				.isZero();
	}

	@AfterEach
	void putTheSequenceBackWhereItStood() throws Exception {
		putTheSequenceAt(standingBefore.lastValue(), standingBefore.isCalled());
	}

	/** Reads where the sequence stands, and draws nothing. */
	private Standing theSequence() throws Exception {
		try (Connection outside = dataSource.getConnection();
				Statement asking = outside.createStatement();
				ResultSet answer = asking.executeQuery("select last_value, is_called from member_number_seq")) {
			answer.next();

			return new Standing(answer.getLong(1), answer.getBoolean(2));
		}
	}

	private void putTheSequenceAt(long lastValue, boolean isCalled) throws Exception {
		try (Connection outside = dataSource.getConnection();
				PreparedStatement moving = outside.prepareStatement("select setval('member_number_seq', ?, ?)")) {
			moving.setLong(1, lastValue);
			moving.setBoolean(2, isCalled);
			moving.execute();
		}
	}

	/** The draw itself: the number the next member to be activated would be given. */
	private long nextNumber() throws Exception {
		try (Connection outside = dataSource.getConnection();
				Statement drawing = outside.createStatement();
				ResultSet answer = drawing.executeQuery("select nextval('member_number_seq')")) {
			answer.next();

			return answer.getLong(1);
		}
	}

	private void theMigration() {
		jdbc.execute(migrationSql("50"));
	}

	/** A member who holds a number, written with the number already on it. */
	private void aMemberHolding(String number) {
		aCompetitor(number, true);
	}

	/** A person who registered and has not been activated, so the column is empty (V16). */
	private void anApplicant() {
		aCompetitor(null, false);
	}

	private void aCompetitor(String number, boolean active) {
		written++;

		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, ?, 'payment', ?, null,"
						+ " '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, "Broj" + written, active, String.format("00112233445566%02x", written))
				.update();
	}

	/** In the order the rows were written, which is the order a statement that reads "the first" or "the last" sees. */
	private List<String> numbersInTheOrderTheyWereWritten() {
		return db.sql("select member_number from competitor where member_number is not null order by id")
				.query(String.class)
				.list();
	}

	/**
	 * THE INCIDENT ITSELF: A MEMBER HOLDS {@code 000001} AND THE SEQUENCE IS STILL AT ITS START.
	 *
	 * <p>A sequence at {@code 1 | false} hands out 1, which the member already holds, so the first
	 * activation through the portal draws {@code 000001}, meets
	 * {@code competitor_member_number_unique} and spends the number for good (PDL section 19,
	 * "Aktivacija trosi clanski broj nepovratno"). After the migration the sequence stands on the
	 * number held with {@code is_called} true, and the next draw is the one above it.
	 *
	 * <p><b>The fixture is checked before the migration by READING the sequence, and not by drawing
	 * from it</b>: a draw here would be the very thing the migration exists to prevent, and would
	 * leave the state fixed before the migration ran, so the case would pass without it.
	 *
	 * <p>Deleting the statement leaves the next draw at 1; {@code is_called} written as false leaves it
	 * at 1 as well; a comparison that is strict where it should not be leaves the sequence where it
	 * was, because the sequence stands exactly ON the number held; a draw that is one too many gives 3.
	 */
	@Test
	void theNumberAMemberAlreadyHoldsIsNotTheNextOneDrawn() throws Exception {
		aMemberHolding("000001");
		putTheSequenceAt(1, false);

		assertThat(numbersInTheOrderTheyWereWritten())
				.as("the fixture did not write the member QA was seen with")
				.containsExactly("000001");
		assertThat(theSequence())
				.as("the fixture did not put the sequence where QA had it, so the migration below is"
						+ " run over a state that was never broken and this case measures nothing")
				.isEqualTo(new Standing(1, false));

		theMigration();

		assertThat(theSequence())
				.as("the sequence was not moved onto the number held, called")
				.isEqualTo(new Standing(1, true));
		assertThat(nextNumber())
				.as("the next member to be activated would be given the number somebody already holds")
				.isEqualTo(2L);
	}

	/**
	 * THE SEQUENCE IS MOVED TO THE HIGHEST NUMBER HELD, and not to the first one written, the last
	 * one written, how many there are, or the first number that is free.
	 *
	 * <p>Written in the order 2, 7, 3, so the highest is neither the first row nor the last, the count
	 * is 3, the sequence stands at 1 and nothing is free below 7 but 1, 4, 5 and 6. The answer is 8:
	 * PDL P8 (31.07.2026) says "Sledeci broj je jedan iznad najviseg ikad dodeljenog, nikad prvi
	 * slobodan", so the gap left by 4, 5 and 6 stays a gap.
	 *
	 * <p>{@code min} in place of {@code max} gives 3, the first row gives 3, the last row gives 4, a
	 * count gives 4, and the first free number would give 1.
	 */
	@Test
	void theSequenceIsMovedToTheHighestNumberHeldAndNotToAnyOtherOfThem() throws Exception {
		aMemberHolding("000002");
		aMemberHolding("000007");
		aMemberHolding("000003");
		putTheSequenceAt(1, false);

		assertThat(numbersInTheOrderTheyWereWritten())
				.as("the fixture did not write the highest number in the middle")
				.containsExactly("000002", "000007", "000003");
		assertThat(theSequence())
				.as("the fixture did not put the sequence at its start")
				.isEqualTo(new Standing(1, false));

		theMigration();

		assertThat(theSequence())
				.as("the sequence was not moved onto the highest number held, called")
				.isEqualTo(new Standing(7, true));
		assertThat(nextNumber())
				.as("the next draw is not the number one above the highest held")
				.isEqualTo(8L);
	}

	/**
	 * A SEQUENCE THAT IS ALREADY AHEAD IS NOT MOVED BACK.
	 *
	 * <p>Twelve numbers have been drawn and three are held: the rest went to members who are gone
	 * since (P23) or to bookings the database refused, and the sequence is the only thing that
	 * remembers them. That is the ordinary state of a live portal, and taking the sequence back to the
	 * table would hand out a number a printed card and an old result still carry. The next draw is
	 * 13, as it was before the migration ran.
	 *
	 * <p>Without the condition that keeps the migration from lowering anything the sequence goes back
	 * to 7 and the next draw is 8.
	 */
	@Test
	void aSequenceThatIsAlreadyAheadOfTheHighestNumberHeldIsNotMovedBack() throws Exception {
		aMemberHolding("000002");
		aMemberHolding("000007");
		aMemberHolding("000003");
		putTheSequenceAt(12, true);

		assertThat(theSequence())
				.as("the fixture did not put the sequence ahead of every number held")
				.isEqualTo(new Standing(12, true));

		theMigration();

		assertThat(theSequence())
				.as("the migration moved a sequence that was already ahead")
				.isEqualTo(new Standing(12, true));
		assertThat(nextNumber())
				.as("a number that was handed out once was handed out again")
				.isEqualTo(13L);
	}

	/**
	 * AND A SEQUENCE THAT STANDS AHEAD WITHOUT HAVING BEEN CALLED IS NOT PUSHED ON EITHER.
	 *
	 * <p>Put at 20 with {@code is_called} false, which is how it stands after {@code setval(20, false)}
	 * or a restart, the next draw is 20 itself. A comparison that reads only {@code last_value} and
	 * then writes {@code is_called} true would make it 21, and 20 would be a number skipped for
	 * nothing: a hole in the numbering that no member and no refused booking made.
	 */
	@Test
	void aSequenceAheadThatHasNotBeenCalledIsNotPushedOnEither() throws Exception {
		aMemberHolding("000002");
		aMemberHolding("000007");
		aMemberHolding("000003");
		putTheSequenceAt(20, false);

		assertThat(theSequence())
				.as("the fixture did not put the sequence ahead and uncalled")
				.isEqualTo(new Standing(20, false));

		theMigration();

		assertThat(theSequence())
				.as("the migration moved a sequence that was already ahead, or called it")
				.isEqualTo(new Standing(20, false));
		assertThat(nextNumber())
				.as("a number that was never handed out was skipped")
				.isEqualTo(20L);
	}

	/**
	 * NOTHING IS MOVED WHILE NOBODY HOLDS A NUMBER.
	 *
	 * <p>Three people have registered and none is activated, so the column is empty on every row (V16)
	 * and there is no highest number to move to. This is not a corner: it is the state a portal is in
	 * from the first registration until the first fee is recorded, and the sequence must still hand out
	 * 1 to whoever is activated first. That is the order PDL 13.09.2026 fixes for production: "vlasnikov
	 * nalog se pravi prvi i namerno, pa se proveri da je stvarno 000001". A migration that pushed the
	 * sequence here would take the owner's number away from him.
	 *
	 * <p>Rows are written on purpose: this case is about people who hold NO number, which an empty
	 * table would not say, and a statement that reads the number of rows instead of the highest number
	 * moves the sequence here.
	 */
	@Test
	void nothingIsMovedWhileNobodyHoldsANumber() throws Exception {
		anApplicant();
		anApplicant();
		anApplicant();
		putTheSequenceAt(1, false);

		assertThat(db.sql("select count(*) from competitor").query(Long.class).single())
				.as("the fixture did not write the people who are waiting")
				.isEqualTo(3L);
		assertThat(numbersInTheOrderTheyWereWritten())
				.as("one of the people who are waiting holds a number, so this is not the state it names")
				.isEmpty();

		theMigration();

		assertThat(theSequence())
				.as("the sequence moved although nobody holds a number")
				.isEqualTo(new Standing(1, false));
		assertThat(nextNumber())
				.as("the first member to be activated is not given 000001")
				.isEqualTo(1L);
	}
}
