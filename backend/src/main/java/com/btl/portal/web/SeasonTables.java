package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import java.math.BigDecimal;
import java.text.Collator;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;

/**
 * EVERY TABLE OF ONE SEASON, WORKED OUT FROM ITS RUNS, AS THE PORTAL DRAWS IT: the ladders of
 * {@code frontend/src/data/derive.ts} and {@code frontend/src/pages/league/leagueTable.ts}, written a
 * second time so the freeze can write them down (PDL, 31.07.2026, „Zamrznuta sezona je materijalizovan
 * zapis, ne izračun").
 *
 * <p><b>THIS IS A SECOND HOME FOR THE LADDERS, AND IT IS HELD TO THE FIRST BY ONE FILE.</b> The screens
 * order a running season with the functions in {@code derive.ts}; the freeze orders the season that
 * ended with these. {@code frontend/src/data/tablesBothSidesWrite.json} holds one season of runs and the
 * order every table comes out in: {@code SeasonTablesTest} requires these functions to give exactly
 * that, and {@code tablesMatchTheServer.test.ts} requires the screen's to. Edited to suit one side, the
 * file fails on the other (the shape {@code ipsSlipBothSidesWrite.json} has for the payment slip).
 *
 * <p><b>WHAT THE FILE CANNOT HOLD, named rather than discovered.</b>
 * <ul>
 * <li>The screen adds points as floating point numbers and this adds them as decimals. Two members
 * whose sums are the same decimal can differ in the last bit on the screen, and then the screen breaks
 * the tie on the points where this goes on to the kilometres. The file holds no such pair, because no
 * single answer would be right for both; the frozen table is the exact one.</li>
 * <li>Two events of one day in a league are ordered by name in the reader's language on the screen and
 * in Serbian here. The file holds no such pair.</li>
 * <li>Who a table is drawn from is not in the file: the screen reads the members it is served, this
 * reads the members who hold the season with the right to rank ({@link ASeasonFreezes} says why). The
 * file hands both sides the same members.</li>
 * <li>That every rung of every ladder decides a place is not measured by a floor, because the rungs are
 * private to {@code derive.ts} and to this class and a floor would have to be a list of them. It is
 * held by the file's pairs and by one mutation for each rung (take the rung out of one side: the
 * file fails on that side), and a rung added to a ladder arrives without a pair until somebody writes
 * it.</li>
 * </ul>
 *
 * <p>Pure: nothing here reads the database or the clock, so every table is measured on one fixture.
 */
final class SeasonTables {

	/** The five lengths of PDL P5, in the order the database's own expression names them. */
	static final List<String> LENGTHS = List.of("short", "half", "long", "marathon", "ultra");

	/** How many places a standing of people rewards (PDL P16). */
	static final int REWARDED = 3;

	private SeasonTables() {
	}

	/**
	 * The code of a category as the tables of a season name it, {@code categoryCodeFor} on the screen:
	 * the gender's mark and the band, or the mark and „R" for the beginners (PDL P7).
	 */
	static String categoryCode(String gender, String ageBand, boolean beginner) {
		String mark = Category.genderMark(gender);

		return beginner ? mark + " " + Category.FIRST_SEASON_BAND : mark + ageBand;
	}

	/**
	 * A member who holds the season with the right to rank, with the category of THAT season.
	 *
	 * @param who      his name as the table writes it
	 * @param gender   {@code M} or {@code F}
	 * @param category the code of his category in this season ({@code M40-54}, {@code Ž R})
	 */
	record Member(long id, String number, String who, String gender, String category) {
	}

	/** One result the standings of the season count. */
	record Run(long id, long member, long race, long event, LocalDate date, BigDecimal kilometers,
			int ascent, int descent, int seconds, BigDecimal points, String length, String raceName) {
	}

	/** What a standing adds up. */
	record Totals(int races, BigDecimal kilometers, int ascent, int descent, int seconds, BigDecimal points) {

