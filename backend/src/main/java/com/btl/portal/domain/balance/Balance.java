package com.btl.portal.domain.balance;

import com.btl.portal.domain.pricing.Currency;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/**
 * WHAT A MEMBER'S BALANCE DOES TO WHAT HE OWES, and the boundaries the owner drew through it.
 *
 * <p><b>Owner, 26.09.2026, the two decisions this class started as:</b> „QR se kuje na iznos minus
 * balans, ali se balans skida tek kad uplata bude proknjizena", and „Balans veci ili jednak
 * clanarini: QR koda nema, clanstvo se aktivira iz balansa, a visak ostaje za sledecu godinu." Two
 * sentences, one arithmetic: what he transfers is the fee less his balance, and when that comes out
 * at nothing there is nothing to transfer at all.
 *
 * <p><b>THE BOUNDARY IS „GREATER OR EQUAL" AND EQUAL IS THE SIDE THAT ACTIVATES.</b> A member whose
 * balance is exactly the fee owes exactly nothing, and asking him to transfer nothing is the shape
 * the owner refused when he refused the symbolic QR („clan placa ono sto ne duguje, a banci trosak
 * premasuje iznos"). So {@link Settlement#coveredByTheBalance()} is true at equality, and equality
 * is a case of its own in the tests rather than a point nobody stands on.
 *
 * <p><b>AND SINCE 27.09.2026 A BALANCE IS ONE AMOUNT IN ONE CURRENCY (PDL, section 25), WHICH IS
 * WHAT MAKES EVERY ANSWER BELOW A SINGLE SUBTRACTION.</b> The owner: „balans je uvek u valuti
 * zavisno od drzave ... Balans uvek skida u svojoj valuti, tako da nije ni bitno koliko je to u
 * drugoj valuti. Nema ni potrebe da cuva par, nego moze da cuva samo iznos i valutu, to je bolje."
 *
 * <p><b>WHAT THAT REPLACED, SAID HERE BECAUSE EVERY PIECE OF IT WAS RIGHT UNDER THE PAIR.</b> Until
 * V42 a {@link Money} was {@code eur} AND {@code rsd}, and this class carried two independent sums
 * with the sentence „nothing here converts between the two currencies" on them. Three things existed
 * only because a pair can land one-sided, at 15.00/0.00: {@code isMoneyInBothCurrencies},
 * {@code GrantingAMembership.whatComesOffTheBook} with its binary „covered in both, take the fee;
 * otherwise take the whole book", and the refusal {@code NOTHING_WOULD_COME_OFF_THE_BOOK}. One amount
 * has no second half to be nothing in, so the first two are gone and the third is now one question
 * about one number. V38 predicted exactly this in its own note on that refusal: „Once the book is one
 * amount in one currency rather than a pair ... this road closes with the pair it depends on."
 *
 * <p><b>AND ADL IS NOT CONTRADICTED, WHICH IS THE ONE THING THAT WOULD STOP ALL OF IT.</b> „Dve
 * valute su dva zasebna cenovnika, ne jedan sa konverzijom" is about the PRICE LIST, and PDL P12d
 * says so in as many words under „Obim ove odluke je CENOVNIK": the price list is never converted and
 * its two columns are typed freely, while the balance at a change of country IS. Nothing here reads
 * one price out of another; {@link #translated} is applied to a BALANCE and to nothing else, on the
 * one occasion PDL section 26 names.
 *
 * <p><b>WHICH IS ALSO WHY EVERY OPERATION BELOW REFUSES TWO CURRENCIES RATHER THAN COPING WITH
 * THEM.</b> Under the pair a mistake about currency was impossible by construction: both numbers were
 * always there. Under one amount it is the cheapest mistake in the portal to make - the fee read in
 * euro against a balance in dinars is a comparison that returns a perfectly ordinary {@code true},
 * and by the seeded rate of 120 it would be true by a factor of a hundred and twenty. So the refusal
 * is in the TYPE and not in a comment: {@link Money#atMost}, {@link #against}, {@link #whatIsStillOwed}
 * and {@link #whatArrivedInExcess} all throw on a mismatch, and there is no operation that quietly
 * takes one.
 *
 * <p><b>THE PROCESSING FEE IS STILL NOT THE BALANCE'S TO PAY WHEN NOBODY TYPED AN AMOUNT, and where
 * it IS the balance's is the owner's sentence rather than this class's reasoning.</b> V16 says of the
 * fee that it is „the processing fee, which is NOT membership and is shown as its own line", and a
 * balance is a reward for bringing in a MEMBER, so on the member's own door ({@code
 * MyMembershipWriteApi}) the balance is measured against the membership alone and a covered member
 * pays no fee because there is nothing to process. On the MODERATOR's door it is different, and the
 * difference is his decision and not a drift: PDL section 19 defines „Ocekivan iznos" as what the
 * member SENDS, fee included („Za clana iz inostranstva sa clanarinom 40 i taksom 3, labela kaze
 * 43"), and case 2 says „balans pokriva razliku" - the difference from THAT number. So when money has
 * arrived and fallen short, what the balance covers is the shortfall against the expected total.
 * <b>This narrows a sentence a previous author of this class wrote as his own reasoning</b> („the fee
 * never comes off the balance"), and it narrows it because the owner's definition of the expected
 * amount is explicit and dated while that sentence was marked „REASONING RATHER THAN A DECISION".
 */
