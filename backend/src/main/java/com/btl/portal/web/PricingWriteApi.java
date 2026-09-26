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
 * CHANGING WHAT A ROW OF THE PRICE LIST IS CALLED AND WHAT IT COSTS, AND NOTHING ELSE ABOUT IT.
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
 * <p><b>BOUNDARY, AND IT IS THE ONE THAT DECIDES WHETHER THIS MAY BE RELEASED: A PRICE SET
 * HERE CHANGES WHAT IS CHARGED AND NOT WHAT IS SHOWN.</b> The amount has <b>four</b> homes
 * today, and only one of them is this table:
 *
 * <ol>
 * <li>{@code price_row} (V4), which is what {@code PaymentApi} books from
 * ({@code PaymentApi.priceRows}) and the only home this route can reach;
 * <li>{@code frontend/src/data/pricing.ts} ({@code PRICES}, {@code JUNIOR},
 * {@code REFERRAL}, {@code PROCESSING_FEE_EUR}), which is what {@code PriceTable} draws,
 * what {@code Membership} quotes, and - through {@code data/paymentQr.ts} - <b>what the IPS
 * QR code a member scans carries</b>;
 * <li>{@code backend/tools/generate_reference_migrations.py} ({@code PRICE_ROWS}), copied
 * by hand, which the file itself says out loud because {@code pricing.ts} is TypeScript and
 * not data;
 * <li>{@code PriceListRowsTest}, a fourth written list, deliberately read from the decision
 * rather than from the generator.
 * </ol>
 *
 * <p><b>So until a screen reads {@code GET /api/pricing} instead of the bundled constant, an
 * administrator who raises a price here raises what the next member is CHARGED while the
 * page he reads and the code he scans still say the old number.</b> That is a gap in the
 * product and not a fault in this class, and it is written here because it is the reason
 * this route is ready before the screen rather than after it (owner, 25.09.2026, PDL P12b:
 * the pricing screen is its own increment). {@code ThePriceListHasOneHomeTest} holds homes
 * 1 and 2 to each other as the repository stands, so the two cannot part company in the
 * SOURCE; <b>nothing on this side can see them part at RUN TIME</b>, because every test
 * starts from a database V4 has just written. Naming it is all this side can do.
 *
 * <p><b>AND THE NAME HAS THE SAME SHAPE OF GAP, WITH TWO HOMES INSTEAD OF FOUR, AND IT IS THE
 * COST THE OWNER WAS SHOWN BEFORE HE CHOSE THIS ORDER.</b> PDL:8122 said what it would be in
 * as many words: „dodavanje kolone pre ekrana daje nazivu <b>dva doma</b> dok ekran jos cita
 * recnik." The two are {@code price_row.label} (V34), which this route writes and
 * {@code GET /api/pricing} serves, and {@code frontend/src/i18n/sr.json} under
 * {@code pricing.rows.*}, which {@code PriceTable} and {@code AdminPricing} read out of the
 * bundle. On 26.09.2026 the owner settled that the column comes first and the screen follows,
 * because without the column the screen can change the amounts of six named rows and
 * <b>cannot give the processing fee a button at all</b> - the dictionary has no name for it -
 * so the second half of P12b could not be carried out either way round.
 * {@code TheRowNameHasOneHomeTest} holds the two equal in the repository and fails the day one
 * of them is edited alone. It cannot see them part at run time, for the reason above.
 *
 * <p><b>WHAT THIS ROUTE DELIBERATELY DOES NOT WRITE, each named rather than discovered.</b>
 *
 * <ul>
 * <li><b>The period, which is the one half of the owner's sentence that is NOT written here and
 * is easiest to lose now that the other half is.</b> „Menjaju se samo cene i <b>nazivi
 * perioda</b>" names the price and the NAME; it does not name the days. {@code day_from} and
 * {@code day_to} are the year itself, and the four of them tile it with no gap and no overlap
 * ({@code PriceListRowsTest}), so a window moved through a form is a stretch of the year with
 * two prices or none. Renaming „1. do 5. oktobra" to something else is therefore allowed here
 * and moving the fifth of October is not, and those are two different facts wearing one word.
 * <li><b>The kind, the right to be ranked, the key and the order.</b> None of them is a
 * price and none of them is a name. The key in particular is what a row is IDENTIFIED by and
 * the label is what it is CALLED - {@code PUT} takes the first in the address and writes the
 * second in the body, and they are never the same field. The order is a decision somebody took
 * (see {@link PricingApi}), and the statement below cannot reach it.
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

	/**
	 * Above 1.000 EUR or 200.000 RSD, which is PDL P12c said as a sentence.
	 *
	 * <p><b>Its own sentence and not {@link #THE_AMOUNT_IS_NOT_KEPT_EXACTLY}</b>, because
	 * the two send an administrator to two different places: one says „that number does not
	 * fit in this column, take a para off it" and this says „that is more than a membership
	 * may cost". 1.500 EUR is a perfectly good {@code numeric(10,2)}.
	 */
	static final String THE_AMOUNT_IS_MORE_THAN_A_ROW_MAY_COST = "theAmountIsMoreThanARowMayCost";

	/** V4's {@code price_row_only_fee_has_no_rsd}, said as a sentence. See {@link #change}. */
	static final String THE_FEE_HAS_NO_DINAR_PRICE = "theFeeHasNoDinarPrice";

	/**
	 * More characters in the name than the box an administrator types it into will hold.
	 *
	 * <p><b>Its own sentence and not {@link #THE_FORM_IS_NOT_COMPLETE}</b>, for the reason the
	 * ceiling above is its own sentence: the two send an administrator to two different places.
	 * „Fill this in" and „shorten this" are not the same instruction, and a name of a hundred
	 * characters is a form he did fill in.
	 */
	static final String THE_NAME_IS_LONGER_THAN_THE_FORM_ALLOWS = "theNameIsLongerThanTheFormAllows";

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

	/**
	 * AS MANY CHARACTERS IN THE NAME AS THE FORM'S OWN BOX HOLDS, AND THE NUMBER IS <b>MINE</b>
	 * RATHER THAN THE OWNER'S.
	 *
	 * <p><b>Said first and plainly, because the paragraph beside it could be read the other
	 * way.</b> PDL P12c (25.09.2026) records that the owner accepted the two {@code max} figures
	 * of {@code admin-cena.form.json} - „Brojevi nisu novi nego oni koje je vlasnik vec prihvatio
	 * u formi (admin-cena.form.json, max 1000 i 200000)". It names {@code max}. It does
	 * <b>not</b> name {@code maxLength}, and no entry of PDL or ADL speaks to how long the name
	 * of a price row may be. Eighty is the number that file already carries on the {@code label}
	 * field; <b>applying P12c's reasoning to it is my reading and not his decision</b>, and it is
	 * marked here so the next reader does not cite it as one.
	 *
	 * <p><b>The precedent in this portal points both ways, so both are named.</b>
	 * {@link MeWriteApi#AS_LONG_AS_THE_FORM_ALLOWS} enforces a length on the route and can,
	 * because its figure is the owner's (PDL P11, 31.07.2026, 360 characters with the arithmetic
	 * beside it). {@link TeamWriteApi} deliberately left one out and wrote why: „the schema names
	 * no length at all ... Left out here rather than invented, so that the day it is enforced it
	 * is enforced in one place with a number somebody decided." What tips it here rather than
	 * there is where the text lands: a team's name is drawn on the team's own page, and this one
	 * is the first column of the price table published under Clan 14 of the rulebook, which
	 * {@code PricingApi} serves to a visitor who is not signed in. {@code text} in PostgreSQL has
	 * no length of its own (nothing in this schema does), so with no refusal here an
	 * administrator past the screen puts a paragraph in a table cell a visitor reads.
	 *
	 * <p><b>Written here and measured against the file, which is the floor under it.</b>
	 * {@code WhatARowIsCalledTest} walks {@code admin-cena.form.json} for every field carrying a
	 * {@code maxLength} and requires the answer to be exactly this one number on exactly this
	 * field - the arrangement {@code WhatAPriceMayCostTest} has for {@code max}. The day the box
	 * moves, the build stops until this moves with it.
	 *
	 * <p><b>Counted in the units the box counts in</b>, which is {@link String#length()}: HTML's
	 * {@code maxlength} is a code-unit length, so the server and the box agree about a text
	 * rather than nearly agreeing about it. <b>And measured over what is STORED</b>, after the
	 * name is stripped, so a full box ending in a space is not refused for a character that is
	 * thrown away before the row is written.
	 */
	static final int AS_LONG_AS_THE_FORM_ALLOWS = 80;

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
	 * WHAT THE FORM SENDS: a name and two amounts, and there is nothing else on it that this
	 * route may write.
	 *
	 * <p>{@code admin-cena.form.json} asks for exactly these three - {@code label},
	 * {@code eur} and {@code rsd} - and spells them as they are spelt here, because what
	 * arrives is a body that form builds. <b>All three are required here, as all three are
	 * required there</b>, with one exception that belongs to the ROW and not to the form: the
	 * dinar price is required on the six rows that HAVE one and forbidden on the seventh. See
	 * {@link #change}.
	 *
	 * <p><b>The name became a field of this record on the day it became a column</b> (V34,
	 * owner 25.09.2026, PDL P12b, 1). Until then the form drew a box with nowhere to send
	 * what was typed into it, and this record said so.
	 *
	 * <p><b>A name is NOT absent-means-leave-it-alone, which is the one thing worth saying
	 * about it.</b> {@link MeWriteApi} reads a missing field as „do not touch this" because
	 * ADL A54 asks it to, and this route does the opposite: a {@code PUT} of a price row
	 * states the whole row, the euro price has always been required whether or not it changed,
	 * and a name is no different. <b>My reasoning, marked as such:</b> nothing in the journals
	 * speaks to it, and the form sends all three fields on every save, so the choice costs an
	 * administrator nothing and keeps one shape for the body instead of two.
	 *
	 * <p><b>Two amounts and never one with a rate on it.</b> Owner (PDL:833): „Dinarski
	 * cenovnik je fiksiran za sezonu, po kursu 1 EUR = 120 RSD. <b>Ne preracunava se po kursu
	 * na dan.</b>" So the dinar price is entered, not worked out, and nothing here multiplies
	 * anything by anything.
	 */
	record TheForm(String label, BigDecimal eur, BigDecimal rsd) {
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
	 *
	 * <p><b>And the name for the same reason, which on the name is not hypothetical.</b> The
	 * text is stripped before it is written, so „  Rano  " goes in as „Rano" and the answer
	 * says „Rano". Read back out of {@code returning} rather than echoed from the request, so
	 * the screen redraws what the table now holds instead of what somebody typed.
	 */
	record Written(String key, String label, BigDecimal eur, BigDecimal rsd) {
	}

	/**
	 * CHANGING ONE ROW'S NAME AND ITS TWO AMOUNTS.
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
	 * <p><b>AND THE AMOUNT HAS A CEILING, WHICH THIS ROUTE ENFORCES AND THE FORM ONLY
	 * REPEATS.</b> Owner, 25.09.2026 (PDL P12c): 1.000 EUR and 200.000 RSD. <b>The reason it
	 * is here is a contradiction inside this very class, found by review:</b> the deadline
	 * two paragraphs down was deliberately moved onto the route on the strength of ADL A8
	 * („prava se sprovode na ruti, ne po ekranu"), while the amounts were just as
	 * deliberately left to {@code admin-cena.form.json} - so the same class enforced one
	 * screen's guard and trusted another. It is not theoretical: an amount written past the
	 * screen goes onto the price table a visitor READS and into every payment after it,
	 * which P12a then makes permanent. The two numbers are {@link MembershipPrice}'s, each
	 * currency against its own, and {@code WhatAPriceMayCostTest} reads the form off the
	 * working tree so the two homes the owner accepted cannot drift apart in silence.
	 *
	 * <p><b>AND A NAME THAT IS BLANK IS THE SAME FAULT AS A NAME THAT IS MISSING, WHICH IS ONE
	 * SENTENCE AND NOT TWO.</b> {@code LeagueWriteApi} settled this shape for a name a form
	 * requires - {@code isNothing}, which is {@code null || isBlank()}, answered with
	 * {@link #THE_FORM_IS_NOT_COMPLETE} - and the reason it is one sentence is that both send an
	 * administrator to the same box: a required field with nothing in it. „   " is not a name,
	 * and {@code price_row_label_not_blank} (V34) would otherwise answer it with a 500.
	 *
	 * <p><b>SPACES AROUND A NAME ARE NOT A BLANK NAME, AND THAT IS THE STATE THAT IS EASY TO
	 * LOSE.</b> „  Rano  " is a name and is written as „Rano", the same {@code strip()}
	 * {@code LeagueWriteApi} applies to a league's. Three states rather than two, and each has
	 * its own case, because a route that treated the third as the second would refuse a name for
	 * a space nobody can see.
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
	 * <p><b>AND THE DEADLINE SHUTS THE WHOLE REQUEST AND NOT ONLY THE AMOUNT, WHICH IS A
	 * QUESTION ABOUT MEANING AND THEREFORE DECIDED HERE RATHER THAN MEASURED.</b> PDL:8149
	 * speaks of the AMOUNT - „posle 1. oktobra iznos za tu godinu <b>stoji</b>" - and says
	 * nothing about the referral row's NAME, so both readings run green through the whole suite:
	 * that is the mark of a concept, and the rule of 28.08.2026 says a concept is settled before
	 * the code. <b>My reasoning, marked as such:</b> this address takes one {@code PUT} carrying
	 * one body, so letting the name through while refusing the amount would accept HALF a form,
	 * and there is no answer in any journal for what the screen should then redraw. <b>The cost
	 * it carries, said out loud:</b> from midnight in Belgrade on 1 October the referral row
	 * cannot be renamed either, until the window opens again. If that is ever wrong it is one
	 * condition on one line, and the case that holds it is written in both directions.
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
	ResponseEntity<?> change(@PathVariable String key, @RequestBody TheForm typed) {
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
		   absent dinar price is a form that is not finished everywhere except on the fee.

		   AND THE NAME IS ON EVERY ROW TOO, absent or blank alike: `isNothing` is
		   `LeagueWriteApi`'s, and both states are the same instruction to the administrator.
		   Asked HERE and not after the amounts, so that this one condition answers every way
		   the form can be unfinished with the one sentence that names it. */
		if (typed.eur() == null || isNothing(typed.label()) || (typed.rsd() == null && !theFee)) {
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

		/* AND WHAT A MEMBERSHIP MAY PLAUSIBLY COST, WHICH THE OWNER DECIDED ON 25.09.2026
		   AND THE COLUMN KNOWS NOTHING ABOUT. PDL P12c: the route refuses above 1.000 EUR
		   and 200.000 RSD. Until that decision this route took a membership fee of ninety
		   nine million, and the journal says why that was not theoretical: an amount written
		   past the screen goes onto the PUBLIC price table and into every payment after it,
		   where P12a makes it permanent.

		   EACH CURRENCY AGAINST ITS OWN CEILING, never one against the other's. The euro
		   ceiling applied to dinars refuses `late`, a price the list has carried since V4;
		   the dinar ceiling applied to euro lets 1.500 EUR through. Two named questions
		   rather than one taking a limit, so the pair cannot be handed over the wrong way
		   round - see `MembershipPrice` for the whole of that reasoning.

		   AFTER the question above and not before it, which is chosen. An amount is asked
		   whether the column KEEPS it before it is asked whether it is too much, so a
		   negative price and 41.125 keep the sentence they already had and 100.000.000 -
		   which fails both - keeps it too. The alternative would have moved an existing
		   answer while adding a new one, and a change that quietly restates old cases is a
		   change nobody measured. */
		if (!MembershipPrice.euroIsWithinWhatARowMayCost(typed.eur())
				|| (!theFee && !MembershipPrice.dinarsAreWithinWhatARowMayCost(typed.rsd()))) {
			return no(HttpStatus.BAD_REQUEST, THE_AMOUNT_IS_MORE_THAN_A_ROW_MAY_COST);
		}

		/* AND HOW LONG THE NAME MAY BE, WHICH IS `AS_LONG_AS_THE_FORM_ALLOWS` AND MY READING
		   RATHER THAN THE OWNER'S DECISION - see that constant for the whole of why.

		   LAST, AND THAT POSITION IS CHOSEN FOR THE REASON THE CEILING ABOVE GIVES FOR ITS OWN:
		   appended rather than inserted, so not one request that already had an answer gets a
		   different one. A form with no dinar price and a hundred-character name still answers
		   `theFormIsNotComplete`, exactly as it did yesterday, and a change that quietly
		   restates old cases is a change nobody measured.

		   MEASURED OVER WHAT WOULD BE STORED, hence after `strip()`: a name filling the box and
		   ending in a space is not refused for a character the statement below throws away. */
		if (typed.label().strip().length() > AS_LONG_AS_THE_FORM_ALLOWS) {
			return no(HttpStatus.BAD_REQUEST, THE_NAME_IS_LONGER_THAN_THE_FORM_ALLOWS);
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
		return db.sql("update price_row set label = ?, eur = ?, rsd = cast(? as numeric)"
						+ " where key = ? returning label, eur, rsd")
				.params(typed.label().strip(), typed.eur(), typed.rsd(), key)
				.query((row, one) -> ResponseEntity.ok(new Written(key, row.getString(1),
						row.getBigDecimal(2), row.getBigDecimal(3))))
				.single();
	}

	/**
	 * Nothing at all, whether that is no field or a field of spaces.
	 *
	 * <p>{@code LeagueWriteApi.isNothing} word for word, and it is copied rather than shared for
	 * the reason that file's own neighbours are: one class per resource, and a helper of three
	 * words pulled into a common place would tie two routes together so that a change to either
	 * one has to be reasoned about for both.
	 */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
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
