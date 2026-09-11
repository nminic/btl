package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Every constraint the three tables of V13 carry, with the row that breaks it.
 *
 * <p>The inbox is kept and the six mandatory mails are not, and that line is P22's:
 * six messages are email and cannot be switched off, everything else is the bell.
 * A refusal from any queue arrives here with its reason, and that reason is what a
 * member rewrites his biography by, so it cannot be a mail he may have deleted.
 *
 * <p>Two things in this file are about one column being absent. A message with no
 * addressee is a message to the whole league, and reading is its own table because
 * that kind is read by different people at different times - one flag on the
 * message would be a single answer to a question with as many answers as there are
 * members.
 */
class InboxConstraintsTest extends DatabaseTest {

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

	/** The three tables V13 adds. */
	static final List<String> TABLES = List.of("message", "message_read", "notification_setting");

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_MEMBER = "(select id from competitor where member_number = '000970')";
	private static final String ANOTHER_MEMBER = "(select id from competitor where member_number = '000971')";
	private static final String A_MESSAGE = "(select id from message where subject = 'Zatecena poruka')";
	private static final String AN_INVITATION = "(select id from team_invitation limit 1)";
	private static final String AN_INVITE = "(select id from pair_invite limit 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS =
			"to_id, from_id, from_name, subject, body, team_invitation_id, pair_invite_id";

	private static String message(String values) {
		return "insert into message (" + COLUMNS + ") values (" + values + ")";
	}

	/** To one member, from another, and asking nothing. */
	private static final String GOOD_MESSAGE = message(A_MEMBER + ", " + ANOTHER_MEMBER
			+ ", 'Druga Clanica', 'Zdravo', 'Tekst poruke.', null, null");
	/** To the whole league, from the portal, which has no row in `competitor` at all. */
	private static final String GOOD_BROADCAST =
			message("null, null, 'Portal', 'Krupna izmena', 'Tekst.', null, null");
	/** And one that asks a question, which is what puts two buttons under it. */
	private static final String GOOD_QUESTION = message(A_MEMBER + ", " + ANOTHER_MEMBER
			+ ", 'Druga Clanica', 'Poziv u tim', '', " + AN_INVITATION + ", null");

	/**
	 * Two members, a team with an invitation, a pair invite, and one message
	 * already sitting in the inbox.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000970', 'Prvi', 'Primalac', 'M',"
				+ " date '1985-05-05', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '00112233445566a0', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000971', 'Druga', 'Clanica', 'F',"
				+ " date '1990-10-10', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '00112233445566a1', null, '', false, 'none', 'Otac', 'Ulica 2', 'S',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();

		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values ('tim-za-sanduce', 'Tim za sanduce', '', '', " + A_TOWN
				+ ", null, null, null, 2027, null)").update();
		db.sql("insert into team_invitation (team_id, competitor_id, season) values ((select id from team"
				+ " where slug = 'tim-za-sanduce'), " + A_MEMBER + ", 2027)").update();
		db.sql("insert into pair_invite (from_id, to_id) values (" + ANOTHER_MEMBER + ", " + A_MEMBER + ")")
				.update();

		db.sql(message(A_MEMBER + ", " + ANOTHER_MEMBER
				+ ", 'Druga Clanica', 'Zatecena poruka', 'Tekst.', null, null")).update();
		db.sql("insert into message_read (message_id, competitor_id) values (" + A_MESSAGE + ", "
				+ A_MEMBER + ")").update();
		db.sql("insert into notification_setting (competitor_id) values (" + A_MEMBER + ")").update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("message_id_not_null", "id",
						"insert into message (id, " + COLUMNS + ") values (null, " + A_MEMBER + ", null,"
								+ " 'Portal', 'Naslov', '', null, null)"),
				Violation.of("message_pk",
						"insert into message (id, " + COLUMNS + ") select id, " + A_MEMBER + ", null,"
								+ " 'Portal', 'Naslov', '', null, null from message limit 1"),

				Violation.of("message_to_fk",
						message("999999, null, 'Portal', 'Naslov', '', null, null")),
				Violation.of("message_from_fk",
						message(A_MEMBER + ", 999999, 'Neko', 'Naslov', '', null, null")),

				Violation.notNull("message_from_name_not_null", "from_name",
						message(A_MEMBER + ", null, null, 'Naslov', '', null, null")),
				Violation.of("message_from_name_not_blank",
						message(A_MEMBER + ", null, '   ', 'Naslov', '', null, null")),
				Violation.notNull("message_subject_not_null", "subject",
						message(A_MEMBER + ", null, 'Portal', null, '', null, null")),
				Violation.of("message_subject_not_blank",
						message(A_MEMBER + ", null, 'Portal', '   ', '', null, null")),
				Violation.notNull("message_body_not_null", "body",
						message(A_MEMBER + ", null, 'Portal', 'Naslov', null, null, null")),
				Violation.notNull("message_sent_at_not_null", "sent_at",
						"insert into message (" + COLUMNS + ", sent_at) values (" + A_MEMBER + ", null,"
								+ " 'Portal', 'Naslov', '', null, null, null)"),

				Violation.of("message_team_invitation_fk",
						message(A_MEMBER + ", null, 'Portal', 'Naslov', '', 999999, null")),
				Violation.of("message_pair_invite_fk",
						message(A_MEMBER + ", null, 'Portal', 'Naslov', '', null, 999999")),

				/* Two questions under one pair of buttons, and a question asked of nobody in
				   particular. The first row names an addressee so that the second constraint
				   is satisfied and this is the only thing it breaks. */
				Violation.of("message_asks_at_most_one_question",
						message(A_MEMBER + ", null, 'Portal', 'Naslov', '', " + AN_INVITATION + ", "
								+ AN_INVITE)),
				Violation.of("message_a_question_has_an_addressee",
						message("null, null, 'Portal', 'Naslov', '', " + AN_INVITATION + ", null")),
				Violation.of("message_a_question_has_an_addressee",
						message("null, null, 'Portal', 'Naslov', '', null, " + AN_INVITE)),