public final class Balance {

	private Balance() {
	}

	/**
	 * ONE EURO IS ONE HUNDRED AND TWENTY DINARS, AND THIS IS THE ONLY PLACE THE PORTAL SAYS SO.
	 *
	 * <p><b>Owner, 27.09.2026 (PDL, section 26), choosing between three outcomes:</b> „Dvojka, 120 je
	 * kurs i tako ostaje do daljnjeg."
	 *
	 * <p><b>THIS IS NOT A NEW RATE, WHICH MATTERS BECAUSE THE JOURNAL CORRECTED ITSELF ON EXACTLY
	 * THIS POINT.</b> PDL section 26 records that the sentence „kursa u portalu nema nigde" was wrong:
	 * the rate was written down long before, in „Dinarski cenovnik je fiksiran za sezonu, po kursu 1
	 * EUR = 120 RSD. Ne preracunava se po kursu na dan." What did not exist was any CONVERSION in
	 * code, and that absence was deliberate. So this constant does not introduce a rate; it is the
	 * first use of one already decided, on the one occasion already decided.
	 *
	 * <p><b>AND IT IS USED IN ONE DIRECTION OF ONE SITUATION ONLY.</b> Not for the price list, which
	 * PDL P12d exempts by name and which {@code MembershipPrice} refuses in its own words („Anything
	 * HERE that worked one out of the other would be the rule he refused"). Not for an invoice, not
	 * for a payment, not for a promise. Only for a balance a member carries across a change of
	 * country, because his balance must be one amount in the currency he is now billed in.
	 *
	 * <p><b>„DO DALJNJEG" IS HIS WORD AND THE BOUNDARY IT DRAWS IS NAMED:</b> if the rate ever
	 * changes, lines already translated are NOT touched. They were translated at the rate that stood
	 * then, which is the same reason the translation is written into the book at all rather than done
	 * silently, and it is the reason {@code a_balance_entry_is_written_once} (V38) exists.
	 */
	private static final BigDecimal DINARS_TO_THE_EURO = new BigDecimal("120");

	/** Two, as every amount of money in this portal is written and as every column stores it. */
	private static final int DECIMALS = 2;

	/**
	 * An amount of money somebody has or owes, in one currency.
	 *
	 * <p><b>Never negative, and that is load-bearing rather than defensive.</b> The book records
	 * MOVEMENTS and a spend moves down, so the minus lives in {@code BalanceBook} where a line is
	 * written; everywhere else an amount is money somebody has, and a negative one would mean two
	 * different things depending on who was reading. The constraints that refuse a wrong sign in the
	 * database ({@code balance_entry_a_referral_adds} and its three sisters, V42) are the same rule
	 * said where it cannot be got around.
	 *
	 * @param amount   never negative, at two decimals as the columns store it
	 * @param currency which money, decided by the member's country
	 *                 ({@link Currency#of})
	 */
	public record Money(BigDecimal amount, Currency currency) {

		public Money {
			Objects.requireNonNull(amount, "amount");
			Objects.requireNonNull(currency, "currency");

			if (amount.signum() < 0) {
				throw new IllegalArgumentException("money here is never negative: " + amount);
			}
		}

		/** Nothing at all, in the currency the question is being asked in. */
		public static Money nothingIn(Currency currency) {
			return new Money(BigDecimal.ZERO, currency);
		}

