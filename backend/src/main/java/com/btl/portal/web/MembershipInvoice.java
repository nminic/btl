package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.member.MemberNumber;
import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZonedDateTime;

/**
 * WHAT ONE MEMBER OWES FOR THE SEASON ON SALE, worked out in ONE place because two routes act on
 * it and one of them spends money.
 *
 * <p><b>This class exists to stop the invoice and the deduction being two numbers.</b>
 * {@link MyMembershipApi} serves this to the screen that mints the payment code, and
 * {@link MyMembershipWriteApi} activates a membership out of it. Had each asked the database its
 * own questions, the answer a member was shown and the amount taken out of his book would be two
 * computations free to disagree - which is exactly the fault the owner's question of 26.09.2026
 * uncovered on the screen itself, where the page promised the balance would pay and the slip asked
 * for the full fee.
 *
 * <p><b>WHAT IT READS, and each is a fact the season turns on:</b> the day (which row of the price
 * list applies), the member's year of birth (whether the junior level applies), the book (what he
 * has), whether a membership already stands for him this season, and the basis his membership is
 * held on (whether he owes anything at all).
 */
@Component
class MembershipInvoice {

	/**
	 * The basis of a member the Managing Board has freed of the fee, as
	 * {@code competitor_membership_basis_known} (V7) names it - never „pocasni", which PDL forbids
	 * for such a member because in the Statute that word means somebody who is NOT a member at all.
	 * Written here
	 * as a literal because it IS a literal in the schema; what stops it drifting is
	 * {@code MeApiTest}, which asks PostgreSQL what that constraint actually says rather than
	 * comparing one written word against another.
	 */
	private static final String FEE_EXEMPT = "feeExempt";

	private final JdbcClient db;

	private final Clock clock;

	private final PriceRows priceRows;

	private final BalanceBook book;

	MembershipInvoice(JdbcClient db, Clock clock, PriceRows priceRows, BalanceBook book) {
		this.db = db;
		this.clock = clock;
		this.priceRows = priceRows;
		this.book = book;
	}

	/**
	 * @param season             the one on sale today ({@link SeasonClock#seasonBeingPaidFor}),
	 *                           never one anybody asked for
	 * @param priceKey           the row of the price list that applies to him
	 * @param settled            the fee, his balance, and what the one does to the other
	 * @param processingFeeEur   V16's fee, on a euro transfer only, and nothing when there is no
	 *                           transfer to process
	 * @param alreadyAMember     a {@code membership} row already stands for him and this season,
	 *                           on any basis
	 * @param exemptFromTheFee   {@code competitor.membership_basis} is {@code feeExempt}: he owes
	 *                           nothing, so there is nothing for a balance to pay
	 * @param numberHeAlreadyHas his member number, or {@code null} if he has never had one
	 */
	record Invoice(int season, String priceKey, Balance.Settlement settled, BigDecimal processingFeeEur,
			boolean alreadyAMember, boolean exemptFromTheFee, MemberNumber numberHeAlreadyHas) {
	}

	private record TheMember(LocalDate birthDate, String membershipBasis, String memberNumber) {
	}

	Invoice forMember(long me) {
		LocalDate today = LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE);
		int season = SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock));

		TheMember member = db.sql(
						"select birth_date, membership_basis, member_number from competitor where id = ?")
				.param(me)
				.query((row, i) -> new TheMember(row.getDate(1).toLocalDate(), row.getString(2),
						row.getString(3)))
				.single();

		var rows = priceRows.all();

		/* ASKED TWICE, ONCE PER CURRENCY, because that is what „dva zasebna cenovnika, ne jedan sa
		   konverzijom" leaves as the only way to have both numbers: the row that applies is the
		   same row either way and each call reads its own column off it. Computing one from the
		   other is the conversion ADL forbids. */
		MembershipPrice.Price inEuro = MembershipPrice.on(rows, MonthDay.from(today),
				member.birthDate().getYear(), season, true);
		MembershipPrice.Price inDinars = MembershipPrice.on(rows, MonthDay.from(today),
				member.birthDate().getYear(), season, false);

		Balance.Settlement settled = Balance.against(
				new Balance.Money(inEuro.amount(), inDinars.amount()), book.of(me));

		boolean alreadyAMember = Boolean.TRUE.equals(db.sql(
						"select exists(select 1 from membership where competitor_id = ? and season = ?)")
				.params(me, season).query(Boolean.class).single());

		/* NO TRANSFER, NOTHING TO PROCESS: reasoning rather than a written decision, and
		   {@link Balance} carries the whole of it. */
		BigDecimal processing = settled.coveredByTheBalance() ? BigDecimal.ZERO : inEuro.fee();

		return new Invoice(season, inEuro.key(), settled, processing, alreadyAMember,
				FEE_EXEMPT.equals(member.membershipBasis()),
				member.memberNumber() == null ? null : new MemberNumber(member.memberNumber()));
	}
}
