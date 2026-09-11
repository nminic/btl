package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Two questions {@link ConstraintsTest} does not ask, and neither did anything else.
 *
 * <p><b>Whether a key may be deferred.</b> {@code ConstraintsTest} proves that
 * every key rejects a duplicate. It says nothing about <em>when</em> the rejection
 * happens, and for a column that carries an order that is the whole question.
 * Measured on 08.09.2026 against the schema as it was: {@code update place set
 * rank = rank + 1 where rank >= 46900}, which is what inserting a town at position
 * 46,900 is, came back {@code ERROR: duplicate key value violates unique
 * constraint "place_rank_unique", Key (rank)=(46901)}. A plain UNIQUE is checked
 * as each row is written, so the first row to move lands on a neighbour that has
 * not moved yet, and there is no order of rows that avoids it. Nor could it be put
 * off: a constraint not declared DEFERRABLE cannot be deferred. The order the
 * whole town field depends on was therefore unmaintainable, and no test said so.
 *
 * <p><b>Whether an index exists at all.</b> {@code ConstraintsTest} reads
 * {@code pg_constraint} and {@code ConventionsTest} reads {@code pg_tables}, and
 * before 08.09.2026 nothing read {@code pg_indexes}: deleting the one index in the
 * schema left the build at BUILD SUCCESS.
 *
 * <p>Both lists below are written by hand and both have a floor that is not
 * another list: the catalogue. A key added without a line here fails, an index
 * added without a line here fails, and a line here for something that no longer
 * exists fails too.
 */
class KeysAndIndexesTest extends DatabaseTest {

	/**
	 * One key of the schema, and the decision about deferring it.
	 *
	 * @param constraint its name
	 * @param deferrable whether it may be put off to the end of the statement,
	 *                   which is the only way a range of an order can move
	 * @param why        the reason, in words, because the answer is a decision and
	 *                   not a fact anybody can look up
	 */
	record Key(String constraint, boolean deferrable, String why) {

		@Override
		public String toString() {
			return constraint;
		}
	}

