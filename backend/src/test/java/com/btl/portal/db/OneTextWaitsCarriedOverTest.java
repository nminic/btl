package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V53 DOES TO THE QUEUE THAT IS THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V53 adds a unique index, and an index that refuses a second row refuses
 * the migration too if two such rows already stand. Every other test starts from an empty queue, so
 * none of them can see that: the index goes onto nothing and the migration passes. That is the class of
 * fault {@code btl/CLAUDE.md} names after V35 failed on QA - „an ogranicenje koje ne prezivljava
 * ZATECENE podatke je nevidljivo svakom paketu koji podatke sam pravi" - and the shape that measures it is
 * {@link MembershipCarriedOverTest}'s: take away what the migration adds, write the rows a portal really
 * holds, and run THE MIGRATION ITSELF over them ({@link DatabaseTest#migrationSql}). Everything happens
 * inside the test's transaction and is rolled back.
 *
 * <p><b>WHAT THE REAL QUEUE HELD, measured rather than guessed:</b> the coordinator ran a read-only count
 * on QA on 02.10.2026 against Flyway 52 and it answered nought members with more than one text waiting -
 * and nought texts waiting at all. So this class is the only place V53 ever meets rows that were there
 * before it, and the rows below are every shape the queue CAN hold beside a waiting text, each of which
 * the index must let stand.
 *
 * <p><b>The undo is one statement and it is proved by behaviour, not by a list.</b> {@link #whatV53Adds}
 * drops the one index V53 creates and nothing else. That it was the whole undo is shown by the second
 * case: a second waiting text for one member goes in only because nothing refuses it any more.
 */
class OneTextWaitsCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String THE_INDEX = "verification_one_text_waits_per_member";

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** Everything V53 creates, taken away so it has something to create. */
	private void whatV53Adds() {
		jdbc.execute("drop index " + THE_INDEX);
	}

	private void competitor(String number, String code) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Zateceni',"
						+ " 'M', date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true,"
						+ " 'payment', ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, code).update();
	}

	private static String member(String number) {
		return "(select id from competitor where member_number = '" + number + "')";
	}

	/** A row of the queue as V9 writes one, waiting or decided. */
	private void queued(String queue, String who, String body, String photo, String decided) {
		String decision = switch (decided) {
			case "waiting" -> "'waiting', null, null, null";
			case "approved" -> "'approved', timestamptz '2026-09-02 10:00:00+00', 'Moderator Probni', null";
			default -> "'rejected', timestamptz '2026-09-02 10:00:00+00', 'Moderator Probni',"
					+ " 'Napisi nesto o trcanju.'";
		};

		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, state,"
						+ " decided_at, decided_by_name, reason) values ('" + queue + "', " + who
						+ ", 'Zatecen red', ?, " + photo + ", " + decision + ")")
				.param(body).update();
	}

	/**
	 * EVERY SHAPE THE QUEUE HOLDS BESIDE A WAITING TEXT, and one member for each, so a refusal names
	 * the shape it tripped on.
	 *
	 * <ul>
	 * <li>{@code 001101}: a text waiting, and his earlier texts DECIDED, approved and refused alike -
	 * V9 keeps a decided row for ever, and the owner's rule is about the one that WAITS;
	 * <li>{@code 001102}: a text waiting beside a PICTURE waiting, which is the other half of the same
	 * tab (PDL P28a) and is told apart by {@code photo_id};
	 * <li>{@code 001103}: a text waiting beside a row waiting in ANOTHER tab;
	 * <li>{@code 001104}: a waiting row with no picture and nothing written in it, which is the shape
	 * {@code MePhotoApi} warns a picture row is left in when its {@code photo} row goes first - one of
	 * them, so it is a text to the index and stands alone;
	 * <li>and two texts waiting about NOBODY ({@code competitor_id} null, which V9 allows for a payment
	 * about somebody who is not a member yet). An index over a null compares nothing, and one written
	 * {@code nulls not distinct} would stop the migration here.
	 * </ul>
	 */
	@BeforeEach
	void theQueueAsItStoodBeforeV53() {
		whatV53Adds();

		competitor("001101", "00112233445577e1");
		competitor("001102", "00112233445577e2");
		competitor("001103", "00112233445577e3");
		competitor("001104", "00112233445577e4");

		db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter) values"
				+ " ('image/jpeg', 40960, 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',"
				+ " 0.3, 0.7, 0.45)").update();
		String thePicture = "(select id from photo where digest ="
				+ " 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789')";

		queued("profiles", member("001101"), "Tekst koji je pusten.", "null", "approved");
		queued("profiles", member("001101"), "Tekst koji je odbijen.", "null", "rejected");
		queued("profiles", member("001101"), "Tekst koji ceka.", "null", "waiting");

		queued("profiles", member("001102"), "", thePicture, "waiting");
		queued("profiles", member("001102"), "Tekst dok slika ceka.", "null", "waiting");

		queued("teams", member("001103"), "", "null", "waiting");
		queued("profiles", member("001103"), "Tekst dok tim ceka.", "null", "waiting");

		queued("profiles", member("001104"), "", "null", "waiting");

		queued("profiles", "null", "Tekst o nekome ko nije clan.", "null", "waiting");
		queued("profiles", "null", "Jos jedan tekst o nekome ko nije clan.", "null", "waiting");
	}

	private List<String> indexesOnTheQueue() {
		return db.sql("select indexname from pg_indexes where tablename = 'verification'"
						+ " and schemaname = current_schema() order by indexname")
				.query(String.class).list();
	}

	/**
	 * EVERY SHAPE ABOVE STANDS, AND THE INDEX GOES ON OVER THEM.
	 *
	 * <p>The index is asked for before the migration as well as after, so „it was there already" and
	 * „the migration made it" are two different answers.
	 */
	@Test
	void theQueueAPortalHoldsTakesTheIndex() {
		assertThat(indexesOnTheQueue())
				.as("the index is already standing before the migration runs, so what comes out of it"
						+ " below need not have been made by V53")
				.doesNotContain(THE_INDEX);

		jdbc.execute(migrationSql("53"));

		assertThat(indexesOnTheQueue()).contains(THE_INDEX);

		assertThat(db.sql("select count(*) from verification").query(Long.class).single())
				.as("the migration took a row of the queue away instead of refusing to stand over it")
				.isEqualTo(10L);
	}

	/**
	 * AND A MEMBER WITH TWO TEXTS WAITING STOPS IT, rather than losing one of them.
	 *
	 * <p>That is the precondition QA was measured for, written down where the next migration over this
	 * table will meet it: V53 does not choose which of two texts survives, because nobody has decided
	 * that, so a queue holding two refuses the index and Flyway stops. The second text goes in only
	 * because the undo above was complete.
	 */
	@Test
	void aMemberWithTwoTextsWaitingStopsTheMigrationRatherThanLosingOne() {
		queued("profiles", member("001101"), "Drugi tekst koji ceka.", "null", "waiting");

		assertThatThrownBy(() -> jdbc.execute(migrationSql("53")))
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(THE_INDEX);
	}
}
