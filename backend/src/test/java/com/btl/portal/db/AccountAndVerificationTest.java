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
 * recorded membership or one the board has exempted from the fee, whereupon he
 * gets a member number. And,
 * answered on 11.08.2026: membership may be activated before the address is
 * confirmed. Neither follows from the other, in either direction.</li>
 *
 * <li><b>An account is not a member, and since V23 it may NAME one without being
 * one.</b> A competitor is a member number, a register of members and a season;
 * an account is a login that exists before any of that and, for a moderator who
 * does not race, instead of it.</li>
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
	 * The account carries its address, its role, whether the address is confirmed,
	 * what signing in needs, the name of whoever owns it and the member he is, and
	 * nothing else.
	 *
	 * This is the guard against the two activations being collapsed into one row,
	 * and it is complete by construction rather than by a list of forbidden
	 * names: a member number, a paid flag, an activated_at, a date of birth,
	 * anything at all added to this table fails here, whatever it is
	 * called. Membership activation gives out the member number and belongs to
	 * the member, which is a table this migration does not write.
	 *
	 * The boundary that stood here from the beginning has now been crossed and the
	 * sentence is rewritten rather than left to be read the old way. It said: the
	 * day the member table arrives, holding the two apart becomes a statement about
	 * two tables and this one will have to grow a second half. That day is
	 * 14.09.2026. The two are still apart and the statement below is still about
	 * this table alone, because what V23 added is a POINTER and a NAME, not the
	 * member's own fields: no member number, no date of birth, no basis of
	 * membership, nothing that {@code competitor} answers for. The second half is
	 * {@link #theAccountMayBelongToNobodyAndKeepsItsOwnNameWhenTheMemberGoes()},
	 * which is where the pointer is measured as behaviour.
	 */
	@Test
	void theAccountCarriesItsAddressItsRoleAndItsConfirmationAndNothingElse() {
		assertThat(columnsOf("account"))
				.containsExactlyInAnyOrder("id", "email", "role_id", "email_confirmed_at",
						/* V18, and all three of these are about signing in rather than about who
						   somebody is: what the password hashes to, how many tries have missed
						   since the last one that did not, and until when the account is shut. */
						"password_hash", "failed_sign_ins", "locked_until",
						/* V23. „Ime i prezime nosi sam nalog" (owner, 14.09.2026): the name of
						   whoever owns the login, which is not the same fact as the name in the
						   register of members and does not replace it. And the member this
						   account belongs to, if there is one at all. */
						"first_name", "last_name", "competitor_id");
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
		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at) values ('Probni', 'Probic', 'stari@primer.rs', " + COMPETITOR
				+ ", " + AN_INSTANT + ")").update();
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', 'nov@primer.rs', " + COMPETITOR + ")").update();

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
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', 'ceka@primer.rs', " + COMPETITOR + ")").update();
		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at) values ('Probni', 'Probic', 'gost@primer.rs', " + VISITOR + ", "
				+ AN_INSTANT + ")").update();
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', 'drugi@primer.rs', " + COMPETITOR + ")").update();

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
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', 'rok@primer.rs', " + COMPETITOR + ")").update();

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
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', 'ponovo@primer.rs', " + COMPETITOR + ")").update();
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', 'jednom@primer.rs', " + COMPETITOR + ")").update();

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
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', 'odlazi@primer.rs', " + COMPETITOR + ")").update();
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', 'ostaje@primer.rs', " + COMPETITOR + ")").update();

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

	/**
	 * AN ACCOUNT MAY BELONG TO NOBODY, AND WHEN THE MEMBER GOES IT KEEPS ITS OWN NAME.
	 *
	 * <p>Both halves of V23's foreign key, and neither of them is a refusal, so neither
	 * can live in AccountConstraintsTest. What that file holds is the pair of rules that
	 * say no: a member who is not there, and a second account on a member somebody already
	 * has. What is here is what the key ALLOWS, which is the half a reviewer never sees
	 * fail.
	 *
	 * <p><b>The moderator who does not race.</b> „Jedan nalog je tacno jedan clan" means
	 * at most one, not exactly one - the owner said so in the same breath, on 14.09.2026,
	 * and the whole reason the name went onto the account is that a moderator may have no
	 * competitor record at all. So the column is nullable, and this is the case that fails
	 * the moment somebody writes NOT NULL on it: {@code moderator@primer.rs} could not be
	 * opened, and the screen this increment serves would have nobody on it.
	 *
	 * <p><b>And ON DELETE SET NULL, which is a decision with two alternatives that both
	 * run.</b> CASCADE would take the login away with the member - and with it his live
	 * confirmation links and his pointer in every verification he ever decided - so
	 * deleting a MEMBER would silently delete an ADMINISTRATOR. RESTRICT would refuse the
	 * one deletion the member has a right to (PDL P23). The assertion that tells the three
	 * apart is not that the member is gone, which is true under all three: it is that the
	 * ACCOUNT IS STILL THERE, still signs in, and still says whose it is out of its own two
	 * columns rather than out of the row that has just been deleted. That last part is what
	 * makes SET NULL honest here at all, and it is why the name and the pointer arrived in
	 * one migration.
	 *
	 * <p><b>Two members and two accounts, so that nothing read back is the only one of its
	 * kind.</b> The account that keeps its member is what keeps a cascade emptying the
	 * whole column from passing as "the pointer was cleared", and the member who is not
	 * deleted is what keeps a delete of every competitor from passing as "his member was
	 * deleted". The name on the account is different from the name on his competitor
	 * record on purpose: with one name in the fixture, an account that had somehow been
	 * reading the member's name would answer identically.
	 */
	@Test
	void theAccountMayBelongToNobodyAndKeepsItsOwnNameWhenTheMemberGoes() {
		competitor("001000", "Trkacki", "Zapis");
		competitor("001001", "Drugi", "Trkac");

		/* The moderator who does not race, and he goes in with no member at all. */
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Moderatorka', 'Bez Trke', 'moderator@primer.rs',"
						+ " (select id from role where code = 'moderator'))")
				.update();

		account("trci@primer.rs", "Nalogovo", "Ime", "001000");
		account("ostaje@primer.rs", "Treci", "Nalog", "001001");

		assertThat(db.sql("select count(*) from account where competitor_id is null").query(Long.class).single())
				.as("an account with no member could not be written, and that is the moderator who does not race")
				.isEqualTo(1);

		db.sql("delete from competitor where member_number = '001000'").update();

		/* The account is still there, and it still says whose it is. Read as one string so
		   that a row which survived with an emptied NAME cannot pass for a row that kept
		   it. */
		assertThat(db.sql("select first_name || ' ' || last_name from account where email = 'trci@primer.rs'")
				.query(String.class).optional())
				.as("deleting the member took the account with it, or emptied the name on it")
				.contains("Nalogovo Ime");

		assertThat(db.sql("select competitor_id from account where email = 'trci@primer.rs'")
				.query(Long.class).optional())
				.as("the account still points at a member who has been deleted")
				.isEmpty();

		/* And the other account did not lose its member, which is what separates SET NULL
		   from a cascade that emptied the column. */
		assertThat(db.sql("select c.member_number from account a join competitor c on c.id = a.competitor_id"
				+ " where a.email = 'ostaje@primer.rs'").query(String.class).optional())
				.as("an account that names another member lost him too")
				.contains("001001");
	}

	/**
	 * AND THE NAME ON THE ACCOUNT SORTS BY THE SERBIAN ALPHABET, on both columns.
	 *
	 * <p>ADL A36 O21 is one decision about names and not one about {@code competitor}, so
	 * the day an account carries a name it carries the tailoring too. Without it the two
	 * tables would sort their names differently from each other, which is worse than
	 * either answer on its own.
	 *
	 * <p><b>Both columns, because the collation is written per column and a mutation that
	 * drops it from one leaves the other answering.</b> The rows are arranged so that
	 * ordering by the given name and ordering by the surname give DIFFERENT orders, so
	 * each of the two assertions moves on its own and neither can be satisfied by the
	 * other's column.
	 *
	 * <p><b>Three rows and not two, and the third is what tells the tailoring apart from
	 * every other collation rather than only from the untailored ones.</b> The first two
	 * separate {@code sr_latn} from the ICU root and from libc: in the Serbian Latin
	 * alphabet C and C-with-caron are two letters, so every C word comes first, while
	 * under the root and under {@code en_US} the caron is an accent and the next character
	 * decides. Measured on 14.09.2026, that pair alone was not enough: the column declared
	 * {@code collate "C"} - byte order - answers identically, because in UTF-8 the letter C
	 * is one byte below 0x80 and C-with-caron begins at 0xC4. The third row is a name typed
	 * in lower case, which byte order puts after every capital and a letter ordering puts
	 * first. With it, the three collations give three different answers to each of the two
	 * questions below, and no other named collation can slip between them unnoticed.
	 *
	 * <p>Measured with data rather than with {@code information_schema}, for the reason
	 * {@link ConventionsTest} gives: asking the catalogue only proves a name was written
	 * beside a column.
	 */
	@Test
	void theNameOnTheAccountSortsByTheSerbianAlphabet() {
		account("cvetko@primer.rs", "Cvetko", "Čolić", null);
		account("cedomir@primer.rs", "Čedomir", "Cvetković", null);
		account("anka@primer.rs", "anka", "anić", null);

		assertThat(db.sql("select email from account order by first_name").query(String.class).list())
				.as("given names sort by byte order, by the ICU root or by libc, and not by the alphabet")
				.containsExactly("anka@primer.rs", "cvetko@primer.rs", "cedomir@primer.rs");

		assertThat(db.sql("select email from account order by last_name").query(String.class).list())
				.as("surnames sort by byte order, by the ICU root or by libc, and not by the alphabet")
				.containsExactly("anka@primer.rs", "cedomir@primer.rs", "cvetko@primer.rs");
	}

	/** An account, with the name it carries itself and the member it belongs to or none. */
	private void account(String email, String first, String last, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values (?, ?, ?, "
						+ COMPETITOR + ", (select id from competitor where member_number = ?))")
				.params(first, last, email, memberNumber)
				.update();
	}

	/** A member, in the shape MembershipConstraintsTest already writes one. */
	private void competitor(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
						+ " city, country_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, referred_by, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'M', date '1982-02-02', (select id from place where rank = 1),"
						+ " null, null, 2027, false, true, 'feeExempt', ?, null, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, "00112233445566" + number.substring(4))
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
