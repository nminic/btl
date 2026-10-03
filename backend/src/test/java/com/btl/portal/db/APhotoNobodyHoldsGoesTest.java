package com.btl.portal.db;

import com.btl.portal.TheEndOfTheTransaction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V54: A {@code photo} ROW THAT NOBODY HOLDS ANY MORE IS DELETED BY THE DATABASE AT THE END OF THE
 * TRANSACTION THAT LET GO OF IT, asked of the database itself and of nothing that stands in front of
 * it.
 *
 * <p>ADL A68, 03.10.2026, „Na kraju svake transakcije baza brise zapis slike koji vise ne drzi
 * nijedna od cetiri kolone", and it holds for „Vazi i za svaku buducu radnju nad tim kolonama".
 * {@code APictureGoesWithItsLastHolderTest} asks the same of the portal's doors and commits for
 * real, which is what it is for; this class asks it of the four columns and every way a column can
 * let go, with no Java in the way, because a door that deleted the row itself would pass the
 * outcome whether or not the database does (four doors did, until V54).
 *
 * <p><b>WHY THE FIXTURE ENDS EACH CASE BY BRINGING THE END OF THE TRANSACTION FORWARD</b>
 * ({@link TheEndOfTheTransaction}). The four triggers are deferred to the commit, and this class,
 * like every {@link DatabaseTest}, is rolled back and never commits. Without it the triggers would
 * never speak here, so every case that says a row GOES would fail and every case that says a row
 * STAYS would pass against a database with V54 deleted - or against one that deletes too much.
 *
 * <p><b>EVERY CASE THAT SAYS A ROW STAYS HAS ITS CONTROL IN THE SAME BODY.</b> A photo that
 * another column holds is shown to go the moment that column lets go too. A „stays" that is not
 * followed by a „goes" cannot tell a rule that works from a rule that never fired.
 *
 * <p><b>THE KEYS ARE NOT THE SAME NUMBER.</b> A fresh database hands every {@code bigserial} the
 * number one, so the first photo and the first member and the first queue row are all 1, and a
 * trigger that let go of the holder's own {@code id} instead of its pointer would pass. The photo
 * sequence is moved on before each case and each arrangement says out loud that the photo's key is
 * not its holder's (the shape {@code TheRemovalStandsEvenWhenTheFileWontGoTest} gives the same
 * fault for a log line).
 *
 * <p><b>THE FLOORS ARE DERIVED.</b> The four columns are written out below, and the catalogue is
 * asked that there are no more and no fewer, and that each has a trigger listening to exactly it:
 * a fifth column that points at {@code photo} arrives as a failing case and not as a picture that
 * is silently never taken away.
 */
class APhotoNobodyHoldsGoesTest extends DatabaseTest {

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** The four columns that may point at a photo, the table each lives in and its trigger. */
	private enum Holder {

		COMPETITOR("competitor", "photo_id", "competitor_leaves_a_photo_nobody_holds"),
		VERIFICATION("verification", "photo_id", "verification_leaves_a_photo_nobody_holds"),
		TEAM("team", "logo_id", "team_leaves_a_photo_nobody_holds"),
		TEAM_PROPOSAL("team_proposal", "logo_id", "team_proposal_leaves_a_photo_nobody_holds");

		private final String table;

		private final String column;

		private final String trigger;

		Holder(String table, String column, String trigger) {
			this.table = table;
			this.column = column;
			this.trigger = trigger;
		}

		/** Spelt as {@code pg_constraint} spells it, which is how the floors compare. */
		String named() {
			return table + "." + column;
		}

		@Override
		public String toString() {
			return named();
		}
	}

	/** The ways a holder lets go of a picture, each of which the database is asked about. */
	private enum Way {
		ITS_POINTER_IS_EMPTIED,
		ITS_POINTER_MOVES_TO_ANOTHER_PHOTO,
		ITS_ROW_IS_DELETED
	}

	private int members;

	private int photos;

	private int teams;

	/**
	 * Every photo key is far above every holder key, in every case: the sequence is not rolled
	 * back with the transaction, so it only ever moves on.
	 */
	@BeforeEach
	void thePhotoKeysAreNotTheKeysOfTheRowsThatHoldThem() {
		db.sql("select setval(pg_get_serial_sequence('photo', 'id'),"
						+ " nextval(pg_get_serial_sequence('photo', 'id')) + 1000)")
				.query(Long.class).single();
	}