				/* WHO HAS READ WHAT. The key is the pair, so reading twice is the same fact. */
				Violation.notNull("message_read_message_id_not_null", "message_id",
						"insert into message_read (message_id, competitor_id) values (null, " + A_MEMBER + ")"),
				Violation.notNull("message_read_competitor_id_not_null", "competitor_id",
						"insert into message_read (message_id, competitor_id) values (" + A_MESSAGE + ", null)"),
				Violation.of("message_read_pk",
						"insert into message_read (message_id, competitor_id) values (" + A_MESSAGE + ", "
								+ A_MEMBER + ")"),
				Violation.of("message_read_message_fk",
						"insert into message_read (message_id, competitor_id) values (999999, " + A_MEMBER + ")"),
				Violation.of("message_read_competitor_fk",
						"insert into message_read (message_id, competitor_id) values (" + A_MESSAGE + ", 999999)"),
				Violation.notNull("message_read_read_at_not_null", "read_at",
						"insert into message_read (message_id, competitor_id, read_at) values (" + A_MESSAGE
								+ ", " + ANOTHER_MEMBER + ", null)"),

				/* THE SIX SWITCHES. The member's own id is the key, which is what says he has
				   one set of settings and not a list. */
				Violation.notNull("notification_setting_competitor_id_not_null", "competitor_id",
						"insert into notification_setting (competitor_id) values (null)"),
				Violation.of("notification_setting_pk",
						"insert into notification_setting (competitor_id) values (" + A_MEMBER + ")"),
				Violation.of("notification_setting_competitor_fk",
						"insert into notification_setting (competitor_id) values (999999)"),
				Violation.notNull("notification_setting_comment_mail_not_null", "comment_mail",
						"insert into notification_setting (competitor_id, comment_mail) values ("
								+ ANOTHER_MEMBER + ", null)"),
				Violation.notNull("notification_setting_team_mail_not_null", "team_mail",
						"insert into notification_setting (competitor_id, team_mail) values ("
								+ ANOTHER_MEMBER + ", null)"),
				Violation.notNull("notification_setting_pair_mail_not_null", "pair_mail",
						"insert into notification_setting (competitor_id, pair_mail) values ("
								+ ANOTHER_MEMBER + ", null)"),
				Violation.notNull("notification_setting_lift_mail_not_null", "lift_mail",
						"insert into notification_setting (competitor_id, lift_mail) values ("
								+ ANOTHER_MEMBER + ", null)"),
				Violation.notNull("notification_setting_badge_mail_not_null", "badge_mail",
						"insert into notification_setting (competitor_id, badge_mail) values ("
								+ ANOTHER_MEMBER + ", null)"),
				Violation.notNull("notification_setting_inbox_mail_not_null", "inbox_mail",
						"insert into notification_setting (competitor_id, inbox_mail) values ("
								+ ANOTHER_MEMBER + ", null)"));
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/** The floor under the list above, read out of the database. */
	@Test
	void everyConstraintOnTheThreeTablesHasARowThatBreaksIt() {
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

		assertThat(declared).isNotEmpty();
		assertThat(covered).containsExactlyInAnyOrderElementsOf(declared);
	}

	/** One of each shape the portal actually sends. */
	static List<String> legitimateRows() {
		return List.of(GOOD_MESSAGE, GOOD_BROADCAST, GOOD_QUESTION);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * The six switches are off until the member turns them on.
	 *
	 * <p>P22 decides this and gives the reason: "mejl zamor ubija dostavljivost",
	 * and a member who marks the league as junk stops receiving the six that
	 * matter. A default of true would be that, one row at a time.
	 */
	@Test
	void everySwitchIsOffWhenNobodyHasTouchedIt() {
		assertThat(db
				.sql("select comment_mail or team_mail or pair_mail or lift_mail or badge_mail or inbox_mail"
						+ " from notification_setting where competitor_id = " + A_MEMBER)
				.query(Boolean.class)
				.single())
				.as("a switch was on for somebody who never asked for it")
				.isFalse();
	}

	/**
	 * A message to the whole league is read by one member and stays unread for the
	 * other, which is the whole reason reading is its own table.
	 */
	@Test
	void twoMembersReadTheSameBroadcastSeparately() {
		db.sql(GOOD_BROADCAST).update();
		String broadcast = "(select id from message where subject = 'Krupna izmena')";

		db.sql("insert into message_read (message_id, competitor_id) values (" + broadcast + ", "
				+ A_MEMBER + ")").update();

		assertThat(db.sql("select count(*) from message_read where message_id = " + broadcast)
				.query(Long.class)
				.single())
				.as("reading it once marked it read for everybody")
				.isOne();

		assertThat(db.sql("insert into message_read (message_id, competitor_id) values (" + broadcast + ", "
				+ ANOTHER_MEMBER + ")").update())
				.as("the second member could not read a message the first had read")
				.isOne();
	}

	/**
	 * A message outlives the member who sent it, and keeps his name.
	 *
	 * <p>The same shape V7 gave a comment and V9 gave a decision: the pointer
	 * empties, the name stays, and the message is still readable by whoever it was
	 * sent to. Without it, asking to be deleted (PDL P23) would quietly rewrite
	 * other people's inboxes.
	 */
	@Test
	void theSenderMayGoAndTheMessageKeepsHisName() {
		assertThat(db.sql("delete from competitor where member_number = '000971'").update()).isOne();

		assertThat(db.sql("select from_name || ' | ' || coalesce(from_id::text, 'bez naloga') from message")
				.query(String.class)
				.single())
				.as("the message went with its sender, or kept pointing at somebody who is gone")
				.isEqualTo("Druga Clanica | bez naloga");
	}

	/**
	 * And the question goes when the thing it asks about goes.
	 *
	 * <p>An answered or withdrawn invitation leaves a message that is no longer a
	 * question, and the row would draw a button that does nothing.
	 */
	@Test
	void withdrawingTheInvitationTakesTheMessageThatAskedAboutIt() {
		db.sql(GOOD_QUESTION).update();

		assertThat(db.sql("select count(*) from message").query(Long.class).single()).isEqualTo(2L);

		db.sql("delete from team_invitation").update();

		assertThat(db.sql("select count(*) from message").query(Long.class).single())
				.as("a message still asks about an invitation that is gone")
				.isOne();
	}
}
