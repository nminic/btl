package com.btl.portal.domain.ranking;

import com.btl.portal.domain.ranking.Standing.Rung;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE LADDER IN THE CODE IS THE LADDER THE PORTAL PUBLISHES, read out of the
 * published text rather than remembered.
 *
 * <p>Član 49 of the rulebook is a table of seven ladders, and PDL P12 says of its
 * own copy: "Tabela u pravilniku je izvor; ova je njena kopija i mora da se menja
 * sa njom." A third copy now lives in {@link Standing}, and a list written out
 * three places is a list that moves in one of them. This is the floor under it.
 *
 * <p><b>What this can say and what it cannot.</b> It ties every ladder the
 * rulebook publishes to a decision in the code: either the code orders by it, or
 * the code says in as many words that it does not yet. An eighth ladder added to
 * the rulebook tomorrow fails here and asks for that decision once, instead of
 * being discovered the day somebody notices a board ordered by nothing.
 *
 * <p><b>The boundary, written down rather than left to be found.</b> The rulebook
 * is read off the working tree at {@code ../frontend/public/mock/pages.json},
 * because it belongs to the other half of the repository and this build has no
 * other way to reach it. The same move is already made by the ducat floor in
 * {@code DucatConstraintsTest}. Static pages stay repository content rather than
 * moving into the database (owner, 09.09.2026), so the file is durable; the path
 * is not, and the day it moves this fails and says so.
 */
class LaddersMatchTheRulebookTest {

	private static final Path PUBLISHED = Path.of("..", "frontend", "public", "mock", "pages.json");

	private static final String ARTICLE = "### Član 49.";

	/**
	 * The ladders Član 49 publishes that the server does not order by yet, and
	 * what each of them is waiting for.
	 *
	 * <p>Written out, and that is the point of it: this is the list somebody has
	 * to shorten, and until he does, the entry says who is not being ranked. A
	 * ladder the rulebook drops, or one added to it, fails the case below rather
	 * than sitting here quietly.
	 */
	private static final Map<String, String> NOT_ON_THE_SERVER_YET = Map.of(
			"Najviše kilometara", "a board of ten, and it ranks by a total this class does not rank by",
			"Najduže na stazi", "the one board where time IS a rung, and it needs its own ladder",
			"Najbolja trka", "ranks races rather than people, so its rows are not seasons at all",
			"Najbolji tim", "needs the team, and a team's last rung is its own identifier",
			"Najbolji trkački par", "needs the pair, and its last rung is a sum of two member numbers",
			"Po broju trka po tipu", "five boards, one per length, and each counts only its own races");

	private static String rulebook() throws IOException {
		assertThat(PUBLISHED)
				.as("the portal's own rulebook is not where this expects it, so the two are no longer tied")
				.exists();

		JsonNode pages = new ObjectMapper()
				.readTree(Files.readString(PUBLISHED, StandardCharsets.UTF_8));

		List<String> holding = new ArrayList<>();

		pages.propertyStream().forEach(page -> page.getValue().path("sections")
				.forEach(section -> {
					String body = section.path("body").asString();

					if (body.contains(ARTICLE)) {
						holding.add(body);
					}
				}));

		assertThat(holding)
				.as("the article about ties is published in %d places, so there is no one source", holding.size())
				.hasSize(1);

		return holding.get(0);
	}

	/** Every ladder Član 49 publishes, in the order of its own rows, with its
	 *  rungs split on the word the article joins them with. */
	private static Map<String, List<String>> published() throws IOException {
		String article = rulebook();
		String fromHere = article.substring(article.indexOf(ARTICLE));

		Map<String, List<String>> ladders = new LinkedHashMap<>();

		for (String line : fromHere.split("\n")) {
			String[] cells = line.split("\\|");

			/* A row of the table and not its heading, its rule, or the prose around
			   it: four pieces because the line starts and ends with a bar. */
			if (cells.length == 3 && !cells[1].isBlank() && cells[2].contains(", pa ")) {
				ladders.put(cells[1].trim(),
						Arrays.stream(cells[2].trim().split(", pa ")).map(String::trim).toList());
			}
		}

		assertThat(ladders)
				.as("no ladder was read out of the article, so this measures nothing at all")
				.isNotEmpty();

		return ladders;
	}

	/**
	 * The general standing orders by exactly what the rulebook says it does, in
	 * exactly that order.
	 *
	 * <p>The last rung comes from {@link Standing#LAST_RUNG_IN_THE_RULEBOOK} and
	 * not from {@link Standing#GENERAL}, because it is not a measure of a season:
	 * {@code places} asks for it separately. Both are here so the published row is
	 * accounted for whole rather than for all of it but the last word.
	 */
	@Test
	void theGeneralStandingOrdersByWhatTheRulebookPublishes() throws IOException {
		List<String> inTheCode = new ArrayList<>(Standing.GENERAL.stream().map(Rung::inTheRulebook).toList());
		inTheCode.add(Standing.LAST_RUNG_IN_THE_RULEBOOK);

		assertThat(published().get("Generalni plasman"))
				.as("the standing in the code is not the standing the portal publishes")
				.isEqualTo(inTheCode);
	}

	/**
	 * And every OTHER ladder the rulebook publishes is one somebody decided about.
	 *
	 * <p>This is the half a list cannot do for itself. A ladder added to the
	 * rulebook and to nothing else fails here, and a ladder dropped from it leaves
	 * an entry below with nothing to explain, which fails here too. Either way the
	 * answer is a decision and not a discovery.
	 */
	@Test
	void everyOtherLadderIsOneSomebodyHasDecidedAbout() throws IOException {
		Set<String> theirs = published().keySet();

		assertThat(theirs)
				.as("a ladder is published that nothing in the code has an answer for")
				.containsExactlyInAnyOrderElementsOf(
						new ArrayList<>(NOT_ON_THE_SERVER_YET.keySet()) {{
							add("Generalni plasman");
						}});
	}

	/**
	 * The principle above the table is still the principle the code is built on.
	 *
	 * <p>Every rung of every ladder means MORE of something, which is why
	 * {@link Rung#moreFirst()} is the only direction there is. The day the
	 * rulebook says otherwise, this asks for a rung that can go the other way
	 * rather than letting the code keep a principle the portal has dropped.
	 */
	@Test
	void volumeIsRewardedAndEfficiencyNever() throws IOException {
		assertThat(rulebook())
				.as("the article no longer carries the principle every ladder in the code is built on")
				.contains("nagrađuje se veći obim, nikad efikasnost");
	}
}
