package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * What the axis does, as opposed to what it refuses.
 *
 * AxisConstraintsTest owns the refusals, one row per constraint. This file owns
 * the sentences that no single constraint can carry, and every one of them is
 * here because reverting it would otherwise leave the suite green:
 *
 * <ul>
 * <li><b>O5.</b> A town is a table and a foreign key, and a typed town is text
 * with an empty key, so the country of an event is reachable either way.</li>
 * <li><b>O6.</b> Two runnings of one race share an explicit link and nothing
 * else, and deleting the parent empties the link instead of taking the
 * copy.</li>
 * <li><b>O7.</b> The address of an event is its identity, and its name is
 * not.</li>
 * <li><b>O10.</b> Which country a result was run in is a join and not a
 * column.</li>
 * <li><b>O11.</b> A result carries no state and no reason, because a refused
 * report never becomes one.</li>
 * <li><b>O1, the second half.</b> A member's deletion takes his results and
 * leaves a tombstone where a name was published, and no hard cascade may reach
 * anything that is meant to survive him.</li>
 * <li><b>ADL A12, 2c.</b> The day of the race is on the result, and it is the
 * race's day rather than a copy of it that has drifted.</li>
 * </ul>
 *
 * Four of them are asked of {@code information_schema} and {@code pg_constraint}
 * rather than of a list written here, which is what makes them complete: a
 * column added to any of the six tables fails whatever it is called, and a
 * deletion rule added anywhere in the schema fails wherever somebody puts it.
 */
class CompetitorEventRaceAndResultTest extends DatabaseTest {

	/* Two towns out of the codebook that are certainly in two different
	   countries, picked by country and then by the codebook's own order so the
	   answer cannot depend on which row a "limit 1" happened to land on. */
	private static final String A_TOWN_IN_SERBIA = "(select id from place where country_id ="
			+ " (select id from country where code = 'RS') order by rank limit 1)";
	private static final String A_TOWN_IN_CROATIA = "(select id from place where country_id ="
			+ " (select id from country where code = 'HR') order by rank limit 1)";
	/* A third country, and a third on purpose: a typed town in Serbia would be the
	   same country as the codebook town above, and counting distinct countries
	   would then give the same answer whether the typed one was reached or not. */
	private static final String A_THIRD_COUNTRY = "(select id from country where code = 'BA')";

	private static final String AN_INSTANT = "timestamptz '2027-04-04 09:00:00+00'";

	private int nextMember = 900;

