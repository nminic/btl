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
 * EVERY CONSTRAINT OF THE TRAIL V63 ADDS, {@code membership_change}, AND THAT IT IS WRITTEN ONCE.
 *
 * <p>The owner, 18.10.2026 (PDL P8): „Trag storna i promene osnova zivi u posebnom zapisu koji se ne
 * menja, BEZ iznosa. Nosi clana, sezonu, radnju, osnov pre i posle, ko i kada." So the cases below are
 * that sentence taken apart: every column it names is here and nothing else is, a row says the
 * member, the season, the action, the bases, who and when, and once written it does not change. The
 * shape is {@link BalanceConstraintsTest}'s, whose table this trail sits beside.
 */
class MembershipChangeConstraintsTest extends DatabaseTest {

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

	/** The table V63 adds. */
	static final List<String> TABLES = List.of("membership_change");

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String THE_MODERATOR = "(select id from account where email = 'moderator@primer.rs')";

	private static final String HIS_OWN_ACCOUNT = "(select id from account where email = 'clan@primer.rs')";

	private static final String THE_MEMBER = "(select id from competitor where member_number = '006000')";

	/** A second member, with no account, so that deleting him is not refused by V23's restrict. */
	private static final String A_MEMBER_WITH_NO_ACCOUNT =
			"(select id from competitor where member_number = '006001')";

	private static final String AN_INSTANT = "timestamptz '2026-10-18 09:00:00+00'";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS = "competitor_id, season, action, basis_before, basis_after,"
			+ " decided_by, decided_by_name, decided_at";

	private static String change(String values) {
		return "insert into membership_change (" + COLUMNS + ") values (" + values + ")";
	}

	private static String changeWithId(String id, String values) {
		return "insert into membership_change (id, " + COLUMNS + ") values (" + id + ", " + values + ")";
	}

	/** The rest of a good row after the member, so each violation changes exactly one thing. */
	private static final String A_GOOD_CANCELLATION = "2028, 'cancelled', 'payment', null, " + THE_MODERATOR
			+ ", 'Moderator Probni', " + AN_INSTANT;

	private static final String THE_ROW_ALREADY_THERE = change(THE_MEMBER + ", " + A_GOOD_CANCELLATION);

	private static final String THE_KEY_ALREADY_THERE = "(select id from membership_change order by id limit 1)";

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("membership_change_id_not_null", "id",
						changeWithId("null", THE_MEMBER + ", " + A_GOOD_CANCELLATION)),
				Violation.of("membership_change_pk",
						changeWithId(THE_KEY_ALREADY_THERE, A_MEMBER_WITH_NO_ACCOUNT + ", " + A_GOOD_CANCELLATION)),

				/* WHOSE: a trail about nobody, and about a member who does not exist. */
				Violation.notNull("membership_change_competitor_id_not_null", "competitor_id",
						change("null, " + A_GOOD_CANCELLATION)),
				Violation.of("membership_change_competitor_fk", change("999999, " + A_GOOD_CANCELLATION)),

				/* WHICH SEASON, and never one before the league. */
				Violation.notNull("membership_change_season_not_null", "season",
						change(THE_MEMBER + ", null, 'cancelled', 'payment', null, " + THE_MODERATOR
								+ ", 'Moderator Probni', " + AN_INSTANT)),
				Violation.of("membership_change_season_not_before_the_league",
						change(THE_MEMBER + ", 2026, 'cancelled', 'payment', null, " + THE_MODERATOR
								+ ", 'Moderator Probni', " + AN_INSTANT)),

				/* WHAT WAS DONE. The unknown action carries a basis after, so the rule about what a
				   cancellation leaves is satisfied and this row breaks the vocabulary alone. */
				Violation.notNull("membership_change_action_not_null", "action",
						change(THE_MEMBER + ", 2028, null, 'payment', 'feeExempt', " + THE_MODERATOR
								+ ", 'Moderator Probni', " + AN_INSTANT)),
				Violation.of("membership_change_action_known",
						change(THE_MEMBER + ", 2028, 'paused', 'payment', 'feeExempt', " + THE_MODERATOR
								+ ", 'Moderator Probni', " + AN_INSTANT)),