	// ------------------------------------------------------------------ one holder lets go

	/**
	 * A HOLDER THAT LETS GO OF ITS PHOTO TAKES THE ROW OF THE PHOTO AWAY, whichever of the four it
	 * is and whichever way it lets go.
	 *
	 * <p>Twelve cases: four columns and three ways, the pointer emptied, the pointer moved to
	 * another picture, and the row that held it deleted. {@code APictureGoesWithItsLastHolderTest}
	 * reaches three of them through doors, and for the standing portrait of a member who is deleted
	 * the door deleted the row itself, so the outcome would stand without the trigger. This is the
	 * one that stands only with it.
	 *
	 * <p><b>Another row of the same table holds another picture throughout</b>, so „the photo that
	 * went" is never „the only photo", and a statement that took away every photo nobody points at
	 * - or every photo of the table - could not pass this and fail the assertion under it.
	 */
	@ParameterizedTest(name = "{0} lets go: {1}")
	@MethodSource("everyHolderAndEveryWayItLetsGo")
	void aHolderThatLetsGoTakesTheRowOfItsPhotoAway(Holder holder, Way way) {
		long theOne = aPhoto();
		long itsRow = holding(holder, theOne);
		long theOther = aPhoto();
		holding(holder, theOther);
		Long moved = null;

		assertThat(itsRow).as("the photo's key is the key of the row that holds it").isNotEqualTo(theOne);
		assertThat(theRowStands(theOne)).as("the arrangement did not write the photo").isTrue();

		switch (way) {
			case ITS_POINTER_IS_EMPTIED -> emptied(holder, itsRow);
			case ITS_POINTER_MOVES_TO_ANOTHER_PHOTO -> {
				moved = aPhoto();
				pointedAt(holder, itsRow, moved);
			}
			case ITS_ROW_IS_DELETED -> deleted(holder, itsRow);
		}

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(theRowStands(theOne))
				.as("%s let go of its photo (%s) and the row of the photo is still there", holder, way)
				.isFalse();
		assertThat(theRowStands(theOther))
				.as("the photo of ANOTHER row of the same table went with it")
				.isTrue();

		if (moved != null) {
			assertThat(theRowStands(moved))
					.as("the photo the pointer moved TO went, though the row now holds it")
					.isTrue();
		}
	}

	private static Stream<Arguments> everyHolderAndEveryWayItLetsGo() {
		return Arrays.stream(Holder.values())
				.flatMap(holder -> Arrays.stream(Way.values()).map(way -> Arguments.of(holder, way)));
	}

	// ------------------------------------------------------------------ two holders of one photo

	/**
	 * A PHOTO THAT ANOTHER COLUMN STILL HOLDS STAYS, AND GOES THE MOMENT THAT ONE LETS GO TOO.
	 *
	 * <p>A ring of four pairs, so that every column is the one that keeps the photo exactly once -
	 * the pitch at which a question that forgot one of the four goes red - and every column is also
	 * the one that lets go once. The columns that stay and the columns that go are as different
	 * tables as the schema offers: a member's portrait against a queue row, a queue row against a
	 * team's mark, a mark against a proposed mark, a proposed mark against a portrait.
	 *
	 * <p>The second half is the control. The photo that stood while one column held it has to go
	 * when the last one lets go, in the same case, or „it stood" says nothing about the rule.
	 */
	@ParameterizedTest(name = "{0} lets go, {1} keeps it")
	@MethodSource("theRing")
	void aPhotoThatAnotherColumnStillHoldsStaysUntilThatOneLetsGoToo(Holder letsGo, Holder keeps) {
		long photo = aPhoto();
		long first = holding(letsGo, photo);
		long second = holding(keeps, photo);

		assertThat(first).as("the photo's key is the key of the row that lets go").isNotEqualTo(photo);
		assertThat(second).as("the photo's key is the key of the row that keeps it").isNotEqualTo(photo);

		emptied(letsGo, first);
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(theRowStands(photo))
				.as("%s still holds the photo and it went when %s let go of it", keeps, letsGo)
				.isTrue();

		emptied(keeps, second);
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(theRowStands(photo))
				.as("both columns have let go of the photo and the row of the photo is still there")
				.isFalse();
	}

