package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.team.Membership;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.ZonedDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * A SEASON BEGINS: WHOEVER DID NOT RENEW BY 16:00 ON 1 JANUARY IS OUT OF HIS TEAM AND HIS PAIR.
 *
 * <p><b>The owner's decisions, PDL „Članovi koji ne produže članarinu"</b>, searched for by their text:
 * <ul>
 * <li>19.09.2026, „Ispadanje se upisuje, poslom koji se pokrene 1. januara u 16h po CET": „BE prodje u
 * 1.1.2028. u 16h kroz sve timove i sve parove i kad god naidje na clana koji nije azuran, raskine ga sa
 * tim timom. A ako ga nadje u paru, rasturi par (i njegov par ostaje bez para logicno)." Derived beside it
 * the same day: the freeze first, then the dropping out.</li>
 * <li>19.09.2026: „OK je da kad neko ostane bez para da mu se to javi porukom u sanduce. Dovoljno je tako.
 * Ukoliko naravno ni jedan clan iz para nije nastavio clanarinu u novoj sezoni, niko ne dobija nista."</li>
 * <li>05.11.2026, „Član koji nije platio do 1. januara u 16h ispada iz tima i para tog trenutka, i ne vraća
 * se iako plati do 31. marta."</li>
 * <li>05.11.2026, „Tim čiji administrator nije produžio članarinu dobija novog administratora: člana koji je
 * najduže u timu", named by the job and told in his inbox; handing the role on goes through the
 * administration only (05.11.2026, „Novi administrator tima ulogu predaje samo preko administracije
 * portala").</li>
 * <li>05.11.2026, „Storno sezone posle 1. januara u 16h izbacuje člana iz tima i para odmah, sa istim
 * porukama kao posao od 1. januara" - {@link #cancelled}.</li>
 * <li>25.09.2026, „Tim nestaje sam čim ostane bez poslednjeg člana", and „Prethodne sezone su zamrznute i
 * ne diraju se".</li>
 * </ul>
 *
 * <p><b>WHO IS NOT „AŽURAN" IS A MOMENT, NOT A STATE AT THE TIME THE JOB RUNS.</b> A member stays when he
 * holds a membership of the season that begins, activated no later than the moment the season before it
 * froze ({@link SeasonClock#tablesFreeze}), read through {@link WhenASeasonWasActivated#of}, the one place
 * that knows when a membership was activated. So a server that comes up at 18:00 drops the member whose fee
 * was booked at 17:00, which is the owner's „nije platio do 1. januara u 16h", and does not keep him merely
 * because the job was late. A membership with no moment at all (the one exemption written before V35) is in
 * time, for {@link WhenASeasonWasActivated}'s own reason. Booked is what counts, never the day the money was
 * sent: PDL 13.09.2026, „Uplata kupuje sezonu po danu knjiženja".
 *
 * <p><b>{@code competitor.active} IS NEITHER READ NOR WRITTEN HERE</b>, and that is ADL 05.11.2026, „Posao od
 * 1. januara: tri toka i jedan redosled": the flag becomes derived in its own increment (AF). Reading it
 * would answer „was he ever activated", which every member in a team was; the membership of the season is
 * the fact.
 *
 * <p><b>WHAT IS WRITTEN IS WHAT THE PORTAL ALREADY WRITES BY HAND, IN THE SAME SHAPES.</b> A membership that
 * covers the season that just ended is ended at it, with a reason, exactly as {@link TeamWriteApi} ends one
 * in the window ({@link Membership#ended}); one that had not begun before the new season is deleted, as that
 * route deletes one, because an end before its beginning is a row the schema refuses. A pair of the new
 * season goes, as „Raskini" deletes it. A team nobody is in for the new season goes through
 * {@link ATeamGoesWithItsLastMember#takeAway}, the only place that deletes a team. Pairs and teams of the
 * season that froze are never touched.
 *
 * <p><b>THE SEAT IS READ BEFORE AND AFTER, THROUGH THE PORTAL'S OWN RULE.</b> {@link TeamApi#WHO_ADMINISTERS_IT}
 * (the named member while he stands, else the longest in the team by season of joining and then the smaller
 * member number, PDL 04.09.2026) is asked before anybody is dropped and again after. Where the answer moved
 * to somebody, he is NAMED in {@code team.admin_id} and told: named, because a founder who renews and comes
 * back to the same team in a later window would otherwise take the seat back from the member the job told
 * he holds it. A seat that names a member who drops is emptied first, as {@link TeamWriteApi} empties it when
 * he walks out.
 */
@Component
class ASeasonBegins implements WhatFollowsTheFreeze {

	private static final Logger LOG = LoggerFactory.getLogger(ASeasonBegins.class);

	/** The subject of the message to the member a team now has as its administrator, approved 05.11.2026. */
	static final String YOU_ADMINISTER = "Vi ste administrator tima ";

	/**
	 * THE FIRST SEASON THAT BEGINS WITH THE DROPPING OUT: the first job runs on 1 January 2028 (PDL 05.11.2026,
	 * „Ispadanje iz timova i parova prvi put radi 1.1.2028"), and a season cancelled for 2027 moves nobody
	 * („Storno sezone 2027 ne izbacuje iz tima ni para; pravilo „storno izbacuje odmah" važi od sezone 2028").
	 */
	static final int FIRST_SEASON_THAT_DROPS_MEMBERS = 2028;

	private final JdbcClient db;

	private final ATeamGoesWithItsLastMember teams;

	ASeasonBegins(JdbcClient db, ATeamGoesWithItsLastMember teams) {
		this.db = db;
		this.teams = teams;
	}

	/**
	 * THE FREEZE OF A SEASON IS THE BEGINNING OF THE ONE AFTER IT, in the transaction the snapshot is written
	 * in and after it ({@link WhatFollowsTheFreeze}): 2027 freezes on 1.1.2028 at 16:00 and 2028 begins then.
	 * The season handed over is the frozen one, so the one that begins is {@code frozenSeason + 1}.
	 *
	 * <p><b>A freeze before the first dropping out moves nobody</b> (PDL 05.11.2026, „Ispadanje iz timova i
	 * parova prvi put radi 1.1.2028"): the freeze of 2026 would begin 2027, the first season of the league, and
	 * there is no such freeze, since {@link ASeasonFreezes} starts at {@link SeasonClock#FIRST_SEASON}. The
	 * guard is here all the same, so the decision does not rest on the loop of another class.
	 */
	@Override
	public void followTheFreezeOf(int frozenSeason) {
		if (frozenSeason + 1 < FIRST_SEASON_THAT_DROPS_MEMBERS) {
			return;
		}

		begin(frozenSeason + 1);
	}

	/**
	 * THE SEASON BEGINS: everybody in a team or in a pair of it who did not renew in time is dropped, and
	 * every team nobody is in for it goes - including a team every member of which walked out in the window,
	 * which {@link ATeamGoesWithItsLastMember#goIfEmpty} leaves standing until now on purpose.
	 *
	 * <p>Called once for a season, right after the season before it froze and in the same transaction, which
	 * is what makes it run once and after the freeze. A second call drops nobody, since everybody it would
	 * drop is already out, and writes nothing; a member who paid after the cut and is already out is not
	 * taken back („ne vraća se iako plati do 31. marta").
	 *
	 * @param season the season that begins
	 */
	void begin(int season) {
		Timestamp cut = Timestamp.from(SeasonClock.tablesFreeze(season - 1).toInstant());

		List<Long> lapsed = db.sql("select c.id from competitor c"
						+ " where (exists(select 1 from team_membership m"
						+ " where m.competitor_id = c.id and m.season_to is null)"
						+ " or exists(select 1 from racing_pair p"
						+ " where p.season = :season and (p.man_id = c.id or p.woman_id = c.id)))"
						+ " and not exists(select 1 from membership held"
						+ " where held.competitor_id = c.id and held.season = :season"
						+ " and coalesce(" + WhenASeasonWasActivated.of("held") + " <= :cut, true))"
						+ " order by c.id")
				.param("season", season)
				.param("cut", cut)
				.query(Long.class)
				.list();

		out(lapsed, season, false);

		List<Long> nobodyIsIn = db.sql("select t.id from team t where not exists(select 1 from team_membership m"
						+ " where m.team_id = t.id and (m.season_to is null or m.season_to >= ?))"
						+ " order by t.id")
				.param(season)
				.query(Long.class)
				.list();

		nobodyIsIn.forEach(teams::takeAway);

		LOG.info("season {} begins: {} members out of their teams and pairs, {} teams gone", season,
				lapsed.size(), nobodyIsIn.size());
	}

	/**
	 * A SEASON CANCELLED AFTER IT BEGAN takes its member out of his team and his pair at once (PDL
	 * 05.11.2026), from the season 2028 on ({@link #FIRST_SEASON_THAT_DROPS_MEMBERS}); a season before it moves
	 * nobody. The new administrator of his team is told with „Od danas" ({@link #theSeatReadsFromToday}), not
	 * with the first of January. Before the season before it froze, nothing happens here: until 16:00 on 1 January the
	 * season being cancelled has not begun for teams, and {@link #begin} drops him at 16:00 anyway, since he
	 * holds nothing then.
	 *
	 * <p>Asked by the cancellation AFTER its rows go and BEFORE {@code active} is written again, so the
	 * seat is read while he still stands in it.
	 *
	 * @param member the member whose season was cancelled
	 * @param season the season cancelled
	 * @param now    the moment of the cancellation
	 */
	void cancelled(long member, int season, ZonedDateTime now) {
		if (season < FIRST_SEASON_THAT_DROPS_MEMBERS || !SeasonClock.isFrozen(season - 1, now)) {
			return;
		}

		Set<Long> touched = out(List.of(member), season, true);

		for (Long team : touched) {
			boolean nobodyIsIn = Boolean.TRUE.equals(db.sql("select not exists(select 1 from team_membership m"
							+ " where m.team_id = ? and (m.season_to is null or m.season_to >= ?))")
					.params(team, season)
					.query(Boolean.class)
					.single());

			if (nobodyIsIn) {
				teams.takeAway(team);
			}
		}
	}

	/**
	 * These members out of every team and every pair of the season, with the seats and the messages.
	 *
	 * @param fromToday whether the seat is told with „Od danas" (a cancellation) and not with the first of
	 *                  January (the job)
	 * @return the teams they were in
	 */
	private Set<Long> out(Collection<Long> members, int season, boolean fromToday) {
		Set<Long> touched = new LinkedHashSet<>();

		for (Long member : members) {
			touched.addAll(db.sql("select team_id from team_membership where competitor_id = ? and season_to is null")
					.param(member)
					.query(Long.class)
					.list());
		}

		Map<Long, Long> before = seats(touched);

		for (Long member : members) {
			outOfHisTeam(member, season);
		}

		Map<Long, Long> after = seats(touched);

		for (Long team : touched) {
			Long now = after.get(team);

			if (now != null && !now.equals(before.get(team))) {
				db.sql("update team set admin_id = ? where id = ?").params(now, team).update();

				String name = db.sql("select name from team where id = ?").param(team).query(String.class).single();

				tell(now, YOU_ADMINISTER + name, fromToday ? theSeatReadsFromToday(name) : theSeatReads(name, season));
			}
		}

		for (Long member : members) {
			outOfHisPair(member, members, season);
		}

		return touched;
	}

	/**
	 * His open membership ends at the season that froze, or goes if it had not begun before the new one;
	 * and a seat that names him is emptied.
	 */
	private void outOfHisTeam(long member, int season) {
		List<Membership> open = db.sql("select team_id, season_from from team_membership"
						+ " where competitor_id = ? and season_to is null")
				.param(member)
				.query((row, one) -> Membership.open(row.getLong(1), row.getInt(2)))
				.list();

		for (Membership his : open) {
			if (his.covers(season - 1)) {
				Membership left = his.ended(season - 1, Membership.THE_FEE_LAPSED);

				db.sql("update team_membership set season_to = ?, left_reason = ?"
								+ " where competitor_id = ? and team_id = ? and season_to is null")
						.params(left.seasonTo(), left.leftReason(), member, his.teamId())
						.update();
			}
			else {
				db.sql("delete from team_membership where competitor_id = ? and team_id = ? and season_to is null")
						.params(member, his.teamId())
						.update();
			}
		}

		db.sql("update team set admin_id = null where admin_id = ?").param(member).update();
	}

	/**
	 * His pair of the season goes, and the other half is told unless he is dropped as well.
	 */
	private void outOfHisPair(long member, Collection<Long> dropped, int season) {
		record Pair(long id, long other, String name, String gender) {
		}

		List<Pair> his = db.sql("select p.id, case when p.man_id = :me then p.woman_id else p.man_id end,"
						+ " me.first_name || ' ' || me.last_name, me.gender"
						+ " from racing_pair p join competitor me on me.id = :me"
						+ " where p.season = :season and (p.man_id = :me or p.woman_id = :me)")
				.param("me", member)
				.param("season", season)
				.query((row, one) -> new Pair(row.getLong(1), row.getLong(2), row.getString(3), row.getString(4)))
				.list();

		for (Pair pair : his) {
			db.sql("delete from racing_pair where id = ?").param(pair.id()).update();

			if (!dropped.contains(pair.other())) {
				tell(pair.other(), PairWriteApi.THE_PAIR_IS_BROKEN, thePairReads(pair.name(), pair.gender(), season));
			}
		}
	}

	/**
	 * Who administers each of these teams by the portal's rule, or no entry where nobody does. The rule
	 * answers NULL for a team with nobody standing in it, read here as 0, which no key ever is.
	 */
	private Map<Long, Long> seats(Collection<Long> touched) {
		Map<Long, Long> seats = new HashMap<>();

		for (Long team : touched) {
			long seat = db.sql("with standing as (" + TeamApi.WHO_STANDS_IN_A_TEAM + ")"
							+ " select coalesce(" + TeamApi.WHO_ADMINISTERS_IT + ", 0) from team t where t.id = ?")
					.param(team)
					.query(Long.class)
					.single();

			if (seat != 0) {
				seats.put(team, seat);
			}
		}

		return seats;
	}

	/**
	 * WHAT THE OTHER HALF OF A PAIR READS, approved by the owner on 05.11.2026 (PDL „Tekstovi poruka pri
	 * prelazu sezone"). The pair is mixed (V12), so the one who did not renew is always of the other sex
	 * than the reader, and the verb follows him.
	 */
	static String thePairReads(String who, String gender, int season) {
		return who + " nije " + (Objects.equals("M", gender) ? "produžio" : "produžila") + " članarinu za sezonu "
				+ season + ", pa je vaš trkački par raskinut.";
	}

	/** WHAT THE NEW ADMINISTRATOR OF A TEAM READS, approved by the owner on 05.11.2026. */
	static String theSeatReads(String team, int season) {
		return "Od 1. januara " + season + " vi ste administrator tima " + team + ", jer je dosadašnjem"
				+ " administratoru istekla članarina, a vi ste član koji je najduže u timu. Ako ne želite ovu"
				+ " ulogu, javite se ligi.";
	}

	/** WHAT THE NEW ADMINISTRATOR OF A TEAM READS AFTER A CANCELLATION IN THE YEAR, approved by the owner on 05.11.2026. */
	static String theSeatReadsFromToday(String team) {
		return "Od danas vi ste administrator tima " + team + ", jer je dosadašnjem administratoru istekla"
				+ " članarina, a vi ste član koji je najduže u timu. Ako ne želite ovu ulogu, javite se ligi.";
	}

	/** The portal writing in the league's name, as {@link PairWriteApi} does. */
	private void tell(long member, String subject, String body) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body) values (?, null, ?, ?, ?)")
				.params(member, PairWriteApi.THE_LEAGUE, subject, body)
				.update();
	}
}
