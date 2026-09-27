package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.member.MemberNumber;
import com.btl.portal.domain.payment.RecordingAPayment;
import com.btl.portal.domain.payment.RecordingAPayment.Outcome;
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
 * <li>{@link Outcome#RECORD_IT_AND_NUMBER_HIM} - a number is drawn from
 * {@link MemberNumbers} (a sequence and never a query, for the reason V16 gives: a
 * query reads what is there, and what is there is missing exactly the people who
 * left), the payment is written {@code recorded}, and a {@code membership} row is
 * written beside it naming the receipt (ADL A12).
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
 * instant, both reading no existing row before either writes, both draw two
 * DIFFERENT numbers - the sequence guarantees that much and is what the case in
 * {@code PaymentApiTest} measures - but the second {@code insert} then loses to
 * {@code payment_one_a_season} and answers 500, its drawn number already spent
 * for good. Nothing in this increment's brief asks the
 * SAME payment to be idempotent under true simultaneity, only that two DIFFERENT
 * people never receive the same number; catching that race and folding it back
 * into {@code ALREADY_RECORDED} is a real improvement and a separate one.
 * <li>A {@code payment} row already sitting as {@code awaited} for this
 * (competitor, season) - which nothing on this portal writes today, but which
 * V16's own {@code default 'awaited'} leaves room for - is read exactly like no
 * row at all and then {@code insert}ed as though it were one, which collides with
 * {@code payment_one_a_season} and answers 500 rather than completing it. Turning
 * that {@code insert} into an update of the row already there is real work with
 * its own guard, and nothing writes the row it would protect yet.
 * </ul>
 */
@RestController
class PaymentApi {

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	static final String THE_CURRENCY_IS_NOT_KNOWN = "theCurrencyIsNotKnown";

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

	/** {@code payment_currency_known}, V16. */
	private static final Set<String> CURRENCIES = Set.of("EUR", "RSD");

	/** {@code payment_method_known}, V16. */
	private static final Set<String> METHODS = Set.of("slip", "card", "paypal", "sepa");

	/** {@code payment_reference_shape}, V16: digits and nothing else, off a bank statement. */
	private static final Pattern A_REFERENCE = Pattern.compile("^[0-9]{7,}$");

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

	PaymentApi(JdbcClient db, Clock clock, MemberNumbers numbers, TransactionTemplate inOneTransaction,
			MemberOfAccount memberOfAccount, PriceRows priceRows, BalanceBook book) {
		this.db = db;
		this.clock = clock;
		this.numbers = numbers;
		this.inOneTransaction = inOneTransaction;
		this.memberOfAccount = memberOfAccount;
		this.priceRows = priceRows;
		this.book = book;
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
	 * @param competitorId {@code competitor.id}, never the member number - the
	 *                     population this route exists for is exactly the one that
	 *                     may not have one yet
	 * @param currency     which of the association's two accounts the money is in,
	 *                     {@code EUR} or {@code RSD} - a fact about the bank
	 *                     statement, not a choice of price
	 * @param method       how it arrived, one of the four V16 lists
	 * @param reference    the poziv na broj, when the statement carries one; null for
	 *                     a first payment, which has no number yet to write on a slip
	 *                     (V16)
	 */
	record Confirm(Long competitorId, String currency, String method, String reference) {
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
	record Confirmed(long paymentId, String memberNumber, BigDecimal amount, BigDecimal fee, String currency,
			Balance.Money fromTheBalance) {
	}

	private record CompetitorRow(long id, LocalDate birthDate, String memberNumber) {
	}

	private record ExistingPayment(long id, String state) {
	}

	@PostMapping("/api/payments")
	@RightIsNeeded("queue:payments")
	ResponseEntity<?> confirm(@RequestBody Confirm typed,
			@AuthenticationPrincipal WhoIsAsking.Member asking) {

		if (typed.competitorId() == null || isNothing(typed.currency()) || isNothing(typed.method())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		if (!CURRENCIES.contains(typed.currency())) {
			return no(HttpStatus.BAD_REQUEST, THE_CURRENCY_IS_NOT_KNOWN);
		}

		if (!METHODS.contains(typed.method())) {
			return no(HttpStatus.BAD_REQUEST, THE_METHOD_IS_NOT_KNOWN);
		}

		String reference = isNothing(typed.reference()) ? null : typed.reference().strip();

		if (reference != null && !A_REFERENCE.matcher(reference).matches()) {
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

		return switch (outcome) {
			case A_REVERSAL_IS_NOT_UNDONE_HERE -> no(HttpStatus.CONFLICT, THE_PAYMENT_WAS_REVERSED);
			case ALREADY_RECORDED -> alreadyRecorded(existing.orElseThrow(), competitor.get());
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
				yield recordIt(typed, season, reference, competitor.get(), asking,
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
	private ResponseEntity<?> alreadyRecorded(ExistingPayment existing, CompetitorRow competitor) {
		record Amounts(BigDecimal amount, BigDecimal fee, String currency, int season) {
		}

		Amounts amounts = db.sql("select amount, fee, currency, season from payment where id = ?")
				.param(existing.id())
				.query((row, i) -> new Amounts(row.getBigDecimal(1), row.getBigDecimal(2), row.getString(3),
						row.getInt(4)))
				.single();

		/* WHAT THE BALANCE PAID WHEN THIS WAS RECORDED, read back rather than recomputed. This
		   branch writes nothing, so recomputing would answer with TODAY'S balance - which has since
		   had this very spend taken out of it - and report a smaller number than the one the member
		   was actually credited. The book is the record of what happened; asking it is the only
		   answer that stays true. */
		return ResponseEntity.ok(new Confirmed(existing.id(), competitor.memberNumber(), amounts.amount(),
				amounts.fee(), amounts.currency(), book.whatAMembershipTook(competitor.id(), amounts.season())));
	}

	private ResponseEntity<?> recordIt(Confirm typed, int season, String reference, CompetitorRow competitor,
			WhoIsAsking.Member asking, boolean numbering) {

		LocalDate today = LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE);
		List<MembershipPrice.Row> rows = priceRows.all();
		MembershipPrice.Price price = MembershipPrice.on(rows, MonthDay.from(today),
				competitor.birthDate().getYear(), season, "EUR".equals(typed.currency()));

		long priceRowId = db.sql("select id from price_row where key = ?")
				.param(price.key()).query(Long.class).single();

		String recordedByName = memberOfAccount.nameOf(asking.account());

		Timestamp now = Timestamp.from(clock.instant());

		String memberNumber = numbering ? numbers.draw().written() : competitor.memberNumber();

		if (numbering) {
			db.sql("update competitor set member_number = ?, active = true where id = ?")
					.params(memberNumber, competitor.id()).update();
		} else {
			db.sql("update competitor set active = true where id = ?")
					.param(competitor.id()).update();
		}

		long paymentId = db.sql("insert into payment (competitor_id, season, reference, price_row_id,"
						+ " amount, currency, fee, method, state, recorded_at, recorded_by, recorded_by_name)"
						+ " values (?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?, ?)"
						+ " returning id")
				.params(competitor.id(), season, reference, priceRowId, price.amount(),
						typed.currency(), price.fee(), typed.method(), now, asking.account(), recordedByName)
				.query(Long.class).single();

		db.sql("insert into membership (competitor_id, season, basis, payment_id) values (?, ?, 'payment', ?)")
				.params(competitor.id(), season, paymentId).update();

		/* AND NOW, AND NOT ONE MOMENT EARLIER, THE BALANCE IS SPENT. Owner, 26.09.2026: „balans se
		   skida tek kad uplata bude proknjizena. Ako clan ne plati, balans mu ostaje."

		   WHAT IS TAKEN IS WHAT THE CODE PROMISED, NOT WHAT THE BOOK SAYS TODAY. Owner, 27.09.2026:
		   „skida se ono sto je kod obecao, ne ono sto balans stoji na dan knjizenja" - so a member
		   whose balance grew between minting and paying keeps the growth, and one whose balance was
		   spent by another season in the meantime is honoured only as far as there is money. That cap
		   is the whole of `Balance.honouring`, which is also where the reason for it is written.

		   AND AN ABSENT PROMISE IS NOT A PROMISE OF NOTHING, it is nobody ever having been offered a
		   discount: he was shown the price list's own figure and paid it, so his book is untouched.
		   `GET /api/me/membership` is the only place a reduced amount is computed and it records
		   every one it computes, which is what makes this the same fact rather than two. */
		Balance.Money fromTheBalance = book.promised(competitor.id(), season)
				.map(promised -> Balance.honouring(promised, book.of(competitor.id())))
				.orElse(Balance.Money.NOTHING);

		/* A row that moves nothing is refused by `balance_entry_a_membership_takes` (V36), and it is
		   refused on purpose: a member with an empty book has nothing to record. */
		if (!fromTheBalance.isNothing()) {
			book.spentOnAMembership(competitor.id(), season, fromTheBalance, asking.account(), recordedByName);
		}

		/* AND WHOEVER BROUGHT HIM IN IS PAID, at this moment and for this reason: PDL, „Iznos leže
		   na balans automatski, u trenutku kad se novom članu aktivira članarina, ne u trenutku
		   registracije". Once per member brought in however many seasons he goes on to pay for, and
		   what holds that is `balance_entry_one_a_referral` (V36) rather than a question asked here. */
		book.aReferralWasActivated(competitor.id(), asking.account(), recordedByName);

		return ResponseEntity.status(HttpStatus.CREATED).body(new Confirmed(paymentId, memberNumber,
				price.amount(), price.fee(), typed.currency(), fromTheBalance));
	}

	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
