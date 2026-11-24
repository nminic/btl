package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.Map;
import java.util.function.BiConsumer;
import java.util.stream.Stream;

import static java.util.Map.entry;

/**
 * EVERYTHING OF THE LEAGUE THAT MAKES A REGISTRATION MORE THAN ONE, one row per clause of {@link
 * LeavingBeforeBecomingAMember#NEVER_A_MEMBER} and of the portal's administration, ONE LIST FOR EVERY DOOR
 * THAT ASKS IT: {@code DELETE /api/me} and {@code mayLeave} ({@code MeLeavingApiTest}), and {@code DELETE
 * /api/members/unnumbered/{competitorId}} and {@code mayBeDeleted} on {@code GET /api/payments}
 * ({@code ARegistrationIsDeletedApiTest}). Two lists would be two answers the day one of them gained a row,
 * which is the reason the condition itself has one home.
 */
final class ThingsOfTheLeague {

	private ThingsOfTheLeague() {
	}

	static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	/**
	 * What stands around the one being asked about: somebody else who never became a member either, and a
	 * team, an event and a race for everybody, so the row that makes him a team's member does not also make
	 * him its administrator, and a result does not also carry an announcement.
	 */
	record Around(JdbcClient db, long someoneElse, long aTeam, long anEvent, long aRace) {

		static Around in(JdbcClient db, long someoneElse) {
			long aTeam = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
							+ " first_season, admin_id) values ('tim-odlaska', 'Tim odlaska', '', '', "
							+ A_TOWN_IN_SERBIA + ", null, null, null, 2027, null) returning id")
					.query(Long.class).single();
			long anEvent = db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description,"
							+ " link) values ('dogadjaj-odlaska', 'Dogadjaj odlaska', date '2027-05-01', "
							+ A_TOWN_IN_SERBIA + ", 'race', false, '', '') returning id")
					.query(Long.class).single();
			long aRace = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
							+ " ascent_m, descent_m) values (?, 'Trka odlaska', false, date '2027-05-01', 'length', 0,"
							+ " 10.00, 0, 0) returning id")
					.param(anEvent).query(Long.class).single();

			return new Around(db, someoneElse, aTeam, anEvent, aRace);
		}
	}

	/** ONE ROW EACH, AND EACH BREAKS ONE CLAUSE AND NO OTHER, over what {@link Around} has standing. */
	static final Map<String, BiConsumer<Around, Long>> BLOCKERS = Map.ofEntries(
			entry("a member number", (f, m) -> f.db().sql("update competitor set member_number = '099901'"
					+ " where id = ?").param(m).update()),
			entry("a season freed of the fee", (f, m) -> HeldOn.season(f.db(), m, 2028, "feeExempt")),
			entry("the trail of a cancelled season", (f, m) -> f.db().sql("insert into membership_change"
					+ " (competitor_id, season, action, basis_before, basis_after, decided_by, decided_by_name,"
					+ " decided_at) values (?, 2028, 'cancelled', 'payment', null, null, 'Blagajnik Probni',"
					+ " timestamptz '2027-03-01 10:00:00+00')").param(m).update()),
			entry("a payment that awaits its booking", (f, m) -> f.db().sql("insert into payment (competitor_id,"
					+ " season, reference, price_row_id, amount, currency, fee, method, state) values (?, 2028,"
					+ " null, (select id from price_row order by sort_order limit 1), 35.00, 'EUR', 3.00,"
					+ " 'paypal', 'awaited')").param(m).update()),
			entry("an entry of his balance", (f, m) -> f.db().sql("insert into balance_entry (competitor_id,"
					+ " amount, currency, reason, referred_competitor_id, occurred_at, recorded_by_name)"
					+ " values (?, 600.00, 'RSD', 'referral', ?, timestamptz '2027-03-01 10:00:00+00',"
					+ " 'Blagajnik Probni')").params(m, f.someoneElse()).update()),
			entry("a result", (f, m) -> f.db().sql("insert into result (competitor_id, race_id, race_date,"
					+ " distance_km, ascent_m, descent_m, seconds, points) values (?, ?, date '2027-05-01',"
					+ " 10.00, 0, 0, 3000, 10.00)").params(m, f.aRace()).update()),
			entry("a result that waits for a moderator", (f, m) -> f.db().sql("insert into result_submission"
					+ " (competitor_id, race_date, race_name, race_kind, event_kind, place_id, city, country_id,"
					+ " distance_km, ascent_m, descent_m, seconds, link, comment) values (?, date '2027-06-06',"
					+ " 'Trka kroz sumu', 'free', 'race', " + A_TOWN_IN_SERBIA + ", null, null, 10.00, 100,"
					+ " 100, 3600, '', '')").param(m).update()),
			entry("an announcement", (f, m) -> f.db().sql("insert into attending (event_id, competitor_id)"
					+ " values (?, ?)").params(f.anEvent(), m).update()),
			entry("a place in a team", (f, m) -> f.db().sql("insert into team_membership (competitor_id, team_id,"
					+ " season_from, season_to, left_reason) values (?, ?, 2027, null, null)")
					.params(m, f.aTeam()).update()),
			entry("a proposal of a team", (f, m) -> f.db().sql("insert into team_proposal (competitor_id, team_id,"
					+ " name, bio, link, place_id, city, country_id, logo_id) values (?, null, 'Predlozen tim',"
					+ " '', '', " + A_TOWN_IN_SERBIA + ", null, null, null)").param(m).update()),
			entry("an application to a team", (f, m) -> f.db().sql("insert into team_application (competitor_id,"
					+ " team_id, season) values (?, ?, 2028)").params(m, f.aTeam()).update()),
			entry("an invitation into a team", (f, m) -> f.db().sql("insert into team_invitation (team_id,"
					+ " competitor_id, season) values (?, ?, 2028)").params(f.aTeam(), m).update()),
			entry("the administration of a team", (f, m) -> f.db().sql("update team set admin_id = ? where id = ?")
					.params(m, f.aTeam()).update()),
			entry("the role of a moderator", (f, m) -> f.db().sql("update account set role_id = (select id from"
					+ " role where code = 'moderator') where competitor_id = ?").param(m).update()),
			entry("a right of the administration", (f, m) -> f.db().sql("insert into account_admin_right"
					+ " (account_id, right_code) values ((select id from account where competitor_id = ?),"
					+ " 'queue:profiles')").param(m).update()));

	static Stream<String> blockers() {
		return BLOCKERS.keySet().stream().sorted();
	}
}