	/**
	 * The six column lists, and they are the guard rather than the description.
	 *
	 * Complete by construction rather than by a list of forbidden names: a
	 * column added to any of these tables fails here whatever it is called. What
	 * that holds, table by table:
	 *
	 * <ul>
	 * <li>An event does not list its races. It did, in {@code raceIds}, the same
	 * link was written a second time on the race, and the two drifted apart on
	 * every race entered by hand (ADL A7, 06.08.2026). The entry asking for both
	 * to be written is still open in the decision log and would be read by
	 * whoever writes the first migration, so the refusal has to be measured and
	 * not stated.</li>
	 * <li>A result carries no country. That is O10: the country is a join
	 * through the race, the event, the town and the country, and a column would
	 * be a fourth copy on a row whose three others have already drifted in two
	 * hundred and twenty three places.</li>
	 * <li>A result carries no state and no reason. That is O11 landing here: the
	 * row that keeps them belongs to the verification queue, and a status column
	 * would be a second answer to a question the row's existence already
	 * answers.</li>
	 * <li>A member carries no team and no season he joined one. That is O3: team
	 * membership through the seasons is a table with a season from and a season
	 * to, and the two columns here are the shape it rejected.</li>
	 * <li>A member carries no name of a town beside a key to one, and neither
	 * does an event: exactly one of the two answers, which is O5.</li>
	 * </ul>
	 */
	@Test
	void theSixTablesCarryTheseColumnsAndNoOthers() {
		assertThat(columnsOf("competitor")).containsExactlyInAnyOrder("id", "member_number", "first_name",
				"last_name", "gender", "place_id", "city", "country_id", "first_season",
				"first_season_2027", "active", "membership_basis", "referral_code", "referred_by", "bio",
				"profile_hidden", "birthday_shown",
				/* V8, the thirteen things registration collects. `birth_year` is here too and is no
				   longer written by anybody: it is generated from `birth_date`, so the date is the
				   fact and the year is a way of saying it. */
				"birth_date", "birth_year", "father_name", "address", "phone", "shirt_size",
				"health_statement_at", "photo_id");

		assertThat(columnsOf("btl_event")).containsExactlyInAnyOrder("id", "slug", "name", "date", "place_id",
				"city", "country_id", "kind", "featured", "description", "link", "copied_from");

		assertThat(columnsOf("race")).containsExactlyInAnyOrder("id", "event_id", "name", "renamed", "date", "kind",
				"limit_seconds", "distance_km", "ascent_m", "descent_m", "category");

		assertThat(columnsOf("result")).containsExactlyInAnyOrder("id", "competitor_id", "race_id", "race_date",
				"distance_km", "ascent_m", "descent_m", "seconds", "points", "category");

		assertThat(columnsOf("attending")).containsExactlyInAnyOrder("id", "event_id", "competitor_id");

		assertThat(columnsOf("event_comment")).containsExactlyInAnyOrder("id", "event_id", "competitor_id", "who",
				"published_at", "rating_organisation", "rating_value", "rating_ambience", "body");
	}

	/**
	 * The category is the length, at every boundary PDL P5 draws.
	 *
	 * Recognised by the exact value with no tolerance: 42.2 is a marathon and
	 * 42.19 is a long race, 21.1 is a half and 21.09 is a short one. That is why
	 * the column is NUMERIC and not a floating point number, and the two rows
	 * either side of each boundary are what would fail the day somebody changes
	 * it.
	 *
	 * Generated and not written, so the length is the fact and the category is a
	 * way of saying it (ADL A31). Six races rather than one, because with a
	 * single row every answer would be the same answer and the case would say
	 * nothing about which distance produced it.
	 */
	/**
	 * The year a member was born is said by his date of birth, and cannot be
	 * written beside it.
	 *
	 * <p>V7 carried `birth_year` as a column of its own while registration collects
	 * the whole date, so one fact had two homes and they could drift. V8 made the
	 * date the fact and the year a way of saying it. Without this case that change
	 * has no guard at all: the column list two cases up says only that a column
	 * called `birth_year` exists, and it would go on saying that if the expression
	 * behind it were the constant 2000.
	 *
	 * <p>Both halves are here because either alone can be satisfied by the wrong
	 * schema. That the year answers correctly is satisfied by an ordinary column
	 * somebody happened to fill in right; that writing to it is refused is
	 * satisfied by a column that is generated from anything at all.
	 */
	@Test
	void theYearOfBirthIsSaidByTheDateAndNeverWrittenBesideIt() {
		long member = member("Rodjen", "Osamdesete", A_TOWN_IN_SERBIA + ", null, null");

		db.sql("update competitor set birth_date = date '1983-11-27' where id = " + member).update();

		assertThat(db.sql("select birth_year from competitor where id = " + member).query(Integer.class).single())
				.as("the year does not follow the date it is supposed to be read from")
				.isEqualTo(1983);

		assertThatThrownBy(() -> db.sql("update competitor set birth_year = 1999 where id = " + member).update())
				.as("the year can be written beside the date, so the two can disagree")
				.hasMessageContaining("birth_year");
	}

