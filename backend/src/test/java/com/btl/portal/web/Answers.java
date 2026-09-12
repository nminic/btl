package com.btl.portal.web;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE TWO FLOORS EVERY RESOURCE OF THIS API STANDS ON, in one home.
 *
 * <p>Nine resources are still to be written and these two questions are asked of
 * each of them: does the answer name the fields the portal reads by, and does any
 * field of it never change. Written out per resource they would be nine copies of
 * one rule, which is the thing the schema itself refuses to do (V7) and the thing
 * three reviews in one day found in the code around them.
 *
 * <p><b>Why the second floor is worth as much as the first.</b> A field the
 * fixture never varies is a field the server could answer with a constant, and
 * the two read alike in every case above it. Measured on 12.09.2026: seven fields
 * of the calendar were the same in every record of its fixture, and a server
 * answering any of them with a literal passed. This names no field; it reads them
 * off the answer, so a field added tomorrow is either varied by the fixture or it
 * is measured by nothing and says so.
 */
final class Answers {

	/** What the portal serves today, which is the shape every screen reads by. */
	private static final Path MOCK = Path.of("..", "frontend", "public", "mock");

	private Answers() {
	}

	/** The names in one record, which is what a screen reads by. */
	static Set<String> fieldsOf(JsonNode one) {
		return one.properties().stream().map(Map.Entry::getKey)
				.collect(Collectors.toCollection(LinkedHashSet::new));
	}

	/** The names in one record of what the portal serves today. */
	static Set<String> servedFields(String file) {
		try {
			JsonNode all = new ObjectMapper()
					.readTree(Files.readString(MOCK.resolve(file), StandardCharsets.UTF_8));

			assertThat(all.isArray() && !all.isEmpty())
					.as("%s is not a list of records, so there is nothing to compare", file)
					.isTrue();

			return fieldsOf(all.get(0));
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ONE THE SERVER ANSWERS WITH, which is the
	 * floor for a resource whose values the schema decides rather than the file.
	 *
	 * <p>A46 measures a codebook by comparing the whole answer with the file the
	 * portal serves. The calendar, the leagues and the results are not codebooks:
	 * the served files carry text identifiers and the strings "no" and "yes", both
	 * artefacts of one import, and the schema says bigserial and boolean
	 * (12.09.2026). What must not move is the NAMES.
	 *
	 * <p><b>A subset and not an equality, and that is the decision of 12.09.2026
	 * rather than a looser test.</b> A name the portal reads and the server does not
	 * answer with is a screen that goes blank; a name the server answers with and no
	 * screen reads costs nothing, and an equality would refuse the server ever
	 * carrying anything the mock never had.
	 *
	 * <p><b>And a field the server deliberately does NOT answer with is named here,
	 * with the reason in the case that names it.</b> The competitors' resource will
	 * have such fields: the privacy policy says a date of birth is never shown "in
	 * full or in short", so the year does not leave the server either. A silent
	 * omission and a lost field look the same from here, so they are told apart by
	 * being written down - and each one named is checked to be a field the portal
	 * really serves, so a stale name cannot hide a field that went missing.
	 *
	 * @param deliberatelyNotAnswered names the portal serves today and this resource
	 *                                answers with on purpose, each for a reason the
	 *                                caller states
	 */
	static void everyFieldThePortalReadsIsAnswered(String path, JsonNode answered, String file,
			String... deliberatelyNotAnswered) {
		assertThat(answered.isArray() && !answered.isEmpty())
				.as("%s answered with nothing, so there are no fields to compare", path)
				.isTrue();

		Set<String> served = servedFields(file);
		Set<String> answeredFields = fieldsOf(answered.get(0));

		for (String left : deliberatelyNotAnswered) {
			/* Both halves, because each catches the opposite failure and a name that
			   does neither is decoration. The first: a name that the portal stopped
			   serving would sit here forever, quietly excusing a field that went
			   missing. The second: the field really has to be absent from the answer,
			   which is the whole claim - without it, naming `birthYear` as left out
			   would read the same whether the year leaves the server or not, and that
			   is the field the privacy policy is about (found in review, 12.09.2026). */
			assertThat(served)
					.as("%s does not serve %s at all, so leaving it out of %s hides nothing",
							file, left, path)
					.contains(left);
			assertThat(answeredFields)
					.as("%s answers with %s, which this case says it deliberately leaves out",
							path, left)
					.doesNotContain(left);
		}

		Set<String> mustBeAnswered = new LinkedHashSet<>(served);
		mustBeAnswered.removeAll(List.of(deliberatelyNotAnswered));

		assertThat(answeredFields)
				.as("%s no longer answers with everything %s is read for", path, file)
				.containsAll(mustBeAnswered);
	}

	/**
	 * AND NO OTHER FIELD WOULD HAVE GIVEN THIS SAME ORDER.
	 *
	 * <p><b>This exists because guessing the axes cost two rounds of review on one
	 * case</b> (12.09.2026). A case that says "the history comes back in the order it
	 * was run" only says that if the fixture can TELL that order from every other one.
	 * Round one: the times happened to rise with the days, so a query sorted by how
	 * fast somebody ran answered the same list. Round two, after the times were fixed:
	 * the points happened to rise with the days, so a query sorted by points answered
	 * the same list. Both were one mistake, and a third axis would have been found the
	 * same way.
	 *
	 * <p><b>So the axes are no longer guessed.</b> Every field the answer carries is
	 * taken in turn, the records are sorted by it in both directions, and each of those
	 * lists has to be a DIFFERENT list from the one the server gave. What comes out is
	 * a statement about the fixture rather than about the code: if any field reproduces
	 * the order, the case names that field instead of passing.
	 *
	 * @param theKey the fields the order really is by, which are the only ones allowed
	 *               to reproduce it
	 */
	static void noOtherFieldWouldGiveThisOrder(String path, List<JsonNode> answered,
			String... theKey) {
		assertThat(answered)
				.as("%s answered with fewer than two records, so it has no order at all", path)
				.hasSizeGreaterThan(1);

		for (String field : fieldsOf(answered.get(0))) {
			if (List.of(theKey).contains(field)) {
				continue;
			}

			Comparator<JsonNode> by = answered.get(0).path(field).isNumber()
					? Comparator.comparing(one -> one.path(field).decimalValue())
					: Comparator.comparing(one -> one.path(field).asString(""));

			for (boolean backwards : new boolean[] {false, true}) {
				List<JsonNode> sorted = new ArrayList<>(answered);
				sorted.sort(backwards ? by.reversed() : by);

				assertThat(sorted)
						.as("the fixture of %s cannot tell its own order from a sort by %s%s,"
										+ " so the case that asserts that order measures nothing",
								path, field, backwards ? " backwards" : "")
						.isNotEqualTo(answered);
			}
		}
	}

	/** AND NOTHING THE ANSWER CARRIES IS THE SAME IN EVERY RECORD. */
	static void noFieldIsTheSameInEveryRecord(String path, JsonNode answered) {
		Map<String, Set<String>> seen = new LinkedHashMap<>();

		for (JsonNode one : answered) {
			one.properties().forEach(field -> seen
					.computeIfAbsent(field.getKey(), any -> new LinkedHashSet<>())
					.add(field.getValue().toString()));
		}

		assertThat(seen)
				.as("%s answered with nothing, so no field of it was compared", path)
				.isNotEmpty();

		seen.forEach((field, values) -> assertThat(values)
				.as("every record of %s carries the same %s, so a constant would answer it",
						path, field)
				.hasSizeGreaterThan(1));
	}
}
