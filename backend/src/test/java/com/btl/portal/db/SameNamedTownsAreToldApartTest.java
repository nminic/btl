package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * TOWNS THAT WERE CALLED ALIKE ARE TOLD APART BY THE NEAREST BIGGER TOWN, and this class holds what the
 * repository can hold of that without the GeoNames file the labels were worked out from.
 *
 * <p>Owner, 02.10.2026, PDL "Odluke iz ciscenja nalaza (02.10.2026, vlasnik)", the entry that begins
 * „Istoimena mesta u istoj drzavi dobijaju u zagradi": towns of one country that carry one name get, in
 * brackets, the nearest bigger town. {@code place_country_name_unique} refuses the second one afterwards
 * and {@link ReferenceDataMatchesCodebookTest} holds the source file; neither says anything about WHAT
 * was written in the brackets, and a key is satisfied by any brackets at all. A label that names the
 * smallest village of the country would pass both.
 *
 * <p><b>Nothing here is a list of towns that were renamed.</b> The question is asked of the two
 * migrations that exist: V3, which loaded the codebook before any label, and the migration that carries
 * the labels, found by what it is ({@code reference data update}, the name the generator gives a delta)
 * and not by its number, so a renumbering on merge moves nothing here. A list of the renamed towns
 * would be a list with no floor under it. What V3 says is the floor: every town as it was, its name, its
 * country, its English name and its rank, which is the codebook's own order of size in the export it was
 * cut from.
 *
 * <p><b>What the owner's sentence is split into, and the check for each part.</b>
 *
 * <ul>
 * <li>"Istoimena mesta u istoj drzavi": only towns of a pair that V3 held more than once are renamed, and
 * the owner said so himself when asked (02.10.2026): „Isključivo DUPLIRANI nazivi dobijaju u zagradi veći
 * mesto. Svi ostali nemaju." A city and a village alike, and a town that is the only one of its name
 * never;
 * <li>"dobijaju u zagradi": the new name is the old one with a bracketed label and nothing else changed,
 * not the rank, not the country, not the English name;
 * <li>"najblize vece mesto": the label is the name of another town of the same country that stands higher
 * in V3's order, and that is not called what this one is called. <i>Nearest</i> cannot be asked of this
 * file, which has no coordinates; {@link #theOwnersExamplesCarryTheNamesHeGave()} asks it for the
 * handful of towns where the owner named the answer, and the whole of it is read by a person ("preostalih
 * 27 i svih 44 iz regiona lige se pregledaju rucno");
 * <li>a town that keeps its bare name is the BEST RANKED of its pair, and the only one that does: the
 * owner's rule about a town of five thousand keeping its bare name changes how many do, never which.
 * </ul>
 *
 * <p>A label is accepted when it is the name of that bigger town or its English name. The codebook calls
 * the Slovenian town of Kocevje "Opcina Kocevje" and gives "Kocevje" as its English name, and the owner
 * approved the second as the label (02.10.2026): the English name is where the codebook says what the
 * town is called, so asking for it is not a loophole.
 */
class SameNamedTownsAreToldApartTest extends DatabaseTest {

	/** The delta the generator writes is named after what it is, and never after a number. */
	private static final String THE_GENERATOR_NAMES_A_DELTA = "reference data update";

	private static final String COPY = "copy place_import (geonames_id, name, country_code, english_name, rank)"
			+ " from stdin;\n";

	/** One row of a migration: a town and what that migration says about it. */
	record Town(long mark, String name, String country, String english, int rank) {
	}

	/**
	 * The six towns whose labels the owner named, or whose label he could read in his own example.
	 *
	 * <p>Every one of them is a village (between 784 and 1801 inhabitants in the GeoNames file the labels
	 * were worked out from), so it carries brackets whichever way the owner decides whether a town of five
	 * thousand keeps its bare name. That is why they are here and a town like Bijelo Polje is not: these
	 * six hold under both readings, and Bijelo Polje is the question.
	 *
	 * <p>Held by MARK, because the name is what is being asserted. Two villages of one name differ only in
	 * which label each carries, so a label given to the wrong one of the two satisfies the key and every
	 * derived question below, and fails here.
	 */
	private static final Map<Long, String> THE_OWNERS_EXAMPLES = Map.of(
			3204307L, "Belotić (Bogatić)",
			3204308L, "Belotić (Šabac)",
			792275L, "Brezovica (Čačak)",
			792277L, "Brezovica (Leskovac)",
			790698L, "Glogovac (Jagodina)",
			3200572L, "Glogovac (Bogatić)");

	@Test
	void theOwnersExamplesCarryTheNamesHeGave() {
		String marks = THE_OWNERS_EXAMPLES.keySet().stream().map(String::valueOf).collect(Collectors.joining(", "));
		Map<Long, String> carried = db
				.sql("select geonames_id, name from place where geonames_id in (" + marks + ")")
				.query((rs, row) -> Map.entry(rs.getLong("geonames_id"), rs.getString("name")))
				.list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

		assertThat(carried).containsExactlyInAnyOrderEntriesOf(THE_OWNERS_EXAMPLES);
	}

	@Test
	void everyTownThatWasRenamedWasOneOfSeveralAndNothingButItsNameChanged() {
		Map<Long, Town> before = byMark(loadedByV3());
		List<Town> renamed = renamedByTheDelta();
		Map<Pair, Integer> carried = new HashMap<>();

		before.values().forEach(town -> carried.merge(new Pair(town.country(), town.name()), 1, Integer::sum));

		assertThat(renamed).as("a delta that renames nothing would leave every question below true").isNotEmpty();

		List<String> offences = new ArrayList<>();

		for (Town now : renamed) {
			Town was = before.get(now.mark());

			if (was == null) {
				offences.add(now.mark() + ": V3 does not carry this town, so the delta renames nothing that was there");
				continue;
			}

			if (carried.get(new Pair(was.country(), was.name())) < 2) {
				offences.add(was.name() + " [" + was.country() + "] was the only town of its name and is renamed");
			}

			if (!now.country().equals(was.country()) || now.rank() != was.rank()
					|| !Objects.equals(now.english(), was.english())) {
				offences.add(was.name() + " [" + was.country() + "]: the country, the rank or the English name"
						+ " changed with the name, and the owner's decision is about the name");
			}
		}

		assertThat(offences).as("what the delta did to a town that was not a namesake, or to more than its name")
				.isEmpty();
	}

	@Test
	void theBracketsHoldTheNameOfABiggerTownOfTheSameCountry() {
		Map<Long, Town> before = byMark(loadedByV3());
		Map<String, List<Town>> ofACountry = before.values().stream()
				.collect(Collectors.groupingBy(Town::country));
		List<Town> renamed = renamedByTheDelta();
		List<String> offences = new ArrayList<>();
		int labelled = 0;

		for (Town now : renamed) {
			Town was = before.get(now.mark());

			if (was == null) {
				continue;
			}

			String opening = was.name() + " (";

			if (!now.name().startsWith(opening) || !now.name().endsWith(")") || now.name().length() <= opening.length() + 1) {
				offences.add(now.name() + " is not " + was.name() + " followed by a label in brackets");
				continue;
			}

			String label = now.name().substring(opening.length(), now.name().length() - 1);

			boolean named = ofACountry.get(was.country()).stream()
					.anyMatch(bigger -> bigger.rank() < was.rank()
							&& !bigger.name().equals(was.name())
							&& (bigger.name().equals(label) || label.equals(bigger.english())));

			labelled++;

			if (!named) {
				offences.add(now.name() + ": no town of " + was.country() + " that stands higher in the codebook"
						+ " and is not called " + was.name() + " is called " + label);
			}
		}

		assertThat(labelled).as("no label was read, so nothing below was asked").isPositive();
		assertThat(offences).as("a label that is not the name of a bigger town of the same country").isEmpty();
	}

	@Test
	void aTownThatKeepsItsBareNameIsTheBestRankedOfItsPairAndTheOnlyOne() {
		Map<Long, Town> before = byMark(loadedByV3());
		Set<Long> renamed = renamedByTheDelta().stream().map(Town::mark).collect(Collectors.toSet());
		Map<Pair, List<Town>> pairs = before.values().stream()
				.collect(Collectors.groupingBy(town -> new Pair(town.country(), town.name())));
		List<String> offences = new ArrayList<>();
		int pairsRead = 0;

		for (Map.Entry<Pair, List<Town>> pair : pairs.entrySet()) {
			if (pair.getValue().size() < 2) {
				continue;
			}

			pairsRead++;

			List<Town> bare = pair.getValue().stream().filter(town -> !renamed.contains(town.mark())).toList();
			Town best = pair.getValue().stream().min((one, other) -> Integer.compare(one.rank(), other.rank())).orElseThrow();

			if (bare.size() > 1) {
				offences.add(pair.getKey().name() + " [" + pair.getKey().country() + "]: " + bare.size()
						+ " towns keep the bare name");
			}

			if (bare.size() == 1 && bare.getFirst().mark() != best.mark()) {
				offences.add(pair.getKey().name() + " [" + pair.getKey().country() + "]: the bare name stayed with "
						+ bare.getFirst().mark() + " and the best ranked town of the pair is " + best.mark());
			}
		}

		assertThat(pairsRead).as("V3 held no pair, so nothing was asked").isPositive();
		assertThat(offences).as("a bare name kept by a smaller town, or by more than one").isEmpty();
	}

	// ------------------------------------------------------------------ reading the two migrations

	private record Pair(String country, String name) {
	}

	private static Map<Long, Town> byMark(List<Town> towns) {
		return towns.stream().collect(Collectors.toMap(Town::mark, town -> town));
	}

	/** V3's COPY block, which is every town as it was loaded: before any label. */
	private List<Town> loadedByV3() {
		String sql = migrationSql("3");
		int from = sql.indexOf(COPY);

		assertThat(from).as("V3 has been rewritten and no longer loads the codebook through its staging table")
				.isNotNegative();

		int start = from + COPY.length();
		int end = sql.indexOf("\n\\.\n", start);
		List<Town> towns = new ArrayList<>();

		for (String line : sql.substring(start, end).split("\n")) {
			String[] field = line.split("\t", -1);

			towns.add(new Town(Long.parseLong(field[0]), unescape(field[1]), field[2], unescape(field[3]),
					Integer.parseInt(field[4])));
		}

		return towns;
	}

	/** One field of a COPY line in the text format, which writes a null as backslash N. */
	private static String unescape(String field) {
		if (field.equals("\\N")) {
			return null;
		}

		StringBuilder out = new StringBuilder();

		for (int at = 0; at < field.length(); at++) {
			char c = field.charAt(at);

			if (c == '\\' && at + 1 < field.length()) {
				char next = field.charAt(++at);

				out.append(switch (next) {
					case 't' -> '\t';
					case 'n' -> '\n';
					case 'r' -> '\r';
					default -> next;
				});
			} else {
				out.append(c);
			}
		}

		return out.toString();
	}

	/** What the first delta migration says each town it touches is now: the rows of its VALUES list. */
	private List<Town> renamedByTheDelta() {
		String version = Arrays.stream(flyway.info().applied())
				.filter(one -> one.getVersion() != null && THE_GENERATOR_NAMES_A_DELTA.equals(one.getDescription()))
				.map(one -> one.getVersion().getVersion())
				.findFirst()
				.orElseThrow(() -> new AssertionError("no applied migration is a " + THE_GENERATOR_NAMES_A_DELTA
						+ ", so the labels are not in the schema"));

		Matcher row = Pattern.compile(
						"^\\s*\\((\\d+), (\\d+), '((?:[^']|'')*)', '([A-Z]{2})', (null|'(?:[^']|'')*')\\),?;?\\s*$",
						Pattern.MULTILINE)
				.matcher(migrationSql(version));
		List<Town> towns = new ArrayList<>();

		while (row.find()) {
			towns.add(new Town(Long.parseLong(row.group(1)), row.group(3).replace("''", "'"), row.group(4),
					row.group(5).equals("null") ? null
							: row.group(5).substring(1, row.group(5).length() - 1).replace("''", "'"),
					Integer.parseInt(row.group(2))));
		}

		return towns;
	}
}
