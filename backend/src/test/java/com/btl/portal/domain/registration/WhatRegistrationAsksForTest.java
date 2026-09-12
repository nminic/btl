package com.btl.portal.domain.registration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Which fields a registration must carry, and whether the server and the form
 * still agree about it.
 *
 * <p>The lists in {@link WhatRegistrationAsksFor} are written by hand, and the
 * form that draws them is the source of truth for what is asked. This reads the
 * form and compares - both what it asks and WHEN, including the age at which the
 * two conditional groups change places.
 *
 * <p><b>The boundary, written down rather than left to be found.</b> The form
 * definition is read off the working tree, the same move the ducat and rulebook
 * floors already make, because it belongs to the other half of the repository.
 * The day forms stop living there this fails and says so.
 */
class WhatRegistrationAsksForTest {

	private static final Path FORM =
			Path.of("..", "frontend", "src", "forms", "definitions", "registracija.form.json");

	private static final LocalDate A_DAY = LocalDate.parse("2027-06-15");

	/** Every field the form declares, with what it says about when it is required. */
	private static Map<String, JsonNode> asDrawn() throws IOException {
		assertThat(FORM).as("the form is not where this expects it, so nothing is being compared").exists();

		Map<String, JsonNode> fields = new LinkedHashMap<>();
		collect(new ObjectMapper().readTree(Files.readString(FORM, StandardCharsets.UTF_8)), fields);

		assertThat(fields).as("no field was read out of the form, so this measures nothing").isNotEmpty();

		return fields;
	}

	private static void collect(JsonNode node, Map<String, JsonNode> into) {
		if (node.isObject()) {
			if (node.has("name") && (node.has("type") || node.has("required"))) {
				into.put(node.get("name").asString(), node);
			}

			node.propertyStream().forEach(one -> collect(one.getValue(), into));
		} else if (node.isArray()) {
			node.forEach(one -> collect(one, into));
		}
	}

	private static LocalDate aged(int years) {
		return A_DAY.minusYears(years);
	}

	/**
	 * EVERY FIELD THE FORM ASKS FOR IS ONE THE SERVER KNOWS, AND THE OTHER WAY
	 * ROUND.
	 *
	 * <p>Both directions, because either alone is half a guard. A field the form
	 * asks for that the server has never heard of is a field nothing on the server
	 * will require; one the server requires that the form does not draw is a
	 * registration nobody can ever complete.
	 */
	@Test
	void everyFieldTheFormAsksForIsOneTheServerKnows() throws IOException {
		Set<String> mine = new java.util.LinkedHashSet<>(WhatRegistrationAsksFor.OF_EVERYBODY);
		mine.addAll(WhatRegistrationAsksFor.ONLY_WITH_AN_IDENTITY_CARD);
		mine.addAll(WhatRegistrationAsksFor.ONLY_FROM_A_GUARDIAN);
		mine.addAll(WhatRegistrationAsksFor.NEVER_REQUIRED);

		assertThat(mine)
				.as("the fields the server knows are not the fields the form draws")
				.containsExactlyInAnyOrderElementsOf(asDrawn().keySet());
	}

	/** And the server asks nothing of somebody that the form leaves optional. */
	@Test
	void nothingTheFormLeavesOptionalIsRequiredHere() throws IOException {
		Map<String, JsonNode> drawn = asDrawn();

		for (String never : WhatRegistrationAsksFor.NEVER_REQUIRED) {
			assertThat(drawn.get(never).path("required").asBoolean(false))
					.as("the form requires '%s', which the server treats as optional", never)
					.isFalse();
		}
	}

	/**
	 * THE BOUNDARY IN THE FORM IS THE BOUNDARY IN THE CODE.
	 *
	 * <p>The form carries the sixteen twice, once for each conditional group, and
	 * the code carries it once in {@link Guardianship}. This is what keeps the three
	 * from drifting: moving the Statute's boundary without moving the form would
	 * leave a fifteen year old registering with no parent behind him and the server
	 * none the wiser.
	 */
	@Test
	void theBoundaryInTheFormIsTheBoundaryInTheCode() throws IOException {
		Map<String, JsonNode> drawn = asDrawn();

		assertThat(drawn.get("idNumber").path("optionalWhenYoungerThan").path("years").asInt())
				.as("the form asks a younger person for an identity card than the code expects")
				.isEqualTo(Guardianship.ACCOUNT_IS_HELD_BY_A_GUARDIAN_UNDER);

		for (String fromAGuardian : WhatRegistrationAsksFor.ONLY_FROM_A_GUARDIAN) {
			assertThat(drawn.get(fromAGuardian).path("showWhenYoungerThan").path("years").asInt())
					.as("the form shows '%s' at another age than the code expects", fromAGuardian)
					.isEqualTo(Guardianship.ACCOUNT_IS_HELD_BY_A_GUARDIAN_UNDER);
		}
	}

	/**
	 * THE TWO GROUPS CHANGE PLACES AT THAT BOUNDARY, in opposite directions.
	 *
	 * <p>At sixteen the identity card becomes required and the parent's signature
	 * stops being. Both sides of the boundary and both groups, because a rule that
	 * added one without removing the other would pass a case that looked at either
	 * alone.
	 */
	@ParameterizedTest
	@ValueSource(ints = {0, 13, 14, 15})
	void belowTheBoundaryAParentSignsAndNoCardIsAsked(int years) {
		Set<String> asked = WhatRegistrationAsksFor.from(aged(years), A_DAY);

		assertThat(asked).containsAll(WhatRegistrationAsksFor.ONLY_FROM_A_GUARDIAN);
		assertThat(asked)
				.as("a %d year old was asked for an identity card he cannot have", years)
				.doesNotContainAnyElementsOf(WhatRegistrationAsksFor.ONLY_WITH_AN_IDENTITY_CARD);
	}

	@ParameterizedTest
	@ValueSource(ints = {16, 17, 40})
	void atTheBoundaryTheCardIsAskedAndNoParentSigns(int years) {
		Set<String> asked = WhatRegistrationAsksFor.from(aged(years), A_DAY);

		assertThat(asked).containsAll(WhatRegistrationAsksFor.ONLY_WITH_AN_IDENTITY_CARD);
		assertThat(asked)
				.as("a %d year old was asked for a parent's signature", years)
				.doesNotContainAnyElementsOf(WhatRegistrationAsksFor.ONLY_FROM_A_GUARDIAN);
	}

	/** And what everybody is asked is asked of everybody, at either side. */
	@Test
	void whatEverybodyIsAskedIsAskedOfEverybody() {
		assertThat(WhatRegistrationAsksFor.from(aged(14), A_DAY))
				.containsAll(WhatRegistrationAsksFor.OF_EVERYBODY);
		assertThat(WhatRegistrationAsksFor.from(aged(40), A_DAY))
				.containsAll(WhatRegistrationAsksFor.OF_EVERYBODY);
	}

	/** And nothing optional is ever required, at either side. */
	@Test
	void nothingOptionalIsEverRequired() {
		assertThat(WhatRegistrationAsksFor.from(aged(14), A_DAY))
				.doesNotContainAnyElementsOf(WhatRegistrationAsksFor.NEVER_REQUIRED);
		assertThat(WhatRegistrationAsksFor.from(aged(40), A_DAY))
				.doesNotContainAnyElementsOf(WhatRegistrationAsksFor.NEVER_REQUIRED);
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> WhatRegistrationAsksFor.from(null, A_DAY))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("born");
		assertThatThrownBy(() -> WhatRegistrationAsksFor.from(A_DAY, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("day");
	}
}
