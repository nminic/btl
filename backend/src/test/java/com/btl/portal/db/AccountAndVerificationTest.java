package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What the account and the confirmation link do, as opposed to what they refuse.
 *
 * AccountConstraintsTest owns the refusals, one row per constraint. This file
 * owns the four sentences the owner and PDL wrote that no single constraint can
 * carry, and each one is here because reverting it would otherwise leave the
 * suite green:
 *
 * <ul>
 * <li><b>Two things are called activation and they are not the same thing.</b>
 * PDL, in its own words: activating the ACCOUNT is the member confirming his
 * address by clicking the link, and activating the MEMBERSHIP is a payment
 * recorded or honorary membership, whereupon he gets a member number. And,
 * answered on 11.08.2026: membership may be activated before the address is
 * confirmed. Neither follows from the other, in either direction.</li>
 *
 * <li><b>An account is not a member.</b> A competitor is eighteen fields and a
 * member number; an account is four columns and exists before any of them.</li>
 *
 * <li><b>The link is stored as a digest and never as itself</b> (ADL A8), so
 * whoever reads this table can activate nobody.</li>
 *
 * <li><b>Every link has an end, and the schema says when: twenty four hours</b>
 * ([ODLUKA 08.09.2026, vlasnik], ADL A38). Held as a default rather than as an
 * interval the backend remembers, so a row written by anything at all still gets
 * an end, and held loosely enough that a row which names its own end keeps
 * it.</li>
 * </ul>
 *
 * Three of these are asked of {@code information_schema} and
 * {@code pg_constraint} rather than of a list written here, which is what makes
 * them complete: a column added to either table fails whatever it is called, and
 * a rule conditioned on the confirmation fails wherever in the schema somebody
 * puts it.
 */
class AccountAndVerificationTest extends DatabaseTest {

	private static final String COMPETITOR = "(select id from role where code = 'competitor')";
	private static final String VISITOR = "(select id from role where code = 'visitor')";

	/* Sixty four lowercase hexadecimal characters. See AccountConstraintsTest for
	   why the patterns are obvious rather than plausible. */
	private static final String ONE_HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
	private static final String ANOTHER_HASH = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
	private static final String THIRD_HASH = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

	/* An end the caller names, and it is deliberately nowhere near twenty four
	   hours from now: the column has a default, so a fixture that happened to
	   agree with it would leave every case below unable to say which of the two
	   wrote the row. */
	private static final String AN_INSTANT = "timestamptz '2027-01-01 00:00:00+00'";

	/**
	 * The account carries its address, its role and whether the address is
	 * confirmed, and nothing else.
	 *
	 * This is the guard against the two activations being collapsed into one row,
	 * and it is complete by construction rather than by a list of forbidden
	 * names: a member number, a paid flag, an activated_at, a name, a date of
	 * birth, anything at all added to this table fails here, whatever it is
	 * called. Membership activation gives out the member number and belongs to
	 * the member, which is a table this migration does not write.
	 *
	 * The boundary, said here rather than left for a review: the day the member
	 * table arrives, holding the two apart becomes a statement about two tables
	 * and this one will have to grow a second half.
	 */
	@Test
	void theAccountCarriesItsAddressItsRoleAndItsConfirmationAndNothingElse() {
		assertThat(columnsOf("account"))
				.containsExactlyInAnyOrder("id", "email", "role_id", "email_confirmed_at");
	}

	/**
	 * And the link carries the digest, its account and its end, and nothing else.
	 *
	 * The same move, and here it is what holds the digest: a column added beside
	 * {@code token_hash} to keep the token as it travels in the message fails
	 * here, and so does replacing {@code token_hash} with one called
	 * {@code token}. The shape of what goes in it is the other half and is
	 * AccountConstraintsTest's.
	 */
	@Test
	void theLinkCarriesItsDigestItsAccountAndItsEndAndNothingElse() {
		assertThat(columnsOf("email_verification_token"))
				.containsExactlyInAnyOrder("id", "account_id", "token_hash", "expires_at");
	}