		static final Totals NONE = new Totals(0, BigDecimal.ZERO, 0, 0, 0, BigDecimal.ZERO);

		Totals plus(Run run) {
			return new Totals(races + 1, kilometers.add(run.kilometers()), ascent + run.ascent(),
					descent + run.descent(), seconds + run.seconds(), points.add(run.points()));
		}

		Totals withRaces(int countedRaces) {
			return new Totals(countedRaces, kilometers, ascent, descent, seconds, points);
		}

		int vertical() {
			return ascent + descent;
		}

		static Totals of(List<Run> runs) {
			Totals totals = NONE;

			for (Run run : runs) {
				totals = totals.plus(run);
			}

			return totals;
		}
	}

	/** A row with its place: one more than the number of rows before it, and never shared. */
	record Placed<T>(int position, T row) {
	}

	record Standing(Member member, Totals totals) {
	}

	/** A row of a list that breaks a tie on the day the member reached what he holds. */
	record Tally(Member member, Totals totals, LocalDate reachedOn) {
	}

	record Progress(Member member, Totals totals, BigDecimal previous) {

		BigDecimal gain() {
			return totals.points().subtract(previous);
		}
	}

	record BestRace(Member member, Run run, Totals season) {
	}

	/**
	 * A team and everybody in it that season, with or without the right to rank.
	 *
	 * @param roster the {@code competitor.id} of every member of the team in the season
	 */
	record Team(long id, String name, Set<Long> roster) {
	}

	record TeamStanding(Team team, int members, Totals totals) {
	}

	/** A pair as it is written: the man and the woman, which is the order {@code /api/pairs} answers. */
	record Pair(long id, long man, long woman) {
	}

	/** A pair on the board, the larger half first (owner, 04.08.2026). */
	record PairStanding(Pair pair, Member first, Member second, Totals totals) {
	}

	record League(long id, String name, Set<Long> races) {
	}

	record Event(long id, LocalDate date, String name) {
	}

	/** One member's row of a league: what he took in each column, and the sum of it. */
	record LeagueRow(Member member, Map<Long, BigDecimal> cells, BigDecimal total) {
	}

	/** The grid: its columns in order, and its rows of one gender in order. */
	record LeagueTable(List<Event> columns, Map<String, List<Placed<LeagueRow>>> byGender) {
	}

	/** A higher number first, and the next rung only where two are level. */
	private static <T> Comparator<T> larger(Function<T, ? extends Comparable<?>> measure) {
		@SuppressWarnings({"unchecked", "rawtypes"})
		Comparator<T> comparator = (left, right) -> ((Comparable) measure.apply(right)).compareTo(measure.apply(left));
		return comparator;
	}

	/**
	 * {@code withPlaces}: the ladder, then the key, then the order the rows came in. The last is what
	 * the screen's sort does too, because it is stable, and it decides only between two places of one
	 * member on the list of best races.
	 */
	private static <T> List<Placed<T>> placed(List<T> rows, Comparator<T> ladder, Function<T, String> key) {
		List<T> sorted = new ArrayList<>(rows);

		sorted.sort(ladder.thenComparing(key));

		List<Placed<T>> placed = new ArrayList<>(sorted.size());

		for (int index = 0; index < sorted.size(); index++) {
			placed.add(new Placed<>(index + 1, sorted.get(index)));
		}

		return placed;
	}

	/** The ladder of the general standing (PDL P12): points, kilometres, more races, the vertical. */
	private static final Comparator<Standing> STANDING = SeasonTables.<Standing>larger(row -> row.totals().points())
			.thenComparing(larger(row -> row.totals().kilometers()))
			.thenComparing(larger(row -> row.totals().races()))
			.thenComparing(larger(row -> row.totals().vertical()));

	private static Map<Long, List<Run>> byMember(List<Run> runs) {
		Map<Long, List<Run>> byMember = new LinkedHashMap<>();

		for (Run run : runs) {
			byMember.computeIfAbsent(run.member(), any -> new ArrayList<>()).add(run);
		}

		return byMember;
	}