		/** Whether this is nothing, asked by value so that 0 and 0.00 answer alike. */
		public boolean isNothing() {
			return amount.signum() == 0;
		}

		/**
		 * Whether this is money at all: strictly more than nothing.
		 *
		 * <p><b>The exact negation of {@link #isNothing()} now, and it was not before.</b> Under the
		 * pair this was {@code isMoneyInBothCurrencies} and the two questions differed on a state a
		 * pair could reach and a single amount cannot - 15.00/0.00, neither nothing nor money. It is
		 * kept as its own method rather than folded into {@code !isNothing()} because what its one
		 * caller needs to know is what {@code balance_entry_a_membership_takes} (V42) demands, namely
		 * {@code amount < 0} for a spend, and „is there anything to write a line about" is the
		 * question that reads the same way as the constraint it answers for.
		 */
		public boolean isMoney() {
			return amount.signum() > 0;
		}

		/**
		 * This, or the other one if the other one is smaller. The whole of „min".
		 *
		 * @throws IllegalArgumentException when the two are in different currencies, which is a
		 *                                  question nobody may answer by picking one
		 */
		public Money atMost(Money ceiling) {
			inTheSameCurrency(this, ceiling);

			return amount.compareTo(ceiling.amount()) <= 0 ? this : ceiling;
		}
	}

	/**
	 * WHAT ONE MEMBER OWES FOR ONE SEASON ONCE HIS BALANCE HAS BEEN COUNTED.
	 *
	 * @param fee                 the membership itself, off the row of the price list that applies to
	 *                            him and in his own currency
	 * @param balance             what the book says he has
	 * @param fromTheBalance      how much of it this membership uses, which is all of it when it is
	 *                            short and exactly the fee when it is not
	 * @param toTransfer          what is left for him to actually send, which is nothing exactly when
	 *                            {@code coveredByTheBalance} is true
	 * @param coveredByTheBalance whether the balance settles the whole membership - the owner's „veci
	 *                            ili jednak"
	 */
	public record Settlement(Money fee, Money balance, Money fromTheBalance, Money toTransfer,
			boolean coveredByTheBalance) {
	}

	/**
	 * THE ONE PLACE THE SUBTRACTION HAPPENS, so that the number on the invoice and the number taken
	 * out of the book cannot be two numbers.
	 *
	 * <p><b>And it is now the ONLY rule for what a membership takes out of a book, on both doors.</b>
	 * Until V42 the moderator's door needed a different one: {@code min} taken per currency answered
	 * „40 EUR and 600 RSD" for a balance of 50/600 against a fee of 40/4.800, which left ten euro of
	 * his book standing while taking every dinar of it at a rate of fifteen to one. That state does
	 * not exist for one amount, so {@code GrantingAMembership.whatComesOffTheBook} is gone and
	 * {@link Settlement#fromTheBalance()} is what both doors read.
	 *
	 * @param fee     the membership fee that applies to him, or on the moderator's door the shortfall
	 *                he is asking the balance to cover
	 * @param balance what his book adds up to
	 * @throws IllegalArgumentException when the two are in different currencies
	 */
	public static Settlement against(Money fee, Money balance) {
		inTheSameCurrency(fee, balance);

		Money used = balance.atMost(fee);

		Money left = new Money(fee.amount().subtract(used.amount()), fee.currency());

		return new Settlement(fee, balance, used, left,
				balance.amount().compareTo(fee.amount()) >= 0);
	}

