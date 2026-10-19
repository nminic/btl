package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.membership.Basis;
import com.btl.portal.domain.membership.WhatAMembershipChangeSays;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.Set;

/**
 * A SEASON CANCELLED, OR ITS BASIS CHANGED, FROM THE MEMBER'S ROW IN THE MODERATION OF THE MEMBERS.
 *
 * <p><b>The owner, 18.10.2026</b> (PDL P8, the section „Osnov članstva ima jedan dom”): „Osnov se
 * menja i uplata stornira opcijama na redu člana u moderaciji članova, ne posebnim ekranom.” And,
 * each chosen with the recommendation unless said otherwise:
 *
 * <ul>
 * <li>„Promene osnova na redu člana idu u oba smera. Oslobođenje se može povući (storno) i preko njega
 * se može upisati uplata; aktivacija iz balansa se može stornirati, uz protivstavku u knjizi.”
 * <li>„Iz aktivacije iz balansa se na redu ne prelazi direktno u uplatu ni u oslobođenje: storno
 * (balans se vraća protivstavkom), pa nova radnja.”
 * <li>„Kad se osnov promeni iz „uplata” ili se uplata stornira, zapis o uplati se BRIŠE.” (chosen
 * between the outcomes put to him, against the recommendation)
 * <li>„Storno: ... posle potvrde se brišu zapis o uplati i zapis o članstvu za tu sezonu, uz trag ko i
 * kada; članski broj ostaje rezervisan (14.09.2026); rezultati koje je član već imao ostaju na
 * profilu.”
 * <li>„Knjiga balansa pri stornu i pri promeni „uplata” u oslobođenje: protivstavka.”
 * <li>„Trag storna i promene osnova živi u posebnom zapisu koji se ne menja, BEZ iznosa.”
 * <li>„Upis uplate, promena osnova i storno stižu članu kao poruka u portalskom sandučetu, sa sezonom
 * i novim stanjem, bez mejla.”
 * <li>„Obećan popust iz balansa za storniranu sezonu se briše”.
 * <li>„Nagrada preporučiocu ostaje kad se članstvo preporučenog stornira; preporučilac se ne
 * obaveštava”.
 * </ul>
 *
 * <p><b>TWO ROUTES ON ONE ADDRESS</b>, the membership of the season on sale: {@code DELETE} cancels it
 * (the owner's „storno”), {@code PUT} changes its basis. The two changes there are are the two the
 * owner named, {@code payment} to {@code feeExempt} and back; anything else is
 * {@link #THIS_CHANGE_IS_NOT_OFFERED}, a balance included by his decision above, and a balance is
 * never the basis a change leads to („balans se ne bira ručno kao osnov”).
 *
 * <p><b>THE SEASON IS THE CLOCK'S, READ ONCE.</b> PDL P8, „Koje sezone: do 14.10. samo tekuća, od
 * 15.10. samo naredna. Tekuća sezona se posle 14.10. na redu člana ne dira”: that is
 * {@link SeasonClock#seasonBeingPaidFor}, the season {@link MembersApi} serves the basis of, and the only
 * season these routes can touch. Nothing in a request names one. The one reading feeds the rows, the
 * book, the trail, the message and, when an exemption is replaced by a payment, the booking itself
 * ({@link BookingAPayment#book(PaymentApi.Confirm, String, WhoIsAsking.Member, int)}), so nothing here
 * can be about two years across midnight of 15 October.
 *
 * <p><b>THE REQUEST SAYS WHAT THE SCREEN SHOWED, AND THE ROUTE ACTS ONLY ON THAT.</b> PDL P8, recorded
 * as a derivation and told to the owner, who may object: „Zahtev za storno ili promenu nosi osnov koji
 * je ekran pokazao; ako se razlikuje od stanja u bazi, odbija se uz rečenicu (409), a ako nema ničega
 * za storno, odgovor je uspeh bez upisa.” So a season standing on another basis than the one sent is
 * refused with {@link #THE_BASIS_HAS_CHANGED}, and a season with nothing to cancel is answered as done
 * and writes nothing. <b>My reasoning, beyond that sentence:</b> a change whose basis the season
 * already stands on is answered as done and writes nothing too, which is the harmless repeat
 * {@code RecordingAPayment} and {@link MembershipWriteApi} keep for a second press; read literally,
 * the sentence would refuse it, since the screen sent the basis it saw before the first press
 * landed. The cost, written down rather than found: a
 * cancellation, a new payment on the same basis by somebody else, and then a stale second press would
 * cancel the new payment, because a basis is all a request can name.
 *
 * <p><b>WHO MAY</b>: „Ko sme: superadmin i moderator sa pravom nad članovima, uz trag ko i kada.” That is
 * {@link CompetitorApi#OVER_THE_MEMBERS}, the right the row is read under; anybody else signed in is
 * answered 404 (ADL A8). On his own row as well („Moderator i superadmin smeju da rade na sopstvenom
 * redu, uz trag koji ih imenuje”), so nothing compares the account with the member.
 *
 * <p><b>THE MEMBER'S ROW IS LOCKED FIRST</b>, {@code for update}, before anything is read, and that is
 * not only {@link MemberPaymentApi}'s reason. {@link BalanceBook#reversed} reads the book and writes
 * from what it read, so two cancellations at one instant would both give the balance back; held here,
 * the second waits, finds the season gone, and is the harmless repeat.
 * {@code MemberMembershipTwiceAtOneInstantTest} measures it.
 *
 * <p><b>WHAT A CANCELLATION LEAVES</b>: the member's number (14.09.2026), his results (they stop
 * counting in that season and come back with a new membership, PDL P8, „Storno jedine sezone:
 * rezultati se ne brišu”), the referrer's reward, and {@code active} as the rows that remain say it:
 * „aktivan je onaj ko ima zapis za tekuću sezonu, a u prelaznom roku i onaj ko ga ima za narednu” (PDL
 * P8, 13.09.2026). It is the first door of the portal that can make a member inactive, so it is never
 * written {@code false} blindly: a member cancelled for next season who holds the running one stays
 * active.
 */