	@Test
	void theCategoryOfARaceIsItsLength() {
		long event = event("duzine-2027", A_TOWN_IN_SERBIA + ", null, null");

		race(event, "Kratka", "5.00");
		race(event, "Skoro pola", "21.09");
		race(event, "Pola", "21.10");
		race(event, "Duga", "21.11");
		race(event, "Skoro maraton", "42.19");
		race(event, "Maraton", "42.20");
		race(event, "Ultra", "42.21");

		assertThat(db.sql("select name || ' ' || category from race order by distance_km").query(String.class).list())
				.containsExactly("Kratka short", "Skoro pola short", "Pola half", "Duga long", "Skoro maraton long",
						"Maraton marathon", "Ultra ultra");
	}

	/**
	 * And the category of a result is the length that runner actually covered.
	 *
	 * Not read off the race, and that is the whole point on a race that fixes no
	 * length: a timed race carries the category of a distance nobody ran, so the
	 * result answers from what was covered
	 * (pages/event/reportedResult.ts). The race here is a timed one and carries
	 * the shortest category with a distance of zero, while the two results on it
	 * come out a marathon and an ultra - which is exactly the swap that would
	 * pass if the result read its category off the race.
	 */
	@Test
	void theCategoryOfAResultIsWhatThatRunnerCovered() {
		long event = event("vremenska-2027", A_TOWN_IN_SERBIA + ", null, null");
		long race = timedRace(event, "Dvadeset cetiri sata");

		result(member("Prvi", "Trkac", A_TOWN_IN_SERBIA + ", null, null"), race, "42.20");
		result(member("Drugi", "Trkac", A_TOWN_IN_SERBIA + ", null, null"), race, "80.00");

		assertThat(db.sql("select category from race where id = " + race).query(String.class).single())
				.isEqualTo("short");
		assertThat(db.sql("select category from result order by distance_km").query(String.class).list())
				.containsExactly("marathon", "ultra");
	}

	/**
	 * Which country a result was run in is a join, and it works through both
	 * kinds of town (O5, O10).
	 *
	 * The member below ran three races in three events: one in a town out of the
	 * codebook, one in another town out of the codebook in another country, and
	 * one in a town somebody typed because the codebook does not have it. Three
	 * countries, and each of the three arrives by a different road.
	 *
	 * Three things could make this pass while saying nothing, and each has been
	 * taken away. Reading only the town's country would give two, so the typed
	 * town is load bearing; reading only the row's own country would give one, so
	 * the codebook is; and a second member with one result is here so the answer
	 * cannot be "how many countries are there in the calendar".
	 */
	@Test
	void theCountryOfAResultIsAJoinThroughTheRaceTheEventAndTheTown() {
		long here = event("domaci-2027", A_TOWN_IN_SERBIA + ", null, null");
		long across = event("preko-2027", A_TOWN_IN_CROATIA + ", null, null");
		long typed = event("zaselak-2027", "null, 'Zaselak', " + A_THIRD_COUNTRY);

		long traveller = member("Putnik", "Trkac", A_TOWN_IN_SERBIA + ", null, null");
		long stayer = member("Domaci", "Trkac", A_TOWN_IN_SERBIA + ", null, null");

		result(traveller, race(here, "Prva", "10.00"), "10.00");
		result(traveller, race(across, "Druga", "10.00"), "10.00");
		result(traveller, race(typed, "Treca", "10.00"), "10.00");
		result(stayer, race(here, "Cetvrta", "10.00"), "10.00");

		assertThat(countriesRunIn(traveller)).isEqualTo(3);
		assertThat(countriesRunIn(stayer)).isEqualTo(1);
	}

