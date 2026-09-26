package com.btl.portal.domain.pricing;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE CEILING ON A PRICE HAS TWO HOMES BY DECISION, AND THIS IS WHAT KEEPS THEM EQUAL.
 *
 * <p><b>Owner, 25.09.2026 (PDL P12c).</b> He chose that the route refuses an amount above
 * 1.000 EUR and 200.000 RSD, „dakle iznad granice koju forma vec nosi", and the cost he was
 * shown and accepted is written into the journal in as many words: „ako jednog dana zatreba
 * veci iznos, menja se na <b>dva mesta</b>, i u ruti i u formi."
 *
 * <p><b>Two homes the owner accepted is not the same as two homes nobody watches.</b> The
 * screen's guard and the route's refusal answer one question - what may a row of the price
 * list cost - and the day one of them moves alone the portal either refuses what the form
 * offers or accepts what the form forbids. Neither is visible from either side; both are
 * visible from here.
 *
 * <p><b>The form is READ off the working tree and never written.</b> The same move
 * {@code WhatRegistrationAsksForTest}, {@code MeWriteApiTest} and {@code TeamWriteApiTest}
 * already make for their own forms, and the boundary those files name applies here too: the
 * definition belongs to the other half of the repository, and the day forms stop living
 * there this fails and says so rather than passing over a file it could not find.
 *
 * <p><b>No database, so no container.</b> Everything asked here is a number in a file
 * against a number in a class.
 *
 * <p><b>WHAT THIS CANNOT SEE, said rather than left to be found.</b> It holds the two
 * NUMBERS equal. It does not hold the form to drawing a ceiling at all - a {@code max}
 * deleted outright is caught, because the field then has none to compare, but a form that
 * kept its numbers while the route stopped asking would pass here and fail in
 * {@code PricingWriteApiTest}, which is where a refusal belongs. The two files are halves of
 * one guard on purpose: this one says the numbers agree, that one says the route acts on
 * them.
 */
class WhatAPriceMayCostTest {

	private static final Path FORM =
			Path.of("..", "frontend", "src", "forms", "definitions", "admin-cena.form.json");

	/**
	 * Every field the form draws that carries a ceiling, by name.
	 *
	 * <p><b>Collected by walking the file rather than by asking for two names</b>, which is
	 * what keeps this from being a list of its own: a third amount given a {@code max}
	 * tomorrow arrives here on the day it is added instead of on the day somebody remembers
	 * this file. The shape is {@code WhatRegistrationAsksForTest}'s, whose form nests fields
	 * inside conditional groups; this one does not today and may.
	 */
	private static Map<String, BigDecimal> ceilingsTheFormDraws() throws IOException {
		assertThat(FORM)
				.as("the price form is not where this expects it, so nothing is being compared")
				.exists();

		Map<String, BigDecimal> found = new LinkedHashMap<>();
		collect(new ObjectMapper().readTree(Files.readString(FORM, StandardCharsets.UTF_8)), found);

		return found;
	}

	private static void collect(JsonNode node, Map<String, BigDecimal> into) {
		if (node.isObject()) {
			if (node.has("name") && node.has("max")) {
				into.put(node.get("name").asString(), new BigDecimal(node.get("max").asString()));
			}

			node.propertyStream().forEach(one -> collect(one.getValue(), into));
		} else if (node.isArray()) {
			node.forEach(one -> collect(one, into));
		}
	}

	/**
	 * THE FORM AND THE ROUTE STOP AT THE SAME TWO NUMBERS.
	 *
	 * <p><b>Compared as a whole map and in both directions</b>, so a third ceiling appearing
	 * in the form fails here and asks for a decision once, instead of being enforced by a
	 * screen and by nothing else - which is the state P12c was written to end.
	 *
	 * <p>The names are the form's own field names, which are the two columns of
	 * {@code price_row} and the two fields of {@code PricingWriteApi.Amounts}.
	 */
	@Test
	void theFormAndTheRouteStopAtTheSameAmounts() throws IOException {
		assertThat(ceilingsTheFormDraws())
				.as("the ceilings the price form draws are not the ceilings the route enforces,"
						+ " so one of the two homes PDL P12c accepted has moved alone")
				.containsExactlyInAnyOrderEntriesOf(Map.of(
						"eur", MembershipPrice.mostARowMayCostInEuro(),
						"rsd", MembershipPrice.mostARowMayCostInDinars()));
	}

	/**
	 * AND THE TWO ARE NOT ONE CONVERTED, WHICH IS ITS OWN DECISION.
	 *
	 * <p><b>Owner, 25.09.2026 (PDL P12d), refusing the opposite:</b> the rate of 1 EUR = 120
	 * RSD in {@code PDL.md:833} „je bio <b>nacin da se cene prvi put izracunaju</b>, ne odnos
	 * koji portal cuva", and the two currencies are typed „slobodno i nezavisno". He was
	 * shown what it costs and took it: „dinarska lista sme tiho da prestane da bude x120."
	 *
	 * <p><b>This is the one thing the comparison above cannot say.</b> Two ceilings worked
	 * out from one number would pass it perfectly - they would still be two numbers, and
	 * they would still equal the form, because the form would have been written from the
	 * same rate. What says they are independent is that they are <b>not</b> at that rate:
	 * 1.000 at 120 would be 120.000 and the dinar ceiling is 200.000.
	 *
	 * <p>So this is a case about the PAIR rather than about either number, and it is the
	 * sentence which survives the day the owner raises one of them. Written the other way -
	 * asserting the two figures themselves - it would be a third home for numbers that
	 * already have two.
	 */
	@Test
	void theTwoCeilingsAreNotOneAtAnyRateThePortalKnows() {
		BigDecimal euro = MembershipPrice.mostARowMayCostInEuro();
		BigDecimal dinars = MembershipPrice.mostARowMayCostInDinars();

		/* The rate PDL:833 names, which the portal describes and does not enforce. */
		BigDecimal asTheRateWouldHaveIt = euro.multiply(new BigDecimal("120"));

		assertThat(dinars)
				.as("the dinar ceiling is the euro one at the league's own rate, so somebody has"
						+ " made the two a conversion - which is exactly what the owner refused on"
						+ " 25.09.2026 (PDL P12d)")
				.isNotEqualByComparingTo(asTheRateWouldHaveIt);
	}
}