	/**
	 * {@code rankingFor}: the members of one gender, of one category where one is named, who ran in the
	 * season, by the ladder of the standing. A frozen table places nobody who did not race
	 * ({@code Rankings.tsx}: „A frozen one stays as it was: a member with no race is not placed in a
	 * season that has been run").
	 */
	static List<Placed<Standing>> standing(List<Member> members, List<Run> runs, String gender, String category) {
		Map<Long, List<Run>> byMember = byMember(runs);

		List<Standing> rows = members.stream()
				.filter(member -> member.gender().equals(gender))
				.filter(member -> category == null || category.equals(member.category()))
				.map(member -> new Standing(member, Totals.of(byMember.getOrDefault(member.id(), List.of()))))
				.filter(row -> row.totals().races() > 0)
				.toList();

		return placed(rows, STANDING, row -> row.member().number());
	}

	/**
	 * {@code rankMembers}: the members on a team's page, every one of them, by the ladder of the
	 * standing, those who ran nothing last.
	 */
	static List<Placed<Standing>> teamPage(List<Member> members, List<Run> runs) {
		Map<Long, List<Run>> byMember = byMember(runs);

		List<Standing> rows = members.stream()
				.map(member -> new Standing(member, Totals.of(byMember.getOrDefault(member.id(), List.of()))))
				.toList();

		return placed(rows, STANDING, row -> row.member().number());
	}

	/**
	 * {@code rankTeams}: points, more races, kilometres, the time on the course (owner, 11.08.2026), and
	 * then the team's id written as text, which is the screen's key. Every member of the roster is
	 * counted; only the runs the standings count are added (owner, 11.08.2026, „Bodovi člana bez prava
	 * rangiranja ne ulaze u zbir tima ni para").
	 */
	static List<Placed<TeamStanding>> teams(List<Team> teams, List<Run> runs) {
		Map<Long, List<Run>> byMember = byMember(runs);

		List<TeamStanding> rows = teams.stream()
				.map(team -> new TeamStanding(team, team.roster().size(), Totals.of(team.roster().stream()
						.flatMap(member -> byMember.getOrDefault(member, List.of()).stream())
						.toList())))
				.toList();

		Comparator<TeamStanding> ladder = SeasonTables.<TeamStanding>larger(row -> row.totals().points())
				.thenComparing(larger(row -> row.totals().races()))
				.thenComparing(larger(row -> row.totals().kilometers()))
				.thenComparing(larger(row -> row.totals().seconds()));

		return placed(rows, ladder, row -> String.valueOf(row.team().id()));
	}

	/** {@code tallyOf}: the totals of each member, and the day of the last run that made them. */
	private static List<Tally> tally(List<Member> members, List<Run> runs) {
		Map<Long, Tally> tally = new HashMap<>();
		Map<Long, Member> known = new HashMap<>();

		members.forEach(member -> known.put(member.id(), member));

		runs.stream().sorted(Comparator.comparing(Run::date)).forEach(run -> {
			Tally before = tally.get(run.member());

			tally.put(run.member(), new Tally(known.get(run.member()),
					(before == null ? Totals.NONE : before.totals()).plus(run), run.date()));
		});

		return members.stream().filter(member -> tally.containsKey(member.id())).map(member -> tally.get(member.id()))
				.toList();
	}

	/** {@code topByCategory}: the races of one length, the points, the kilometres, the vertical, the earlier day. */
	static List<Placed<Tally>> byLength(List<Member> members, List<Run> runs, String length) {
		Comparator<Tally> ladder = SeasonTables.<Tally>larger(row -> row.totals().races())
				.thenComparing(larger(row -> row.totals().points()))
				.thenComparing(larger(row -> row.totals().kilometers()))
				.thenComparing(larger(row -> row.totals().vertical()))
				.thenComparing(Tally::reachedOn);

		return placed(tally(members, runs.stream().filter(run -> run.length().equals(length)).toList()), ladder,
				row -> row.member().number());
	}