				/* THE BASIS BEFORE, always there, and one of the three. */
				Violation.notNull("membership_change_basis_before_not_null", "basis_before",
						change(THE_MEMBER + ", 2028, 'basisChanged', null, 'payment', " + THE_MODERATOR
								+ ", 'Moderator Probni', " + AN_INSTANT)),
				Violation.of("membership_change_basis_before_known",
						change(THE_MEMBER + ", 2028, 'basisChanged', 'honorary', 'payment', " + THE_MODERATOR
								+ ", 'Moderator Probni', " + AN_INSTANT)),

				/* THE BASIS AFTER, one of the three when there is one. */
				Violation.of("membership_change_basis_after_known",
						change(THE_MEMBER + ", 2028, 'basisChanged', 'payment', 'honorary', " + THE_MODERATOR
								+ ", 'Moderator Probni', " + AN_INSTANT)),

				/* A CANCELLATION LEAVES NO BASIS AND ONLY A CANCELLATION DOES: broken from both sides. */
				Violation.of("membership_change_a_cancellation_leaves_no_basis",
						change(THE_MEMBER + ", 2028, 'cancelled', 'payment', 'feeExempt', " + THE_MODERATOR
								+ ", 'Moderator Probni', " + AN_INSTANT)),
				Violation.of("membership_change_a_cancellation_leaves_no_basis",
						change(THE_MEMBER + ", 2028, 'basisChanged', 'payment', null, " + THE_MODERATOR
								+ ", 'Moderator Probni', " + AN_INSTANT)),

				/* AND A CHANGE CHANGES SOMETHING. */
				Violation.of("membership_change_a_change_changes_the_basis",
						change(THE_MEMBER + ", 2028, 'basisChanged', 'payment', 'payment', " + THE_MODERATOR
								+ ", 'Moderator Probni', " + AN_INSTANT)),

				/* WHO, by an account that exists, and by a name that says something. */
				Violation.of("membership_change_decided_by_fk",
						change(THE_MEMBER + ", 2028, 'cancelled', 'payment', null, 999999,"
								+ " 'Moderator Probni', " + AN_INSTANT)),
				Violation.notNull("membership_change_decided_by_name_not_null", "decided_by_name",
						change(THE_MEMBER + ", 2028, 'cancelled', 'payment', null, " + THE_MODERATOR
								+ ", null, " + AN_INSTANT)),
				Violation.of("membership_change_decided_by_name_not_blank",
						change(THE_MEMBER + ", 2028, 'cancelled', 'payment', null, " + THE_MODERATOR
								+ ", '   ', " + AN_INSTANT)),