@RestController
class MemberMembershipApi {

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** A word for a basis that the schema does not hold. */
	static final String THE_BASIS_IS_NOT_KNOWN = "theBasisIsNotKnown";

	/**
	 * A change the owner did not give the row: anything but {@code payment} to {@code feeExempt} and
	 * back, so from a balance and to a balance as well (PDL P8, 18.10.2026, „Iz aktivacije iz balansa se
	 * na redu ne prelazi direktno u uplatu ni u oslobođenje”).
	 */
	static final String THIS_CHANGE_IS_NOT_OFFERED = "thisChangeIsNotOffered";

	/** The season stands on another basis than the one the screen showed, so nothing is done. */
	static final String THE_BASIS_HAS_CHANGED = "theBasisHasChanged";

	/** The two changes there are, as „from to". */
	private static final Set<String> OFFERED = Set.of(
			Basis.PAYMENT.word() + " " + Basis.FEE_EXEMPT.word(),
			Basis.FEE_EXEMPT.word() + " " + Basis.PAYMENT.word());

	private final JdbcClient db;

	private final Clock clock;

	private final TransactionTemplate inOneTransaction;

	private final BalanceBook book;

	private final BookingAPayment booking;

	private final GrantingASeason granting;

	private final CurrencyOfMember currencyOf;

	private final MemberOfAccount memberOfAccount;

	MemberMembershipApi(JdbcClient db, Clock clock, TransactionTemplate inOneTransaction, BalanceBook book,
			BookingAPayment booking, GrantingASeason granting, CurrencyOfMember currencyOf,
			MemberOfAccount memberOfAccount) {
		this.db = db;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
		this.book = book;
		this.booking = booking;
		this.granting = granting;
		this.currencyOf = currencyOf;
		this.memberOfAccount = memberOfAccount;
	}