	/**
	 * THE SETTLEMENT AS THE CODE HE IS ALREADY HOLDING STATES IT, which is not the settlement today's
	 * book would produce.
	 *
	 * <p><b>Why a second reading of one invoice may not recompute the discount.</b> A code is a slip
	 * of paper with a number on it, and once it leaves the screen the portal cannot take it back. If a
	 * second look recomputed the reduction, a member whose balance moved in between would be holding
	 * TWO slips saying two different numbers while only one promise could be recorded - and whichever
	 * slip he then paid, the amount coming off his book would be the other one's. Measured before it
	 * was fixed: a code minted on 3.600 against a balance of 600, a seventh referral landing, a mere
	 * refresh of the page, and then 1.200 off the book for a discount of 600. That is the outcome the
	 * owner refused on 27.09.2026 in as many words, with the cost stated to him: „the association's
	 * liability would fall by 1.200 against a discount of 600".
	 *
	 * <p><b>SO THE FIRST LOOK OF A SEASON FIXES WHAT THAT SEASON'S CODE PROMISES, and this is the
	 * method that serves it afterwards.</b> Every slip the member can be holding for that season then
	 * carries the same number.
	 *
	 * <p><b>WHAT IS TAKEN FROM TODAY AND WHAT FROM THE PROMISE.</b> The reduction and the transfer
	 * come from the promise, because they are what the slip says. The balance and
	 * {@link Settlement#coveredByTheBalance()} come from today, because they are facts about his book
	 * right now: the second of them is read by the screen as „{@code POST /api/me/membership} is the
	 * way in", and that route mints no code and therefore consults no promise - it spends what is in
	 * the book at the moment it writes, inside one transaction.
	 *
	 * <p><b>AND SINCE 27.09.2026 THIS IS THE MEMBER'S DOOR AND NOBODY ELSE'S.</b> Owner, PDL section
	 * 23a: „Na moderatorovom ekranu odlucuje kucica i iznos u njenoj labeli, ne ono sto je QR kod
	 * obecao. Clanovo sopstveno placanje po QR kodu se ne dira." A promise pinned what the MEMBER was
	 * told; the moderator is told by his own tick box, and {@code PaymentApi} therefore no longer
	 * reads a promise at all. The method {@code Balance.honouring} that capped a booking at the
	 * promise was deleted with that decision rather than left uncalled, because a method nothing calls
	 * is a rule the next reader will think is still in force.
	 *
	 * <p><b>A promise larger than the fee cannot drive the transfer below nothing</b>, because it is
	 * settled by {@link #against} exactly as a balance would be. The one road by which it can exceed
	 * the fee is the price list being edited downwards between two looks, and that is a boundary named
	 * rather than settled: the promise is per season and carries no price, so nothing here can tell
	 * which price list a slip was minted from.
	 *
	 * @param today    the settlement his fee and his book would produce right now
	 * @param promised what the code said, from {@code balance_promise}
	 * @throws IllegalArgumentException when the promise is in a currency that is not the fee's. <b>That
	 *                                 is a state the portal makes UNREACHABLE rather than one anybody
	 *                                 handles</b>, and the difference is deliberate:
	 *                                 {@code MeWriteApi} deletes every promise a member holds the
	 *                                 moment the money he is billed in changes, so a promise reaching
	 *                                 here is always in today's money. Written as a branch instead it
	 *                                 would be a branch nothing can enter, which no case in this portal
	 *                                 could cover and no mutation could find; left as a refusal it is
	 *                                 loud if that deletion is ever lost
	 */
	public static Settlement asThePromiseStands(Settlement today, Money promised) {
		Objects.requireNonNull(today, "today");

		Settlement onThePromise = against(today.fee(), promised);

		return new Settlement(today.fee(), today.balance(), onThePromise.fromTheBalance(),
				onThePromise.toTransfer(), today.coveredByTheBalance());
	}

	/**
	 * WHAT IS STILL OWED AFTER MONEY HAS ARRIVED, and nothing when enough of it has.
	 *
	 * <p><b>This is the moderator's door and the number his tick box is asked about.</b> PDL section
	 * 19, case 2: „manji, balans pokriva razliku ... balans se umanjuje", and case 3: „ako je ukucan
	 * neki iznos koji je manji od predvidjenog, ukljucen balans koji kad se iskoristi potpuno i dalje
	 * nije ukupan zbir jednak ocekivanog ... zelim prompt Prihvatam umanjen ukupan iznos? Da / Ne."
	 * Both of them are about the difference between what was expected and what came, so that
	 * difference is a thing with a name.
	 *
	 * <p><b>Nothing rather than a negative, and that is the answer to case 7 as much as to case 1.</b>
	 * A member who sent exactly what was expected owes nothing more; one who sent MORE owes nothing
	 * more either, and what he sent too much of is {@link #whatArrivedInExcess}, a different question
	 * with a different answer. Returning a negative would make one number mean both.
	 *
	 * @throws IllegalArgumentException when the two are in different currencies
	 */
	public static Money whatIsStillOwed(Money expected, Money received) {
		inTheSameCurrency(expected, received);

		return received.amount().compareTo(expected.amount()) >= 0
				? Money.nothingIn(expected.currency())
				: new Money(expected.amount().subtract(received.amount()), expected.currency());
	}

