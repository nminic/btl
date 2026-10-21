package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.member.MemberNumber;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;

/**
 * A SEASON GRANTED WITHOUT A FEE ARRIVING, FOR THE TWO DOORS THAT GRANT ONE.
 *
 * <p><b>Why a class of its own, since 19.10.2026.</b> {@link MembershipWriteApi} granted a season on
 * the payments screen, freeing a member of the fee or letting him in on his balance, and this was its
 * private method. The owner's decision of 18.10.2026 (PDL P8, „Promene osnova na redu člana idu u oba
 * smera”) gives the member's row in the moderation of the members a change of basis from „uplata” to
 * the exemption ({@link MemberMembershipApi}), and an exemption written there is the same row with the
 * same trail as one written on the payments screen: the owner's decision of 03.10.2026, „Trag (ko je
 * odobrio i kada) ide uz svaku radnju koja prašta novac”, does not ask which door. One rule with two
 * doors is one body of code with two callers, the shape {@link BookingAPayment} already has for a
 * payment, so the method moved here unchanged and both doors call it.
 *
 * <p><b>Moved, not rewritten.</b> Every statement below is the one {@link MembershipWriteApi} ran, in
 * the same order, and the notes are its notes. Two things differ and both are the move: the account's
 * name is asked of {@link MemberOfAccount#nameOf}, which is the same statement the method spelt out,
 * and the answer is the member's number, because what each door answers with is the door's.
 *
 * <p><b>Opens no transaction of its own</b>: each door opens the one it writes in, and locks the
 * member's row {@code for update} before it calls this.
 */
@Component
class GrantingASeason {

	/** One of the three words of {@code membership_basis_known} (V22, widened by V38). */
	private static final String FEE_EXEMPT = "feeExempt";

	private final JdbcClient db;

	private final Clock clock;

	private final MemberNumbers numbers;

	private final BalanceBook book;

	private final MemberOfAccount memberOfAccount;

	GrantingASeason(JdbcClient db, Clock clock, MemberNumbers numbers, BalanceBook book,
			MemberOfAccount memberOfAccount) {
		this.db = db;
		this.clock = clock;
		this.numbers = numbers;
		this.book = book;
		this.memberOfAccount = memberOfAccount;
	}

