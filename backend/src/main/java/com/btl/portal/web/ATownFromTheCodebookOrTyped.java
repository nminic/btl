package com.btl.portal.web;

import com.btl.portal.domain.registration.WhatAFieldMeans;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * WHERE A MEMBER IS FROM: A ROW OF THE WORLD CODEBOOK, OR A NAME TYPED WITH ITS COUNTRY,
 * AND NEVER BOTH OR NEITHER.
 *
 * <p><b>The owner, 11.08.2026:</b> „Mesto se bira iz svetskog sifarnika i tada nosi svoju
 * drzavu, koja se ne menja; drzava se bira samo uz mesto upisano rukom." That is
 * {@code competitor_town_is_from_the_codebook_or_typed} and
 * {@code competitor_typed_town_names_its_country} in the schema, and one control on the
 * form.
 *
 * <p><b>WHY THIS IS A CLASS AND NOT A PRIVATE METHOD TWICE.</b> Two routes collect this
 * form: somebody registering himself ({@link RegistrationApi}) and the administration
 * entering a group off a paper consent ({@link CompetitorWriteApi#enter}, owner, PDL P8b,
 * 25.09.2026). {@link ATeamGoesWithItsLastMember} is this arrangement's precedent in this
 * very package and gives the reason in the same words the journal uses: written at each
 * route, one sentence has two homes „free to drift the day one is edited, and it is the
 * second home that is always the one nobody remembers to change".
 *
 * <p><b>IT IS ASKED AS A QUESTION AND NEVER LEFT TO THE INSERT.</b> A number nothing maps
 * and a country code nothing maps are both „no town", and both have to be refused BEFORE
 * the statement rather than by it: a foreign key that cannot be resolved is an error in
 * the middle of a transaction, and on PostgreSQL an error aborts the transaction, so the
 * refusal the route wants to answer with could not be written from there.
 *
 * <p><b>This is also the one field of the form {@code WhatAFieldMeans} cannot answer</b>,
 * which is why it is here and the rest of them are in {@code domain}: every other rule is
 * about the shape of what arrived, and this one is a question about the codebook.
 */
@Component
class ATownFromTheCodebookOrTyped {

	/** A town, once it is one: the codebook's row, or a name typed with its country. */
	record Town(Long placeId, String city, Long countryId) {
	}

	private final JdbcClient db;

	ATownFromTheCodebookOrTyped(JdbcClient db) {
		this.db = db;
	}

	/**
	 * The town, or nothing when what arrived is not one.
	 *
	 * @param placeId the number {@code /api/places} serves, which is GeoNames' own and NOT
	 *                {@code place.id} - the portal has never seen the latter and must not
	 *                start to
	 * @param country the two letter code {@code /api/countries} serves, with a town typed
	 *                by hand and never with one from the codebook
	 */
	Town of(Long placeId, String city, String country) {
		boolean fromTheCodebook = placeId != null;
		boolean typedByHand = !WhatAFieldMeans.isNothing(city)
				&& !WhatAFieldMeans.isNothing(country);

		if (fromTheCodebook == typedByHand) {
			return null;
		}

		if (fromTheCodebook) {
			/* AND THE COUNTRY IS NOT TAKEN FROM THE REQUEST, which is the owner's decision
			   of 11.08.2026: a town of the codebook „nosi svoju drzavu, koja se ne menja".
			   Accepting one alongside would be the portal letting somebody put Belgrade in
			   France. */
			if (!WhatAFieldMeans.isNothing(city) || !WhatAFieldMeans.isNothing(country)) {
				return null;
			}

			return db.sql("select id from place where geonames_id = ?")
					.param(placeId).query(Long.class).optional()
					.map(one -> new Town(one, null, null)).orElse(null);
		}

		return db.sql("select id from country where code = ?")
				.param(country.strip()).query(Long.class).optional()
				.map(one -> new Town(null, city.strip(), one)).orElse(null);
	}
}
