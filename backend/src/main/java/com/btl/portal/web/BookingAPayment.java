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
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * BOOKING A PAYMENT THAT ARRIVED, ONCE, FOR THE TWO DOORS THAT SAY IT DID.
 *
 * <p><b>Why a class of its own, since 18.10.2026.</b> The owner that day (PDL P8, the section
 * „Osnov članstva ima jedan dom”): „Na redu člana u moderaciji: upis uplate za sezonu”, and „Upis
 * uplate na redu člana: kaže se „uplata” i koliko je dinara uplaćeno; ostatak do članarine se skida
 * sa balansa.” The journal derives in the same entry that it is „isto pravilo kao na redu za
 * aktivaciju na ekranu Uplate (umanjen iznos iz balansa, višak u balans, P8/P21), ne novo”. One rule
 * with two doors is one body of code with two callers, so what {@link PaymentApi} did after its own
 * checks moved here unchanged, and {@link MemberPaymentApi} calls the same method.
 *
 * <p><b>Moved, not rewritten.</b> Every statement below is the one {@link PaymentApi} ran until this
 * class existed, in the same order, and {@link PaymentApi}'s own heading still describes what each of
 * the three outcomes of {@link RecordingAPayment} does. There were four, and the one that refused a
 * reversed payment went on 18.10.2026 with the state it was about (V64; PDL P8, „zapis o uplati se
 * BRIŠE”). The words a refusal is answered with stay on
 * {@link PaymentApi} as well, because the screen's map of them is held against that file
 * ({@code frontend/src/pages/account/refusals.test.ts}).
 *
 * <p><b>Opens no transaction of its own</b>: each door opens the one it books in, and each door that
 * books here ({@link MemberPaymentApi}, {@link PaymentApi}, {@link MemberMembershipApi}, and since
 * 25.10.2026 {@link StatementApi}, a bank statement booking a payment by itself) takes the member's row
 * {@code for update} first and holds that lock across all of this. The method does not take it itself,
 * so a fifth caller must.
 */
@Component
class BookingAPayment {

	/**
	 * What one booking answered, and the season it was about.
	 *
	 * @param answer what the door answers with, unchanged
	 * @param season the season the booking was for, read once off the clock; null only when the
	 *               competitor was not there, before any season was read
	 */
	record Booked(ResponseEntity<?> answer, Integer season) {
	}

	private final JdbcClient db;

	private final Clock clock;

	/**
	 * WHERE A NUMBER COMES FROM, and since 27.09.2026 it is not this class, nor PaymentApi.
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

	BookingAPayment(JdbcClient db, Clock clock, MemberNumbers numbers, MemberOfAccount memberOfAccount,
			PriceRows priceRows, BalanceBook book, CurrencyOfMember currencyOf) {
		this.db = db;
		this.clock = clock;
		this.numbers = numbers;
		this.memberOfAccount = memberOfAccount;
		this.priceRows = priceRows;
		this.book = book;
		this.currencyOf = currencyOf;
	}

	/**
	 * THE BOOKING, FOR A SEASON THE CALLER HAS ALREADY READ OFF THE CLOCK.
	 *
	 * <p><b>The day the money is booked, never a day anybody types</b> (PDL, POTVRDJENO 13.09.2026):
	 * every caller reads {@link SeasonClock#seasonBeingPaidFor} once, the same call
	 * {@link RegistrationApi} makes for the same instant, and hands it here, so the lookup below and the
	 * row {@code recordIt} writes name one season. The season is still the clock's, never the request's.
	 *
	 * <p><b>Read by the caller and not here, since 19.10.2026</b>, because every caller asks something
	 * else about the same season around the booking. {@link MemberMembershipApi} takes an exemption off a
	 * season and books a payment in its place, and the two must be about one season. The two payment
	 * doors ({@link PaymentApi}, {@link MemberPaymentApi}) ask whether the beginners' category was open
	 * before the booking and after it ({@link ABeginnersCategoryAMembershipMoves}). Two readings of the
	 * clock would part across midnight of 11 November. Until that day this class also had an overload
	 * that read the clock itself, for the two payment doors; it went when they stopped needing it.
	 */
	Booked book(PaymentApi.Confirm typed, String reference, WhoIsAsking.Member asking, int season) {
		Optional<CompetitorRow> competitor = db.sql(
						"select id, birth_date, member_number from competitor where id = ?")
				.param(typed.competitorId())
				.query((row, i) -> new CompetitorRow(row.getLong(1), row.getDate(2).toLocalDate(),
						row.getString(3)))
				.optional();

		if (competitor.isEmpty()) {
			return new Booked(PaymentApi.no(HttpStatus.BAD_REQUEST,
					PaymentApi.THE_COMPETITOR_DOES_NOT_EXIST), null);
		}

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

		ResponseEntity<?> answer = switch (outcome) {
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
					yield PaymentApi.no(HttpStatus.CONFLICT, PaymentApi.THE_REFERENCE_IS_TAKEN);
				}

				/* AND THE SEASON ITSELF, ASKED HERE FOR THE SAME REASON THE REFERENCE
				   IS: this is the only branch that inserts a `membership` row, so it
				   is the only branch the key can be taken under. `ALREADY_RECORDED`
				   cannot reach it - a payment in that state was written by this class
				   in one transaction with its own membership row, so the key it would
				   find is the very row it is about to answer with. */
				if (theSeasonIsAlreadyHeld(competitor.get().id(), season)) {
					yield PaymentApi.no(HttpStatus.CONFLICT, PaymentApi.THE_MEMBERSHIP_IS_ALREADY_HELD);
				}
				yield recordIt(typed, season, reference, competitor.get(), asking, his,
						outcome == Outcome.RECORD_IT_AND_NUMBER_HIM);
			}
		};

		return new Booked(answer, season);
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
		return ResponseEntity.ok(new PaymentApi.Confirmed(existing.id(), competitor.memberNumber(),
				amounts.amount(), amounts.fee(), amounts.currency(), amounts.received(),
				book.whatAMembershipTook(competitor.id(), amounts.season(), his),
				Balance.Money.nothingIn(his)));
	}

	private ResponseEntity<?> recordIt(PaymentApi.Confirm typed, int season, String reference,
			CompetitorRow competitor,
			WhoIsAsking.Member asking, Currency his, boolean numbering) {

		LocalDate today = LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE);
		List<MembershipPrice.Row> rows = priceRows.all();
		MembershipPrice.Price price = MembershipPrice.on(rows, today,
				competitor.birthDate().getYear(), season, his);

		/* AND WHETHER THE PRICE LIST IS ASKING FOR ANYTHING AT ALL, WHICH IS THE ONE REFUSAL ON THIS
		   ROUTE THAT IS ABOUT A FIELD NOBODY HERE TYPED. `PaymentApi.THE_MEMBERSHIP_COSTS_NOTHING` carries the
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
			return PaymentApi.no(HttpStatus.CONFLICT, PaymentApi.THE_MEMBERSHIP_COSTS_NOTHING);
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
		Balance.Money expected = new Balance.Money(price.expected(), his);
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
		book.aReferralWasActivated(competitor.id(), season, asking.account(), recordedByName);

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

		return ResponseEntity.status(HttpStatus.CREATED).body(new PaymentApi.Confirmed(paymentId, memberNumber,
				price.amount(), price.fee(), his.name(), written.received(), fromTheBalance, credited));
	}

	private record CompetitorRow(long id, LocalDate birthDate, String memberNumber) {
	}

	private record ExistingPayment(long id, String state) {
	}
}
