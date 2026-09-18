package com.btl.portal.web;

import com.btl.portal.domain.event.EventAddress;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE ADDRESS RULE, REBUILT AGAINST EVERY EVENT THE PORTAL SHIPS.
 *
 * <p><b>Why this is a floor and not a list.</b> {@link EventAddress} is a second home for
 * a rule the portal already spells in {@code entityForms.ts}, accepted for one increment
 * because ADL A3246 switches {@code /mock} off all at once and at the end. Two homes for
 * one rule drift, and a handful of examples chosen by whoever wrote them drift quietly:
 * they exercise the letters somebody thought of. What cannot drift quietly is the file the
 * portal serves, which carries 1167 events whose addresses were built by the other home.
 * Every one of them is rebuilt here.
 *
 * <p><b>The rule for a collision is DERIVED and not counted.</b> The owner's decision of
 * 10.08.2026 makes one name in one year a single address, and the imported history has
 * groups where that really happened - the Gradska liga is run several times a season - so
 * those carry the month as well. Written as "thirty six of them carry a month", this case
 * would be a number somebody has to keep true. Written as "a name and a year that only one
 * event has must rebuild exactly, and one that several share must not", it is the decision
 * itself and needs no number: an event added to the file tomorrow is judged on the day it
 * arrives.
 *
 * <p><b>It lives in this package and not beside the class it measures</b>, because where
 * the portal keeps its own copies is one fact and {@link Answers} is where that fact lives.
 * A path of its own here would be the second copy this whole file exists to prevent.
 *
 * <p><b>And what the shipped file cannot measure is written out by hand below it.</b>
 * Measured: not one of the 1167 names carries a letter of Cyrillic, so the table that
 * spells forty of them is reached by nothing here. That half is a written list, and its
 * floor is the sweep above: the two halves fail for different reasons and neither can
 * excuse the other.
 */
class EventAddressTest {

	/**
	 * EVERY ADDRESS THE PORTAL SHIPS IS ONE THIS RULE BUILDS.
	 *
	 * <p>Three assertions stand ahead of the comparison and each closes a way this could
	 * pass having measured nothing: an empty file compares no names; a file in which every
	 * name and year is unique never reaches the collision branch; and one in which none is
	 * unique never reaches the other.
	 */
	@Test
	void everyAddressThePortalShipsIsOneThisRuleBuilds() {
		JsonNode all = Answers.servedRecords("events.json");

		Map<String, List<JsonNode>> byNameAndYear = new LinkedHashMap<>();

		for (JsonNode one : all) {
			byNameAndYear
					.computeIfAbsent(built(one), any -> new ArrayList<>())
					.add(one);
		}

		assertThat(byNameAndYear)
				.as("the served calendar holds no event, so no address was rebuilt")
				.isNotEmpty();

		List<String> alone = byNameAndYear.entrySet().stream()
				.filter(group -> group.getValue().size() == 1).map(Map.Entry::getKey).toList();

		List<String> shared = byNameAndYear.entrySet().stream()
				.filter(group -> group.getValue().size() > 1).map(Map.Entry::getKey).toList();

		assertThat(alone)
				.as("no name and year in the served calendar belongs to one event alone, so the"
						+ " rule below is never asked to rebuild an address exactly")
				.isNotEmpty();

		assertThat(shared)
				.as("no two events of the served calendar share a name and a year, so the decision"
						+ " of 10.08.2026 about a collision is measured by nothing here")
				.isNotEmpty();

		for (Map.Entry<String, List<JsonNode>> group : byNameAndYear.entrySet()) {
			if (group.getValue().size() == 1) {
				/* ONE EVENT OF THAT NAME THAT YEAR, so the address is exactly what the rule
				   builds. This is the sentence that fails the moment the two homes disagree
				   about a letter: 430 of these names carry č, ć, š, ž or đ and 615 carry a
				   diacritic of another language. */
				assertThat(group.getValue().get(0).path("slug").asString())
						.as("%s answers at an address this rule does not build; the portal and the"
								+ " server no longer agree what an event is called",
								group.getValue().get(0).path("name").asString())
						.isEqualTo(group.getKey());
			} else {
				/* SEVERAL, WHICH THE OWNER'S DECISION MAKES A COLLISION THE PORTAL REFUSES -
				   and what is measured here is only the half that is decided.

				   PDL, 10.08.2026: „Isti naziv dvaput u istoj godini je sudar adresa i portal
				   ga odbija uz poruku koja to kaze", and, of the imported history, „Njima
				   adresa privremeno nosi i mesec ... DO VLASNIKOVE ODLUKE O OBLIKU". The shape
				   of these is expressly undecided, so a case that pinned it down would be
				   holding up a decision nobody has taken. Measured: asked for the month alone
				   it failed on five events carrying the whole day
				   (ostroski-polumaraton-2019-04-06), and either answer written in would have
				   been this file choosing for him.

				   WHAT IS ASKED IS THE PART THAT IS DECIDED: the rule's answer is the whole
				   front of the address, and what follows says WHICH morning, out of this
				   event's own day. The spelling is held letter for letter over these forty one
				   as firmly as over the eleven hundred above, since a rule that spelt c
				   differently moves the front and fails here too.

				   AND THE SERVER NEVER BUILDS ONE OF THESE. It refuses a second event at an
				   address already taken, which is the owner's own sentence and is measured
				   where it belongs, in EventWriteApiTest. These rows are an import. */
				for (JsonNode one : group.getValue()) {
					String served = one.path("slug").asString();
					LocalDate day = LocalDate.parse(one.path("date").asString());

					assertThat(served)
							.as("%s shares a name and a year with another event, and its address"
									+ " no longer starts with the one this rule builds",
									one.path("name").asString())
							.startsWith(group.getKey() + "-");

					assertThat(served.substring(group.getKey().length() + 1))
							.as("%s shares a name and a year with another event, so what its"
									+ " address carries beyond the rule has to say which morning"
									+ " it was", one.path("name").asString())
							.isIn("%02d".formatted(day.getMonthValue()),
									"%02d-%02d".formatted(day.getMonthValue(), day.getDayOfMonth()));
				}
			}
		}
	}

