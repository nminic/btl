package com.btl.portal.web;

import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Optional;

/**
 * CHANGING WHAT A ROW OF THE PRICE LIST COSTS, AND NOTHING ELSE ABOUT IT.
 *
 * <p>The writing half of {@link PricingApi}, which has answered {@code price_row} since the
 * codebooks went in while nothing at all wrote it. Until this increment the administration's
 * price screen edited a copy held in the browser, so a price the owner changed lived exactly
 * as long as the visit.
 *
 * <p><b>THERE IS ONE ROUTE AND ONE VERB, AND THAT IS THE DECISION RATHER THAN A FIRST
 * INSTALMENT.</b> Owner, 30.07.2026 (PDL:827): „<b>Periodi su stalni: redovi se ne dodaju i
 * ne brisu, menjaju se samo cene i nazivi perioda.</b> Peti red bi morao da padne unutar
 * nekog od cetiri, a oduzet red bi ostavio deo godine bez cene. Zato cenovnik <b>izlazi iz
 * entiteta</b> i stoji pored odeljaka u administraciji: odeljak Entiteti je za ono sto se
 * kreira i brise." So there is no {@code POST} and no {@code DELETE} here, and their absence
 * is measured rather than asserted: {@code PricingWriteApiTest} asks for both and requires
 * the answer an address that is not there gives.
 *
 * <p><b>AND EVERY ROUTE THAT WRITES CARRIES THE COUNT WITH IT.</b> „Redovi se ne dodaju i ne
 * brisu" is a sentence about the whole table, not about one request, so each case that writes
 * anything reads the seven keys in their order before and after. A row that went missing on
 * one path and not on another is what a single case about counting would not have seen.
 *
 * <p><b>WHO MAY: the tick, and the refusal is 404.</b> „Cenovnik" is one of the seven
 * entities of the administration (PDL P28a, owner 06.08.2026, confirmed 11.08.2026), so the
 * box is {@code entity:pricing} - the code {@code admin_right} generates for the row V5
 * writes. A moderator without it and a competitor are both answered exactly what a price row
 * that does not exist is answered; somebody who is not signed in is asked to sign in, which
 * is the one place that answer is not 404 (ADL A8, owner 13.09.2026: neprijavljen 401,
 * prijavljen bez prava <b>404</b>, nikad 403).
 *
 * <p><b>A PRICE CHANGED HERE CANNOT MOVE A PAYMENT, AND THAT IS THE SCHEMA'S SENTENCE RATHER
 * THAN A STATEMENT WRITTEN BELOW.</b> Owner, 25.09.2026 (PDL P12a): izmena reda cenovnika
 * <b>ne dira uplate koje su vec evidentirane</b>, and in his own words beside the choice:
 * „necu praviti izmene cenovnika u periodu placanja. Cenovnik se menja u septembru (recimo
 * 2027) za naredni prijavni ciklus". V16 provided for it before the decision was taken and
 * says so in its own heading: „WHAT IT COSTS IS NOT COPIED HERE but pointed at ... The AMOUNT
 * is copied, <b>because a price list is edited and what somebody actually paid must not move
 * when it is</b>". {@code payment} carries {@code amount}, {@code currency} and {@code fee}
 * of its own beside {@code price_row_id}, so <b>no migration is needed for P12a and none is
 * written</b>. What holds it is not this paragraph: the cases keep one payment on the row
 * that is changed and record another on the same row afterwards, and require the two to
 * disagree.
 *
 * <p><b>WHAT THIS ROUTE DELIBERATELY DOES NOT WRITE, each named rather than discovered.</b>
 *
 * <ul>
 * <li><b>The period.</b> {@code day_from} and {@code day_to} are the year itself, and the
 * four of them tile it with no gap and no overlap ({@code PriceListRowsTest}). „Menjaju se
 * samo cene i nazivi perioda" does not include the window, and a window moved through a form
 * is a stretch of the year with two prices or none.
 * <li><b>The kind, the right to be ranked, the key and the order.</b> None of them is a
 * price. The order in particular is a decision somebody took (see {@link PricingApi}), and
 * the statement below cannot reach it.
 * <li><b>The NAME of the period, which is the other half of the owner's own sentence and is
 * PLANNED rather than missing.</b> {@code price_row} has no column for it today: the six
 * names a reader sees stand in {@code frontend/src/i18n/sr.json} under
 * {@code pricing.rows.*}, and the form ({@code admin-cena.form.json}) asks for one as
 * {@code label}. <b>Owner, 25.09.2026: the name becomes a COLUMN, which he edits from the
 * administration - and it arrives together with the pricing screen and not before.</b> So
 * this route gains a third field on that day; it does not have one now because a column
 * written before the screen stopped reading the dictionary would be two homes for one name,
 * and the screen is another branch's.
 * <li><b>Telling anybody.</b> Nothing here writes a row into {@code message}. <b>That is my
 * reading of the precedent and not a decision anybody recorded:</b> {@link LeagueWriteApi}
 * and {@link EventWriteApi} both say in as many words that they notify nobody, and no entry
 * of PDL or ADL asks for a price change to be announced.
 * <li><b>Settling who wins when two administrators save at once.</b> The later statement
 * wins, which is what one {@code update} of one row does. <b>My reasoning, marked as such:</b>
 * nothing in the journals speaks to it, and a price list edited by two people in the same
 * second is not a state this portal has to arbitrate.
 * </ul>
 */