	/**
	 * The day on a result is the day of its race, and it stays that way when the
	 * race moves.
	 *
	 * ADL A12, 2c, asks for an index over the member and the day of the race, so
	 * the day has to be on the result; the shipped data shows what happens when
	 * such a copy is written independently, with one hundred and sixty one of its
	 * two hundred and twenty three drifts in that one column. The reference is
	 * composite, so the database refuses a day that is not that race's, and moving
	 * the race rewrites the copy.
	 *
	 * The second race is the source that would otherwise answer for the first: a
	 * cascade that moved every result would pass a test that only looked at the
	 * one that was supposed to move.
	 */
	@Test
	void aResultCarriesItsRacesDayAndFollowsItWhenTheRaceMoves() {
		long event = event("pomeranje-2027", A_TOWN_IN_SERBIA + ", null, null");
		long moving = race(event, "Trka koja se pomera", "10.00");
		long staying = race(event, "Trka koja ostaje", "10.00");

		db.sql("update race set date = date '2027-04-10' where id = " + staying).update();

		long runner = member("Prvi", "Trkac", A_TOWN_IN_SERBIA + ", null, null");
		result(runner, moving, "10.00");
		result(runner, staying, "10.00");

		db.sql("update race set date = date '2027-06-06' where id = " + moving).update();

		assertThat(db.sql("select ra.name || ' ' || r.race_date from result r join race ra on ra.id = r.race_id"
				+ " order by ra.name").query(String.class).list())
				.containsExactly("Trka koja ostaje 2027-04-10", "Trka koja se pomera 2027-06-06");

		/* And the copy cannot be written by hand into something else, which is the
		   only way it could ever disagree with the race again. */
		assertThatThrownBy(() -> db.sql("update result set race_date = date '2027-07-07' where race_id = " + moving)
				.update())
				.hasMessageContaining("result_race_fk");
	}

	/**
	 * Deleting one running of a race empties the link on the next one and does
	 * not take it (O6).
	 *
	 * The link between two runnings is explicit and is the only thing that says
	 * they are the same race; the analysis asks in as many words that deleting the
	 * parent set the child's link to null rather than leave a reference into
	 * nothing. The second pair is here because a cascade that took every copy, or
	 * a rule that emptied every link, would pass a case with one pair in it.
	 */
	@Test
	void deletingOneRunningOfARaceEmptiesTheLinkOnTheNextAndDoesNotTakeIt() {
		long firstParent = event("stara-trka-2026", A_TOWN_IN_SERBIA + ", null, null");
		long secondParent = event("druga-stara-trka-2026", A_TOWN_IN_SERBIA + ", null, null");
		copy("nova-trka-2027", firstParent);
		copy("druga-nova-trka-2027", secondParent);

		db.sql("delete from btl_event where id = " + firstParent).update();

		assertThat(db.sql("select e.slug || ' ' || coalesce(p.slug, '-') from btl_event e"
				+ " left join btl_event p on p.id = e.copied_from order by e.slug").query(String.class).list())
				.containsExactly("druga-nova-trka-2027 druga-stara-trka-2026", "druga-stara-trka-2026 -",
						"nova-trka-2027 -");
	}

	/**
	 * Deleting a member takes his results and his intentions, and leaves the
	 * comment he published with his name on it.
	 *
	 * The owner, 11.08.2026, and two outcomes with no third: either the profile is
	 * hidden because the membership is not active, and everything is untouched; or
	 * the member goes for good, with his profile and his results, and wherever his
	 * name stood there is an anonymised record. So the results go, the stated
	 * intention goes with them because an intention of a member who no longer
	 * exists is nothing, and the comment stays with {@code who} as the tombstone
	 * and no author.
	 *
	 * The member who stays is what makes each half a half: a cascade that took
	 * every result, or one that took none, would pass a case with one member in
	 * it. The member he brought is the third: the credit is already paid, and what
	 * must not remain is the pointer at a deleted person.
	 */
	@Test
	void deletingAMemberTakesHisResultsAndLeavesTheCommentHePublished() {
		long event = event("brisanje-2027", A_TOWN_IN_SERBIA + ", null, null");
		long race = race(event, "Trka", "10.00");

		long goes = member("Odlazi", "Trkac", A_TOWN_IN_SERBIA + ", null, null");
		long stays = member("Ostaje", "Trkac", A_TOWN_IN_SERBIA + ", null, null");
		long broughtByTheOneWhoGoes = member("Doveden", "Trkac", A_TOWN_IN_SERBIA + ", null, null", goes);
		long broughtByTheOneWhoStays = member("Drugi", "Doveden", A_TOWN_IN_SERBIA + ", null, null", stays);

		result(goes, race, "10.00");
		result(stays, race, "10.00");
		attend(event, goes);
		attend(event, stays);
		comment(event, goes, "Odlazi Trkac");
		comment(event, stays, "Ostaje Trkac");

		db.sql("delete from competitor where id = " + goes).update();

		assertThat(lastNamesOf("select c.first_name from result r join competitor c on c.id = r.competitor_id"))
				.containsExactly("Ostaje");
		assertThat(lastNamesOf("select c.first_name from attending a join competitor c on c.id = a.competitor_id"))
				.containsExactly("Ostaje");

		/* The comment outlives its author, and what is left of him is the name as
		   it was published. Both comments are read back, so a rule that took every
		   comment or emptied every author cannot pass. */
		assertThat(db.sql("select who || ' ' || case when competitor_id is null then 'bez profila' else 'sa profilom'"
				+ " end from event_comment order by who").query(String.class).list())
				.containsExactly("Odlazi Trkac bez profila", "Ostaje Trkac sa profilom");

		assertThat(referrerOf(broughtByTheOneWhoGoes)).isEqualTo("bez onoga ko ga je doveo");
		assertThat(referrerOf(broughtByTheOneWhoStays)).isEqualTo("Ostaje");
	}