				/* WHEN. */
				Violation.notNull("membership_change_decided_at_not_null", "decided_at",
						change(THE_MEMBER + ", 2028, 'cancelled', 'payment', null, " + THE_MODERATOR
								+ ", 'Moderator Probni', null")));
	}

	@BeforeEach
	void aMemberHisAccountAModeratorAndOneLineOfTrail() {
		competitor("006000", "Clan", "00112233445566d1");
		competitor("006001", "Bez Naloga", "00112233445566d2");

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Moderator',"
				+ " 'Probni', 'moderator@primer.rs', (select id from role where code = 'moderator'))")
				.update();
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values ('Probni',"
				+ " 'Clan', 'clan@primer.rs', (select id from role where code = 'moderator'), " + THE_MEMBER + ")")
				.update();

		db.sql(THE_ROW_ALREADY_THERE).update();
	}

	private void competitor(String number, String last, String code) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true, "
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, last, code).update();
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
	void everyConstraintOnTheseTablesHasARowThatBreaksIt() {
		String literals = TABLES.stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));
		String relations = " = any (array[" + literals + "]::regclass[])";

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
		assertThat(covered)
				.as("every constraint on %s needs a row above that breaks it", TABLES)
				.containsExactlyInAnyOrderElementsOf(declared);
	}

	static List<String> legitimateRows() {
		return List.of(
				change(THE_MEMBER + ", 2028, 'cancelled', 'payment', null, " + THE_MODERATOR
						+ ", 'Moderator Probni', " + AN_INSTANT),
				change(THE_MEMBER + ", 2028, 'cancelled', 'feeExempt', null, " + THE_MODERATOR
						+ ", 'Moderator Probni', " + AN_INSTANT),
				change(THE_MEMBER + ", 2028, 'cancelled', 'balance', null, " + THE_MODERATOR
						+ ", 'Moderator Probni', " + AN_INSTANT),
				change(THE_MEMBER + ", 2028, 'basisChanged', 'payment', 'feeExempt', " + THE_MODERATOR
						+ ", 'Moderator Probni', " + AN_INSTANT),
				change(THE_MEMBER + ", 2028, 'basisChanged', 'feeExempt', 'payment', " + THE_MODERATOR
						+ ", 'Moderator Probni', " + AN_INSTANT),
				/* „Moderator i superadmin smeju da rade na sopstvenom redu, uz trag koji ih imenuje"
				   (18.10.2026): the member's own account acting on his own season. */
				change(THE_MEMBER + ", 2028, 'basisChanged', 'payment', 'feeExempt', " + HIS_OWN_ACCOUNT
						+ ", 'Probni Clan', " + AN_INSTANT),
				/* And an account already gone, its name standing. */
				change(THE_MEMBER + ", 2028, 'cancelled', 'payment', null, null, 'Moderator Probni', "
						+ AN_INSTANT));
	}

	/** A row that breaks nothing goes in, so no constraint above may be one that refuses everything. */
	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * THESE COLUMNS AND NO OTHERS, and the one that must never arrive is an amount: „BEZ iznosa ...
	 * Iznos se ne belezi, u skladu sa odlukom da se zapis o uplati brise" (18.10.2026).
	 */
	@Test
	void theTrailCarriesTheseColumnsAndNoAmount() {
		assertThat(db.sql("select column_name from information_schema.columns where table_schema ="
						+ " current_schema() and table_name = 'membership_change' order by ordinal_position")
				.query(String.class).list())
				.containsExactly("id", "competitor_id", "season", "action", "basis_before", "basis_after",
						"decided_by", "decided_by_name", "decided_at");
	}

	/** A line of the trail is written once. Asked over the season, which a correction would move. */
	@Test
	void theSeasonOnALineCannotBeRewritten() {
		assertThatThrownBy(() -> db.sql("update membership_change set season = 2029").update())
				.hasMessageContaining("cannot be changed once written");
	}

	/** Nor who did it, which is a second case because the first refusal aborts the transaction. */
	@Test
	void whoDidItCannotBeRewrittenEither() {
		assertThatThrownBy(() -> db.sql("update membership_change set decided_by_name = 'Neko Drugi'").update())
				.hasMessageContaining("cannot be changed once written");
	}

	/** Nor pointed at another account: the key may be forgotten, never re-pointed. */
	@Test
	void theAccountMayNotBePointedAtSomebodyElse() {
		assertThatThrownBy(() -> db.sql("update membership_change set decided_by = " + HIS_OWN_ACCOUNT).update())
				.hasMessageContaining("cannot be made to name somebody else");
	}

	/**
	 * BUT THE ACCOUNT MAY GO, and the line stays with the name it was written under (PDL P23; the
	 * cascade arrives as an update, which is why the trigger lets that one key go to null).
	 */
	@Test
	void deletingTheAccountEmptiesThePointerAndKeepsTheName() {
		db.sql("delete from account where email = 'moderator@primer.rs'").update();

		assertThat(db.sql("select coalesce(decided_by::text, 'gone') || ' ' || decided_by_name"
						+ " from membership_change").query(String.class).list())
				.containsExactly("gone Moderator Probni");
	}

	/** And the trail of a member goes with him, the direction his book and his seasons take. */
	@Test
	void deletingAMemberTakesHisTrailWithHim() {
		db.sql(change(A_MEMBER_WITH_NO_ACCOUNT + ", " + A_GOOD_CANCELLATION)).update();

		db.sql("delete from competitor where member_number = '006001'").update();

		assertThat(db.sql("select c.member_number from membership_change t join competitor c"
						+ " on c.id = t.competitor_id").query(String.class).list())
				.containsExactly("006000");
	}
}
