package com.btl.portal.web;

import com.btl.portal.web.SeasonTables.Event;
import com.btl.portal.web.SeasonTables.League;
import com.btl.portal.web.SeasonTables.LeagueTable;
import com.btl.portal.web.SeasonTables.Member;
import com.btl.portal.web.SeasonTables.Pair;
import com.btl.portal.web.SeasonTables.Placed;
import com.btl.portal.web.SeasonTables.Run;
import com.btl.portal.web.SeasonTables.Standing;
import com.btl.portal.web.SeasonTables.Team;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE TABLES THE FREEZE WRITES DOWN ARE THE TABLES THE PORTAL DRAWS, AND THE TWO MEET ON ONE FILE.
 *
 * <p>{@code frontend/src/data/tablesBothSidesWrite.json} holds one season of runs and the order every
 * table comes out in; {@code tablesMatchTheServer.test.ts} requires the screen's functions to give it,
 * and this requires {@link SeasonTables} to. Edited to suit one side, the file fails on the other. The
 * server is handed what {@link TheTablesOfASeason} hands it: only the members who hold the season with
 * the right to rank, and only the runs its standings count.
 */
class SeasonTablesTest {

	private static JsonNode theFileBothSidesRead() throws IOException {
		Path here = Path.of("").toAbsolutePath();

		for (Path candidate = here; candidate != null; candidate = candidate.getParent()) {
			Path file = candidate.resolve("frontend/src/data/tablesBothSidesWrite.json");

			if (Files.isRegularFile(file)) {
				return new ObjectMapper().readTree(Files.readString(file, StandardCharsets.UTF_8));
			}
		}

		throw new IllegalStateException("no directory above " + here + " holds the tables both sides write");
	}

	private record Season(List<Member> members, List<Run> runs, Map<Long, BigDecimal> before, List<Team> teams,
			List<Pair> pairs, List<League> leagues, Map<Long, Long> eventOfRace, Map<Long, Event> events,
			JsonNode expected) {
	}

	private static Season season() throws IOException {
		JsonNode file = theFileBothSidesRead();
		List<Member> members = new ArrayList<>();

		for (JsonNode one : file.get("members")) {
			if (one.get("ranks").asBoolean()) {
				String gender = one.get("gender").asString();

				members.add(new Member(one.get("id").asLong(), one.get("number").asString(),
						"Ime " + one.get("number").asString(), gender, SeasonTables.categoryCode(gender,
								one.get("ageBand").asString(), one.get("beginner").asBoolean())));
			}
		}

		Map<Long, String> raceNames = new HashMap<>();
		Map<Long, Long> eventOfRace = new HashMap<>();

		for (JsonNode one : file.get("races")) {
			raceNames.put(one.get("id").asLong(), one.get("name").asString());
			eventOfRace.put(one.get("id").asLong(), one.get("event").asLong());
		}

		List<Run> runs = new ArrayList<>();

		for (JsonNode one : file.get("runs")) {
			if (one.get("standing").asBoolean()) {
				runs.add(new Run(one.get("id").asLong(), one.get("member").asLong(), one.get("race").asLong(),
						one.get("event").asLong(), LocalDate.parse(one.get("date").asString()),
						new BigDecimal(one.get("kilometers").asString()), one.get("ascent").asInt(),
						one.get("descent").asInt(), one.get("seconds").asInt(), new BigDecimal(one.get("points").asString()),
						one.get("length").asString(), raceNames.get(one.get("race").asLong())));
			}
		}

		Map<Long, BigDecimal> before = new HashMap<>();

		file.get("before").propertyStream().forEach(one -> before.put(Long.parseLong(one.getKey()),
				new BigDecimal(one.getValue().asString())));

		List<Team> teams = new ArrayList<>();

		for (JsonNode one : file.get("teams")) {
			Set<Long> roster = new LinkedHashSet<>();

			one.get("roster").forEach(id -> roster.add(id.asLong()));
			teams.add(new Team(one.get("id").asLong(), one.get("name").asString(), roster));
		}

		List<Pair> pairs = new ArrayList<>();

		for (JsonNode one : file.get("pairs")) {
			pairs.add(new Pair(one.get("id").asLong(), one.get("man").asLong(), one.get("woman").asLong()));
		}

		List<League> leagues = new ArrayList<>();

		for (JsonNode one : file.get("leagues")) {
			Set<Long> races = new LinkedHashSet<>();

			one.get("races").forEach(id -> races.add(id.asLong()));
			leagues.add(new League(one.get("id").asLong(), one.get("name").asString(), races));
		}

		Map<Long, Event> events = new HashMap<>();

		for (JsonNode one : file.get("events")) {
			events.put(one.get("id").asLong(), new Event(one.get("id").asLong(),
					LocalDate.parse(one.get("date").asString()), one.get("name").asString()));
		}

		return new Season(members, runs, before, teams, pairs, leagues, eventOfRace, events, file.get("expected"));
	}

	private static List<String> strings(JsonNode list) {
		List<String> strings = new ArrayList<>();

		list.forEach(one -> strings.add(one.asString()));

		return strings;
	}

	private static List<Long> longs(JsonNode list) {
		List<Long> longs = new ArrayList<>();

		list.forEach(one -> longs.add(one.asLong()));

		return longs;
	}

	private static <T> List<String> numbers(List<Placed<T>> placed, Function<T, Member> member) {
		/* And the places are one, two, three with nothing shared or skipped. */
		for (int index = 0; index < placed.size(); index++) {
			assertThat(placed.get(index).position()).isEqualTo(index + 1);
		}

		return placed.stream().map(one -> member.apply(one.row()).number()).toList();
	}