	private static Stream<Arguments> theRing() {
		return Stream.of(
				Arguments.of(Holder.VERIFICATION, Holder.COMPETITOR),
				Arguments.of(Holder.COMPETITOR, Holder.TEAM),
				Arguments.of(Holder.TEAM, Holder.TEAM_PROPOSAL),
				Arguments.of(Holder.TEAM_PROPOSAL, Holder.VERIFICATION));
	}

	/**
	 * DELETING A PHOTO THAT TWO COLUMNS HOLD EMPTIES BOTH AND IS NOT AN ERROR.
	 *
	 * <p>It is the statement the Java doors used to run on a picture they were taking away, and
	 * {@code on delete set null} then writes null into both pointers, which are updates of the
	 * very columns the triggers listen to, with a photo that is already gone. The trigger meets
	 * nothing to lock and nothing to delete and must say nothing.
	 */
	@Test
	void deletingAPhotoThatTwoColumnsHoldEmptiesBothAndIsNotAFault() {
		long photo = aPhoto();
		long member = holding(Holder.COMPETITOR, photo);
		long team = holding(Holder.TEAM, photo);

		db.sql("delete from photo where id = ?").param(photo).update();
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(pointer(Holder.COMPETITOR, member)).isNull();
		assertThat(pointer(Holder.TEAM, team)).isNull();
		assertThat(theRowStands(photo)).isFalse();
	}

	// ------------------------------------------------------------------ cascades

	/**
	 * DELETING A MEMBER TAKES EVERY PICTURE THAT WAS ABOUT HIM: HIS PORTRAIT, THE ONE THAT WAITED
	 * FOR A MODERATOR AND THE MARK OF THE TEAM HE PROPOSED.
	 *
	 * <p>Three holders, one deletion. The queue row and the proposal go with him by cascade
	 * ({@code verification_competitor_fk} V9, {@code team_proposal_competitor_fk} V11), and a
	 * cascaded delete fires the triggers of the table it deletes from. Nothing in the portal ever
	 * deleted the second and the third.
	 */
	@Test
	void deletingAMemberTakesEveryPictureThatWasAboutHim() {
		long portrait = aPhoto();
		long waiting = aPhoto();
		long proposed = aPhoto();
		long member = holding(Holder.COMPETITOR, portrait);
		holdingFor(member, Holder.VERIFICATION, waiting);
		holdingFor(member, Holder.TEAM_PROPOSAL, proposed);

		db.sql("delete from competitor where id = ?").param(member).update();
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(List.of(theRowStands(portrait), theRowStands(waiting), theRowStands(proposed)))
				.as("portrait, waiting picture and proposed mark of a deleted member")
				.containsExactly(false, false, false);
	}

	/**
	 * DELETING A TEAM TAKES ITS MARK AND THE MARK OF A PROPOSAL TO CHANGE IT.
	 *
	 * <p>{@code team_proposal_team_fk} (V11) cascades, so an edit proposed for a team that is gone
	 * is deleted with it and holds a picture nobody will ever see.
	 */
	@Test
	void deletingATeamTakesItsMarkAndTheMarkOfAProposalToChangeIt() {
		long mark = aPhoto();
		long proposed = aPhoto();
		long team = holding(Holder.TEAM, mark);

		holdingForTeam(team, aMember(null), proposed);

		db.sql("delete from team where id = ?").param(team).update();
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(List.of(theRowStands(mark), theRowStands(proposed)))
				.as("mark of the team and mark of the proposal to change it")
				.containsExactly(false, false);
	}

	// ------------------------------------------------------------------ the end of the transaction

