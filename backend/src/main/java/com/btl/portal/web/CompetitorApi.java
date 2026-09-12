package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * WHO RUNS IN THE LEAGUE, and only what the league publishes about them.
 *
 * <p><b>The year of birth does not leave this server, and that is the whole
 * reason this resource was written before the easier ones.</b> The published
 * privacy policy and Article 74 of the rulebook say it in one sentence: „Datum
 * rođenja se nikada ne prikazuje, ni u punom ni u skraćenom obliku. Javna je
 * samo kategorija koja iz njega proizlazi." The year IS the shortened form. What
 * the portal serves today carries {@code birthYear} for all thirty two members,
 * which is the thing that had to stop before the policy takes effect on
 * 15.09.2026 (risk R4).
 *
 * <p><b>What replaces it is the category, and it is not here yet.</b> The age
 * band is worked out from the year and the season, and a member in their first
 * season carries that category instead, which depends on their whole history of
 * points (PDL P7, and the owner's decisions of 03.08. and 11.08.2026). That is
 * its own increment, on the server, the same way the points themselves are. Until
 * it lands the screens keep working it out from what they have; nothing reads
 * this resource yet.
 *
 * <p><b>And the referral code does not leave either.</b> Article 73 lists what is
 * public and the code is not on it: it is the member's to hand out, not the
 * portal's to publish beside their name.
 *
 * <p>Both omissions are named at the call site in {@code CompetitorApiTest}, with
 * the reason, and each name is checked to be one the portal really serves. A
 * field that went missing by accident and one left out on purpose look the same
 * from a test; this is what tells them apart.
 *
 * <p><b>A hidden profile is still in this list.</b> Hiding a profile is about the
 * profile PAGE (PDL P23); the member number, the name and the standing stay
 * public, and the portal needs the flag in order to know what to draw. Deleting a
 * member is the other door and it takes the row with it.
 *
 * <p><b>In member number order</b>, which is the one order the portal speaks of
 * them in: it is printed on the card and it never changes.
 */
@RestController
class CompetitorApi {

	private final JdbcClient db;

	CompetitorApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * @param membershipBasis how the membership is held: paid, exempt, or one of
	 *                        the other bases the price list knows
	 * @param referredBy      the member number of whoever brought them in, or null
	 */
	record Competitor(String memberNumber, String firstName, String lastName, String gender,
			String city, String country, boolean firstSeason2027, int firstSeason, boolean active,
			String membershipBasis, String bio, Long teamId, Integer teamSince, String referredBy,
			boolean profileHidden, String birthdayShown) {
	}

	@GetMapping("/api/competitors")
	List<Competitor> competitors() {
		return db.sql("select c.member_number, c.first_name, c.last_name, c.gender,"
						+ " coalesce(town.name, c.city) as city,"
						+ " coalesce(town_country.code, typed_country.code) as country,"
						+ " c.first_season_2027, c.first_season, c.active, c.membership_basis,"
						+ " c.bio, m.team_id, m.season_from as team_since,"
						+ " brought.member_number as referred_by, c.profile_hidden, c.birthday_shown"
						+ " from competitor c"
						+ " left join place town on town.id = c.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = c.country_id"
						+ " left join competitor brought on brought.id = c.referred_by"
						/* The membership that has not ended: a member is in one team at a time
						   (V11), and the season it started in is what the portal draws beside the
						   club's name. */
						+ " left join team_membership m on m.competitor_id = c.id"
						+ "  and m.season_to is null"
						+ " order by c.member_number")
				.query((row, one) -> new Competitor(row.getString(1), row.getString(2),
						row.getString(3), row.getString(4), row.getString(5), row.getString(6),
						row.getBoolean(7), row.getInt(8), row.getBoolean(9), row.getString(10),
						row.getString(11),
						row.getObject(12) == null ? null : row.getLong(12),
						row.getObject(13) == null ? null : row.getInt(13),
						row.getString(14), row.getBoolean(15), row.getString(16)))
				.list();
	}
}
