package com.btl.portal.db;

import com.btl.portal.TheEndOfTheTransaction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V54 DOES TO THE PICTURES THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> The last statement of V54 deletes every {@code photo} row that nobody
 * holds (ADL A68, 03.10.2026, „Zatecen zapis na QA se brise"). Every other test starts from an
 * empty database, so by the time the suite can look there is no photo at all: a deletion that was
 * taken out of the file, or one that took the pictures somebody holds along with the ones nobody
 * does, leaves the same nothing behind. A migration whose only measurement is „the schema
 * afterwards" is a migration whose data half nobody has run. This is the class of fault
 * {@code btl/CLAUDE.md} names after V35 failed on QA, and the shape that measures it is
 * {@link MembershipCarriedOverTest}'s: take away what the migration adds, write the rows a portal
 * really holds, and run THE MIGRATION ITSELF over them ({@link DatabaseTest#migrationSql}).
 * Everything happens inside the test's transaction and is rolled back.
 *
 * <p><b>WHAT QA HELD, measured rather than guessed:</b> on 02.10.2026 two {@code photo} rows, one
 * of which nobody holds. That is the shape of the second case below, and the rows of the first are
 * every shape the four columns can hold a picture in, each of which has to stand.
 *
 * <p><b>The undo is two statements and it is proved by behaviour, not by a list.</b>
 * {@link #whatV54Adds} drops the two functions V54 creates and, with the one that runs the
 * triggers, the four triggers that depend on it; nothing else. That it was the whole undo is shown
 * by the third case: before the migration, letting go of a picture takes nothing away, and after
 * it, the same act does.
 */
class APhotoNobodyHoldsCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at, photo_id";

	private int photos;

	/** Everything V54 creates, taken away so it has something to create. */
	@BeforeEach
	void whatV54Adds() {
		jdbc.execute("drop function a_photo_nobody_holds_goes() cascade");
		jdbc.execute("drop function a_photo_is_held(bigint)");
	}

	/**
	 * EVERY SHAPE THE FOUR COLUMNS CAN HOLD A PICTURE IN, AND TWO THAT NOBODY HOLDS.
	 *
	 * <ul>
	 * <li>a portrait on a member's profile ({@code competitor.photo_id});
	 * <li>a picture waiting for a moderator ({@code verification.photo_id});
	 * <li>the mark of a team ({@code team.logo_id});
	 * <li>the mark of a team that was proposed ({@code team_proposal.logo_id});
	 * <li>one picture that two columns hold at once, which the schema allows and no door writes: a
	 * member's portrait that is also on his queue row;
	 * <li>and two that nothing points at, which cannot be told apart at rest whether they were
	 * ever held or lost their last holder.
	 * </ul>
	 *
	 * <p>Each held one is held by ONE column and one only, except the one that is held by two, so a
	 * deletion that forgot a column takes away exactly the picture that column holds and no other
	 * (a question that read three columns of four fails on the shape it left out).
	 */
	private List<Long> theRowsAPortalHolds() {
		long onAProfile = aPhoto();
		long inTheQueue = aPhoto();
		long onATeam = aPhoto();
		long onAProposal = aPhoto();
		long onTwo = aPhoto();

		aMember("001201", onAProfile);

		long waiting = aMember("001202", null);
		long both = aMember("001203", onTwo);
		long proposer = aMember("001204", null);

		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values ('profiles', ?, 'Slika koja ceka', '', ?)")
				.params(waiting, inTheQueue).update();
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values ('profiles', ?, 'Slika i na profilu', '', ?)")
				.params(both, onTwo).update();
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values ('znak-tima', 'Tim sa znakom', '', '',"
						+ " " + A_TOWN + ", null, null, ?, 2027, null)")
				.param(onATeam).update();
		db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link, place_id, city,"
						+ " country_id, logo_id) values (?, null, 'Predlozen tim', '', '', " + A_TOWN
						+ ", null, null, ?)")
				.params(proposer, onAProposal).update();

		return List.of(onAProfile, inTheQueue, onATeam, onAProposal, onTwo);
	}

	/**
	 * EVERY PICTURE SOMEBODY HOLDS STANDS, AND EVERY PICTURE NOBODY HOLDS GOES.
	 *
	 * <p>Seven rows before, five after. The pointers are read back too, so a migration that kept the
	 * rows by deleting the pointers - or that took the pictures and left the members standing on
	 * nothing - is not read as a migration that kept them.
	 */
	@Test
	void everyPictureSomebodyHoldsStandsAndEveryPictureNobodyHoldsGoes() {
		List<Long> held = theRowsAPortalHolds();
		long nobodyOne = aPhoto();
		long nobodyTwo = aPhoto();

		assertThat(howManyPhotoRows())
				.as("the arrangement did not write the seven rows this case is about")
				.isEqualTo(7);

		jdbc.execute(migrationSql("54"));

		assertThat(db.sql("select id from photo order by id").query(Long.class).list())
				.as("the pictures somebody holds, and none that nobody does")
				.containsExactlyElementsOf(held.stream().sorted().toList());
		assertThat(theRowStands(nobodyOne) || theRowStands(nobodyTwo))
				.as("a picture nothing points at is still there after the migration")
				.isFalse();

		assertThat(db.sql("select count(*) from competitor where photo_id is not null")
				.query(Long.class).single())
				.as("a member stands on a portrait fewer than before")
				.isEqualTo(2);
		assertThat(db.sql("select count(*) from verification where photo_id is not null")
				.query(Long.class).single())
				.as("a queue row lost its picture")
				.isEqualTo(2);
		assertThat(db.sql("select count(*) from team where logo_id is not null")
				.query(Long.class).single())
				.as("a team lost its mark")
				.isEqualTo(1);
		assertThat(db.sql("select count(*) from team_proposal where logo_id is not null")
				.query(Long.class).single())
				.as("a proposal lost its mark")
				.isEqualTo(1);
	}

	/**
	 * THE SHAPE QA WAS MEASURED IN: TWO ROWS, ONE OF WHICH NOBODY HOLDS.
	 *
	 * <p>Owner, ADL A68, 03.10.2026: „Zatecen zapis na QA se brise". The one that is held stands on
	 * a member's profile, and the one that is not goes, which is the whole of what the owner
	 * approved on QA and the whole of what happens there on the day V54 is applied.
	 */
	@Test
	void theTwoRowsQaHeldLoseTheOneNobodyHolds() {
		long held = aPhoto();
		long nobodys = aPhoto();

		aMember("001205", held);

		jdbc.execute(migrationSql("54"));

		assertThat(theRowStands(held)).as("the picture a member stands on went").isTrue();
		assertThat(theRowStands(nobodys)).as("the picture nobody holds is still there").isFalse();
		assertThat(howManyPhotoRows()).isEqualTo(1);
	}

	/**
	 * THE UNDO WAS WHOLE, AND THE MIGRATION BRINGS THE TRIGGERS BACK.
	 *
	 * <p>Before the migration a member lets go of his portrait and nothing takes the picture away,
	 * which is what a database without V54 does and the only thing that shows the undo took away
	 * everything the triggers need. After it, the same act does take it away, which is what shows
	 * the migration put them back. The picture let go of BEFORE is deleted by the migration's own
	 * last statement, since nobody holds it by then; the one let go of AFTER is deleted by a
	 * trigger, and that is the one this case reads.
	 */
	@Test
	void beforeTheMigrationLettingGoTakesNothingAwayAndAfterItDoes() {
		long before = aPhoto();
		long member = aMember("001206", before);

		db.sql("update competitor set photo_id = null where id = ?").param(member).update();
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(theRowStands(before))
				.as("a trigger is still there, so the undo above was not the whole of V54")
				.isTrue();

		jdbc.execute(migrationSql("54"));

		long after = aPhoto();
		long anotherMember = aMember("001207", after);

		db.sql("update competitor set photo_id = null where id = ?").param(anotherMember).update();
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(theRowStands(after))
				.as("the migration did not bring the triggers back")
				.isFalse();
	}

	private long aPhoto() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)"
						+ " returning id")
				.param(String.format("%064x", 0xb5400000L + 0x100 + ++photos))
				.query(Long.class).single();
	}

	/** A member who stands on this picture, or on none. */
	private long aMember(String number, Long photo) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni',"
						+ " 'Zateceni', 'M', date '1982-02-02', " + A_TOWN + ", null, null, 2027,"
						+ " false, true, 'payment', ?, null, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00', "
						+ (photo == null ? "null" : photo.toString()) + ") returning id")
				.params(number, "00112233445588" + number.substring(4))
				.query(Long.class).single();
	}

	private long howManyPhotoRows() {
		return db.sql("select count(*) from photo").query(Long.class).single();
	}

	private boolean theRowStands(long photo) {
		return db.sql("select exists (select 1 from photo where id = ?)").param(photo)
				.query(Boolean.class).single();
	}
}