	/**
	 * A PICTURE LET GO OF AND TAKEN AGAIN IN ONE TRANSACTION STAYS, in either order.
	 *
	 * <p>It is what an approval does: {@code VerificationWriteApi} empties the queue row's pointer
	 * (V9 demands it of every decided row) and only then writes the picture onto
	 * {@code competitor.photo_id}. A rule asked after each statement deletes the picture between
	 * the two and the second statement then fails the foreign key or leaves the portrait empty -
	 * measured on a real PostgreSQL on 03.10.2026 - which is why V54's triggers are deferred, and
	 * why this is the one case that goes red when they are not. Taking first and letting go second
	 * passes either way, and is here so that the case cannot be satisfied by a rule that merely
	 * refuses to let go while something else is writing.
	 */
	@ParameterizedTest(name = "let go first: {0}")
	@ValueSource(booleans = {true, false})
	void aPictureLetGoOfAndTakenAgainInOneTransactionStays(boolean letGoFirst) {
		long photo = aPhoto();
		long queueRow = holding(Holder.VERIFICATION, photo);
		long member = aMember(null);

		assertThat(queueRow).as("the photo's key is the key of its queue row").isNotEqualTo(photo);

		if (letGoFirst) {
			emptied(Holder.VERIFICATION, queueRow);
			pointedAt(Holder.COMPETITOR, member, photo);
		}
		else {
			pointedAt(Holder.COMPETITOR, member, photo);
			emptied(Holder.VERIFICATION, queueRow);
		}

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(theRowStands(photo))
				.as("the picture was deleted although the member holds it when the transaction ends")
				.isTrue();
		assertThat(pointer(Holder.COMPETITOR, member)).isEqualTo(photo);
	}

	/**
	 * A PHOTO NOBODY EVER HELD IS NOT TAKEN AWAY BY SOMEBODY ELSE LETTING GO.
	 *
	 * <p>The rule is about a photo that LOST its last holder (ADL A68, „koji vise ne drzi"), so what
	 * it asks is the key of the row that let go and never „which photos does nobody hold right
	 * now". The photo that is let go of is the control: it goes, so the trigger did fire, and the
	 * one nobody ever held, written a moment before, is still there. Nothing in the portal writes
	 * a picture it does not point at in the same transaction today, but a two-step upload would,
	 * and the same sentence lets such a row stand between its two steps.
	 */
	@Test
	void aPhotoNobodyEverHeldStaysWhenAnotherOneIsLetGoOf() {
		long neverHeld = aPhoto();
		long letGoOf = aPhoto();
		long member = holding(Holder.COMPETITOR, letGoOf);

		emptied(Holder.COMPETITOR, member);
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(theRowStands(letGoOf))
				.as("the photo that was let go of is still there, so the trigger never fired")
				.isFalse();
		assertThat(theRowStands(neverHeld))
				.as("a photo that nobody ever held was taken away by another photo being let go of")
				.isTrue();
	}

	/**
	 * AN UPDATE THAT NAMES THE POINTER WITHOUT CHANGING IT KEEPS THE PHOTO.
	 *
	 * <p>{@code update ... set photo_id = photo_id} is an UPDATE OF the column the triggers listen
	 * to, so the trigger is asked about the picture the row holds before and after alike. The
	 * function has no „did the value change" branch: the picture is still held, and the question
	 * „does anybody hold it" answers for it.
	 */
	@ParameterizedTest(name = "{0}")
	@EnumSource(Holder.class)
	void anUpdateThatNamesThePointerWithoutChangingItKeepsThePhoto(Holder holder) {
		long photo = aPhoto();
		long row = holding(holder, photo);

		db.sql("update " + holder.table + " set " + holder.column + " = " + holder.column
						+ " where id = ?")
				.param(row).update();
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(theRowStands(photo)).as("the row still holds the photo").isTrue();
		assertThat(pointer(holder, row)).isEqualTo(photo);
	}

	/**
	 * LETTING GO OF NOTHING IS NOT A FAULT.
	 *
	 * <p>A row whose pointer is empty is deleted, and a row that holds nothing is the commonest row
	 * there is: every member without a portrait, every team without a mark. The function reads a
	 * null, locks a row that does not exist, asks a question that answers no and deletes nothing.
	 */
	@ParameterizedTest(name = "{0}")
	@EnumSource(Holder.class)
	void lettingGoOfNothingIsNotAFault(Holder holder) {
		long bystander = aPhoto();
		holding(Holder.COMPETITOR, bystander);
		long row = holding(holder, null);

		deleted(holder, row);
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(theRowStands(bystander)).as("a photo somebody holds").isTrue();
	}

