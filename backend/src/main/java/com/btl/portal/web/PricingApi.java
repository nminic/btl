package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * WHAT MEMBERSHIP COSTS, AND WHEN EACH PRICE IS THE ONE IN FORCE.
 *
 * <p><b>It is public, and that is a decision rather than a convenience.</b> The
 * owner, 04.08.2026, striking out the page that used to carry it: „I grupa i
 * strana su obrisane; <b>cene su javne u Clanu 14 Pravilnika</b>". The price list
 * is drawn under an article of the rulebook and nowhere else since then
 * ({@code PageSection.gallery = 'prices'}, ADL, 17.08.2026), and the rulebook is
 * the first entry of the navigation, which a visitor who is not signed in sees.
 * The processing fee is named in the same breath and in the same direction:
 * „Taksa se prikazuje <b>svima</b>, samo je ne placaju svi" (owner, 04.08.2026).
 *
 * <p><b>And ADL's P-javno does not say otherwise, which is worth writing down
 * because it reads as though it might.</b> „Javno je ono sto Clan 73 nabraja, i
 * nista vise" (owner, 13.09.2026) is a rule about a PERSON: it names the seven
 * resources that carry one - teams, comments, ducats, moderators, pairs,
 * verification, attendance - and Article 73 lists what a competition publishes
 * about a competitor. No row of {@code price_row} belongs to anybody. A price is
 * not somebody's fact, and the thing that rule was written to stop - a member's
 * fee basis, who brought him in, whether he has paid - is not in this table at
 * all.
 *
 * <p><b>What a visitor is told is not what a visitor is charged.</b> The owner,
 * 11.08.2026: „Posetiocu se ne naplacuje nikakva cena... Tek kad osoba popuni
 * prijavni formular formira se i cena i QR kod." That is about the AMOUNT OWED,
 * which is one row picked out of this list by a year of birth, a country and a
 * day, and which is {@code MembershipPrice} and a later increment. This resource
 * is the list itself, which is the thing somebody reads in order to decide
 * whether to fill the form in at all.
 *
 * <p><b>Seven rows and four kinds of row</b> (ADL A36 O12): four periods, one
 * level, one fee, one referral. The kind is what tells them apart rather than
 * four routes answering one question.
 *
 * <p><b>IN THE ORDER THE LIST WAS GIVEN, AND THE ORDER IS THE ANSWER.</b> The
 * price list is a table somebody reads from the top down: the selling year opens
 * on 1 October and the last of the four periods is the one that follows the new
 * year, so the order is a decision and not the alphabet. That is why
 * {@code sort_order} is a unique, deferrable column of V4 and not something
 * worked out here.
 */
@RestController
class PricingApi {

	private final JdbcClient db;

	PricingApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * One row of the price list: what it is called, what kind of row it is, when it
	 * applies, and what it costs on each of the two price lists.
	 *
	 * <p><b>{@code from} and {@code to} and not {@code dayFrom} and {@code dayTo},
	 * which is the name the portal reads by</b> ({@code PriceRow} in
	 * {@code data/pricing.ts}). {@code DucatApi} is the precedent and made the same
	 * move in the other direction, answering {@code id} where the column is
	 * {@code code}: a resource is named for the screen that reads it, not for the
	 * column it came out of.
	 *
	 * <p><b>They are a day of the YEAR, {@code MM-DD}, and never a date.</b> The list
	 * repeats (owner, 30.07.2026): membership for 2027 is sold until 30 September
	 * 2027, and on 1 October the same four periods open again for 2028. Written as
	 * dates it would be four rows that expire, and the portal would quietly stop
	 * having a price on a morning nobody was watching.
	 *
	 * <p><b>{@code kind} is answered although no field of {@code PriceRow} carries
	 * it, and it is not a field served on the chance it will be wanted.</b> The portal
	 * reads the kind today - it just reads it as FOUR SEPARATE CONSTANTS rather than
	 * as a column: {@code PRICES} is the periods, {@code JUNIOR_ROW} the level,
	 * {@code REFERRAL_ROW} the referral and {@code PROCESSING_FEE_EUR} the fee. A flat
	 * list without it could not be split back into those four, so a screen reading
	 * this resource could not draw the table it draws now. It is also what
	 * {@code MembershipPrice} - the rule already on main - filters by, in as many
	 * words: {@code "period".equals(row.kind())}.
	 *
	 * <p><b>{@code sortOrder} is NOT answered, and the order carries it instead.</b>
	 * The three codebooks written before this one all do the same and for the same
	 * reason: {@code PlaceApi} orders by {@code rank}, {@code CountryApi} by
	 * {@code sort_order}, {@code DucatApi} by {@code tier, id}, and not one of them
	 * answers with the key it sorted on. A position said twice - once by where a row
	 * is and once by a number on it - is two things to keep equal, and the day they
	 * disagree there is nothing to say which of them the reader should believe.
	 *
	 * <p><b>Three fields are null on some rows, and null is the answer rather than a
	 * stand-in for it.</b> A level, a fee and a referral are not sold in a window of
	 * the year, so they have no {@code from} and no {@code to}; only a period answers
	 * whether what it buys is ranked; and the fee is the one row with no dinar side,
	 * because there is no payment intermediary there to pay (PDL, 04.08.2026). V4
	 * holds all three as constraints in both directions. The portal's own type writes
	 * {@code ''} and {@code false} in those places, which is an artefact of a
	 * TypeScript field nobody made optional and not a decision anybody took, and
	 * copying it here would be answering „no period" and „not ranked" where the truth
	 * is „the question does not apply".
	 *
	 * @param key     the name the row is known by, unique across the list
	 * @param kind    one of {@code period}, {@code level}, {@code fee},
	 *                {@code referral}
	 * @param from    the day of the year the period opens, null on every other kind
	 * @param to      the day of the year it closes, null on every other kind
	 * @param eur     the euro amount, which every row has
	 * @param rsd     the dinar amount, null on the processing fee alone
	 * @param ranking whether what this buys carries a place in the standing, null on
	 *                every kind but a period
	 */
	record Price(String key, String kind, String from, String to,
			BigDecimal eur, BigDecimal rsd, Boolean ranking) {
	}

	@GetMapping("/api/pricing")
	List<Price> pricing() {
		/* THE AMOUNTS COME BACK AS THEY ARE STORED, `numeric(10,2)`, and nothing here
		   rounds them or narrows them to a whole number on the way out. Every amount on
		   the list happens to be whole today; the schema does not say it has to stay
		   that way, and a price is the one number on this portal that must not change
		   shape on the way to the person paying it. ADL A12: an amount is numeric and
		   never a float. */
		return db.sql("select key, kind, day_from, day_to, eur, rsd, ranking"
						/* AND IN THE ORDER SOMEBODY DECIDED. Ordered by the key the list would
						   come out alphabetically, which puts the junior level between `early`
						   and `late`; ordered by the amount it would open with the processing
						   fee. Both are orders nobody chose. `sort_order` is the one that was
						   chosen, and `PricingApiTest` moves a row to the FRONT of it so that
						   this line cannot be confused with the order the rows were inserted in
						   - which, against V4's seven rows alone, is the same answer - nor with
						   no order at all, which a moved row would otherwise have agreed with
						   too. That comment is worth its length: the first draft of that case
						   moved a row to the end instead, and dropping this whole clause left
						   the suite green. */
						+ " from price_row order by sort_order")
				.query((row, one) -> new Price(row.getString(1), row.getString(2),
						row.getString(3), row.getString(4),
						row.getBigDecimal(5), row.getBigDecimal(6),
						row.getObject(7, Boolean.class)))
				.list();
	}
}