	/**
	 * An account is born with its address unconfirmed.
	 *
	 * Existing is not being confirmed, and this is what fails the moment somebody
	 * gives the column a default or makes it NOT NULL: every account would then
	 * be born activated and the click on the link would confirm what was already
	 * true.
	 *
	 * A second account, already confirmed, is here so that the answer can only
	 * come from the row being asked about. With one row in the table the query
	 * and a query with no WHERE at all give the same word, and the case would
	 * measure nothing.
	 */
	@Test
	void anAccountIsBornWithItsAddressUnconfirmed() {
		db.sql("insert into account (email, role_id, email_confirmed_at) values ('stari@primer.rs', " + COMPETITOR
				+ ", " + AN_INSTANT + ")").update();
		db.sql("insert into account (email, role_id) values ('nov@primer.rs', " + COMPETITOR + ")").update();

		assertThat(db.sql("select email_confirmed_at is null from account where email = 'nov@primer.rs'")
				.query(Boolean.class)
				.single())
				.isTrue();
	}

	/**
	 * No rule anywhere in this schema is conditioned on the address being
	 * confirmed.
	 *
	 * This is the sentence of 11.08.2026 held as a measurement: membership may be
	 * activated before the address is confirmed, so nothing may be gated on the
	 * confirmation. Read out of the catalogue over the WHOLE schema and not over
	 * these two tables, because the rule that merges the two states is exactly
	 * the one somebody would put on the other table.
	 *
	 * Both catalogues, for the same reason AccountConstraintsTest reads both: a
	 * partial index with {@code where email_confirmed_at is not null} is a rule
	 * about confirmed accounts that {@code pg_constraint} would never mention.
	 */
	@Test
	void noRuleInTheSchemaIsConditionedOnTheAddressBeingConfirmed() {
		List<String> rules = db
				.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ " union all "
						+ "select indexdef from pg_indexes where schemaname = current_schema()")
				.query(String.class)
				.list();

