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
import java.util.Set;
import java.util.TreeSet;

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
 *
 * <p><b>THE SAME FILE IS READ FOR A SECOND JOIN SINCE 10.10.2026, and it is the same kind of
 * one.</b> A price is typed as a whole number (PDL, ODLUKA 02.10.2026, „Iznosi se unose kao celi
 * brojevi", for what is typed confirmed on 10.10.2026): the route refuses a fraction in both
 * amounts ({@code PricingWriteApiTest}) and the form refuses a separator as it is typed, which is
 * what {@code integer} on a field of the definition says. The last test of this class holds the
 * form's half to the route's.
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
	 * <p>The names are the form's own field names, which are the two amount columns of
	 * {@code price_row} and two of the three fields of {@code PricingWriteApi.TheForm} - the
	 * third being the name, whose own cap is held by {@code WhatARowIsCalledTest}.
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
	 * RSD in PDL.md ("Ne preračunava se po kursu na dan")
	 * „je bio <b>nacin da se cene prvi put izracunaju</b>, ne odnos
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

	/**
	 * Every field the form draws that says {@code integer}, by name: the boxes that refuse a
	 * separator as it is typed.
	 *
	 * <p>Collected by walking the file for the reason {@link #ceilingsTheFormDraws} gives, so a
	 * field given {@code integer} tomorrow arrives here on the day it is added.
	 */
	private static Set<String> fieldsTheFormTakesWhole() throws IOException {
		assertThat(FORM)
				.as("the price form is not where this expects it, so nothing is being compared")
				.exists();

		Set<String> found = new TreeSet<>();
		collectWhole(new ObjectMapper().readTree(Files.readString(FORM, StandardCharsets.UTF_8)), found);

		return found;
	}

	private static void collectWhole(JsonNode node, Set<String> into) {
		if (node.isObject()) {
			if (node.has("name") && node.path("integer").asBoolean(false)) {
				into.add(node.get("name").asString());
			}

			node.propertyStream().forEach(one -> collectWhole(one.getValue(), into));
		} else if (node.isArray()) {
			node.forEach(one -> collectWhole(one, into));
		}
	}

	/**
	 * THE FORM TAKES NO SEPARATOR IN THE TWO AMOUNTS THE ROUTE REFUSES A FRACTION IN.
	 *
	 * <p><b>PDL, ODLUKA 02.10.2026, „Iznosi se unose kao celi brojevi"</b>, recorded as the owner's
	 * own words - „Iznosi se unose bez tačaka i zareza!" - and, for what is typed, confirmed on
	 * 10.10.2026. The incident behind it was „3.500" in the price list quietly becoming 3,5
	 * dinars. The route is the floor ({@code PricingWriteApiTest}: {@code 3.500} in the dinar box
	 * is refused with {@code theAmountIsNotWhole}), and the form is the place the administrator is
	 * stopped before he sends anything.
	 *
	 * <p><b>Both directions, as one set.</b> The two amounts of {@code PricingWriteApi.TheForm} are
	 * {@code eur} and {@code rsd}, and the name of the price row is the third field of that record
	 * and is text. A form that dropped {@code integer} from one of the two lets the separator
	 * through to a route that refuses it with a sentence the form could have spared him; a form that
	 * gave it to the name would refuse a word. Neither is visible from either side alone.
	 *
	 * <p><b>The match with {@code frontend/src/forms/wholeNumbers.test.ts} is the other half of the
	 * same fact</b>: that one reads the form and the type each route declares for every number field
	 * on disk, and holds the two amounts here to a route that keeps them as {@code BigDecimal} and
	 * refuses a fraction by a check instead of by a type.
	 */
	@Test
	void theFormTakesNoSeparatorInTheTwoAmountsTheRouteRefusesAFractionIn() throws IOException {
		assertThat(fieldsTheFormTakesWhole())
				.as("the fields the price form takes whole are not the two amounts the route refuses"
						+ " a fraction in, so one of the two homes has moved alone")
				.containsExactly("eur", "rsd");
	}
}
