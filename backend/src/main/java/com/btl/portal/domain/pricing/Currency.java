package com.btl.portal.domain.pricing;

import java.util.Objects;

/**
 * WHICH MONEY ONE MEMBER IS BILLED IN, AND THE ONLY PLACE THE COUNTRY DECIDES IT.
 *
 * <p><b>Owner, 27.09.2026 (PDL, section 25):</b> „balans je uvek u valuti zavisno od drzave.
 * Ukoliko je Srbija, to su dinari, ukoliko nije to su evri za sada." And in section 19, about the
 * field the moderator types an amount into: „Prazno polje sa oznakom valute pored njega. Valuta
 * <b>zavisi od zemlje clana</b>."
 *
 * <p><b>WHY THIS EXISTS AT ALL, WHICH IS A MEASUREMENT AND NOT TIDINESS.</b> Before this class the
 * rule had two homes and was about to have four. {@code PaymentsDueApi} held it as a private
 * {@code BILLED_IN_DINARS = "RS"} beside a pair of currency literals, and it was the only place
 * asking. The book of balance now needs the same answer to know which column of the pair survives,
 * the invoice needs it to know which column of the price list applies, and the route that changes a
 * member's country needs it twice - before and after - to know whether anything changed at all. Four
 * copies of one sentence are four places free to stop agreeing on the day somebody adds a third
 * country that pays in dinars.
 *
 * <p><b>THE NAMES ARE THE SCHEMA'S OWN WORDS, AND THAT IS DELIBERATE RATHER THAN CONVENIENT.</b>
 * {@code payment_currency_known} (V16), {@code balance_entry_currency_known} and
 * {@code balance_promise_currency_known} (V42) all read {@code in ('EUR', 'RSD')}, so
 * {@link #name()} is what goes into the column and what comes back out of it. This is the opposite
 * choice from {@code GrantingAMembership.Ground}, which deliberately does NOT carry
 * {@code membership_basis_known}'s literals - and the difference is worth stating because the two
 * look alike. A ground is a BUTTON that was pressed and the schema's word for it is the route's
 * business; a currency is a VALUE that travels with an amount through the domain, into the database
 * and out to a screen, and giving it a second spelling on the way would mean a translation table
 * whose two halves can disagree. What stops the two spellings drifting is not this sentence but
 * {@code CurrencyTest.everyCurrencyIsAWordTheSchemaKnows}, which reads the words out of
 * {@code pg_constraint} rather than comparing one written copy against another.
 *
 * <p><b>AND „ZA SADA" IS THE OWNER'S OWN WORD, so the boundary is his and is named rather than
 * discovered:</b> everybody outside Serbia pays in euro today. A member in a third currency would
 * need a decision, not a case, and the shape that asks for one is {@link #of} answering EUR to every
 * country it does not know - which is the answer the portal already gives and the one the price list
 * is built for.
 */
public enum Currency {

	/** Everybody outside Serbia, „za sada" (owner, 27.09.2026). */
	EUR,

	/** Serbia. */
	RSD;

	/**
	 * The country whose members are billed in dinars, as {@code country.code} spells it (V2, ISO
	 * 3166-1 alpha-2).
	 *
	 * <p>A literal because it IS a literal: the code of a row in a codebook, the same kind of thing
	 * {@code BalanceBook.REFERRAL} is and for the reason given there. What keeps it honest is
	 * {@code CurrencyTest.dinarsAreTheCountryTheCodebookCallsSerbia}, which asks the {@code country}
	 * table for the row rather than trusting these two letters.
	 */
	private static final String BILLED_IN_DINARS = "RS";

	/**
	 * WHICH MONEY A MEMBER OF THIS COUNTRY IS BILLED IN.
	 *
	 * <p><b>Every country that is not Serbia answers euro, INCLUDING ONE NOTHING MAPS, and that is
	 * reasoning whose cost is stated rather than a hole.</b> The alternative - refusing a country
	 * the portal has no rule for - would mean a member whose town resolves to somewhere unexpected
	 * gets an exception instead of an invoice, on a route a moderator is working through a list. The
	 * owner's sentence has exactly two branches („Ukoliko je Srbija ... ukoliko nije") and this is
	 * both of them; a third currency is a decision he has not made, and the day he makes it this
	 * method is the one place it lands.
	 *
	 * <p><b>A null country cannot arrive, and the schema is what says so rather than this
	 * method.</b> {@code place.country_id} is {@code not null} (V3) and
	 * {@code competitor_typed_town_names_its_country} (V7) makes the typed country present exactly
	 * when the typed town is, so of the two homes one always answers. It is still refused here
	 * rather than quietly treated as „not Serbia", because a null reaching this point means the
	 * caller's query lost the join and the honest answer is to say so loudly instead of billing him
	 * in euro.
	 *
	 * @param countryCode {@code country.code}, two letters
	 */
	public static Currency of(String countryCode) {
		Objects.requireNonNull(countryCode, "countryCode");

		return BILLED_IN_DINARS.equals(countryCode) ? RSD : EUR;
	}

	/**
	 * Whether this is the euro side of the price list, for {@link MembershipPrice#on}.
	 *
	 * <p>The price list publishes two columns on one row and a price is read out of one of them
	 * ({@code price_row.eur}, {@code price_row.rsd}), which is the only question this answers. It is
	 * a method rather than each caller writing {@code == EUR} so that a third currency arriving one
	 * day fails to compile here instead of quietly falling on the dinar side of a ternary.
	 */
	public boolean isEuro() {
		return this == EUR;
	}
}