	/** {@code topByKilometers}: the kilometres, the points, the races, the vertical, the earlier day. */
	static List<Placed<Tally>> kilometers(List<Member> members, List<Run> runs) {
		Comparator<Tally> ladder = SeasonTables.<Tally>larger(row -> row.totals().kilometers())
				.thenComparing(larger(row -> row.totals().points()))
				.thenComparing(larger(row -> row.totals().races()))
				.thenComparing(larger(row -> row.totals().vertical()))
				.thenComparing(Tally::reachedOn);

		return placed(tally(members, runs), ladder, row -> row.member().number());
	}

	/** {@code topByTimeOnCourse}: the time, the points, the kilometres, the races, the vertical. */
	static List<Placed<Tally>> timeOnCourse(List<Member> members, List<Run> runs) {
		Comparator<Tally> ladder = SeasonTables.<Tally>larger(row -> row.totals().seconds())
				.thenComparing(larger(row -> row.totals().points()))
				.thenComparing(larger(row -> row.totals().kilometers()))
				.thenComparing(larger(row -> row.totals().races()))
				.thenComparing(larger(row -> row.totals().vertical()));

		return placed(tally(members, runs), ladder, row -> row.member().number());
	}

	/**
	 * {@code topByProgress}: the gain over the season before, then the points, then the races; only a
	 * member who has a season before and bettered it.
	 *
	 * @param before per {@code competitor.id}, what he held in the season before. At the freeze that
	 *               season is frozen itself, so it is what IT held at its freeze (PDL, derived 10.10.2026,
	 *               „„najbolji napredak" ... uzimaju broj iz snimka"), whether or not he held it with the
	 *               right to rank (owner, 30.10.2026)
	 */
	static List<Placed<Progress>> progress(List<Member> members, List<Run> runs, Map<Long, BigDecimal> before) {
		Map<Long, List<Run>> byMember = byMember(runs);

		List<Progress> rows = members.stream()
				.filter(member -> byMember.containsKey(member.id()) && before.containsKey(member.id()))
				.map(member -> new Progress(member, Totals.of(byMember.get(member.id())), before.get(member.id())))
				.filter(row -> row.gain().signum() > 0)
				.toList();

		Comparator<Progress> ladder = SeasonTables.<Progress>larger(Progress::gain)
				.thenComparing(larger(row -> row.totals().points()))
				.thenComparing(larger(row -> row.totals().races()));

		return placed(rows, ladder, row -> row.member().number());
	}

	/**
	 * {@code bestSingleRaces}: the points of the one race, the longer race, the member's points in the
	 * season, his kilometres in it (owner, 22.08.2026). The runs come in the order the screen is served
	 * them (by day and id), which decides between two races of one member that are level on all four.
	 * Every run is of one of {@code members}, which is what {@link TheTablesOfASeason} hands in.
	 */
	static List<Placed<BestRace>> bestRaces(List<Member> members, List<Run> runs) {
		Map<Long, Member> known = new HashMap<>();

		members.forEach(member -> known.put(member.id(), member));

		Map<Long, List<Run>> byMember = byMember(runs);

		List<BestRace> rows = runs.stream()
				.sorted(Comparator.comparing(Run::date).thenComparing(Run::id))
				.map(run -> new BestRace(known.get(run.member()), run, Totals.of(byMember.get(run.member()))))
				.toList();

		Comparator<BestRace> ladder = SeasonTables.<BestRace>larger(row -> row.run().points())
				.thenComparing(larger(row -> row.run().kilometers()))
				.thenComparing(larger(row -> row.season().points()))
				.thenComparing(larger(row -> row.season().kilometers()));

		return placed(rows, ladder, row -> row.member().number());
	}

