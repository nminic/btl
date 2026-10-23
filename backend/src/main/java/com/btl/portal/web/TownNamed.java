package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * THE TOWN A REQUEST ABOUT A MEMBER'S OWN ROW NAMED, or nothing where it named none.
 *
 * <p><b>Two routes write a member's town and both ask here</b>: {@link MeWriteApi}, the member
 * himself, and {@link MemberDataWriteApi}, the administration over the members (PDL, „Red člana,
 * kartica Podaci i strana Podešavanja", 22.10.2026: „Tu admini i moderatori imaju pravo da izmene
 * sve podatke takmičara"). It was a private method of the first until the second arrived, and it
 * moved here rather than being written twice, so the two cannot come to disagree about what a town
 * is. The words it answers with stay where they were declared, on {@link MeWriteApi}, because that
 * is the class the screens already read them from.
 *
 * <p><b>Nothing and „a town that is wrong" are two different answers</b>, which is why this hands
 * back an {@link Optional} of a record that may itself carry a refusal instead of a bare null: a
 * request that says nothing about where the member lives leaves all three columns alone, and a
 * request that says something the portal cannot resolve is refused rather than quietly ignored.
 *
 * <p><b>THE THREE COLUMNS ARE ONE FACT AND THE SCHEMA SAYS SO.</b> V7:
 * {@code competitor_town_is_from_the_codebook_or_typed check ((place_id is null) <> (city is
 * null))} and {@code competitor_typed_town_names_its_country check ((city is null) = (country_id is
 * null))}. So they cannot be written one at a time the way the other personal columns are:
 * {@code coalesce} on each of them separately would let a member who typed a town clear his
 * {@code place_id} and break the first check. Either the request names the whole town or it names
 * none of it, and both routes write all three together or leave all three alone.
 *
 * <p><b>A THIRD HOME FOR THIS RULE, NAMED RATHER THAN HIDDEN, AND WITH THE MUTATION THAT CATCHES
 * IT DRIFTING.</b> {@link RegistrationApi#theTown} answers it for a member being made and
 * {@link EventWriteApi} for an event, and the two already differ on purpose - one hands back
 * nothing at all and the other names WHICH of the two faults it is. Folding all of them into this
 * class would have to settle that difference and would reach into both of those files, which is its
 * own piece of work. What is done instead is what {@code CLAUDE.md} asks of a fact that lives in
 * more than one place: the place that decides FOR A MEMBER'S EXISTING ROW is this one, and
 * {@code MeWriteApiTest.theSameMalformedTownIsRefusedWhereverItIsSent} sends one body that names a
 * town in both ways at once to {@code /api/me} and to {@code /api/registration} and requires both
 * to refuse it.
 */
@Component
class TownNamed {

	private final JdbcClient db;

	TownNamed(JdbcClient db) {
		this.db = db;
	}

	/**
	 * A town resolved into the three columns V7 holds, or the word for why it could not be.
	 *
	 * <p>Exactly one of {@code placeKey} and {@code city} is ever set on a resolved town, which is
	 * the schema's own check read as a shape instead of as a refusal.
	 *
	 * @param placeKey {@code place.id}, THIS DATABASE'S KEY, resolved from the {@code geonames_id}
	 *                 the request carried - the two are never the same number and never confused,
	 *                 which is the distinction {@link EventWriteApi} draws by naming its own field
	 *                 {@code placeKey}
	 * @param refused  the reason, on a town that resolved to nothing. Null on a real one
	 */
	record Town(Long placeKey, String city, Long countryId, String refused) {

		static Town refusedWith(String reason) {
			return new Town(null, null, null, reason);
		}
	}

	/**
	 * @param placeId a town of the world codebook, by its {@code geonames_id}
	 * @param city    a town typed by hand instead
	 * @param country the code of that typed town's country, {@code RS}, never its key
	 */
	Optional<Town> named(Long placeId, String city, String country) {
		boolean fromTheCodebook = placeId != null;
		boolean typedByHand = !isNothing(city) || !isNothing(country);

		if (!fromTheCodebook && !typedByHand) {
			return Optional.empty();
		}

		/* BOTH WAYS AT ONCE IS NOT A TOWN. A codebook town „nosi svoju drzavu, koja se ne
		   menja" (owner, 11.08.2026), so a country sent beside one would be the portal
		   letting somebody put Belgrade in France. And half of the typed shape is not a town
		   either: a name with no country, or a country with no name. */
		if (fromTheCodebook == typedByHand || (typedByHand && (isNothing(city) || isNothing(country)))) {
			return Optional.of(Town.refusedWith(MeWriteApi.THE_TOWN_IS_NOT_SAID_ONCE));
		}

		if (fromTheCodebook) {
			return Optional.of(db.sql("select id from place where geonames_id = ?")
					.param(placeId).query(Long.class).optional()
					.map(one -> new Town(one, null, null, null))
					.orElseGet(() -> Town.refusedWith(MeWriteApi.THE_TOWN_IS_NOT_KNOWN)));
		}

		return Optional.of(db.sql("select id from country where code = ?")
				.param(country.strip()).query(Long.class).optional()
				.map(one -> new Town(null, city.strip(), one, null))
				.orElseGet(() -> Town.refusedWith(MeWriteApi.THE_TOWN_IS_NOT_KNOWN)));
	}

	/** Null, empty or nothing but spaces, which are one answer about a box nobody filled. */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}
}