@RestController
class PricingWriteApi {

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** Negative, or with more para than the column keeps, or past what it can hold. */
	static final String THE_AMOUNT_IS_NOT_KEPT_EXACTLY = "theAmountIsNotKeptExactly";

	/** V4's {@code price_row_only_fee_has_no_rsd}, said as a sentence. See {@link #change}. */
	static final String THE_FEE_HAS_NO_DINAR_PRICE = "theFeeHasNoDinarPrice";

	/** PDL P16, owner 16.08.2026: „posle 1. oktobra u 00:00 CET iznos za tu godinu stoji". */
	static final String THE_REFERRAL_IS_SETTLED_FOR_THE_COMING_SEASON =
			"theReferralIsSettledForTheComingSeason";

	/**
	 * THE TWO KINDS OF ROW THIS ROUTE TREATS DIFFERENTLY, AND THEY ARE KINDS AND NEVER KEYS.
	 *
	 * <p>V4's {@code price_row_kind_known} is the list of the four there are, and the kind is
	 * what the schema itself uses to tell the rows apart (ADL A36 O12). Asked by KEY instead,
	 * this class would hold {@code "processing"} and {@code "referral"} - two spellings of
	 * rows, where the schema already carries the classification. {@code MembershipPrice} asks
	 * the same question the same way ({@code "period".equals(row.kind())}).
	 *
	 * <p>The floor under both is {@code aKindNamedInTheRouteIsTheKindOfExactlyOneKnownRow},
	 * which ties each of them to the row {@link MembershipPrice} already names and requires it
	 * to be the only one of its kind - so a kind renamed in a migration fails loudly instead
	 * of quietly letting through the one thing this class believes it refuses.
	 */
	static final String A_FEE = "fee";

	static final String A_REFERRAL = "referral";

	private final JdbcClient db;

	/**
	 * The moment, off the bean rather than off {@code ZonedDateTime.now()}, for the reason
	 * {@code WhatTimeItIs} gives: both sides of 1 October have to be measurable on a day that
	 * is not 1 October.
	 */
	private final Clock clock;

	PricingWriteApi(JdbcClient db, Clock clock) {
		this.db = db;
		this.clock = clock;
	}

	/**
	 * WHAT THE FORM SENDS: two amounts, and there is nothing else on it that this route may
	 * write.
	 *
	 * <p>{@code admin-cena.form.json} asks for three fields - {@code label}, {@code eur} and
	 * {@code rsd} - and the first has nowhere to go yet; see the boundary at the head of this
	 * class. The euro price is required here as it is there, and the dinar price is required
	 * on every row that HAS one, which is six of the seven: see {@link #change}.
	 *
	 * <p><b>Two amounts and never one with a rate on it.</b> Owner (PDL:833): „Dinarski
	 * cenovnik je fiksiran za sezonu, po kursu 1 EUR = 120 RSD. <b>Ne preracunava se po kursu
	 * na dan.</b>" So the dinar price is entered, not worked out, and nothing here multiplies
	 * anything by anything.
	 */
	record Amounts(BigDecimal eur, BigDecimal rsd) {
	}

	/** Why something could not be written. */
	record Refused(String reason) {
	}

	/**
	 * The row as it now stands, read back out of the statement that wrote it.
	 *
	 * <p>Not the numbers that arrived: {@code returning} answers what {@code numeric(10,2)}
	 * holds, so an amount that lost something on the way in says so in the answer rather than
	 * in a member's invoice a month later.
	 */
	record Written(String key, BigDecimal eur, BigDecimal rsd) {
	}