		/* Not empty, so a query that found nothing cannot pass for a schema with
		   nothing to find. */
		assertThat(rules).isNotEmpty();
		assertThat(rules).noneMatch(rule -> rule.contains("email_confirmed_at"));
	}

	/**
	 * Confirming the address and the role the account holds do not follow each
	 * other, in either direction.
	 *
	 * Both rows go in. A competitor whose address is not confirmed is the ordinary
	 * state between registering and clicking the link, and "registrovan a
	 * neplacen" is a state of a competitor rather than a role of its own
	 * (ADL A8), so nothing may read the role as an answer about activation. A
	 * visitor whose address IS confirmed is the other direction, and it is here
	 * because a schema that let only one of the two through would have decided
	 * that confirming the address is what promotes somebody.
	 *
	 * The third row is a second competitor, and it is the cardinality: nothing
	 * says an account is alone in its role, and a unique key on {@code role_id}
	 * would mean the portal could hold one competitor.
	 *
	 * The role is read back and not only written, which is what makes the two
	 * halves two halves. Asserting only which addresses are confirmed would give
	 * the same answer if all three rows were competitors, and the case would then
	 * say nothing about the role at all.
	 */
	@Test
	void confirmingTheAddressAndTheRoleDoNotFollowEachOther() {
		db.sql("insert into account (email, role_id) values ('ceka@primer.rs', " + COMPETITOR + ")").update();
		db.sql("insert into account (email, role_id, email_confirmed_at) values ('gost@primer.rs', " + VISITOR + ", "
				+ AN_INSTANT + ")").update();
		db.sql("insert into account (email, role_id) values ('drugi@primer.rs', " + COMPETITOR + ")").update();

		assertThat(waiting("email_confirmed_at is null"))
				.containsExactly("ceka@primer.rs competitor", "drugi@primer.rs competitor");

		assertThat(waiting("email_confirmed_at is not null")).containsExactly("gost@primer.rs visitor");
	}

	private List<String> waiting(String condition) {
		return db
				.sql("select a.email || ' ' || r.code from account a join role r on r.id = a.role_id"
						+ " where " + condition + " order by a.email")
				.query(String.class)
				.list();
	}

	/**
	 * The schema chooses the lifetime of a link and does not choose the moment of
	 * confirmation.
	 *
	 * The asymmetry is the point and both halves are decisions. A link runs out on
	 * a clock, so the clock belongs to the column ([ODLUKA 08.09.2026, vlasnik],
	 * ADL A38); an address is confirmed by a member clicking, so nothing but the
	 * click may write that instant, and a default there would confirm every
	 * account at birth.
	 *
	 * The interval is asked for by name and not merely counted, because inside a
	 * transaction {@code interval '24 hours'} and {@code interval '1 day'} put the
	 * end at the same instant and no measurement below can tell them apart. They
	 * are not the same rule: a day is a calendar day, so on the night the clocks
	 * change it is twenty three hours or twenty five. What comes back here has
	 * been parsed and normalised by PostgreSQL rather than read off the file, so
	 * {@code interval '1440 minutes'} is the same answer and {@code interval '1
	 * day'} is a different one, which is exactly the line that matters.
	 *
	 * {@code id} is the third answer, and it is here so that a query answering the
	 * same word to everything cannot pass: one column has no default and two do.
	 * What the default DOES is behaviour and is measured below.
	 */
	@Test
	void theSchemaChoosesTheLifetimeOfALinkAndNotTheMomentOfConfirmation() {
		assertThat(defaultOf("email_verification_token", "expires_at"))
				.as("hours and not days, because a day is twenty three or twenty five of them twice a year")
				.isEqualTo("(now() + '24:00:00'::interval)");

		assertThat(defaultOf("account", "email_confirmed_at")).isEqualTo(NO_DEFAULT);
		assertThat(defaultOf("email_verification_token", "id")).isNotEqualTo(NO_DEFAULT);
	}

	/**
	 * A link written without an end lasts twenty four hours, and one written with
	 * an end keeps the end it was given.
	 *
	 * [ODLUKA 08.09.2026, vlasnik], ADL A38, in his words: long enough that
	 * somebody who opens his mail the next morning still gets in, short enough
	 * that a link out of an old message is not live for months.
	 *
	 * Two rows and not one, because with one row every value below could have come
	 * from somewhere else. The row that says nothing is asked how far its end is
	 * from {@code now()}, which is the other source of that instant and the only
	 * one that would still answer twenty four hours if the default were the clock
	 * rather than a date somebody typed. The row that names its own end is what
	 * makes this a floor and not a ceiling: a generated column, or a trigger, or a
	 * check demanding the interval would all pass the first assertion and fail
	 * here, and the backend has to be able to shorten a link.
	 *
	 * The two rows are told apart by their digest and not by being alone in the
	 * table, so neither answer can be the other row's.
	 *
	 * Which interval was written is a different question and is asked above: these
	 * two rows would answer the same to a day as to twenty four hours.
	 */
	@Test
	void aLinkWrittenWithoutAnEndLastsTwentyFourHoursAndOneWrittenWithAnEndKeepsIt() {
		db.sql("insert into account (email, role_id) values ('rok@primer.rs', " + COMPETITOR + ")").update();

		issueWithoutAnEnd("rok@primer.rs", ONE_HASH);
		issue("rok@primer.rs", ANOTHER_HASH);

		assertThat(db
				.sql("select extract(epoch from (expires_at - now()))::bigint from email_verification_token"
						+ " where token_hash = '" + ONE_HASH + "'")
				.query(Long.class)
				.single())
				.isEqualTo(86_400L);

		assertThat(db
				.sql("select expires_at = " + AN_INSTANT + " from email_verification_token where token_hash = '"
						+ ANOTHER_HASH + "'")
				.query(Boolean.class)
				.single())
				.isTrue();
	}

	/** A link whose end nobody names, which is what leaves it to the column. */
	private void issueWithoutAnEnd(String email, String hash) {
		db.sql("insert into email_verification_token (account_id, token_hash) values ("
				+ "(select id from account where email = '" + email + "'), '" + hash + "')")
				.update();
	}

	/**
	 * One account may have more than one link waiting at a time.
	 *
	 * ADL-posta asks for a button that sends the confirmation again, because the
	 * first message can land in the junk folder and a confirmation that never
	 * arrives is an interrupted payment rather than an inconvenience. So a second
	 * link has to be issuable, and a unique key on {@code account_id} would refuse
	 * it. Whether issuing the second retires the first is not decided anywhere
	 * and the schema does not decide it either.
	 *
	 * A second account with a link of its own is here so that the two counted are
	 * counted because they belong to this account. With one account in the table
	 * the join carries nothing and the same two would be the answer to "how many
	 * links are there".
	 */
	@Test
	void oneAccountMayHaveMoreThanOneLinkWaiting() {
		db.sql("insert into account (email, role_id) values ('ponovo@primer.rs', " + COMPETITOR + ")").update();
		db.sql("insert into account (email, role_id) values ('jednom@primer.rs', " + COMPETITOR + ")").update();

		issue("ponovo@primer.rs", ONE_HASH);
		issue("ponovo@primer.rs", ANOTHER_HASH);
		issue("jednom@primer.rs", THIRD_HASH);

		assertThat(db.sql("select count(*) from email_verification_token t join account a on a.id = t.account_id"
				+ " where a.email = 'ponovo@primer.rs'").query(Long.class).single())
				.isEqualTo(2);
	}

	/**
	 * A link does not outlive the account it opens.
	 *
	 * A member may ask to be deleted (PDL P23), and an account deleted while a
	 * live link still pointed at it would leave an address in somebody's mailbox
	 * that still activates something. Both links go, not just the last one.
	 */
	@Test
	void aLinkDoesNotOutliveTheAccountItOpens() {
		db.sql("insert into account (email, role_id) values ('odlazi@primer.rs', " + COMPETITOR + ")").update();
		db.sql("insert into account (email, role_id) values ('ostaje@primer.rs', " + COMPETITOR + ")").update();

		issue("odlazi@primer.rs", ONE_HASH);
		issue("odlazi@primer.rs", ANOTHER_HASH);
		issue("ostaje@primer.rs", THIRD_HASH);

		db.sql("delete from account where email = 'odlazi@primer.rs'").update();

		/* The one that stays is the point: a cascade that took every link would
		   pass a count of zero just as well. */
		assertThat(db.sql("select count(*) from email_verification_token").query(Long.class).single()).isEqualTo(1);
		assertThat(db.sql("select a.email from email_verification_token t join account a on a.id = t.account_id")
				.query(String.class).single())
				.isEqualTo("ostaje@primer.rs");
	}

	private void issue(String email, String hash) {
		db.sql("insert into email_verification_token (account_id, token_hash, expires_at) values ("
				+ "(select id from account where email = '" + email + "'), '" + hash + "', " + AN_INSTANT + ")")
				.update();
	}

	private List<String> columnsOf(String table) {
		return db
				.sql("select column_name from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = ?")
				.param(table)
				.query(String.class)
				.list();
	}

	/** What {@link #defaultOf(String, String)} says where there is no default. */
	private static final String NO_DEFAULT = "<no default>";

	/**
	 * The default PostgreSQL recorded, as PostgreSQL writes it back.
	 *
	 * Not the text of the migration. What comes back has been parsed and
	 * normalised, so {@code interval '1440 minutes'} and {@code interval '24
	 * hours'} are one answer here while {@code interval '1 day'} is another, and
	 * that is the difference no measurement inside a transaction can see.
	 *
	 * Coalesced rather than returned as a null, for two reasons: a missing default
	 * fails on a word somebody can read, and a column that is not there at all is
	 * an empty result and a loud failure rather than a null that reads like "no
	 * default".
	 */
	private String defaultOf(String table, String column) {
		return db
				.sql("select coalesce(column_default, '" + NO_DEFAULT + "') from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = ? and column_name = ?")
				.param(table)
				.param(column)
				.query(String.class)
				.single();
	}
}