	/**
	 * ROWS THAT ARE WRITTEN IN AND THEN FOLLOWED BY AN {@code ALTER TABLE} IN ONE TRANSACTION
	 * LEAVE NO PENDING TRIGGER EVENT, on each of the four tables.
	 *
	 * <p>That is the shape of the pour ({@code deploy/pour-from-qa.sh}): it writes with COPY and puts
	 * the constraints that are NOT VALID back with ALTER TABLE, in the same transaction.
	 * PostgreSQL refuses an ALTER TABLE on a table that has a pending deferred trigger event
	 * (`cannot ALTER TABLE "competitor" because it has pending trigger events`, measured on
	 * 03.10.2026), and a trigger that listed INSERT would leave one per inserted row. This is what
	 * says the four do not, and it is a case about behaviour rather than a read of the triggers'
	 * definitions.
	 */
	@ParameterizedTest(name = "{0}")
	@EnumSource(Holder.class)
	void aRowWrittenInIsFollowedByAnAlterTableWithoutAFault(Holder holder) {
		holding(holder, aPhoto());

		db.sql("alter table " + holder.table + " add constraint a_photo_probe check (true) not valid")
				.update();
	}

	// ------------------------------------------------------------------ the floors

	/**
	 * THE SCHEMA IS ASKED WHETHER THERE ARE STILL FOUR, which is the floor under the list in
	 * {@link Holder}.
	 *
	 * <p>The list is written by hand because what each of the four is has to be arranged by hand,
	 * and the catalogue derives which columns EXIST: a fifth that points at {@code photo} fails
	 * here and has to be given a trigger and an arrangement, instead of being a picture the
	 * database silently never takes away. {@code PhotoApiTest} asks the same of the catalogue for
	 * its own list, and each list has its own floor.
	 */
	@Test
	void everyColumnThatPointsAtAPhotoIsOneOfTheFour() {
		assertThat(theColumnsThatPointAtAPhoto())
				.as("a column points at `photo` that nothing here arranges, or this names one the"
						+ " schema no longer has; a fifth holder needs a trigger of its own and a"
						+ " row in a_photo_is_held")
				.containsExactlyInAnyOrderElementsOf(
						Arrays.stream(Holder.values()).map(Holder::named).toList());
	}

	/**
	 * AND EACH OF THEM HAS A TRIGGER THAT LISTENS TO EXACTLY THAT COLUMN.
	 *
	 * <p>Read of {@code pg_trigger.tgattr}, the columns an {@code UPDATE OF} names, so a trigger
	 * that listened to {@code id} instead of the pointer, or that was missing from one of the four,
	 * fails here before any case about behaviour has to notice it. The behaviour is held by the
	 * cases above, and this is the floor that says the cases above cover all of them.
	 */
	@Test
	void everyColumnThatPointsAtAPhotoHasATriggerListeningToIt() {
		assertThat(theColumnsTheActingTriggersListenTo())
				.containsExactlyInAnyOrderElementsOf(theColumnsThatPointAtAPhoto());
	}

	/**
	 * THE CONSTRAINT TRIGGERS THAT ACT ARE THESE FOUR AND EACH IS DEFERRED.
	 *
	 * <p>This is the floor under the exemption the three constraint floors take
	 * ({@link DatabaseTest#withoutTheConstraintTriggersThatAct}): what they are excused from asking
	 * a row that breaks it is exactly the four triggers that run V54's function, each
	 * {@code DEFERRABLE INITIALLY DEFERRED}, and nothing else can hide in it. A constraint trigger
	 * that REFUSES something runs another function and is still asked for its row.
	 */
	@Test
	void theConstraintTriggersThatActAreTheFourAndEachOfThemIsDeferred() {
		assertThat(constraintTriggersThatAct())
				.containsExactlyInAnyOrderElementsOf(
						Arrays.stream(Holder.values()).map(holder -> holder.trigger).toList());

		assertThat(db.sql("select count(*) from pg_trigger t"
						+ " join pg_proc p on p.oid = t.tgfoid"
						+ " where t.tgconstraint <> 0 and p.proname = 'a_photo_nobody_holds_goes'"
						+ " and not (t.tgdeferrable and t.tginitdeferred)")
				.query(Long.class).single())
				.as("a trigger that ACTS is not deferred to the end of the transaction, so an approval"
						+ " that lets go of a picture before it takes it loses the picture")
				.isZero();
	}