	/** @param basis the basis the screen showed for the season, which is the one cancelled */
	record Cancelling(String basis) {
	}

	/**
	 * @param from     the basis the screen showed
	 * @param to       the basis the season is to stand on
	 * @param received for a payment only: what arrived, in his money, refused as the payments screen
	 *                 refuses it ({@link PaymentApi#whatIsWrongWith})
	 * @param method   for a payment only: how it arrived, one of {@link PaymentApi#METHODS}
	 */
	record Changing(String from, String to, BigDecimal received, String method) {
	}

	/**
	 * What the season stands on now, and which season it is.
	 *
	 * @param basis {@code null} once it is cancelled
	 */
	record Changed(int season, String basis) {
	}

	record Refused(String reason) {
	}

	/** What the season holds, read under the lock. */
	private record Held(String basis, Long paymentId) {
	}

	@DeleteMapping("/api/members/{memberNumber}/membership")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<?> cancel(@PathVariable String memberNumber, @RequestBody Cancelling typed,
			@AuthenticationPrincipal WhoIsAsking.Member asking) {

		return inOneTransaction.execute(committing -> cancelling(memberNumber, typed, asking));
	}

	@PutMapping("/api/members/{memberNumber}/membership")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<?> change(@PathVariable String memberNumber, @RequestBody Changing typed,
			@AuthenticationPrincipal WhoIsAsking.Member asking) {

		return inOneTransaction.execute(committing -> changing(memberNumber, typed, asking));
	}

	/**
	 * <p><b>THE ORDER OF THE REFUSALS</b> is {@link MemberPaymentApi}'s: a number nobody has is answered
	 * first, then what the request says, then what the season holds.
	 */
	private ResponseEntity<?> cancelling(String memberNumber, Cancelling typed, WhoIsAsking.Member asking) {
		Optional<Long> member = locked(memberNumber);

		if (member.isEmpty()) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}

		if (typed.basis() == null || typed.basis().isBlank()) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		if (!known(typed.basis())) {
			return no(HttpStatus.BAD_REQUEST, THE_BASIS_IS_NOT_KNOWN);
		}

		ZonedDateTime now = ZonedDateTime.now(clock);
		int season = SeasonClock.seasonBeingPaidFor(now);
		Optional<Held> held = heldIn(member.get(), season);

		/* NOTHING TO CANCEL IS DONE ALREADY, and nothing is written or said. */
		if (held.isEmpty()) {
			return ResponseEntity.ok(new Changed(season, null));
		}

		if (!held.get().basis().equals(typed.basis())) {
			return no(HttpStatus.CONFLICT, THE_BASIS_HAS_CHANGED);
		}

		String name = memberOfAccount.nameOf(asking.account());

		/* THE ROWS GO, „zapis o uplati i zapis o članstvu za tu sezonu". A payment takes its membership
		   with it by `membership_payment_fk` (V22, ON DELETE CASCADE), so the payment is what is
		   deleted; the other two bases have no payment and the membership itself goes. */
		gone(member.get(), season, held.get());

		/* WHAT THE SEASON HELD AGAINST THE BALANCE COMES BACK OFF IT, by a line of its own, under the
		   lock taken above (see `BalanceBook.reversed`). An exemption held nothing, and nothing is
		   written for it. */
		book.reversed(member.get(), season, currencyOf.of(member.get()), asking.account(), name);

		/* AND THE PROMISE OF THAT SEASON IS GONE, so his next look at „Moja članarina" mints a new
		   code against the book as it now stands. */
		book.forgetThePromise(member.get(), season);

		/* AND `active` IS WHAT THE ROWS THAT REMAIN SAY, from the same reading of the clock: the season
		   being run, and in the window the next one, which `seasonBeingPaidFor` is exactly when the
		   window is open. Outside the window the two are one season, and the one just cancelled. */
		db.sql("update competitor set active = exists(select 1 from membership m"
						+ " where m.competitor_id = competitor.id and m.season in (?, ?)) where id = ?")
				.params(SeasonClock.seasonBeingRun(now), season, member.get())
				.update();