	/**
	 * Deleting an event takes its races, the results run in them, the intentions
	 * to go and the comments about it.
	 *
	 * That is what the portal already does from two different screens, and it does
	 * it because a race deleted alone belongs to nothing and a result left behind
	 * points at an event that is gone. Unlike a member, an event is not personal
	 * data and is never deleted on request (A37), so nothing about it is a
	 * tombstone.
	 *
	 * The second event is what makes the counts mean anything: with one event the
	 * same four numbers would be the answer to "is the database empty".
	 */
	@Test
	void deletingAnEventTakesItsRacesResultsIntentionsAndComments() {
		long goes = event("odlazi-2027", A_TOWN_IN_SERBIA + ", null, null");
		long stays = event("ostaje-2027", A_TOWN_IN_SERBIA + ", null, null");
		long runner = member("Prvi", "Trkac", A_TOWN_IN_SERBIA + ", null, null");

		for (long event : List.of(goes, stays)) {
			result(runner, race(event, "Trka " + event, "10.00"), "10.00");
			attend(event, runner);
			comment(event, runner, "Prvi Trkac");
		}

		db.sql("delete from btl_event where id = " + goes).update();

		assertThat(slugsBehind("race", "event_id")).containsExactly("ostaje-2027");
		assertThat(slugsBehind("attending", "event_id")).containsExactly("ostaje-2027");
		assertThat(slugsBehind("event_comment", "event_id")).containsExactly("ostaje-2027");
		assertThat(db.sql("select e.slug from result r join race ra on ra.id = r.race_id"
				+ " join btl_event e on e.id = ra.event_id order by e.slug").query(String.class).list())
				.containsExactly("ostaje-2027");
	}

