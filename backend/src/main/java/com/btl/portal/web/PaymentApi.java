package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.payment.RecordingAPayment;
import com.btl.portal.domain.payment.RecordingAPayment.Outcome;
import com.btl.portal.domain.pricing.Currency;
import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * SOMEBODY SAYING THE MONEY ARRIVED, WHICH IS ONE OF THE TWO THINGS THAT ACTIVATE A
 * MEMBERSHIP ON THIS PORTAL.
 *
 * <p><b>It was the only one until 27.09.2026 and this heading said so.</b> The other is
 * {@link MembershipWriteApi}: the association freeing somebody of the fee, which PDL:760
 * names in the same breath as this one („evidentirana uplata ILI [oslobodjenje]") and which
 * nothing could do until that day. The sentence below is unchanged and is still about this
 * route - there is no favourable PRICE - but „the only thing that ever activates a
 * membership" was the half that stopped being true, and it is worth saying which half: a
 * fee is still the only thing that activates one HERE.
 *
 * <p><b>Owner, on the one question this whole class exists to answer</b> (PDL,
 * 28.07.2026): „Povlascena cena ne postoji. Ako vlasnik nekome odobri povoljnije
 * uslove, regulise to van sistema. Jedino merilo je vlasnikova potvrda da je
 * clanarina izmirena, bez obzira na to da li je novac stvarno uplacen." There is no
 * bank integration here and none is coming: a moderator reads a statement or a
 * PayPal notice with his own eyes and says so, and this route is the one place that
 * saying happens. {@code queue:payments} is the tick that lets him, the same right
 * {@link VerificationApi} already reads the waiting list under.
 *
 * <p><b>Recognising a payment is the WHOLE of what this route decides, and the
 * decision is not written here.</b> {@link RecordingAPayment} already states it,
 * against exactly two facts - the state a payment for this person and this season
 * is in today, and whether he already carries a number - and is already proved
 * against the four outcomes it names. This class asks nothing else and repeats none
 * of it; it only reads the two facts off the database, asks, and carries out
 * whichever of the four answers comes back.
 *
 * <p><b>WHAT EACH OF THE THREE OUTCOMES DOES HERE:</b>
 *
 * <ul>
 * <li>{@link Outcome#RECORD_IT_AND_NUMBER_HIM} - the payment is written
 * {@code recorded}, a {@code membership} row is written beside it naming the receipt
 * (ADL A12), and LAST of all a number is drawn from {@link MemberNumbers} (a sequence
 * and never a query, for the reason V16 gives: a query reads what is there, and what
 * is there is missing exactly the people who left). Last, because a sequence is not
 * transactional and a number drawn before a row that the database then refuses is
 * spent for good - {@code recordIt} carries the whole of that reasoning and the
 * measurement behind it.
 * <li>{@link Outcome#RECORD_IT} - the same two rows, and the number already on the
 * competitor is kept exactly as it is (PDL, 11.08.2026: „Clanski broj ostaje zauvek
 * vezan za tu osobu... Ako se nekad ponovo aktivira postace mu i profil ponovo
 * vidljiv"). Renewing is not a second person.
 * <li>{@link Outcome#ALREADY_RECORDED} - nothing is written, and 200 answers with
 * the row that already stands. {@link RecordingAPayment}'s own javadoc: „Recording
 * the same payment twice must be harmless", and a moderator's second click on a row
 * that no longer waits is the human shape of the same bank statement imported
 * twice.
 * </ul>
 *
 * <p><b>A FOURTH STOOD HERE UNTIL 18.10.2026</b>, refusing with 409 a payment whose row said
 * {@code reversed}, on the ground that „a reversal is turned back by a person, not by an import".
 * The owner overturned the state that refusal was about (PDL P8, „Kad se osnov promeni iz „uplata”
 * ili se uplata stornira, zapis o uplati se BRIŠE.”, and the refusal „Storno vraća čovek, van ovog
 * ekrana.” is deleted with it), so a cancelled payment leaves no row for this route to find and V64
 * refuses the word. A member whose payment was cancelled is booked again as a renewal, keeping his
 * number (PDL P8, 14.09.2026).
 *
 * <p><b>AND SINCE 26.09.2026 THIS IS ALSO THE MOMENT A BALANCE IS SPENT, AND THE
 * ONLY ONE ON THIS ROAD.</b> The owner that day: „QR se kuje na iznos minus balans,
 * ali se balans <b>skida tek kad uplata bude proknjizena</b>. Ako clan ne plati,
 * balans mu ostaje." So nothing is taken off anybody's book while a payment is merely
 * expected; the line is written here, beside the {@code membership} row, or not at all.
 * The cost the owner was shown and accepted is that between minting a code and paying
 * it the balance still stands, so two codes can promise the same money twice - an open
 * boundary, named in PDL and not closed by this class.
 *
 * <p><b>WHAT THIS ROUTE DOES NOT DO IS REDUCE {@code payment.amount}.</b> The row keeps
 * the whole membership fee, because that is what he was CHARGED and ADL says an amount
 * comes off the price list; what the balance discharged is its own line in
 * {@code balance_entry}, and the cash that actually arrived is the difference between
 * them. Written the other way round - the reduced figure in {@code payment.amount} - the
 * books would show a membership sold for less than the price list says it costs, and
 * there would be nowhere to see that the association settled part of it out of what it
 * already owed the member.
 *
 * <p><b>AND IT IS WHERE A REFERRER GETS PAID.</b> PDL: „Iznos leže na balans automatski,
 * u trenutku kad se novom članu aktivira članarina, ne u trenutku registracije", and the
 * owner, 13.08.2026, that an honorary activation earns it too - so the condition is
 * activation and nothing about money. {@link MyMembershipWriteApi} carries the same call
 * for the same reason, because it is the other door to the same fact.
 *
 * <p><b>THE AMOUNT AND THE CURRENCY COME FROM THE PRICE LIST, NEVER FROM THE
 * REQUEST.</b> ADL A12: an amount is {@code numeric} and never a number written
 * into code - and the same sentence forbids a number typed into a form and taken on
 * trust. {@code currency} in the request says which of the association's two
 * accounts the money actually landed in, which is a fact about the bank statement
 * and not a price; what it is charged FOR is {@link MembershipPrice#on}, asked of
 * today's day of the year, this competitor's year of birth and the season being
 * paid for, exactly as {@link PricingApi} already reads the same seven rows for the
 * public list.
 *
 * <p><b>NOTHING HERE GATES ON THE ADDRESS BEING CONFIRMED, AND THE JOURNAL NO
 * LONGER HOLDS TWO ANSWERS TO WHY.</b> PDL 31.07.2026 once read „Dok adresa nije
 * potvrdjena, nema pristupa portalu ni placanja." PDL 11.08.2026 named this exact
 * case instead: „Clanstvo sme da se aktivira i pre nego sto je adresa potvrdjena...
 * Uplata sme da stigne pre nego sto covek klikne na vezu iz poruke, i to je ne
 * zaustavlja." The two stood side by side until PDL 18.09.2026 struck the „ni
 * placanja" half of the earlier entry and kept only „pristup portalu" on it, so
 * what follows is not this route quietly picking a side - it is the one the
 * journal itself now names. „Pristup portalu" is read as {@link SignInApi} reads
 * it - a login {@link com.btl.portal.domain.account.SignIn} refuses on an
 * unconfirmed account - because confirming a payment is a MODERATOR's action
 * against a bank statement; the paying member is never signed in to do it.
 *
 * <p><b>A SEASON SOMEBODY IS ALREADY A MEMBER OF IS REFUSED AND NOT WRITTEN OVER,
 * WHICH IS THE ONE THING THIS CLASS DECIDES THAT IS NOT ABOUT MONEY.</b> The
 * paragraph here used to say that a {@code membership} row on any basis but
 * {@code payment} „has no code path to reach today", so confirming a payment for such
 * a person „would collide with {@code membership_pk} rather than be decided by this
 * class", and that the day a screen granted one was the day the decision belonged
 * here. The mechanism of that collision was stated correctly and is worth keeping:
 * {@code write} reads {@code payment} and never {@code membership}, so a season held
 * on any other ground looks to it exactly like a season held by nobody, and
 * {@code recordIt} then meets the key and answers 500.
 *
 * <p><b>What changed is that the row is now legal AND about to have two writers,
 * which is why the guard is here before either of them.</b> {@code V22} allows
 * {@code feeExempt} with no payment named, so the state is one the schema invites
 * rather than one nothing can produce; a branch in flight adds {@code 'balance'} as a
 * third basis; and freeing a member of the fee is the increment this guard was
 * written alongside. Whichever of the three lands first, the 500 arrives with it.
 *
 * <p><b>It asks whether the KEY is taken and never what the basis IS, and both
 * reasons for that are measured rather than tidy.</b> First, the set of bases is
 * growing, so a guard written as „refuse when the basis is {@code feeExempt}" would
 * hand the same 500 back on the day {@code 'balance'} arrived - the instance closed
 * and the class left open. Second, {@code queue:payments} is not
 * {@code entity:members}, and PDL 28.07.2026 („Osnov clanstva se nikad ne prikazuje
 * javno... Vide ga samo Superadmin i moderatori sa pravom nad clanovima", PDL
 * 20.09.2026 adding the member himself) means the moderator working this queue may
 * not be told HOW a membership is held. So the refusal names that the season is
 * already held and nothing more, which is both the safe answer and the complete one.
 *
 * <p><b>Refused rather than written over, and that is a decision with a named
 * loser.</b> An {@code on conflict do update} here would let a recorded payment
 * silently replace a membership the board granted, and nothing would be left saying
 * the exemption had ever been there. By the owner's decision of 18.10.2026 a change of basis is
 * an option on the member's row in the moderation of the members (PDL P8, „Promene osnova na redu
 * člana idu u oba smera”), with a table of its own for the trail ({@code membership_change}, V63),
 * and never a side effect of booking money here.
 *
 * <p><b>WHAT IS DELIBERATELY NOT GUARDED HERE, EACH ONE NAMED RATHER THAN
 * DISCOVERED:</b>
 *
 * <ul>
 * <li>Two requests confirming the identical (competitor, season) at the same
 * instant, both reading no existing row before either writes: the second
 * {@code insert} loses to {@code payment_one_a_season} and answers 500. Nothing in
 * this increment's brief asks the SAME payment to be idempotent under true
 * simultaneity, only that two DIFFERENT people never receive the same number, which
 * is what {@code PaymentNumberConcurrencyTest} measures; catching that race and
 * folding it back into {@code ALREADY_RECORDED} is a real improvement and a separate
 * one.
 * <li>A {@code payment} row already sitting as {@code awaited} for this
 * (competitor, season) - which nothing on this portal writes today, but which
 * V16's own {@code default 'awaited'} leaves room for - is read exactly like no
 * row at all and then {@code insert}ed as though it were one, which collides with
 * {@code payment_one_a_season} and answers 500 rather than completing it. Turning
 * that {@code insert} into an update of the row already there is real work with
 * its own guard, and nothing writes the row it would protect yet.
 * </ul>
 *
 * <p><b>WHAT BOTH OF THOSE COST UNTIL 28.09.2026 AND NO LONGER DO, because the
 * sentence that stood here said it and was then made false on purpose.</b> Each of
 * them used to add „its drawn number already spent for good" to the 500, because the
 * number was drawn before the two inserts and {@code member_number_seq} does not go
 * back when a transaction does. The draw is now the LAST thing {@code recordIt} does,
 * so a booking the database refuses spends nothing and the 500 is all it costs. The
 * 500s themselves are unchanged and are still what the two entries above describe.
 */
@RestController
class PaymentApi {

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/**
	 * WHAT WAS TYPED INTO THE AMOUNT FIELD IS NOT A PAYMENT, and „nothing typed" is one of the ways.
	 *
	 * <p><b>Owner, 27.09.2026 (PDL, section 19, point 5), choosing between three outcomes:</b> a typed
	 * NOUGHT means the same as an empty field. „Prazno polje i ukucana nula vode na isti prompt, onaj o
	 * oslobodjenju od clanarine ... ne pise se nijedan red uplate, sema se ne dira, i znacenje je isto
	 * kao ono sto covek misli kad ukuca nulu." PDL records the alternative he refused with the cost that
	 * was shown to him: nought written as a payment of nought „bi trazila novu migraciju koja labavi
	 * `V16:105`", and „u knjigama bi stajala uplata koja se nikad nije desila".
	 *
	 * <p><b>So this route refuses three things with one word, and they are one state and not three.</b>
	 * No amount at all, a typed nought and a negative number all mean „no money arrived", and money
	 * arriving is the only thing this route is for. The road for that state is the other one: cases 4, 5
	 * and 6 of section 19 are prompts about an exemption or a balance, and {@code POST /api/memberships}
	 * is where they are answered. {@code payment_amount_positive} (V16) and
	 * {@code payment_received_positive} (V42) are the same sentence where it cannot be got around.
	 *
	 * <p><b>The boundary the owner named and accepted:</b> „moderator koji je hteo da kaze „platio je
	 * nula jer koristi balans" dobija prompt o oslobodjenju, a ne o balansu. Za taj slucaj vec postoji
	 * kucica za balans, pa put postoji; samo nije kroz polje za iznos."
	 */
	static final String THE_AMOUNT_IS_NOT_MONEY = "theAmountIsNotMoney";

	/**
	 * WHAT ARRIVED HAS A FRACTION IN IT, and an amount that is typed is a whole number.
	 *
	 * <p>PDL, ODLUKA 02.10.2026, „Iznosi se unose kao celi brojevi", recorded as the owner's own words -
	 * „Iznosi se unose bez tačaka i zareza!" - and <b>PDL, POTVRĐENO 03.10.2026, „Celi brojevi svuda,
	 * i za iznos uplate"</b>, chosen among the outcomes put to him and against the recommendation he
	 * was given (that a payment which really arrived could keep two decimals); the cost put to him
	 * was that a payment of 39,97 EUR cannot be entered exactly. On 10.10.2026 he chose that the rule is for
	 * what is TYPED and that a balance may have decimals (PDL, the entry „Odgovori na pitanja skupljena
	 * dok je bio odsutan"): the balance is worked out, never typed, and nothing is asked of it here.
	 *
	 * <p><b>Its own word, as it is in {@link PricingWriteApi#THE_AMOUNT_IS_NOT_WHOLE}</b>, with its own
	 * sentence on the screen: the moderator is told about the payment he is booking and not about a
	 * price. After {@link #THE_AMOUNT_IS_NOT_MONEY} and before {@link #THE_AMOUNT_IS_NOT_KEPT_EXACTLY},
	 * both chosen: a negative or nought amount keeps the sentence it already had however it is written
	 * (-38.5 is „no money arrived" before it is a fraction), and 38.001 and 38.006, which met the
	 * column's word until today, meet this one - held by {@code PaymentApiTest} on those very amounts.
	 */
	static final String THE_AMOUNT_IS_NOT_WHOLE = "theAmountIsNotWhole";

	/**
	 * AND WHAT ARRIVED HAS TO BE A NUMBER THE COLUMN KEEPS, which is the same question
	 * {@link PricingWriteApi#THE_AMOUNT_IS_NOT_KEPT_EXACTLY} asks of a price and is deliberately the
	 * same word.
	 *
	 * <p><b>Why it is one sentence and not two, which is the precedent's own reasoning rather than a
	 * saving.</b> {@code MembershipPrice.amountIsKeptExactly} asks three things at once - not negative,
	 * no more para than the column keeps, and inside what it can hold - and {@code PricingWriteApi} puts
	 * what is left of them under THIS one name, with its own note saying so: „Negative, or past what the
	 * column can hold." (The middle one, a fraction, has a word of its own in both classes since
	 * 10.10.2026, {@link #THE_AMOUNT_IS_NOT_WHOLE}, and cannot get this far.) Its SECOND name,
	 * {@code THE_AMOUNT_IS_MORE_THAN_A_ROW_MAY_COST}, is a different question entirely: a PRODUCT
	 * ceiling the owner decided on 25.09.2026 (PDL P12c, 1.000 EUR and 200.000 RSD) which „the column
	 * knows nothing about". <b>A payment has no such ceiling and nobody has decided one</b> - case 7 of
	 * PDL 19 lets a member send MORE than was expected on purpose - so a second name here would be a
	 * second name for one question, and inventing a maximum a member may send would be deciding
	 * something nobody asked for.
	 *
	 * <p><b>THE BOUNDARY THAT LEAVES, named rather than closed:</b> a moderator who mistypes an amount
	 * INSIDE the column - 99.999.999,99 instead of 38 - is taken at his word, and the surplus goes onto
	 * the member's balance as a credit. Nothing here refuses that, because what a member may plausibly
	 * send is a product decision and not a fact about a column. What limits the damage today is that the
	 * balance is a book: the credit is one immutable line naming who wrote it and when.
	 *
	 * <p><b>AFTER {@link #THE_AMOUNT_IS_NOT_MONEY} AND NOT BEFORE IT, which is chosen and is the
	 * precedent's order too.</b> A negative amount fails both questions - {@code amountIsKeptExactly}
	 * asks {@code signum() >= 0} as well - so asked first, this would move an answer three existing
	 * cases already have. {@code PricingWriteApi} states the same reason in as many words: „a change that
	 * quietly restates old cases is a change nobody measured."
	 */
	static final String THE_AMOUNT_IS_NOT_KEPT_EXACTLY = "theAmountIsNotKeptExactly";

	/**
	 * AND THE PRICE LIST ITSELF CAN NAME AN AMOUNT NO PAYMENT MAY CARRY, WHICH IS A DIFFERENT
	 * QUESTION FROM EITHER OF THE TWO ABOVE AND IS ABOUT A FIELD NOBODY ON THIS SCREEN TYPED.
	 *
	 * <p><b>Both halves of the collision are decided and neither is wrong.</b> A row of the price
	 * list may be free: {@code price_row_eur_not_negative} (V4) allows nought,
	 * {@link MembershipPrice#amountIsKeptExactly} says so in as many words („a price list in which
	 * something is free is a decision rather than a fault"), and the owner settled on 27.09.2026
	 * (PDL 20b) only that it must be free in BOTH currencies or in neither -
	 * {@code PricingWriteApi.THE_ROW_IS_FREE_IN_ONE_CURRENCY_ONLY} is that rule, and it lets a row
	 * free in both straight through. And a payment may not be nought:
	 * {@code payment_amount_positive} (V16) is {@code check (amount > 0)}, it is in a migration
	 * that has been applied, and ADL A2 does not let it be loosened in place.
	 *
	 * <p><b>WHAT THAT COST BEFORE THIS SENTENCE EXISTED, measured on this route rather than
	 * argued.</b> With {@code early} set to 0 EUR / 0 RSD through {@code PUT /api/pricing/{key}} -
	 * a request that answers 200, and {@code PricingWriteApiTest} has the case that says so - the
	 * next confirmation of a payment reached {@code insert into payment} with
	 * {@code amount = 0.00} and came back <b>ERROR: new row for relation „payment" violates check
	 * constraint „payment_amount_positive"</b>. That is a 500 on a moderator entering a bank
	 * statement, with nothing on it he could read; and because the number was drawn before the
	 * insert, {@code member_number_seq} stood one higher afterwards <b>although the transaction had
	 * gone back</b>. A sequence is not transactional, so every retry ate another number, and PDL
	 * 31.07.2026 is „Clanski broj se nikad ne dodeljuje dvaput". That half is closed twice over -
	 * by this sentence and by the draw having moved to the end of {@code recordIt} - and the second
	 * of the two is what covers the failures this one does not name.
	 *
	 * <p><b>WHY THE SHARED QUESTION WAS NOT CHANGED INSTEAD, which was the shorter road.</b>
	 * Teaching {@link MembershipPrice#amountIsKeptExactly} {@code signum() > 0} would close this in
	 * one character and would <b>overturn PDL 20b</b>: {@code PricingWriteApi} asks that same method
	 * of {@code eur} and {@code rsd}, so a free row would stop being writable at all. The price of a
	 * ROW and the amount of a PAYMENT are two questions that happen to share a column type, and only
	 * one of them has a decision saying nought is an answer. So the question is split rather than
	 * the method narrowed, and it is asked HERE because {@code payment_amount_positive} is this
	 * table's constraint and no other caller of the price list is standing in front of it.
	 *
	 * <p><b>409 and not 400, which is the same line this class already draws.</b> The moderator's
	 * form is not wrong - he typed what the statement showed - so telling him the amount is not
	 * money would send him to correct a field that is correct, which is the fault
	 * {@link #THE_AMOUNT_IS_NOT_MONEY} names of its own. What refuses him is the state of the price
	 * list, exactly as {@link #THE_MEMBERSHIP_IS_ALREADY_HELD} is refused by the state of his
	 * membership.
	 *
	 * <p><b>And where he is meant to go instead is already decided.</b> PDL 19 point 5 sends „no
	 * money is owed" to the exemption prompt and {@code POST /api/memberships} („Prazno polje i
	 * ukucana nula vode na isti prompt, onaj o oslobodjenju od clanarine"), and a membership the
	 * price list gives away is that same state arrived at from the other side. Nothing here decides
	 * whether the association SHOULD give a season away through the price list; it decides only
	 * that a payment of nothing is not how it is written down.
	 */
	static final String THE_MEMBERSHIP_COSTS_NOTHING = "theMembershipCostsNothing";

	static final String THE_METHOD_IS_NOT_KNOWN = "theMethodIsNotKnown";

	static final String THE_REFERENCE_IS_NOT_SHAPED = "theReferenceIsNotShaped";

	static final String THE_COMPETITOR_DOES_NOT_EXIST = "theCompetitorDoesNotExist";

	static final String THE_REFERENCE_IS_TAKEN = "theReferenceIsTaken";

	/**
	 * THE SEASON IS ALREADY SOMEBODY'S, AND THE REASON SAYS NO MORE THAN THAT.
	 *
	 * <p>It deliberately does not say on what basis it is held. The tick that opens
	 * this route is {@code queue:payments} and the basis is read under
	 * {@code entity:members} ({@link CompetitorApi#OVER_THE_MEMBERS}, PDL
	 * 28.07.2026), so a reason naming the basis would be this route handing over a
	 * fact its own caller has no right to read.
	 */
	static final String THE_MEMBERSHIP_IS_ALREADY_HELD = "theMembershipIsAlreadyHeld";

	/**
	 * {@code payment_method_known}, V39: the two ways the money arrives.
	 *
	 * <p>The owner decided on 27.09.2026 (PDL 23b) that the set has exactly two members.
	 * {@code ips} is the QR payment slip into the dinar account, and it covers a slip somebody
	 * copied out BY HAND from the figures printed beside the code, because that money takes the
	 * same road into the same account. {@code slip} was renamed to this; {@code card} and
	 * {@code sepa} are gone, neither having ever been chosen.
	 *
	 * <p><b>Package private rather than private, and that is what holds this list up.</b> It is
	 * written by hand and a list written by hand is only as safe as the floor under it:
	 * {@code PaymentMethodsMatchTheSchemaTest} takes the constraint's own expression out of the
	 * catalogue, asks PostgreSQL to judge each of these against it, and reads the words back out
	 * of the rule in the other direction. The same shape
	 * {@link com.btl.portal.domain.payment.RecordingAPayment#STATES} has under
	 * {@code PaymentStatesMatchTheSchemaTest}, and the reason it is needed here is measured: the
	 * screen said {@code ips} and this said {@code slip} from 26.09.2026 until V39, and nothing
	 * in the portal noticed.
	 */
	static final Set<String> METHODS = Set.of("ips", "paypal");

	/** {@code payment_reference_shape}, V16: digits and nothing else, off a bank statement. */
	private static final Pattern A_REFERENCE = Pattern.compile("^[0-9]{7,}$");

	/**
	 * THE MOST DIGITS A REFERENCE MAY HAVE, and the limit is {@code payment_reference_unique}'s
	 * and not {@code payment_reference_shape}'s.
	 *
	 * <p>The shape asks for seven digits at least and says nothing about the other end, and the
	 * index has an end: a key longer than about a third of a page does not go into a B-tree,
	 * PostgreSQL answers {@code index row size ... exceeds btree version 4 maximum} and, being an
	 * error, aborts the transaction. Three thousand digits pass {@link #A_REFERENCE}, reach the
	 * {@code insert} and come back to a moderator booking a payment as a 500, which is why the
	 * answer for them is the sentence a misshapen reference already gets.
	 *
	 * <p><b>Derived from the schema and decided by nobody.</b> It sits below what
	 * {@code payment_reference_unique} can hold, with a margin of about a quarter, and
	 * {@code WhatAnIndexHoldsTest} asks PostgreSQL what that is (2692 characters of text that cannot
	 * be compressed on PostgreSQL 18.6) and fails the day this number rises above it. The text is
	 * ASCII by the shape, so a digit is a byte in the index and the one number answers for both.
	 *
	 * <p><b>And the bound is the same for a text that could be compressed</b>, which is the
	 * deliberately stricter half: PostgreSQL keeps a hundred thousand copies of one digit in this
	 * index because it compresses them, so a limit measured on what the database refuses would
	 * depend on what was typed. This one does not.
	 *
	 * <p>A reference as the bank prints it is the season and the member number run together (V16),
	 * which is a handful of digits; this is a floor and not a description of one.
	 */
	static final int MOST_A_REFERENCE_CAN_BE = 2000;

	/**
	 * WHAT HAPPENS ONCE THE FORM IS READ, which since 18.10.2026 is a class of its own, because the
	 * member's row in the moderation of the members books the same payment by the same rule
	 * ({@link BookingAPayment}, {@link MemberPaymentApi}).
	 */
	private final BookingAPayment booking;

	/**
	 * Written by hand rather than left on the method, the same choice
	 * {@link RegistrationApi} made and for the same reason: what happens to the
	 * competitor, the payment and the membership is one thing that must all happen or
	 * none of it, and a boundary somebody has to open and close on purpose is a
	 * boundary that cannot be widened by accident.
	 */
	private final TransactionTemplate inOneTransaction;

	PaymentApi(BookingAPayment booking, TransactionTemplate inOneTransaction) {
		this.booking = booking;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * <p><b>THERE IS NO {@code season} HERE, AND THAT IS THE POINT RATHER THAN AN
	 * OMISSION.</b> PDL, POTVRDJENO 13.09.2026: which season a payment buys is fixed
	 * by the day it is booked - „prozor za placanje sezone S ide od 1. oktobra godine
	 * S-1 do 30. septembra godine S" - and {@link SeasonClock#seasonBeingPaidFor}
	 * already computes exactly that, the same call {@link RegistrationApi} makes for
	 * the season somebody registers into. Asking the form instead would let one
	 * keystroke buy the wrong year and, worse, burn a member number on it: nothing
	 * here needs a moderator to know which season he is looking at, only which
	 * competitor and how the money arrived.
	 *
	 * <p><b>AND THERE IS NO {@code currency} HERE EITHER, SINCE 28.09.2026, AND THAT IS THE
	 * SAME KIND OF CHANGE.</b> It used to be taken and validated, on the reasoning that it
	 * said „which of the association's two accounts the money is in, a fact about the bank
	 * statement and not a choice of price". That fact is still true and is still recorded;
	 * what changed is that it is DERIVED and no longer asked. The owner, PDL section 19:
	 * „Prazno polje sa oznakom valute pored njega. Valuta <b>zavisi od zemlje clana</b>." A
	 * Serbian member pays an IPS slip into the dinar account and everybody else pays PayPal
	 * in euro (PDL 20a), so the country decides which account it can possibly have landed
	 * in, and {@link Currency#of} is the one place that says so.
	 *
	 * <p><b>Why derived is stronger than validated here, and it is measured rather than
	 * preferred.</b> The screen already draws {@code expected} in the currency of the
	 * member's country ({@link PaymentsDueApi}, PR 403). Had this kept taking one, the
	 * request could name the OTHER money while the label the moderator is reading names his
	 * - one fact with two homes, and the comparison „is this less than expected" would then
	 * be crossing currencies by a factor of a hundred and twenty. Refusing a mismatch was
	 * the other outcome available; deriving it makes the state <b>unreachable</b> instead of
	 * refused, which is the better of the two for the same money.
	 *
	 * @param competitorId {@code competitor.id}, never the member number - the
	 *                     population this route exists for is exactly the one that
	 *                     may not have one yet
	 * @param received     what actually arrived, as the moderator read it off the bank
	 *                     statement and typed it into the field beside „Ocekivan iznos"
	 *                     (owner, 27.09.2026, PDL 19). In the member's own money, which is
	 *                     not asked for. Null, nought and a negative are one state and are
	 *                     refused as {@link #THE_AMOUNT_IS_NOT_MONEY}; a positive amount with a
	 *                     fraction in it as {@link #THE_AMOUNT_IS_NOT_WHOLE}
	 * @param useTheBalance whether the tick box „ukljuci balans (iznos balansa)" was left
	 *                     ticked. <b>Asked for and never guessed</b>, the same refusal
	 *                     {@code GrantingAMembership} makes of its own prompt: the screen
	 *                     defaults it to ticked (PDL 19), so a request that leaves it out is
	 *                     a caller that has not said which way, and defaulting either way
	 *                     would spend or withhold a member's money because a field was
	 *                     misspelled
	 * @param method       how it arrived, one of the two V39 lists
	 * @param reference    the poziv na broj, when the statement carries one; null for
	 *                     a first payment, which has no number yet to write on a slip
	 *                     (V16)
	 */
	record Confirm(Long competitorId, BigDecimal received, Boolean useTheBalance, String method,
			String reference) {
	}

	/** Why a confirmation was refused. */
	record Refused(String reason) {
	}

	/**
	 * @param memberNumber the competitor's, old or new; null in the one case
	 *                      {@link RecordingAPayment} itself names as reachable - a row
	 *                      already {@code recorded} for somebody who somehow still
	 *                      carries none
	 */
	record Confirmed(long paymentId, String memberNumber, BigDecimal amount, BigDecimal fee,
			String currency, BigDecimal received, Balance.Money fromTheBalance,
			Balance.Money creditedToTheBalance) {
	}


	@PostMapping("/api/payments")
	@RightIsNeeded("queue:payments")
	ResponseEntity<?> confirm(@RequestBody Confirm typed,
			@AuthenticationPrincipal WhoIsAsking.Member asking) {

		if (typed.competitorId() == null || typed.useTheBalance() == null
				|| isNothing(typed.method())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		String wrongWithTheAmount = whatIsWrongWith(typed.received());

		if (wrongWithTheAmount != null) {
			return no(HttpStatus.BAD_REQUEST, wrongWithTheAmount);
		}

		if (!METHODS.contains(typed.method())) {
			return no(HttpStatus.BAD_REQUEST, THE_METHOD_IS_NOT_KNOWN);
		}

		String reference = isNothing(typed.reference()) ? null : typed.reference().strip();

		/* THE LENGTH OF WHAT IS KEPT, which is the reference with its spaces taken off, is asked
		   before the shape and answered with the same sentence: a reference the index cannot hold
		   is not one this route can book, and it is told so the way a misshapen one is.
		   `MOST_A_REFERENCE_CAN_BE` says where the number comes from. */
		if (reference != null && (reference.length() > MOST_A_REFERENCE_CAN_BE
				|| !A_REFERENCE.matcher(reference).matches())) {

			return no(HttpStatus.BAD_REQUEST, THE_REFERENCE_IS_NOT_SHAPED);
		}

		return inOneTransaction.execute(committing -> booking.book(typed, reference, asking).answer());
	}

	/**
	 * WHAT IS WRONG WITH WHAT ARRIVED, as one of the three words for it, or nothing.
	 *
	 * <p><b>Asked by both doors that book a payment, in this one place</b>: this route and the member's
	 * row in the moderation of the members ({@link MemberPaymentApi}), which the owner gave the same rule
	 * on 18.10.2026 (PDL P8, „Upis uplate na redu člana: kaže se „uplata” i koliko je dinara
	 * uplaćeno”). The three questions and their order are the ones this route asked inline until then,
	 * with their reasons beside them.
	 *
	 * @param received what the moderator typed, in the member's money; may be null
	 * @return the reason to refuse it with, or null when it is a payment this column keeps
	 */
	static String whatIsWrongWith(BigDecimal received) {
		/* AND THE AMOUNT IS ITS OWN REFUSAL RATHER THAN PART OF „THE FORM IS NOT COMPLETE", because an
		   empty field and a typed nought are the SAME state (owner, PDL 19 point 5) and that state is
		   not an incomplete form - it is a request that belongs at the other door. A caller told only
		   that his form is incomplete would fill the field in with nought and be told the same thing
		   again. */
		if (received == null || received.signum() <= 0) {
			return THE_AMOUNT_IS_NOT_MONEY;
		}

		/* AND WHAT ARRIVED IS A WHOLE NUMBER, because that is what a moderator TYPES: PDL, ODLUKA
		   02.10.2026, „Iznosi se unose kao celi brojevi" („Iznosi se unose bez tačaka i zareza!"),
		   POTVRĐENO 03.10.2026 „Celi brojevi svuda, i za iznos uplate", and for what is typed only on
		   10.10.2026. `THE_AMOUNT_IS_NOT_WHOLE` carries the rest of why, and `MembershipPrice.amountIsWhole`
		   why the VALUE is asked and not the writing.

		   AFTER „NO MONEY ARRIVED" AND BEFORE THE COLUMN'S QUESTION, both chosen and both measured: -38.5
		   keeps the sentence every negative amount has had, and 38.001 and 38.006, which met the
		   column's word until today, meet this one. That DOES restate two old answers, and it is the
		   decision's doing and not a drift; `PaymentApiTest` holds the new word on those very amounts. */
		if (!MembershipPrice.amountIsWhole(received)) {
			return THE_AMOUNT_IS_NOT_WHOLE;
		}

		/* AND THAT IT IS A NUMBER `numeric(10,2)` KEEPS, ASKED OF THE ONE PLACE THAT ALREADY KNOWS.

		   WHAT IS LEFT OF IT SINCE 10.10.2026 IS THE CEILING. `99999999999.00`, an ordinary mistyping,
		   is `numeric field overflow` on the `insert` itself: a 500 with no sentence on it.

		   THE TWO FAULTS THAT MADE THIS QUESTION OWED BEFORE were both fractions, and a fraction is refused
		   one question earlier now. `38.001` against an expected `38.00` left a surplus of `0.001`, which
		   `isMoney()` calls money because its sign is positive; the column then ROUNDS it to `0.00` and
		   `balance_entry_an_overpayment_adds` (V42) refuses a credit of nothing, so the whole transaction
		   went back - no payment, no membership, no member number, and a 500. And the silent one,
		   `38.006`, whose surplus `0.006` entered the column as `0.01` and made `received` a `38.01`
		   nobody typed, in the books, for ever. A whole `received` closes both by construction, because
		   every other amount in the arithmetic comes out of a `numeric(10,2)` column already
		   (`price.amount()` and `price.fee()` are read from `price_row`): the difference has two
		   decimals at most and nothing can round.

		   THE CLAUSE THAT ASKS THE SCALE STAYS IN THE METHOD, ASKED OF `MembershipPrice` AND NOT WRITTEN
		   HERE, because the scale and the ceiling are the COLUMN'S and `AnAmountMatchesTheSchemaTest`
		   rebuilds both of them out of `information_schema`. A second copy of either number would be a
		   second home for a fact a migration is allowed to change, and through this route nothing can
		   reach that clause. `RaceWriteApi` refuses a distance for the same reason and in the same
		   words. */
		if (!MembershipPrice.amountIsKeptExactly(received)) {
			return THE_AMOUNT_IS_NOT_KEPT_EXACTLY;
		}

		return null;
	}

	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
