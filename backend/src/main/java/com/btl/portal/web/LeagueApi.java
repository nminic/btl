package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * THE LEAGUES, AND WHICH DAYS COUNT TOWARDS EACH.
 *
 * <p>A league is a season, a set of rules, what is given out at the end of it,
 * and a list of the events whose results count. Everything in that sentence is
 * public: a visitor deciding whether to join reads exactly this before anything
 * else, and none of it belongs to anybody.
 *
 * <p><b>The events come back as a list inside the league and not as a second
 * resource</b>, because that is the shape the portal already reads and because
 * the question "which days count" has no meaning apart from the league asking
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
	 * @param eventIds the events whose results count towards this league, in the
	 *                 order the calendar runs them
	 */
	record League(long id, String slug, String name, int season, String rules, String prizes,
			List<Long> eventIds) {
	}

	@GetMapping("/api/leagues")
	List<League> leagues() {
		return db.sql("select l.id, l.slug, l.name, l.season, l.rules, l.prizes,"
						/* The events gathered in the database rather than in a loop here:
						   `array_agg` over the join, ordered by the day the event is on, and an
						   empty array rather than a null for a league nothing counts towards
						   yet - a league with no events is a real state and it answers with an
						   empty list, not with nothing. */
						+ " coalesce(("
						+ "   select array_agg(e.id order by e.date, e.id)"
						+ "   from league_event le join btl_event e on e.id = le.event_id"
						+ "   where le.league_id = l.id"
						+ " ), '{}') as event_ids"
						+ " from league l order by l.season, l.id")
				.query((row, one) -> new League(row.getLong(1), row.getString(2), row.getString(3),
						row.getInt(4), row.getString(5), row.getString(6),
						List.of((Long[]) row.getArray(7).getArray())))
				.list();
	}
}
