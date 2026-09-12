package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * THE LEAGUES, AND WHICH RACES COUNT TOWARDS EACH.
 *
 * <p>A league is a season, a set of rules, what is given out at the end of it,
 * and a list of the races whose results count. Everything in that sentence is
 * public: a visitor deciding whether to join reads exactly this before anything
 * else, and none of it belongs to anybody.
 *
 * <p><b>Races, and the events those races belong to, and both are answered.</b>
 * The owner, 12.09.2026: a league is assembled "selekcijom događaja, selektujem
 * automatski i sve njegove trke, a mogu i samo da selektujem neku od trka". So
 * what is counted is the RACE - a day with four distances may count one of them -
 * while what the league's page lists is still "lista svih događaja koje spadaju
 * pod tu ligu", and the results table's column "i dalje vidi samo datum sa
 * mouseoverom svih DOGAĐAJA iz kojih su trke u toj ligi". Two questions, one
 * answer: {@code raceIds} is what is counted and {@code eventIds} is what is
 * named, and the second is DERIVED from the first rather than stored beside it.
 * An event on that list with none of its races counted would be a second fact
 * that could disagree with the first, which is the thing V19 took the whole
 * table apart to avoid.
 *
 * <p><b>Both come back as lists inside the league and not as a second
 * resource</b>, because that is the shape the portal already reads and because
 * the question "which races count" has no meaning apart from the league asking
 * it. It is read in one statement rather than one per league: three leagues
 * today and a query per row is a habit that is cheap to start and expensive to
 * find later.
 *
 * <p><b>In season order, newest last.</b> A league is spoken of by its year and
 * the list is read as a history; sorted by the key it would come back in
 * whatever order the rows were written.
 */
@RestController
class LeagueApi {

	private final JdbcClient db;

	LeagueApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * @param raceIds  the races whose results count towards this league, in the
	 *                 order the calendar runs them
	 * @param eventIds the different events those races belong to, in the order the
	 *                 calendar runs them - one entry however many of its races count
	 */
	record League(long id, String slug, String name, int season, String rules, String prizes,
			List<Long> raceIds, List<Long> eventIds) {
	}

	@GetMapping("/api/leagues")
	List<League> leagues() {
		return db.sql("select l.id, l.slug, l.name, l.season, l.rules, l.prizes,"
						/* Gathered in the database rather than in a loop here: `array_agg` over
						   the join, ordered by the day the race is RUN - which is not always the
						   day of its event, because one event may run over more than one morning
						   (V7) - and an empty array rather than a null for a league nothing counts
						   towards yet. A league with no races is a real state and it answers with
						   an empty list, not with nothing. */
						+ " coalesce(("
						+ "   select array_agg(r.id order by r.date, r.id)"
						+ "   from league_race lr join race r on r.id = lr.race_id"
						+ "   where lr.league_id = l.id"
						+ " ), '{}') as race_ids,"
						/* And the events those races belong to, each once however many of its
						   races count. Written as a membership test rather than as a join with
						   `distinct`: an event is on the list or it is not, so there is no
						   duplicate to remove and no keyword whose loss would put one back. The
						   day here is the EVENT'S, which is the day the calendar lists it under
						   and the day the mouseover is read in. */
						+ " coalesce(("
						+ "   select array_agg(e.id order by e.date, e.id)"
						+ "   from btl_event e"
						+ "   where e.id in ("
						+ "     select r.event_id"
						+ "     from league_race lr join race r on r.id = lr.race_id"
						+ "     where lr.league_id = l.id"
						+ "   )"
						+ " ), '{}') as event_ids"
						+ " from league l order by l.season, l.id")
				.query((row, one) -> new League(row.getLong(1), row.getString(2), row.getString(3),
						row.getInt(4), row.getString(5), row.getString(6),
						List.of((Long[]) row.getArray(7).getArray()),
						List.of((Long[]) row.getArray(8).getArray())))
				.list();
	}
}
