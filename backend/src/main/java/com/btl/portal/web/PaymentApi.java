package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.member.MemberNumber;
import com.btl.portal.domain.payment.RecordingAPayment;
import com.btl.portal.domain.payment.RecordingAPayment.Outcome;
import com.btl.portal.domain.pricing.Currency;
import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
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
 * <p><b>WHAT EACH OF THE FOUR OUTCOMES DOES HERE:</b>
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
 * <li>{@link Outcome#A_REVERSAL_IS_NOT_UNDONE_HERE} - refused, 409. A reversal is
 * its own decision with its own cost (PDL, 11.08.2026, „Stornirana uplata: clanski
 * broj propada, clan postaje neaktivan za tu sezonu"; PDL, 14.09.2026, the number
 * stays reserved for the same man and returns to him rather than going to whoever
 * asks next) and this route does not carry it out. Turning a reversal back is its
 * own screen, for the same reason {@link RecordingAPayment} gives for refusing it
 * quietly: „a reversal is turned back by a person, not by an import" - and a
 * generic confirm button is closer to the import than to the considered second
 * look a reversal asks for. It is not built here, because nothing in this
 * increment's brief asks for it and there is no case anywhere in the repository
 * that exercises un-reversing a payment.
 * </ul>
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
 * the exemption had ever been there. This class already refuses to undo a reversal
 * quietly for the same reason - „a reversal is turned back by a person, not by an
 * import" - and an exemption overturned by a fee is the same shape of fact.
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
	 * AND WHAT ARRIVED HAS TO BE A NUMBER THE COLUMN KEEPS, which is the same question
	 * {@link PricingWriteApi#THE_AMOUNT_IS_NOT_KEPT_EXACTLY} asks of a price and is deliberately the
	 * same word.
	 *
	 * <p><b>Why it is one sentence and not two, which is the precedent's own reasoning rather than a
	 * saving.</b> {@code MembershipPrice.amountIsKeptExactly} asks three things at once - not negative,
	 * no more para than the column keeps, and inside what it can hold - and {@code PricingWriteApi} puts
	 * all three under THIS one name, with its own note saying so: „Negative, or with more para than the
	 * column keeps, or past what it can hold." Its SECOND name,
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
	 * list, exactly as {@link #THE_MEMBERSHIP_IS_ALREADY_HELD} and {@link #THE_PAYMENT_WAS_REVERSED}
	 * are refused by the state of his membership.
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

	static final String THE_PAYMENT_WAS_REVERSED = "thePaymentWasReversed";

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

	private final JdbcClient db;

	private final Clock clock;

	/**
	 * WHERE A NUMBER COMES FROM, and since 27.09.2026 it is not this class.
	 *
	 * <p>It used to be, and the comment that stood on the method here called itself „the
	 * one place a number is ever drawn" - true for as long as a recorded fee was the only
	 * thing that activated a membership. {@link MembershipWriteApi} activates one too, and
	 * PDL:760 and PDL:808 attach the number to the ACTIVATION rather than to the fee, so
	 * two routes hand numbers out. {@link MemberNumbers} carries the whole of the reason it
	 * is a sequence and never a query, and {@code PaymentNumberConcurrencyTest} measures it
	 * through this route exactly as before.
	 */
	private final MemberNumbers numbers;

	/**
	 * Written by hand rather than left on the method, the same choice
	 * {@link RegistrationApi} made and for the same reason: what happens to the
	 * competitor, the payment and the membership is one thing that must all happen or
	 * none of it, and a boundary somebody has to open and close on purpose is a
	 * boundary that cannot be widened by accident.
	 */
	private final TransactionTemplate inOneTransaction;

	private final MemberOfAccount memberOfAccount;

	private final PriceRows priceRows;


	private final BalanceBook book;

	/**
	 * WHICH MONEY THIS MEMBER IS BILLED IN, since the request stopped saying so.
	 *
	 * <p>Everything this route compares is in one currency - what was expected, what arrived and what
	 * his book holds - and a single lookup is what makes them one currency rather than three that
	 * happen to agree.
	 */
	private final CurrencyOfMember currencyOf;

	PaymentApi(JdbcClient db, Clock clock, MemberNumbers numbers, TransactionTemplate inOneTransaction,
			MemberOfAccount memberOfAccount, PriceRows priceRows, BalanceBook book,
			CurrencyOfMember currencyOf) {
		this.db = db;
		this.clock = clock;
		this.numbers = numbers;
		this.inOneTransaction = inOneTransaction;
		this.memberOfAccount = memberOfAccount;
		this.priceRows = priceRows;
		this.book = book;
		this.currencyOf = currencyOf;
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
	 *                     refused as {@link #THE_AMOUNT_IS_NOT_MONEY}
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

	private record CompetitorRow(long id, LocalDate birthDate, String memberNumber) {
	}

	private record ExistingPayment(long id, String state) {
	}

	@PostMapping("/api/payments")
	@RightIsNeeded("queue:payments")
	ResponseEntity<?> confirm(@RequestBody Confirm typed,
			@AuthenticationPrincipal WhoIsAsking.Member asking) {

		if (typed.competitorId() == null || typed.useTheBalance() == null
				|| isNothing(typed.method())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		/* AND THE AMOUNT IS ITS OWN REFUSAL RATHER THAN PART OF „THE FORM IS NOT COMPLETE", because an
		   empty field and a typed nought are the SAME state (owner, PDL 19 point 5) and that state is
		   not an incomplete form - it is a request that belongs at the other door. A caller told only
		   that his form is incomplete would fill the field in with nought and be told the same thing
		   again. */
		if (typed.received() == null || typed.received().signum() <= 0) {
			return no(HttpStatus.BAD_REQUEST, THE_AMOUNT_IS_NOT_MONEY);
		}

		/* AND THAT IT IS A NUMBER `numeric(10,2)` KEEPS, ASKED OF THE ONE PLACE THAT ALREADY KNOWS.

		   WHY IT IS OWED HERE, and it is two separate faults rather than one theoretical one. Without
		   it, `38.001` against an expected `38.00` leaves a surplus of `0.001`, which `isMoney()` calls
		   money because its sign is positive; the column then ROUNDS it to `0.00` and
		   `balance_entry_an_overpayment_adds` (V42) refuses a credit of nothing. The whole transaction
		   goes back: no payment, no membership, no member number, and a 500 with no sentence on it. And
		   `99999999999.00`, an ordinary mistyping, is `numeric field overflow` on the `insert` itself,
		   which is the same 500 by a shorter road.

		   AND THE HALF THAT IS SILENT, which is the same fault and not a second one: `38.006` is not
		   refused by anything, the surplus `0.006` enters the column as `0.01`, and `received` becomes
		   `38.01` - a number nobody typed, in the books, for ever. On the dinar side `3600.004` short of
		   4.200 leaves `599.996` and the book is charged `-600.00`. Closing the scale closes all three,
		   because every other amount in the arithmetic comes out of a `numeric(10,2)` column already:
		   `price.amount()` and `price.fee()` are read from `price_row`, so once what ARRIVED has two
		   decimals at most, the difference has two decimals at most and nothing can round.

		   ASKED OF `MembershipPrice` AND NOT WRITTEN HERE, because the scale and the ceiling are the
		   COLUMN'S and `AnAmountMatchesTheSchemaTest` rebuilds both of them out of `information_schema`.
		   A second copy of either number would be a second home for a fact a migration is allowed to
		   change. `RaceWriteApi` refuses a distance for the same reason and in the same words. */
		if (!MembershipPrice.amountIsKeptExactly(typed.received())) {
			return no(HttpStatus.BAD_REQUEST, THE_AMOUNT_IS_NOT_KEPT_EXACTLY);
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

		return inOneTransaction.execute(committing -> write(typed, reference, asking));
	}

	private ResponseEntity<?> write(Confirm typed, String reference, WhoIsAsking.Member asking) {
		Optional<CompetitorRow> competitor = db.sql(
						"select id, birth_date, member_number from competitor where id = ?")
				.param(typed.competitorId())
				.query((row, i) -> new CompetitorRow(row.getLong(1), row.getDate(2).toLocalDate(),
						row.getString(3)))
				.optional();

		if (competitor.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_COMPETITOR_DOES_NOT_EXIST);
		}

		/* THE DAY THE MONEY IS BOOKED, NEVER A DAY ANYBODY TYPES: PDL, POTVRDJENO
		   13.09.2026. Read once here so the lookup below and the row {@code recordIt}
		   writes both name the same season {@link RegistrationApi} would compute for
		   this same instant. */
		int season = SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock));

		Optional<ExistingPayment> existing = db.sql(
						"select id, state from payment where competitor_id = ? and season = ?")
				.params(competitor.get().id(), season)
				.query((row, i) -> new ExistingPayment(row.getLong(1), row.getString(2)))
				.optional();

		MemberNumber numberHeAlreadyHas = competitor.get().memberNumber() == null ? null
				: new MemberNumber(competitor.get().memberNumber());

		Outcome outcome = RecordingAPayment.decide(new RecordingAPayment.Payment(
				existing.map(ExistingPayment::state).orElse(RecordingAPayment.AWAITED), numberHeAlreadyHas));

		/* WHICH MONEY EVERY NUMBER BELOW IS IN, read once and from his country. Asked after the
		   competitor is known to exist, because `CurrencyOfMember` refuses to answer about somebody who
		   does not and the refusal above is the better answer to that. */
		Currency his = currencyOf.of(competitor.get().id());

		return switch (outcome) {
			case A_REVERSAL_IS_NOT_UNDONE_HERE -> no(HttpStatus.CONFLICT, THE_PAYMENT_WAS_REVERSED);
			case ALREADY_RECORDED -> alreadyRecorded(existing.orElseThrow(), competitor.get(), his);
			case RECORD_IT, RECORD_IT_AND_NUMBER_HIM -> {
				/* THE REFERENCE IS CHECKED HERE, ONLY ONCE THE OUTCOME IS KNOWN, AND
				   THAT ORDER IS DELIBERATE. Checked before the outcome, a SECOND
				   confirmation of a payment that already carries this exact reference
				   found its own row and refused itself with 409: the reference a
				   renewal repeats is by construction already written on the very row
				   {@code ALREADY_RECORDED} is about to answer with, never on a
				   stranger's. Only a genuinely NEW row can collide with somebody
				   else's, so only this branch, which is the only one that inserts
				   one, asks. */
				if (reference != null && referenceIsTaken(reference)) {
					yield no(HttpStatus.CONFLICT, THE_REFERENCE_IS_TAKEN);
				}

				/* AND THE SEASON ITSELF, ASKED HERE FOR THE SAME REASON THE REFERENCE
				   IS: this is the only branch that inserts a `membership` row, so it
				   is the only branch the key can be taken under. `ALREADY_RECORDED`
				   cannot reach it - a payment in that state was written by this class
				   in one transaction with its own membership row, so the key it would
				   find is the very row it is about to answer with. */
				if (theSeasonIsAlreadyHeld(competitor.get().id(), season)) {
					yield no(HttpStatus.CONFLICT, THE_MEMBERSHIP_IS_ALREADY_HELD);
				}
				yield recordIt(typed, season, reference, competitor.get(), asking, his,
						outcome == Outcome.RECORD_IT_AND_NUMBER_HIM);
			}
		};
	}

	/**
	 * WHETHER THIS (COMPETITOR, SEASON) IS ALREADY A MEMBERSHIP, WHOEVER DECIDED IT
	 * AND ON WHATEVER GROUND.
	 *
	 * <p>The question is the KEY and not the basis, which is what makes it complete by
	 * construction: {@code membership_pk} is {@code (competitor_id, season)}, so a row
	 * this returns true for is a row the {@code insert} below cannot add, whatever
	 * value its {@code basis} column happens to carry today or gains tomorrow.
	 */
	private boolean theSeasonIsAlreadyHeld(long competitorId, int season) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from membership"
						+ " where competitor_id = ? and season = ?)")
				.params(competitorId, season).query(Boolean.class).single());
	}

	private boolean referenceIsTaken(String reference) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from payment where reference = ?)")
				.param(reference).query(Boolean.class).single());
	}

	/**
	 * Nothing is written: {@link RecordingAPayment}'s own reason is that a bank
	 * statement is reconciled in bulk and the same file can be imported twice, and a
	 * moderator's second click on a row that no longer waits is the same case.
	 */
	private ResponseEntity<?> alreadyRecorded(ExistingPayment existing, CompetitorRow competitor,
			Currency his) {

		record Amounts(BigDecimal amount, BigDecimal fee, String currency, BigDecimal received,
				int season) {
		}

		Amounts amounts = db.sql("select amount, fee, currency, received, season"
						+ " from payment where id = ?")
				.param(existing.id())
				.query((row, i) -> new Amounts(row.getBigDecimal(1), row.getBigDecimal(2),
						row.getString(3), row.getBigDecimal(4), row.getInt(5)))
				.single();

		/* WHAT THE BALANCE PAID WHEN THIS WAS RECORDED, read back rather than recomputed. This
		   branch writes nothing, so recomputing would answer with TODAY'S balance - which has since
		   had this very spend taken out of it - and report a smaller number than the one the member
		   was actually credited. The book is the record of what happened; asking it is the only
		   answer that stays true.

		   AND THE CURRENCY THE ROW WAS WRITTEN IN IS ANSWERED, not the one he is billed in today, for
		   the same reason: `whatAMembershipTook` reads the line's own money and falls back to his only
		   when there is no line to read. A member who has changed country since is told what was
		   actually taken off him.

		   NOTHING IS SAID ABOUT A CREDIT ON A REPEAT, and that is a boundary rather than an omission:
		   a surplus is one `overpayment` line among however many his book has collected since, and
		   there is no key from a payment to the line it produced. Reporting „what this booking
		   credited" would mean either inventing that key or recomputing from today's price list, and
		   recomputing is exactly what the paragraph above refuses. So the repeat answers nothing in
		   his money, and the number the moderator needs - what arrived - is `received`, which IS on
		   the row. */
		return ResponseEntity.ok(new Confirmed(existing.id(), competitor.memberNumber(),
				amounts.amount(), amounts.fee(), amounts.currency(), amounts.received(),
				book.whatAMembershipTook(competitor.id(), amounts.season(), his),
				Balance.Money.nothingIn(his)));
	}

	private ResponseEntity<?> recordIt(Confirm typed, int season, String reference, CompetitorRow competitor,
			WhoIsAsking.Member asking, Currency his, boolean numbering) {

		LocalDate today = LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE);
		List<MembershipPrice.Row> rows = priceRows.all();
		MembershipPrice.Price price = MembershipPrice.on(rows, MonthDay.from(today),
				competitor.birthDate().getYear(), season, his);

		/* AND WHETHER THE PRICE LIST IS ASKING FOR ANYTHING AT ALL, WHICH IS THE ONE REFUSAL ON THIS
		   ROUTE THAT IS ABOUT A FIELD NOBODY HERE TYPED. `THE_MEMBERSHIP_COSTS_NOTHING` carries the
		   whole of why a free row is legal, why `payment_amount_positive` is right to refuse it, and
		   why the shared question in `MembershipPrice` was split rather than narrowed.

		   ASKED OF `price.amount()` AND NOT OF THE ROW THE DAY FALLS IN, because those are two
		   different rows for a junior: `MembershipPrice.on` replaces the period with the junior row
		   for anybody young enough, so a guard reading the period would let a free JUNIOR price
		   through and meet the constraint anyway. What is asked is the amount that is about to be
		   written, read from the same expression that writes it.

		   `signum() <= 0` AND NOT `signum() == 0`, which is the constraint's own sentence `amount >
		   0` turned round. A negative price is refused by `price_row_eur_not_negative` (V4) so the
		   lower half is unreachable today, and writing the constraint's whole condition rather than
		   the half that can happen is what keeps this sentence and that constraint saying one thing
		   the day either moves. */
		if (price.amount().signum() <= 0) {
			return no(HttpStatus.CONFLICT, THE_MEMBERSHIP_COSTS_NOTHING);
		}

		long priceRowId = db.sql("select id from price_row where key = ?")
				.param(price.key()).query(Long.class).single();

		String recordedByName = memberOfAccount.nameOf(asking.account());

		Timestamp now = Timestamp.from(clock.instant());

		/* `amount` IS WHAT THE PRICE LIST CHARGED AND `received` IS WHAT ARRIVED, and they are two
		   facts rather than one said twice. V16 writes „What was ASKED and in what money" beside the
		   first, and the paragraph at the head of this class gives the whole reason the reduced figure
		   must not go there: „the books would show a membership sold for less than the price list says
		   it costs, and there would be nowhere to see that the association settled part of it out of
		   what it already owed the member." V42 added the second column so that the owner's
		   specification of 27.09.2026 - a moderator typing what the statement shows - could be recorded
		   without either sentence becoming false. */
		/* AND WHAT THE ROW TOOK IS READ BACK OUT OF IT RATHER THAN ECHOED FROM THE REQUEST.

		   `returning id, received` costs nothing - the statement is already returning - and it makes the
		   answer and the row ONE number by construction instead of by argument. Until the scale was
		   bounded above they really could be two: a request carrying `38.006` was answered `38.006`
		   while the row held `38.01`. With the bound in place they agree by value, and this makes them
		   agree by SOURCE, which is the difference between a rule that holds and a rule that happens to
		   hold. It is also what the repeat branch has always done - `alreadyRecorded` reads `received`
		   off the row - so the two branches now answer the same question the same way. */
		record Written(long id, BigDecimal received) {
		}

		Written written = db.sql("insert into payment (competitor_id, season, reference, price_row_id,"
						+ " amount, currency, fee, method, state, recorded_at, recorded_by,"
						+ " recorded_by_name, received)"
						+ " values (?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?, ?, ?)"
						+ " returning id, received")
				.params(competitor.id(), season, reference, priceRowId, price.amount(),
						his.name(), price.fee(), typed.method(), now, asking.account(), recordedByName,
						typed.received())
				.query((row, i) -> new Written(row.getLong(1), row.getBigDecimal(2)))
				.single();

		long paymentId = written.id();

		db.sql("insert into membership (competitor_id, season, basis, payment_id) values (?, ?, 'payment', ?)")
				.params(competitor.id(), season, paymentId).update();

		/* AND NOW, AND NOT ONE MOMENT EARLIER, THE BALANCE IS SPENT. Owner, 26.09.2026: „balans se
		   skida tek kad uplata bude proknjizena. Ako clan ne plati, balans mu ostaje."

		   WHAT DECIDES HOW MUCH IS THE TICK BOX ON THE MODERATOR'S SCREEN, AND IT USED TO BE WHAT THE
		   QR CODE PROMISED. Owner, 27.09.2026 (PDL 23a), chosen between three outcomes: „Na
		   moderatorovom ekranu odlucuje kucica i iznos u njenoj labeli, ne ono sto je QR kod obecao.
		   Clanovo sopstveno placanje po QR kodu se ne dira."

		   WHY THE OLD SHAPE HAD TO GO AND NOT MERELY BE ADDED TO. Until this branch the deduction was
		   `book.promised(...).map(promised -> Balance.honouring(promised, book.of(...)))` with
		   `Money.NOTHING` when no promise stood. Two things follow from that and the owner was shown
		   both before choosing: un-ticking the box would have done NOTHING AT ALL, and - the commoner
		   case by far - a member nobody ever opened the membership screen for has no promise, so his
		   balance would never come off however plainly the label beside the tick showed it. The screen
		   would say one thing and the route do another. So `Balance.honouring` was DELETED rather than
		   left uncalled, because a method nothing calls is a rule the next reader thinks is in force.

		   AND THE MEMBER'S OWN DOOR IS UNTOUCHED, which is the other half of his sentence. `GET
		   /api/me/membership` still mints a promise and still pins it for the season, and `POST
		   /api/me/membership` still spends what is in the book inside one transaction. What a member was
		   TOLD is still what he is held to; the moderator is held to what he ticks.

		   HOW MUCH THE TICK IS WORTH IS THE SHORTFALL AND NOT THE WHOLE FEE, which is cases 2 and 3 of
		   section 19: „manji, balans pokriva razliku ... balans se umanjuje", and when the balance runs
		   out first, „balans se trosi do kraja, pa se pita o ostatku". So the balance is measured
		   against what is still owed after the money that arrived, capped at what there is. A member who
		   paid in full (case 1) or over (case 7) is owed nothing more, so the same line takes nothing off
		   his book even with the box ticked, and that is one formula covering four of the seven cases
		   rather than four branches. */
		Balance.Money expected = new Balance.Money(price.amount().add(price.fee()), his);
		Balance.Money received = new Balance.Money(typed.received(), his);

		Balance.Money fromTheBalance = typed.useTheBalance()
				? Balance.against(Balance.whatIsStillOwed(expected, received),
						book.of(competitor.id(), his)).fromTheBalance()
				: Balance.Money.nothingIn(his);

		/* A row that moves nothing is refused by `balance_entry_a_membership_takes` (V42), and it is
		   refused on purpose: a member with an empty book has nothing to record. */
		if (fromTheBalance.isMoney()) {
			book.spentOnAMembership(competitor.id(), season, fromTheBalance, asking.account(), recordedByName);
		}

		/* AND WHAT ARRIVED OVER AND ABOVE WHAT WAS EXPECTED GOES BACK ONTO HIS BOOK. Owner, 27.09.2026
		   (PDL 19, case 7): „veci od ocekivanog ... aktivacija prolazi, visak ulazi u balans kao
		   kredit", chosen over two others because „balans vec postoji kao mesto gde stoji clanov novac
		   kod nas, pa se visak ne izmislja nigde drugde i clan ne gubi ono sto je poslao."

		   IT DOES NOT DEPEND ON THE TICK BOX, and that is worth saying because the tick sits right
		   beside it on the screen. The box says whether his balance may PAY; a surplus is money he has
		   actually sent, and declining to record it because a box was cleared would be the association
		   keeping it. */
		Balance.Money credited = Balance.whatArrivedInExcess(expected, received);

		if (credited.isMoney()) {
			book.creditedAnOverpayment(competitor.id(), season, credited, asking.account(), recordedByName);
		}

		/* AND WHOEVER BROUGHT HIM IN IS PAID, at this moment and for this reason: PDL, „Iznos leže
		   na balans automatski, u trenutku kad se novom članu aktivira članarina, ne u trenutku
		   registracije". Once per member brought in however many seasons he goes on to pay for, and
		   what holds that is `balance_entry_one_a_referral` (V38) rather than a question asked here. */
		book.aReferralWasActivated(competitor.id(), asking.account(), recordedByName);

		/* AND ONLY NOW IS A NUMBER DRAWN, WHICH IS THE LAST THING THIS METHOD DOES AND IS A POSITION
		   RATHER THAN AN ORDER OF CONVENIENCE.

		   WHY IT MOVED. `member_number_seq` IS NOT TRANSACTIONAL - that is the whole of why V16 made
		   it a sequence rather than `max(...) + 1`, and it is also the price - so a number drawn
		   inside a transaction that then goes back is spent FOR GOOD. Drawn where it used to be,
		   before the two inserts, every refusal the DATABASE makes of this booking ate one, and the
		   owner's rule is „Clanski broj se nikad ne dodeljuje dvaput" (PDL 31.07.2026). Measured on
		   this route: a free price row answered 500 off `payment_amount_positive` and left the
		   sequence one higher with nothing to show for it.

		   WHAT THAT CLOSES, AND ALL FOUR ARE NAMED SOMEWHERE ALREADY. `payment_amount_positive` (the
		   sentence above now refuses it first, so this is the second lock on the same door);
		   `payment_one_a_season` against a row left `awaited`, which the paragraph at the head of
		   this class names as reached „exactly like no row at all"; and the two true races the same
		   paragraph names, on `payment_one_a_season` and on `membership_pk`, where two moderators
		   confirm the same instant. The loser of a race now draws NOTHING rather than drawing and
		   losing.

		   THE PRECEDENT IS IN THE PORTAL AND THIS IS THE ROUTE THAT WAS OUT OF STEP WITH IT.
		   `MyMembershipWriteApi.letHimIn` already draws after its `insert into membership`, for a
		   membership held on a balance. Two doors to one fact, and only one of them was paying for
		   a failure with a number.

		   WHAT IS STILL TRUE AFTERWARDS, so the move is not read as more than it is: a booking that
		   SUCCEEDS still spends a number and there is no way back from that (PDL section 19,
		   „Aktivacija trosi clanski broj nepovratno"). What has changed is only that one that FAILS
		   no longer does.

		   AND NOTHING BETWEEN THE INSERTS AND HERE READS WHAT THIS WRITES, which is why the move is
		   behaviour preserving rather than merely later: `spentOnAMembership`,
		   `creditedAnOverpayment` and `aReferralWasActivated` are three statements against
		   `balance_entry`, and the only column of `competitor` any of them touches is
		   `referred_by`. */
		String memberNumber = numbering ? numbers.draw().written() : competitor.memberNumber();

		if (numbering) {
			db.sql("update competitor set member_number = ?, active = true where id = ?")
					.params(memberNumber, competitor.id()).update();
		}
		else {
			db.sql("update competitor set active = true where id = ?")
					.param(competitor.id()).update();
		}

		return ResponseEntity.status(HttpStatus.CREATED).body(new Confirmed(paymentId, memberNumber,
				price.amount(), price.fee(), his.name(), written.received(), fromTheBalance, credited));
	}

	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