	/**
	 * Every rule in the schema about what a deletion takes with it is named here.
	 *
	 * This is the second half of O1 held as a measurement, and it is over the
	 * WHOLE schema rather than over the six tables of this migration, because the
	 * table it is really about does not exist yet. A frozen season is a snapshot
	 * with hard coded values and a member's name written into it as text (A37),
	 * and the one thing that must never happen to it is a cascade arriving from a
	 * member who has been deleted. Until it is written, the only honest guard is
	 * this: a deletion rule added anywhere in the schema fails here, and somebody
	 * has to say out loud what it does.
	 *
	 * Read out of the catalogue and not remembered, so the list cannot quietly
	 * lose an entry either.
	 */
	@Test
	void everyDeletionRuleInTheSchemaIsNamed() {
		List<String> rules = db
				.sql("select rel.relname || '.' || con.conname || ' ' || case con.confdeltype"
						+ " when 'a' then 'no action' when 'r' then 'restrict' when 'c' then 'cascade'"
						+ " when 'n' then 'set null' when 'd' then 'set default' end"
						+ " from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.contype = 'f'"
						+ " order by rel.relname, con.conname")
				.query(String.class)
				.list();

		assertThat(rules).containsExactly(
				// V6, and its cascade is the one place a link may not outlive its account
				"account.account_role_fk no action",
				// mine: an intention is nothing once either end of it is gone
				"attending.attending_competitor_fk cascade",
				"attending.attending_event_fk cascade",
				// O6: the next running of the race stays, its link empties
				"btl_event.btl_event_copied_from_fk set null",
				/* A codebook never disappears under a row that names it, and RESTRICT
				   says so where NO ACTION was only the default nobody had changed.
				   Both refuse the same DELETE today; RESTRICT is the one that cannot
				   be put off, which is what lets a delta's header say the deferral
				   at the top of it does not reach these four
				   (generate_reference_migrations.py, DeltaMigrationAppliesTest). Set
				   on 09.09.2026: `place.place_country_fk` below is V3's and stays as
				   it is, because a merged migration is not rewritten (ADL A2). */
				"btl_event.btl_event_country_fk restrict",
				"btl_event.btl_event_place_fk restrict",
				"competitor.competitor_country_fk restrict",
				/* V8: a photograph may be taken away without taking the member, which is what
				   moderation does when it refuses a picture. The other direction is not a rule
				   here at all - deleting a member leaves the row in `photo` behind, and the file
				   on disk with it, which is the one thing this list cannot say and step six will
				   have to. */
				"competitor.competitor_photo_fk set null",
				"competitor.competitor_place_fk restrict",
				// the credit is paid; the pointer at a deleted person is what goes
				"competitor.competitor_referred_by_fk set null",
				/* V8, and both are CASCADE for the same reason: neither is a fact about the
				   league, both are the register of members, and the register keeps nothing about
				   somebody who is no longer in it. */
				"competitor_document.competitor_document_competitor_fk cascade",
				"email_verification_token.email_verification_token_account_fk cascade",
				// the comment outlives its author and keeps his name as text
				"event_comment.event_comment_competitor_fk set null",
				"event_comment.event_comment_event_fk cascade",
				"parental_consent.parental_consent_competitor_fk cascade",
				"place.place_country_fk no action",
				"race.race_event_fk cascade",
				// PDL P21: deleting a member takes his results with him
				"result.result_competitor_fk cascade",
				"result.result_race_fk cascade",
				/* V10, and the run that is waiting obeys the same two sentences the finished one
				   does: it goes with its member (PDL P21) and it goes with its race. The two
				   codebooks RESTRICT exactly as they do from `competitor` and `btl_event`, which is
				   what stops a delta dropping a town a waiting run names. */
				"result_submission.result_submission_competitor_fk cascade",
				"result_submission.result_submission_country_fk restrict",
				"result_submission.result_submission_place_fk restrict",
				"result_submission.result_submission_race_fk cascade",
				/* V9, and each of the four says something different about what a queue row is.
				   The member's rows go with him, as his results do (owner, 11.09.2026, ADL A42).
				   The moderator's name empties rather than taking the decision with it, because the
				   decision was made and stays made. The photograph empties for the same reason and
				   because a decided row may not hold one at all. And the tab itself RESTRICTS: a
				   right cannot be taken away while rows are still filed under it. */
				"verification.verification_competitor_fk cascade",
				"verification.verification_decided_by_fk set null",
				"verification.verification_photo_fk set null",
				"verification.verification_queue_fk restrict",
				/* And V10's fifth: a decision about a run that is gone is a decision about
				   nothing, so it goes with it. */
				"verification.verification_result_submission_fk cascade");
	}