	/**
	 * CHANGING ONE ROW'S TWO AMOUNTS.
	 *
	 * <p><b>The row is named by its KEY and not by a number</b>, which is where this parts
	 * from {@link LeagueWriteApi} and follows {@code DucatApi} instead. {@code GET
	 * /api/pricing} answers no {@code id} at all - a price row has one, and no reader has
	 * ever needed it - and the screen keeps its rows under the key ({@code entityForms.ts},
	 * {@code idField: 'key'}). Serving the id so that it could be typed back would be adding
	 * a field to the READ in order to write, and {@code price_row_key_unique} already says
	 * the key names one row.
	 *
	 * <p><b>THE ORDER OF THE REFUSALS IS CHOSEN.</b> What is wrong with the ROW comes before
	 * what is wrong with the FORM, because the two send an administrator to different places:
	 * a form he can correct, and a row this route will not write however he fills it in.
	 * Answering „the form is not complete" for the referral in October would send him to fix
	 * the one thing that is not the problem. The same order {@link LeagueWriteApi#change} uses
	 * for a frozen season.
	 *
	 * <p><b>AND THE ORDER WITHIN THE FORM CARRIES A 500, which was measured rather than
	 * reasoned.</b> Whether an amount is THERE is asked before whether the column would KEEP
	 * it, because {@link MembershipPrice#amountIsKeptExactly} takes a number and not the
	 * absence of one. Run the two the other way round and a form with no dinar price on it
	 * comes back as {@code NullPointerException: Cannot invoke "BigDecimal.signum()" because
	 * "amount" is null} - a 500 on an administrator who has simply left a field empty. That is
	 * the mutation {@code aFormMissingEitherAmountIsRefusedAndNothingIsWritten} catches, and
	 * it is written down because an order that carries a fault reads like an order that
	 * carries nothing.
	 *
	 * <p><b>ALL SEVEN ROWS ARE WRITTEN HERE, INCLUDING THE FEE (owner, 25.09.2026).</b> He
	 * chose that the processing fee gets a button of its own with the dinar price left out,
	 * rather than being refused; the screen and the form that go with it are a later
	 * increment, and this route is deliberately ready before them.
	 *
	 * <p><b>AND THE DINAR PRICE IS REQUIRED ON SIX ROWS AND FORBIDDEN ON THE SEVENTH, IN BOTH
	 * DIRECTIONS.</b> {@code price_row_only_fee_has_no_rsd} is written as an equivalence -
	 * {@code (rsd is null) = (kind = 'fee')} - and so is this, because a fee with a dinar
	 * price and a period without one are two different faults and both would otherwise arrive
	 * as a 500. The same shape {@code RaceWriteApi} uses for a time limit that belongs to a
	 * timed race. There is no dinar side to the fee because there is no payment intermediary
	 * on that side to pay (PDL, owner 04.08.2026).
	 *
	 * <p><b>BOUNDARY: the fee cannot yet be reached from the SCREEN.</b>
	 * {@code admin-cena.form.json} still asks for {@code rsd} as a required field, so a form
	 * submitted as it stands today carries one and this route refuses it. That is the order
	 * the owner chose on 25.09.2026 - the route first, the form after - and it is written
	 * down so the next reader finds a plan rather than a fault.
	 *
	 * <p><b>AND THE REFERRAL IS REFUSED ONCE THE RENEWAL WINDOW HAS OPENED.</b> Owner,
	 * 16.08.2026 (PDL P16): „administrator podesava <b>do 1.10. u 00 po CET</b> za predstojecu
	 * godinu", and „posle 1. oktobra u 00:00 CET iznos za tu godinu stoji, i administrator ga
	 * menja samo za sledecu". Until this increment that was kept by a button the screen drew
	 * as settled, which is exactly what ADL A8 of 30.07.2026 refuses - „prava se sprovode na
	 * ruti, ne po ekranu" - so a request sent past the screen wrote it anyway. The moment is
	 * {@link SeasonClock#referralMayBeSet} and is not worked out here.
	 *
	 * <p><b>BOUNDARY, AND IT IS THE MORE IMPORTANT HALF: this deadline closes ONE half of that
	 * decision and the other stays open ON PURPOSE (owner, 25.09.2026).</b> „Posle 1. oktobra
	 * se ne dira" is what the refusal below enforces. „Menja se samo za sledecu" cannot be
	 * enforced at all today, and that was measured rather than felt: {@code price_row} holds
	 * <b>one</b> referral amount with <b>no season on it</b>, so a change made in, say, March -
	 * which this route allows, because the window is shut - moves the amount standing over the
	 * season that is RUNNING as well as the one being prepared. The cost was put to the owner
	 * and he took it, deciding that an amount per season is its own later increment. A
	 * reviewer need not spend a round on it: it is open because it was decided to be.
	 *
	 * <p><b>Two statements and no transaction, which is a decision.</b> The kind is read, then
	 * the row is written. Nothing on this portal ever writes {@code price_row.kind} - this
	 * route is the only thing that writes the table at all, and it cannot reach that column -
	 * so there is no second answer for the two statements to disagree about. Two administrators
	 * saving at once is the case at the head of this class: the later statement wins, and a
	 * transaction would not change that.
	 */
	@PutMapping("/api/pricing/{key}")
	@RightIsNeeded("entity:pricing")
	ResponseEntity<?> change(@PathVariable String key, @RequestBody Amounts typed) {
		Optional<String> kind = db.sql("select kind from price_row where key = ?")
				.param(key).query(String.class).optional();

		/* THE SAME ANSWER SOMEBODY WITHOUT THE TICK GETS, which is ADL A8 applied to a row
		   rather than to a route, and the shape `LeagueWriteApi.change` carries. */
		if (kind.isEmpty()) {
			return no(HttpStatus.NOT_FOUND, null);
		}

		boolean theFee = A_FEE.equals(kind.get());

		if (A_REFERRAL.equals(kind.get())
				&& !SeasonClock.referralMayBeSet(clock.instant().atZone(SeasonClock.ZONE))) {
			return no(HttpStatus.CONFLICT, THE_REFERRAL_IS_SETTLED_FOR_THE_COMING_SEASON);
		}

		/* THE EURO PRICE IS ON EVERY ROW AND THE DINAR PRICE IS ON SIX OF THE SEVEN, so an
		   absent dinar price is a form that is not finished everywhere except on the fee. */
		if (typed.eur() == null || (typed.rsd() == null && !theFee)) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		/* AND THE OTHER DIRECTION, WHICH IS A DIFFERENT FAULT AND THEREFORE A DIFFERENT
		   SENTENCE. A dinar price sent for the fee is not an unfinished form - it is a price
		   for a payment nobody makes in dinars - and it would arrive as a 500 off
		   `price_row_only_fee_has_no_rsd` rather than as something an administrator can act
		   on. Two sentences rather than one, because they send him to two different places;
		   the shape `RaceWriteApi` uses for a limit that belongs to a timed race. */
		if (theFee && typed.rsd() != null) {
			return no(HttpStatus.BAD_REQUEST, THE_FEE_HAS_NO_DINAR_PRICE);
		}

		/* WHAT `price_row_eur_not_negative` WOULD SAY AS A 500, SAID AS A SENTENCE - and one
		   thing besides, which no constraint can say at all. A price with more para than
		   `numeric(10,2)` keeps is not refused by PostgreSQL, it is ROUNDED, so 41.125 would
		   be stored as 41.13 and the portal would quietly have changed a price nobody typed.
		   `RaceWriteApi` refuses a distance for that same reason and in those same words; the
		   scale and the ceiling are the column's own and are rebuilt from the catalogue by
		   `AnAmountMatchesTheSchemaTest`.

		   The dinar price is asked about only where there is one, which is the same six rows
		   the sentence above is about and never the fee. */
		if (!MembershipPrice.amountIsKeptExactly(typed.eur())
				|| (!theFee && !MembershipPrice.amountIsKeptExactly(typed.rsd()))) {
			return no(HttpStatus.BAD_REQUEST, THE_AMOUNT_IS_NOT_KEPT_EXACTLY);
		}

		/* `single()` AND NOT `optional()`, WHICH IS A STATEMENT ABOUT WHAT CAN HAPPEN HERE.
		   The row was found one statement ago and nothing on this portal deletes from this
		   table - there is no route that does, and V16's `payment_price_row_fk` is
		   `on delete restrict` besides. The only way to reach no row is a DELETE run by hand
		   against the database, and a 500 is the right answer to that rather than a sentence
		   pretending it was the caller's form. `PaymentApi` asks this table the same way.

		   THE DINAR PRICE IS WRITTEN AS IT ARRIVED, INCLUDING WHEN IT IS ABSENT. On the fee
		   that is a null, which is what `price_row_only_fee_has_no_rsd` requires of that row
		   and forbids on every other; a branch here would be a second answer to a question the
		   two refusals above have already settled, and the day the two disagreed the schema
		   would win silently. The cast is what tells PostgreSQL which kind of null it is being
		   handed, since a parameter carries no type of its own. */
		return db.sql("update price_row set eur = ?, rsd = cast(? as numeric)"
						+ " where key = ? returning eur, rsd")
				.params(typed.eur(), typed.rsd(), key)
				.query((row, one) -> ResponseEntity
						.ok(new Written(key, row.getBigDecimal(1), row.getBigDecimal(2))))
				.single();
	}

	/**
	 * A refusal, with a reason where there is one to give.
	 *
	 * <p>404 carries no body, which is the shape {@link RightsAtTheDoor} answers a refused
	 * moderator with: a price row somebody may not touch and one that is not there have to
	 * read the same, and a reason is something only one of them could have.
	 */
	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return reason == null ? ResponseEntity.status(status).build()
				: ResponseEntity.status(status).body(new Refused(reason));
	}
}
