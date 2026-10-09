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
 * WHAT V55 DOES TO THE QUEUE THAT IS THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V55 adds a unique index, and an index that refuses a second row refuses
 * the migration too if two such rows already stand. Every other test starts from an empty queue, so
 * none of them can see that: the index goes onto nothing and the migration passes. That is the class
 * of fault {@code btl/CLAUDE.md} names after V35 failed on QA - „an ogranicenje koje ne prezivljava
 * ZATECENE podatke je nevidljivo svakom paketu koji podatke sam pravi" - and the shape that measures
 * it is {@link OneTextWaitsCarriedOverTest}'s, which is {@link MembershipCarriedOverTest}'s: take
 * away what the migration adds, write the rows a portal really holds, and run THE MIGRATION ITSELF
 * over them ({@link DatabaseTest#migrationSql}). Everything happens inside the test's transaction
 * and is rolled back.
 *
 * <p><b>WHAT THE REAL QUEUE HELD, measured rather than guessed:</b> a read-only count on QA on
 * 09.10.2026 against Flyway 54 answered nought members with more than one picture waiting, and
 * nought pictures waiting at all. So this class is the only place V55 ever meets rows that were
 * there before it, and the rows below are every shape the queue CAN hold beside a waiting picture,
 * each of which the index must let stand.
 *
 * <p><b>The undo is one statement and it is proved by behaviour, not by a list.</b>
 * {@link #whatV55Adds} drops the one index V55 creates and nothing else. That it was the whole undo
 * is shown by the second case: a second waiting picture for one member goes in only because nothing
 * refuses it any more.
 */
class OnePictureWaitsCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String THE_INDEX = "verification_one_picture_waits_per_member";

	/** V53's, which V55 stands beside and must not touch. */
	private static final String THE_TEXT_INDEX = "verification_one_text_waits_per_member";

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** Everything V55 creates, taken away so it has something to create. */
	private void whatV55Adds() {
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

	/** A photo row of its own, which is what a picture waiting points at. */
	private void photo(String tail) {
		db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter) values"
						+ " ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)")
				.param(digest(tail)).update();
	}

	private static String digest(String tail) {
		return ("abcdef0123456789".repeat(4) + tail).substring(tail.length());
	}

	private static String thePhoto(String tail) {
		return "(select id from photo where digest = '" + digest(tail) + "')";
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
	 * EVERY SHAPE THE QUEUE HOLDS BESIDE A WAITING PICTURE, and one member for each, so a refusal
	 * names the shape it tripped on.
	 *
	 * <ul>
	 * <li>{@code 001201}: a picture waiting, and his texts beside it - one waiting and two decided,
	 * approved and refused alike, which V9 keeps for ever. The tab holds both sorts (PDL P28a) and
	 * the index is about the one that carries a picture;
	 * <li>{@code 001202}: a picture waiting beside a row waiting in ANOTHER tab;
	 * <li>{@code 001203}: a picture waiting and nothing else, the commonest shape there is;
	 * <li>{@code 001204}: a picture DECIDED, which holds no picture any more (V9), and a new one
	 * waiting beside it - the road a member really takes when his picture is approved or refused and
	 * he sends another;
	 * <li>and two pictures waiting about NOBODY ({@code competitor_id} null, which V9 allows for a
	 * payment about somebody who is not a member yet). An index over a null compares nothing, and one
	 * written {@code nulls not distinct} would stop the migration here.
	 * </ul>
	 */
	@BeforeEach
	void theQueueAsItStoodBeforeV55() {
		whatV55Adds();

		competitor("001201", "00112233445577f1");
		competitor("001202", "00112233445577f2");
		competitor("001203", "00112233445577f3");
		competitor("001204", "00112233445577f4");

		for (String tail : List.of("01", "02", "03", "04", "05", "06", "07")) {
			photo(tail);
		}

		queued("profiles", member("001201"), "", thePhoto("01"), "waiting");
		queued("profiles", member("001201"), "Tekst koji je pusten.", "null", "approved");
		queued("profiles", member("001201"), "Tekst koji je odbijen.", "null", "rejected");
		queued("profiles", member("001201"), "Tekst koji ceka.", "null", "waiting");

		queued("profiles", member("001202"), "", thePhoto("02"), "waiting");
		queued("teams", member("001202"), "", "null", "waiting");

		queued("profiles", member("001203"), "", thePhoto("03"), "waiting");

		queued("profiles", member("001204"), "", "null", "approved");
		queued("profiles", member("001204"), "", thePhoto("04"), "waiting");

		queued("profiles", "null", "", thePhoto("05"), "waiting");
		queued("profiles", "null", "", thePhoto("06"), "waiting");
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
	 * „the migration made it" are two different answers. V53's index is asked for both times too:
	 * the file must add its own and take nothing of the neighbour's.
	 */
	@Test
	void theQueueAPortalHoldsTakesTheIndex() {
		assertThat(indexesOnTheQueue())
				.as("the index is already standing before the migration runs, so what comes out of it"
						+ " below need not have been made by V55")
				.doesNotContain(THE_INDEX)
				.contains(THE_TEXT_INDEX);

		jdbc.execute(migrationSql("55"));

		assertThat(indexesOnTheQueue()).contains(THE_INDEX, THE_TEXT_INDEX);

		assertThat(db.sql("select count(*) from verification").query(Long.class).single())
				.as("the migration took a row of the queue away instead of refusing to stand over it")
				.isEqualTo(11L);
	}

	/**
	 * AND A MEMBER WITH TWO PICTURES WAITING STOPS IT, rather than losing one of them.
	 *
	 * <p>That is the precondition QA was measured for, written down where the next migration over
	 * this table will meet it: V55 does not choose which of two pictures survives, because deleting a
	 * row of the queue is not its to do and nobody has approved it, so a queue holding two refuses
	 * the index and Flyway stops. The second picture goes in only because the undo above was
	 * complete.
	 */
	@Test
	void aMemberWithTwoPicturesWaitingStopsTheMigrationRatherThanLosingOne() {
		queued("profiles", member("001203"), "", thePhoto("07"), "waiting");

		assertThatThrownBy(() -> jdbc.execute(migrationSql("55")))
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(THE_INDEX);
	}
}
