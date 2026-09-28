package com.btl.portal.web;

import com.btl.portal.domain.pricing.Currency;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * WHICH MONEY ONE MEMBER IS BILLED IN, ASKED OF THE DATABASE IN ONE PLACE.
 *
 * <p>{@link Currency#of} holds the RULE - Serbia means dinars, everywhere else euro (owner,
 * 27.09.2026, PDL 25) - and this holds the one READING of a member's country that the rule is applied
 * to. The two are split because the rule is a decision and the reading is a join, and the join is the
 * part that is easy to get subtly wrong.
 *
 * <p><b>AND THE WAY IT IS EASY TO GET WRONG IS MEASURED, WHICH IS WHY THIS IS A CLASS AND NOT A
 * LINE.</b> A member's country arrives by one of TWO roads and never both: {@code
 * competitor_town_is_from_the_codebook_or_typed} and {@code competitor_typed_town_names_its_country}
 * (V7) put it either on {@code place_id}, pointing into the town codebook, or on {@code country_id}
 * beside a town he typed by hand. A reading that asked {@code competitor.country_id} alone would
 * answer nothing for every member who picked his town out of the codebook - which is most of them and
 * all of the quiet ones - and „nothing" is not Serbia, so every one of them would be billed in euro.
 * {@code coalesce} over both is the reading {@link PaymentsDueApi} already does inline for the screen,
 * and its own cases reach the currency through a codebook town AND through a typed one for exactly
 * this reason.
 *
 * <p><b>WHO ASKS, and why {@link PaymentsDueApi} is not among them.</b> {@link BalanceBook} needs it
 * to write a line in the right money and to sum the right rows; {@link MembershipInvoice} needs it to
 * read the right column of the price list; {@link PaymentApi} needs it to know what the moderator's
 * typed amount is in; and {@link MeWriteApi} needs it twice, before and after, to see whether a member
 * editing his own record has changed the money he is billed in. {@code PaymentsDueApi} already selects
 * the country for every row of its screen and hands it straight to {@link Currency#of}: asking here as
 * well would be one statement per row of a list, which is the thing {@code BalanceBook}'s own bulk
 * reading exists to avoid.
 */
@Component
class CurrencyOfMember {

	private final JdbcClient db;

	CurrencyOfMember(JdbcClient db) {
		this.db = db;
	}

	/**
	 * <p><b>A missing competitor throws rather than answering a default</b>, which is
	 * {@code single()}'s own behaviour and is kept: every caller has already established that the
	 * member exists - {@code PaymentApi} refuses {@code THE_COMPETITOR_DOES_NOT_EXIST} before it gets
	 * here, and the rest are about the caller himself - so an empty answer means a route asked about
	 * somebody it never checked, and billing him in euro would be the wrong way to find that out.
	 *
	 * @param competitorId {@code competitor.id}
	 */
	Currency of(long competitorId) {
		return Currency.of(db.sql("select coalesce(town_country.code, typed_country.code)"
						+ " from competitor c"
						+ " left join place town on town.id = c.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = c.country_id"
						+ " where c.id = ?")
				.param(competitorId)
				.query(String.class)
				.single());
	}
}