	/**
	 * WHAT ARRIVED OVER AND ABOVE WHAT WAS EXPECTED, and nothing when none did.
	 *
	 * <p><b>Owner, 27.09.2026 (PDL, section 19, case 7):</b> money greater than expected means
	 * „aktivacija prolazi, visak ulazi u balans kao kredit". PDL records why that was chosen over the
	 * two other outcomes offered: „balans vec postoji kao mesto gde stoji clanov novac kod nas, pa se
	 * visak ne izmislja nigde drugde i clan ne gubi ono sto je poslao."
	 *
	 * <p><b>Measured against the EXPECTED total and therefore against the processing fee too</b>, for
	 * the reason this class's own note gives: the owner defined „Ocekivan iznos" as what the member
	 * sends, fee included, and a surplus is whatever he sent beyond that.
	 *
	 * @throws IllegalArgumentException when the two are in different currencies
	 */
	public static Money whatArrivedInExcess(Money expected, Money received) {
		inTheSameCurrency(expected, received);

		return received.amount().compareTo(expected.amount()) <= 0
				? Money.nothingIn(expected.currency())
				: new Money(received.amount().subtract(expected.amount()), expected.currency());
	}

	/**
	 * THE SAME MONEY SAID IN THE OTHER CURRENCY, at the one rate the owner fixed.
	 *
	 * <p><b>Owner, 27.09.2026 (PDL, section 26):</b> „Dvojka, 120 je kurs i tako ostaje do daljnjeg."
	 * A member who changes country keeps what he has and it is restated in the money he is now billed
	 * in - he neither earns nor spends anything by moving.
	 *
	 * <p><b>Rounded HALF_UP to two decimals, which is the portal's rule and not a choice made
	 * here:</b> {@code BtlScoreCalculator} rounds its points that way and {@code WhatAResultChangeSays}
	 * its printed numbers, and every money column in the schema is {@code numeric(10,2)}. The one
	 * place it can bite is dinars into euro, where 650 becomes 5.42 and four dinars have nowhere to
	 * go; euro into dinars is exact for every amount two decimals can hold. <b>Which way those four
	 * dinars fall is decided by the portal's existing rounding and not by anybody's view of who should
	 * get them</b>, and it is written down here so that the next reader does not read HALF_UP as a
	 * favour to one side.
	 *
	 * <p><b>Asking for the currency it is already in gives it back unchanged rather than throwing</b>,
	 * because the caller that asks is the one that has just seen a member change country, and a member
	 * who moves from Germany to France has changed country without changing currency. That case
	 * writes no line at all, and it is the route's job to notice, but answering it here keeps the
	 * arithmetic total rather than leaving a hole somebody has to remember.
	 *
	 * @param what what he has
	 * @param into the currency he is billed in from now on
	 */
	public static Money translated(Money what, Currency into) {
		Objects.requireNonNull(what, "what");
		Objects.requireNonNull(into, "into");

		if (what.currency() == into) {
			return what;
		}

		BigDecimal restated = into == Currency.RSD
				? what.amount().multiply(DINARS_TO_THE_EURO)
				: what.amount().divide(DINARS_TO_THE_EURO, DECIMALS, RoundingMode.HALF_UP);

		return new Money(restated.setScale(DECIMALS, RoundingMode.HALF_UP), into);
	}

	/**
	 * THE REFUSAL THAT MAKES ONE AMOUNT SAFE, and it is an exception rather than a branch on purpose.
	 *
	 * <p>There is no right answer to „what is 40 EUR less 600 RSD" that this class is allowed to give:
	 * converting is what ADL forbids for prices, and picking one side is silently wrong by a factor of
	 * a hundred and twenty. A caller that gets here has lost track of whose currency it is holding,
	 * which is a fault in the caller and not a state to be handled, so it says so loudly and at the
	 * place it happened. Every route above it reads one currency off the member's country and uses
	 * that same one throughout, and the cases that prove it do so by swapping a member's currency for
	 * the other one and requiring a failure rather than a wrong number.
	 */
	private static void inTheSameCurrency(Money one, Money other) {
		Objects.requireNonNull(one, "one");
		Objects.requireNonNull(other, "other");

		if (one.currency() != other.currency()) {
			throw new IllegalArgumentException(
					"two currencies cannot be compared or subtracted: " + one.currency()
							+ " and " + other.currency());
		}
	}
}