	/**
	 * The decision, one line per key, and the shortest true reason for it.
	 *
	 * The rule the lines follow: a key over a column that carries an <b>order</b>
	 * is deferrable, because an order is maintained by moving a range of it and a
	 * plain UNIQUE makes that impossible rather than awkward. A key over a column
	 * that is <b>looked up</b> is not, and there are two prices for getting that
	 * side wrong rather than the one this file named until 09.09.2026:
	 *
	 * <ol>
	 * <li>a deferrable key is no {@code ON CONFLICT} arbiter, {@code ON CONFLICT
	 * does not support deferrable unique constraints/exclusion constraints as
	 * arbiters};
	 * <li>and nothing may point at one at all: {@code ERROR: cannot use a
	 * deferrable unique constraint for referenced table}, refused when the
	 * referring table is created. A column declared deferrable is a column no
	 * foreign key can ever name.
	 * </ol>
	 *
	 * <p>Both are measured below rather than asserted here, and the second decided
	 * a question the schema did not have when this was written and has now. The
	 * town codebook was given a speaking mark of its own on 08.09.2026, so that
	 * ADL A36 O5 can give an event a foreign key to a place, and that mark's
	 * unique key is <b>plain</b>: it exists to be pointed at, and price 2 says a
	 * deferrable one cannot be. See {@link PlaceIdentityTest}, which holds the two
	 * halves of that over the codebook itself.
	 */
	private static final List<Key> KEYS = List.of(
			new Key("country_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("country_code_unique", false, "a country is looked up by its code; codes are not a sequence"),
			new Key("country_name_unique", false, "a name is looked up, not counted from one end"),
			new Key("country_sort_order_unique", true,
					"the order countries are listed in: a country joining the region moves every one below it"),
			new Key("place_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("place_geonames_id_unique", false,
					"a town is looked up by its GeoNames mark, and the mark is there to be pointed at"),
			new Key("place_rank_unique", true,
					"the order towns are suggested in: inserting one town moves the rank of every smaller town"),
			new Key("price_row_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("price_row_key_unique", false, "a price row is looked up by its key"),
			new Key("price_row_sort_order_unique", true,
					"the order the price list is drawn in: a row inserted between two moves the rest"),
			new Key("role_pk", false, "a surrogate key nothing outside the portal sees, and account.role_id names it"),
			new Key("role_code_unique", false, "a role is looked up by its code, and V5 carries no order at all"),
			new Key("admin_right_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("admin_right_code_unique", false,
					"a right is looked up by the key the portal writes it down under, entity:members"),
			new Key("account_pk", false,
					"a surrogate key nothing outside the portal sees, and the token table points at it"),
			new Key("email_verification_token_pk", false,
					"a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("email_verification_token_hash_unique", false,
					"a link is looked up by the digest it hashes to, and one digest may open one account"),
			new Key("competitor_pk", false,
					"a surrogate key nothing outside the portal sees, and four tables of V7 point at it"),
			new Key("competitor_member_number_unique", false,
					"a member is looked up by the number his profile address is built from; numbers are handed out, "
							+ "never renumbered"),
			new Key("competitor_referral_code_unique", false,
					"a member is looked up by the code the link carries, and one code is one member"),
			new Key("btl_event_pk", false,
					"a surrogate key nothing outside the portal sees, and the race, the comment and the attending "
							+ "row all point at it"),
			new Key("btl_event_slug_unique", false, "an event is looked up by its address, which is the mark O7 makes"),
			new Key("race_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("race_day_unique", false,
					"it exists only to be pointed at: result_race_fk names (id, date) so a race that moves carries "
							+ "the day on its results with it, and a deferrable key may be named by nothing"),
			new Key("result_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("attending_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("attending_said_once", false,
					"one member says once that he is going to one event; a pair is looked up, and it carries no order"),
			new Key("event_comment_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			/* V8. The first two are the member's own id borrowed as a key, which is what says a
			   member has at most one of each: one document number, one consent. The third is a
			   surrogate, and it is also the NAME OF THE FILE on disk (ADL A36 O8), which is what
			   keeps A12a's first rule keepable - the server never uses the name a browser sent. */
			new Key("competitor_document_pk", false,
					"the member's own id, which is what says he has one document number and not a list"),
			new Key("parental_consent_pk", false,
					"the member's own id, which is what says one consent was given and not several"),
			new Key("photo_pk", false,
					"a surrogate key, and the name the file is written under, so nothing may move it"),
			// V9: a surrogate, because a queue row is looked up by nothing a person types
			new Key("verification_pk", false, "a surrogate key nothing outside the portal sees"),
			/* V10. The first is a surrogate like every other. The second is the one key in the
			   schema that exists to say ONE: a run waits in the queue once, because a run
			   approved twice is a result written twice with nothing to say which was meant. */
			new Key("result_submission_pk", false,
					"a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("verification_result_submission_unique", false,
					"one run waits once; a pointer is looked up as it is written and carries no order"),
			/* V11. Two surrogates, the address a team is looked up by, and the same "waits once"
			   the run has. The exclusion that says a member is in one team at a time is not here:
			   it is not a unique key and deferring it was never a question, because it is checked
			   against rows that are already written rather than against the one being written. */
			new Key("team_pk", false, "a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("team_slug_unique", false,
					"a team is looked up by its address, which is the rule O7 says an event copied FROM it"),
			new Key("team_membership_pk", false,
					"a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("team_proposal_pk", false,
					"a surrogate key nothing outside the portal sees, so nothing moves it"),
			new Key("verification_team_proposal_unique", false,
					"one proposal waits once; a pointer is looked up as it is written and carries no order"),

			/* V12. The first is the one key in the schema that exists only to be pointed at:
			   without it a foreign key cannot name (id, gender), and without that a racing pair
			   is mixed only because a service remembered to check. The rest say "asked once" and
			   "one pair a season", and every one of them is looked up as it is written. */
			new Key("competitor_id_gender_unique", false,
					"it exists only to be pointed at: racing_pair names (id, gender) so the database"
							+ " refuses a pair that is not mixed, and a deferrable key may be named by nothing"),
			new Key("team_application_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("team_application_asked_once", false,
					"one member asks one team once for one season; a triple is looked up, and it carries no order"),
			new Key("team_invitation_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("team_invitation_sent_once", false,
					"one team asks one member once for one season; a triple is looked up, and it carries no order"),
			new Key("racing_pair_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("racing_pair_one_man_a_season", false,
					"one pair a season from his side; a pair is looked up by season and member"),
			new Key("racing_pair_one_woman_a_season", false,
					"one pair a season from her side; a pair is looked up by season and member"),
			new Key("pair_invite_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("pair_invite_asked_once", false,
					"one open question between two people in that direction, looked up as it is written"),

			/* V13. Two surrogates and one key that IS the fact: who has read what is the pair
			   itself, and the member's own id is his settings. */
			new Key("message_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("message_read_pk", false,
					"the message and the member together, which is what says reading twice is one fact"),
			new Key("notification_setting_pk", false,
					"the member's own id, which is what says he has one set of settings and not a list"),

			/* V14. A surrogate, the address a league is looked up by, and one key that IS the
			   fact: an event enters a league once, so the pair is the row. */
			new Key("league_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("league_slug_unique", false,
					"a league is looked up by its address, the same rule an event and a team follow"),
			new Key("league_event_pk", false,
					"the league and the event together; adding one twice is not a second fact"),

			/* V15. The first IS the quantity, which is what makes the kinds a codebook rather
			   than eleven words inside a CHECK. The last is the only key in the schema written
			   NULLS NOT DISTINCT, and without that a badge that stands for ever - no season, no
			   month - could be won twice at the same threshold, because two nulls do not
			   normally collide. */
			new Key("ducat_kind_pk", false, "the quantity itself, which is what a badge names"),
			new Key("ducat_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("ducat_code_unique", false,
					"a badge is looked up by the code its drawing is keyed on"),
			new Key("ducat_award_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("ducat_award_won_once", false,
					"one badge per threshold per period, looked up as it is written and carrying no order"),

			/* V16. The reference is what a machine reads off a bank statement, so one line of
			   that statement has to name one payment; and one payment a season, because paying
			   twice for a season is not two payments but a conversation. */
			new Key("payment_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("payment_reference_unique", false,
					"one line of a bank statement names one payment; looked up as the statement is read"),
			new Key("payment_one_a_season", false,
					"one payment per member per season, looked up by the pair and carrying no order"),

			/* V17. Two surrogates and two keys that say what a PLACE is: one first among the
			   men and one among the women, because the standings are drawn by gender and
			   nothing else; and one first team, because the team standings are not. */
			new Key("season_competitor_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("season_competitor_one_per_place", false,
					"one place per gender per season, written once when the season freezes and never moved"),
			new Key("season_team_pk", false, "a surrogate key nothing outside the portal sees"),
			new Key("season_team_one_per_place", false,
					"one place per season, written once when the season freezes and never moved"),
			new Key("season_league_standing_pk", false,
					"a surrogate key nothing outside the portal sees"),
			new Key("season_league_standing_one_per_place", false,
					"one place per league per gender per season, written once when the season freezes"),
			/* And the other axis of the same three tables: one member, one place. */
			new Key("season_competitor_one_place_each", false,
					"one place per member per season; a standing is looked up by both and carries no order"),
			new Key("season_team_one_place_each", false,
					"one place per team per season; a standing is looked up by both and carries no order"),
			new Key("season_league_standing_one_place_each", false,
					"one place per member per league per season, written once when the season freezes"));

	/** One index of the schema that no key owns, and what it is for. */
	record Index(String name, String forWhat) {

		@Override
		public String toString() {
			return name;
		}
	}

	private static final List<Index> INDEXES = List.of(
			new Index("place_country_idx", "narrowing the town field by the country already chosen on the form"),
			new Index("role_only_one_holds_every_right",
					"at most one role may hold every right; a partial index because a unique constraint takes no WHERE"),
			new Index("account_email_unique",
					"one address is one account whatever case it is typed in; an index because the uniqueness is over "
							+ "lower(email) and a unique constraint takes no expression"),
			new Index("account_role_idx", "the accounts of one role, which is how a role that cannot be dropped is found"),
			new Index("email_verification_token_account_idx",
					"the live links of one account, which is what re-sending the confirmation reads"),
			new Index("competitor_place_idx", "the members of one town, and the other end of competitor_place_fk"),
			new Index("competitor_country_idx", "the members of one country, and the other end of "
					+ "competitor_country_fk"),
			new Index("competitor_referred_by_idx", "who one member brought, which is what the referral programme "
					+ "counts"),
			new Index("btl_event_place_idx", "the events of one town, and the other end of btl_event_place_fk"),
			new Index("btl_event_country_idx", "the events of one country, which is how the calendar is narrowed"),
			new Index("btl_event_copied_from_idx", "what was copied from one event, and the other end of "
					+ "btl_event_copied_from_fk"),
			new Index("btl_event_date_idx", "the calendar itself: the events of one day, one month, one season"),
			new Index("race_event_idx", "the races of one event, which is how an event is drawn"),
			new Index("race_date_idx", "the races of one day, which is what a season and a league read"),
			new Index("result_competitor_race_date_idx", "ADL A12, 2c, in as many words: the results of one member "
					+ "by the day of the race"),
			new Index("result_race_idx", "the results of one race, and the other end of result_race_fk, which is "
					+ "over two columns and so is this"),
			new Index("attending_competitor_idx", "the events one member said he is going to"),
			new Index("event_comment_event_idx", "the comments under one event, which is how they are drawn"),
			new Index("event_comment_competitor_idx", "what one member wrote, and the other end of "
					+ "event_comment_competitor_fk"),
			// V8, and the other end of competitor_photo_fk: whose picture this is
			new Index("competitor_photo_idx", "the member a photograph belongs to"),
			/* V9. The first is the only way the queue is ever drawn - one tab, oldest first - and the
			   other three are the ends of the three keys that point out of it. */
			new Index("verification_queue_raised_idx", "one tab of the queue, oldest waiting first"),
			new Index("verification_competitor_idx", "what is waiting on one member, which his own screen asks"),
			new Index("verification_photo_idx", "the queue row a photograph is waiting in"),
			new Index("verification_decided_by_idx", "what one moderator has decided"),
			/* V10. The first is how a member's own screen draws what he has sent in, and the
			   other three are the ends of the three keys that point out of the submission. The
			   race one is over two columns because the key it answers is. */
			new Index("result_submission_competitor_idx", "the runs one member has sent in"),
			new Index("result_submission_race_idx", "what is waiting on one race, and the other end of "
					+ "result_submission_race_fk, which is over two columns and so is this"),
			new Index("result_submission_place_idx", "the waiting runs that name one town of the codebook"),
			new Index("result_submission_country_idx", "the waiting runs that name one country of the codebook"),
			/* V11. Every one of these is the other end of a key that points out of a team, a
			   membership or a proposal, and two of them are also how the portal draws a page:
			   the members of one team, and what one member has sent to moderation. */
			new Index("team_place_idx", "the teams that name one town of the codebook"),
			new Index("team_country_idx", "the teams that name one country of the codebook"),
			new Index("team_logo_idx", "the team a mark belongs to"),
			new Index("team_admin_idx", "the teams one member is named to administer"),
			new Index("team_membership_competitor_idx",
					"every team one member has been in, which his own profile draws"),
			new Index("team_membership_team_idx", "the members of one team, which is the team page"),
			new Index("team_proposal_competitor_idx", "what one member has proposed"),
			new Index("team_proposal_team_idx", "the edits waiting on one team"),
			new Index("team_proposal_place_idx", "the proposals that name one town of the codebook"),
			new Index("team_proposal_country_idx", "the proposals that name one country of the codebook"),
			new Index("team_proposal_logo_idx", "the proposal a mark was attached to"),
			/* V12. Every one is the other end of a key that points out of an asking or a pair,
			   and the first two are also how a member's own screen draws what he has asked and
			   what he has been asked. */
			new Index("team_application_competitor_idx", "what one member has asked for"),
			new Index("team_application_team_idx", "who has asked to join one team"),
			new Index("team_invitation_team_idx", "who one team has invited"),
			new Index("team_invitation_competitor_idx", "what one member has been invited to"),
			new Index("racing_pair_man_idx", "every season one man has had a pair"),
			new Index("racing_pair_woman_idx", "every season one woman has had a pair"),
			new Index("pair_invite_from_idx", "who one member has asked to pair"),
			new Index("pair_invite_to_idx", "who has asked one member to pair"),
			/* V13. The first is the inbox itself, newest first, and the rest are the other ends
			   of the keys that point out of a message. */
			new Index("message_to_sent_idx", "one member's inbox in the order it arrived"),
			new Index("message_from_idx", "what one member has sent"),
			new Index("message_team_invitation_idx", "the message that asks about one invitation"),
			new Index("message_pair_invite_idx", "the message that asks about one request to pair"),
			new Index("message_read_competitor_idx", "what one member has already read"),
			/* V14. The other end of the administrator key, the leagues of one season which is
			   how the page is drawn, and the other end of the pair in league_event. */
			new Index("league_admin_idx", "the leagues one member is named to administer"),
			new Index("league_season_idx", "the leagues of one season, which is how they are listed"),
			new Index("league_event_event_idx", "every league one event has entered"),
			/* V15. The other ends of the three keys that point out of a badge and an award. */
			new Index("ducat_kind_idx", "the badges written over one quantity"),
			new Index("ducat_award_competitor_idx", "every badge one member has won"),
			new Index("ducat_award_ducat_idx", "everybody who has won one badge"),
			new Index("ducat_award_kind_idx", "the recognitions given for one quantity"),
			/* V16. Three ends of keys, and one the screen of payments is actually drawn from:
			   everything still waiting for one season. */
			new Index("payment_competitor_idx", "what one member has paid, season by season"),
			new Index("payment_price_row_idx", "the payments made at one price"),
			new Index("payment_recorded_by_idx", "what one person has recognised"),
			new Index("payment_season_state_idx", "everything still waiting for one season"),
			/* V17. The first of each pair is the whole page - one season, read and drawn - and
			   the rest are the ends of the keys that point out of a frozen row. */
			new Index("season_competitor_season_idx", "the frozen standings of one season"),
			new Index("season_competitor_competitor_idx", "every frozen season one member stands in"),
			new Index("season_team_season_idx", "the frozen team standings of one season"),
			new Index("season_team_team_idx", "every frozen season one team stands in"),
			new Index("season_league_standing_season_idx", "the frozen league standings of one season"),
			new Index("season_league_standing_league_idx", "the frozen standings of one league"),
			new Index("season_league_standing_competitor_idx",
					"every frozen league standing one member stands in"));

	/**
	 * Every primary key and unique key in the schema, with what the catalogue says
	 * about deferring it and which single column it covers.
	 *
	 * The column comes from {@code conkey} rather than from the list above, so the
	 * list holds only the part that is a decision. A key over more than one column
	 * comes back with both names and the shift below refuses to guess.
	 */
	private List<Map<String, Object>> keysInTheSchema() {
		return db
				.sql("""
						select con.conname            as constraint_name,
						       con.condeferrable      as deferrable,
						       con.condeferred        as deferred,
						       cls.relname            as table_name,
						       string_agg(att.attname, ',' order by att.attnum) as columns,
						       string_agg(format_type(att.atttypid, att.atttypmod), '|' order by att.attnum)
						                              as column_types
						  from pg_constraint con
						  join pg_class cls on cls.oid = con.conrelid
						  join pg_namespace nsp on nsp.oid = cls.relnamespace
						  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
						 where con.contype in ('p', 'u')
						   and nsp.nspname = current_schema()
						   and cls.relname <> ?
						 group by con.conname, con.condeferrable, con.condeferred, cls.relname
						 order by con.conname
						""")
				.param(flywayTable())
				.query()
				.listOfRows();
	}

	/**
	 * The floor: the catalogue and the list above name the same keys, and agree
	 * about every one of them.
	 *
	 * Both directions in one assertion, because both are the same mistake seen
	 * from either side: a key that arrives without a decision, and a decision that
	 * outlives its key. {@code condeferred} is asserted false throughout, which is
	 * the difference between INITIALLY IMMEDIATE and INITIALLY DEFERRED: a key that
	 * starts deferred moves its complaint to a COMMIT with no statement to blame.
	 */
	@Test
	void everyKeyInTheSchemaHasADecisionAboutDeferring() {
		Map<String, Boolean> decided = KEYS.stream().collect(Collectors.toMap(Key::constraint, Key::deferrable));

		Map<String, Boolean> declared = keysInTheSchema().stream()
				.collect(Collectors.toMap(row -> (String) row.get("constraint_name"),
						row -> (Boolean) row.get("deferrable")));

		assertThat(declared).isNotEmpty();
		assertThat(declared)
				.as("a key with no line in KEYS, or a line in KEYS with no key")
				.containsExactlyInAnyOrderEntriesOf(decided);

		assertThat(keysInTheSchema())
				.as("every key is checked at the end of its own statement, never first at COMMIT")
				.allSatisfy(row -> assertThat(row.get("deferred")).isEqualTo(false));
	}

	/** The keys the list above says may be deferred, as (table, column) to move. */
	static List<Key> orderKeys() {
		return KEYS.stream().filter(Key::deferrable).toList();
	}

	/** And the ones it says may not, which are the ones anything may point at. */
	static List<Key> lookedUpKeys() {
		return KEYS.stream().filter(key -> !key.deferrable()).toList();
	}

	private Map<String, Object> catalogue(Key key) {
		return keysInTheSchema().stream()
				.filter(row -> key.constraint().equals(row.get("constraint_name")))
				.findFirst()
				.orElseThrow();
	}

	/**
	 * A whole range of the order moves in one statement.
	 *
	 * This is the maintenance that a plain UNIQUE refuses and the reason these
	 * three keys are deferrable. It is written as the operation itself rather than
	 * as a question to {@code pg_constraint}, because what was broken was not the
	 * flag: it was that the work could not be done.
	 */
	@ParameterizedTest
	@MethodSource("orderKeys")
	void aRangeOfTheOrderMovesInOneStatement(Key key) {
		Map<String, Object> row = catalogue(key);
		String table = (String) row.get("table_name");
		String column = (String) row.get("columns");

		assertThat(column)
				.as("a deferrable key over more than one column needs a shift written for it, not guessed")
				.doesNotContain(",");

		int moved = db
				.sql("update " + table + " set " + column + " = " + column + " + 1"
						+ " where " + column + " >= (select max(" + column + ") - 5 from " + table + ")")
				.update();

		assertThat(moved).isEqualTo(6);
	}

	/**
	 * And the statement that ends with two rows in one position is still refused.
	 *
	 * The other half of the boundary, and the half that says the first test is not
	 * simply the constraint switched off. Deferrable moves the check to the end of
	 * the statement; it does not remove it, and nothing here says
	 * {@code SET CONSTRAINTS}. A key changed to INITIALLY DEFERRED lets this
	 * through to a COMMIT that never comes in a rolled back test, and a key that
	 * lost its UNIQUE lets it through for good.
	 */
	@ParameterizedTest
	@MethodSource("orderKeys")
	void andAStatementThatEndsWithTwoRowsInOnePositionIsRefused(Key key) {
		Map<String, Object> row = catalogue(key);
		String table = (String) row.get("table_name");
		String column = (String) row.get("columns");

		assertThatThrownBy(() -> db
				.sql("update " + table + " set " + column + " = 1 where " + column + " = 2")
				.update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(key.constraint());
	}

	/**
	 * The second price of deferring: nothing may point at such a key.
	 *
	 * The comment in V3 called itself a list of what deferring costs and named one
	 * item, the {@code ON CONFLICT} arbiter. This is the other, and it is the
	 * larger of the two: a foreign key to a deferrable unique constraint is
	 * refused outright, when the referring table is created, not when a row is
	 * written. So the column is one nothing can ever refer to, which is a fact
	 * about the whole schema rather than about one statement somebody might write.
	 *
	 * <p>Run against every deferrable key rather than against {@code place.rank},
	 * so a fourth order column arriving is measured too. The type comes from
	 * {@code format_type} for the same reason the column name does: guessing it
	 * would make this a test about the guess.
	 */
	@ParameterizedTest
	@MethodSource("orderKeys")
	void noForeignKeyMayPointAtADeferrableKey(Key key) {
		Map<String, Object> row = catalogue(key);

		assertThatThrownBy(() -> db.sql(pointingAt(row)).update())
				.as("a deferrable unique key is one no foreign key can name, and that is the price of deferring it")
				.hasMessageContaining("cannot use a deferrable unique constraint for referenced table");
	}

	/**
	 * And the keys that stayed plain can be pointed at, which is what they are for.
	 *
	 * The other half, and without it the test above is satisfied by a
	 * {@code create table} that fails for any reason at all: a typo in the
	 * statement it builds would pass it against every key and prove nothing. Here
	 * the same statement, built the same way, has to go through.
	 */
	@ParameterizedTest
	@MethodSource("lookedUpKeys")
	void aKeyThatStayedPlainIsOneAForeignKeyMayName(Key key) {
		Map<String, Object> row = catalogue(key);

		assertThat(db.sql(pointingAt(row)).update()).isZero();
	}

	/**
	 * A table whose only columns are a foreign key to that key, and nothing else.
	 *
	 * Written for as many columns as the key has, and until 09.09.2026 it refused
	 * anything but one and the schema had nothing else. V7 brought two composite
	 * keys and both are exactly the shape this asks about: {@code race_day_unique}
	 * exists so that {@code result_race_fk} can name {@code (id, date)}, and
	 * refusing to build a referring table for it would have left the one key in
	 * the schema whose whole purpose is being pointed at as the one key nothing
	 * measured. The columns and their types both come out of {@code format_type}
	 * and {@code conkey}, in {@code attnum} order on both sides, so the pairs line
	 * up without either being guessed.
	 */
	private String pointingAt(Map<String, Object> row) {
		String[] columns = ((String) row.get("columns")).split(",");
		/* Split on a bar and not on a comma: `numeric(12,2)` carries one of its own, and V15
		   is the first key in the schema over such a column. Before that every type here was
		   one word, so the comma worked by accident rather than by design. */
		String[] types = ((String) row.get("column_types")).split(java.util.regex.Pattern.quote("|"));

		assertThat(types).hasSameSizeAs(columns);

		String declarations = IntStream.range(0, columns.length)
				.mapToObj(at -> "c" + at + " " + types[at])
				.collect(Collectors.joining(", "));
		String referring = IntStream.range(0, columns.length)
				.mapToObj(at -> "c" + at)
				.collect(Collectors.joining(", "));

		return "create table points_here (" + declarations
				+ ", foreign key (" + referring + ") references " + row.get("table_name")
				+ " (" + String.join(", ", columns) + "))";
	}

	/**
	 * Every index that no key brought with it has a line above.
	 *
	 * A unique key and a primary key each create an index of their own, and those
	 * are decisions already held by {@link #everyKeyInTheSchemaHasADecisionAboutDeferring()};
	 * {@code conindid} is how the catalogue says which index belongs to which key,
	 * so what is left over is exactly the indexes somebody wrote on purpose.
	 * Flyway's own table brings an index of its own and is left out with it.
	 */
	@Test
	void everyIndexNoKeyOwnsHasALineHere() {
		List<String> standalone = db
				.sql("""
						select cls.relname
						  from pg_class cls
						  join pg_index idx on idx.indexrelid = cls.oid
						  join pg_class tbl on tbl.oid = idx.indrelid
						  join pg_namespace nsp on nsp.oid = cls.relnamespace
						 where cls.relkind = 'i'
						   and nsp.nspname = current_schema()
						   and tbl.relname <> ?
						   and not exists (select 1 from pg_constraint con where con.conindid = cls.oid)
						 order by cls.relname
						""")
				.param(flywayTable())
				.query(String.class)
				.list();

		assertThat(standalone)
				.as("an index with no line in INDEXES, or a line in INDEXES with no index")
				.containsExactlyInAnyOrderElementsOf(INDEXES.stream().map(Index::name).toList());
	}

	/**
	 * And the one index there is does its job: the towns of a country are found
	 * through it and not by reading all forty seven thousand.
	 *
	 * The plan and not the line in {@code pg_indexes}, because an index nobody can
	 * use is the same as no index. Sequential scans are turned off for this
	 * transaction so the answer does not depend on when autovacuum last collected
	 * statistics; that changes which plan is cheapest, not which plans exist, so a
	 * dropped index still leaves PostgreSQL reading the whole table and this still
	 * fails.
	 */
	@Test
	void theTownsOfOneCountryAreFoundThroughTheIndex() {
		db.sql("set local enable_seqscan = off").update();

		Long serbia = db.sql("select id from country where code = 'RS'").query(Long.class).single();

		String plan = String.join("\n",
				db.sql("explain (costs off) select id from place where country_id = " + serbia)
						.query(String.class)
						.list());

		assertThat(plan).contains("place_country_idx");
	}
}