	/** The address this rule builds for one record of the served file. */
	private static String built(JsonNode event) {
		return EventAddress.of(event.path("name").asString(),
				LocalDate.parse(event.path("date").asString()));
	}

	/**
	 * AND THE LETTERS THE SHIPPED CALENDAR NEVER OFFERS.
	 *
	 * <p>Not one of its 1167 names is written in Cyrillic, so the table of forty letters is
	 * reached by nothing above. Each pair here is a letter that would be spelt WRONGLY by
	 * the obvious simplification, and the last two are the whole reason the table is applied
	 * before anything is decomposed rather than after.
	 */
	@ParameterizedTest
	@CsvSource({
			/* The plain alphabet, and lj and nj which are two letters in Latin and one here. */
			"Београдски маратон, 2027-04-18, beogradski-maraton-2027",
			"Љубав и њежност, 2027-04-18, ljubav-i-njeznost-2027",
			/* ђ and ћ go to d and c, because the Latin side turns đ into d: written dj, Đerdap
			   and Ђердап would be two addresses for one name. */
			"Ђердап, 2027-04-18, derdap-2027",
			"Ћуприја, 2027-04-18, cuprija-2027",
			/* And the two that prove the ORDER. Macedonian ѓ is a г carrying an accent:
			   decomposed first, the mark falls off and the table then spells it g, so these
			   two names would answer at one address. */
			"Ѓорче, 2027-04-18, gjorce-2027",
			"Горче, 2027-04-18, gorce-2027",
			/* A letter of the block the table has nothing to say about is dropped rather than
			   turned into a dash, which is the same answer the portal's own rule gives it. */
			"Ѣтрка, 2027-04-18, trka-2027",
	})
	void aNameWrittenInCyrillicAnswersAtTheAddressItsLatinSpellingWould(String name, String day,
			String address) {

		assertThat(EventAddress.of(name, LocalDate.parse(day)))
				.as("%s no longer answers where its Latin spelling does", name)
				.isEqualTo(address);
	}

	/**
	 * AND AN EDIT THAT MOVES NEITHER THE NAME NOR THE YEAR LEAVES THE ADDRESS ALONE.
	 *
	 * <p>The owner, 10.08.2026: an event moved inside its season keeps its address, and with
	 * it everything joined to it. The address kept here is one the rule CANNOT build - it
	 * carries a month - so a version that quietly rebuilt instead of keeping cannot pass by
	 * accident.
	 */
	@Test
	void anEventMovedInsideItsYearKeepsTheAddressItAlreadyHas() {
		assertThat(EventAddress.keptOrRebuilt("Gradska liga Ušće", LocalDate.parse("2027-05-29"),
				"Gradska liga Ušće", LocalDate.parse("2027-05-06"), "gradska-liga-usce-2027-05"))
				.as("an event put off three weeks was given a new address, and everything joined"
						+ " to the old one is now joined to nothing")
				.isEqualTo("gradska-liga-usce-2027-05");
	}

	/**
	 * AND AN EDIT THAT MOVES EITHER OF THEM REBUILDS IT.
	 *
	 * <p>Two cases and not one, because the address is made of two things and a version
	 * watching only the name passes the first.
	 */
	@ParameterizedTest
	@CsvSource({
			"Beogradski maraton, 2027-04-18, beogradski-maraton-2027",
			"Novosadski maraton, 2026-04-18, novosadski-maraton-2026",
	})
	void anEventWhoseNameOrYearMovedAnswersSomewhereElse(String name, String day, String address) {
		assertThat(EventAddress.keptOrRebuilt(name, LocalDate.parse(day),
				"Beogradski maraton", LocalDate.parse("2026-04-18"), "beogradski-maraton-2026"))
				.as("%s of %s kept an address built out of something it no longer is", name, day)
				.isEqualTo(address);
	}
}