	private List<String> theColumnsThatPointAtAPhoto() {
		return db.sql("select c.conrelid::regclass::text || '.' || a.attname"
						+ " from pg_constraint c"
						+ " cross join lateral unnest(c.conkey) as k(attnum)"
						+ " join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum"
						+ " where c.contype = 'f' and c.confrelid = 'photo'::regclass"
						+ " order by 1")
				.query(String.class).list();
	}

	private List<String> theColumnsTheActingTriggersListenTo() {
		return db.sql("select t.tgrelid::regclass::text || '.' || a.attname"
						+ " from pg_trigger t"
						+ " join pg_proc p on p.oid = t.tgfoid"
						+ " cross join lateral unnest(t.tgattr::int2[]) as k(attnum)"
						+ " join pg_attribute a on a.attrelid = t.tgrelid and a.attnum = k.attnum"
						+ " where t.tgconstraint <> 0 and p.proname = 'a_photo_nobody_holds_goes'"
						+ " order by 1")
				.query(String.class).list();
	}

	// ------------------------------------------------------------------ the arrangement

	private long aPhoto() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)"
						+ " returning id")
				.param(String.format("%064x", 0xb5400000L + ++photos)).query(Long.class).single();
	}

	/** A member who may stand on a picture, or on none. */
	private long aMember(Long photo) {
		int which = ++members;

		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ", photo_id) values (?,"
						+ " 'Probni', 'Nosilac', 'M', date '1990-01-01', " + A_TOWN + ", null, null,"
						+ " 2027, false, true, 'payment', ?, null, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00', " + literal(photo)
						+ ") returning id")
				.params(String.format("%06d", 5400 + which), String.format("%016x", 0xb5400000L + which))
				.query(Long.class).single();
	}

	/** A row of the table that is asked about, holding this photo or none. */
	private long holding(Holder holder, Long photo) {
		return switch (holder) {
			case COMPETITOR -> aMember(photo);
			case VERIFICATION -> holdingFor(aMember(null), holder, photo);
			case TEAM -> aTeam(photo);
			case TEAM_PROPOSAL -> holdingFor(aMember(null), holder, photo);
		};
	}

	/** A queue row or a proposal that is about this member, holding this photo or none. */
	private long holdingFor(long member, Holder holder, Long photo) {
		return switch (holder) {
			case VERIFICATION -> db.sql("insert into verification (queue, competitor_id, subject,"
							+ " body, photo_id) values ('profiles', ?, 'Slika nosioca', '', "
							+ literal(photo) + ") returning id")
					.param(member).query(Long.class).single();
			case TEAM_PROPOSAL -> holdingForTeam(null, member, photo);
			default -> throw new IllegalArgumentException(holder + " is not about a member");
		};
	}

	/** A proposal by this member, to make a team (no team) or to change this one. */
	private long holdingForTeam(Long team, long member, Long photo) {
		return db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link, place_id,"
						+ " city, country_id, logo_id) values (?, " + literal(team)
						+ ", 'Predlozen tim', '', '', " + A_TOWN + ", null, null, " + literal(photo)
						+ ") returning id")
				.param(member).query(Long.class).single();
	}

	private long aTeam(Long photo) {
		int which = ++teams;

		return db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values (?, 'Probni tim', '', '', " + A_TOWN
						+ ", null, null, " + literal(photo) + ", 2027, null) returning id")
				.param("nosilac-" + which).query(Long.class).single();
	}

	/** A number written into a statement, or the word null. Keys the tests made, never input. */
	private static String literal(Long key) {
		return key == null ? "null" : key.toString();
	}

	private void emptied(Holder holder, long row) {
		db.sql("update " + holder.table + " set " + holder.column + " = null where id = ?")
				.param(row).update();
	}

	private void pointedAt(Holder holder, long row, long photo) {
		db.sql("update " + holder.table + " set " + holder.column + " = ? where id = ?")
				.params(photo, row).update();
	}

	private void deleted(Holder holder, long row) {
		db.sql("delete from " + holder.table + " where id = ?").param(row).update();
	}

	private Long pointer(Holder holder, long row) {
		return db.sql("select " + holder.column + " from " + holder.table + " where id = ?")
				.param(row).query(Long.class).optional().orElse(null);
	}

	private boolean theRowStands(long photo) {
		return db.sql("select exists (select 1 from photo where id = ?)").param(photo)
				.query(Boolean.class).single();
	}
}
