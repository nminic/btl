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
 * <p><b>And nothing about the membership fee leaves either.</b> The same article
 * of the rulebook goes on: „Datum rođenja se nikada ne prikazuje, ni u punom ni
 * u skraćenom obliku. Javna je samo kategorija koja iz njega proizlazi. <b>Isto
 * važi za adresu elektronske pošte, adresu, sve u vezi sa članarinom i privatne
 * poruke.</b>" The basis on which a membership is held says who is exempt from
 * paying, so it is „sve u vezi sa članarinom" and it stays behind. What the
 * member sees about their own fee is their own screen's business, once there is
 * a resource that answers only to them.
 *
 * <p><b>And neither the referral code nor who handed it out.</b> Article 73
 * lists what is public and neither is on it. This one is worth the extra
 * sentence, because the name hides it: the portal reads {@code referredBy} as the
 * CODE of whoever brought the member in ({@code data/types.ts}: „Not the member
 * number, which is public and consecutive"). Answering with the member number
 * instead would quietly change what the field means and hand every screen that
 * counts referrals an answer of nothing; answering with the code would publish a
 * secret beside a name. Counting who a member brought in is a question about
 * that member, and it belongs to the resource that knows who is asking.
 *
 * <p>All four omissions are the reason this resource exists. PDL, 06.09.2026,
 * measured and named exactly these fields as the ones that cannot leave the
 * public file „dok portal nema bekend", because one file was serving the public
 * side, the member's own screens and the administration at once. This is that
 * backend, and it must not repeat the file it replaces.
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
	 * @param active           whether the membership is standing, which Article 73
	 *                         makes public as the member's status; how it is held,
	 *                         and what was paid for it, is not on that list
	 * @param birthdayShown    what the member chose about their birthday, which the
	 *                         portal needs in order to draw the card at all
	 */
	record Competitor(String memberNumber, String firstName, String lastName, String gender,
			String city, String country, boolean firstSeason2027, int firstSeason, boolean active,
			String bio, Long teamId, Integer teamSince, boolean profileHidden,
			String birthdayShown) {
	}

	@GetMapping("/api/competitors")
	List<Competitor> competitors() {
		return db.sql("select c.member_number, c.first_name, c.last_name, c.gender,"
						+ " coalesce(town.name, c.city) as city,"
						+ " coalesce(town_country.code, typed_country.code) as country,"
						+ " c.first_season_2027, c.first_season, c.active,"
						+ " c.bio, m.team_id, m.season_from as team_since,"
						+ " c.profile_hidden, c.birthday_shown"
						+ " from competitor c"
						+ " left join place town on town.id = c.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = c.country_id"
						/* The membership that has not ended: a member is in one team at a time
						   (V11), and the season it started in is what the portal draws beside the
						   club's name. */
						+ " left join team_membership m on m.competitor_id = c.id"
						+ "  and m.season_to is null"
						+ " order by c.member_number")
				.query((row, one) -> new Competitor(row.getString(1), row.getString(2),
						row.getString(3), row.getString(4), row.getString(5), row.getString(6),
						row.getBoolean(7), row.getInt(8), row.getBoolean(9), row.getString(10),
						row.getObject(11) == null ? null : row.getLong(11),
						row.getObject(12) == null ? null : row.getInt(12),
						row.getBoolean(13), row.getString(14)))
				.list();
	}
}
