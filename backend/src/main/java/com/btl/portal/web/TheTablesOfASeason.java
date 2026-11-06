package com.btl.portal.web;

import com.btl.portal.web.SeasonTables.BestRace;
import com.btl.portal.web.SeasonTables.Event;
import com.btl.portal.web.SeasonTables.League;
import com.btl.portal.web.SeasonTables.LeagueRow;
import com.btl.portal.web.SeasonTables.LeagueTable;
import com.btl.portal.web.SeasonTables.Member;
import com.btl.portal.web.SeasonTables.Pair;
import com.btl.portal.web.SeasonTables.PairStanding;
import com.btl.portal.web.SeasonTables.Placed;
import com.btl.portal.web.SeasonTables.Progress;
import com.btl.portal.web.SeasonTables.Run;
import com.btl.portal.web.SeasonTables.Standing;
import com.btl.portal.web.SeasonTables.Tally;
import com.btl.portal.web.SeasonTables.Team;
import com.btl.portal.web.SeasonTables.TeamStanding;
import com.btl.portal.web.SeasonTables.Totals;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * THE SNAPSHOT OF ONE SEASON'S TABLES, WRITTEN ONCE, INSIDE THE ACT OF {@link ASeasonFreezes}.
 *
 * <p>PDL, owner, 31.07.2026, „Zamrznuta sezona je materijalizovan zapis, ne izračun": every table of the
 * season that ended (Takmičari, Timovi, Rang liste, the awards) is written down here, by the ladders of
 * {@link SeasonTables}, into the tables of V17 and V84. Nothing after this reads {@code result} for a
 * frozen season's table: a run entered, corrected or deleted later is seen on the member's profile only
 * (PDL, 31.07.2026, „Rezultat se i posle zamrzavanja sme uneti i ispraviti, ali se vidi samo na profilu
 * tog člana").
 *
 * <p><b>WHO A TABLE IS DRAWN FROM IS READ OFF THE MEMBERSHIPS, NEVER OFF {@code competitor.active}.</b>
 * The live list ({@code /api/competitors}) answers only active members, and the flag of a member whose
 * fee lapsed may already be down when this runs (ADL, 05.11.2026: it stays up until 16:00, but it is a
 * different job's, AF). A member stands in the season he held with the right to rank (PDL, 28.10.2026),
 * whatever his flag says now; the cost of reading the flag would be a member missing from the table of
 * the season he ran, on the minute it froze.
 *
 * <p><b>AND A TEAM'S ROSTER IS READ OFF ITS MEMBERSHIPS' RANGE, NEVER OFF {@code TeamApi}.</b> That route
 * stops naming a member who left in the window the moment the clock says his last season froze, which is
 * this minute; a member who left in the window counts for the team in the whole season he left in (PDL,
 * 10.10.2026, question 38, „Do zamrzavanja"), and the range says so.
 *
 * <p><b>ONE READING OF WHAT WAS APPROVED</b> (PDL, 26.09.2026, „nad istim skupom odobrenog"): this runs
 * in the transaction of {@link ASeasonFreezes}, which is REPEATABLE READ, so the points at the freeze it
 * writes there and the tables it writes here are read off one picture of the database.
 */
@Component
class TheTablesOfASeason {

	private final JdbcClient db;

	private final CategoryOfASeason categories;

	private final BestOfficialSeason bestOfficialSeason;

	TheTablesOfASeason(JdbcClient db, CategoryOfASeason categories, BestOfficialSeason bestOfficialSeason) {
		this.db = db;
		this.categories = categories;
		this.bestOfficialSeason = bestOfficialSeason;
	}

	/** Every table of {@code season}, written. The caller has just taken its row of {@code season_frozen}. */
	void write(int season) {
		List<Member> members = members(season);
		List<Run> runs = runs(season, members);

		writeTheStandings(season, members, runs);
		TheTeams teams = writeTheTeams(season, members, runs);
		writeTheBoards(season, members, runs);
		List<Placed<PairStanding>> pairs = writeThePairs(season, members, runs);
		writeTheLeagues(season, members, runs);
		writeTheAwards(season, members, runs, teams, pairs);
	}

	/** The team standings as written, and each team's page, for the awards. */
	private record TheTeams(List<Placed<TeamStanding>> standings, Map<Long, List<Placed<Standing>>> pages) {
	}

	/** Everybody who holds {@code season} with the right to rank, with the category of that season. */
	private List<Member> members(int season) {
		CategoryOfASeason.Book book = categories.everybody();

		return db.sql("select c.id, c.member_number, c.first_name, c.last_name, c.gender, c.birth_year, "
						+ WhenASeasonWasActivated.of("m")
						+ " from membership m join competitor c on c.id = m.competitor_id"
						+ " where m.season = ? and c.member_number is not null"
						+ " order by c.member_number")
				.param(season)
				.query((row, one) -> WhenASeasonWasActivated.ranks(season, row.getTimestamp(7))
						? member(book, row.getLong(1), row.getString(2), row.getString(3), row.getString(4),
								row.getString(5), row.getInt(6), season)
						: null)
				.list()
				.stream()
				.filter(member -> member != null)
				.toList();
	}

	private static Member member(CategoryOfASeason.Book book, long id, String number, String firstName,
			String lastName, String gender, int birthYear, int season) {
		CategoryOfASeason.OfASeason category = book.in(id, birthYear, season);

		return new Member(id, number, firstName + " " + lastName, gender,
				SeasonTables.categoryCode(gender, category.ageBand(), category.beginner()));
	}

	/** The runs of {@code season} the standings count: those of the members above, in the order served. */
	private List<Run> runs(int season, List<Member> members) {
		Set<Long> standing = new HashSet<>();

		members.forEach(member -> standing.add(member.id()));

		return db.sql("select r.id, r.competitor_id, r.race_id, ra.event_id, r.race_date, r.distance_km,"
						+ " r.ascent_m, r.descent_m, r.seconds, r.points, r.category, ra.name"
						+ " from result r join race ra on ra.id = r.race_id"
						+ " where extract(year from r.race_date) = ?"
						+ " order by r.race_date, r.id")
				.param(season)
				.query((row, one) -> new Run(row.getLong(1), row.getLong(2), row.getLong(3), row.getLong(4),
						row.getDate(5).toLocalDate(), row.getBigDecimal(6), row.getInt(7), row.getInt(8),
						row.getInt(9), row.getBigDecimal(10), row.getString(11), row.getString(12)))
				.list()
				.stream()
				.filter(run -> standing.contains(run.member()))
				.toList();
	}

	private void writeTheStandings(int season, List<Member> members, List<Run> runs) {
		Map<Long, Integer> inTheCategory = new HashMap<>();

		for (String gender : List.of("M", "F")) {
			Set<String> codes = new LinkedHashSet<>();

			members.stream().filter(member -> member.gender().equals(gender)).forEach(member -> codes.add(member.category()));

			for (String code : codes) {
				SeasonTables.standing(members, runs, gender, code)
						.forEach(placed -> inTheCategory.put(placed.row().member().id(), placed.position()));
			}

			for (Placed<Standing> placed : SeasonTables.standing(members, runs, gender, null)) {
				Member member = placed.row().member();
				Totals totals = placed.row().totals();

				db.sql("insert into season_competitor (season, position, competitor_id, who, gender, category,"
								+ " points, races, kilometers, ascent, descent, seconds, category_position)"
								+ " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
						.params(season, placed.position(), member.id(), member.who(), member.gender(),
								member.category(), totals.points(), totals.races(), totals.kilometers(),
								totals.ascent(), totals.descent(), totals.seconds(), inTheCategory.get(member.id()))
						.update();
			}
		}
	}

	/**
	 * The team standings and each team's page. A team with nobody in it in the season is in neither:
	 * it did not run the season ({@code season_team_members_positive}, V17).
	 *
	 * @return the standings, and per frozen team's {@code team.id} the places of its page
	 */
	private TheTeams writeTheTeams(int season, List<Member> members, List<Run> runs) {
		Map<Long, Set<Long>> rosters = new LinkedHashMap<>();

		db.sql("select team_id, competitor_id from team_membership"
						+ " where season_from <= ? and (season_to is null or season_to >= ?)"
						+ " order by team_id, competitor_id")
				.params(season, season)
				.query(row -> {
					rosters.computeIfAbsent(row.getLong(1), any -> new LinkedHashSet<>()).add(row.getLong(2));
				});

		List<Team> teams = db.sql("select id, name from team order by id")
				.query((row, one) -> new Team(row.getLong(1), row.getString(2),
						rosters.getOrDefault(row.getLong(1), Set.of())))
				.list()
				.stream()
				.filter(team -> !team.roster().isEmpty())
				.toList();

		Map<Long, List<Placed<Standing>>> pages = new HashMap<>();
		List<Placed<TeamStanding>> standings = SeasonTables.teams(teams, runs);

		for (Placed<TeamStanding> placed : standings) {
			TeamStanding row = placed.row();
			Totals totals = row.totals();

			long frozen = db.sql("insert into season_team (season, position, team_id, name, points, members,"
							+ " races, kilometers, ascent, descent, seconds)"
							+ " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) returning id")
					.params(season, placed.position(), row.team().id(), row.team().name(), totals.points(),
							row.members(), totals.races(), totals.kilometers(), totals.ascent(), totals.descent(),
							totals.seconds())
					.query(Long.class)
					.single();

			List<Placed<Standing>> page = SeasonTables.teamPage(
					members.stream().filter(member -> row.team().roster().contains(member.id())).toList(), runs);

			/* The ring of the team's page, counted over the runs the row above adds up (PDL, owner, 06.11.2026,
			   „posao zamrzavanja u 16:00 upisuje i broj trka tima po vrsti"). */
			SeasonTables.racesByLength(row.team().roster(), runs).forEach((length, races) -> db
					.sql("insert into season_team_length (season_team_id, length, races) values (?, ?, ?)")
					.params(frozen, length, races)
					.update());

			pages.put(row.team().id(), page);

			for (Placed<Standing> one : page) {
				Totals his = one.row().totals();

				db.sql("insert into season_team_member (season_team_id, position, competitor_id, who, gender,"
								+ " points, races, kilometers, ascent, descent, seconds)"
								+ " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
						.params(frozen, one.position(), one.row().member().id(), one.row().member().who(),
								one.row().member().gender(), his.points(), his.races(), his.kilometers(),
								his.ascent(), his.descent(), his.seconds())
						.update();
			}
		}

		return new TheTeams(standings, pages);
	}

	private void writeTheBoards(int season, List<Member> members, List<Run> runs) {
		for (String length : SeasonTables.LENGTHS) {
			for (Placed<Tally> placed : SeasonTables.byLength(members, runs, length)) {
				board(season, "byLength", length, placed.position(), placed.row().member(), placed.row().totals(),
						null, null, null);
			}
		}

		for (Placed<Tally> placed : SeasonTables.kilometers(members, runs)) {
			board(season, "kilometers", null, placed.position(), placed.row().member(), placed.row().totals(), null,
					null, null);
		}

		for (Placed<Tally> placed : SeasonTables.timeOnCourse(members, runs)) {
			board(season, "timeOnCourse", null, placed.position(), placed.row().member(), placed.row().totals(),
					null, null, null);
		}

		/* The season before, at ITS freeze where it is frozen, which it is by now in every year but the
		   league's first (`BestOfficialSeason.totals`). */
		Map<Long, BigDecimal> before = new HashMap<>();

		bestOfficialSeason.totals(null).forEach((member, seasons) -> {
			BigDecimal held = seasons.get(season - 1);

			if (held != null) {
				before.put(member, held);
			}
		});

		for (Placed<Progress> placed : SeasonTables.progress(members, runs, before)) {
			board(season, "progress", null, placed.position(), placed.row().member(), placed.row().totals(),
					placed.row().previous(), null, null);
		}

		for (Placed<BestRace> placed : SeasonTables.bestRaces(members, runs)) {
			Run run = placed.row().run();

			board(season, "bestRace", null, placed.position(), placed.row().member(), Totals.of(List.of(run)), null,
					run.race(), run.raceName());
		}
	}

	private void board(int season, String board, String length, int position, Member member, Totals totals,
			BigDecimal previous, Long race, String raceName) {
		db.sql("insert into season_board (season, board, length, position, competitor_id, who, gender, points,"
						+ " races, kilometers, ascent, descent, seconds, previous_points, race_id, race_name)"
						+ " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
				.params(season, board, length, position, member.id(), member.who(), member.gender(), totals.points(),
						totals.races(), totals.kilometers(), totals.ascent(), totals.descent(), totals.seconds(),
						previous, race, raceName)
				.update();
	}

	private List<Placed<PairStanding>> writeThePairs(int season, List<Member> members, List<Run> runs) {
		List<Pair> pairs = db.sql("select id, man_id, woman_id from racing_pair where season = ? order by id")
				.param(season)
				.query((row, one) -> new Pair(row.getLong(1), row.getLong(2), row.getLong(3)))
				.list();

		List<Placed<PairStanding>> placed = SeasonTables.pairs(pairs, members, runs);

		for (Placed<PairStanding> one : placed) {
			Totals totals = one.row().totals();

			long frozen = db.sql("insert into season_pair (season, position, pair_id, points, races, kilometers,"
							+ " ascent, descent, seconds) values (?, ?, ?, ?, ?, ?, ?, ?, ?) returning id")
					.params(season, one.position(), one.row().pair().id(), totals.points(), totals.races(),
							totals.kilometers(), totals.ascent(), totals.descent(), totals.seconds())
					.query(Long.class)
					.single();

			int half = 1;

			for (Member member : List.of(one.row().first(), one.row().second())) {
				db.sql("insert into season_pair_half (season_pair_id, half, competitor_id, who, gender)"
								+ " values (?, ?, ?, ?, ?)")
						.params(frozen, half++, member.id(), member.who(), member.gender())
						.update();
			}
		}

		return placed;
	}

	private void writeTheLeagues(int season, List<Member> members, List<Run> runs) {
		Map<Long, Set<Long>> counted = new HashMap<>();

		db.sql("select league_id, race_id from league_race where season = ?")
				.param(season)
				.query(row -> {
					counted.computeIfAbsent(row.getLong(1), any -> new HashSet<>()).add(row.getLong(2));
				});

		Map<Long, Long> eventOfRace = new HashMap<>();
		Map<Long, Event> events = new HashMap<>();

		db.sql("select ra.id, e.id, e.date, e.name from race ra join btl_event e on e.id = ra.event_id"
						+ " where ra.season = ?")
				.param(season)
				.query(row -> {
					eventOfRace.put(row.getLong(1), row.getLong(2));
					events.put(row.getLong(2), new Event(row.getLong(2), row.getDate(3).toLocalDate(), row.getString(4)));
				});

		List<League> leagues = db.sql("select id, name from league where season = ? order by id")
				.param(season)
				.query((row, one) -> new League(row.getLong(1), row.getString(2),
						counted.getOrDefault(row.getLong(1), Set.of())))
				.list();

		for (League league : leagues) {
			LeagueTable table = SeasonTables.league(league, eventOfRace, events, members, runs);
			Map<Long, Long> columns = new HashMap<>();
			int position = 1;

			for (Event event : table.columns()) {
				columns.put(event.id(), db.sql("insert into season_league_column (season, league_id, position,"
								+ " event_id, date, name) values (?, ?, ?, ?, ?, ?) returning id")
						.params(season, league.id(), position++, event.id(), event.date(), event.name())
						.query(Long.class)
						.single());
			}

			for (List<Placed<LeagueRow>> gender : table.byGender().values()) {
				for (Placed<LeagueRow> placed : gender) {
					Member member = placed.row().member();

					long frozen = db.sql("insert into season_league_standing (season, league_id, league_name,"
									+ " position, competitor_id, who, gender, points)"
									+ " values (?, ?, ?, ?, ?, ?, ?, ?) returning id")
							.params(season, league.id(), league.name(), placed.position(), member.id(), member.who(),
									member.gender(), placed.row().total())
							.query(Long.class)
							.single();

					placed.row().cells().forEach((event, points) -> db.sql("insert into season_league_cell"
									+ " (season_league_standing_id, season_league_column_id, points) values (?, ?, ?)")
							.params(frozen, columns.get(event), points)
							.update());
				}
			}
		}
	}

	/**
	 * PDL, owner, 05.11.2026: „Lični pehari (prva tri generalno i prva tri u kategoriji), plus timski pehar
	 * svakom članu koji je tom timu nosio bodove te sezone, i pehar para obema polovinama." A team or a
	 * pair that ran nothing gives nothing: first place among teams that are all at nought is the lowest
	 * id, not a trophy.
	 */
	private void writeTheAwards(int season, List<Member> members, List<Run> runs,
			TheTeams teams, List<Placed<PairStanding>> pairs) {
		for (String gender : List.of("M", "F")) {
			for (Placed<Standing> placed : SeasonTables.standing(members, runs, gender, null)) {
				if (placed.position() <= SeasonTables.REWARDED) {
					award(season, "overall", null, placed.position(), placed.row().member(),
							placed.row().totals().points(), null);
				}
			}

			Set<String> codes = new LinkedHashSet<>();

			members.stream().filter(member -> member.gender().equals(gender)).forEach(member -> codes.add(member.category()));

			for (String code : codes) {
				for (Placed<Standing> placed : SeasonTables.standing(members, runs, gender, code)) {
					if (placed.position() <= SeasonTables.REWARDED) {
						award(season, "category", code, placed.position(), placed.row().member(),
								placed.row().totals().points(), null);
					}
				}
			}
		}

		/* A team that ran nothing gives nothing, and that needs no condition of its own here: nobody on
		   its page ran, so the line below names nobody (mutation A2, 05.11.2026, proved the two equal). */
		if (!teams.standings().isEmpty()) {
			TeamStanding winner = teams.standings().getFirst().row();

			for (Placed<Standing> one : teams.pages().get(winner.team().id())) {
				if (one.row().totals().races() > 0) {
					award(season, "team", null, 1, one.row().member(), winner.totals().points(), winner.team().name());
				}
			}
		}

		if (!pairs.isEmpty()) {
			PairStanding winner = pairs.getFirst().row();

			for (Member member : List.of(winner.first(), winner.second())) {
				award(season, "pair", null, 1, member, winner.totals().points(), null);
			}
		}
	}

	private void award(int season, String kind, String category, int position, Member member, BigDecimal points,
			String teamName) {
		db.sql("insert into season_award (season, kind, category, position, competitor_id, who, gender, points,"
						+ " team_name) values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
				.params(season, kind, category, position, member.id(), member.who(), member.gender(), points, teamName)
				.update();
	}
}