	/**
	 * The unique key over a race and its day exists to be a target, and it is the
	 * one constraint in this migration that no row can break.
	 *
	 * Over (id, date) where id is already the key, so any row that broke the pair
	 * would break the key first. What it does is let the result name its race and
	 * its day in one reference, which is what keeps the day from being a copy that
	 * can drift. Dropping it therefore looks harmless and is not, and this is the
	 * mutation that says so.
	 *
	 * The reference is put back first, so that a statement which simply does not
	 * work cannot pass for a statement the missing key refused.
	 */
	@Test
	void theKeyOverARaceAndItsDayIsWhatTheResultsReferenceNeeds() {
		db.sql("alter table result drop constraint result_race_fk").update();
		db.sql(addTheReference()).update();

		db.sql("alter table result drop constraint result_race_fk").update();
		/* And the second key standing on the same index, which V10 added: a waiting run points
		   at (id, date) for the same reason a finished one does. PostgreSQL refuses to drop an
		   index another key depends on, so without this line the case fails on the DROP rather
		   than on what it is about. That refusal is itself the fact: the key below is now load
		   bearing for two tables and not one. */
		db.sql("alter table result_submission drop constraint result_submission_race_fk").update();
		db.sql("alter table race drop constraint race_day_unique").update();

		/* The stack rather than the message: Spring words a statement the database
		   would not take as bad grammar and puts what PostgreSQL actually said
		   underneath, and what PostgreSQL said is the whole of the point. */
		assertThatThrownBy(() -> db.sql(addTheReference()).update())
				.hasStackTraceContaining("no unique constraint matching given keys for referenced table \"race\"");
	}

	private static String addTheReference() {
		return "alter table result add constraint result_race_fk foreign key (race_id, race_date)"
				+ " references race (id, date) on update cascade on delete cascade";
	}

	/**
	 * The schema chooses one default and it is the one O17 wrote.
	 *
	 * A member shows nothing of his birthday unless he chooses otherwise, which is
	 * what the published privacy policy and article 74 of the rulebook already
	 * say, so the column carries it. Nothing else here does: a default nobody
	 * wrote down is a decision taken quietly, in a file that cannot be edited once
	 * it is merged.
	 *
	 * The generated keys are the other direction, so a query answering "no
	 * default" to everything cannot pass for a schema that has one.
	 */
	@Test
	void theOnlyDefaultInTheSchemaIsTheOneThePrivacyDecisionWrote() {
		List<String> withDefaults = db
				.sql("select table_name || '.' || column_name from information_schema.columns"
						+ " where table_schema = current_schema() and column_default is not null"
						+ " and table_name = any (array['competitor', 'btl_event', 'race', 'result', 'attending',"
						+ " 'event_comment']) order by table_name, column_name")
				.query(String.class)
				.list();

		assertThat(withDefaults).containsExactly("attending.id", "btl_event.id", "competitor.birthday_shown",
				"competitor.id", "event_comment.id", "race.id", "result.id");

		assertThat(db.sql("select column_default from information_schema.columns where table_schema ="
				+ " current_schema() and table_name = 'competitor' and column_name = 'birthday_shown'")
				.query(String.class).single())
				.startsWith("'none'");
	}

	/**
	 * The names on a member sort by the Serbian Latin alphabet (O21).
	 *
	 * The same pair ConventionsTest uses on the codebooks, and here because the
	 * collation has to be written on each column that holds a name: a surname
	 * column left without it would sort by whatever the database was created
	 * with, and under both the ICU root and libc en_US these two come out the
	 * other way round.
	 */
	@Test
	void theNamesOfAMemberSortBySerbianLatin() {
		member("Cvetko", "Cvetkovic", A_TOWN_IN_SERBIA + ", null, null");
		member("Čedomir", "Čačanin", A_TOWN_IN_SERBIA + ", null, null");

		/* Both columns, and both pairs come out the other way round under the ICU
		   root and under libc en_US: there the caron is an accent, the two words
		   are one letter at the primary level, and what decides is the letter
		   after it. */
		assertThat(db.sql("select last_name from competitor order by last_name").query(String.class).list())
				.containsExactly("Cvetkovic", "Čačanin");
		assertThat(db.sql("select first_name from competitor order by first_name").query(String.class).list())
				.containsExactly("Cvetko", "Čedomir");
	}

