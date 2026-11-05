package com.btl.portal.web;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * THE FROZEN SEASONS, AND EVERY TABLE OF ONE OF THEM, READ AND NOT WORKED OUT.
 *
 * <p>PDL, owner, 31.07.2026, „Zamrznuta sezona je materijalizovan zapis, ne izračun": what
 * {@link TheTablesOfASeason} wrote at the freeze (V84) is answered here row for row. Nothing is summed,
 * placed or ordered by anything but the place written down (ADL A37, „Strana zamrznute sezone ne računa
 * ništa"); the only joins are to what a LINK needs, the member's number, a team's, a league's and an
 * event's slug, because the link is decided when the table is read and not when it froze (ADL A37,
 * „Snimak nosi i ime i vezu, a šta se od toga crta odlučuje se pri čitanju").
 *
 * <p><b>TWO ADDRESSES, AND WHY THE SECOND IS NOT UNDER THE FIRST.</b> {@code /api/frozen-seasons} says
 * which seasons are frozen, so a screen asks for a season's snapshot only where there is one and reads
 * the live answers everywhere else (the record decides, never the clock: PDL, derived 10.10.2026, „za
 * čitanje zamrznutosti odlučuje zapis o činu, ne sat"). The tables of one season are
 * {@code /api/frozen-tables/{season}}: an address opened by name, which {@link ApiSecurity} keeps in a
 * list of its own, and the address beside an open one ({@code /api/frozen-seasons/2027}) must stay shut
 * (`ApiSecurityTest.noOpenRouteOpensAnythingBesideIt`).
 *
 * <p><b>PUBLIC, AND THE SAME TO EVERY READER.</b> The tables of a season are what Član 73 makes public,
 * and the frozen one „nosi sve što je tog dana bilo javno" (PDL, 06.09.2026). The category of that season
 * is in it, publicly (PDL, „Oblik zamrzavanja", point 6). Nothing here asks who is reading.
 *
 * <p><b>WHAT A ROW SAYS ABOUT ITS MEMBER</b>, in the states the journal names, and the reader draws them:
 * <ul>
 * <li>he is still a member of the portal: {@code memberNumber} and {@code who}. Whether his name is a
 * link is the reader's question (ADL A37): a member whose fee lapsed or who hides his profile is named as
 * text (PDL, 06.09.2026, „ime skrivenog člana i u njoj stoji kao tekst, ne kao veza. Isti je efekat i ako
 * nije obnovio članarinu"), and that he is in an old table at all is no leak (PDL, 13.09.2026: „to što se
 * iz njegovog prisustva u staroj tabeli vidi da danas nije član nije curenje nego posledica ove iste
 * odluke");</li>
 * <li>he asked to be deleted: no number and no name, and the gender, from which the reader writes
 * {@code <Obrisani član>} or {@code <Obrisana članica>} (ADL A37);</li>
 * <li>he was deleted after five years: no number and his name, as text without a link (PDL, owner,
 * 05.11.2026, „ime i prezime ostaju kao tekst bez veze samo u zamrznutim tabelama sezona"). The job of
 * five years empties the pointer and keeps the name, so the number goes with the pointer;</li>
 * <li>his season was put out after it froze: „Neaktivan član / Neaktivna članica" with his real number
 * (PDL, 03.10.2026). THAT STATE HAS NO SOURCE YET: putting a season out is a job not written (SZ), so
 * nothing here can tell it, and the row is answered as the first state. It is a boundary, named so the
 * job that writes it knows this answer is where it lands.</li>
 * </ul>
 *
 * <p><b>A LEAGUE THAT WAS DELETED IS NOT ANSWERED.</b> Its rows stay in the snapshot (V17: „The league
 * itself may be deleted and the standing stays"), but the owner, asked about exactly that, answered „gde se
 * to POMINJE LIGA KOJE NEMA? Ni na sta ne utice, zar ne?" (PDL, 22.09.2026): a league that is gone is
 * mentioned nowhere. A TEAM that was deleted is answered, as a name without a link (PDL, derived
 * 10.10.2026, „tim obrisan posle 16:00 ostaje u tabeli kao ime bez veze"); so is an event, as a heading.
 */
@RestController
class FrozenSeasonApi {

	private final JdbcClient db;

	FrozenSeasonApi(JdbcClient db) {
		this.db = db;
	}

	/** A season the freeze has written down. */
	record FrozenSeason(int season) {
	}

	/**
	 * One member's place in the general standing, with his place inside his category.
	 *
	 * @param memberNumber null where he is no longer a member of the portal
	 * @param who          null where he asked to be deleted
	 * @param category     the code of his category in that season, as the table names it
	 */
	record Standing(int position, int categoryPosition, String memberNumber, String who, String gender,
			String category, BigDecimal points, int races, BigDecimal kilometers, int ascent, int descent,
			int seconds) {
	}

	record TeamMember(int position, String memberNumber, String who, String gender, BigDecimal points,
			int races, BigDecimal kilometers, int ascent, int descent, int seconds) {
	}

	/** @param slug null where the team has since been deleted */
	record Team(int position, String slug, String name, BigDecimal points, int members, int races,
			BigDecimal kilometers, int ascent, int descent, int seconds, List<TeamMember> roster) {
	}

	/**
	 * One place on one top list.
	 *
	 * @param length         one of the five lengths on a list by length, null on every other
	 * @param previousPoints the season before, on the list of progress only
	 * @param raceName       the race, on the list of best races only, whose totals are then that race's
	 */
	record Board(String board, String length, int position, String memberNumber, String who, String gender,
			BigDecimal points, int races, BigDecimal kilometers, int ascent, int descent, int seconds,
			BigDecimal previousPoints, String raceName) {
	}

	record Half(String memberNumber, String who, String gender) {
	}

	/** @param halves the larger half first (owner, 04.08.2026) */
	record Pair(int position, BigDecimal points, int races, BigDecimal kilometers, int ascent, int descent,
			int seconds, List<Half> halves) {
	}

	/** @param eventSlug null where the event has since been deleted */
	record Column(String eventSlug, LocalDate date, String name) {
	}

	/** @param column the place of the column among the league's columns, from one */
	record Cell(int column, BigDecimal points) {
	}

	record LeagueRow(String gender, int position, String memberNumber, String who, BigDecimal points,
			List<Cell> cells) {
	}

	record League(String slug, String name, List<Column> columns, List<LeagueRow> standings) {
	}

	/**
	 * @param category  on an award of a category only
	 * @param teamName  on a team's award only, as the team was named when it won
	 */
	record Award(String kind, String category, int position, String memberNumber, String who, String gender,
			BigDecimal points, String teamName) {
	}

	record Tables(int season, List<Standing> standings, List<Team> teams, List<Board> boards, List<Pair> pairs,
			List<League> leagues, List<Award> awards) {
	}

	@GetMapping("/api/frozen-seasons")
	List<FrozenSeason> frozenSeasons() {
		return db.sql("select season from season_frozen order by season")
				.query((row, one) -> new FrozenSeason(row.getInt(1)))
				.list();
	}

	/**
	 * Every table of {@code season}, or the answer an address that maps nothing is given where it has not
	 * been frozen: a season not frozen has no snapshot to read, and its tables are the live answers.
	 */
	@GetMapping("/api/frozen-tables/{season}")
	Tables tables(@PathVariable String season, HttpServletResponse response) throws IOException {
		/* THE TEXT, READ HERE, and neither an `int` nor an `AKey` parameter. An `int` answers a word with a
		   400 before this runs (`RightsAtTheDoorTest`). An `AKey` parameter puts the route under
		   `AWordInAKeyOverRealHttpTest`, whose every route is one a visitor is told to sign in at: this one
		   is open, so a visitor is told 404 where the address beside it tells him 401, and that tells him
		   nothing he may not know (`ApiSecurity` opens it by name). Read as the key the text spells, so a
		   word and a number no season can be are both a row that is not there, the 404 a season not frozen
		   gets: the shape `PhotoApi` has for its name. */
		List<Integer> frozen = db.sql("select season from season_frozen where season = ?")
				.param(AKey.read(season).value()).query(Integer.class).list();

		if (frozen.isEmpty()) {
			response.sendError(HttpStatus.NOT_FOUND.value());
			return null;
		}

		int one = frozen.getFirst();

		return new Tables(one, standings(one), teams(one), boards(one), pairs(one), leagues(one), awards(one));
	}

	private List<Standing> standings(int season) {
		return db.sql("select s.position, s.category_position, c.member_number, s.who, s.gender, s.category,"
						+ " s.points, s.races, s.kilometers, s.ascent, s.descent, s.seconds"
						+ " from season_competitor s left join competitor c on c.id = s.competitor_id"
						+ " where s.season = ? order by s.gender desc, s.position")
				.param(season)
				.query((row, one) -> new Standing(row.getInt(1), row.getInt(2), row.getString(3), row.getString(4),
						row.getString(5), row.getString(6), row.getBigDecimal(7), row.getInt(8), row.getBigDecimal(9),
						row.getInt(10), row.getInt(11), row.getInt(12)))
				.list();
	}

	private List<Team> teams(int season) {
		Map<Long, List<TeamMember>> rosters = new LinkedHashMap<>();

		db.sql("select m.season_team_id, m.position, c.member_number, m.who, m.gender, m.points, m.races,"
						+ " m.kilometers, m.ascent, m.descent, m.seconds"
						+ " from season_team_member m join season_team t on t.id = m.season_team_id"
						+ " left join competitor c on c.id = m.competitor_id"
						+ " where t.season = ? order by m.season_team_id, m.position")
				.param(season)
				.query(row -> {
					rosters.computeIfAbsent(row.getLong(1), any -> new ArrayList<>()).add(new TeamMember(
							row.getInt(2), row.getString(3), row.getString(4), row.getString(5), row.getBigDecimal(6),
							row.getInt(7), row.getBigDecimal(8), row.getInt(9), row.getInt(10), row.getInt(11)));
				});

		return db.sql("select t.id, t.position, team.slug, t.name, t.points, t.members, t.races, t.kilometers,"
						+ " t.ascent, t.descent, t.seconds"
						+ " from season_team t left join team on team.id = t.team_id"
						+ " where t.season = ? order by t.position")
				.param(season)
				.query((row, one) -> new Team(row.getInt(2), row.getString(3), row.getString(4), row.getBigDecimal(5),
						row.getInt(6), row.getInt(7), row.getBigDecimal(8), row.getInt(9), row.getInt(10),
						row.getInt(11), rosters.getOrDefault(row.getLong(1), List.of())))
				.list();
	}

	private List<Board> boards(int season) {
		return db.sql("select b.board, b.length, b.position, c.member_number, b.who, b.gender, b.points, b.races,"
						+ " b.kilometers, b.ascent, b.descent, b.seconds, b.previous_points, b.race_name"
						+ " from season_board b left join competitor c on c.id = b.competitor_id"
						+ " where b.season = ? order by b.board, b.length nulls first, b.position")
				.param(season)
				.query((row, one) -> new Board(row.getString(1), row.getString(2), row.getInt(3), row.getString(4),
						row.getString(5), row.getString(6), row.getBigDecimal(7), row.getInt(8), row.getBigDecimal(9),
						row.getInt(10), row.getInt(11), row.getInt(12), row.getBigDecimal(13), row.getString(14)))
				.list();
	}

	private List<Pair> pairs(int season) {
		Map<Long, List<Half>> halves = new LinkedHashMap<>();

		db.sql("select h.season_pair_id, c.member_number, h.who, h.gender"
						+ " from season_pair_half h join season_pair p on p.id = h.season_pair_id"
						+ " left join competitor c on c.id = h.competitor_id"
						+ " where p.season = ? order by h.season_pair_id, h.half")
				.param(season)
				.query(row -> {
					halves.computeIfAbsent(row.getLong(1), any -> new ArrayList<>())
							.add(new Half(row.getString(2), row.getString(3), row.getString(4)));
				});

		return db.sql("select id, position, points, races, kilometers, ascent, descent, seconds"
						+ " from season_pair where season = ? order by position")
				.param(season)
				.query((row, one) -> new Pair(row.getInt(2), row.getBigDecimal(3), row.getInt(4), row.getBigDecimal(5),
						row.getInt(6), row.getInt(7), row.getInt(8), halves.get(row.getLong(1))))
				.list();
	}

	private List<League> leagues(int season) {
		Map<Long, Map<Long, Integer>> places = new LinkedHashMap<>();
		Map<Long, List<Column>> columns = new LinkedHashMap<>();

		db.sql("select k.league_id, k.id, k.position, e.slug, k.date, k.name"
						+ " from season_league_column k left join btl_event e on e.id = k.event_id"
						+ " where k.season = ? and k.league_id is not null order by k.league_id, k.position")
				.param(season)
				.query(row -> {
					places.computeIfAbsent(row.getLong(1), any -> new LinkedHashMap<>()).put(row.getLong(2), row.getInt(3));
					columns.computeIfAbsent(row.getLong(1), any -> new ArrayList<>()).add(new Column(row.getString(4),
							row.getDate(5).toLocalDate(), row.getString(6)));
				});

		Map<Long, List<Cell>> cells = new LinkedHashMap<>();

		db.sql("select c.season_league_standing_id, k.position, c.points from season_league_cell c"
						+ " join season_league_column k on k.id = c.season_league_column_id"
						+ " where k.season = ? order by c.season_league_standing_id, k.position")
				.param(season)
				.query(row -> {
					cells.computeIfAbsent(row.getLong(1), any -> new ArrayList<>())
							.add(new Cell(row.getInt(2), row.getBigDecimal(3)));
				});

		Map<Long, List<LeagueRow>> rows = new LinkedHashMap<>();

		db.sql("select s.league_id, s.id, s.gender, s.position, c.member_number, s.who, s.points"
						+ " from season_league_standing s left join competitor c on c.id = s.competitor_id"
						+ " where s.season = ? and s.league_id is not null order by s.league_id, s.gender desc, s.position")
				.param(season)
				.query(row -> {
					rows.computeIfAbsent(row.getLong(1), any -> new ArrayList<>()).add(new LeagueRow(row.getString(3),
							row.getInt(4), row.getString(5), row.getString(6), row.getBigDecimal(7),
							cells.getOrDefault(row.getLong(2), List.of())));
				});

		return db.sql("select id, slug, name from league where id in (select league_id from season_league_column"
						+ " where season = ? union select league_id from season_league_standing where season = ?)"
						+ " order by name, id")
				.params(season, season)
				.query((row, one) -> new League(row.getString(2), row.getString(3),
						columns.getOrDefault(row.getLong(1), List.of()), rows.getOrDefault(row.getLong(1), List.of())))
				.list();
	}

	private List<Award> awards(int season) {
		return db.sql("select a.kind, a.category, a.position, c.member_number, a.who, a.gender, a.points, a.team_name"
						+ " from season_award a left join competitor c on c.id = a.competitor_id"
						+ " where a.season = ? order by a.kind, a.category nulls first, a.gender desc, a.position, a.id")
				.param(season)
				.query((row, one) -> new Award(row.getString(1), row.getString(2), row.getInt(3), row.getString(4),
						row.getString(5), row.getString(6), row.getBigDecimal(7), row.getString(8)))
				.list();
	}
}
