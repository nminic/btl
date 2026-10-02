package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
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
 * never. A pair is a country and a name compared without regard to case and with regard to marks (review
 * of PR 464, answered 02.10.2026, the coordinator's reading and not the owner's): "Dolenja vas" and
 * "Dolenja Vas" are one name to a reader, "Münster" and "Munster" are not;
 * <li>"dobijaju u zagradi": the new name is the old one with a bracketed label and nothing else changed,
 * not the rank, not the country, not the English name;
 * <li>"najblize vece mesto": the label is the name of another town of the same country that stands higher
 * in V3's order, and that is not called what this one is called. <i>Nearest</i> cannot be asked of this
 * file, which has no coordinates; {@link #theOwnersExamplesCarryTheNamesHeGave()} asks it for the
 * handful of towns where the owner named the answer, and the whole of it is read by a person ("preostalih
 * 27 i svih 44 iz regiona lige se pregledaju rucno");
 * <li>a town that keeps its bare name is the BEST RANKED of its pair, and the only one that does, and
 * there are exactly three of them: San José in Costa Rica, the capital, which nothing in its country is
 * bigger than, and two towns of China the GeoNames file has no row for, Donghe and Wuchang
 * ({@link #THE_THREE_WITH_NO_LABEL}). The owner decided (02.10.2026) that every namesake carries a label,
 * a town of fifteen thousand as much as a village; those three are the exception that was approved, and
 * the same equality is what tells his decision from the other reading he was asked about, that the real
 * town of a pair keeps its name, which would leave six pairs in ten with a bare member.
 * </ul>
 *
 * <p>A label is accepted when it is the name of that bigger town or its English name. The codebook calls
 * the Slovenian town of Kocevje "Opcina Kocevje" and gives "Kocevje" as its English name, and the second
 * was approved as the label (02.10.2026): the English name is where the codebook says what the town is
 * called, so asking for it is not a loophole.
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
	 * were worked out from). They are the towns whose labels the owner named or could read in his own
	 * example; the rest of the labels are read by a person, and the lists are in the pull request.
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

	/**
	 * THE THREE TOWNS OF A PAIR NO LABEL COULD BE WORKED OUT FOR, by GeoNames mark, and why each one is here.
	 *
	 * <p>San José (3621849) is the capital of Costa Rica and nothing in its country is bigger, so there is
	 * no bigger town to name. Donghe (2037643) and Wuchang (1791351) are towns of China that the GeoNames
	 * file the labels were worked out from has no row for, so they have no coordinates and nothing is
	 * nearest to them. Each is the best ranked of its pair, which is why the pair is told apart all the
	 * same: its namesake carries the label. Approved on 02.10.2026 as the exception to "every namesake
	 * is labelled", and the same day the owner said the rule itself: „Isključivo DUPLIRANI nazivi
	 * dobijaju u zagradi veći mesto. Svi ostali nemaju."
	 *
	 * <p><b>A list, and the floor under it is a query.</b> A hand written list is not the fault; one with
	 * nothing under it is. This one is the recorded decision itself, and what it is compared with is
	 * asked of the database: of the towns that stood in a pair in V3, which carry their bare name now.
	 * Equality in both directions, so a fourth bare name fails it and so does a label on one of the three,
	 * and neither can pass for the other.
	 */
	private static final Set<Long> THE_THREE_WITH_NO_LABEL = Set.of(3_621_849L, 2_037_643L, 1_791_351L);

	/**
	 * THE TWO LABELS A PERSON WROTE INSTEAD OF THE RULE'S, by GeoNames mark, and why each one is here.
	 *
	 * <p>Dolga Vas (3201809) and Dolenja vas (3201849) are two villages of Slovenia whose nearest bigger
	 * town is Kočevje. The codebook calls that town "Općina Kočevje", because the Croatian alternate name
	 * GeoNames holds for it is the name of the municipality, and gives "Kočevje" as its English name. The
	 * rule therefore gives "Općina Kočevje" and a person would write the town. Dolga Vas was approved on
	 * 02.10.2026 as a manual correction, and Dolenja vas the same day in the review of PR 464, derived from
	 * it: the same label town and the same fault. Both approvals are the coordinator's and neither is the
	 * owner's, whose sentence says nothing about municipalities.
	 *
	 * <p><b>Why they need a pin of their own.</b> A label is accepted when it is the name of the bigger town
	 * or its English name, so the rule's own output would pass every question in this class: "Općina Kočevje"
	 * is the name of that town and "Kočevje" is its English name. Held by MARK, since the name is what is
	 * asserted, and the way to remove an entry from {@code MANUAL_LABELS} in the tool is to change this list
	 * in the same commit.
	 */
	private static final Map<Long, String> THE_MANUAL_LABELS = Map.of(
			3_201_809L, "Dolga Vas (Kočevje)",
			3_201_849L, "Dolenja vas (Kočevje)");

	@Test
	void theOwnersExamplesCarryTheNamesHeGave() {
		assertThat(namesOf(THE_OWNERS_EXAMPLES.keySet())).containsExactlyInAnyOrderEntriesOf(THE_OWNERS_EXAMPLES);
	}

	@Test
	void theTwoManualLabelsCarryTheNamesThatWereApproved() {
		assertThat(namesOf(THE_MANUAL_LABELS.keySet())).containsExactlyInAnyOrderEntriesOf(THE_MANUAL_LABELS);
	}

	/**
	 * A NAME IS COMPARED WITHOUT REGARD TO CASE AND WITH REGARD TO MARKS, asked of names it can be wrong about.
	 *
	 * <p>The shipped data cannot show that the comparison was weakened back to the exact name where a label is
	 * concerned: no label in it is the name of its own town apart from its case, so the question "is the label
	 * called what this town is called" gives the same answer either way. The pair is held by the data, because
	 * the delta renames four towns that only the case-blind pair finds, but this is held by nothing else. The two
	 * pairs are the real ones the review of PR 464 found, and the Münster is the one that must stay two names.
	 */
	@Test
	void aNameIsComparedWithoutRegardToCaseAndWithRegardToMarks() {
		assertThat(pairOf("SI", "Dolenja vas")).isEqualTo(pairOf("SI", "Dolenja Vas"));
		assertThat(pairOf("DE", "Münster")).isNotEqualTo(pairOf("DE", "Munster"));
		assertThat(pairOf("US", "Boston")).isNotEqualTo(pairOf("GB", "Boston"));
		assertThat(sameWithoutCase("Dolenja vas", "Dolenja Vas")).isTrue();
		assertThat(sameWithoutCase("Münster", "Munster")).isFalse();
	}

	/** What the database holds as the name of each of these towns. */
	private Map<Long, String> namesOf(Set<Long> marks) {
		String list = marks.stream().map(String::valueOf).collect(Collectors.joining(", "));

		return db.sql("select geonames_id, name from place where geonames_id in (" + list + ")")
				.query((rs, row) -> Map.entry(rs.getLong("geonames_id"), rs.getString("name")))
				.list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
	}

	@Test
	void everyTownThatWasRenamedWasOneOfSeveralAndNothingButItsNameChanged() {
		Map<Long, Town> before = byMark(loadedByV3());
		List<Town> renamed = renamedByTheDelta();
		Map<Pair, Integer> carried = new HashMap<>();

		before.values().forEach(town -> carried.merge(pairOf(town.country(), town.name()), 1, Integer::sum));

		assertThat(renamed).as("a delta that renames nothing would leave every question below true").isNotEmpty();

		List<String> offences = new ArrayList<>();

		for (Town now : renamed) {
			Town was = before.get(now.mark());

			if (was == null) {
				offences.add(now.mark() + ": V3 does not carry this town, so the delta renames nothing that was there");
				continue;
			}

			if (carried.get(pairOf(was.country(), was.name())) < 2) {
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
							&& !sameWithoutCase(bigger.name(), was.name())
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
				.collect(Collectors.groupingBy(town -> pairOf(town.country(), town.name())));
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

	@Test
	void theTownsOfAPairThatKeepTheirBareNameAreExactlyTheThreeNoLabelCouldBeWorkedOutFor() {
		Map<Long, Town> before = byMark(loadedByV3());
		Map<Pair, Long> carried = before.values().stream()
				.collect(Collectors.groupingBy(town -> pairOf(town.country(), town.name()), Collectors.counting()));
		Map<Long, String> now = db.sql("select geonames_id, name from place")
				.query((rs, row) -> Map.entry(rs.getLong("geonames_id"), rs.getString("name")))
				.list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

		Set<Long> bare = before.values().stream()
				.filter(town -> carried.get(pairOf(town.country(), town.name())) > 1)
				.filter(town -> town.name().equals(now.get(town.mark())))
				.map(Town::mark)
				.collect(Collectors.toSet());

		assertThat(bare)
				.as("the towns of a pair that carry their bare name are not the three the exception was approved"
						+ " for: a fourth one lost its label, or one of the three was given one")
				.containsExactlyInAnyOrderElementsOf(THE_THREE_WITH_NO_LABEL);
	}

	// ------------------------------------------------------------------ reading the two migrations

	/** A name in a country, the name already folded: see {@link #pairOf(String, String)}. */
	private record Pair(String country, String name) {
	}

	/**
	 * The pair two towns are told apart as: the country and the name WITHOUT regard to case and WITH regard
	 * to marks (review of PR 464, answered 02.10.2026). "Dolenja vas" and "Dolenja Vas" are one name to a
	 * reader and "Münster" and "Munster" are not. {@code toLowerCase(Locale.ROOT)} is what
	 * {@code oznaci-istoimena-mesta.py} does with {@code str.lower()}, and the two were measured to give the
	 * same text over every name of the codebook.
	 */
	private static Pair pairOf(String country, String name) {
		return new Pair(country, name.toLowerCase(Locale.ROOT));
	}

	private static boolean sameWithoutCase(String one, String other) {
		return one.toLowerCase(Locale.ROOT).equals(other.toLowerCase(Locale.ROOT));
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