	/**
	 * WRITES THE MEMBERSHIP, AND THE TWO GROUNDS DIFFER IN TWO PLACES RATHER THAN BEING TWO
	 * METHODS.
	 *
	 * <p>Everything that is the same is the same by construction - the number, {@code active}, the
	 * referrer being paid, the one transaction around all of it - and what differs is named below
	 * with what decided it. Two methods would let one of the four common things be edited in one of
	 * them.
	 *
	 * <p><b>WHAT IS THE SAME ON BOTH GROUNDS SINCE V62, AND USED TO DIFFER:</b> the basis is
	 * written in one place, the {@code membership} row. Until then an exemption also wrote the
	 * per-person column {@code competitor.membership_basis} and a balance could not, because V7's
	 * {@code competitor_membership_basis_known} knew two words and not three, so a man activated
	 * on his balance was called a payer by every screen. The column and its check went with the
	 * owner's decision of 18.10.2026 (PDL P8, „Osnov clanstva ima jedan dom").
	 *
	 * <p><b>1. THE TRAIL OF WHO DECIDED IT IS WRITTEN FOR EVERY ACT THAT FORGIVES MONEY, AND ON A
	 * SHORT BALANCE IT STANDS IN TWO PLACES.</b> The owner's decision of 03.10.2026, chosen among the
	 * options put to him (PDL P8, the entry „Trag (ko je odobrio i kada) ide uz svaku radnju koja
	 * prasta novac"): an exemption from the fee, and „Odobri umanjen iznos iz balansa"; „Odobri iz
	 * balansa" for the whole fee forgives nothing and goes without one. So the three columns
	 * {@code V35} added ({@code decided_by}, {@code decided_by_name},
	 * {@code decided_at}) are written when the ground is the fee being waived AND when the ground is
	 * the balance and it did not cover the fee ({@code forgivesMoney}, worked out by the caller),
	 * and are left empty otherwise. {@code membership_on_a_balance_carries_its_trail_whole_or_not_at_all}
	 * (V56) holds the three together on a balance. It cannot hold „a trail exactly when the balance
	 * fell short", because a row carries no price: deciding which of the two a row gets is this
	 * method's work, and {@code MembershipWriteApiTest}'s to hold, on both sides of the fee.
	 * <p><b>The book is the other place, and it is kept.</b> {@code balance_entry.recorded_by},
	 * {@code recorded_by_name} and {@code occurred_at} (V38) name whoever spent the balance and when.
	 * That is the record of the money, and it is written on a whole fee too, where the membership
	 * carries nothing. On a short balance the same account, name and moment stand on the membership
	 * as well, so „on which memberships was money forgiven, and by whom" is one question on one table
	 * for an exemption and for a short balance alike (ADL, the entry of 09.10.2026 under the decision
	 * of 03.10.2026).
	 * <p><b>WHAT THIS PARAGRAPH SAID UNTIL 09.10.2026, written out because it was the premise and it
	 * is overturned.</b> It said that for a balance the trail was {@code balance_entry.recorded_by} and
	 * {@code recorded_by_name} and nothing else, „so the trail has one home per ground and the same act
	 * is never recorded twice", and that filling the membership columns on a balance would make „who
	 * activated this" answerable from two tables with nothing saying which is right. The owner's
	 * decision of 03.10.2026 overturned it, and the fact is now recorded twice on purpose. What keeps
	 * two homes one answer is not a sentence but a case: {@code theTrailOnTheRowIsTheTrailInTheBook}
	 * reads both for one press and requires the same account, the same name and the same moment. Both
	 * are written in this transaction, from this request's account and from ONE reading of this
	 * clock, handed to both ({@link BalanceBook#spentOnAMembership}). Until the review of PR 505 each
	 * home read the clock for itself, and the two moments were one only under the fixed clock of the
	 * cases; the case now runs on a clock that moves at every reading, where two readings are two
	 * moments.
	 * <p><b>The member's own door writes no trail, and that is right rather than missing.</b>
	 * {@link MyMembershipWriteApi} only ever spends a balance that covers the fee, so the act forgives
	 * nothing there, exactly as a whole fee forgives nothing here.
	 *
	 * <p><b>2. THE BOOK IS WRITTEN FIRST, AND ONLY ON THE GROUND THAT SPENDS.</b> V38 gives
	 * {@code membership} a {@code balance_entry_id} and
	 * {@code membership_basis_says_whether_a_book_entry_is_named} refuses a {@code balance}
	 * membership naming none, so the order is not a preference. An exemption takes nothing off
	 * anybody: {@link BalanceBook} carries the reason and PDL 11.08.2026 is where it comes from.
	 *
	 * @param competitorId  whose season it is, already locked {@code for update} by the caller
	 * @param memberNumber  his number, or {@code null} when he has never had one and one is drawn
	 * @param basis         the word {@code membership.basis} is to carry: {@code feeExempt}, or
	 *                      {@code balance} as {@link com.btl.portal.domain.membership.GrantingAMembership#groundIsWrittenAs}
	 *                      spells it
	 * @param offTheBook    what this activation takes out of his book, already worked out and already
	 *                      known not to be nothing on the ground that spends
	 * @param forgivesMoney whether this act forgives money, which is what decides whether the trail
	 *                      is written: an exemption always, a balance when it fell short of the fee.
	 *                      Worked out once by the caller, from the settlement the amount came from
	 * @param account       the account that asked, which is the trail and never the member's own
	 * @return his number, new or the one he had
	 */
	MemberNumber grant(long competitorId, String memberNumber, int season, String basis,
			Balance.Money offTheBook, boolean forgivesMoney, long account) {

		String enteredByName = memberOfAccount.nameOf(account);

		boolean freeOfTheFee = FEE_EXEMPT.equals(basis);

		/* THE MOMENT IS READ ONCE, and both homes of the trail are handed that reading (PENDING, review
		   of PR 505, finding 1). Each home reading the clock for itself gave two instants,
		   microseconds apart, and the only thing that made them one answer in the cases was a clock
		   that does not move: `theTrailOnTheRowIsTheTrailInTheBook` could not tell one reading from
		   two. `BalanceBook.translated` reads once for its pair of lines for the same reason. */
		Instant when = clock.instant();

		/* THE LINE IN THE BOOK BEFORE THE MEMBERSHIP THAT NAMES IT, for the reason point 2 gives.
		   `spentOnAMembership` is where the sign lives, so what is handed over is money he HAS and
		   the minus is the book's business rather than this route's. */
		Long entry = freeOfTheFee ? null
				: book.spentOnAMembership(competitorId, season, offTheBook, account,
						enteredByName, when);

		/* THE TRAIL, THREE COLUMNS OR NONE, which is what V56 asks of a balance and V35 of an
		   exemption: the account that is asking, the name it carries now (copied, because the name is
		   what outlives the account), and this clock's instant. All three come from the request's own
		   principal and never from the body or from the member being activated, so a moderator who
		   activates himself is named, and is named because he asked. */
		db.sql("insert into membership (competitor_id, season, basis, payment_id, balance_entry_id,"
						+ " decided_by, decided_by_name, decided_at) values (?, ?, ?, null, ?, ?, ?, ?)")
				.params(competitorId, season, basis, entry,
						forgivesMoney ? account : null,
						forgivesMoney ? enteredByName : null,
						forgivesMoney ? Timestamp.from(when) : null)
				.update();

		/* AND WHOEVER BROUGHT HIM IN IS PAID, HERE TOO, because the owner said so in as many words on
		   13.08.2026: „OK je da se za preporuku dobije balans cak i ako je preporucen clan dobio
		   pocasnu aktivaciju." PDL ties the reward to ACTIVATION („Iznos leze na balans automatski, u
		   trenutku kad se novom clanu aktivira clanarina") and says nothing about how it was paid
		   for, and an exemption is one of the three ways a `membership` row comes to exist.

		   WHY THIS IS NOT A CONVENIENCE BUT THE ONLY MOMENT THERE IS. A member freed of the fee does
		   not come through the payments screen afterwards - `THE_FEE_IS_ALREADY_RECORDED` refuses a
		   second act on a season already held, and `PaymentApi` refuses him likewise - and the one road
		   from an exemption to a payment, the change of basis on the member's row (18.10.2026), is not
		   one every season takes. So a reward not written here may never be written at all. Measured
		   when this was first written, as a method of `MembershipWriteApi`: the grant answered 201, the
		   referrer's book stayed empty, and the same man through the payments door answered 409.

		   V38's carry says of this exact case that it leaves such a referral „rewarded by whatever
		   route records that exemption, the day it exists". This is that route and that day.

		   `on conflict (referred_competitor_id) do nothing` inside `aReferralWasActivated` is what
		   keeps it once per member brought in, so a man freed of the fee for a second season earns
		   his referrer nothing further, and it is silent rather than an error. Inside the one
		   transaction this route already opens, so the entry and the membership stand or fall
		   together. */
		book.aReferralWasActivated(competitorId, account, enteredByName);

		/* AND ONLY NOW IS A NUMBER DRAWN, AFTER EVERY ROW THE DATABASE COULD STILL REFUSE, which is
		   the order the two other doors to the same fact already keep: `PaymentApi.recordIt` draws
		   last and `MyMembershipWriteApi.letHimIn` draws after its own `insert into membership`.
		   `member_number_seq` is not transactional, so a number drawn ahead of a booking the
		   database then refuses is spent for good, and the owner's rule is „Clanski broj se nikad ne
		   dodeljuje dvaput" (PDL 31.07.2026). `MemberNumbers` used to record why this route alone
		   drew first, and the reason it gave - that no case could fail on the move - is answered by
		   `FreeingTwiceAtOneInstantTest.aBookingTheDatabaseRefusesDrawsNoNumber`.

		   THE NUMBER AND THE FLAG, AND NOTHING ELSE ON `competitor`. `active` is what every public
		   reader ends on (`where c.active`, ten of them), and PDL:3417 says an activation shows
		   „odmah" exactly as a booked payment does. Both are written whether or not a number was
		   drawn, so the facts cannot come apart, and on both grounds alike: the basis is the row
		   written above and has no second home since V62. Nothing written above reads either of the
		   two: the book and the referral touch `balance_entry`, and the only column of `competitor`
		   they read is `referred_by`. */
		MemberNumber number = memberNumber == null
				? numbers.draw()
				: new MemberNumber(memberNumber);

		db.sql("update competitor set member_number = ?, active = true where id = ?")
				.params(number.written(), competitorId).update();

		return number;
	}

}