		trail(member.get(), season, "cancelled", held.get().basis(), null, asking.account(), name);
		tell(member.get(), WhatAMembershipChangeSays.cancelled(season));

		return ResponseEntity.ok(new Changed(season, null));
	}

	private ResponseEntity<?> changing(String memberNumber, Changing typed, WhoIsAsking.Member asking) {

		Optional<Long> member = locked(memberNumber);

		if (member.isEmpty()) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}

		if (typed.from() == null || typed.from().isBlank() || typed.to() == null || typed.to().isBlank()) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		if (!known(typed.from()) || !known(typed.to())) {
			return no(HttpStatus.BAD_REQUEST, THE_BASIS_IS_NOT_KNOWN);
		}

		if (!OFFERED.contains(typed.from() + " " + typed.to())) {
			return no(HttpStatus.BAD_REQUEST, THIS_CHANGE_IS_NOT_OFFERED);
		}

		int season = SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock));
		Optional<Held> held = heldIn(member.get(), season);

		/* THE SEASON ALREADY STANDS ON WHAT WAS ASKED FOR: the second press, answered as done. */
		if (held.isPresent() && held.get().basis().equals(typed.to())) {
			return ResponseEntity.ok(new Changed(season, typed.to()));
		}

		if (held.isEmpty() || !held.get().basis().equals(typed.from())) {
			return no(HttpStatus.CONFLICT, THE_BASIS_HAS_CHANGED);
		}

		return Basis.PAYMENT.word().equals(typed.to())
				? aPaymentOverTheExemption(member.get(), season, held.get(), typed, asking)
				: anExemptionOverThePayment(member.get(), season, held.get(), asking);
	}

	/**
	 * „Uplata” TO THE EXEMPTION. The payment goes and its membership with it, what the season held
	 * against the balance comes back off it, and the season is granted free of the fee with the trail
	 * every act that forgives money carries (PDL P8, 03.10.2026), by the very statements the payments
	 * screen grants it with ({@link GrantingASeason}). The member keeps his number and stays active,
	 * because the season still stands; the referrer's reward was paid with the payment and is not paid
	 * twice ({@code balance_entry_one_a_referral}, V38).
	 */
	private ResponseEntity<?> anExemptionOverThePayment(long member, int season, Held held,
			WhoIsAsking.Member asking) {

		String name = memberOfAccount.nameOf(asking.account());
		String number = db.sql("select member_number from competitor where id = ?")
				.param(member).query(String.class).single();

		gone(member, season, held);
		book.reversed(member, season, currencyOf.of(member), asking.account(), name);
		granting.grant(member, number, season, Basis.FEE_EXEMPT.word(),
				Balance.Money.nothingIn(currencyOf.of(member)), true, asking.account());

		trail(member, season, "basisChanged", held.basis(), Basis.FEE_EXEMPT.word(), asking.account(), name);
		tell(member, WhatAMembershipChangeSays.basisChanged(season, Basis.FEE_EXEMPT));

		return ResponseEntity.ok(new Changed(season, Basis.FEE_EXEMPT.word()));
	}

	/**
	 * THE EXEMPTION TO „uplata”: „preko njega se može upisati uplata”. The exemption goes, and the
	 * payment is booked in its place by {@link BookingAPayment}, the one booking both payment doors use,
	 * with the rest off his balance as on the row's own payment („Ostalo se skida sa balansa”). An
	 * exemption held nothing against the balance, so nothing is reversed.
	 *
	 * <p><b>A booking that refuses takes the deletion back with it</b>: the exemption is deleted behind a
	 * savepoint, the transaction goes back to it, and the booking's own answer is the answer, so a free
	 * price row leaves the exemption standing exactly as it was. A savepoint and not a transaction marked
	 * to roll back, because what is undone is exactly the deletion and nothing the transaction did before
	 * it, and because it holds whether this transaction is the request's own or one it joined. Written in
	 * SQL and not through {@code TransactionStatus.createSavepoint}, because the portal's transaction
	 * manager refuses nested transactions and that call is one (measured: {@code
	 * NestedTransactionNotSupportedException}); PostgreSQL's own {@code savepoint} is a statement inside
	 * the one transaction and asks the manager for nothing.
	 */
	private ResponseEntity<?> aPaymentOverTheExemption(long member, int season, Held held, Changing typed,
			WhoIsAsking.Member asking) {

		if (typed.method() == null || typed.method().isBlank()) {
			return PaymentApi.no(HttpStatus.BAD_REQUEST, PaymentApi.THE_FORM_IS_NOT_COMPLETE);
		}

		String wrongWithTheAmount = PaymentApi.whatIsWrongWith(typed.received());

		if (wrongWithTheAmount != null) {
			return PaymentApi.no(HttpStatus.BAD_REQUEST, wrongWithTheAmount);
		}

		if (!PaymentApi.METHODS.contains(typed.method())) {
			return PaymentApi.no(HttpStatus.BAD_REQUEST, PaymentApi.THE_METHOD_IS_NOT_KNOWN);
		}

		db.sql("savepoint before_the_exemption_went").update();

		gone(member, season, held);

		BookingAPayment.Booked booked = booking.book(
				new PaymentApi.Confirm(member, typed.received(), true, typed.method(), null), null, asking,
				season);

		if (booked.answer().getStatusCode() != HttpStatus.CREATED) {
			db.sql("rollback to savepoint before_the_exemption_went").update();

			return booked.answer();
		}

		db.sql("release savepoint before_the_exemption_went").update();

		String name = memberOfAccount.nameOf(asking.account());

		trail(member, season, "basisChanged", held.basis(), Basis.PAYMENT.word(), asking.account(), name);
		tell(member, WhatAMembershipChangeSays.basisChanged(season, Basis.PAYMENT));

		return ResponseEntity.ok(new Changed(season, Basis.PAYMENT.word()));
	}

	/** The member's row, locked for the rest of the transaction, or nothing for a number nobody has. */
	private Optional<Long> locked(String memberNumber) {
		return db.sql("select id from competitor where member_number = ? for update")
				.param(memberNumber)
				.query(Long.class)
				.optional();
	}

	private static boolean known(String word) {
		for (Basis basis : Basis.values()) {
			if (basis.word().equals(word)) {
				return true;
			}
		}

		return false;
	}

	private Optional<Held> heldIn(long member, int season) {
		return db.sql("select basis, payment_id from membership where competitor_id = ? and season = ?")
				.params(member, season)
				.query((row, i) -> new Held(row.getString(1), row.getObject(2, Long.class)))
				.optional();
	}

	/** The season's rows go: the payment, which takes its membership with it, or the membership. */
	private void gone(long member, int season, Held held) {
		if (held.paymentId() != null) {
			db.sql("delete from payment where id = ?").param(held.paymentId()).update();
		}
		else {
			db.sql("delete from membership where competitor_id = ? and season = ?")
					.params(member, season).update();
		}
	}

	/** The trail, without an amount, by the owner's decision; who and when from this request alone. */
	private void trail(long member, int season, String action, String before, String after, long account,
			String name) {

		db.sql("insert into membership_change (competitor_id, season, action, basis_before, basis_after,"
						+ " decided_by, decided_by_name, decided_at) values (?, ?, ?, ?, ?, ?, ?, ?)")
				.params(member, season, action, before, after, account, name, Timestamp.from(clock.instant()))
				.update();
	}

	/** One message in his inbox, from the league, the shape {@link MemberPaymentApi} writes. */
	private void tell(long member, Said said) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body) values (?, null, ?, ?, ?)")
				.params(member, PairWriteApi.THE_LEAGUE, said.subject(), said.body())
				.update();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
