package com.btl.portal.web;

import com.btl.portal.domain.event.EventAddress;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;
import java.util.Optional;

/**
 * A TEAM COMING INTO BEING WITH ITS FOUNDER IN IT, WHICHEVER OF THE TWO DOORS IT COMES THROUGH.
 *
 * <p>Two doors make a team since 23.11.2026, and this is the one home of what both of them do:
 *
 * <ul>
 * <li>a moderator approving a member's proposal ({@link VerificationWriteApi}), PDL P13, owner
 * 03.08.2026, „odobrenje pravi tim";
 * <li>the administration making one directly ({@link TeamAdministrationWriteApi#make}), PDL P13,
 * „[ODLUKA 09.10.2026 ...] Administracija pravi i menja tim direktno, bez reda za moderaciju".
 * </ul>
 *
 * <p>Both owe the same three things, and they are written once here so that the two doors cannot
 * drift apart (the shape {@link TeamJoiningWriteApi#theOtherTeamsThatAskedHim} already has for the
 * doors into a team):
 *
 * <ol>
 * <li><b>The founder is in the team at once.</b> PDL P13, owner 05.09.2026: „Odmah ulazi u tim, ne
 * moze da pravi nove timove vise dok je u tom timu". The membership begins in the season a change
 * of team takes effect in, which the same entry derives: „{@code teamSince} osnivača je naredna
 * sezona", so the team scores nothing before 1 January.
 * <li><b>He sits in the seat</b> ({@code team.admin_id}): PDL P13, „Administrator tima je onaj ko
 * je tim osnovao".
 * <li><b>Every other team that had asked him is told</b>, PDL 06.09.2026, by the statement the
 * other doors call.
 * </ol>
 *
 * <p>And the three things that stop it, asked without writing anything so that each caller can
 * refuse before it claims anything ({@link #obstacle}).
 *
 * <p><b>What is NOT here: the founder's own message.</b> The approval tells him his proposal was
 * accepted (owner, 03.08.2026), and that sentence is the approval's and stays in
 * {@link VerificationWriteApi}. Nothing decided what a founder is told when the administration
 * makes the team for him, so nothing is written for it.
 */
@Component
class FoundingATeam {

	/** Why a team cannot be founded, in the order {@link #obstacle} asks. */
	enum Obstacle {
		/** Another team already answers at the address the name makes (PDL P13). */
		THE_NAME_IS_TAKEN,
		/** He is in a team, or written into one for a later season. */
		HE_IS_ALREADY_IN_A_TEAM,
		/** He does not hold the season the team would take him in for (PDL 30.10.2026). */
		HE_HAS_NOT_PAID
	}

	/**
	 * What the team is made of.
	 *
	 * @param founder   who founds it, and who is in it and in its seat from then on
	 * @param placeId   the town out of the codebook, or null where it was typed
	 * @param city      the town as typed, or null where it is the codebook's
	 * @param countryId the typed town's country, or null where the town is the codebook's
	 */
	record Founded(long founder, String name, String bio, String link, Long placeId, String city,
			Long countryId) {
	}

	private final JdbcClient db;

	private final AMembershipOfTheSeasonHeWouldJoin holdsTheSeason;

	FoundingATeam(JdbcClient db, AMembershipOfTheSeasonHeWouldJoin holdsTheSeason) {
		this.db = db;
		this.holdsTheSeason = holdsTheSeason;
	}

	/**
	 * THE THREE THINGS THAT REFUSE A TEAM, ASKED WITHOUT WRITING ANYTHING.
	 *
	 * <p>The schema refuses the first two anyway ({@code team_slug_unique} and
	 * {@code team_membership_one_team_at_a_time}), but as a server fault after the team had been
	 * written; asked here, whoever pressed is told which.
	 *
	 * <ul>
	 * <li><b>A membership that ends at or after the season he would join stands in the way</b>, so a
	 * member somebody wrote ahead for a later season is in a team too.
	 * <li><b>The season he holds is the one on sale at this moment</b>
	 * ({@link AMembershipOfTheSeasonHeWouldJoin}), and NOT {@code season}: in January that names a
	 * season nobody can have paid for yet.
	 * </ul>
	 *
	 * @param season the season the team would take him in for, {@code SeasonClock.transfersTakeEffect}
	 */
	Optional<Obstacle> obstacle(long founder, String name, int season, ZonedDateTime now) {
		if (Boolean.TRUE.equals(db.sql("select exists(select 1 from team where slug = ?)")
				.param(EventAddress.written(name)).query(Boolean.class).single())) {
			return Optional.of(Obstacle.THE_NAME_IS_TAKEN);
		}

		if (Boolean.TRUE.equals(db.sql("select exists(select 1 from team_membership"
						+ " where competitor_id = ? and (season_to is null or season_to >= ?))")
				.params(founder, season).query(Boolean.class).single())) {
			return Optional.of(Obstacle.HE_IS_ALREADY_IN_A_TEAM);
		}

		if (!holdsTheSeason.holds(founder, now)) {
			return Optional.of(Obstacle.HE_HAS_NOT_PAID);
		}

		return Optional.empty();
	}

	/**
	 * The team, its founder in it and in its seat, and the other teams told.
	 *
	 * @param season the season the team's first season and the founder's membership both are
	 * @return the team's key
	 */
	long found(Founded team, int season, ZonedDateTime now) {
		long made = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id,"
						+ " first_season, admin_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?) returning id")
				.params(EventAddress.written(team.name()), team.name(), team.bio(), team.link(),
						team.placeId(), team.city(), team.countryId(), season, team.founder())
				.query(Long.class)
				.single();

		db.sql("insert into team_membership (competitor_id, team_id, season_from)"
						+ " values (?, ?, ?)")
				.params(team.founder(), made, season)
				.update();

		String[] him = db.sql("select first_name || ' ' || last_name, gender from competitor where id = ?")
				.param(team.founder())
				.query((row, number) -> new String[] { row.getString(1), row.getString(2) })
				.single();

		TeamJoiningWriteApi.theOtherTeamsThatAskedHim(db, team.founder(), made, him[0], him[1],
				team.name(), now);

		return made;
	}
}