	/**
	 * {@code topPairs}: the races the two of them ran together, their points on those, the races, the
	 * kilometres, the time, and then the lower sum of their two member numbers; a pair that ran nothing
	 * together is not on the board.
	 */
	static List<Placed<PairStanding>> pairs(List<Pair> pairs, List<Member> members, List<Run> runs) {
		Map<Long, Member> known = new HashMap<>();

		members.forEach(member -> known.put(member.id(), member));

		Map<Long, List<Run>> byMember = byMember(runs);
		List<PairStanding> rows = new ArrayList<>();

		for (Pair pair : pairs) {
			Member one = known.get(pair.man());
			Member two = known.get(pair.woman());

			if (one == null || two == null) {
				continue;
			}

			List<Run> his = byMember.getOrDefault(one.id(), List.of());
			List<Run> hers = byMember.getOrDefault(two.id(), List.of());
			Set<Long> shared = new LinkedHashSet<>();

			for (Run run : hers) {
				if (his.stream().anyMatch(mine -> mine.race() == run.race())) {
					shared.add(run.race());
				}
			}

			if (shared.isEmpty()) {
				continue;
			}

			List<Run> hersTogether = hers.stream().filter(run -> shared.contains(run.race())).toList();
			List<Run> hisTogether = his.stream().filter(run -> shared.contains(run.race())).toList();
			List<Run> together = new ArrayList<>(hersTogether);

			together.addAll(hisTogether);

			boolean hisIsLarger = Totals.of(hisTogether).points().compareTo(Totals.of(hersTogether).points()) >= 0;

			rows.add(new PairStanding(pair, hisIsLarger ? one : two, hisIsLarger ? two : one,
					Totals.of(together).withRaces(shared.size())));
		}

		Comparator<PairStanding> ladder = SeasonTables.<PairStanding>larger(row -> row.totals().points())
				.thenComparing(larger(row -> row.totals().races()))
				.thenComparing(larger(row -> row.totals().kilometers()))
				.thenComparing(larger(row -> row.totals().seconds()))
				.thenComparing(row -> numberOf(known.get(row.pair().man())) + numberOf(known.get(row.pair().woman())));

		return placed(rows, ladder, row -> known.get(row.pair().man()).number());
	}

	private static long numberOf(Member member) {
		return Long.parseLong(member.number());
	}

	/**
	 * {@code leagueTable} and {@code leagueGroups}: the events of which the league counts a race, by day
	 * and name, and for each gender the members who took points in them, by their total and then their
	 * member number.
	 */
	static LeagueTable league(League league, Map<Long, Long> eventOfRace, Map<Long, Event> events,
			List<Member> members, List<Run> runs) {
		Collator serbian = Collator.getInstance(Locale.forLanguageTag("sr-Latn"));

		/* Every race a league counts is a race of its season (`league_race_race_fk`, V19), so every one of
		   them has its event here. */
		Set<Long> raced = new LinkedHashSet<>();

		league.races().forEach(race -> raced.add(eventOfRace.get(race)));

		List<Event> columns = raced.stream().map(events::get)
				.sorted(Comparator.comparing(Event::date).thenComparing(Event::name, serbian))
				.toList();

		Map<Long, Map<Long, BigDecimal>> cells = new HashMap<>();

		for (Run run : runs) {
			if (league.races().contains(run.race())) {
				cells.computeIfAbsent(run.member(), any -> new TreeMap<>())
						.merge(eventOfRace.get(run.race()), run.points(), BigDecimal::add);
			}
		}

		Map<String, List<Placed<LeagueRow>>> byGender = new TreeMap<>();

		for (String gender : List.of("M", "F")) {
			List<LeagueRow> rows = members.stream()
					.filter(member -> member.gender().equals(gender) && cells.containsKey(member.id()))
					.map(member -> new LeagueRow(member, cells.get(member.id()),
							cells.get(member.id()).values().stream().reduce(BigDecimal.ZERO, BigDecimal::add)))
					.toList();

			List<Placed<LeagueRow>> placed = placed(rows, larger(LeagueRow::total), row -> row.member().number());

			if (!placed.isEmpty()) {
				byGender.put(gender, placed);
			}
		}

		return new LeagueTable(columns, byGender);
	}
}