	private long member(String firstName, String lastName, String town) {
		return member(firstName, lastName, town, null);
	}

	private long member(String firstName, String lastName, String town, Long referredBy) {
		int number = nextMember++;
		return db
				.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
						+ " city, country_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at) values ('000" + number
						+ "', '" + firstName + "', '" + lastName + "', 'M', date '1990-05-05', " + town
						+ ", 2027, false, true, 'payment', '0000000000000" + number + "', "
						+ (referredBy == null ? "null" : referredBy) + ", '', false, 'none', "
						+ "'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.query(Long.class)
				.single();
	}

	private long event(String slug, String town) {
		return db
				.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
						+ " description, link, copied_from) values ('" + slug + "', 'Dogadjaj " + slug
						+ "', date '2027-04-03', " + town + ", 'race', false, '', '', null) returning id")
				.query(Long.class)
				.single();
	}

	private void copy(String slug, long parent) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description,"
				+ " link, copied_from) values ('" + slug + "', 'Dogadjaj " + slug + "', date '2027-04-03', "
				+ A_TOWN_IN_SERBIA + ", null, null, 'race', false, '', '', " + parent + ")").update();
	}

	private long race(long event, String name, String distanceKm) {
		return db
				.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
						+ " descent_m) values (" + event + ", '" + name + "', false, date '2027-04-03', 'length',"
						+ " 0, " + distanceKm + ", 100, 100) returning id")
				.query(Long.class)
				.single();
	}

	private long timedRace(long event, String name) {
		return db
				.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
						+ " descent_m) values (" + event + ", '" + name + "', false, date '2027-04-03', 'time',"
						+ " 86400, 0.00, 0, 0) returning id")
				.query(Long.class)
				.single();
	}

	private void result(long competitor, long race, String distanceKm) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds,"
				+ " points) select " + competitor + ", id, date, " + distanceKm + ", 100, 100, 3600, 12.34"
				+ " from race where id = " + race).update();
	}

	private void attend(long event, long competitor) {
		db.sql("insert into attending (event_id, competitor_id) values (" + event + ", " + competitor + ")").update();
	}

	private void comment(long event, long competitor, String who) {
		db.sql("insert into event_comment (event_id, competitor_id, who, published_at, rating_organisation,"
				+ " rating_value, rating_ambience, body) values (" + event + ", " + competitor + ", '" + who + "', "
				+ AN_INSTANT + ", 5, 4, 5, '')").update();
	}

	private Long countriesRunIn(long competitor) {
		return db
				.sql("select count(distinct coalesce(e.country_id, p.country_id)) from result r"
						+ " join race ra on ra.id = r.race_id"
						+ " join btl_event e on e.id = ra.event_id"
						+ " left join place p on p.id = e.place_id"
						+ " where r.competitor_id = " + competitor)
				.query(Long.class)
				.single();
	}

	private List<String> lastNamesOf(String sql) {
		return db.sql(sql + " order by 1").query(String.class).list();
	}

	private List<String> slugsBehind(String table, String column) {
		return db
				.sql("select e.slug from " + table + " t join btl_event e on e.id = t." + column + " order by e.slug")
				.query(String.class)
				.list();
	}

	/**
	 * Asked so that "nobody brought him" is a word and not a null: a null read
	 * back through a single column is a null whether the row is there or not, and
	 * a member who has been deleted would answer the same as a member who was
	 * never brought by anybody.
	 */
	private String referrerOf(long competitor) {
		return db
				.sql("select coalesce(b.first_name, 'bez onoga ko ga je doveo') from competitor c"
						+ " left join competitor b on b.id = c.referred_by where c.id = " + competitor)
				.query(String.class)
				.single();
	}

	private List<String> columnsOf(String table) {
		return db
				.sql("select column_name from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = ?")
				.param(table)
				.query(String.class)
				.list();
	}
}