	@Test
	void theStandingOfEachGenderIsTheScreens() throws IOException {
		Season season = season();

		for (String gender : List.of("M", "F")) {
			assertThat(numbers(SeasonTables.standing(season.members(), season.runs(), gender, null), Standing::member))
					.as("the standing of %s", gender)
					.isEqualTo(strings(season.expected().get("standing").get(gender)));
		}
	}

	@Test
	void theStandingOfEachCategoryIsTheScreens() throws IOException {
		Season season = season();
		Map<String, List<String>> drawn = new TreeMap<>();

		for (Member member : season.members()) {
			drawn.put(member.category(), numbers(SeasonTables.standing(season.members(), season.runs(),
					member.gender(), member.category()), Standing::member));
		}

		Map<String, List<String>> expected = new TreeMap<>();

		season.expected().get("category").propertyStream().forEach(one -> expected.put(one.getKey(), strings(one.getValue())));

		assertThat(drawn).isEqualTo(expected);
	}

	@Test
	void theTeamsAndEachTeamsPageAreTheScreens() throws IOException {
		Season season = season();

		assertThat(SeasonTables.teams(season.teams(), season.runs()).stream().map(one -> one.row().team().id()).toList())
				.isEqualTo(longs(season.expected().get("teams")));

		Map<String, List<String>> pages = new LinkedHashMap<>();
		Map<String, List<String>> expected = new LinkedHashMap<>();

		for (Team team : season.teams()) {
			pages.put(String.valueOf(team.id()), numbers(SeasonTables.teamPage(season.members().stream()
					.filter(member -> team.roster().contains(member.id())).toList(), season.runs()), Standing::member));
		}

		season.expected().get("teamPages").propertyStream().forEach(one -> expected.put(one.getKey(), strings(one.getValue())));

		assertThat(pages).containsExactlyInAnyOrderEntriesOf(expected);
	}

	@Test
	void theCountOfATeamIsItsRosterAndNotOnlyThoseWhoRank() throws IOException {
		Season season = season();

		/* Team 9 holds 000107, who has no right to rank: counted, not placed (`rankTeams`). */
		assertThat(SeasonTables.teams(season.teams(), season.runs()).stream()
				.filter(one -> one.row().team().id() == 9).findFirst().orElseThrow().row().members()).isEqualTo(3);
	}

	@Test
	void everyTopListIsTheScreens() throws IOException {
		Season season = season();
		JsonNode expected = season.expected();

		for (String length : SeasonTables.LENGTHS) {
			assertThat(numbers(SeasonTables.byLength(season.members(), season.runs(), length), SeasonTables.Tally::member))
					.as("the list of %s", length)
					.isEqualTo(strings(expected.get("byLength").get(length)));
		}

		assertThat(numbers(SeasonTables.kilometers(season.members(), season.runs()), SeasonTables.Tally::member))
				.isEqualTo(strings(expected.get("kilometers")));
		assertThat(numbers(SeasonTables.timeOnCourse(season.members(), season.runs()), SeasonTables.Tally::member))
				.isEqualTo(strings(expected.get("timeOnCourse")));
		assertThat(numbers(SeasonTables.progress(season.members(), season.runs(), season.before()),
				SeasonTables.Progress::member)).isEqualTo(strings(expected.get("progress")));
		assertThat(SeasonTables.bestRaces(season.members(), season.runs()).stream().map(one -> one.row().run().id())
				.toList()).isEqualTo(longs(expected.get("bestRaces")));
	}

	@Test
	void theBoardOfPairsIsTheScreensWithTheLargerHalfFirst() throws IOException {
		Season season = season();
		List<List<String>> expected = new ArrayList<>();

		season.expected().get("pairs").forEach(one -> expected.add(List.of(one.get(0).asString(), one.get(1).asString())));

		assertThat(SeasonTables.pairs(season.pairs(), season.members(), season.runs()).stream()
				.map(one -> List.of(String.valueOf(one.row().pair().id()), one.row().first().number())).toList())
				.isEqualTo(expected);
	}

	@Test
	void everyLeagueIsTheScreensColumnsAndRows() throws IOException {
		Season season = season();

		for (League league : season.leagues()) {
			JsonNode expected = season.expected().get("leagues").get(String.valueOf(league.id()));
			LeagueTable table = SeasonTables.league(league, season.eventOfRace(), season.events(), season.members(),
					season.runs());

			assertThat(table.columns().stream().map(Event::id).toList()).isEqualTo(longs(expected.get("columns")));

			Map<String, List<String>> drawn = new TreeMap<>();
			Map<String, List<String>> wanted = new TreeMap<>();

			table.byGender().forEach((gender, rows) -> drawn.put(gender, numbers(rows, SeasonTables.LeagueRow::member)));
			expected.propertyStream().filter(one -> !one.getKey().equals("columns"))
					.forEach(one -> wanted.put(one.getKey(), strings(one.getValue())));

			assertThat(drawn).as("the league %s", league.name()).isEqualTo(wanted);
		}
	}

	@Test
	void aLeaguesRowAddsWhatEachOfItsColumnsHolds() throws IOException {
		Season season = season();
		League first = season.leagues().getFirst();
		SeasonTables.LeagueRow row = SeasonTables.league(first, season.eventOfRace(), season.events(),
				season.members(), season.runs()).byGender().get("M").getFirst().row();

		/* 000101 ran 101 (event 1) and 201 (event 2), twenty points each. */
		assertThat(row.cells()).containsExactlyInAnyOrderEntriesOf(Map.of(1L, new BigDecimal("20.00"), 2L,
				new BigDecimal("20.00")));
		assertThat(row.total()).isEqualByComparingTo("40.00");
	}
}
