package com.btl.portal.web;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * HOW LONG THE NAME OF A PRICE ROW MAY BE HAS TWO HOMES, AND THIS IS WHAT KEEPS THEM EQUAL.
 *
 * <p><b>THE NUMBER IS MINE AND NOT THE OWNER'S, and that is said first because the file beside
 * this one could be read as a precedent for the opposite.</b> {@code WhatAPriceMayCostTest}
 * exists because PDL P12c (25.09.2026) records the owner accepting the {@code max} figures of
 * {@code admin-cena.form.json} - „Brojevi nisu novi nego oni koje je vlasnik vec prihvatio u
 * formi". That entry names {@code max}. It does <b>not</b> name {@code maxLength}, and no entry
 * of PDL or ADL says how long the name of a price row may be. Eighty is what that same file
 * already carries on the {@code label} field; enforcing it on the route is
 * {@link PricingWriteApi#AS_LONG_AS_THE_FORM_ALLOWS}'s reasoning, marked as mine there and here.
 *
 * <p><b>So what this file is for is narrower than its neighbour's.</b> It does not say the number
 * is right. It says the two places that carry it carry the same one, so that the day somebody
 * moves the box the build stops instead of the route quietly refusing what the form offers - or
 * accepting what the form forbids, which is the direction that reaches a visitor.
 *
 * <p><b>The form is READ off the working tree and never written.</b> The same move
 * {@code WhatAPriceMayCostTest}, {@code WhatRegistrationAsksForTest}, {@code MeWriteApiTest} and
 * {@code TeamWriteApiTest} already make for their own forms, and the boundary those files name
 * applies here too: the definition belongs to the other half of the repository, and the day forms
 * stop living there this fails and says so rather than passing over a file it could not find.
 *
 * <p><b>No database, so no container.</b> Everything asked here is a number in a file against a
 * number in a class.
 *
 * <p><b>WHAT THIS CANNOT SEE, said rather than left to be found.</b> It holds the two NUMBERS
 * equal. It does not hold the route to acting on its own - a refusal deleted outright passes here
 * and fails in {@code PricingWriteApiTest}, which is where a refusal belongs. The two files are
 * halves of one guard on purpose: this one says the numbers agree, that one says the route acts on
 * them.
 */
class WhatARowIsCalledTest {

	private static final Path FORM =
			Path.of("..", "frontend", "src", "forms", "definitions", "admin-cena.form.json");

	/**
	 * Every field the form draws that caps how much text it will take, by name.
	 *
	 * <p><b>Collected by walking the file rather than by asking for one name</b>, which is what
	 * keeps this from being a list of its own: a second text field given a {@code maxLength}
	 * tomorrow arrives here on the day it is added and asks for a decision once, instead of being
	 * capped by a screen and by nothing else. The shape is
	 * {@code WhatAPriceMayCostTest.ceilingsTheFormDraws}, field for field, because it is the same
	 * question asked of a different property.
	 */
	private static Map<String, Integer> boxesTheFormDraws() throws IOException {
		assertThat(FORM)
				.as("the price form is not where this expects it, so nothing is being compared")
				.exists();

		Map<String, Integer> found = new LinkedHashMap<>();
		collect(new ObjectMapper().readTree(Files.readString(FORM, StandardCharsets.UTF_8)), found);

		return found;
	}

	private static void collect(JsonNode node, Map<String, Integer> into) {
		if (node.isObject()) {
			if (node.has("name") && node.has("maxLength")) {
				into.put(node.get("name").asString(), node.get("maxLength").asInt());
			}

			node.propertyStream().forEach(one -> collect(one.getValue(), into));
		} else if (node.isArray()) {
			node.forEach(one -> collect(one, into));
		}
	}

	/**
	 * THE FORM AND THE ROUTE STOP AT THE SAME LENGTH, ON THE SAME FIELD.
	 *
	 * <p><b>Compared as a whole map and in both directions</b>, so the field's NAME is asserted
	 * as well as the number: a {@code maxLength} that moved onto {@code eur} would be a cap on
	 * something this route measures with {@code BigDecimal} and never with
	 * {@link String#length()}, and a comparison of numbers alone would have passed it.
	 *
	 * <p>The name is the form's own field name, which is the column V34 added and the first field
	 * of {@link PricingWriteApi.TheForm}.
	 */
	@Test
	void theFormAndTheRouteStopAtTheSameLength() throws IOException {
		assertThat(boxesTheFormDraws())
				.as("the box admin-cena.form.json draws for the name of a price row is not the length"
						+ " the route enforces, so one of the two has moved alone")
				.containsExactlyInAnyOrderEntriesOf(
						Map.of("label", PricingWriteApi.AS_LONG_AS_THE_FORM_ALLOWS));
	}

	/**
	 * AND THE FORM STILL ASKS FOR THE NAME AT ALL, WHICH THE COMPARISON ABOVE CANNOT SAY.
	 *
	 * <p>A {@code label} field deleted from the form leaves {@link #boxesTheFormDraws} empty, and
	 * an empty map compared against a map of one fails - so that much is covered. What is not is
	 * a field that kept its {@code maxLength} and stopped being <b>required</b>: the route refuses
	 * a body with no name in it ({@code theFormIsNotComplete}), so a form that let an
	 * administrator submit without one would send him a refusal he could not have seen coming.
	 *
	 * <p><b>Read as the form spells it and not as the route spells it</b>, for the reason
	 * {@code MeWriteApi} gives about {@code birthDate} and {@code gender}: what arrives at the
	 * route is a body this file builds, so the two have to agree about the word.
	 */
	@Test
	void theFormAsksForTheNameAndWillNotTakeAFormWithout() throws IOException {
		JsonNode label = fieldNamed("label");

		assertThat(label.path("required").asBoolean())
				.as("admin-cena.form.json no longer requires the name of a price row, while the route"
						+ " still refuses a body without one: the screen would offer a save the server"
						+ " turns away")
				.isTrue();
		assertThat(label.path("type").asString())
				.as("the name of a price row is typed as text, and a form asking for it as anything"
						+ " else sends the route something String.length() does not measure")
				.isEqualTo("text");
	}

	/** The one field of the form under a given name, which must be there to be asked about. */
	private static JsonNode fieldNamed(String name) throws IOException {
		JsonNode fields = new ObjectMapper()
				.readTree(Files.readString(FORM, StandardCharsets.UTF_8))
				.path("fields");

		assertThat(fields.isArray())
				.as("admin-cena.form.json carries no list of fields, so nothing here is being read")
				.isTrue();

		for (JsonNode one : fields) {
			if (name.equals(one.path("name").asString())) {
				return one;
			}
		}

		throw new AssertionError("admin-cena.form.json has no field called " + name
				+ ", so the price screen has no box for what PUT /api/pricing/{key} requires");
	}
}
