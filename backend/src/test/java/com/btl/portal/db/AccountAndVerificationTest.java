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
 * <li><b>Every link has an end, and the schema does not say when.</b>
 * PRED-BAZU-ANALIZA O9 lists the lifetime of a token among the four things
 * nobody has written down, so a number here would be an assumption in the one
 * place that cannot hold one.</li>
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

	/* An arbitrary instant, and arbitrary on purpose: the migration chooses no
	   lifetime and neither does this file. */
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
	 */
	@Test
	void anAccountIsBornWithItsAddressUnconfirmed() {
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
	 */
	@Test
	void confirmingTheAddressAndTheRoleDoNotFollowEachOther() {
		db.sql("insert into account (email, role_id) values ('ceka@primer.rs', " + COMPETITOR + ")").update();
		db.sql("insert into account (email, role_id, email_confirmed_at) values ('gost@primer.rs', " + VISITOR + ", "
				+ AN_INSTANT + ")").update();
		db.sql("insert into account (email, role_id) values ('drugi@primer.rs', " + COMPETITOR + ")").update();

		assertThat(db.sql("select email from account where email_confirmed_at is null order by email")
				.query(String.class).list())
				.containsExactly("ceka@primer.rs", "drugi@primer.rs");

		assertThat(db.sql("select email from account where email_confirmed_at is not null").query(String.class).list())
				.containsExactly("gost@primer.rs");
	}

	/**
	 * The schema chooses neither the moment of confirmation nor the lifetime of a
	 * link.
	 *
	 * Both columns carry no default, and that is the decision rather than an
	 * omission. How long a confirmation link lasts is not written down anywhere
	 * (PRED-BAZU-ANALIZA O9, in as many words), so the column exists, NOT NULL,
	 * and the backend supplies the instant; the day the owner picks a number it
	 * goes there and the migration does not move. A default of an interval from
	 * now would be that number, written by me, in a migration that cannot be
	 * edited once it is merged.
	 */
	@Test
	void theSchemaChoosesNeitherTheMomentOfConfirmationNorTheLifetimeOfALink() {
		assertThat(hasNoDefault("account", "email_confirmed_at")).isTrue();
		assertThat(hasNoDefault("email_verification_token", "expires_at")).isTrue();

		/* And the one column here that does have a default, so a query answering
		   yes to everything cannot pass for two columns without one. */
		assertThat(hasNoDefault("email_verification_token", "id")).isFalse();
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
	 */
	@Test
	void oneAccountMayHaveMoreThanOneLinkWaiting() {
		db.sql("insert into account (email, role_id) values ('ponovo@primer.rs', " + COMPETITOR + ")").update();

		issue("ponovo@primer.rs", ONE_HASH);
		issue("ponovo@primer.rs", ANOTHER_HASH);

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
		issue("ostaje@primer.rs", "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");

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

	/**
	 * Asked as a question with a yes or no answer rather than by reading the
	 * default back, so a column that is not there is an empty result and a loud
	 * failure instead of a null that reads like "no default".
	 */
	private Boolean hasNoDefault(String table, String column) {
		return db
				.sql("select column_default is null from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = ? and column_name = ?")
				.param(table)
				.param(column)
				.query(Boolean.class)
				.single();
	}
}
