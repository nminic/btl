package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
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
 * while the days themselves are what a member is shown, and the results table's
 * column "i dalje vidi samo datum sa mouseoverom svih DOGAĐAJA iz kojih su trke u
 * toj ligi". Two questions, one answer: {@code raceIds} is what is counted and
 * {@code eventIds} is what is named, and the second is DERIVED from the first
 * rather than stored beside it.
 *
 * <p><b>Where those days are shown moved on 13.09.2026, and the answer here did
 * not.</b> For one day this comment said the list belongs on the page of a single
 * league. The owner corrected himself the next morning: "Pogrešio sam, ne vidi se
 * na pojedinačnim stranama lige. Na pojedinačnim stranama ostaje samo tabela kako
 * jeste. Nego se na pregledu svih liga ispisuje ono što i sad... pa onda ide i
 * sekcijica DOGAĐAJI / TRKE koja se može ekspandovati." So the list lives on the
 * overview of all leagues. It is named here because a comment that says WHERE a
 * field is drawn is the first thing to rot, and this one had already rotted once.
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
 *
 * <p><b>AND ITS MARK, IN THE SHAPE A TEAM'S HAS</b> (owner, PDL 23.11.2026, „Pravi logo
 * lige": „krug, seče se kao znak tima ... čuva se original, prikazuje se u krugu; bez loga
 * ostaje krug sa inicijalima"). {@code league.logo_id} (V108) is answered as {@link TeamApi}
 * answers {@code team.logo_id}, copied with its guards: the DIGEST under
 * {@code /api/photos/} and never the key, which is countable; the circle as three exact
 * fractions under the portal's name {@code size}; the small circle already cut
 * ({@link PhotoApi#addressOfTheSmall}); and all three null together for a league with no
 * mark, never the empty path. The picture is public because a league is: {@link PhotoApi}
 * serves a picture {@code league.logo_id} holds to anybody, which is the owner's „gde se
 * vidi: kartica lige na strani „Lige”, glava lista izabrane lige i strana pojedinačne lige",
 * three pages nobody signs in to read.
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
			List<Long> raceIds, List<Long> eventIds, String logo, Crop crop, String smallLogo) {
	}

	/**
	 * Which circle of the mark is drawn, as three fractions between 0 and 1, under the portal's
	 * word {@code size} for V21's {@code crop_diameter}: the shape {@link TeamApi.Crop} gives a team's.
	 */
	record Crop(BigDecimal x, BigDecimal y, BigDecimal size) {
	}

	/** The address a picture is asked for at, followed by its digest (`PhotoApi`). */
	private static final String A_PICTURE_IS_ASKED_FOR_AT = "/api/photos/";

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
						+ " ), '{}') as event_ids,"
						+ " mark.digest, mark.crop_x, mark.crop_y, mark.crop_diameter"
						+ " from league l"
						/* Left, because a league with no mark is an ordinary league and not one
						   missing from the list, the same reason `TeamApi` gives. */
						+ " left join photo mark on mark.id = l.logo_id"
						+ " order by l.season, l.id")
				.query((row, one) -> {
					/* Every column of `photo` is NOT NULL, so the digest is null exactly when no
					   picture joined, and the mark, its circle and its small one leave together or
					   not at all. */
					String mark = row.getString(9);

					return new League(row.getLong(1), row.getString(2), row.getString(3),
							row.getInt(4), row.getString(5), row.getString(6),
							List.of((Long[]) row.getArray(7).getArray()),
							List.of((Long[]) row.getArray(8).getArray()),
							mark == null ? null : A_PICTURE_IS_ASKED_FOR_AT + mark,
							mark == null ? null
									: new Crop(row.getBigDecimal(10), row.getBigDecimal(11),
											row.getBigDecimal(12)),
							mark == null ? null
									: PhotoApi.addressOfTheSmall(mark, row.getBigDecimal(10),
											row.getBigDecimal(11), row.getBigDecimal(12)));
				})
				.list();
	}
}
